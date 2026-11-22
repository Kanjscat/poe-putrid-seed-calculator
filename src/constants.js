export const OILS = [
  { id: 'ClearOil', name: 'Clear Oil', short: 'Clear', tier: 1, ninjaId: 'clear-oil', color: '#cfd8dc', glow: 'rgba(207, 216, 220, 0.55)' },
  { id: 'SepiaOil', name: 'Sepia Oil', short: 'Sepia', tier: 2, ninjaId: 'sepia-oil', color: '#b08968', glow: 'rgba(176, 137, 104, 0.55)' },
  { id: 'AmberOil', name: 'Amber Oil', short: 'Amber', tier: 3, ninjaId: 'amber-oil', color: '#e07a24', glow: 'rgba(224, 122, 36, 0.55)' },
  { id: 'VerdantOil', name: 'Verdant Oil', short: 'Verdant', tier: 4, ninjaId: 'verdant-oil', color: '#4caf50', glow: 'rgba(76, 175, 80, 0.55)' },
  { id: 'TealOil', name: 'Teal Oil', short: 'Teal', tier: 5, ninjaId: 'teal-oil', color: '#26a69a', glow: 'rgba(38, 166, 154, 0.55)' },
  { id: 'AzureOil', name: 'Azure Oil', short: 'Azure', tier: 6, ninjaId: 'azure-oil', color: '#42a5f5', glow: 'rgba(66, 165, 245, 0.55)' },
  { id: 'IndigoOil', name: 'Indigo Oil', short: 'Indigo', tier: 7, ninjaId: 'indigo-oil', color: '#5c6bc0', glow: 'rgba(92, 107, 192, 0.55)' },
  { id: 'VioletOil', name: 'Violet Oil', short: 'Violet', tier: 8, ninjaId: 'violet-oil', color: '#ab47bc', glow: 'rgba(171, 71, 188, 0.55)' },
  { id: 'CrimsonOil', name: 'Crimson Oil', short: 'Crimson', tier: 9, ninjaId: 'crimson-oil', color: '#ef5350', glow: 'rgba(239, 83, 80, 0.55)' },
  { id: 'BlackOil', name: 'Black Oil', short: 'Black', tier: 10, ninjaId: 'black-oil', color: '#78909c', glow: 'rgba(120, 144, 156, 0.55)' },
  { id: 'OpalescentOil', name: 'Opalescent Oil', short: 'Opalescent', tier: 11, ninjaId: 'opalescent-oil', color: '#80deea', glow: 'rgba(128, 222, 234, 0.65)' },
  { id: 'SilverOil', name: 'Silver Oil', short: 'Silver', tier: 12, ninjaId: 'silver-oil', color: '#e3f2fd', glow: 'rgba(227, 242, 253, 0.7)' },
  { id: 'GoldenOil', name: 'Golden Oil', short: 'Golden', tier: 13, ninjaId: 'golden-oil', color: '#ffd54f', glow: 'rgba(255, 213, 79, 0.75)' },
  { id: 'PrismaticOil', name: 'Prismatic Oil', short: 'Prismatic', tier: 14, ninjaId: 'prismatic-oil', color: '#f48fb1', glow: 'rgba(244, 143, 177, 0.8)' },
];

export const TAINTED_OIL = {
  id: 'TaintedOil',
  name: 'Tainted Oil',
  short: 'Tainted',
  ninjaId: 'tainted-oil',
  color: '#d97706',
};

export const OIL_MAP = new Map(OILS.map((o) => [o.id, o]));

export const LEAGUES = ['Covens', 'Hardcore Covens', 'Ruthless Covens', 'Standard', 'Hardcore'];

export const PROB_MODELS = [
  {
    id: 'exact_tier_bucket',
    label: 'Per-Oil Max-Tier Bucket (Verified 3.30)',
    description:
      'Verified on 117 live Covens Trade seeds & 1,238 <4-enchant listings (0 violations): each of 4 slots picks 1 of your 3 oils (1/3 each), then draws without replacement from notables whose highest recipe oil equals that oil (maxTier == oil). Clear (1) & Sepia (3) can exhaust, yielding 1–3 enchants.',
  },
  {
    id: 'per_oil_bucket',
    label: 'Legacy Per-Oil Overlap (Pre-Audit)',
    description:
      'Legacy hypothesis: each draw picks 1 of your 3 oils (1/3), then draws with replacement from notables with maxTier <= max(chosen3) containing that oil. Falsified by live Trade (predicts 4 distinct maxTiers).',
  },
  {
    id: 'uniform',
    label: 'Tier-Cap + Match (Uniform Reference)',
    description:
      'Reference model: eligible pool = notables with maxTier <= max(chosen3) sharing >=1 oil. Equal uniform weight across pool.',
  },
  {
    id: 'weighted_overlap',
    label: 'Overlap-Biased Draw (1:2:3 Reference)',
    description:
      'Reference model: same tier-cap + match pool, weighting notables linearly by 1x/2x/3x matching oil slots without replacement.',
  },
  {
    id: 'strict_subset',
    label: 'Strict 3-Oil Subset (Reference)',
    description:
      'Reference lower bound: only notables whose complete 3-oil recipe uses exclusively your 3 selected oils.',
  },
];

/**
 * Exact 12-node (8 Smalls + 4 Notables) Mycelium Core topologies from official PoE Wiki 3.30.0 diagrams.
 */
export const OUTER_SOCKETS = [
  {
    id: '7960',
    label: 'Upper Left',
    region: 'Witch / Templar',
    smallPassiveText: '6% increased maximum Energy Shield',
    smallStats: { esPct: 6, armourPct: 0, evasionPct: 0 },
    accent: '#60a5fa',
    layout: {
      nodes: [
        { i: 0, role: 'socket', slot: 0, dx: 0, dy: 0 },
        { i: 1, role: 'small', slot: 0, dx: 30, dy: -260 },
        { i: 2, role: 'small', slot: 0, dx: -165, dy: -460 },
        { i: 3, role: 'small', slot: 0, dx: 25, dy: -680 },
        { i: 4, role: 'notable', slot: 1, dx: -195, dy: -940 },
        { i: 5, role: 'small', slot: 0, dx: -445, dy: -1060 },
        { i: 6, role: 'small', slot: 0, dx: -445, dy: -1350 },
        { i: 7, role: 'small', slot: 0, dx: -195, dy: -1510 },
        { i: 8, role: 'notable', slot: 4, dx: -115, dy: -1780 },
        { i: 9, role: 'notable', slot: 2, dx: 265, dy: -855 },
        { i: 10, role: 'small', slot: 0, dx: 535, dy: -885 },
        { i: 11, role: 'small', slot: 0, dx: 410, dy: -1140 },
        { i: 12, role: 'notable', slot: 3, dx: 635, dy: -1360 },
      ],
      edges: [
        [0, 1], [1, 2], [2, 3],
        [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
        [3, 9], [9, 10], [10, 11], [11, 12],
      ],
    },
  },
  {
    id: '21984',
    label: 'Upper Right',
    region: 'Witch / Shadow',
    smallPassiveText: '10% increased Evasion Rating; 4% increased maximum Energy Shield',
    smallStats: { esPct: 4, armourPct: 0, evasionPct: 10 },
    accent: '#34d399',
    layout: {
      nodes: [
        { i: 0, role: 'socket', slot: 0, dx: 0, dy: 0 },
        { i: 1, role: 'small', slot: 0, dx: 110, dy: -280 },
        { i: 2, role: 'small', slot: 0, dx: 230, dy: -540 },
        { i: 3, role: 'notable', slot: 3, dx: 350, dy: -820 },
        { i: 4, role: 'small', slot: 0, dx: 280, dy: -1110 },
        { i: 5, role: 'small', slot: 0, dx: 540, dy: -1240 },
        { i: 6, role: 'notable', slot: 4, dx: 430, dy: -1520 },
        { i: 7, role: 'small', slot: 0, dx: 290, dy: -150 },
        { i: 8, role: 'small', slot: 0, dx: 550, dy: -320 },
        { i: 9, role: 'notable', slot: 1, dx: 825, dy: -215 },
        { i: 10, role: 'small', slot: 0, dx: 865, dy: -520 },
        { i: 11, role: 'small', slot: 0, dx: 865, dy: -820 },
        { i: 12, role: 'notable', slot: 2, dx: 1045, dy: -1075 },
      ],
      edges: [
        [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
        [0, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12],
      ],
    },
  },
  {
    id: '55190',
    label: 'Left',
    region: 'Marauder / Templar',
    smallPassiveText: '10% increased Armour; 4% increased maximum Energy Shield',
    smallStats: { esPct: 4, armourPct: 10, evasionPct: 0 },
    accent: '#fb923c',
    layout: {
      nodes: [
        { i: 0, role: 'socket', slot: 0, dx: 0, dy: 0 },
        { i: 1, role: 'small', slot: 0, dx: -155, dy: -255 },
        { i: 2, role: 'small', slot: 0, dx: -340, dy: -480 },
        { i: 3, role: 'notable', slot: 1, dx: -355, dy: -775 },
        { i: 4, role: 'small', slot: 0, dx: -260, dy: -195 },
        { i: 5, role: 'notable', slot: 2, dx: -525, dy: -360 },
        { i: 6, role: 'small', slot: 0, dx: -780, dy: -450 },
        { i: 7, role: 'small', slot: 0, dx: -790, dy: -745 },
        { i: 8, role: 'small', slot: 0, dx: -1055, dy: -900 },
        { i: 9, role: 'notable', slot: 4, dx: -1065, dy: -1195 },
        { i: 10, role: 'small', slot: 0, dx: -320, dy: -35 },
        { i: 11, role: 'small', slot: 0, dx: -620, dy: 45 },
        { i: 12, role: 'notable', slot: 3, dx: -865, dy: -135 },
      ],
      edges: [
        [0, 1], [1, 2], [2, 3],
        [0, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9],
        [0, 10], [10, 11], [11, 12],
      ],
    },
  },
  {
    id: '32763',
    label: 'Right',
    region: 'Shadow / Ranger',
    smallPassiveText: '14% increased Evasion Rating',
    smallStats: { esPct: 0, armourPct: 0, evasionPct: 14 },
    accent: '#4ade80',
    layout: {
      nodes: [
        { i: 0, role: 'socket', slot: 0, dx: 0, dy: 0 },
        { i: 1, role: 'small', slot: 0, dx: 280, dy: -130 },
        { i: 2, role: 'small', slot: 0, dx: 485, dy: -345 },
        { i: 3, role: 'notable', slot: 1, dx: 705, dy: -565 },
        { i: 4, role: 'small', slot: 0, dx: 365, dy: -70 },
        { i: 5, role: 'small', slot: 0, dx: 665, dy: -210 },
        { i: 6, role: 'notable', slot: 2, dx: 995, dy: -175 },
        { i: 7, role: 'small', slot: 0, dx: 335, dy: 80 },
        { i: 8, role: 'small', slot: 0, dx: 655, dy: 30 },
        { i: 9, role: 'notable', slot: 3, dx: 985, dy: 225 },
        { i: 10, role: 'small', slot: 0, dx: 215, dy: 255 },
        { i: 11, role: 'small', slot: 0, dx: 505, dy: 305 },
        { i: 12, role: 'notable', slot: 4, dx: 705, dy: 505 },
      ],
      edges: [
        [0, 1], [1, 2], [2, 3],
        [0, 4], [4, 5], [5, 6],
        [0, 7], [7, 8], [8, 9],
        [0, 10], [10, 11], [11, 12],
      ],
    },
  },
  {
    id: '2491',
    label: 'Lower Left',
    region: 'Marauder / Duelist',
    smallPassiveText: '14% increased Armour',
    smallStats: { esPct: 0, armourPct: 14, evasionPct: 0 },
    accent: '#f87171',
    layout: {
      nodes: [
        { i: 0, role: 'socket', slot: 0, dx: 0, dy: 0 },
        { i: 1, role: 'small', slot: 0, dx: -100, dy: 280 },
        { i: 2, role: 'notable', slot: 1, dx: -370, dy: 390 },
        { i: 3, role: 'small', slot: 0, dx: -650, dy: 485 },
        { i: 4, role: 'small', slot: 0, dx: -770, dy: 750 },
        { i: 5, role: 'notable', slot: 2, dx: -550, dy: 965 },
        { i: 6, role: 'small', slot: 0, dx: -400, dy: 1230 },
        { i: 7, role: 'small', slot: 0, dx: -480, dy: 1510 },
        { i: 8, role: 'small', slot: 0, dx: -180, dy: 1425 },
        { i: 9, role: 'notable', slot: 3, dx: 60, dy: 1595 },
        { i: 10, role: 'small', slot: 0, dx: 365, dy: 1480 },
        { i: 11, role: 'small', slot: 0, dx: 465, dy: 1185 },
        { i: 12, role: 'notable', slot: 4, dx: 335, dy: 910 },
      ],
      edges: [
        [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
        [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12],
      ],
    },
  },
  {
    id: '46882',
    label: 'Lower Right',
    region: 'Ranger / Duelist',
    smallPassiveText: '8% increased Armour; 8% increased Evasion Rating',
    smallStats: { esPct: 0, armourPct: 8, evasionPct: 8 },
    accent: '#a3e635',
    layout: {
      nodes: [
        { i: 0, role: 'socket', slot: 0, dx: 0, dy: 0 },
        { i: 1, role: 'small', slot: 0, dx: -165, dy: 255 },
        { i: 2, role: 'small', slot: 0, dx: -435, dy: 400 },
        { i: 3, role: 'small', slot: 0, dx: -685, dy: 315 },
        { i: 4, role: 'notable', slot: 1, dx: -945, dy: 445 },
        { i: 5, role: 'small', slot: 0, dx: -1235, dy: 400 },
        { i: 6, role: 'notable', slot: 4, dx: -1465, dy: 590 },
        { i: 7, role: 'small', slot: 0, dx: -1145, dy: 685 },
        { i: 8, role: 'notable', slot: 3, dx: -1215, dy: 975 },
        { i: 9, role: 'small', slot: 0, dx: -875, dy: 725 },
        { i: 10, role: 'small', slot: 0, dx: -615, dy: 900 },
        { i: 11, role: 'small', slot: 0, dx: -355, dy: 755 },
        { i: 12, role: 'notable', slot: 2, dx: -60, dy: 735 },
      ],
      edges: [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [4, 5], [5, 6],
        [4, 7], [7, 8],
        [4, 9], [9, 10], [10, 11], [11, 12],
      ],
    },
  },
];

export const OUTER_SOCKET_MAP = new Map(OUTER_SOCKETS.map((s) => [s.id, s]));

/**
 * Computes shortest parent chain from socket (index 0) to every node in a socket layout.
 */
export function getSocketPaths(socketObj) {
  const adj = new Map();
  for (const n of socketObj.layout.nodes) adj.set(n.i, []);
  for (const [u, v] of socketObj.layout.edges) {
    adj.get(u).push(v);
    adj.get(v).push(u);
  }
  const parent = new Map([[0, null]]);
  const dist = new Map([[0, 0]]);
  const q = [0];
  while (q.length > 0) {
    const cur = q.shift();
    for (const nxt of adj.get(cur) || []) {
      if (!parent.has(nxt)) {
        parent.set(nxt, cur);
        dist.set(nxt, dist.get(cur) + 1);
        q.push(nxt);
      }
    }
  }
  return { parent, dist, adj };
}

export const QUICK_FILTER_TAGS = [
  { id: 'all', label: 'All (472)', query: '' },
  { id: 'aura', label: 'Aura / Mana Res', regex: /reservation|aura/i },
  { id: 'charge', label: 'Charges', regex: /endurance|frenzy|power charge/i },
  { id: 'crit', label: 'Crit / Multi', regex: /critical strike/i },
  { id: 'life_es', label: 'Life / ES', regex: /maximum life|maximum energy shield/i },
  { id: 'minion', label: 'Minions', regex: /minion/i },
  { id: 'blighted', label: 'Blight-Only (30)', blightedOnly: true },
];

export function getPoeNinjaOilsUrl(league = 'Covens') {
  const slug = String(league || 'Covens')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  return `https://poe.ninja/poe1/economy/${encodeURIComponent(slug)}/oils`;
}

export function getPoeNinjaOilApiUrl(league = 'Covens') {
  const cleanLeague = String(league || 'Covens').trim() || 'Covens';
  return `https://poe.ninja/poe1/api/economy/exchange/current/overview?league=${encodeURIComponent(cleanLeague)}&type=Oil`;
}

export const DONATE_CONFIG = {
  title: 'Support Putrid Seed Calc',
  message:
    'Putrid Seed Calc is 100% free, ad-free, and has zero paywalls. If the exact oil math saved you Divine Orbs or helped you craft your Mycelium Core, optional tips help keep it updated each league!',
  footnote: 'Every feature stays free forever. Stay sane, Exile!',
  links: [
    {
      id: 'kofi',
      label: 'Support on Ko-fi',
      sublabel: '0% platform fee · Card / Apple Pay / Google Pay',
      url: 'https://ko-fi.com/kanjs',
      accent: 'kofi',
    },
    {
      id: 'buymeacoffee',
      label: 'Buy Me a Coffee',
      sublabel: 'Quick one-time tip',
      url: '', // Add your Buy Me a Coffee URL, e.g. 'https://buymeacoffee.com/yourname'
      accent: 'coffee',
    },
    {
      id: 'paypal',
      label: 'Donate via PayPal',
      sublabel: 'Direct PayPal.me link',
      url: '', // Add your PayPal.me URL, e.g. 'https://paypal.me/yourname'
      accent: 'paypal',
    },
  ],
};
