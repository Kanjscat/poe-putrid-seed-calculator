# PoE 3.30 Putrid Seed Calculator & Passive Tree Explorer

**Live Tool:** [https://kanjscat.github.io/poe-putrid-seed-calculator/](https://kanjscat.github.io/poe-putrid-seed-calculator/)

Interactive Path of Exile **3.30.0 (*Covens of Umbra*)** **Putrid Seed** (*Mycelium Core*) calculator, oil optimizer, Sister Cassia simulator, and passive skill tree explorer.

---

## Features

- **3.30.0 Passive Skill Tree Canvas:** High-DPI HTML5 Canvas rendering GGG's curved orbital passive tree with official PoE icons and frames for all **472 anointable notables** (`442` standard notables + `30` hidden Blight-exclusive notables such as *Adaptive Steel*), emerald in-pool rings, violet hidden-anoint rings, target highlights, cyan rolled-hit rings with `1–4` slot badges, and Oil recipe badges.
- **Exact 364 Three-Oil Optimizer:** Evaluates all $\binom{14}{3} = 364$ valid Sister Cassia 3-oil combinations using the verified **Per-Oil Max-Tier Bucket** model (`exact_tier_bucket`) calibrated across live `Covens` Trade listings:
  - Each of the 4 grown passive slots independently selects one of your 3 chosen oils ($1/3$ chance each) and draws uniformly without replacement from notables whose highest recipe oil equals that oil (`maxTier == oil`).
  - Explains why recipes containing **Clear Oil** (bucket size `1`: *Indiscriminate Revenge*) or **Sepia Oil** (bucket size `3`) can exhaust their bucket and roll `1–3` enchantments instead of `4`.
- **30 Hidden Blight-Exclusive Anointments:** Bottom drawer and on-tree canvas nodes for all 30 `Prismatic Oil` hidden notables.
- **Cassia Anoint Simulator & Auto-Roller:** Test single anointments or auto-roll until hitting your desired target count to track attempts and Chaos spent.
- **PoE Trade & Path of Building Integration:** Generates official `pathofexile.com/trade` queries (`enchant.stat_3599615742|<id>`) with optional bricked `Mycelium Core` base support, plus one-click Path of Building custom jewel export.
- **Multi-League Oil Pricing:** Supports `Covens`, `Hardcore Covens`, `Ruthless Covens`, `Standard`, and `Hardcore` with automated `poe.ninja` snapshots, custom price edits saved in `localStorage`, and quick JSON import.
