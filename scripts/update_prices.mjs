#!/usr/bin/env node
/**
 * Zero-dependency multi-league poe.ninja Oil price updater.
 * Intended for local refresh or free GitHub Actions cron (writes data/oil_prices.json).
 * Usage: node scripts/update_prices.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePoeNinjaOilJson } from '../src/calculator.js';
import { getPoeNinjaOilApiUrl } from '../src/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, '../data/oil_prices.json');
const TARGET_LEAGUES = ['Covens', 'Hardcore Covens', 'Standard'];

async function readExistingSnapshot() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchLeagueOilSnapshot(league) {
  const url = getPoeNinjaOilApiUrl(league);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PoE-PutridSeed-Calculator/1.0' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${league}`);
  }
  const json = await res.json();
  if (!Array.isArray(json?.lines) || json.lines.length === 0) {
    throw new Error(`Empty poe.ninja lines for ${league}`);
  }
  const parsed = parsePoeNinjaOilJson(json);
  return {
    league,
    divineChaos: parsed.divineChaos ?? 200,
    updatedAt: new Date().toISOString(),
    source: url,
    prices: parsed.prices,
  };
}

async function main() {
  const existing = await readExistingSnapshot();
  const prevByLeague = existing?.byLeague || {};
  const byLeague = {};

  for (const league of TARGET_LEAGUES) {
    try {
      const snap = await fetchLeagueOilSnapshot(league);
      const fallbackPrices =
        prevByLeague[league]?.prices ||
        (league === existing?.league ? existing?.prices : null) ||
        {};
      byLeague[league] = {
        ...snap,
        prices: { ...fallbackPrices, ...snap.prices },
      };
      console.log(
        `[update_prices] ${league}: ${Object.keys(byLeague[league].prices).length} oils (Div = ${byLeague[league].divineChaos}c)`
      );
    } catch (err) {
      const preserved =
        prevByLeague[league] ||
        (league === 'Covens' && existing?.prices
          ? {
              league: existing.league || 'Covens',
              divineChaos: existing.divineChaos || 200,
              updatedAt: existing.updatedAt || new Date().toISOString(),
              source: existing.source || getPoeNinjaOilApiUrl('Covens'),
              prices: existing.prices,
            }
          : null);
      if (preserved) {
        byLeague[league] = preserved;
      }
      console.warn(`[update_prices] Preserving cached ${league} rates (${err.message})`);
    }
  }

  const primary = byLeague.Covens || existing;
  if (!primary?.prices || Object.keys(primary.prices).length === 0) {
    throw new Error('Failed to obtain Covens oil prices and no cached fallback exists.');
  }

  const output = {
    league: 'Covens',
    divineChaos: primary.divineChaos,
    updatedAt: primary.updatedAt || new Date().toISOString(),
    source: primary.source || getPoeNinjaOilApiUrl('Covens'),
    prices: primary.prices,
    byLeague,
  };

  await fs.writeFile(DATA_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`[update_prices] Wrote ${DATA_FILE}`);
}

main().catch((err) => {
  console.error('[update_prices] Fatal:', err);
  process.exit(1);
});
