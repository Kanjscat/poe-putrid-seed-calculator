import {
  OILS,
  TAINTED_OIL,
  OIL_MAP,
  LEAGUES,
  PROB_MODELS,
  QUICK_FILTER_TAGS,
  DONATE_CONFIG,
  getPoeNinjaOilsUrl,
  getPoeNinjaOilApiUrl,
} from './constants.js';
import {
  getEligiblePool,
  computeHitProbability,
  computeComboRollCost,
  rankAll364OilCombos,
  simulateCassiaRoll,
  buildTradeSearchUrl,
  buildPobItemText,
  parsePoeNinjaOilJson,
} from './calculator.js';
import { PassiveTreeCanvas } from './treeCanvas.js';

const DOM = {
  canvas: document.getElementById('tree-canvas'),
  hudLeagueSelect: document.getElementById('hud-league-select'),
  quickJumpInput: document.getElementById('quick-jump-input'),
  quickJumpResults: document.getElementById('quick-jump-results'),
  btnFitTree: document.getElementById('btn-fit-tree'),
  btnCopyShare: document.getElementById('btn-copy-share'),
  btnOpenMechanics: document.getElementById('btn-open-mechanics'),
  btnOpenDonate: document.getElementById('btn-open-donate'),
  btnToggleLeft: document.getElementById('btn-toggle-left'),
  btnToggleRight: document.getElementById('btn-toggle-right'),
  leftPanel: document.getElementById('left-panel'),
  rightPanel: document.getElementById('right-panel'),
  btnCloseLeft: document.getElementById('btn-close-left'),
  btnCloseRight: document.getElementById('btn-close-right'),
  tabButtons: Array.from(document.querySelectorAll('.tab-btn[data-tab]')),
  tabPanels: {
    optimizer: document.getElementById('tab-optimizer'),
    explorer: document.getElementById('tab-explorer'),
    trade: document.getElementById('tab-trade'),
  },
  targetCountLabel: document.getElementById('target-count-label'),
  btnPresetAura: document.getElementById('btn-preset-aura'),
  btnClearTargets: document.getElementById('btn-clear-targets'),
  targetChipsWrap: document.getElementById('target-chips-wrap'),
  optMinHits: document.getElementById('opt-min-hits'),
  optModel: document.getElementById('opt-model'),
  optMaxTier: document.getElementById('opt-max-tier'),
  optSortBy: document.getElementById('opt-sort-by'),
  optIncludeTainted: document.getElementById('opt-include-tainted'),
  optModelDesc: document.getElementById('opt-model-desc'),
  comboSummaryLine: document.getElementById('combo-summary-line'),
  comboResultsList: document.getElementById('combo-results-list'),
  notablePickerCount: document.getElementById('notable-picker-count'),
  quickFilterChips: document.getElementById('quick-filter-chips'),
  notableSearchInput: document.getElementById('notable-search-input'),
  notablePickerList: document.getElementById('notable-picker-list'),
  btnSyncBestCombo: document.getElementById('btn-sync-best-combo'),
  oilSlot1: document.getElementById('oil-slot-1'),
  oilSlot2: document.getElementById('oil-slot-2'),
  oilSlot3: document.getElementById('oil-slot-3'),
  btnPresetBudget: document.getElementById('btn-preset-budget'),
  btnPresetMid: document.getElementById('btn-preset-mid'),
  btnPresetEndgame: document.getElementById('btn-preset-endgame'),
  expPoolSize: document.getElementById('exp-pool-size'),
  expTargetsHit: document.getElementById('exp-targets-hit'),
  expHitProb: document.getElementById('exp-hit-prob'),
  expCostLine: document.getElementById('exp-cost-line'),
  btnRollOnce: document.getElementById('btn-roll-once'),
  btnAutoRoll: document.getElementById('btn-auto-roll'),
  btnResetBench: document.getElementById('btn-reset-bench'),
  benchStatsLine: document.getElementById('bench-stats-line'),
  benchRolledSlots: document.getElementById('bench-rolled-slots'),
  poolSearchInput: document.getElementById('pool-search-input'),
  poolNotablesList: document.getElementById('pool-notables-list'),
  tradeLeague: document.getElementById('trade-league'),
  tradeMinHits: document.getElementById('trade-min-hits'),
  tradeIncludeBricked: document.getElementById('trade-include-bricked'),
  btnOpenTrade: document.getElementById('btn-open-trade'),
  btnCopyTradeJson: document.getElementById('btn-copy-trade-json'),
  tradeJsonPreview: document.getElementById('trade-json-preview'),
  pobCorrupted: document.getElementById('pob-corrupted'),
  btnCopyPob: document.getElementById('btn-copy-pob'),
  pobItemPreview: document.getElementById('pob-item-preview'),
  btnOpenNinjaOils: document.getElementById('btn-open-ninja-oils'),
  btnRefreshPrices: document.getElementById('btn-refresh-prices'),
  btnResetPrices: document.getElementById('btn-reset-prices'),
  btnOpenNinjaJson: document.getElementById('btn-open-ninja-json'),
  btnApplyNinjaJson: document.getElementById('btn-apply-ninja-json'),
  ninjaJsonInput: document.getElementById('ninja-json-input'),
  pricesStatusText: document.getElementById('prices-status-text'),
  divineChaosInput: document.getElementById('divine-chaos-input'),
  oilPricesGrid: document.getElementById('oil-prices-grid'),
  seedCardOils: document.getElementById('seed-card-oils'),
  seedCardEnchants: document.getElementById('seed-card-enchants'),
  seedCardEnchantMeta: document.getElementById('seed-card-enchant-meta'),
  seedCardCorrupted: document.getElementById('seed-card-corrupted'),
  btnCardRoll: document.getElementById('btn-card-roll'),
  btnCardAutoRoll: document.getElementById('btn-card-auto-roll'),
  btnCardCopyPob: document.getElementById('btn-card-copy-pob'),
  btnCardOpenTrade: document.getElementById('btn-card-open-trade'),
  blightDrawer: document.getElementById('blight-drawer'),
  blightDrawerGrid: document.getElementById('blight-drawer-grid'),
  blightPillText: document.getElementById('blight-pill-text'),
  btnToggleBlightDrawer: document.getElementById('btn-toggle-blight-drawer'),
  btnCloseBlightDrawer: document.getElementById('btn-close-blight-drawer'),
  tooltip: document.getElementById('canvas-tooltip'),
  tooltipTitle: document.getElementById('tooltip-title'),
  tooltipSubtitle: document.getElementById('tooltip-subtitle'),
  tooltipStats: document.getElementById('tooltip-stats'),
  tooltipOils: document.getElementById('tooltip-oils'),
  mechanicsModal: document.getElementById('mechanics-modal'),
  btnCloseMechanics: document.getElementById('btn-close-mechanics'),
  btnMechanicsDonate: document.getElementById('btn-mechanics-donate'),
  donateModal: document.getElementById('donate-modal'),
  btnCloseDonate: document.getElementById('btn-close-donate'),
  donateModalTitle: document.getElementById('donate-modal-title'),
  donateModalMessage: document.getElementById('donate-modal-message'),
  donateLinksList: document.getElementById('donate-links-list'),
  donateModalFootnote: document.getElementById('donate-modal-footnote'),
  toastBanner: document.getElementById('toast-banner'),
};

const PRICE_STORAGE_KEY = 'putrid_seed_custom_prices_v1';

function readAllSavedPrices() {
  try {
    const raw = localStorage.getItem(PRICE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadSavedLeaguePrices(league) {
  const all = readAllSavedPrices();
  const entry = all[league];
  return entry && typeof entry === 'object' ? entry : null;
}

function saveLeaguePrices(league, prices, divineChaos) {
  try {
    const all = readAllSavedPrices();
    all[league] = {
      prices: { ...prices },
      divineChaos,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Ignore storage quota or private-browsing errors
  }
}

function clearSavedLeaguePrices(league) {
  try {
    const all = readAllSavedPrices();
    delete all[league];
    localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Ignore storage errors
  }
}

function getSnapshotForLeague(league) {
  const byLg = state.defaultPricesData?.byLeague?.[league];
  if (byLg?.prices) return byLg;
  return state.defaultPricesData || { league, divineChaos: 200, prices: {} };
}

function applyPricesForLeague(league) {
  const snap = getSnapshotForLeague(league);
  const saved = loadSavedLeaguePrices(league);
  if (saved?.prices) {
    state.prices = { ...(snap.prices || {}), ...saved.prices };
    state.divineChaos = Number(saved.divineChaos || snap.divineChaos || 200);
    DOM.pricesStatusText.textContent = `Custom saved prices (${league}) · click Reset to restore snapshot.`;
    return;
  }
  state.prices = { ...(snap.prices || {}) };
  state.divineChaos = Number(snap.divineChaos || 200);
  const dateTag = snap.updatedAt ? ` updated ${snap.updatedAt.slice(0, 10)}` : '';
  const snapLeague = snap.league && snap.league !== league ? `fallback: ${snap.league}` : league;
  DOM.pricesStatusText.textContent = `Snapshot (${snapLeague})${dateTag}`;
}

function renderDonateModal() {
  DOM.donateModalTitle.textContent = DONATE_CONFIG.title;
  DOM.donateModalMessage.textContent = DONATE_CONFIG.message;
  DOM.donateModalFootnote.textContent = DONATE_CONFIG.footnote;

  const validLinks = (DONATE_CONFIG.links || []).filter((link) =>
    /^https?:\/\//i.test(String(link?.url || '').trim())
  );

  if (validLinks.length > 0) {
    DOM.donateLinksList.innerHTML = validLinks
      .map(
        (link) =>
          `<a class="donate-link-card" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">` +
            `<span>` +
              `<span class="donate-link-title">${escapeHtml(link.label)}</span>` +
              (link.sublabel ? `<span class="donate-link-sub">${escapeHtml(link.sublabel)}</span>` : '') +
            `</span>` +
            `<span aria-hidden="true">&#8599;</span>` +
          `</a>`
      )
      .join('');
  } else {
    DOM.donateLinksList.innerHTML =
      `<div class="donate-setup-note">` +
        `<strong>Creator Tip Links Not Configured Yet</strong><br>` +
        `Add your Ko-fi, Buy Me a Coffee, or PayPal.me URL in ` +
        `<code>src/constants.js</code> → <code>DONATE_CONFIG.links</code> to enable one-click tips.` +
      `</div>`;
  }
}

function openDonateModal() {
  renderDonateModal();
  DOM.donateModal.classList.remove('hidden');
}

const state = {
  treeData: null,
  notableById: new Map(),
  defaultPricesData: null,
  prices: {},
  divineChaos: 200,
  league: 'Covens',
  selectedOils: ['SilverOil', 'GoldenOil', 'PrismaticOil'],
  targetIds: new Set(),
  rolledNotables: [],
  minHits: 1,
  model: 'exact_tier_bucket',
  maxOilTier: 14,
  sortBy: 'expectedCost',
  includeTainted: false,
  quickTagId: QUICK_FILTER_TAGS[0].id,
  pickerQuery: '',
  poolQuery: '',
  tradeMinHits: 1,
  includeBrickedBase: true,
  pobCorrupted: false,
  benchAttempts: 0,
  benchHits: 0,
  benchChaosSpent: 0,
  rankedCombos: [],
  currentPool: [],
  currentPoolIds: new Set(),
  currentProb: null,
  canvasCtrl: null,
  toastTimer: null,
};

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message) {
  DOM.toastBanner.textContent = message;
  DOM.toastBanner.classList.remove('hidden');
  if (state.toastTimer) clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    DOM.toastBanner.classList.add('hidden');
  }, 2400);
}

function resolveNotable(rawId) {
  return (
    state.notableById.get(rawId) ??
    state.notableById.get(Number(rawId)) ??
    state.notableById.get(String(rawId)) ??
    null
  );
}

function findNotableByName(name) {
  const target = name.trim().toLowerCase();
  return state.treeData?.notables.find((n) => n.name.toLowerCase() === target) || null;
}

function getOilDisplay(oilId) {
  const direct = OIL_MAP.get(oilId);
  if (direct) return direct;
  const normalized = OILS.find(
    (o) =>
      o.id.toLowerCase() === String(oilId).toLowerCase() ||
      o.name.toLowerCase() === String(oilId).toLowerCase() ||
      o.short.toLowerCase() === String(oilId).toLowerCase()
  );
  if (normalized) return normalized;
  if (String(oilId).toLowerCase().includes('tainted')) return TAINTED_OIL;
  return {
    id: String(oilId),
    name: String(oilId),
    short: String(oilId).replace(/Oil$/i, ''),
  };
}

function renderOilBadgesHtml(recipe = []) {
  return recipe
    .map((rawOil) => {
      const oil = getOilDisplay(rawOil);
      return `<span class="oil-badge" data-oil="${escapeHtml(oil.id)}"><img class="oil-icon" src="./assets/oils/${escapeHtml(oil.id)}.png" alt="" aria-hidden="true" width="16" height="16">${escapeHtml(oil.short)}</span>`;
    })
    .join('');
}

function formatChaos(value) {
  if (!Number.isFinite(value)) return 'Impossible';
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k c`;
  if (value >= 100) return `${Math.round(value)}c`;
  return `${value.toFixed(1)}c`;
}

function formatDivine(chaosValue) {
  if (!Number.isFinite(chaosValue) || state.divineChaos <= 0) return '—';
  const divs = chaosValue / state.divineChaos;
  if (divs < 0.1) return `${divs.toFixed(2)}d`;
  return `${divs.toFixed(1)}d`;
}

function formatPct(prob) {
  if (!Number.isFinite(prob) || prob <= 0) return '0.00%';
  if (prob >= 0.99995) return '100.0%';
  if (prob * 100 >= 10) return `${(prob * 100).toFixed(1)}%`;
  if (prob * 100 >= 1) return `${(prob * 100).toFixed(2)}%`;
  return `${(prob * 100).toFixed(3)}%`;
}

function populateStaticSelects() {
  DOM.optModel.innerHTML = PROB_MODELS.map(
    (m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label)}</option>`
  ).join('');
  DOM.optModel.value = state.model;

  DOM.optMaxTier.innerHTML = [...OILS]
    .reverse()
    .filter((o) => o.tier >= 3)
    .map(
      (o) =>
        `<option value="${o.tier}">&le; ${escapeHtml(o.short)} (T${o.tier})</option>`
    )
    .join('');
  DOM.optMaxTier.value = String(state.maxOilTier);

  const oilOptionsHtml = OILS.map(
    (o) =>
      `<option value="${escapeHtml(o.id)}">${escapeHtml(o.short)} (T${o.tier})</option>`
  ).join('');
  DOM.oilSlot1.innerHTML = oilOptionsHtml;
  DOM.oilSlot2.innerHTML = oilOptionsHtml;
  DOM.oilSlot3.innerHTML = oilOptionsHtml;

  const leagueOptionsHtml = LEAGUES.map(
    (lg) => `<option value="${escapeHtml(lg)}">${escapeHtml(lg)}</option>`
  ).join('');
  DOM.hudLeagueSelect.innerHTML = leagueOptionsHtml;
  DOM.hudLeagueSelect.value = state.league;
  DOM.tradeLeague.innerHTML = leagueOptionsHtml;
  DOM.tradeLeague.value = state.league;

  DOM.quickFilterChips.innerHTML = QUICK_FILTER_TAGS.map(
    (tag) =>
      `<button type="button" class="filter-chip${tag.id === state.quickTagId ? ' is-active' : ''}" data-tag="${escapeHtml(tag.id)}">${escapeHtml(tag.label)}</button>`
  ).join('');
}

function setLeague(nextLeague) {
  if (!LEAGUES.includes(nextLeague) || nextLeague === state.league) return;
  state.league = nextLeague;
  applyPricesForLeague(state.league);
  refreshAllState();
  showToast(`Switched league to ${state.league} (Div = ${state.divineChaos}c).`);
}

function serializeHashState() {
  const params = new URLSearchParams();
  if (state.league && state.league !== 'Covens') {
    params.set('l', state.league);
  }
  params.set('o', state.selectedOils.join(','));
  if (state.targetIds.size > 0) {
    params.set('t', Array.from(state.targetIds).join(','));
  }
  params.set('m', state.model);
  params.set('k', String(state.minHits));
  history.replaceState(null, '', `#${params.toString()}`);
}

function parseHashState() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw) return false;
  const params = new URLSearchParams(raw);
  let loadedTargets = false;

  const lg = params.get('l');
  if (lg && LEAGUES.includes(lg)) {
    state.league = lg;
  }

  const o = params.get('o');
  if (o) {
    const parsedOils = o
      .split(',')
      .map((x) => getOilDisplay(x.trim()).id)
      .filter((id) => OILS.some((oil) => oil.id === id));
    const unique = Array.from(new Set(parsedOils));
    if (unique.length === 3) {
      state.selectedOils = unique;
    }
  }

  const t = params.get('t');
  if (t) {
    for (const part of t.split(',')) {
      const notable = resolveNotable(part.trim());
      if (notable) {
        state.targetIds.add(notable.id);
        loadedTargets = true;
      }
    }
  }

  const m = params.get('m');
  if (m && PROB_MODELS.some((pm) => pm.id === m)) {
    state.model = m;
  }

  const k = Number(params.get('k'));
  if ([1, 2, 3, 4].includes(k)) {
    state.minHits = k;
  }

  return loadedTargets;
}

function applyDefaultStarterTargets() {
  const defaults = ['Charisma', 'Whispers of Doom'];
  for (const name of defaults) {
    const found = findNotableByName(name);
    if (found) state.targetIds.add(found.id);
  }
}

function toggleTarget(rawId, { focusOnTree = false } = {}) {
  const notable = resolveNotable(rawId);
  if (!notable) return;
  if (state.targetIds.has(notable.id)) {
    state.targetIds.delete(notable.id);
  } else {
    state.targetIds.add(notable.id);
    if (focusOnTree && Number.isFinite(notable.x) && Number.isFinite(notable.y)) {
      state.canvasCtrl.focusPoint(notable.x, notable.y, 0.14);
    }
  }
  refreshAllState();
}

function setSelectedOils(next3) {
  const unique = Array.from(new Set(next3));
  if (unique.length !== 3) return;
  state.selectedOils = unique;
  refreshAllState();
}

function handleOilSelectChange(slotIndex, nextOilId) {
  const next = [...state.selectedOils];
  const existingIdx = next.indexOf(nextOilId);
  if (existingIdx !== -1 && existingIdx !== slotIndex) {
    next[existingIdx] = next[slotIndex];
  }
  next[slotIndex] = nextOilId;
  setSelectedOils(next);
}

function computeDerivedData() {
  state.currentPool = getEligiblePool(state.treeData.notables, state.selectedOils, state.model);
  state.currentPoolIds = new Set(state.currentPool.map((n) => n.id));
  state.currentProb = computeHitProbability(
    state.currentPool,
    state.targetIds,
    state.minHits,
    state.model
  );

  state.rankedCombos = rankAll364OilCombos({
    notables: state.treeData.notables,
    targetIds: Array.from(state.targetIds),
    minHits: state.minHits,
    oilPrices: state.prices,
    divineChaos: state.divineChaos,
    model: state.model,
    maxOilTier: state.maxOilTier,
    includeTainted: state.includeTainted,
    sortBy: state.sortBy,
  });
}

function renderTargetsAndControls() {
  DOM.hudLeagueSelect.value = state.league;
  DOM.targetCountLabel.textContent = String(state.targetIds.size);

  if (state.targetIds.size === 0) {
    DOM.targetChipsWrap.innerHTML = '<span class="hint-text">No target notables selected.</span>';
  } else {
    const chips = [];
    for (const id of state.targetIds) {
      const notable = resolveNotable(id);
      if (!notable) continue;
      chips.push(
        `<span class="target-chip">` +
          `<button type="button" class="target-chip-focus" data-focus-notable="${escapeHtml(notable.id)}" title="Click to focus notable on passive tree">${escapeHtml(notable.name)}${notable.isBlighted ? ' ★' : ''}</button>` +
          `<button type="button" class="target-chip-remove" data-remove-target="${escapeHtml(notable.id)}" aria-label="Remove ${escapeHtml(notable.name)}" title="Remove target">×</button>` +
        `</span>`
      );
    }
    DOM.targetChipsWrap.innerHTML = chips.join('');
  }

  DOM.optMinHits.value = String(state.minHits);
  DOM.optModel.value = state.model;
  DOM.optMaxTier.value = String(state.maxOilTier);
  DOM.optSortBy.value = state.sortBy;
  DOM.optIncludeTainted.checked = state.includeTainted;

  const modelMeta = PROB_MODELS.find((m) => m.id === state.model);
  DOM.optModelDesc.textContent = modelMeta ? modelMeta.description : '';
}

function renderComboList() {
  const validCombos = state.rankedCombos.filter((c) => c.probability > 0);
  if (state.targetIds.size === 0) {
    DOM.comboSummaryLine.textContent = `${state.rankedCombos.length} combos`;
    DOM.comboResultsList.innerHTML = '<p class="hint-text">Select 1–4 Target Notables above to rank optimal oil combinations.</p>';
    return;
  }

  if (validCombos.length === 0) {
    DOM.comboSummaryLine.textContent = `0 / ${state.rankedCombos.length} possible`;
    DOM.comboResultsList.innerHTML = '<p class="hint-text">No combination can satisfy your target count under the current Max Oil Tier or Model. Try raising Max Oil Tier or lowering Minimum Hits.</p>';
    return;
  }

  DOM.comboSummaryLine.textContent = `${validCombos.length} viable · top 60 shown`;
  const activeKey = [...state.selectedOils].sort().join('|');

  DOM.comboResultsList.innerHTML = validCombos
    .slice(0, 60)
    .map((combo, idx) => {
      const comboKey = [...combo.oils].sort().join('|');
      const isCurrent = comboKey === activeKey;
      const dist = combo.enchantCountDist;
      const comboTitle =
        dist && combo.expectedUniqueEnchants < 3.999
          ? `Avg ${combo.expectedUniqueEnchants.toFixed(2)}/4 enchants · 4e: ${formatPct(dist[4])}, 3e: ${formatPct(dist[3])}, 2e: ${formatPct(dist[2])}, 1e: ${formatPct(dist[1])}`
          : '';
      return (
        `<div class="combo-card${isCurrent ? ' is-active' : ''}"${comboTitle ? ` title="${escapeHtml(comboTitle)}"` : ''}>` +
          `<div class="combo-top">` +
            `<div class="combo-oils"><span class="combo-rank">#${idx + 1}</span>${renderOilBadgesHtml(combo.oils)}</div>` +
            `<button type="button" class="btn btn-sm${isCurrent ? ' btn-primary' : ''}" data-load-combo="${escapeHtml(combo.oils.join(','))}" title="Load these 3 oils into Explorer & highlight pool on tree">${isCurrent ? 'Active' : 'Inspect'}</button>` +
          `</div>` +
          `<div class="combo-metrics">` +
            `<div class="metric-cell"><span class="metric-label">Hit Chance</span><span class="metric-value is-good">${formatPct(combo.probability)}</span></div>` +
            `<div class="metric-cell"><span class="metric-label">Exp. Rolls</span><span class="metric-value">${combo.expectedRolls.toFixed(1)}x</span></div>` +
            `<div class="metric-cell"><span class="metric-label">Roll Cost</span><span class="metric-value">${formatChaos(combo.rollCostChaos)}</span></div>` +
            `<div class="metric-cell"><span class="metric-label">Exp. Cost</span><span class="metric-value is-gold">${formatChaos(combo.expectedCostChaos)} (${formatDivine(combo.expectedCostChaos)})</span></div>` +
          `</div>` +
        `</div>`
      );
    })
    .join('');
}

function matchesQuickTag(notable, tag) {
  if (!tag || tag.id === 'all') return true;
  if (tag.blightedOnly) return Boolean(notable.isBlighted);
  const haystack = `${notable.name} ${(notable.stats || []).join(' ')}`.toLowerCase();
  if (tag.regex) {
    const rx = tag.regex instanceof RegExp ? tag.regex : new RegExp(tag.regex, 'i');
    return rx.test(haystack);
  }
  if (tag.query) {
    return haystack.includes(String(tag.query).toLowerCase());
  }
  return true;
}

function renderNotablePicker() {
  const activeTag = QUICK_FILTER_TAGS.find((t) => t.id === state.quickTagId);
  const q = state.pickerQuery.trim().toLowerCase();

  for (const btn of DOM.quickFilterChips.querySelectorAll('.filter-chip')) {
    btn.classList.toggle('is-active', btn.dataset.tag === state.quickTagId);
  }

  const filtered = state.treeData.notables.filter((n) => {
    if (!matchesQuickTag(n, activeTag)) return false;
    if (!q) return true;
    const oilsText = (n.recipe || []).map((o) => getOilDisplay(o).name).join(' ').toLowerCase();
    const statsText = (n.stats || []).join(' ').toLowerCase();
    return n.name.toLowerCase().includes(q) || statsText.includes(q) || oilsText.includes(q);
  });

  // Sort targets first, then alphabetical
  filtered.sort((a, b) => {
    const at = state.targetIds.has(a.id) ? 0 : 1;
    const bt = state.targetIds.has(b.id) ? 0 : 1;
    if (at !== bt) return at - bt;
    return a.name.localeCompare(b.name);
  });

  DOM.notablePickerCount.textContent = `${filtered.length} / ${state.treeData.notables.length}`;

  const slice = filtered.slice(0, 140);
  DOM.notablePickerList.innerHTML = slice
    .map((n) => {
      const isTarget = state.targetIds.has(n.id);
      const isInPool = state.currentPoolIds.has(n.id);
      return (
        `<div class="notable-row${isTarget ? ' is-target' : ''}${isInPool ? ' is-in-pool' : ''}" data-pick-notable="${escapeHtml(n.id)}" role="button" tabindex="0">` +
          `<div class="notable-row-head">` +
            `<span class="notable-name">${escapeHtml(n.name)}</span>` +
            `<span class="combo-oils">` +
              (n.isBlighted ? '<span class="tag-badge tag-blighted">Blight</span>' : '') +
              (isInPool ? '<span class="tag-badge tag-overlap">Pool</span>' : '') +
              `<span class="hint-text">${isTarget ? 'Selected' : 'Add'}</span>` +
            `</span>` +
          `</div>` +
          `<div class="notable-stats">${escapeHtml((n.stats || []).join(' · '))}</div>` +
          `<div class="combo-oils">${renderOilBadgesHtml(n.recipe)}</div>` +
        `</div>`
      );
    })
    .join('');
}

function renderExplorerTab() {
  DOM.oilSlot1.value = state.selectedOils[0];
  DOM.oilSlot2.value = state.selectedOils[1];
  DOM.oilSlot3.value = state.selectedOils[2];

  const poolSize = state.currentPool.length;
  const prob = state.currentProb;
  const rollCost = computeComboRollCost(state.selectedOils, state.prices, state.includeTainted);
  const expCost = prob.possible ? rollCost * prob.expectedRolls : Infinity;

  DOM.expPoolSize.textContent =
    prob?.expectedUniqueEnchants < 3.995
      ? `${poolSize} · avg ${prob.expectedUniqueEnchants.toFixed(2)}/4`
      : `${poolSize} notables`;
  const dist = prob?.enchantCountDist;
  DOM.expPoolSize.title = dist
    ? `4 enchants: ${formatPct(dist[4])} · 3 enchants: ${formatPct(dist[3])} · 2 enchants: ${formatPct(dist[2])} · 1 enchant: ${formatPct(dist[1])}`
    : '';
  DOM.expTargetsHit.textContent = `${prob.targetsInPool} / ${state.targetIds.size}`;
  DOM.expHitProb.textContent = state.targetIds.size === 0 ? 'Select Targets' : formatPct(prob.probability);
  DOM.expCostLine.textContent = Number.isFinite(expCost)
    ? `${formatChaos(expCost)} (${formatDivine(expCost)})`
    : `${formatChaos(rollCost)} / roll`;

  DOM.benchStatsLine.textContent = `${state.benchAttempts} rolls · ${state.benchHits} hits · ${formatChaos(state.benchChaosSpent)}`;

  if (state.rolledNotables.length === 0) {
    DOM.benchRolledSlots.innerHTML = '<p class="hint-text">Click Anoint 1x to simulate Sister Cassia growing 4 notables onto your Mycelium Core.</p>';
  } else {
    DOM.benchRolledSlots.innerHTML = state.rolledNotables
      .map((n, idx) => {
        const isHit = state.targetIds.has(n.id);
        return (
          `<div class="bench-card${isHit ? ' is-target-hit' : ''}">` +
            `<div class="notable-row-head">` +
              `<span class="notable-name">Slot ${idx + 1}: ${escapeHtml(n.name)}</span>` +
              (isHit ? '<span class="tag-badge tag-hit">Target Hit</span>' : '') +
            `</div>` +
            `<div class="notable-stats">${escapeHtml((n.stats || []).join(' · '))}</div>` +
          `</div>`
        );
      })
      .join('');
  }

  const pq = state.poolQuery.trim().toLowerCase();
  const filteredPool = state.currentPool.filter((n) => {
    if (!pq) return true;
    return (
      n.name.toLowerCase().includes(pq) ||
      (n.stats || []).join(' ').toLowerCase().includes(pq)
    );
  });

  DOM.poolNotablesList.innerHTML = filteredPool
    .slice(0, 140)
    .map((n) => {
      const isTarget = state.targetIds.has(n.id);
      const badgeLabel =
        state.model === 'exact_tier_bucket'
          ? `${getOilDisplay(n.bucketOilId).short} (1/${n.bucketSize}) · ${formatPct(n.seedProb)}`
          : state.model === 'per_oil_bucket'
            ? `${n.overlapSlots}/3 oils · ${((n.drawProb || 0) * 100).toFixed(2)}%`
            : `${n.overlapSlots}/3 oils · w${n.weight}`;
      return (
        `<div class="notable-row${isTarget ? ' is-target' : ''}" data-pick-notable="${escapeHtml(n.id)}" role="button" tabindex="0">` +
          `<div class="notable-row-head">` +
            `<span class="notable-name">${escapeHtml(n.name)}</span>` +
            `<span class="combo-oils">` +
              `<span class="tag-badge tag-overlap">${badgeLabel}</span>` +
              (n.isBlighted ? '<span class="tag-badge tag-blighted">Hidden</span>' : '') +
            `</span>` +
          `</div>` +
          `<div class="notable-stats">${escapeHtml((n.stats || []).join(' · '))}</div>` +
          `<div class="combo-oils">${renderOilBadgesHtml(n.recipe)}</div>` +
        `</div>`
      );
    })
    .join('');
}

function renderTradeAndPricesTab() {
  DOM.tradeLeague.value = state.league;
  DOM.tradeMinHits.value = String(state.tradeMinHits);
  DOM.tradeIncludeBricked.checked = state.includeBrickedBase;
  DOM.pobCorrupted.checked = state.pobCorrupted;
  DOM.divineChaosInput.value = String(state.divineChaos);

  const tradeTargets =
    state.rolledNotables.length > 0 && state.targetIds.size === 0
      ? state.rolledNotables.map((n) => n.id)
      : Array.from(state.targetIds);

  const tradeResult =
    tradeTargets.length === 0
      ? { url: '', payload: { note: 'Select at least 1 Target Notable to generate a PoE Trade query.' } }
      : buildTradeSearchUrl({
          league: state.league,
          targetIds: tradeTargets,
          minHits: Math.min(state.tradeMinHits, Math.max(1, tradeTargets.length)),
          includeBrickedBase: state.includeBrickedBase,
        });

  DOM.tradeJsonPreview.value = JSON.stringify(tradeResult.payload, null, 2);
  DOM.btnOpenTrade.dataset.tradeUrl = tradeResult.url;
  DOM.btnOpenTrade.disabled = tradeTargets.length === 0;

  const pobSource =
    state.rolledNotables.length > 0
      ? state.rolledNotables
      : Array.from(state.targetIds)
          .slice(0, 4)
          .map((id) => resolveNotable(id))
          .filter(Boolean);

  DOM.pobItemPreview.value = buildPobItemText({
    rolledNotables: pobSource,
    socket: null,
    corrupted: state.pobCorrupted,
  });

  const allPricedOils = [...OILS, TAINTED_OIL];
  DOM.oilPricesGrid.innerHTML = allPricedOils
    .map((oil) => {
      const val = Number(state.prices[oil.id] ?? 0);
      const inputId = `oil-price-${oil.id}`;
      return (
        `<div class="price-row">` +
          `<label for="${escapeHtml(inputId)}" class="price-oil-name"><img class="oil-icon" src="./assets/oils/${escapeHtml(oil.id)}.png" alt="" aria-hidden="true" width="16" height="16">${escapeHtml(oil.short)}</label>` +
          `<input id="${escapeHtml(inputId)}" class="price-input" type="number" min="0" step="0.1" data-oil-price="${escapeHtml(oil.id)}" value="${escapeHtml(val)}" aria-label="${escapeHtml(oil.name)} price in Chaos Orbs" title="${escapeHtml(oil.name)} price in Chaos Orbs">` +
        `</div>`
      );
    })
    .join('');
}

function renderRightSeedCard() {
  DOM.seedCardOils.innerHTML = renderOilBadgesHtml(state.selectedOils);

  const hasRolled = state.benchAttempts > 0 || state.rolledNotables.length > 0;
  const enchantLines = [];
  if (!hasRolled) {
    for (let i = 0; i < 4; i += 1) {
      enchantLines.push(
        `<div class="seed-enchant-btn is-empty">1 added passive skill is (Unrolled Slot ${i + 1})</div>`
      );
    }
    DOM.seedCardEnchantMeta.textContent = 'Click Anoint 1x to simulate 4 draws';
  } else {
    for (let i = 0; i < state.rolledNotables.length; i += 1) {
      const rolled = state.rolledNotables[i];
      const isHit = state.targetIds.has(rolled.id);
      enchantLines.push(
        `<button type="button" class="seed-enchant-btn${isHit ? ' is-target-hit' : ''}" data-focus-notable="${escapeHtml(rolled.id)}" title="Click to focus ${escapeHtml(rolled.name)} on tree">` +
          `1 added passive skill is ${escapeHtml(rolled.name)}${rolled.isBlighted ? ' ★' : ''}` +
        `</button>`
      );
    }
    const count = state.rolledNotables.length;
    const dups = Math.max(0, 4 - count);
    DOM.seedCardEnchantMeta.textContent =
      dups > 0
        ? state.model === 'exact_tier_bucket'
          ? `${count} Enchant Modifier${count === 1 ? '' : 's'} (${dups} slot${dups > 1 ? 's' : ''} exhausted Clear/Sepia bucket)`
          : `${count} Enchant Modifier${count === 1 ? '' : 's'} (${dups} duplicate roll${dups > 1 ? 's' : ''} collapsed)`
        : '4 Enchant Modifiers';
  }
  DOM.seedCardEnchants.innerHTML = enchantLines.join('');

  const showCorrupted = state.pobCorrupted || state.includeTainted;
  DOM.seedCardCorrupted.classList.toggle('hidden', !showCorrupted);

  DOM.btnCardOpenTrade.disabled = DOM.btnOpenTrade.disabled;
  DOM.btnCardOpenTrade.dataset.tradeUrl = DOM.btnOpenTrade.dataset.tradeUrl || '';
}

function renderBlightDock() {
  const blighted = state.treeData.notables
    .filter((n) => n.isBlighted)
    .sort((a, b) => a.name.localeCompare(b.name));

  let inPoolCount = 0;
  let targetCount = 0;
  for (const n of blighted) {
    if (state.currentPoolIds.has(n.id)) inPoolCount += 1;
    if (state.targetIds.has(n.id)) targetCount += 1;
  }

  DOM.blightPillText.textContent = `Hidden Anoints: ${inPoolCount} / ${blighted.length} in Pool · ${targetCount} targeted`;

  DOM.blightDrawerGrid.innerHTML = blighted
    .map((n) => {
      const isTarget = state.targetIds.has(n.id);
      const isInPool = state.currentPoolIds.has(n.id);
      return (
        `<div class="notable-row${isTarget ? ' is-target' : ''}${isInPool ? ' is-in-pool' : ''}" data-pick-notable="${escapeHtml(n.id)}" role="button" tabindex="0">` +
          `<div class="notable-row-head">` +
            `<span class="notable-name">${escapeHtml(n.name)}</span>` +
            (isInPool ? '<span class="tag-badge tag-overlap">Pool</span>' : '') +
          `</div>` +
          `<div class="notable-stats">${escapeHtml((n.stats || []).join(' · '))}</div>` +
          `<div class="combo-oils">${renderOilBadgesHtml(n.recipe)}</div>` +
        `</div>`
      );
    })
    .join('');
}

function syncCanvas() {
  const rolledIds = new Set(state.rolledNotables.map((n) => n.id));
  state.canvasCtrl.setState({
    poolIds: state.currentPoolIds,
    targetIds: state.targetIds,
    rolledIds,
    rolledNotables: state.rolledNotables,
  });
}

function refreshAllState() {
  computeDerivedData();
  renderTargetsAndControls();
  renderComboList();
  renderNotablePicker();
  renderExplorerTab();
  renderTradeAndPricesTab();
  renderRightSeedCard();
  renderBlightDock();
  syncCanvas();
  serializeHashState();
}

function rollOnceAtCassia() {
  const minRequired =
    state.model === 'exact_tier_bucket' || state.model === 'per_oil_bucket' ? 1 : 4;
  if (state.currentPool.length < minRequired) {
    showToast(`Need at least ${minRequired} eligible notable(s) in pool to roll.`);
    return;
  }
  const cost = computeComboRollCost(state.selectedOils, state.prices, state.includeTainted);
  const rolled = simulateCassiaRoll(state.currentPool, state.model);
  state.rolledNotables = rolled;
  state.benchAttempts += 1;
  state.benchChaosSpent += cost;

  const hits = rolled.filter((n) => state.targetIds.has(n.id)).length;
  if (hits >= state.minHits && state.targetIds.size > 0) {
    state.benchHits += 1;
    showToast(`Hit ${hits} target notable(s) on Cassia roll!`);
  }
  refreshAllState();
}

function autoRollUntilHit() {
  if (state.targetIds.size === 0) {
    showToast('Select at least 1 Target Notable before auto-rolling.');
    return;
  }
  if (!state.currentProb?.possible) {
    showToast('Current 3 oils cannot satisfy your target hit requirement.');
    return;
  }

  const cost = computeComboRollCost(state.selectedOils, state.prices, state.includeTainted);
  let rollsThisRun = 0;
  let lastRolled = [];
  const maxIterations = 5000;

  while (rollsThisRun < maxIterations) {
    rollsThisRun += 1;
    lastRolled = simulateCassiaRoll(state.currentPool, state.model);
    const hits = lastRolled.filter((n) => state.targetIds.has(n.id)).length;
    if (hits >= state.minHits) {
      state.benchHits += 1;
      break;
    }
  }

  state.rolledNotables = lastRolled;
  state.benchAttempts += rollsThisRun;
  state.benchChaosSpent += cost * rollsThisRun;
  showToast(`Auto-rolled ${rollsThisRun} attempt(s) (${formatChaos(cost * rollsThisRun)}).`);
  refreshAllState();
}

function updateTooltip(hit, clientX, clientY) {
  if (!hit) {
    DOM.tooltip.classList.add('hidden');
    return;
  }

  const pad = 16;
  const maxLeft = Math.max(8, window.innerWidth - 318);
  const maxTop = Math.max(8, window.innerHeight - 210);
  const tx = Math.min(clientX + pad, maxLeft);
  const ty = Math.min(clientY + pad, maxTop);
  DOM.tooltip.style.setProperty('--tx', `${tx}px`);
  DOM.tooltip.style.setProperty('--ty', `${ty}px`);

  DOM.tooltipOils.classList.add('hidden');
  DOM.tooltipSubtitle.classList.add('hidden');

  if (hit.type === 'notable') {
    const n = hit.item;
    const isTarget = state.targetIds.has(n.id);
    const isInPool = state.currentPoolIds.has(n.id);
    DOM.tooltipTitle.textContent = n.name;
    const flags = [];
    if (n.isBlighted) flags.push('Hidden Anoint (Prismatic)');
    const maxOil = OILS.find((o) => o.tier === n.maxTier);
    if (maxOil) {
      const poolItem = isInPool ? state.currentPool.find((p) => p.id === n.id) : null;
      if (state.model === 'exact_tier_bucket' && poolItem?.seedProb) {
        flags.push(`T${n.maxTier} ${maxOil.short} bucket (${formatPct(poolItem.seedProb)} / seed)`);
      } else {
        flags.push(`T${n.maxTier} ${maxOil.short} bucket`);
      }
    }
    if (isTarget) flags.push('Target');
    if (isInPool) flags.push('In Current Oil Pool');
    flags.push('Click to toggle Target');
    DOM.tooltipSubtitle.textContent = flags.join(' · ');
    DOM.tooltipSubtitle.classList.remove('hidden');
    DOM.tooltipStats.innerHTML = (n.stats || []).map((s) => `<li>${escapeHtml(s)}</li>`).join('');
    if (n.recipe) {
      DOM.tooltipOils.innerHTML = renderOilBadgesHtml(n.recipe);
      DOM.tooltipOils.classList.remove('hidden');
    }
  }

  DOM.tooltip.classList.remove('hidden');
}

function updateQuickJumpDropdown(rawQuery) {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    DOM.quickJumpResults.classList.add('hidden');
    DOM.quickJumpResults.innerHTML = '';
    return;
  }

  const all = state.treeData.notables
    .filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        (n.stats || []).join(' ').toLowerCase().includes(q)
    )
    .slice(0, 14)
    .map((n) => ({ kind: 'notable', notable: n }));

  if (all.length === 0) {
    DOM.quickJumpResults.classList.add('hidden');
    return;
  }

  DOM.quickJumpResults.innerHTML = all
    .map((entry) => {
      const n = entry.notable;
      return (
        `<button type="button" class="search-jump-item" data-jump-notable="${escapeHtml(n.id)}">` +
          `<span>${escapeHtml(n.name)}</span>` +
          `<span class="hint-text">${n.isBlighted ? 'Hidden Anoint' : 'Focus + Target'}</span>` +
        `</button>`
      );
    })
    .join('');

  DOM.quickJumpResults.classList.remove('hidden');
}

async function syncLiveOilPrices() {
  DOM.btnRefreshPrices.disabled = true;
  DOM.pricesStatusText.textContent = `Refreshing ${state.league} oil prices...`;
  try {
    const res = await fetch(`./api/oil-prices?league=${encodeURIComponent(state.league)}`);
    if (res.ok) {
      const payload = await res.json();
      if (payload?.prices && Object.keys(payload.prices).length > 0) {
        state.prices = { ...state.prices, ...payload.prices };
        if (Number.isFinite(payload.divineChaos) && payload.divineChaos > 0) {
          state.divineChaos = payload.divineChaos;
        }
        saveLeaguePrices(state.league, state.prices, state.divineChaos);
        DOM.pricesStatusText.textContent = `Live synced (${payload.league}) · Div = ${state.divineChaos}c`;
        showToast(`Updated ${payload.league} oil prices from poe.ninja.`);
        refreshAllState();
        DOM.btnRefreshPrices.disabled = false;
        return;
      }
    }
  } catch {
    // Static / GitHub Pages mode has no local /api/oil-prices proxy; fall back cleanly
  }

  try {
    const snapRes = await fetch(`./data/oil_prices.json?t=${Date.now()}`);
    if (!snapRes.ok) throw new Error(`HTTP ${snapRes.status}`);
    state.defaultPricesData = await snapRes.json();
    const hadCustom = Boolean(loadSavedLeaguePrices(state.league));
    applyPricesForLeague(state.league);
    if (!hadCustom) {
      DOM.pricesStatusText.textContent = `Snapshot refreshed (${state.league}) · click poe.ninja Oils for live rates`;
    }
    showToast(`Reloaded ${state.league} oil snapshot.`);
    refreshAllState();
  } catch (err) {
    DOM.pricesStatusText.textContent = `Using bundled rates. Click poe.ninja Oils for live rates.`;
    showToast(`Could not reload snapshot (${err.message}).`);
  } finally {
    DOM.btnRefreshPrices.disabled = false;
  }
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard.`);
  } catch {
    showToast(`Copy failed — select and copy manually.`);
  }
}

function switchTab(tabName) {
  for (const btn of DOM.tabButtons) {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  for (const [key, panel] of Object.entries(DOM.tabPanels)) {
    panel.classList.toggle('hidden', key !== tabName);
  }
}

function bindEvents() {
  for (const btn of DOM.tabButtons) {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  }

  DOM.btnToggleLeft.addEventListener('click', () => {
    DOM.leftPanel.classList.toggle('is-collapsed');
  });
  DOM.btnCloseLeft.addEventListener('click', () => {
    DOM.leftPanel.classList.add('is-collapsed');
  });
  DOM.btnToggleRight.addEventListener('click', () => {
    DOM.rightPanel.classList.toggle('is-collapsed');
  });
  DOM.btnCloseRight.addEventListener('click', () => {
    DOM.rightPanel.classList.add('is-collapsed');
  });

  DOM.btnFitTree.addEventListener('click', () => state.canvasCtrl.fitTree());
  DOM.btnCopyShare.addEventListener('click', () => {
    serializeHashState();
    copyText(location.href, 'Share URL');
  });

  DOM.btnOpenMechanics.addEventListener('click', () => DOM.mechanicsModal.classList.remove('hidden'));
  DOM.btnCloseMechanics.addEventListener('click', () => DOM.mechanicsModal.classList.add('hidden'));
  DOM.mechanicsModal.addEventListener('click', (e) => {
    if (e.target === DOM.mechanicsModal) DOM.mechanicsModal.classList.add('hidden');
  });
  DOM.btnOpenDonate.addEventListener('click', openDonateModal);
  DOM.btnCloseDonate.addEventListener('click', () => DOM.donateModal.classList.add('hidden'));
  DOM.donateModal.addEventListener('click', (e) => {
    if (e.target === DOM.donateModal) DOM.donateModal.classList.add('hidden');
  });
  DOM.btnMechanicsDonate.addEventListener('click', () => {
    DOM.mechanicsModal.classList.add('hidden');
    openDonateModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      DOM.mechanicsModal.classList.add('hidden');
      DOM.donateModal.classList.add('hidden');
      DOM.quickJumpResults.classList.add('hidden');
    }
  });

  DOM.quickJumpInput.addEventListener('input', (e) => updateQuickJumpDropdown(e.target.value));
  DOM.quickJumpInput.addEventListener('focus', (e) => updateQuickJumpDropdown(e.target.value));
  DOM.quickJumpResults.addEventListener('click', (e) => {
    const notBtn = e.target.closest('[data-jump-notable]');
    if (notBtn) {
      const n = resolveNotable(notBtn.dataset.jumpNotable);
      if (n) {
        if (!state.targetIds.has(n.id)) state.targetIds.add(n.id);
        if (Number.isFinite(n.x) && Number.isFinite(n.y)) {
          state.canvasCtrl.focusPoint(n.x, n.y, 0.14);
        }
        refreshAllState();
      }
      DOM.quickJumpResults.classList.add('hidden');
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-jump-wrap')) {
      DOM.quickJumpResults.classList.add('hidden');
    }
  });

  DOM.btnPresetAura.addEventListener('click', () => {
    state.targetIds.clear();
    for (const name of ['Charisma', 'Whispers of Doom', 'Sovereignty']) {
      const found = findNotableByName(name);
      if (found) state.targetIds.add(found.id);
    }
    refreshAllState();
  });

  DOM.btnClearTargets.addEventListener('click', () => {
    state.targetIds.clear();
    refreshAllState();
  });

  DOM.targetChipsWrap.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove-target]');
    if (rm) {
      toggleTarget(rm.dataset.removeTarget);
      return;
    }
    const focusBtn = e.target.closest('[data-focus-notable]');
    if (focusBtn) {
      const n = resolveNotable(focusBtn.dataset.focusNotable);
      if (n && Number.isFinite(n.x) && Number.isFinite(n.y)) {
        state.canvasCtrl.focusPoint(n.x, n.y, 0.14);
      } else if (n?.isBlighted) {
        DOM.blightDrawer.classList.remove('hidden');
      }
    }
  });

  DOM.optMinHits.addEventListener('change', (e) => {
    state.minHits = Number(e.target.value);
    refreshAllState();
  });
  DOM.optModel.addEventListener('change', (e) => {
    state.model = e.target.value;
    refreshAllState();
  });
  DOM.optMaxTier.addEventListener('change', (e) => {
    state.maxOilTier = Number(e.target.value);
    refreshAllState();
  });
  DOM.optSortBy.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    refreshAllState();
  });
  DOM.optIncludeTainted.addEventListener('change', (e) => {
    state.includeTainted = e.target.checked;
    refreshAllState();
  });

  DOM.comboResultsList.addEventListener('click', (e) => {
    const loadBtn = e.target.closest('[data-load-combo]');
    if (loadBtn) {
      setSelectedOils(loadBtn.dataset.loadCombo.split(','));
      showToast('Loaded oil combination into Explorer.');
    }
  });

  DOM.quickFilterChips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-tag]');
    if (!chip) return;
    state.quickTagId = chip.dataset.tag;
    renderNotablePicker();
  });

  DOM.notableSearchInput.addEventListener('input', (e) => {
    state.pickerQuery = e.target.value;
    renderNotablePicker();
  });

  const handlePickerClick = (e) => {
    const row = e.target.closest('[data-pick-notable]');
    if (row) {
      toggleTarget(row.dataset.pickNotable, { focusOnTree: true });
    }
  };
  DOM.notablePickerList.addEventListener('click', handlePickerClick);
  DOM.poolNotablesList.addEventListener('click', handlePickerClick);
  DOM.blightDrawerGrid.addEventListener('click', handlePickerClick);

  DOM.oilSlot1.addEventListener('change', (e) => handleOilSelectChange(0, e.target.value));
  DOM.oilSlot2.addEventListener('change', (e) => handleOilSelectChange(1, e.target.value));
  DOM.oilSlot3.addEventListener('change', (e) => handleOilSelectChange(2, e.target.value));

  DOM.btnPresetBudget.addEventListener('click', () => setSelectedOils(['ClearOil', 'SepiaOil', 'AmberOil']));
  DOM.btnPresetMid.addEventListener('click', () => setSelectedOils(['CrimsonOil', 'VioletOil', 'OpalescentOil']));
  DOM.btnPresetEndgame.addEventListener('click', () => setSelectedOils(['SilverOil', 'GoldenOil', 'PrismaticOil']));
  DOM.btnSyncBestCombo.addEventListener('click', () => {
    const best = state.rankedCombos.find((c) => c.probability > 0);
    if (best) setSelectedOils(best.oils);
    else showToast('No optimal combo available yet — pick Target Notables first.');
  });

  DOM.btnRollOnce.addEventListener('click', rollOnceAtCassia);
  DOM.btnAutoRoll.addEventListener('click', autoRollUntilHit);
  DOM.btnResetBench.addEventListener('click', () => {
    state.rolledNotables = [];
    state.benchAttempts = 0;
    state.benchHits = 0;
    state.benchChaosSpent = 0;
    refreshAllState();
  });

  DOM.poolSearchInput.addEventListener('input', (e) => {
    state.poolQuery = e.target.value;
    renderExplorerTab();
  });

  DOM.hudLeagueSelect.addEventListener('change', (e) => setLeague(e.target.value));
  DOM.tradeLeague.addEventListener('change', (e) => setLeague(e.target.value));
  DOM.tradeMinHits.addEventListener('change', (e) => {
    state.tradeMinHits = Number(e.target.value);
    renderTradeAndPricesTab();
  });
  DOM.tradeIncludeBricked.addEventListener('change', (e) => {
    state.includeBrickedBase = e.target.checked;
    renderTradeAndPricesTab();
  });
  DOM.pobCorrupted.addEventListener('change', (e) => {
    state.pobCorrupted = e.target.checked;
    renderTradeAndPricesTab();
  });

  DOM.btnOpenTrade.addEventListener('click', () => {
    const url = DOM.btnOpenTrade.dataset.tradeUrl;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  });
  DOM.btnCopyTradeJson.addEventListener('click', () => copyText(DOM.tradeJsonPreview.value, 'Trade JSON'));
  DOM.btnCopyPob.addEventListener('click', () => copyText(DOM.pobItemPreview.value, 'PoB Item'));

  DOM.btnOpenNinjaOils.addEventListener('click', () => {
    window.open(getPoeNinjaOilsUrl(state.league), '_blank', 'noopener,noreferrer');
  });
  DOM.btnOpenNinjaJson.addEventListener('click', () => {
    window.open(getPoeNinjaOilApiUrl(state.league), '_blank', 'noopener,noreferrer');
  });
  DOM.btnApplyNinjaJson.addEventListener('click', () => {
    try {
      const parsed = parsePoeNinjaOilJson(DOM.ninjaJsonInput.value);
      state.prices = { ...state.prices, ...parsed.prices };
      if (Number.isFinite(parsed.divineChaos) && parsed.divineChaos > 0) {
        state.divineChaos = parsed.divineChaos;
      }
      saveLeaguePrices(state.league, state.prices, state.divineChaos);
      DOM.ninjaJsonInput.value = '';
      DOM.pricesStatusText.textContent = `Custom saved prices (${state.league}) · ${parsed.count} oils imported.`;
      showToast(`Imported ${parsed.count} oil prices from poe.ninja JSON!`);
      refreshAllState();
    } catch (err) {
      showToast(err.message);
    }
  });

  DOM.btnRefreshPrices.addEventListener('click', syncLiveOilPrices);
  DOM.btnResetPrices.addEventListener('click', () => {
    clearSavedLeaguePrices(state.league);
    applyPricesForLeague(state.league);
    showToast(`Restored ${state.league} snapshot prices.`);
    refreshAllState();
  });

  DOM.divineChaosInput.addEventListener('change', (e) => {
    const val = Number(e.target.value);
    if (Number.isFinite(val) && val > 0) {
      state.divineChaos = val;
      saveLeaguePrices(state.league, state.prices, state.divineChaos);
      DOM.pricesStatusText.textContent = `Custom saved prices (${state.league}) · click Reset to restore snapshot.`;
      refreshAllState();
    }
  });

  DOM.oilPricesGrid.addEventListener('change', (e) => {
    const inp = e.target.closest('[data-oil-price]');
    if (!inp) return;
    const val = Number(inp.value);
    if (Number.isFinite(val) && val >= 0) {
      state.prices[inp.dataset.oilPrice] = val;
      saveLeaguePrices(state.league, state.prices, state.divineChaos);
      DOM.pricesStatusText.textContent = `Custom saved prices (${state.league}) · click Reset to restore snapshot.`;
      refreshAllState();
    }
  });

  DOM.btnCardRoll.addEventListener('click', rollOnceAtCassia);
  DOM.btnCardAutoRoll.addEventListener('click', autoRollUntilHit);
  DOM.btnCardCopyPob.addEventListener('click', () => copyText(DOM.pobItemPreview.value, 'PoB Item'));
  DOM.btnCardOpenTrade.addEventListener('click', () => {
    const url = DOM.btnCardOpenTrade.dataset.tradeUrl;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  });
  DOM.seedCardEnchants.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-focus-notable]');
    if (!btn) return;
    const n = resolveNotable(btn.dataset.focusNotable);
    if (n && Number.isFinite(n.x) && Number.isFinite(n.y)) {
      state.canvasCtrl.focusPoint(n.x, n.y, 0.14);
    } else if (n?.isBlighted) {
      DOM.blightDrawer.classList.remove('hidden');
    }
  });

  DOM.btnToggleBlightDrawer.addEventListener('click', () => {
    DOM.blightDrawer.classList.toggle('hidden');
  });
  DOM.btnCloseBlightDrawer.addEventListener('click', () => {
    DOM.blightDrawer.classList.add('hidden');
  });
}

async function init() {
  populateStaticSelects();

  const [treeRes, priceRes] = await Promise.all([
    fetch('./data/poe_330_tree.json'),
    fetch('./data/oil_prices.json'),
  ]);

  if (!treeRes.ok) throw new Error(`Failed to load tree data (${treeRes.status})`);
  if (!priceRes.ok) throw new Error(`Failed to load oil prices (${priceRes.status})`);

  state.treeData = await treeRes.json();
  state.defaultPricesData = await priceRes.json();

  for (const n of state.treeData.notables) {
    state.notableById.set(n.id, n);
    state.notableById.set(String(n.id), n);
  }

  state.canvasCtrl = new PassiveTreeCanvas(DOM.canvas, {
    onToggleTarget: (id) => toggleTarget(id, { focusOnTree: false }),
    onHover: (hit, cx, cy) => updateTooltip(hit, cx, cy),
  });
  state.canvasCtrl.setTreeData(state.treeData);

  const hadHashTargets = parseHashState();
  applyPricesForLeague(state.league);
  if (!hadHashTargets) {
    applyDefaultStarterTargets();
  }

  bindEvents();
  refreshAllState();
  state.canvasCtrl.fitTree();
}

init().catch((err) => {
  console.error(err);
  DOM.comboSummaryLine.textContent = `Init error: ${err.message}`;
  showToast(`Failed to initialize calculator: ${err.message}`);
});
