import { OILS, OIL_MAP, TAINTED_OIL } from './constants.js';

/**
 * Exact integer binomial coefficient nCr without floating-point overflow.
 */
export function comb(n, r) {
  if (r < 0 || r > n) return 0;
  if (r === 0 || r === n) return 1;
  const k = Math.min(r, n - r);
  let res = 1;
  for (let i = 1; i <= k; i++) {
    res = (res * (n - k + i)) / i;
  }
  return Math.round(res);
}

/**
 * Generates all C(14, 3) = 364 distinct 3-oil combinations sorted ascending by tier.
 */
export function getAll364OilCombos(maxOilTier = 14) {
  const valid = OILS.filter((o) => o.tier <= maxOilTier);
  const combos = [];
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      for (let k = j + 1; k < valid.length; k++) {
        combos.push([valid[i].id, valid[j].id, valid[k].id]);
      }
    }
  }
  return combos;
}

const FACTORIAL = [1, 1, 2, 6, 24];

/**
 * Exact probability that a single notable in a disjoint oil bucket of size `bucketSize`
 * is drawn across 4 independent 1/3-oil draws without replacement within that bucket.
 */
export function computeSingleNotableBucketSeedProb(bucketSize) {
  if (!Number.isFinite(bucketSize) || bucketSize <= 0) return 0;
  // Binomial(4, 1/3) weights for k = 1..4 slots picking this oil: 32/81, 24/81, 8/81, 1/81
  const slotWeights = [0, 32 / 81, 24 / 81, 8 / 81, 1 / 81];
  let prob = 0;
  for (let k = 1; k <= 4; k++) {
    prob += slotWeights[k] * (Math.min(k, bucketSize) / bucketSize);
  }
  return prob;
}

/**
 * Filters all 472 anointable notables into the eligible pool for 3 distinct chosen oils.
 *  - 'exact_tier_bucket': verified 3.30 model — each of 4 slots picks 1 of the 3 oils (1/3),
 *    then draws without replacement from notables whose maxTier equals that oil.
 *  - 'per_oil_bucket': legacy with-replacement overlap model (maxTier <= max(chosen3)).
 *  - 'uniform': maxTier(recipe) <= maxTier(chosen3) AND shares >=1 oil with chosen3. Equal weights.
 *  - 'weighted_overlap': same pool as uniform, weighting notables by overlap slot count (1, 2, or 3).
 *  - 'strict_subset': recipe oils must all be a subset of chosen3. Equal weights.
 */
export function getEligiblePool(notables, chosen3Oils, model = 'exact_tier_bucket') {
  if (!Array.isArray(chosen3Oils) || chosen3Oils.length !== 3) {
    throw new Error('Putrid Seed requires exactly 3 oils.');
  }
  const unique = new Set(chosen3Oils);
  if (unique.size !== 3) {
    throw new Error('Putrid Seed requires 3 distinct oils (no duplicates).');
  }
  for (const id of unique) {
    if (!OIL_MAP.has(id)) {
      throw new Error(`Unknown crafting oil: ${id}`);
    }
  }

  const chosenTiers = chosen3Oils.map((id) => OIL_MAP.get(id).tier);
  const tierToIdx = new Map(chosenTiers.map((t, i) => [t, i]));
  const maxChosenTier = Math.max(...chosenTiers);
  const pool = [];
  const bucketCounts = [0, 0, 0];

  for (const n of notables) {
    if (!Array.isArray(n.recipe) || n.recipe.length !== 3) continue;
    const overlapSlots = n.recipe.reduce((acc, o) => acc + (unique.has(o) ? 1 : 0), 0);
    const mask =
      (n.recipe.includes(chosen3Oils[0]) ? 1 : 0) |
      (n.recipe.includes(chosen3Oils[1]) ? 2 : 0) |
      (n.recipe.includes(chosen3Oils[2]) ? 4 : 0);

    if (model === 'strict_subset') {
      if (overlapSlots === 3) {
        pool.push({ ...n, overlapSlots, distinctMask: mask, weight: 1, drawProb: 0 });
      }
      continue;
    }

    const nMaxTier = n.maxTier ?? Math.max(...n.recipe.map((o) => OIL_MAP.get(o)?.tier || 99));

    if (model === 'exact_tier_bucket') {
      if (!tierToIdx.has(nMaxTier)) continue;
      const bucketIndex = tierToIdx.get(nMaxTier);
      bucketCounts[bucketIndex]++;
      pool.push({
        ...n,
        overlapSlots,
        distinctMask: 1 << bucketIndex,
        bucketIndex,
        bucketOilId: chosen3Oils[bucketIndex],
        bucketSize: 0,
        drawProb: 0,
        seedProb: 0,
        weight: 0,
      });
      continue;
    }

    if (nMaxTier <= maxChosenTier && overlapSlots >= 1) {
      if (mask & 1) bucketCounts[0]++;
      if (mask & 2) bucketCounts[1]++;
      if (mask & 4) bucketCounts[2]++;
      pool.push({
        ...n,
        overlapSlots,
        distinctMask: mask,
        weight: model === 'weighted_overlap' ? overlapSlots : 1,
        drawProb: 0,
      });
    }
  }

  if (pool.length === 0) return pool;

  if (model === 'exact_tier_bucket') {
    const seedProbsByBucket = bucketCounts.map((sz) => computeSingleNotableBucketSeedProb(sz));
    for (const item of pool) {
      const sz = bucketCounts[item.bucketIndex];
      item.bucketSize = sz;
      item.drawProb = sz > 0 ? 1 / (3 * sz) : 0;
      item.seedProb = seedProbsByBucket[item.bucketIndex];
      item.weight = item.drawProb;
    }
  } else if (model === 'per_oil_bucket') {
    const activeOils = bucketCounts.filter((c) => c > 0).length || 1;
    for (const item of pool) {
      let p = 0;
      if ((item.distinctMask & 1) && bucketCounts[0] > 0) p += 1 / bucketCounts[0];
      if ((item.distinctMask & 2) && bucketCounts[1] > 0) p += 1 / bucketCounts[1];
      if ((item.distinctMask & 4) && bucketCounts[2] > 0) p += 1 / bucketCounts[2];
      item.drawProb = p / activeOils;
      item.weight = item.drawProb;
    }
  } else {
    let totalW = 0;
    for (const item of pool) totalW += item.weight;
    for (const item of pool) {
      item.drawProb = totalW > 0 ? item.weight / totalW : 1 / pool.length;
    }
  }

  return pool;
}

/**
 * Exact multinomial + 3-bucket hypergeometric solver for `exact_tier_bucket`.
 * Computes exact hit distribution across 0..4 hits and exact enchant-count distribution (1..4).
 */
function exactTierBucketStats(pool, targetIdSet) {
  const bucketN = [0, 0, 0];
  const bucketM = [0, 0, 0];
  for (const item of pool) {
    const bi = item.bucketIndex;
    if (bi === 0 || bi === 1 || bi === 2) {
      bucketN[bi]++;
      if (targetIdSet.has(item.id)) bucketM[bi]++;
    }
  }

  const exactByHits = [0, 0, 0, 0, 0];
  const enchantCountDist = [0, 0, 0, 0, 0];
  let expectedUniqueEnchants = 0;

  for (let k0 = 0; k0 <= 4; k0++) {
    for (let k1 = 0; k1 <= 4 - k0; k1++) {
      const k2 = 4 - k0 - k1;
      const pSlots = FACTORIAL[4] / (FACTORIAL[k0] * FACTORIAL[k1] * FACTORIAL[k2]) / 81;

      const d0 = Math.min(k0, bucketN[0]);
      const d1 = Math.min(k1, bucketN[1]);
      const d2 = Math.min(k2, bucketN[2]);
      const uniqueEnchants = d0 + d1 + d2;
      enchantCountDist[uniqueEnchants] += pSlots;
      expectedUniqueEnchants += pSlots * uniqueEnchants;

      const h0Max = Math.min(d0, bucketM[0]);
      const h1Max = Math.min(d1, bucketM[1]);
      const h2Max = Math.min(d2, bucketM[2]);
      const denom0 = comb(bucketN[0], d0);
      const denom1 = comb(bucketN[1], d1);
      const denom2 = comb(bucketN[2], d2);

      for (let h0 = 0; h0 <= h0Max; h0++) {
        const ways0 = comb(bucketM[0], h0) * comb(bucketN[0] - bucketM[0], d0 - h0);
        if (ways0 === 0) continue;
        const p0 = ways0 / denom0;
        for (let h1 = 0; h1 <= h1Max; h1++) {
          const ways1 = comb(bucketM[1], h1) * comb(bucketN[1] - bucketM[1], d1 - h1);
          if (ways1 === 0) continue;
          const p01 = p0 * (ways1 / denom1);
          for (let h2 = 0; h2 <= h2Max; h2++) {
            const ways2 = comb(bucketM[2], h2) * comb(bucketN[2] - bucketM[2], d2 - h2);
            if (ways2 === 0) continue;
            exactByHits[h0 + h1 + h2] += pSlots * p01 * (ways2 / denom2);
          }
        }
      }
    }
  }

  return { exactByHits, enchantCountDist, expectedUniqueEnchants, bucketN, bucketM };
}

/**
 * Computes exact 4-draw without-replacement probability for sequential bucketed weighted draws.
 * Uses 6 buckets: non-target weight (1,2,3) and target weight (1,2,3) -> <= 6^4 states, zero approximation.
 */
function exactWeighted4DrawDistribution(bucketCounts) {
  const weights = [1, 2, 3, 1, 2, 3];
  const isTargetBucket = [false, false, false, true, true, true];
  const memo = new Map();

  function solve(drawsLeft, hits, c0, c1, c2, c3, c4, c5) {
    if (drawsLeft === 0) {
      const dist = [0, 0, 0, 0, 0];
      dist[hits] = 1;
      return dist;
    }
    const key = `${drawsLeft}|${hits}|${c0},${c1},${c2},${c3},${c4},${c5}`;
    if (memo.has(key)) return memo.get(key);

    const counts = [c0, c1, c2, c3, c4, c5];
    let totalW = 0;
    for (let b = 0; b < 6; b++) {
      totalW += counts[b] * weights[b];
    }

    const acc = [0, 0, 0, 0, 0];
    if (totalW <= 0) {
      acc[hits] = 1;
      memo.set(key, acc);
      return acc;
    }

    for (let b = 0; b < 6; b++) {
      if (counts[b] <= 0) continue;
      const p = (counts[b] * weights[b]) / totalW;
      const nxt = [...counts];
      nxt[b]--;
      const sub = solve(
        drawsLeft - 1,
        hits + (isTargetBucket[b] ? 1 : 0),
        nxt[0],
        nxt[1],
        nxt[2],
        nxt[3],
        nxt[4],
        nxt[5]
      );
      for (let h = 0; h <= 4; h++) {
        acc[h] += p * sub[h];
      }
    }

    memo.set(key, acc);
    return acc;
  }

  return solve(
    4,
    0,
    bucketCounts[0],
    bucketCounts[1],
    bucketCounts[2],
    bucketCounts[3],
    bucketCounts[4],
    bucketCounts[5]
  );
}

/**
 * Exact 4-draw WITH-REPLACEMENT DP tracking distinct target hits grouped by identical drawProb.
 * Groups distinct targets (<=7 distinctMask buckets, <=4 total hits -> <=165 states).
 */
function exactPerOilWithReplacementDistribution(targets) {
  const byProb = new Map();
  for (const t of targets) {
    const p = t.drawProb || 0;
    if (p <= 0) continue;
    const key = t.distinctMask ? String(t.distinctMask) : p.toFixed(12);
    let grp = byProb.get(key);
    if (!grp) {
      grp = { count: 0, prob: p };
      byProb.set(key, grp);
    }
    grp.count++;
  }

  const groups = Array.from(byProb.values());
  if (groups.length === 0) return [1, 0, 0, 0, 0];

  const memo = new Map();
  const initHits = new Array(groups.length).fill(0);

  function solve(drawsLeft, hitsArr) {
    let totalHits = 0;
    for (let i = 0; i < hitsArr.length; i++) totalHits += hitsArr[i];
    if (drawsLeft === 0) {
      const dist = [0, 0, 0, 0, 0];
      dist[Math.min(4, totalHits)] = 1;
      return dist;
    }

    const key = `${drawsLeft}|${hitsArr.join(',')}`;
    const cached = memo.get(key);
    if (cached) return cached;

    let pNewTotal = 0;
    for (let g = 0; g < groups.length; g++) {
      const rem = groups[g].count - hitsArr[g];
      if (rem > 0) pNewTotal += rem * groups[g].prob;
    }
    const pStay = Math.max(0, 1 - pNewTotal);

    const acc = [0, 0, 0, 0, 0];
    if (pStay > 0) {
      const stayDist = solve(drawsLeft - 1, hitsArr);
      for (let h = 0; h <= 4; h++) acc[h] += pStay * stayDist[h];
    }
    for (let g = 0; g < groups.length; g++) {
      const rem = groups[g].count - hitsArr[g];
      if (rem <= 0) continue;
      const pBranch = rem * groups[g].prob;
      if (pBranch <= 0) continue;
      const nextHits = [...hitsArr];
      nextHits[g]++;
      const subDist = solve(drawsLeft - 1, nextHits);
      for (let h = 0; h <= 4; h++) acc[h] += pBranch * subDist[h];
    }

    memo.set(key, acc);
    return acc;
  }

  return solve(4, initHits);
}

/**
 * Computes exact probability P(hits >= minHits) of rolling at least `minHits` target notables in 4 draws.
 */
export function computeHitProbability(pool, targetIdSet, minHits = 1, model = 'exact_tier_bucket') {
  const N = pool.length;
  const targets = pool.filter((item) => targetIdSet.has(item.id));
  const M = targets.length;
  const req = Math.max(1, Math.min(4, Math.floor(Number(minHits) || 1)));
  const minPool = model === 'exact_tier_bucket' || model === 'per_oil_bucket' ? 1 : 4;

  let exactTierStats = null;
  if (model === 'exact_tier_bucket') {
    exactTierStats = exactTierBucketStats(pool, targetIdSet);
  }

  const enchantCountDist = exactTierStats ? exactTierStats.enchantCountDist : null;
  const expectedUniqueEnchants = exactTierStats
    ? exactTierStats.expectedUniqueEnchants
    : model === 'per_oil_bucket'
      ? pool.reduce((sum, n) => {
          const p = n.drawProb ?? 0;
          return sum + (1 - Math.pow(1 - p, 4));
        }, 0)
      : Math.min(4, N);

  if (N < minPool || M < req) {
    return {
      probability: 0,
      expectedRolls: Infinity,
      poolSize: N,
      targetsInPool: M,
      minHits: req,
      possible: false,
      exactByHits: [1, 0, 0, 0, 0],
      expectedUniqueEnchants,
      enchantCountDist,
    };
  }

  let exactByHits = [0, 0, 0, 0, 0];

  if (model === 'exact_tier_bucket') {
    exactByHits = exactTierStats.exactByHits;
  } else if (model === 'per_oil_bucket') {
    exactByHits = exactPerOilWithReplacementDistribution(targets);
  } else if (model === 'weighted_overlap') {
    const buckets = [0, 0, 0, 0, 0, 0];
    for (const item of pool) {
      const wIdx = Math.max(0, Math.min(2, (item.weight || 1) - 1));
      const tOffset = targetIdSet.has(item.id) ? 3 : 0;
      buckets[tOffset + wIdx]++;
    }
    exactByHits = exactWeighted4DrawDistribution(buckets);
  } else {
    const totalWays = comb(N, 4);
    for (let i = 0; i <= 4; i++) {
      if (i <= M && 4 - i <= N - M) {
        exactByHits[i] = (comb(M, i) * comb(N - M, 4 - i)) / totalWays;
      }
    }
  }

  let probability = 0;
  for (let i = req; i <= 4; i++) {
    probability += exactByHits[i];
  }
  probability = Math.min(1, Math.max(0, probability));

  return {
    probability,
    expectedRolls: probability > 0 ? 1 / probability : Infinity,
    poolSize: N,
    targetsInPool: M,
    minHits: req,
    possible: probability > 0,
    exactByHits,
    expectedUniqueEnchants,
    enchantCountDist,
  };
}

/**
 * Computes total Chaos cost for 1 roll of a 3-oil recipe (+ optional Tainted Oil).
 */
export function computeComboRollCost(combo3, oilPrices = {}, includeTainted = false) {
  let sum = 0;
  for (const id of combo3) {
    sum += Number(oilPrices[id] ?? 0);
  }
  if (includeTainted) {
    sum += Number(oilPrices[TAINTED_OIL.id] ?? 0);
  }
  return sum;
}

/**
 * Evaluates and ranks all valid 3-distinct-oil recipes for a chosen set of target notables.
 */
export function rankAll364OilCombos({
  notables,
  targetIds = [],
  minHits = 1,
  oilPrices = {},
  divineChaos = 200,
  model = 'exact_tier_bucket',
  maxOilTier = 14,
  includeTainted = false,
  sortBy = 'expectedCost',
}) {
  const targetSet = new Set(targetIds.map(String));
  const combos = getAll364OilCombos(maxOilTier);
  const results = [];

  for (const combo of combos) {
    const pool = getEligiblePool(notables, combo, model);
    const hitInfo = computeHitProbability(pool, targetSet, minHits, model);
    if (!hitInfo.possible) continue;

    const rollCostChaos = computeComboRollCost(combo, oilPrices, includeTainted);
    const expectedCostChaos = hitInfo.expectedRolls * rollCostChaos;
    const maxTier = Math.max(...combo.map((o) => OIL_MAP.get(o).tier));

    results.push({
      oils: combo,
      maxTier,
      poolSize: hitInfo.poolSize,
      targetsInPool: hitInfo.targetsInPool,
      probability: hitInfo.probability,
      expectedRolls: hitInfo.expectedRolls,
      rollCostChaos,
      expectedCostChaos,
      expectedCostDivine: divineChaos > 0 ? expectedCostChaos / divineChaos : 0,
      exactByHits: hitInfo.exactByHits,
      expectedUniqueEnchants: hitInfo.expectedUniqueEnchants,
      enchantCountDist: hitInfo.enchantCountDist,
    });
  }

  results.sort((a, b) => {
    if (sortBy === 'probability') {
      if (b.probability !== a.probability) return b.probability - a.probability;
      return a.expectedCostChaos - b.expectedCostChaos;
    }
    if (sortBy === 'rollCost') {
      if (a.rollCostChaos !== b.rollCostChaos) return a.rollCostChaos - b.rollCostChaos;
      return a.expectedCostChaos - b.expectedCostChaos;
    }
    if (a.expectedCostChaos !== b.expectedCostChaos) return a.expectedCostChaos - b.expectedCostChaos;
    return b.probability - a.probability;
  });

  return results;
}

/**
 * Simulates Sister Cassia anointing RNG across 4 draws.
 *  - 'exact_tier_bucket': 4 independent draws picking 1 of 3 oils uniformly (1/3), then drawing
 *    without replacement from its maxTier==oil bucket (exhausting Clear=1 or Sepia=3 drops total <4).
 *  - 'per_oil_bucket': 4 independent draws WITH replacement weighted by drawProb, collapsing duplicates.
 *  - Other models: 4 distinct draws without replacement.
 */
export function simulateCassiaRoll(pool, model = 'exact_tier_bucket', rng = Math.random) {
  if (!Array.isArray(pool) || pool.length === 0) {
    return [];
  }

  if (model === 'exact_tier_bucket') {
    const buckets = [[], [], []];
    for (const item of pool) {
      if (item.bucketIndex === 0 || item.bucketIndex === 1 || item.bucketIndex === 2) {
        buckets[item.bucketIndex].push(item);
      }
    }
    const picked = [];
    for (let draw = 0; draw < 4; draw++) {
      const bIdx = Math.min(2, Math.floor(rng() * 3));
      const bucket = buckets[bIdx];
      if (bucket.length === 0) continue;
      const pickIdx = Math.min(bucket.length - 1, Math.floor(rng() * bucket.length));
      picked.push(bucket[pickIdx]);
      bucket.splice(pickIdx, 1);
    }
    return picked;
  }

  if (model === 'per_oil_bucket') {
    const probs = pool.map((n) => n.drawProb || n.weight || 1);
    let totalW = 0;
    for (const p of probs) totalW += p;
    const seen = new Set();
    const picked = [];

    for (let draw = 0; draw < 4; draw++) {
      let r = rng() * totalW;
      let chosenIdx = pool.length - 1;
      for (let idx = 0; idx < pool.length; idx++) {
        r -= probs[idx];
        if (r <= 0) {
          chosenIdx = idx;
          break;
        }
      }
      const item = pool[chosenIdx];
      if (!seen.has(item.id)) {
        seen.add(item.id);
        picked.push(item);
      }
    }
    return picked;
  }

  if (pool.length < 4) {
    return [];
  }
  const remaining = pool.map((n) => ({
    item: n,
    w: model === 'weighted_overlap' ? Math.max(1, n.weight || n.overlapSlots || 1) : 1,
  }));
  const picked = [];

  for (let draw = 0; draw < 4; draw++) {
    let totalW = 0;
    for (const entry of remaining) totalW += entry.w;
    let r = rng() * totalW;
    let chosenIdx = remaining.length - 1;
    for (let idx = 0; idx < remaining.length; idx++) {
      r -= remaining[idx].w;
      if (r <= 0) {
        chosenIdx = idx;
        break;
      }
    }
    picked.push(remaining[chosenIdx].item);
    remaining.splice(chosenIdx, 1);
  }

  return picked;
}

/**
 * Generates official Path of Exile Trade site JSON payload & URL for Putrid Seed / Mycelium Core.
 */
export function buildTradeQueryPayload({ targetIds = [], minHits = 1, includeBrickedBase = false }) {
  const filters = targetIds.map((id) => ({
    id: `enchant.stat_3599615742|${id}`,
    disabled: false,
  }));

  const statsBlock =
    filters.length === 0
      ? []
      : minHits >= filters.length
        ? [{ type: 'and', filters, disabled: false }]
        : [{ type: 'count', value: { min: Math.max(1, minHits) }, filters, disabled: false }];

  const query = {
    status: { option: 'online' },
    type: 'Mycelium Core',
    stats: statsBlock,
  };
  if (!includeBrickedBase) {
    query.name = 'Putrid Seed';
  }

  return {
    query,
    sort: { price: 'asc' },
  };
}

export function buildTradeSearchUrl({ league = 'Covens', targetIds = [], minHits = 1, includeBrickedBase = false }) {
  const payload = buildTradeQueryPayload({ targetIds, minHits, includeBrickedBase });
  const encodedQuery = encodeURIComponent(JSON.stringify(payload));
  return {
    url: `https://www.pathofexile.com/trade/search/${encodeURIComponent(league)}?q=${encodedQuery}`,
    payload,
  };
}

/**
 * Generates a valid Path of Building item text block for Putrid Seed.
 */
export function buildPobItemText({ rolledNotables = [], socket = null, corrupted = false }) {
  const lines = [
    'Rarity: UNIQUE',
    corrupted ? 'Mycelium Core' : 'Putrid Seed',
    'Mycelium Core',
    'Limited to: 1',
    'Item Level: 83',
  ];
  if (corrupted) {
    lines.push('Corrupted');
  }
  lines.push('{crafted}Grows 4 random Notable Passive Skills');
  for (const n of rolledNotables.slice(0, 4)) {
    lines.push(`{crafted}1 added passive skill is ${n.name}`);
  }
  if (socket) {
    lines.push(`# Socketed in: ${socket.label} (${socket.region}) — Small Passives: ${socket.smallPassiveText}`);
  }
  return lines.join('\n');
}

/**
 * Parses a poe.ninja Oil exchange overview JSON string or object into Chaos prices + Divine ratio.
 */
export function parsePoeNinjaOilJson(rawInput) {
  let data = rawInput;
  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      throw new Error('Paste poe.ninja JSON text first.');
    }
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid JSON syntax — copy the full JSON from the poe.ninja link.');
    }
  }
  if (!data || !Array.isArray(data.lines)) {
    throw new Error('Unexpected poe.ninja JSON format (missing "lines" array).');
  }

  const prices = {};
  let count = 0;
  for (const line of data.lines) {
    const pascal = String(line?.id || '')
      .trim()
      .toLowerCase()
      .split('-')
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('');
    if (!OIL_MAP.has(pascal) && pascal !== TAINTED_OIL.id) continue;
    const val = Number(line.primaryValue);
    if (Number.isFinite(val) && val > 0) {
      prices[pascal] = Math.round(val * 10000) / 10000;
      count += 1;
    }
  }

  if (count === 0) {
    throw new Error('No positive PoE oil prices found in the pasted JSON.');
  }

  const divRate = Number(data.core?.rates?.divine || 0);
  const divineChaos =
    Number.isFinite(divRate) && divRate > 0 ? Math.round((1 / divRate) * 10) / 10 : null;

  return { prices, divineChaos, count };
}
