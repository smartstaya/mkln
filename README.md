# MKLN Tower Defense — Evolution

A deep, browser-based tower defense game. No dependencies, no build step — open `index.html` and play.

## What's New in Evolution

- **3 maps** with different enemy routes, plus **Normal / Hard** difficulty
- **8 towers** including Tesla (chain lightning), Poison (stacking DoT), Beacon (buffs nearby towers) and Mint (generates gold)
- **Elite specs**: at level 3 every tower chooses one of two powerful specializations (chain stun, railgun, napalm ground fire, contagion poison…)
- **8 enemy types**: armored tanks, slow-immune wraiths, healers, regenerating ogres and bosses that self-heal
- **4 targeting modes** per tower: First, Last, Strongest, Closest
- **30 waves** + endless mode, with wave previews and early-send gold bonuses
- **Economy**: wave interest (3%), gold-generating Mints, early wave bonuses
- **Game feel**: particles, screen shake, damage numbers, glowing paths, synthesized sound effects
- **Best-wave tracking** saved locally

## How to Play

Enemies march along the path toward your base. Build towers on the grass to stop them before they get through.

- Click a tower card (or keys **1–8**), then click the map to build
- Click a placed tower to **upgrade** it, cycle **targeting**, and at Lv.3 choose an **elite spec**
- Sell towers for 70% back
- Send the next wave early for bonus gold; leftover gold earns 3% interest each wave
- Wraiths resist physical damage and ignore slows — use energy towers (Tesla, Poison, Frost)
- Armored enemies (tank, brute, boss) reduce physical damage — Piercer arrows and Railguns ignore armor

## Towers

| Tower | Cost | Role |
|-------|------|------|
| Arrow | 50g | Fast single-target |
| Cannon | 110g | Splash damage |
| Frost | 80g | Slows enemies |
| Sniper | 140g | Huge long-range hits |
| Tesla | 130g | Chain lightning |
| Poison | 90g | Stacking damage over time |
| Beacon | 120g | +25% damage to nearby towers |
| Mint | 150g | Generates gold over time |

## Run It

Open `index.html` in any modern browser, or serve locally:

```bash
python3 -m http.server
# then visit http://localhost:8000
```

## Files

- `index.html` — page and layout
- `style.css` — UI styling
- `game.js` — all game logic and rendering
