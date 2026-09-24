# MKLN Tower Defense

A fast, browser-based tower defense game. No dependencies, no build step — just open `index.html` and play.

## How to Play

Enemies march along the path toward your base. Build towers on the grass to stop them before they get through. You start with 150 gold and 20 lives; every enemy that reaches the base costs lives (bosses cost 5).

- Survive **20 waves** to win — then keep going in Endless Mode if you dare.
- Clearing a wave pays a reward, and sending the next wave early pays bonus gold.

## Towers

| Tower | Cost | Strength |
|-------|------|----------|
| Arrow | 50g | Fast, cheap single-target damage |
| Cannon | 100g | Splash damage, slow fire |
| Frost | 75g | Chills and slows enemies |
| Sniper | 125g | Long range, high damage |

Every tower can be upgraded 3 times (click a placed tower). Sell towers for 70% of what you spent.

## Enemies

- **Grunt** — balanced
- **Runner** — fast and fragile
- **Tank** — slow and tanky
- **Boss** — appears every 5th wave

## Controls

- **Click a tower card (or keys 1–4)**, then click the map to build
- **Click a placed tower** to upgrade or sell it
- **Space** — pause/resume
- **Esc** — cancel selection

## Run It

Just open `index.html` in any modern browser. Or serve it locally:

```bash
python3 -m http.server
# then visit http://localhost:8000
```

## Files

- `index.html` — page and layout
- `style.css` — UI styling
- `game.js` — all game logic (canvas rendering, waves, towers, enemies)
