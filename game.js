'use strict';

// ================= Config =================
const TILE = 40, COLS = 24, ROWS = 15;
const W = COLS * TILE, H = ROWS * TILE;
const START_GOLD = 150, START_LIVES = 20;
const TOTAL_WAVES = 20, MAX_LEVEL = 3;

// Enemy route (tile coords; first/last are off-screen so enemies walk in/out)
const WAYPOINTS_T = [[-1, 7], [5, 7], [5, 2], [11, 2], [11, 12], [17, 12], [17, 7], [24, 7]];
const WAYPOINTS = WAYPOINTS_T.map(p => ({ x: (p[0] + 0.5) * TILE, y: (p[1] + 0.5) * TILE }));

const pathTiles = new Set();
for (let i = 0; i < WAYPOINTS_T.length - 1; i++) {
  let [x, y] = WAYPOINTS_T[i];
  const [x1, y1] = WAYPOINTS_T[i + 1];
  const sx = Math.sign(x1 - x), sy = Math.sign(y1 - y);
  for (;;) {
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) pathTiles.add(x + ',' + y);
    if (x === x1 && y === y1) break;
    x += sx; y += sy;
  }
}

const TOWER_TYPES = {
  arrow:  { name: 'Arrow',  cost: 50,  range: 110, damage: 13, rate: 0.55, color: '#4ade80', projSpeed: 420, desc: 'Fast, cheap single-target' },
  cannon: { name: 'Cannon', cost: 100, range: 125, damage: 34, rate: 1.25, color: '#f59e0b', projSpeed: 260, splash: 55, desc: 'Splash damage, slow fire' },
  frost:  { name: 'Frost',  cost: 75,  range: 100, damage: 5,  rate: 0.8,  color: '#38bdf8', projSpeed: 380, slow: { factor: 0.55, dur: 1.6 }, desc: 'Chills and slows enemies' },
  sniper: { name: 'Sniper', cost: 125, range: 230, damage: 70, rate: 1.9,  color: '#a78bfa', instant: true, desc: 'Long range, high damage' }
};
const TOWER_ORDER = ['arrow', 'cannon', 'frost', 'sniper'];

const ENEMY_TYPES = {
  grunt:  { hp: 60,   speed: 60,  bounty: 8,   color: '#f87171', r: 12 },
  runner: { hp: 40,   speed: 115, bounty: 10,  color: '#fbbf24', r: 9 },
  tank:   { hp: 260,  speed: 36,  bounty: 25,  color: '#94a3b8', r: 15 },
  boss:   { hp: 1600, speed: 30,  bounty: 200, color: '#e879f9', r: 20, boss: true }
};

// ================= State =================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const state = {
  gold: START_GOLD, lives: START_LIVES, wave: 0,
  waveActive: false, intermission: 5, hpScale: 1,
  enemies: [], towers: [], projectiles: [], effects: [],
  spawnQueue: [], spawnTimer: 0,
  buildType: null, selectedTower: null, hover: null,
  paused: false, speed: 1, over: false, won: false, endless: false
};

const el = id => document.getElementById(id);

// ================= Entities =================
class Enemy {
  constructor(type, hpScale) {
    const t = ENEMY_TYPES[type];
    this.type = type;
    this.maxHp = Math.round(t.hp * hpScale);
    this.hp = this.maxHp;
    this.speed = t.speed;
    this.bounty = t.bounty;
    this.color = t.color;
    this.r = t.r;
    this.boss = !!t.boss;
    this.dead = false;
    this.reachedEnd = false;
    this.counted = false;
    this.x = WAYPOINTS[0].x;
    this.y = WAYPOINTS[0].y;
    this.wpt = 1;          // next waypoint index
    this.progress = 0;      // distance travelled (targeting priority)
    this.slowTimer = 0;
    this.slowFactor = 1;
  }

  update(dt) {
    let eff = this.speed;
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      eff *= this.slowFactor;
    }
    let dist = eff * dt;
    while (dist > 0 && this.wpt < WAYPOINTS.length) {
      const wp = WAYPOINTS[this.wpt];
      const dx = wp.x - this.x, dy = wp.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d <= dist) {
        this.x = wp.x; this.y = wp.y;
        this.wpt++;
        dist -= d;
        this.progress += d;
      } else {
        this.x += (dx / d) * dist;
        this.y += (dy / d) * dist;
        this.progress += dist;
        dist = 0;
      }
    }
    if (this.wpt >= WAYPOINTS.length) this.reachedEnd = true;
  }
}

class Tower {
  constructor(type, tx, ty) {
    const t = TOWER_TYPES[type];
    this.type = type;
    this.tx = tx; this.ty = ty;
    this.x = (tx + 0.5) * TILE;
    this.y = (ty + 0.5) * TILE;
    this.level = 1;
    this.spent = t.cost;
    this.cooldown = 0;
    this.angle = 0;
    this.recompute();
  }

  recompute() {
    const t = TOWER_TYPES[this.type];
    const lv = this.level - 1;
    this.damage = Math.round(t.damage * (1 + 0.6 * lv));
    this.range = Math.round(t.range * (1 + 0.09 * lv));
    this.rate = t.rate * (1 - 0.08 * lv);
    this.upgradeCost = this.level < MAX_LEVEL ? Math.round(t.cost * 0.75 * this.level) : null;
  }

  upgrade() {
    if (this.upgradeCost && state.gold >= this.upgradeCost) {
      state.gold -= this.upgradeCost;
      this.spent += this.upgradeCost;
      this.level++;
      this.recompute();
      updateHUD();
    }
  }

  sellValue() { return Math.round(this.spent * 0.7); }

  update(dt) {
    this.cooldown -= dt;
    let best = null;
    for (const e of state.enemies) {
      if (e.dead || e.reachedEnd) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= this.range + e.r) {
        if (!best || e.progress > best.progress) best = e;
      }
    }
    if (best) {
      this.angle = Math.atan2(best.y - this.y, best.x - this.x);
      if (this.cooldown <= 0) {
        this.fire(best);
        this.cooldown = this.rate;
      }
    }
  }

  fire(target) {
    const t = TOWER_TYPES[this.type];
    if (t.instant) {
      damageEnemy(target, this.damage);
      state.effects.push({ type: 'beam', x1: this.x, y1: this.y, x2: target.x, y2: target.y, ttl: 0.12, max: 0.12 });
    } else {
      state.projectiles.push(new Projectile(this, target));
    }
  }
}

class Projectile {
  constructor(tower, target) {
    const t = TOWER_TYPES[tower.type];
    this.x = tower.x; this.y = tower.y;
    this.target = target;
    this.speed = t.projSpeed;
    this.damage = tower.damage;
    this.splash = t.splash || 0;
    this.slow = t.slow || null;
    this.color = t.color;
    this.lastX = target.x;
    this.lastY = target.y;
  }

  update(dt) {
    if (this.target && !this.target.dead && !this.target.reachedEnd) {
      this.lastX = this.target.x;
      this.lastY = this.target.y;
    }
    const dx = this.lastX - this.x, dy = this.lastY - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (d <= step || d === 0) {
      this.hit();
      return true;
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    return false;
  }

  hit() {
    const x = this.lastX, y = this.lastY;
    if (this.splash) {
      state.effects.push({ type: 'explosion', x, y, r: this.splash, ttl: 0.25, max: 0.25 });
      for (const e of state.enemies) {
        if (e.dead || e.reachedEnd) continue;
        if (Math.hypot(e.x - x, e.y - y) <= this.splash + e.r) applyHit(e, this);
      }
    } else if (this.target && !this.target.dead && !this.target.reachedEnd) {
      applyHit(this.target, this);
    }
  }
}

function applyHit(e, proj) {
  damageEnemy(e, proj.damage);
  if (proj.slow) {
    e.slowTimer = Math.max(e.slowTimer, proj.slow.dur);
    e.slowFactor = proj.slow.factor;
  }
}

function damageEnemy(e, dmg) {
  e.hp -= dmg;
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    state.gold += e.bounty;
    state.effects.push({ type: 'text', x: e.x, y: e.y - 10, str: '+' + e.bounty, ttl: 0.8, max: 0.8, color: '#fde047' });
  }
}

// ================= Waves =================
function buildWave(n) {
  const list = [];
  const hpScale = 1 + 0.18 * (n - 1);
  const count = 4 + Math.floor(n * 1.8);
  const gap = Math.max(0.35, 1.1 - n * 0.03);
  for (let i = 0; i < count; i++) {
    let t = 'grunt';
    if (n >= 3 && i % 3 === 2) t = 'runner';
    if (n >= 6 && i % 5 === 4) t = 'tank';
    list.push({ type: t, delay: gap });
  }
  if (n % 5 === 0) list.push({ type: 'boss', delay: 1.5 });
  return { list, hpScale };
}

function startWave() {
  state.wave++;
  const w = buildWave(state.wave);
  state.spawnQueue = w.list.slice();
  state.hpScale = w.hpScale;
  state.spawnTimer = state.spawnQueue.length ? state.spawnQueue[0].delay : 0;
  state.waveActive = true;
}

// ================= Update =================
function update(dt) {
  if (!state.waveActive && !state.over) {
    state.intermission -= dt;
    if (state.intermission <= 0) startWave();
  }

  if (state.spawnQueue.length) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.spawnQueue.length) {
      const s = state.spawnQueue.shift();
      state.enemies.push(new Enemy(s.type, state.hpScale));
      if (state.spawnQueue.length) state.spawnTimer = state.spawnQueue[0].delay;
    }
  }

  for (const e of state.enemies) e.update(dt);
  for (const t of state.towers) t.update(dt);
  state.projectiles = state.projectiles.filter(p => !p.update(dt));

  for (const f of state.effects) {
    f.ttl -= dt;
    if (f.type === 'text') f.y -= 30 * dt;
  }
  state.effects = state.effects.filter(f => f.ttl > 0);

  for (const e of state.enemies) {
    if (e.reachedEnd && !e.counted) {
      e.counted = true;
      state.lives -= e.boss ? 5 : 1;
    }
  }
  state.enemies = state.enemies.filter(e => !e.dead && !e.reachedEnd);

  if (state.waveActive && !state.spawnQueue.length && !state.enemies.length) {
    state.waveActive = false;
    const reward = 25 + state.wave * 5;
    state.gold += reward;
    toast('Wave ' + state.wave + ' cleared! +' + reward + ' gold');
    if (state.wave >= TOTAL_WAVES && !state.endless) {
      state.over = true;
      state.won = true;
      showOverlay('victory');
    } else {
      state.intermission = 12;
    }
  }

  if (state.lives <= 0 && !state.over) {
    state.over = true;
    showOverlay('gameover');
  }
}

// ================= Render =================
function render() {
  // Field
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const isPath = pathTiles.has(tx + ',' + ty);
      ctx.fillStyle = isPath
        ? ((tx + ty) % 2 === 0 ? '#6b4f2a' : '#5f4624')
        : ((tx + ty) % 2 === 0 ? '#166534' : '#15803d');
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }

  // Base marker (end of path)
  const bx = 23 * TILE, by = 7 * TILE;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(bx + 6, by + 6, TILE - 12, TILE - 12);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(bx + TILE / 2 - 2, by + 10, 4, TILE - 20);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BASE', bx + TILE / 2, by + TILE - 9);

  // Towers
  for (const t of state.towers) drawTower(t);

  // Selected tower range
  if (state.selectedTower) {
    const t = state.selectedTower;
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Enemies
  for (const e of state.enemies) drawEnemy(e);

  // Projectiles
  for (const p of state.projectiles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Effects
  for (const f of state.effects) {
    const a = Math.max(0, f.ttl / f.max);
    if (f.type === 'beam') {
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#c4b5fd';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y1);
      ctx.lineTo(f.x2, f.y2);
      ctx.stroke();
    } else if (f.type === 'explosion') {
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#fdba74';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (1.4 - 0.4 * a), 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.type === 'text') {
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color || '#fde047';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.str, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // Build preview
  if (state.hover && state.buildType) {
    const { tx, ty } = state.hover;
    const ok = canPlace(tx, ty) && state.gold >= TOWER_TYPES[state.buildType].cost;
    ctx.fillStyle = ok ? 'rgba(74,222,128,.3)' : 'rgba(248,113,113,.4)';
    ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    if (ok) {
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tx * TILE + TILE / 2, ty * TILE + TILE / 2, TOWER_TYPES[state.buildType].range, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawTower(t) {
  const tt = TOWER_TYPES[t.type];
  // Base
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(t.tx * TILE + 5, t.ty * TILE + 5, TILE - 10, TILE - 10);
  ctx.fillStyle = tt.color;
  ctx.fillRect(t.tx * TILE + 9, t.ty * TILE + 9, TILE - 18, TILE - 18);
  // Barrel
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.angle);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, -3, 17, 6);
  ctx.restore();
  // Hub
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(t.x, t.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tt.color;
  ctx.beginPath();
  ctx.arc(t.x, t.y, 5, 0, Math.PI * 2);
  ctx.fill();
  // Level pips
  for (let i = 0; i < t.level; i++) {
    ctx.fillStyle = '#fde047';
    ctx.fillRect(t.tx * TILE + 5 + i * 6, t.ty * TILE + TILE - 8, 4, 4);
  }
}

function drawEnemy(e) {
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
  ctx.fillStyle = e.color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = e.slowTimer > 0 ? '#bae6fd' : '#0f172a';
  ctx.stroke();
  // HP bar
  const w = e.r * 2;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w, 5);
  const frac = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#f87171';
  ctx.fillRect(e.x - w / 2 + 1, e.y - e.r - 9, (w - 2) * frac, 3);
}

// ================= Placement =================
function canPlace(tx, ty) {
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return false;
  if (pathTiles.has(tx + ',' + ty)) return false;
  return !state.towers.some(t => t.tx === tx && t.ty === ty);
}

function tryPlace(tx, ty) {
  const type = state.buildType;
  if (!type) return;
  if (!canPlace(tx, ty)) { toast('Cannot build there'); return; }
  const cost = TOWER_TYPES[type].cost;
  if (state.gold < cost) { toast('Not enough gold'); return; }
  state.gold -= cost;
  state.towers.push(new Tower(type, tx, ty));
  updateHUD();
}

function sellTower(t) {
  state.gold += t.sellValue();
  state.towers = state.towers.filter(x => x !== t);
  state.selectedTower = null;
  renderTowerInfo();
  updateHUD();
}

// ================= HUD / UI =================
let lastHud = '';

function updateHUD() {
  const sig = [state.gold, state.lives, state.wave, state.waveActive, Math.ceil(state.intermission), state.over].join('|');
  if (sig === lastHud) return;
  lastHud = sig;
  el('gold').textContent = 'Gold ' + state.gold;
  el('lives').textContent = 'Lives ' + Math.max(0, state.lives);
  el('wave').textContent = state.endless
    ? 'Wave ' + state.wave
    : 'Wave ' + state.wave + ' / ' + TOTAL_WAVES;
  const wb = el('wave-btn');
  if (state.over) {
    wb.disabled = true;
    wb.textContent = 'Game Over';
  } else if (state.waveActive) {
    wb.disabled = true;
    wb.textContent = 'Wave ' + state.wave + ' running';
  } else {
    wb.disabled = false;
    wb.textContent = 'Send Wave' + (state.wave > 0 && state.intermission > 0 ? ' (' + Math.ceil(state.intermission) + 's)' : '');
  }
  for (const k of TOWER_ORDER) {
    const c = document.getElementById('card-' + k);
    if (c) c.classList.toggle('locked', state.gold < TOWER_TYPES[k].cost);
  }
}

function buildShop() {
  const shop = el('shop');
  shop.innerHTML = '';
  TOWER_ORDER.forEach((k, i) => {
    const t = TOWER_TYPES[k];
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'card-' + k;
    card.innerHTML =
      '<div class="row1"><span><span class="key">' + (i + 1) + '</span>' + t.name +
      '</span><span class="cost">' + t.cost + 'g</span></div>' +
      '<div class="desc">' + t.desc + '</div>';
    card.addEventListener('click', () => selectBuild(k));
    shop.appendChild(card);
  });
}

function selectBuild(k) {
  if (state.gold < TOWER_TYPES[k].cost) { toast('Not enough gold'); return; }
  state.buildType = state.buildType === k ? null : k;
  state.selectedTower = null;
  renderTowerInfo();
  for (const j of TOWER_ORDER) {
    document.getElementById('card-' + j).classList.toggle('selected', state.buildType === j);
  }
}

function renderTowerInfo() {
  const box = el('tower-info');
  const t = state.selectedTower;
  if (!t) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  box.classList.remove('hidden');
  const tt = TOWER_TYPES[t.type];
  let html =
    '<div class="row1"><strong>' + tt.name + ' Lv.' + t.level + '</strong></div>' +
    '<div class="stats-line"><span>Dmg ' + t.damage + '</span><span>Range ' + t.range + '</span><span>Rate ' + t.rate.toFixed(2) + 's</span></div>';
  if (t.upgradeCost) {
    html += '<button id="up-btn">Upgrade ' + t.upgradeCost + 'g</button>';
  } else {
    html += '<button disabled>Max Level</button>';
  }
  html += '<button id="sell-btn" class="warn">Sell for ' + t.sellValue() + 'g</button>';
  box.innerHTML = html;
  const up = document.getElementById('up-btn');
  if (up) up.addEventListener('click', () => { t.upgrade(); renderTowerInfo(); });
  document.getElementById('sell-btn').addEventListener('click', () => sellTower(t));
}

let toastTimer = null;
function toast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
}

function showOverlay(kind) {
  const o = el('overlay');
  o.classList.remove('hidden');
  if (kind === 'gameover') {
    o.innerHTML = '<h2>Game Over</h2><p>You survived to wave ' + state.wave + '</p><button id="restart-btn">Play Again</button>';
  } else {
    o.innerHTML = '<h2>Victory!</h2><p>You survived all ' + TOTAL_WAVES + ' waves</p>' +
      '<button id="endless-btn">Endless Mode</button><button id="restart-btn">Play Again</button>';
  }
  document.getElementById('restart-btn').addEventListener('click', restart);
  const eb = document.getElementById('endless-btn');
  if (eb) eb.addEventListener('click', () => {
    state.endless = true;
    state.over = false;
    o.classList.add('hidden');
    state.intermission = 12;
    updateHUD();
  });
}

function restart() {
  Object.assign(state, {
    gold: START_GOLD, lives: START_LIVES, wave: 0,
    waveActive: false, intermission: 5, hpScale: 1,
    enemies: [], towers: [], projectiles: [], effects: [],
    spawnQueue: [], spawnTimer: 0,
    buildType: null, selectedTower: null,
    paused: false, speed: 1, over: false, won: false, endless: false
  });
  el('overlay').classList.add('hidden');
  renderTowerInfo();
  el('speed-btn').textContent = 'Speed 1x';
  el('pause-btn').textContent = 'Pause';
  for (const j of TOWER_ORDER) document.getElementById('card-' + j).classList.remove('selected');
  updateHUD();
}

// ================= Input =================
function eventTile(e) {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (W / r.width);
  const y = (e.clientY - r.top) * (H / r.height);
  return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
}

canvas.addEventListener('mousemove', e => { state.hover = eventTile(e); });
canvas.addEventListener('mouseleave', () => { state.hover = null; });

canvas.addEventListener('click', e => {
  if (state.over) return;
  const { tx, ty } = eventTile(e);
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return;
  if (state.buildType) {
    tryPlace(tx, ty);
  } else {
    state.selectedTower = state.towers.find(t => t.tx === tx && t.ty === ty) || null;
    renderTowerInfo();
  }
});

function togglePause() {
  if (state.over) return;
  state.paused = !state.paused;
  el('pause-btn').textContent = state.paused ? 'Resume' : 'Pause';
}

el('wave-btn').addEventListener('click', () => {
  if (state.waveActive || state.over) return;
  if (state.wave > 0 && state.intermission > 0) {
    const bonus = Math.ceil(state.intermission) * 2;
    state.gold += bonus;
    toast('Early bonus +' + bonus + ' gold');
  }
  startWave();
});

el('speed-btn').addEventListener('click', () => {
  state.speed = state.speed === 1 ? 2 : 1;
  el('speed-btn').textContent = 'Speed ' + state.speed + 'x';
});

el('pause-btn').addEventListener('click', togglePause);

document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    togglePause();
  } else if (e.key === 'Escape') {
    state.buildType = null;
    state.selectedTower = null;
    for (const j of TOWER_ORDER) document.getElementById('card-' + j).classList.remove('selected');
    renderTowerInfo();
  } else if (e.key >= '1' && e.key <= '4') {
    selectBuild(TOWER_ORDER[+e.key - 1]);
  }
});

// ================= Loop =================
let last = performance.now();

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!state.paused && !state.over) {
    for (let i = 0; i < state.speed; i++) update(dt);
  }
  render();
  updateHUD();
  requestAnimationFrame(loop);
}

buildShop();
updateHUD();
requestAnimationFrame(loop);
