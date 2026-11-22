#!/usr/bin/env node
/**
 * Zero-dependency local HTTP dev server + optional poe.ninja CORS proxy for PoE Putrid Seed Calculator.
 * Usage: node scripts/serve.mjs [--port 4173]
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let port = 4173;
const pIdx = args.indexOf('--port');
if (pIdx !== -1 && args[pIdx + 1]) {
  port = parseInt(args[pIdx + 1], 10) || 4173;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

async function handleLiveOilPrices(league, res) {
  try {
    const cleanLeague = league || 'Covens';
    const upstream = `https://poe.ninja/poe1/api/economy/exchange/current/overview?league=${encodeURIComponent(cleanLeague)}&type=Oil`;
    const r = await fetch(upstream, { headers: { 'User-Agent': 'PoE-PutridSeed-Calculator/1.0' } });
    if (!r.ok) throw new Error(`Upstream HTTP ${r.status}`);
    const data = await r.json();
    const prices = {};
    for (const line of data.lines || []) {
      const pascal = String(line.id || '')
        .toLowerCase()
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join('');
      prices[pascal] = Math.round(Number(line.primaryValue || 0) * 10000) / 10000;
    }
    const divRate = Number(data.core?.rates?.divine || 0);
    const divineChaos = divRate > 0 ? Math.round((1 / divRate) * 10) / 10 : 200;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ league: cleanLeague, divineChaos, updatedAt: new Date().toISOString(), prices }));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: String(err.message || err) }));
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${port}`);
  if (url.pathname === '/api/oil-prices') {
    handleLiveOilPrices(url.searchParams.get('league') || 'Covens', res);
    return;
  }

  let relPath = decodeURIComponent(url.pathname);
  if (relPath === '/') relPath = '/index.html';
  const filePath = path.resolve(ROOT, '.' + relPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  console.log(`[PoE Putrid Seed Calculator] Listening on http://localhost:${port}`);
});
