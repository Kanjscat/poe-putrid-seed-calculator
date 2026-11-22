#!/usr/bin/env node
/**
 * Builds static PoE 3.30.0 (Covens of Umbra) dataset for Putrid Seed Calculator:
 *  1. Fetches official GGG 3.30.0 skilltree data.json
 *  2. Computes exact PoE orbit (x, y) coordinates (with GGG non-uniform 16/40-node angles)
 *  3. Verifies all 472 recipe-bearing notables against live PoE Trade API enchant.stat_3599615742
 *  4. Fetches live Covens league Oil prices from poe.ninja
 *  5. Writes compact data/poe_330_tree.json & data/oil_prices.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const ASSETS_DIR = path.join(ROOT, 'assets');
const OILS_DIR = path.join(ASSETS_DIR, 'oils');
const TREE_ASSETS_DIR = path.join(ASSETS_DIR, 'tree');

const TREE_URL = 'https://raw.githubusercontent.com/grindinggear/skilltree-export/3.30.0/data.json';
const GH_ASSETS_BASE = 'https://raw.githubusercontent.com/grindinggear/skilltree-export/3.30.0/assets';
const TRADE_STATS_URL = 'https://www.pathofexile.com/api/trade/data/stats';
const NINJA_OILS_URL = 'https://poe.ninja/poe1/api/economy/exchange/current/overview?league=Covens&type=Oil';
const PUTRID_SEED_ICON_URL = 'https://www.poewiki.net/images/b/bf/Mycelium_Core_inventory_icon.png';

const TARGET_OIL_IDS = new Set([
  'ClearOil',
  'SepiaOil',
  'AmberOil',
  'VerdantOil',
  'TealOil',
  'AzureOil',
  'IndigoOil',
  'VioletOil',
  'CrimsonOil',
  'BlackOil',
  'OpalescentOil',
  'SilverOil',
  'GoldenOil',
  'PrismaticOil',
  'TaintedOil',
]);

const OIL_TIERS = {
  ClearOil: 1,
  SepiaOil: 2,
  AmberOil: 3,
  VerdantOil: 4,
  TealOil: 5,
  AzureOil: 6,
  IndigoOil: 7,
  VioletOil: 8,
  CrimsonOil: 9,
  BlackOil: 10,
  OpalescentOil: 11,
  SilverOil: 12,
  GoldenOil: 13,
  PrismaticOil: 14,
};

const ANGLES_16 = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
const ANGLES_40 = [
  0, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 135, 140, 150, 160, 170,
  180, 190, 200, 210, 220, 225, 230, 240, 250, 260, 270, 280, 290, 300, 310, 315, 320, 330, 340, 350,
];

function getOrbitAngleDeg(skillsPerOrbit, orbitIdx) {
  if (skillsPerOrbit === 16) return ANGLES_16[orbitIdx % 16] ?? 0;
  if (skillsPerOrbit === 40) return ANGLES_40[orbitIdx % 40] ?? 0;
  if (!skillsPerOrbit || skillsPerOrbit <= 1) return 0;
  return (360 * orbitIdx) / skillsPerOrbit;
}

function getNodePosition(node, groups, constants) {
  const grp = groups[String(node.group)];
  if (!grp) return null;
  const orbit = node.orbit ?? 0;
  const orbitIdx = node.orbitIndex ?? 0;
  const radius = constants.orbitRadii?.[orbit] ?? 0;
  const skills = constants.skillsPerOrbit?.[orbit] ?? 1;
  const angleDeg = getOrbitAngleDeg(skills, orbitIdx);
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.round((grp.x + radius * Math.sin(rad)) * 100) / 100,
    y: Math.round((grp.y - radius * Math.cos(rad)) * 100) / 100,
  };
}

function cleanStatLine(s) {
  return String(s || '')
    .replace(/\[([^\]|]+\|)?([^\]]+)\]/g, '$2')
    .replace(/\r?\n/g, ' ')
    .trim();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'PoE-PutridSeed-Calculator/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

async function downloadBinary(url, destPath, fallbackUrl = null) {
  const attempt = async (targetUrl) => {
    const res = await fetch(targetUrl, { headers: { 'User-Agent': 'PoE-PutridSeed-Calculator/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${targetUrl}`);
    const arrBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrBuf);
    if (buf.length === 0) throw new Error(`Empty response from ${targetUrl}`);
    fs.writeFileSync(destPath, buf);
    return buf.length;
  };
  try {
    return await attempt(url);
  } catch (err) {
    if (fallbackUrl) {
      return await attempt(fallbackUrl);
    }
    throw err;
  }
}

function slugToPascal(slug) {
  return String(slug || '')
    .toLowerCase()
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

async function main() {
  const treeOnly = process.argv.includes('--tree-only');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(OILS_DIR, { recursive: true });
  fs.mkdirSync(TREE_ASSETS_DIR, { recursive: true });

  console.log('[1/4] Fetching official GGG PoE 3.30.0 passive tree JSON...');
  const raw = await fetchJson(TREE_URL);
  const { groups, nodes, constants } = raw;

  console.log('[2/4] Fetching PoE Trade API enchant.stat_3599615742 verification table...');
  const statsJson = await fetchJson(TRADE_STATS_URL);
  const tradeEnchantMap = new Map();
  for (const grp of statsJson.result || []) {
    if (grp.label === 'Enchant') {
      for (const e of grp.entries || []) {
        if (e.id?.startsWith('enchant.stat_3599615742|')) {
          tradeEnchantMap.set(e.id.split('|')[1], e.text);
        }
      }
    }
  }

  const treeNodes = [];
  const mainNodeMap = new Map();
  const notables = [];
  const outerSockets = [];

  for (const [id, n] of Object.entries(nodes)) {
    if (id === 'root' || n.ascendancyName || n.isProxy || n.isMastery) continue;
    const grp = groups[String(n.group)];
    if (!grp) continue;
    if (grp.isProxy || n.expansionJewel?.parent) continue;
    const pos = getNodePosition(n, groups, constants);
    if (!pos) continue;

    const cleanStats = (n.stats || []).map(cleanStatLine).filter(Boolean);
    const hasRecipe = Array.isArray(n.recipe) && n.recipe.length === 3;
    const isOuterLarge = Boolean(n.expansionJewel && n.expansionJewel.size === 2 && !n.expansionJewel.parent);

    let kind = 'small';
    if (n.classStartIndex !== undefined) kind = 'start';
    else if (hasRecipe) kind = 'notable';
    else if (n.isKeystone) kind = 'keystone';
    else if (n.isJewelSocket) kind = isOuterLarge ? 'outerJewel' : 'jewel';

    let notableMeta = null;
    if (hasRecipe) {
      const maxTier = Math.max(...n.recipe.map((o) => OIL_TIERS[o] || 0));
      notableMeta = {
        id,
        name: n.name || id,
        stats: cleanStats,
        recipe: n.recipe,
        maxTier,
        isBlighted: Boolean(n.isBlighted),
        tradeVerified: tradeEnchantMap.has(id),
        x: pos.x,
        y: pos.y,
      };
      if (n.icon) notableMeta.icon = n.icon;
      notables.push(notableMeta);
    }

    if (isOuterLarge) {
      outerSockets.push({
        id,
        name: n.name || 'Large Jewel Socket',
        x: pos.x,
        y: pos.y,
        groupX: grp.x,
        groupY: grp.y,
      });
    }

    const compactNode =
      kind === 'notable' && notableMeta
        ? {
            id,
            x: pos.x,
            y: pos.y,
            kind,
            name: notableMeta.name,
            stats: notableMeta.stats,
            group: n.group,
            orbit: n.orbit ?? 0,
            recipe: notableMeta.recipe,
            maxTier: notableMeta.maxTier,
          }
        : {
            id,
            x: pos.x,
            y: pos.y,
            kind,
            group: n.group,
            orbit: n.orbit ?? 0,
          };
    if (kind === 'notable') {
      if (n.icon) compactNode.icon = n.icon;
      if (n.isBlighted) compactNode.isBlighted = true;
      if (n.isBlighted && n.isKeystone) compactNode.isKeystone = true;
    }
    treeNodes.push(compactNode);
    mainNodeMap.set(id, { ...compactNode, out: n.out || [], in: n.in || [] });
  }

  // Build deduplicated undirected edges between main-tree nodes (plus curved-orbit metadata)
  const edgeSet = new Set();
  const edges = [];
  for (const [id, node] of mainNodeMap.entries()) {
    const neighbors = [...(node.out || []), ...(node.in || [])];
    for (const targetId of neighbors) {
      const target = mainNodeMap.get(targetId);
      if (!target) continue;
      const a = id < targetId ? id : targetId;
      const b = id < targetId ? targetId : id;
      const key = `${a}|${b}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);

      const nA = mainNodeMap.get(a);
      const nB = mainNodeMap.get(b);
      if (nA.group === nB.group && nA.orbit === nB.orbit && nA.orbit > 0) {
        edges.push([a, b, 1]); // curved same-orbit arc
      } else {
        edges.push([a, b, 0]); // straight edge
      }
    }
  }

  // Group metadata needed only for curved arcs
  const groupCenters = {};
  for (const e of edges) {
    if (e[2] === 1) {
      const nA = mainNodeMap.get(e[0]);
      if (!groupCenters[nA.group]) {
        const g = groups[String(nA.group)];
        groupCenters[nA.group] = { x: g.x, y: g.y, radii: constants.orbitRadii };
      }
    }
  }

  notables.sort((a, b) => a.name.localeCompare(b.name));
  const verifiedTradeCount = notables.filter((n) => n.tradeVerified).length;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of treeNodes) {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  }

  // Sprite sheets and compact icon lookup coordinates strictly for the 472 anointable notables & frames
  const ZOOM_KEY = '0.2972';
  const notableIcons = new Set();
  for (const nb of notables) {
    if (nb.icon) notableIcons.add(nb.icon);
  }
  const ALLOWED_FRAMES = new Set([
    'NotableFrameAllocated',
    'NotableFrameUnallocated',
    'BlightedNotableFrameAllocated',
    'BlightedNotableFrameUnallocated',
    'KeystoneFrameAllocated',
    'KeystoneFrameUnallocated',
    'JewelFrameUnallocated',
  ]);
  const pickCoords = (cat, keys = null) => {
    const coords = raw.sprites?.[cat]?.[ZOOM_KEY]?.coords || {};
    if (!keys) return coords;
    const out = {};
    for (const k of keys) {
      if (coords[k]) out[k] = coords[k];
    }
    return out;
  };
  const spritesOut = {
    zoom: 0.2972,
    sheets: {
      active: './assets/tree/skills-2.jpg',
      inactive: './assets/tree/skills-disabled-2.jpg',
      frame: './assets/tree/frame-2.png',
    },
    notableActive: pickCoords('notableActive', notableIcons),
    notableInactive: pickCoords('notableInactive', notableIcons),
    keystoneActive: pickCoords('keystoneActive', notableIcons),
    keystoneInactive: pickCoords('keystoneInactive', notableIcons),
    frame: pickCoords('frame', ALLOWED_FRAMES),
  };

  console.log('[3/5] Downloading official Putrid Seed icon & PoE passive tree sprite sheets...');
  await downloadBinary(PUTRID_SEED_ICON_URL, path.join(ASSETS_DIR, 'putrid_seed.png'));
  const sheetSpecs = [
    ['skills-2.jpg', raw.sprites?.normalActive?.[ZOOM_KEY]?.filename],
    ['skills-disabled-2.jpg', raw.sprites?.normalInactive?.[ZOOM_KEY]?.filename],
    ['frame-2.png', raw.sprites?.frame?.[ZOOM_KEY]?.filename],
  ];
  await Promise.all(
    sheetSpecs.map(([fileName, fallbackCdn]) =>
      downloadBinary(`${GH_ASSETS_BASE}/${fileName}`, path.join(TREE_ASSETS_DIR, fileName), fallbackCdn)
    )
  );

  const treeOut = {
    meta: {
      version: '3.30.0',
      league: 'Covens',
      generatedAt: new Date().toISOString(),
      notableCount: notables.length,
      blightExclusiveCount: notables.filter((n) => n.isBlighted).length,
      tradeVerifiedCount: verifiedTradeCount,
      outerSocketCount: outerSockets.length,
      mainNodeCount: treeNodes.length,
      edgeCount: edges.length,
      bounds: { minX, maxX, minY, maxY },
      orbitRadii: constants.orbitRadii,
    },
    groupCenters,
    sprites: spritesOut,
    outerSockets,
    notables,
    nodes: treeNodes,
    edges,
  };

  const treePath = path.join(DATA_DIR, 'poe_330_tree.json');
  fs.writeFileSync(treePath, JSON.stringify(treeOut));
  console.log(
    `[OK] Wrote ${path.relative(ROOT, treePath)} (${(fs.statSync(treePath).size / 1024).toFixed(1)} KB): ` +
      `${treeNodes.length} nodes, ${edges.length} edges, ${notables.length} notables (${verifiedTradeCount}/${notables.length} Trade-verified), ${outerSockets.length} outer sockets.`
  );

  if (treeOnly) {
    console.log('[4/5] --tree-only enabled: keeping existing data/oil_prices.json unchanged.');
    return;
  }

  console.log('[4/5] Fetching live Covens oil economy & official Oil PNG icons from poe.ninja...');
  const ninja = await fetchJson(NINJA_OILS_URL);
  const priceByOil = {};
  for (const line of ninja.lines || []) {
    const pascal = slugToPascal(line.id);
    priceByOil[pascal] = Math.round(Number(line.primaryValue || 0) * 10000) / 10000;
  }

  let oilIconsDownloaded = 0;
  const oilIconTasks = [];
  for (const item of ninja.items || []) {
    const pascal = slugToPascal(item.id);
    if (!TARGET_OIL_IDS.has(pascal) || !item.image) continue;
    const iconUrl = item.image.startsWith('http') ? item.image : `https://web.poecdn.com${item.image}`;
    oilIconTasks.push(
      downloadBinary(iconUrl, path.join(OILS_DIR, `${pascal}.png`)).then(() => {
        oilIconsDownloaded += 1;
      })
    );
  }
  await Promise.all(oilIconTasks);
  console.log(`[5/5] Downloaded ${oilIconsDownloaded} official Oil PNG icons into assets/oils/.`);
  const divineRate = Number(ninja.core?.rates?.divine || 0);
  const divineChaos = divineRate > 0 ? Math.round((1 / divineRate) * 10) / 10 : 200;

  const pricesPath = path.join(DATA_DIR, 'oil_prices.json');
  let existingByLeague = null;
  try {
    const prev = JSON.parse(fs.readFileSync(pricesPath, 'utf8'));
    if (prev?.byLeague) existingByLeague = prev.byLeague;
  } catch {
    // No prior multi-league file
  }

  const nowIso = new Date().toISOString();
  const pricesOut = {
    league: 'Covens',
    divineChaos,
    updatedAt: nowIso,
    source: NINJA_OILS_URL,
    prices: priceByOil,
  };
  if (existingByLeague) {
    pricesOut.byLeague = {
      ...existingByLeague,
      Covens: { league: 'Covens', divineChaos, updatedAt: nowIso, source: NINJA_OILS_URL, prices: priceByOil },
    };
  }

  fs.writeFileSync(pricesPath, JSON.stringify(pricesOut, null, 2) + '\n');
  console.log(
    `[OK] Wrote ${path.relative(ROOT, pricesPath)} (Divine = ${divineChaos}c, Prismatic = ${priceByOil.PrismaticOil}c, Golden = ${priceByOil.GoldenOil}c).`
  );
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
