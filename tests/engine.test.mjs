import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OILS,
  TAINTED_OIL,
  OUTER_SOCKETS,
  DONATE_CONFIG,
  getSocketPaths,
  getPoeNinjaOilsUrl,
  getPoeNinjaOilApiUrl,
} from '../src/constants.js';
import {
  comb,
  getAll364OilCombos,
  getEligiblePool,
  computeSingleNotableBucketSeedProb,
  computeHitProbability,
  computeComboRollCost,
  rankAll364OilCombos,
  simulateCassiaRoll,
  buildTradeQueryPayload,
  buildTradeSearchUrl,
  buildPobItemText,
  parsePoeNinjaOilJson,
} from '../src/calculator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');

const treeData = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'poe_330_tree.json'), 'utf8'));
const priceData = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'oil_prices.json'), 'utf8'));

test('poe_330_tree.json contains verified 3.30.0 dataset integrity', () => {
  assert.equal(treeData.notables.length, 472);
  const blightedCount = treeData.notables.filter((n) => n.isBlighted).length;
  const onTreeCount = treeData.notables.filter((n) => !n.isBlighted).length;
  assert.equal(blightedCount, 30);
  assert.equal(onTreeCount, 442);

  const tradeVerified = treeData.notables.filter((n) => n.tradeVerified).length;
  assert.equal(tradeVerified, 472);

  assert.equal(treeData.outerSockets.length, 6);
  assert.equal(treeData.nodes.length, 2036);
  assert.equal(treeData.edges.length, 2335);

  const subSockets = treeData.nodes.filter(
    (n) => n.name === 'Small Jewel Socket' || n.name === 'Medium Jewel Socket'
  );
  assert.equal(subSockets.length, 0, 'Cluster Jewel proxy sub-sockets must be excluded');
  assert.equal(treeData.nodes.filter((n) => n.kind === 'mastery').length, 0, 'Mastery nodes must be excluded');
  assert.equal(
    treeData.nodes.filter((n) => n.kind === 'small' && (n.icon || n.stats)).length,
    0,
    'Small nodes must not carry stripped icon/stat bloat'
  );
  assert.equal(
    treeData.nodes.filter((n) => n.kind === 'start' && (n.icon || n.classStart !== undefined)).length,
    0,
    'Start nodes must not carry class/ascendancy icon bloat'
  );
  assert.equal(treeData.groupBackgrounds, undefined, 'Decorative groupBackgrounds must be stripped');

  assert.deepEqual(
    Object.keys(treeData.sprites?.sheets || {}).sort(),
    ['active', 'frame', 'inactive'],
    'Only the 3 notable/frame sprite sheets should remain'
  );
  assert.equal(treeData.sprites.normalActive, undefined);
  assert.equal(treeData.sprites.normalInactive, undefined);
  assert.equal(treeData.sprites.masteryInactive, undefined);
  assert.equal(treeData.sprites.startNode, undefined);
  assert.equal(treeData.sprites.groupBackground, undefined);

  for (const nb of treeData.notables) {
    assert.ok(Number.isFinite(nb.x) && Number.isFinite(nb.y), `Notable ${nb.name} missing finite coords`);
    const hasSprite = Boolean(
      treeData.sprites.notableActive?.[nb.icon] ||
      treeData.sprites.keystoneActive?.[nb.icon] ||
      treeData.sprites.notableInactive?.[nb.icon] ||
      treeData.sprites.keystoneInactive?.[nb.icon]
    );
    assert.ok(hasSprite, `Notable ${nb.name} (${nb.icon}) missing sprite coords`);
  }

  const adaptiveSteel = treeData.notables.find((n) => n.id === '14587' && n.name === 'Adaptive Steel');
  const worshipBlightheart = treeData.notables.find((n) => n.id === '27781' && n.name === 'Worship the Blightheart');
  assert.ok(adaptiveSteel && Number.isFinite(adaptiveSteel.x) && Number.isFinite(adaptiveSteel.y));
  assert.ok(worshipBlightheart && Number.isFinite(worshipBlightheart.x) && Number.isFinite(worshipBlightheart.y));

  for (const node of treeData.nodes) {
    assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y), `Node ${node.id} missing finite coords`);
  }
});

test('oil_prices.json contains positive Chaos prices for all 14 oils + Tainted Oil', () => {
  assert.ok(Number.isFinite(priceData.divineChaos) && priceData.divineChaos > 0);
  assert.ok(priceData.byLeague?.Covens?.prices, 'Expected byLeague.Covens multi-league snapshot');
  assert.equal(OILS.length, 14);
  for (const oil of [...OILS, TAINTED_OIL]) {
    const val = priceData.prices[oil.id];
    assert.ok(Number.isFinite(val) && val > 0, `Missing/invalid price for ${oil.id}: ${val}`);
  }
});

test('poe.ninja JSON importer, league URLs, and DONATE_CONFIG work cleanly', () => {
  assert.equal(getPoeNinjaOilsUrl('Covens'), 'https://poe.ninja/poe1/economy/covens/oils');
  assert.equal(getPoeNinjaOilsUrl('Hardcore Covens'), 'https://poe.ninja/poe1/economy/hardcore-covens/oils');
  assert.equal(
    getPoeNinjaOilApiUrl('Hardcore Covens'),
    'https://poe.ninja/poe1/api/economy/exchange/current/overview?league=Hardcore%20Covens&type=Oil'
  );

  const parsed = parsePoeNinjaOilJson(
    JSON.stringify({
      core: { rates: { divine: 0.005 } },
      lines: [
        { id: 'golden-oil', primaryValue: 92.34567 },
        { id: 'tainted-oil', primaryValue: 210 },
        { id: 'clear-oil', primaryValue: 0.15 },
      ],
    })
  );
  assert.equal(parsed.count, 3);
  assert.equal(parsed.prices.GoldenOil, 92.3457);
  assert.equal(parsed.prices.TaintedOil, 210);
  assert.equal(parsed.prices.ClearOil, 0.15);
  assert.equal(parsed.divineChaos, 200);

  assert.throws(() => parsePoeNinjaOilJson(''), /Paste/i);
  assert.throws(() => parsePoeNinjaOilJson('{bad json'), /Invalid JSON/i);
  assert.throws(() => parsePoeNinjaOilJson({ lines: [] }), /No positive/i);

  assert.ok(DONATE_CONFIG?.title && Array.isArray(DONATE_CONFIG.links) && DONATE_CONFIG.links.length > 0);
  const kofiLink = DONATE_CONFIG.links.find((l) => l.id === 'kofi');
  assert.equal(kofiLink?.url, 'https://ko-fi.com/kanjs');
});

test('all 6 OUTER_SOCKETS have exact 12 grown nodes reachable from socket core 0', () => {
  assert.equal(OUTER_SOCKETS.length, 6);
  for (const sock of OUTER_SOCKETS) {
    const coreNodes = sock.layout.nodes.filter((n) => n.role === 'socket');
    const smallNodes = sock.layout.nodes.filter((n) => n.role === 'small');
    const notableNodes = sock.layout.nodes.filter((n) => n.role === 'notable');
    assert.equal(coreNodes.length, 1, `Socket ${sock.id} core count`);
    assert.equal(coreNodes[0].i, 0, `Socket ${sock.id} core index must be 0`);
    assert.equal(smallNodes.length, 8, `Socket ${sock.id} small count`);
    assert.equal(notableNodes.length, 4, `Socket ${sock.id} notable count`);

    const { dist } = getSocketPaths(sock);
    assert.equal(dist.size, 13, `Socket ${sock.id} must have 13 connected vertices`);
    for (const node of sock.layout.nodes) {
      assert.ok(dist.has(node.i), `Socket ${sock.id} node ${node.i} unreachable`);
    }
  }
});

test('getAll364OilCombos generates exact C(14,3)=364 combinations', () => {
  assert.equal(comb(14, 3), 364);
  const all = getAll364OilCombos(14);
  assert.equal(all.length, 364);
  const tier3 = getAll364OilCombos(3);
  assert.equal(tier3.length, 1);
});

test('getEligiblePool returns verified exact 3.30 pool sizes and rejects duplicates', () => {
  const expectedBuckets = [1, 3, 6, 10, 15, 21, 21, 34, 43, 54, 65, 78, 90, 31];
  for (let t = 1; t <= 14; t++) {
    const count = treeData.notables.filter((n) => n.maxTier === t).length;
    assert.equal(count, expectedBuckets[t - 1], `Expected maxTier T${t} bucket count ${expectedBuckets[t - 1]}`);
  }
  assert.equal(expectedBuckets.reduce((a, b) => a + b, 0), 472);

  assert.equal(getEligiblePool(treeData.notables, ['ClearOil', 'SepiaOil', 'AmberOil']).length, 10);
  assert.equal(getEligiblePool(treeData.notables, ['ClearOil', 'SilverOil', 'GoldenOil']).length, 169);
  assert.equal(getEligiblePool(treeData.notables, ['ClearOil', 'SepiaOil', 'PrismaticOil']).length, 35);
  assert.equal(getEligiblePool(treeData.notables, ['CrimsonOil', 'VioletOil', 'OpalescentOil']).length, 142);
  assert.equal(getEligiblePool(treeData.notables, ['SilverOil', 'GoldenOil', 'PrismaticOil']).length, 199);
  assert.equal(
    getEligiblePool(treeData.notables, ['ClearOil', 'SilverOil', 'GoldenOil'], 'per_oil_bucket').length,
    233
  );

  assert.throws(() => {
    getEligiblePool(treeData.notables, ['ClearOil', 'ClearOil', 'AmberOil']);
  }, /distinct/i);
});

test('computeHitProbability computes exact hypergeometric, 6-bucket, and verified exact_tier_bucket math', () => {
  // Synthetic 10-item pool for exact closed-form check
  const synthPool = Array.from({ length: 10 }, (_, idx) => ({
    id: idx + 1,
    overlapSlots: idx === 0 ? 3 : 1,
    weight: idx === 0 ? 3 : 1,
  }));

  // Uniform 1 target in 10 items (4 draws): 1 - C(9,4)/C(10,4) = 1 - 126/210 = 0.4
  const u1 = computeHitProbability(synthPool, new Set([1]), 1, 'uniform');
  assert.ok(Math.abs(u1.probability - 0.4) < 1e-12);

  // Uniform 2 targets in 10 items, minHits=2: C(2,2)*C(8,2)/C(10,4) = 28/210
  const u2 = computeHitProbability(synthPool, new Set([1, 2]), 2, 'uniform');
  assert.ok(Math.abs(u2.probability - 28 / 210) < 1e-12);

  // Weighted overlap: exact distribution across k=0..4 sums to 1.0
  const wHigh = computeHitProbability(synthPool, new Set([1]), 1, 'weighted_overlap');
  const distSum = wHigh.exactByHits.reduce((acc, v) => acc + v, 0);
  assert.ok(Math.abs(distSum - 1.0) < 1e-12, `Distribution sum=${distSum}`);

  // Node id=1 has weight 3 vs node id=2 with weight 1 -> strictly higher hit chance
  const wLow = computeHitProbability(synthPool, new Set([2]), 1, 'weighted_overlap');
  assert.ok(wHigh.probability > wLow.probability);
  assert.ok(wHigh.probability > u1.probability);

  // Strict subset check on real data
  const strictPool = getEligiblePool(treeData.notables, ['ClearOil', 'SepiaOil', 'AmberOil'], 'strict_subset');
  assert.ok(strictPool.length > 0 && strictPool.length <= 10);

  // Single notable seed probability helper closed-form checks
  assert.ok(Math.abs(computeSingleNotableBucketSeedProb(1) - 65 / 81) < 1e-12);
  assert.ok(Math.abs(computeSingleNotableBucketSeedProb(3) - 107 / 243) < 1e-12);
  assert.ok(Math.abs(computeSingleNotableBucketSeedProb(31) - 4 / 93) < 1e-12);

  // Verified exact_tier_bucket checks
  const clearSilverGold = getEligiblePool(treeData.notables, ['ClearOil', 'SilverOil', 'GoldenOil'], 'exact_tier_bucket');
  const irHit = computeHitProbability(clearSilverGold, new Set(['4918']), 1, 'exact_tier_bucket');
  assert.ok(Math.abs(irHit.probability - 65 / 81) < 1e-12);
  assert.ok(Math.abs(irHit.expectedUniqueEnchants - 281 / 81) < 1e-12);
  const expIrDist = [0, 1 / 81, 8 / 81, 24 / 81, 48 / 81];
  for (let i = 0; i <= 4; i++) {
    assert.ok(Math.abs(irHit.enchantCountDist[i] - expIrDist[i]) < 1e-12);
  }

  // Clear + Sepia + Amber exact enchant distribution (even with empty targets!)
  const clearSepiaAmber = getEligiblePool(treeData.notables, ['ClearOil', 'SepiaOil', 'AmberOil'], 'exact_tier_bucket');
  const emptyCsa = computeHitProbability(clearSepiaAmber, new Set(), 1, 'exact_tier_bucket');
  assert.equal(emptyCsa.possible, false);
  assert.ok(Math.abs(emptyCsa.expectedUniqueEnchants - 280 / 81) < 1e-12);
  const expCsaDist = [0, 1 / 81, 8 / 81, 25 / 81, 47 / 81];
  for (let i = 0; i <= 4; i++) {
    assert.ok(Math.abs(emptyCsa.enchantCountDist[i] - expCsaDist[i]) < 1e-12);
  }

  // Sepia + Amber + Verdant: Practised Reapplication = 107/243, 3-enchant exhaustion = 1/81
  const sepiaAmberVerdant = getEligiblePool(treeData.notables, ['SepiaOil', 'AmberOil', 'VerdantOil'], 'exact_tier_bucket');
  const prpHit = computeHitProbability(sepiaAmberVerdant, new Set(['37425']), 1, 'exact_tier_bucket');
  assert.ok(Math.abs(prpHit.probability - 107 / 243) < 1e-12);
  assert.ok(Math.abs(prpHit.enchantCountDist[3] - 1 / 81) < 1e-12);
  assert.ok(Math.abs(prpHit.enchantCountDist[4] - 80 / 81) < 1e-12);

  // Prismatic independence: Adaptive Steel = 4/93 regardless of pairing cheap vs Silver+Golden
  const cspPool = getEligiblePool(treeData.notables, ['ClearOil', 'SepiaOil', 'PrismaticOil'], 'exact_tier_bucket');
  const sgpPool = getEligiblePool(treeData.notables, ['SilverOil', 'GoldenOil', 'PrismaticOil'], 'exact_tier_bucket');
  const adapCsp = computeHitProbability(cspPool, new Set(['14587']), 1, 'exact_tier_bucket');
  const adapSgp = computeHitProbability(sgpPool, new Set(['14587']), 1, 'exact_tier_bucket');
  assert.ok(Math.abs(adapCsp.probability - 4 / 93) < 1e-12);
  assert.ok(Math.abs(adapSgp.probability - 4 / 93) < 1e-12);
  assert.ok(Math.abs(adapCsp.exactByHits.reduce((a, b) => a + b, 0) - 1.0) < 1e-12);

  // Legacy per_oil_bucket (with-replacement overlap) exact probability & DP checks
  for (const oils of [
    ['ClearOil', 'SepiaOil', 'AmberOil'],
    ['IndigoOil', 'BlackOil', 'PrismaticOil'],
    ['SilverOil', 'GoldenOil', 'PrismaticOil'],
  ]) {
    const pPool = getEligiblePool(treeData.notables, oils, 'per_oil_bucket');
    const probSum = pPool.reduce((acc, item) => acc + item.drawProb, 0);
    assert.ok(Math.abs(probSum - 1.0) < 1e-12, `drawProb sum for ${oils.join('+')} = ${probSum}`);
  }

  const indBlackPris = getEligiblePool(treeData.notables, ['IndigoOil', 'BlackOil', 'PrismaticOil'], 'per_oil_bucket');
  const adaptive = indBlackPris.find((n) => n.name === 'Adaptive Steel');
  const worship = indBlackPris.find((n) => n.name === 'Worship the Blightheart');
  assert.ok(adaptive && worship);
  const pAdap = computeHitProbability(indBlackPris, new Set([adaptive.id]), 1, 'per_oil_bucket');
  const pWors = computeHitProbability(indBlackPris, new Set([worship.id]), 1, 'per_oil_bucket');
  assert.ok(Math.abs(pAdap.exactByHits.reduce((a, b) => a + b, 0) - 1.0) < 1e-12);
  assert.ok(Math.abs(pAdap.probability - (1 - Math.pow(1 - adaptive.drawProb, 4))) < 1e-12);
  assert.ok(
    pAdap.probability > pWors.probability,
    `Adaptive Steel (${pAdap.probability}) should exceed Worship (${pWors.probability}) under legacy per-oil model`
  );

  // Multi-target exact DP sum check on per_oil_bucket
  const multiTargets = new Set(indBlackPris.slice(0, 4).map((n) => n.id));
  const pMulti = computeHitProbability(indBlackPris, multiTargets, 2, 'per_oil_bucket');
  assert.ok(Math.abs(pMulti.exactByHits.reduce((a, b) => a + b, 0) - 1.0) < 1e-12);
  assert.ok(pMulti.probability > 0 && pMulti.probability < 1);
});

test('rankAll364OilCombos ranks Charisma & Whispers of Doom across 364 recipes and handles Tainted/MaxTier filters', () => {
  const charisma = treeData.notables.find((n) => n.name === 'Charisma');
  const whispers = treeData.notables.find((n) => n.name === 'Whispers of Doom');
  assert.ok(charisma && whispers);

  const ranked = rankAll364OilCombos({
    notables: treeData.notables,
    targetIds: [charisma.id, whispers.id],
    minHits: 1,
    oilPrices: priceData.prices,
    divineChaos: priceData.divineChaos,
    model: 'uniform',
    maxOilTier: 14,
    includeTainted: false,
    sortBy: 'expectedCost',
  });
  assert.ok(ranked.length > 0 && ranked.length <= 364);
  assert.ok(ranked.every((r) => r.probability > 0));
  assert.ok(ranked[0].expectedCostChaos <= ranked[1].expectedCostChaos);

  // Hidden Prismatic anointment test: Adaptive Steel (PrismaticOil + BlackOil + BlackOil)
  const adaptiveSteel = treeData.notables.find((n) => n.name === 'Adaptive Steel');
  assert.ok(adaptiveSteel?.isBlighted);
  const prismaticBlackPool = getEligiblePool(treeData.notables, ['ClearOil', 'BlackOil', 'PrismaticOil']);
  const adaptiveEntry = prismaticBlackPool.find((n) => n.id === adaptiveSteel.id);
  assert.ok(adaptiveEntry, 'Adaptive Steel must be eligible in Clear + Black + Prismatic pool');
  assert.equal(adaptiveEntry.overlapSlots, 3, 'Prismatic + Black overlaps all 3 recipe slots of Adaptive Steel');
  const adaptiveRanked = rankAll364OilCombos({
    notables: treeData.notables,
    targetIds: [adaptiveSteel.id],
    minHits: 1,
    oilPrices: priceData.prices,
    divineChaos: priceData.divineChaos,
  });
  assert.ok(adaptiveRanked.length > 0 && adaptiveRanked.every((r) => r.oils.includes('PrismaticOil')));
  assert.ok(Math.abs(adaptiveRanked[0].probability - 4 / 93) < 1e-12);
  const sgpRank = adaptiveRanked.find(
    (r) => r.oils.includes('SilverOil') && r.oils.includes('GoldenOil') && r.oils.includes('PrismaticOil')
  );
  assert.ok(sgpRank && adaptiveRanked[0].expectedCostChaos < sgpRank.expectedCostChaos);

  // Impossible 4-distinct-maxTier jackpot under verified exact_tier_bucket
  const t4Notable = treeData.notables.find((n) => n.maxTier === 4);
  assert.ok(t4Notable);
  const impossibleFourTiers = rankAll364OilCombos({
    notables: treeData.notables,
    targetIds: ['4918', '37425', '12702', t4Notable.id],
    minHits: 4,
    oilPrices: priceData.prices,
    divineChaos: priceData.divineChaos,
  });
  assert.equal(impossibleFourTiers.length, 0);

  const lowNotable = getEligiblePool(treeData.notables, ['ClearOil', 'SepiaOil', 'AmberOil'])[0];
  const lowTierOnly = rankAll364OilCombos({
    notables: treeData.notables,
    targetIds: [lowNotable.id],
    minHits: 1,
    oilPrices: priceData.prices,
    divineChaos: priceData.divineChaos,
    maxOilTier: 5,
    includeTainted: true,
  });
  assert.ok(lowTierOnly.length > 0 && lowTierOnly.length <= comb(5, 3));
  assert.ok(lowTierOnly.every((r) => r.maxTier <= 5));
  assert.ok(
    lowTierOnly[0].rollCostChaos >= priceData.prices.TaintedOil,
    'Corrupted mode must include Tainted Oil price'
  );
});

test('simulateCassiaRoll handles verified exact_tier_bucket, legacy per_oil_bucket, and non-replacement models', () => {
  const pool = getEligiblePool(treeData.notables, ['SilverOil', 'GoldenOil', 'PrismaticOil'], 'weighted_overlap');
  const poolSet = new Set(pool.map((n) => n.id));
  for (let i = 0; i < 100; i += 1) {
    const rolled = simulateCassiaRoll(pool, 'weighted_overlap');
    assert.equal(rolled.length, 4);
    const seen = new Set(rolled.map((n) => n.id));
    assert.equal(seen.size, 4);
    for (const id of seen) {
      assert.ok(poolSet.has(id));
    }
  }

  // Verified exact_tier_bucket: Amber + Silver + Prismatic always yields 4 distinct notables in tiers {3,12,14}
  const ambSilPris = getEligiblePool(treeData.notables, ['AmberOil', 'SilverOil', 'PrismaticOil'], 'exact_tier_bucket');
  for (let i = 0; i < 200; i += 1) {
    const rolled = simulateCassiaRoll(ambSilPris, 'exact_tier_bucket');
    assert.equal(rolled.length, 4);
    assert.equal(new Set(rolled.map((n) => n.id)).size, 4);
    for (const n of rolled) {
      assert.ok([3, 12, 14].includes(n.maxTier), `Unexpected maxTier ${n.maxTier}`);
    }
  }

  // Verified exact_tier_bucket: Sepia + Amber + Verdant never yields <3; any 3-enchant roll is all 3 Sepia notables
  const sepAmbVer = getEligiblePool(treeData.notables, ['SepiaOil', 'AmberOil', 'VerdantOil'], 'exact_tier_bucket');
  const sepiaNames = new Set(['Cruel Retort', 'Prepared Response', 'Practised Reapplication']);
  for (let i = 0; i < 500; i += 1) {
    const rolled = simulateCassiaRoll(sepAmbVer, 'exact_tier_bucket');
    assert.ok(rolled.length === 3 || rolled.length === 4, `Unexpected Sepia length ${rolled.length}`);
    assert.equal(new Set(rolled.map((n) => n.id)).size, rolled.length);
    if (rolled.length === 3) {
      for (const n of rolled) assert.ok(sepiaNames.has(n.name), `Expected Sepia notable, got ${n.name}`);
    }
  }

  // Verified exact_tier_bucket: Clear + Sepia + Amber produces 1..4 unique enchants and <4 exhaustion rolls
  const clearSepAmb = getEligiblePool(treeData.notables, ['ClearOil', 'SepiaOil', 'AmberOil'], 'exact_tier_bucket');
  let sawExactExhausted = false;
  for (let i = 0; i < 500; i += 1) {
    const rolled = simulateCassiaRoll(clearSepAmb, 'exact_tier_bucket');
    assert.ok(rolled.length >= 1 && rolled.length <= 4);
    assert.equal(new Set(rolled.map((n) => n.id)).size, rolled.length);
    if (rolled.length < 4) sawExactExhausted = true;
  }
  assert.ok(sawExactExhausted, 'Expected Clear/Sepia exhaustion to yield <4 enchants');

  // Legacy per_oil_bucket duplicate collapse check
  const smallPool = getEligiblePool(treeData.notables, ['ClearOil', 'SepiaOil', 'AmberOil'], 'per_oil_bucket');
  const smallSet = new Set(smallPool.map((n) => n.id));
  let sawCollapsed = false;
  for (let i = 0; i < 200; i += 1) {
    const rolled = simulateCassiaRoll(smallPool, 'per_oil_bucket');
    assert.ok(rolled.length >= 1 && rolled.length <= 4, `Unexpected length ${rolled.length}`);
    if (rolled.length < 4) sawCollapsed = true;
    const seen = new Set(rolled.map((n) => n.id));
    assert.equal(seen.size, rolled.length);
    for (const id of seen) {
      assert.ok(smallSet.has(id));
    }
  }
  assert.ok(sawCollapsed, 'Expected with-replacement duplicate collapse to yield <4 enchants on N=10 pool');
});

test('buildTradeSearchUrl and buildPobItemText produce valid PoE 3.30 outputs', () => {
  const charisma = treeData.notables.find((n) => n.name === 'Charisma');
  const soulThief = treeData.notables.find((n) => n.name === 'Soul Thief');

  const withBricked = buildTradeQueryPayload({
    targetIds: [charisma.id, soulThief.id],
    minHits: 1,
    includeBrickedBase: true,
  });
  assert.ok(JSON.stringify(withBricked).includes(`enchant.stat_3599615742|${charisma.id}`));

  const tradeUrlObj = buildTradeSearchUrl({
    league: 'Covens',
    targetIds: [charisma.id, soulThief.id],
    minHits: 1,
    includeBrickedBase: false,
  });
  assert.ok(tradeUrlObj.url.startsWith('https://www.pathofexile.com/trade/search/Covens?q='));

  const pobText = buildPobItemText({
    rolledNotables: [charisma, soulThief],
    socket: null,
    corrupted: true,
  });
  assert.ok(pobText.includes('Mycelium Core'));
  assert.ok(pobText.includes('Charisma'));
  assert.ok(pobText.includes('Corrupted'));
});

test('official PoE visual assets (Putrid Seed, 15 Oils, and 3 Tree sprite sheets) exist on disk', async () => {
  const assetsDir = path.resolve(__dirname, '../assets');
  const requiredFiles = [
    path.join(assetsDir, 'putrid_seed.png'),
    path.join(assetsDir, 'tree/skills-2.jpg'),
    path.join(assetsDir, 'tree/skills-disabled-2.jpg'),
    path.join(assetsDir, 'tree/frame-2.png'),
    ...[...OILS, TAINTED_OIL].map((o) => path.join(assetsDir, 'oils', `${o.id}.png`)),
  ];

  for (const file of requiredFiles) {
    const stat = await fs.stat(file);
    assert.ok(stat.size > 0, `Expected non-empty asset file: ${file}`);
  }

  for (const removed of ['tree/mastery-disabled-2.png', 'tree/group-background-2.png']) {
    await assert.rejects(fs.stat(path.join(assetsDir, removed)), /ENOENT/);
  }
});
