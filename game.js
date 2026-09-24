'use strict';

// ================= Config =================
const TILE = 40, COLS = 24, ROWS = 15;
const W = COLS * TILE, H = ROWS * TILE;
const START_GOLD = 180, START_LIVES = 20;
const TOTAL_WAVES = 30, MAX_LEVEL = 3;
const INTERMISSION = 12, FIRST_INTERMISSION = 6;
const INTEREST_RATE = 0.03, INTEREST_CAP = 75;
const TARGET_MODES = ['first', 'last', 'strong', 'close'];

const MAPS = [
  { name: 'Green Valley', accent: '#4ade80', waypoints: [[-1, 7], [5, 7], [5, 2], [11, 2], [11, 12], [17, 12], [17, 7], [24, 7]] },
  { name: 'Serpent', accent: '#38bdf8', waypoints: [[-1, 3], [4, 3], [4, 11], [9, 11], [9, 3], [14, 3], [14, 11], [19, 11], [19, 7], [24, 7]] },
  { name: 'Crossroads', accent: '#f472b6', waypoints: [[-1, 7], [3, 7], [3, 2], [8, 2], [8, 7], [13, 7], [13, 12], [18, 12], [18, 7], [24, 7]] },
];

const TOWER_TYPES = {
  arrow:   { name: 'Arrow',  cost: 50,  range: 110, damage: 14, rate: 0.5,  color: '#4ade80', projSpeed: 480, kind: 'phys',   desc: 'Fast single-target shots' },
  cannon:  { name: 'Cannon', cost: 110, range: 120, damage: 38, rate: 1.3,  color: '#f59e0b', projSpeed: 280, splash: 55, kind: 'phys', desc: 'Splash damage in an area' },
  frost:   { name: 'Frost',  cost: 80,  range: 105, damage: 6,  rate: 0.75, color: '#38bdf8', projSpeed: 400, slow: { factor: 0.55, dur: 1.8 }, kind: 'energy', desc: 'Chills and slows enemies' },
  sniper:  { name: 'Sniper', cost: 140, range: 240, damage: 85, rate: 2.0,  color: '#a78bfa', instant: true, kind: 'phys', desc: 'Huge long-range hits' },
  tesla:   { name: 'Tesla',  cost: 130, range: 115, damage: 26, rate: 0.9,  color: '#facc15', instant: true, chain: 3, kind: 'energy', desc: 'Lightning that chains between enemies' },
  poison:  { name: 'Poison', cost: 90,  range: 110, damage: 8,  rate: 0.9,  color: '#84cc16', projSpeed: 420, poison: { dps: 14, dur: 3, stacks: 3 }, kind: 'energy', desc: 'Stacks damage over time' },
  support: { name: 'Beacon', cost: 120, range: 125, damage: 0,  rate: 0,    color: '#fb923c', support: { dmg: 0.25 }, kind: 'none', desc: 'Buffs nearby towers +25% dmg' },
  bank:    { name: 'Mint',   cost: 150, range: 0,   damage: 0,  rate: 0,    color: '#fde047', bank: { rate: 3 }, kind: 'none', desc: 'Generates gold over time' },
};
const TOWER_ORDER = ['arrow', 'cannon', 'frost', 'sniper', 'tesla', 'poison', 'support', 'bank'];

const SPECS = {
  arrow:   { a: { name: 'Twin Shot',  desc: 'Fires at two enemies per volley' }, b: { name: 'Piercer', desc: 'Attacks ignore armor' } },
  cannon:  { a: { name: 'Big Blast',  desc: '+60% splash radius' },             b: { name: 'Napalm', desc: 'Leaves burning ground' } },
  frost:   { a: { name: 'Deep Freeze', desc: 'Slow 65%, lasts longer' },        b: { name: 'Blizzard', desc: 'Chills all enemies in an area' } },
  sniper:  { a: { name: 'Deadeye',    desc: '25% chance to crit for 3x' },      b: { name: 'Railgun', desc: 'Pierces every enemy in a line' } },
  tesla:   { a: { name: 'Overcharge', desc: '+3 chain jumps' },                b: { name: 'Stasis', desc: 'Briefly stuns targets' } },
  poison:  { a: { name: 'Virulent',   desc: 'Stronger, 6 stacks' },             b: { name: 'Contagion', desc: 'Poison spreads on death' } },
  support: { a: { name: 'Overclock',  desc: 'Also +20% fire rate' },            b: { name: 'Reach', desc: '+60% aura range' } },
  bank:    { a: { name: 'Compound',   desc: 'Earns 5 gold per second' },        b: { name: 'Vault', desc: '+75 gold now, then 2/s' } },
};

const ENEMY_TYPES = {
  grunt:  { hp: 60,   speed: 60,  bounty: 8,   color: '#f87171', r: 12 },
  runner: { hp: 45,   speed: 120, bounty: 10,  color: '#fbbf24', r: 9 },
  tank:   { hp: 280,  speed: 34,  bounty: 25,  color: '#94a3b8', r: 15, armor: 4 },
  brute:  { hp: 480,  speed: 45,  bounty: 35,  color: '#a8a8b8', r: 17, armor: 2 },
  wraith: { hp: 95,   speed: 75,  bounty: 15,  color: '#c084fc', r: 11, physResist: 0.4, slowImmune: true },
  healer: { hp: 150,  speed: 55,  bounty: 30,  color: '#34d399', r: 13, heal: { radius: 90, amount: 30 } },
  ogre:   { hp: 700,  speed: 30,  bounty: 60,  color: '#fb7185', r: 19, regen: 12, armor: 1 },
  boss:   { hp: 3200, speed: 26,  bounty: 400, color: '#e879f9', r: 22, armor: 6, boss: true, healSelf: 0.02 },
};

// ================= State =================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const el = id => document.getElementById(id);

let WAYPOINTS = [];
let pathTiles = new Set();
let pathList = [];
let spawnTile = null, baseTile = null;
let currentMap = 0;

const state = {
  screen: 'start',
  map: 0, difficulty: 'normal',
  gold: START_GOLD, lives: START_LIVES, wave: 0,
  waveActive: false, intermission: FIRST_INTERMISSION, hpScale: 1,
  enemies: [], towers: [], projectiles: [], effects: [], particles: [], grounds: [],
  spawnQueue: [], spawnTimer: 0,
  buildType: null, selectedTower: null, hover: null,
  paused: false, speed: 1, over: false, won: false, endless: false,
  time: 0, shake: 0,
  dmgNumbers: true, sound: true,
  best: 0
};

try {
  if (typeof localStorage !== 'undefined') {
    state.best = parseInt(localStorage.getItem('mkln_td_best') || '0', 10) || 0;
  }
} catch (e) { /* storage unavailable */ }

// ================= Map =================
function setMap(i) {
  currentMap = i;
  const m = MAPS[i];
  WAYPOINTS = m.waypoints.map(p => ({ x: (p[0] + 0.5) * TILE, y: (p[1] + 0.5) * TILE }));
  pathTiles = new Set();
  pathList = [];
  for (let s = 0; s < m.waypoints.length - 1; s++) {
    let [x, y] = m.waypoints[s];
    const [x1, y1] = m.waypoints[s + 1];
    const sx = Math.sign(x1 - x), sy = Math.sign(y1 - y);
    for (;;) {
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
        pathTiles.add(x + ',' + y);
        pathList.push([x, y]);
      }
      if (x === x1 && y === y1) break;
      x += sx; y += sy;
    }
  }
  spawnTile = pathList[0] ? { x: pathList[0][0], y: pathList[0][1] } : null;
  baseTile = pathList.length ? { x: pathList[pathList.length - 1][0], y: pathList[pathList.length - 1][1] } : null;
}
setMap(0);

// ================= Audio =================
let actx = null;
function ensureAudio() {
  if (actx || !state.sound) return;
  const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  if (AC) { try { actx = new AC(); } catch (e) { actx = null; } }
}
function beep(freq, dur, type, vol, slide) {
  if (!actx || !state.sound) return;
  try {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, actx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), actx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.035, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur + 0.02);
  } catch (e) { /* ignore */ }
}
let lastCoinSfx = 0;
function playSfx(name) {
  if (!state.sound || !actx) return;
  const t = actx.currentTime;
  if (name === 'coin') {
    if (performance.now() - lastCoinSfx < 70) return;
    lastCoinSfx = performance.now();
    beep(880, 0.07, 'sine', 0.03);
    setTimeout(() => beep(1318, 0.09, 'sine', 0.03), 60);
  } else if (name === 'shoot') { beep(660, 0.05, 'square', 0.012, -420); }
  else if (name === 'zap') { beep(980, 0.08, 'sawtooth', 0.02, -600); }
  else if (name === 'boom') { beep(120, 0.22, 'square', 0.05, -80); }
  else if (name === 'leak') { beep(160, 0.3, 'sawtooth', 0.05, -100); }
  else if (name === 'wave') { beep(523, 0.1, 'sine', 0.04); setTimeout(() => beep(659, 0.12, 'sine', 0.04), 90); }
  else if (name === 'win') { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.16, 'sine', 0.05), i * 120)); }
  else if (name === 'lose') { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.2, 'sawtooth', 0.04), i * 140)); }
}

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
    this.armor = t.armor || 0;
    this.physResist = t.physResist || 0;
    this.slowImmune = !!t.slowImmune;
    this.regen = t.regen || 0;
    this.heal = t.heal || null;
    this.healSelf = t.healSelf || 0;
    this.boss = !!t.boss;
    this.dead = false;
    this.reachedEnd = false;
    this.counted = false;
    this.x = WAYPOINTS[0].x;
    this.y = WAYPOINTS[0].y;
    this.wpt = 1;
    this.progress = 0;
    this.dir = 0;
    this.slowTimer = 0;
    this.slowFactor = 1;
    this.stunTimer = 0;
    this.poisonStacks = 0;
    this.poisonTimer = 0;
    this.poisonDps = 0;
    this.wobble = Math.random() * Math.PI * 2;
    this.flash = 0;
  }

  update(dt) {
    this.wobble += dt * 8;
    if (this.flash > 0) this.flash -= dt;
    if (this.stunTimer > 0) { this.stunTimer -= dt; return; }
    if (this.regen > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    if (this.healSelf > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.healSelf * dt);
    if (this.poisonTimer > 0) {
      this.poisonTimer -= dt;
      damageEnemy(this, this.poisonStacks * this.poisonDps * dt, { isDot: true, kind: 'energy' });
      if (this.poisonTimer <= 0) this.poisonStacks = 0;
      if (this.dead) return;
    }
    let eff = this.speed;
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (!this.slowImmune) eff *= this.slowFactor;
    }
    let dist = eff * dt;
    while (dist > 0 && this.wpt < WAYPOINTS.length) {
      const wp = WAYPOINTS[this.wpt];
      const dx = wp.x - this.x, dy = wp.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 0) this.dir = Math.atan2(dy, dx);
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
    this.spec = null;
    this.spent = t.cost;
    this.cooldown = 0;
    this.angle = -Math.PI / 2;
    this.recoil = 0;
    this.mode = 'first';
    this.dmgMult = 1;
    this.rateMult = 1;
    this.recompute();
  }

  recompute() {
    const t = TOWER_TYPES[this.type];
    const lv = this.level - 1;
    this.damage = Math.round(t.damage * (1 + 0.6 * lv));
    this.range = Math.round(t.range * (1 + 0.09 * lv));
    this.rate = t.rate * (1 - 0.08 * lv);
    this.upgradeCost = this.level < MAX_LEVEL ? Math.round(t.cost * 0.8 * this.level) : null;
  }

  upgrade() {
    if (this.upgradeCost && state.gold >= this.upgradeCost) {
      state.gold -= this.upgradeCost;
      this.spent += this.upgradeCost;
      this.level++;
      this.recompute();
      updateHUD();
      return true;
    }
    return false;
  }

  sellValue() { return Math.round(this.spent * 0.7); }

  update(dt) {
    this.recoil = Math.max(0, this.recoil - dt * 5);
    if (this.type === 'support' || this.type === 'bank') return;
    this.cooldown -= dt * this.rateMult;
    let best = null;
    for (const e of state.enemies) {
      if (e.dead || e.reachedEnd) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= this.range + e.r) {
        if (!best) best = e;
        else if (this.mode === 'first' ? e.progress > best.progress
          : this.mode === 'last' ? e.progress < best.progress
          : this.mode === 'strong' ? e.hp > best.hp
          : Math.hypot(e.x - this.x, e.y - this.y) < Math.hypot(best.x - this.x, best.y - this.y)) best = e;
      }
    }
    if (best) {
      this.angle = Math.atan2(best.y - this.y, best.x - this.x);
      if (this.cooldown <= 0) {
        this.fire(best);
        this.cooldown = this.rate;
        this.recoil = 1;
      }
    }
  }

  fire(target) {
    const t = TOWER_TYPES[this.type];
    const dmg = Math.round(this.damage * this.dmgMult);
    if (this.type === 'sniper') {
      if (this.spec === 'b') {
        const dx = target.x - this.x, dy = target.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const ex = this.x + ux * this.range * 1.15, ey = this.y + uy * this.range * 1.15;
        state.effects.push({ type: 'beam', x1: this.x, y1: this.y, x2: ex, y2: ey, ttl: 0.2, max: 0.2, width: 5, color: '#c4b5fd' });
        for (const e of state.enemies) {
          if (e.dead || e.reachedEnd) continue;
          if (pointSegDist(e.x, e.y, this.x, this.y, ex, ey) <= 22 + e.r) {
            damageEnemy(e, dmg, { kind: 'phys', pierce: true });
          }
        }
      } else {
        const crit = this.spec === 'a' && Math.random() < 0.25;
        damageEnemy(target, crit ? dmg * 3 : dmg, { kind: 'phys', crit: crit });
        state.effects.push({ type: 'beam', x1: this.x, y1: this.y, x2: target.x, y2: target.y, ttl: 0.15, max: 0.15, width: crit ? 5 : 2.5, color: '#c4b5fd' });
        if (crit) state.effects.push({ type: 'text', x: target.x, y: target.y - 18, str: 'CRIT', ttl: 0.7, max: 0.7, color: '#f97316', size: 13 });
        playSfx('shoot');
      }
      return;
    }
    if (this.type === 'tesla') {
      this.fireTesla(target, dmg);
      return;
    }
    // projectile towers
    state.projectiles.push(new Projectile(this, target, dmg));
    if (this.type === 'arrow' && this.spec === 'a') {
      let second = null, nd = 1e9;
      for (const e of state.enemies) {
        if (e.dead || e.reachedEnd || e === target) continue;
        const dd = Math.hypot(e.x - target.x, e.y - target.y);
        if (dd < 90 && dd < nd) { nd = dd; second = e; }
      }
      state.projectiles.push(new Projectile(this, second || target, dmg));
    }
    playSfx('shoot');
  }

  fireTesla(target, dmg) {
    let cur = target, d = dmg;
    const jumps = TOWER_TYPES.tesla.chain + (this.spec === 'a' ? 3 : 0);
    const hitList = [target];
    const stun = this.spec === 'b';
    damageEnemy(cur, d, { kind: 'energy' });
    if (stun) cur.stunTimer = Math.max(cur.stunTimer, 0.35);
    state.effects.push({ type: 'arc', x1: this.x, y1: this.y, x2: cur.x, y2: cur.y, ttl: 0.15, max: 0.15 });
    for (let j = 1; j < jumps; j++) {
      let next = null, nd = 1e9;
      for (const e of state.enemies) {
        if (e.dead || e.reachedEnd || hitList.includes(e)) continue;
        const dd = Math.hypot(e.x - cur.x, e.y - cur.y);
        if (dd <= 95 && dd < nd) { nd = dd; next = e; }
      }
      if (!next) break;
      d = Math.max(3, Math.round(d * 0.7));
      damageEnemy(next, d, { kind: 'energy' });
      if (stun) next.stunTimer = Math.max(next.stunTimer, 0.35);
      state.effects.push({ type: 'arc', x1: cur.x, y1: cur.y, x2: next.x, y2: next.y, ttl: 0.15, max: 0.15 });
      hitList.push(next);
      cur = next;
    }
    playSfx('zap');
  }
}

class Projectile {
  constructor(tower, target, damage) {
    const t = TOWER_TYPES[tower.type];
    this.x = tower.x; this.y = tower.y;
    this.target = target;
    this.speed = t.projSpeed;
    this.damage = damage;
    this.kind = t.kind;
    this.color = t.color;
    this.towerType = tower.type;
    this.spec = tower.spec;
    this.lastX = target.x;
    this.lastY = target.y;
    this.px = tower.x; this.py = tower.y;
  }

  update(dt) {
    this.px = this.x; this.py = this.y;
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
    const tt = TOWER_TYPES[this.towerType];

    if (this.towerType === 'cannon') {
      const splash = tt.splash * (this.spec === 'a' ? 1.6 : 1);
      state.effects.push({ type: 'explosion', x, y, r: splash, ttl: 0.3, max: 0.3 });
      spawnBurst(x, y, '#fdba74', 10, 120);
      playSfx('boom');
      for (const e of state.enemies) {
        if (e.dead || e.reachedEnd) continue;
        if (Math.hypot(e.x - x, e.y - y) <= splash + e.r) {
          damageEnemy(e, this.damage, { kind: this.kind, pierce: this.spec === 'b' });
        }
      }
      if (this.spec === 'b') {
        state.grounds.push({ x, y, r: splash * 0.8, ttl: 2.5, max: 2.5, dps: 12 });
      }
      return;
    }

    if (this.target && !this.target.dead && !this.target.reachedEnd) {
      damageEnemy(this.target, this.damage, { kind: this.kind, pierce: this.towerType === 'arrow' && this.spec === 'b' });
      spawnBurst(x, y, this.color, 3, 60);
      if (this.towerType === 'frost') {
        let factor = tt.slow.factor, dur = tt.slow.dur;
        if (this.spec === 'a') { factor = 0.35; dur = 2.4; }
        applySlow(this.target, factor, dur);
        if (this.spec === 'b') {
          state.effects.push({ type: 'explosion', x, y, r: 60, ttl: 0.25, max: 0.25, color: '#7dd3fc' });
          for (const e of state.enemies) {
            if (e.dead || e.reachedEnd || e === this.target) continue;
            if (Math.hypot(e.x - x, e.y - y) <= 60 + e.r) applySlow(e, tt.slow.factor, tt.slow.dur);
          }
        }
      }
      if (this.towerType === 'poison') {
        applyPoison(this.target, tt.poison.dps * (this.spec === 'a' ? 1.5 : 1), tt.poison.dur, this.spec === 'a' ? 6 : tt.poison.stacks);
      }
    }
  }
}

// ================= Damage helpers =================
function pointSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function applySlow(e, factor, dur) {
  if (e.slowImmune) return;
  e.slowTimer = Math.max(e.slowTimer, dur);
  e.slowFactor = factor;
}

function applyPoison(e, dps, dur, maxStacks) {
  if (e.dead) return;
  e.poisonStacks = Math.min(maxStacks, e.poisonStacks + 1);
  e.poisonDps = dps;
  e.poisonTimer = dur;
}

function damageEnemy(e, amount, opts) {
  opts = opts || {};
  if (e.dead) return;
  let a = amount;
  if (opts.kind === 'phys') {
    if (e.physResist) a *= (1 - e.physResist);
    if (!opts.pierce) a = Math.max(1, a - e.armor);
  }
  e.hp -= a;
  if (opts.crit) e.flash = 0.2;
  if (!opts.isDot && state.dmgNumbers) {
    state.effects.push({ type: 'text', x: e.x + (Math.random() * 14 - 7), y: e.y - e.r - 6, str: String(Math.max(1, Math.round(a))), ttl: 0.55, max: 0.55, color: opts.crit ? '#f97316' : '#f8fafc', size: opts.crit ? 13 : 10 });
  }
  if (e.hp <= 0 && !e.dead) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true;
  state.gold += e.bounty;
  if (state.wave > state.best) { state.best = state.wave; saveBest(); }
  state.effects.push({ type: 'text', x: e.x, y: e.y - 14, str: '+' + e.bounty, ttl: 0.8, max: 0.8, color: '#fde047', size: 13 });
  spawnBurst(e.x, e.y, e.color, e.boss ? 30 : 8, e.boss ? 200 : 90);
  if (e.boss) state.shake = Math.max(state.shake, 0.5);
  playSfx('coin');
  // Contagion spec: spread poison on death
  if (e.poisonStacks > 0) {
    for (const o of state.enemies) {
      if (o.dead || o === e) continue;
      if (Math.hypot(o.x - e.x, o.y - e.y) <= 70) applyPoison(o, e.poisonDps, 2.5, 3);
    }
  }
}

function saveBest() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('mkln_td_best', String(state.best)); } catch (e) { /* ignore */ }
}

function spawnBurst(x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, ttl: 0.5 + Math.random() * 0.3, max: 0.7, color, size: 2 + Math.random() * 2.5 });
  }
}

// ================= Waves =================
function buildWave(n) {
  const list = [];
  const count = 4 + Math.floor(n * 1.7);
  const gap = Math.max(0.3, 1.0 - n * 0.025);
  for (let i = 0; i < count; i++) {
    let t = 'grunt';
    const roll = (i * 2654435761) % 100; // deterministic pseudo-random
    if (n >= 4 && i % 3 === 2) t = 'runner';
    if (n >= 6 && i % 5 === 4) t = 'tank';
    if (n >= 8 && roll < 25) t = 'brute';
    if (n >= 10 && i % 7 === 5) t = 'wraith';
    list.push({ type: t, delay: gap });
  }
  const extras = [];
  if (n >= 12) for (let i = 0; i < Math.floor(n / 6); i++) extras.push({ type: 'healer', delay: 2 });
  if (n >= 15) for (let i = 0; i < Math.floor((n - 8) / 5); i++) extras.push({ type: 'ogre', delay: 2.5 });
  if (n % 5 === 0) {
    extras.push({ type: 'boss', delay: 1.8 });
    if (n === TOTAL_WAVES) extras.push({ type: 'boss', delay: 2.5 });
  }
  let hpScale = 1 + 0.13 * (n - 1);
  if (n > TOTAL_WAVES) hpScale *= 1 + 0.06 * (n - TOTAL_WAVES);
  if (state.difficulty === 'hard') hpScale *= 1.25;
  return { list: list.concat(extras), hpScale };
}

function startWave() {
  state.wave++;
  if (state.wave > state.best) { state.best = state.wave; saveBest(); }
  const w = buildWave(state.wave);
  state.spawnQueue = w.list.slice();
  state.hpScale = w.hpScale;
  state.spawnTimer = state.spawnQueue.length ? state.spawnQueue[0].delay : 0;
  state.waveActive = true;
  playSfx('wave');
}

function nextWavePreview() {
  const n = state.wave + 1;
  if (n > TOTAL_WAVES && !state.endless && state.wave > 0) return '';
  if (state.wave === 0 && !state.endless) {
    // still show wave 1 preview
  }
  const w = buildWave(n);
  const counts = {};
  for (const s of w.list) counts[s.type] = (counts[s.type] || 0) + 1;
  const order = ['boss', 'ogre', 'healer', 'wraith', 'brute', 'tank', 'runner', 'grunt'];
  const parts = order.filter(t => counts[t]).map(t => counts[t] + '× ' + t[0].toUpperCase() + t.slice(1));
  const label = n > TOTAL_WAVES ? 'Endless wave ' + n + ': ' : (n === TOTAL_WAVES ? 'FINAL WAVE: ' : 'Next wave (' + n + '/' + TOTAL_WAVES + '): ');
  return label + parts.join(', ');
}

// ================= Update =================
function update(dt) {
  state.time += dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);

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

  // Support auras + bank income
  for (const t of state.towers) { t.dmgMult = 1; t.rateMult = 1; }
  let bankRate = 0;
  for (const t of state.towers) {
    if (t.type === 'support') {
      const aura = t.range * (t.spec === 'b' ? 1.6 : 1);
      for (const o of state.towers) {
        if (o === t || o.type === 'support' || o.type === 'bank') continue;
        if (Math.hypot(o.x - t.x, o.y - t.y) <= aura) {
          o.dmgMult += TOWER_TYPES.support.support.dmg;
          if (t.spec === 'a') o.rateMult += 0.2;
        }
      }
    } else if (t.type === 'bank') {
      bankRate += t.spec === 'a' ? 5 : (t.spec === 'b' ? 2 : TOWER_TYPES.bank.bank.rate);
    }
  }
  if (bankRate > 0) state.gold += bankRate * dt;

  // Enemies (movement, dots, regen)
  for (const e of state.enemies) e.update(dt);

  // Healer auras
  for (const h of state.enemies) {
    if (h.type !== 'healer' || h.dead || h.reachedEnd) continue;
    for (const e of state.enemies) {
      if (e === h || e.dead || e.reachedEnd) continue;
      if (Math.hypot(e.x - h.x, e.y - h.y) <= h.heal.radius) {
        e.hp = Math.min(e.maxHp, e.hp + h.heal.amount * dt);
      }
    }
    if (Math.random() < dt * 1.5) state.effects.push({ type: 'heal', x: h.x, y: h.y, r: h.heal.radius, ttl: 0.5, max: 0.5 });
  }

  // Burning ground (napalm)
  for (const g of state.grounds) {
    g.ttl -= dt;
    for (const e of state.enemies) {
      if (e.dead || e.reachedEnd) continue;
      if (Math.hypot(e.x - g.x, e.y - g.y) <= g.r + e.r) damageEnemy(e, g.dps * dt, { isDot: true, kind: 'energy' });
    }
  }
  state.grounds = state.grounds.filter(g => g.ttl > 0);

  // Towers + projectiles
  for (const t of state.towers) t.update(dt);
  state.projectiles = state.projectiles.filter(p => !p.update(dt));

  // Effects + particles
  for (const f of state.effects) {
    f.ttl -= dt;
    if (f.type === 'text') f.y -= 34 * dt;
  }
  state.effects = state.effects.filter(f => f.ttl > 0);
  for (const p of state.particles) {
    p.ttl -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
  }
  state.particles = state.particles.filter(p => p.ttl > 0);

  // Leaks
  for (const e of state.enemies) {
    if (e.reachedEnd && !e.counted) {
      e.counted = true;
      state.lives -= e.boss ? 5 : 1;
      state.shake = Math.max(state.shake, 0.35);
      state.effects.push({ type: 'flash', ttl: 0.35, max: 0.35 });
      playSfx('leak');
    }
  }
  state.enemies = state.enemies.filter(e => !e.dead && !e.reachedEnd);

  // Wave clear
  if (state.waveActive && !state.spawnQueue.length && !state.enemies.length) {
    state.waveActive = false;
    const reward = 30 + state.wave * 5;
    const interest = Math.min(INTEREST_CAP, Math.floor(state.gold * INTEREST_RATE));
    state.gold += reward + interest;
    toast('Wave ' + state.wave + ' cleared! +' + reward + ' gold' + (interest > 0 ? ', +' + interest + ' interest' : ''));
    if (state.wave >= TOTAL_WAVES && !state.endless) {
      state.over = true;
      state.won = true;
      showOverlay('victory');
      playSfx('win');
    } else {
      state.intermission = INTERMISSION;
    }
  }

  if (state.lives <= 0 && !state.over) {
    state.over = true;
    showOverlay('gameover');
    playSfx('lose');
  }
}

// ================= Render =================
function render() {
  ctx.save();
  if (state.shake > 0) {
    const s = state.shake * 8;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  drawField();

  for (const t of state.towers) drawTower(t);

  if (state.selectedTower) {
    const t = state.selectedTower;
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const e of state.enemies) drawEnemy(e);

  // Projectiles with trails
  for (const p of state.projectiles) {
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.px, p.py);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEffects();
  drawVignette();

  // Build preview
  if (state.hover && state.buildType && state.screen === 'playing') {
    const { tx, ty } = state.hover;
    const ok = canPlace(tx, ty) && state.gold >= TOWER_TYPES[state.buildType].cost;
    ctx.fillStyle = ok ? 'rgba(74,222,128,.3)' : 'rgba(248,113,113,.4)';
    ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    if (ok) {
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(tx * TILE + TILE / 2, ty * TILE + TILE / 2, TOWER_TYPES[state.buildType].range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  ctx.restore();
}

function tileShade(tx, ty) {
  // deterministic per-tile variation
  let h = (tx * 374761393 + ty * 668265263) % 97;
  return h / 97;
}

function drawField() {
  // Grass
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const v = tileShade(tx, ty);
      ctx.fillStyle = 'hsl(' + Math.round(142 + v * 8) + ', ' + Math.round(32 + v * 10) + '%, ' + Math.round(15 + v * 5) + '%)';
      if (pathTiles.has(tx + ',' + ty)) ctx.fillStyle = 'hsl(' + Math.round(26 + v * 6) + ', ' + Math.round(28 + v * 8) + '%, ' + Math.round(24 + v * 6) + '%)';
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,.035)';
  ctx.lineWidth = 1;
  for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * TILE, 0); ctx.lineTo(x * TILE, H); ctx.stroke(); }
  for (let y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * TILE); ctx.lineTo(W, y * TILE); ctx.stroke(); }

  // Path direction chevrons
  const m = MAPS[currentMap];
  for (let s = 0; s < WAYPOINTS.length - 1; s++) {
    const a = WAYPOINTS[s], b = WAYPOINTS[s + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const n = Math.floor(len / 80);
    for (let i = 1; i <= n; i++) {
      const px = a.x + (b.x - a.x) * (i / (n + 1));
      const py = a.y + (b.y - a.y) * (i / (n + 1));
      const pulse = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(state.time * 3 - i * 1.2 + s));
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.strokeStyle = 'rgba(255,255,255,' + pulse.toFixed(3) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-6, -7); ctx.lineTo(4, 0); ctx.lineTo(-6, 7);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Spawn portal
  if (spawnTile) {
    const px = spawnTile.x * TILE + TILE / 2, py = spawnTile.y * TILE + TILE / 2;
    const r = 13 + Math.sin(state.time * 4) * 2;
    ctx.strokeStyle = m.accent;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = m.accent;
    ctx.beginPath(); ctx.arc(px, py, r - 4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Base
  if (baseTile) {
    const bx = baseTile.x * TILE, by = baseTile.y * TILE;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(bx + 6, by + 6, TILE - 12, TILE - 12);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(bx + TILE / 2 - 2, by + 10, 4, TILE - 20);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BASE', bx + TILE / 2, by + TILE - 9);
  }
}

function drawTower(t) {
  const tt = TOWER_TYPES[t.type];
  const cx = t.x, cy = t.y;

  if (t.type === 'support') {
    const aura = t.range * (t.spec === 'b' ? 1.6 : 1);
    ctx.strokeStyle = tt.color;
    ctx.globalAlpha = 0.16 + 0.08 * Math.sin(state.time * 2.5);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, aura, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Base plate
  ctx.fillStyle = '#0b1120';
  ctx.fillRect(t.tx * TILE + 4, t.ty * TILE + 4, TILE - 8, TILE - 8);
  ctx.fillStyle = tt.color;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(t.tx * TILE + 8, t.ty * TILE + 8, TILE - 16, TILE - 16);
  ctx.globalAlpha = 1;

  if (t.type === 'bank') {
    ctx.fillStyle = '#0b1120';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', cx, cy + 5);
  } else {
    // Barrel with recoil
    const rec = t.recoil * 4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t.angle);
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(-rec, -3.5, 18, 7);
    if (t.recoil > 0.55) {
      ctx.fillStyle = 'rgba(255,240,180,' + (t.recoil - 0.55) * 2 + ')';
      ctx.beginPath(); ctx.arc(18 - rec, 0, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Hub
    ctx.fillStyle = '#0b1120';
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tt.color;
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
  }

  // Level pips / spec star
  for (let i = 0; i < t.level; i++) {
    ctx.fillStyle = '#fde047';
    ctx.fillRect(t.tx * TILE + 5 + i * 6, t.ty * TILE + TILE - 8, 4, 4);
  }
  if (t.spec) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('★', t.tx * TILE + TILE - 14, t.ty * TILE + 14);
  }
}

function drawEnemy(e) {
  const wob = 1 + Math.sin(e.wobble) * 0.07;
  const r = e.r * wob;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + e.r * 0.8, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const grad = ctx.createRadialGradient(e.x - r * 0.3, e.y - r * 0.3, r * 0.2, e.x, e.y, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, e.color);
  grad.addColorStop(1, shadeColor(e.color, -35));
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : grad;
  ctx.beginPath();
  ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Armor ring
  if (e.armor > 0) {
    ctx.strokeStyle = 'rgba(203,213,225,.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Eyes facing movement direction
  const ex = Math.cos(e.dir), ey = Math.sin(e.dir);
  ctx.fillStyle = '#0b1120';
  ctx.beginPath();
  ctx.arc(e.x + ex * r * 0.45 - ey * r * 0.3, e.y + ey * r * 0.45 + ex * r * 0.3, 2, 0, Math.PI * 2);
  ctx.arc(e.x + ex * r * 0.45 + ey * r * 0.3, e.y + ey * r * 0.45 - ex * r * 0.3, 2, 0, Math.PI * 2);
  ctx.fill();

  // Boss crown
  if (e.boss) {
    ctx.fillStyle = '#fde047';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(e.x + i * 7 - 3.5, e.y - r - 8);
      ctx.lineTo(e.x + i * 7, e.y - r - 16);
      ctx.lineTo(e.x + i * 7 + 3.5, e.y - r - 8);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Status tints
  if (e.slowTimer > 0 && !e.slowImmune) {
    ctx.strokeStyle = 'rgba(125,211,252,.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r + 3, state.time * 2, state.time * 2 + Math.PI * 1.5);
    ctx.stroke();
  }
  if (e.poisonStacks > 0) {
    ctx.fillStyle = '#84cc16';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(e.poisonStacks), e.x + r + 2, e.y - r);
  }
  if (e.stunTimer > 0) {
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('zZ', e.x, e.y - r - 12);
  }

  // HP bar
  const bw = Math.max(26, r * 2);
  ctx.fillStyle = 'rgba(11,17,32,.9)';
  ctx.fillRect(e.x - bw / 2, e.y - r - 10, bw, 5);
  const frac = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#f87171';
  ctx.fillRect(e.x - bw / 2 + 1, e.y - r - 9, (bw - 2) * frac, 3);
}

function drawEffects() {
  // Burning grounds
  for (const g of state.grounds) {
    const a = 0.25 + 0.15 * Math.sin(state.time * 10 + g.x);
    ctx.fillStyle = 'rgba(249,115,22,' + a.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const f of state.effects) {
    const a = Math.max(0, f.ttl / f.max);
    if (f.type === 'beam' || f.type === 'arc') {
      ctx.globalAlpha = a;
      ctx.strokeStyle = f.color || (f.type === 'arc' ? '#fef08a' : '#c4b5fd');
      ctx.lineWidth = f.width || 2.5;
      if (f.type === 'arc') {
        // jagged lightning
        ctx.beginPath();
        ctx.moveTo(f.x1, f.y1);
        const segs = 4;
        for (let i = 1; i < segs; i++) {
          const t = i / segs;
          const nx = f.x1 + (f.x2 - f.x1) * t + (Math.random() * 12 - 6);
          const ny = f.y1 + (f.y2 - f.y1) * t + (Math.random() * 12 - 6);
          ctx.lineTo(nx, ny);
        }
        ctx.lineTo(f.x2, f.y2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(f.x1, f.y1);
        ctx.lineTo(f.x2, f.y2);
        ctx.stroke();
      }
    } else if (f.type === 'explosion') {
      ctx.globalAlpha = a;
      ctx.strokeStyle = f.color || '#fdba74';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (1.35 - 0.35 * a), 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.type === 'heal') {
      ctx.globalAlpha = a * 0.5;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (1.2 - 0.2 * a), 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.type === 'text') {
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color || '#f8fafc';
      ctx.font = 'bold ' + (f.size || 11) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.str, f.x, f.y);
    } else if (f.type === 'flash') {
      ctx.globalAlpha = a * 0.25;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    ctx.globalAlpha = 1;
  }
  // Particles
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.ttl / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawVignette() {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.4)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function shadeColor(color, amt) {
  // color is #rrggbb
  const num = parseInt(color.slice(1), 16);
  let r = (num >> 16) + amt, g = ((num >> 8) & 0xff) + amt, b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
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
  playSfx('shoot');
  updateHUD();
}

function sellTower(t) {
  state.gold += t.sellValue();
  state.towers = state.towers.filter(x => x !== t);
  state.selectedTower = null;
  renderTowerInfo();
  updateHUD();
}

function tryUpgradeTower(t) {
  if (!t.upgradeCost) return;
  if (state.gold >= t.upgradeCost) {
    t.upgrade();
    spawnBurst(t.x, t.y, '#fde047', 8, 90);
    renderTowerInfo();
  } else {
    toast('Not enough gold');
  }
}

function chooseSpec(t, s) {
  if (t.level < MAX_LEVEL || t.spec) return;
  t.spec = s;
  if (t.type === 'bank' && s === 'b') state.gold += 75;
  spawnBurst(t.x, t.y, '#fbbf24', 14, 120);
  playSfx('coin');
  renderTowerInfo();
  updateHUD();
}

function cycleTargeting(t) {
  const i = TARGET_MODES.indexOf(t.mode);
  t.mode = TARGET_MODES[(i + 1) % TARGET_MODES.length];
  renderTowerInfo();
}

// ================= HUD / UI =================
let lastHud = '';

function updateHUD() {
  const remaining = state.spawnQueue.length + state.enemies.length;
  const sig = [Math.floor(state.gold), state.lives, state.wave, remaining, state.waveActive,
    Math.ceil(state.intermission), state.over, state.best, state.screen].join('|');
  if (sig === lastHud) return;
  lastHud = sig;

  el('gold').textContent = 'Gold ' + Math.floor(state.gold);
  el('lives').textContent = 'Lives ' + Math.max(0, state.lives);
  el('wave').textContent = state.endless
    ? 'Wave ' + state.wave
    : 'Wave ' + state.wave + ' / ' + TOTAL_WAVES + (state.waveActive && remaining ? ' · ' + remaining + ' left' : '');
  el('best').textContent = 'Best ' + state.best;

  const wb = el('wave-btn');
  if (state.screen !== 'playing') {
    wb.disabled = true;
    wb.textContent = 'Send Wave';
  } else if (state.over) {
    wb.disabled = true;
    wb.textContent = 'Game Over';
  } else if (state.waveActive) {
    wb.disabled = true;
    wb.textContent = 'Wave ' + state.wave + ' running';
  } else {
    wb.disabled = false;
    wb.textContent = 'Send Wave' + (state.wave > 0 && state.intermission > 0 ? ' (+' + (Math.ceil(state.intermission) * 3) + 'g)' : '');
  }

  el('next-wave').textContent = state.screen === 'playing' && !state.over ? nextWavePreview() : '';

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
      '<div class="row1"><span><span class="key">' + (i + 1) + '</span>' +
      '<span class="swatch" style="background:' + t.color + '"></span>' + t.name +
      '</span><span class="cost">' + t.cost + 'g</span></div>' +
      '<div class="desc">' + t.desc + '</div>';
    card.addEventListener('click', () => selectBuild(k));
    shop.appendChild(card);
  });
}

function selectBuild(k) {
  if (state.screen !== 'playing') return;
  if (state.gold < TOWER_TYPES[k].cost) { toast('Not enough gold'); return; }
  state.buildType = state.buildType === k ? null : k;
  state.selectedTower = null;
  renderTowerInfo();
  for (const j of TOWER_ORDER) {
    const c = document.getElementById('card-' + j);
    if (c) c.classList.toggle('selected', state.buildType === j);
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
  const specDef = t.spec ? SPECS[t.type][t.spec] : null;

  let html = '<div class="row1"><strong>' + tt.name + ' Lv.' + t.level + '</strong>' +
    (specDef ? ' <span class="spec-name">★ ' + specDef.name + '</span>' : '') + '</div>';

  if (tt.damage > 0) {
    html += '<div class="stats-line"><span>Dmg ' + t.damage + (t.dmgMult > 1 ? ' <b style="color:#fb923c">×' + t.dmgMult.toFixed(2) + '</b>' : '') +
      '</span><span>Range ' + t.range + '</span><span>Rate ' + t.rate.toFixed(2) + 's</span></div>';
    html += '<button id="mode-btn" class="ghost">Target: ' + t.mode + '</button>';
  } else if (t.type === 'support') {
    html += '<div class="stats-line"><span>Aura ' + Math.round(t.range * (t.spec === 'b' ? 1.6 : 1)) + '</span><span>+25% dmg</span>' + (t.spec === 'a' ? '<span>+20% rate</span>' : '') + '</div>';
  } else if (t.type === 'bank') {
    html += '<div class="stats-line"><span>Income ' + (t.spec === 'a' ? 5 : t.spec === 'b' ? 2 : 3) + ' gold/s</span></div>';
  }

  if (t.level >= MAX_LEVEL && !t.spec) {
    const sp = SPECS[t.type];
    html += '<div class="spec-btns">' +
      '<button class="sb" id="spec-a"><strong>★ ' + sp.a.name + '</strong><span class="sd">' + sp.a.desc + '</span></button>' +
      '<button class="sb" id="spec-b"><strong>★ ' + sp.b.name + '</strong><span class="sd">' + sp.b.desc + '</span></button>' +
      '</div>';
  }

  if (t.upgradeCost) {
    html += '<button id="up-btn">Upgrade ' + t.upgradeCost + 'g</button>';
  } else if (t.level >= MAX_LEVEL) {
    html += '<button disabled>' + (t.spec ? 'Elite' : 'Choose a spec') + '</button>';
  }

  html += '<button id="sell-btn" class="warn">Sell for ' + t.sellValue() + 'g</button>';
  box.innerHTML = html;

  const up = document.getElementById('up-btn');
  if (up) up.addEventListener('click', () => tryUpgradeTower(t));
  const mb = document.getElementById('mode-btn');
  if (mb) mb.addEventListener('click', () => cycleTargeting(t));
  const sa = document.getElementById('spec-a');
  if (sa) sa.addEventListener('click', () => chooseSpec(t, 'a'));
  const sb = document.getElementById('spec-b');
  if (sb) sb.addEventListener('click', () => chooseSpec(t, 'b'));
  document.getElementById('sell-btn').addEventListener('click', () => sellTower(t));
}

let toastTimer = null;
function toast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

// ================= Screens =================
function showOverlay(kind) {
  const o = el('overlay');
  o.classList.remove('hidden');
  if (kind === 'gameover') {
    o.innerHTML = '<h2>Game Over</h2><p>You survived to wave ' + state.wave + ' · Best: ' + state.best + '</p>' +
      '<div class="row"><button id="restart-btn">Play Again</button><button id="menu-btn" class="ghost">Main Menu</button></div>';
  } else if (kind === 'victory') {
    o.innerHTML = '<h2>Victory!</h2><p>You survived all ' + TOTAL_WAVES + ' waves</p>' +
      '<div class="row"><button id="endless-btn" class="gold">Endless Mode</button><button id="restart-btn">Play Again</button><button id="menu-btn" class="ghost">Main Menu</button></div>';
  }
  const rb = document.getElementById('restart-btn');
  if (rb) rb.addEventListener('click', () => startGame(state.map, state.difficulty));
  const mb = document.getElementById('menu-btn');
  if (mb) mb.addEventListener('click', toMenu);
  const eb = document.getElementById('endless-btn');
  if (eb) eb.addEventListener('click', () => {
    state.endless = true;
    state.over = false;
    o.classList.add('hidden');
    state.intermission = INTERMISSION;
    updateHUD();
  });
}

function drawMapPreview(cv, mapIdx) {
  const c2 = cv.getContext('2d');
  const m = MAPS[mapIdx];
  const sx = cv.width / W, sy = cv.height / H;
  c2.fillStyle = '#122a1a';
  c2.fillRect(0, 0, cv.width, cv.height);
  // path polyline
  c2.strokeStyle = '#6b4f2a';
  c2.lineWidth = TILE * Math.min(sx, sy) * 0.9;
  c2.lineCap = 'round';
  c2.lineJoin = 'round';
  c2.beginPath();
  m.waypoints.forEach((p, i) => {
    const x = (p[0] + 0.5) * TILE * sx, y = (p[1] + 0.5) * TILE * sy;
    if (i === 0) c2.moveTo(x, y); else c2.lineTo(x, y);
  });
  c2.stroke();
  c2.strokeStyle = m.accent;
  c2.lineWidth = 2;
  c2.stroke();
  // entry arrow
  const p0 = m.waypoints[0], p1 = m.waypoints[1];
  const ax = (p1[0] + 0.5) * TILE * sx, ay = (p1[1] + 0.5) * TILE * sy;
  c2.fillStyle = m.accent;
  c2.beginPath();
  c2.arc(ax, ay, 4, 0, Math.PI * 2);
  c2.fill();
}

function showStartScreen() {
  state.screen = 'start';
  state.paused = false;
  const o = el('overlay');
  o.classList.remove('hidden');
  o.innerHTML =
    '<h2>MKLN Tower Defense</h2>' +
    '<p>Pick a battlefield · Best wave: ' + state.best + '</p>' +
    '<div class="map-cards" id="map-cards"></div>' +
    '<div class="row"><button id="diff-btn" class="ghost">Difficulty: Normal</button></div>' +
    '<div class="row"><button id="start-btn">Start Game</button></div>';

  const cards = document.getElementById('map-cards');
  MAPS.forEach((m, i) => {
    const card = document.createElement('div');
    card.className = 'map-card' + (i === state.map ? ' selected' : '');
    const cv = document.createElement('canvas');
    cv.width = 210; cv.height = 130;
    card.appendChild(cv);
    const nm = document.createElement('div');
    nm.className = 'map-name';
    nm.textContent = m.name;
    card.appendChild(nm);
    card.addEventListener('click', () => {
      state.map = i;
      const all = cards.querySelectorAll('.map-card');
      for (const c of all) c.classList.remove('selected');
      card.classList.add('selected');
    });
    cards.appendChild(card);
    drawMapPreview(cv, i);
  });

  document.getElementById('diff-btn').addEventListener('click', e => {
    state.difficulty = state.difficulty === 'normal' ? 'hard' : 'normal';
    e.target.textContent = 'Difficulty: ' + (state.difficulty === 'normal' ? 'Normal' : 'Hard (+25% enemy HP)');
  });
  document.getElementById('start-btn').addEventListener('click', () => startGame(state.map, state.difficulty));
  updateHUD();
}

function startGame(mapIdx, diff) {
  state.screen = 'playing';
  state.map = mapIdx;
  state.difficulty = diff || state.difficulty;
  setMap(mapIdx);
  state.gold = state.difficulty === 'hard' ? 140 : START_GOLD;
  state.lives = state.difficulty === 'hard' ? 15 : START_LIVES;
  state.wave = 0;
  state.waveActive = false;
  state.intermission = FIRST_INTERMISSION;
  state.hpScale = 1;
  state.enemies = [];
  state.towers = [];
  state.projectiles = [];
  state.effects = [];
  state.particles = [];
  state.grounds = [];
  state.spawnQueue = [];
  state.spawnTimer = 0;
  state.buildType = null;
  state.selectedTower = null;
  state.hover = null;
  state.paused = false;
  state.speed = 1;
  state.over = false;
  state.won = false;
  state.endless = false;
  state.shake = 0;

  el('overlay').classList.add('hidden');
  el('speed-btn').textContent = 'Speed 1x';
  el('pause-btn').textContent = 'Pause';
  for (const j of TOWER_ORDER) {
    const c = document.getElementById('card-' + j);
    if (c) c.classList.remove('selected');
  }
  renderTowerInfo();
  updateHUD();

  // Enter fullscreen automatically when a game starts (user-gesture context)
  enterFullscreen();
}

function toMenu() {
  showStartScreen();
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
  ensureAudio();
  if (state.over || state.screen !== 'playing') return;
  const { tx, ty } = eventTile(e);
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return;
  if (state.buildType) {
    tryPlace(tx, ty);
  } else {
    state.selectedTower = state.towers.find(t => t.tx === tx && t.ty === ty) || null;
    renderTowerInfo();
  }
});

document.addEventListener('pointerdown', ensureAudio);

// ================= Fullscreen =================
function enterFullscreen() {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) return;
  const root = d.documentElement;
  if (!root) return;
  const req = root.requestFullscreen || root.webkitRequestFullscreen;
  if (req) {
    try {
      const p = req.call(root);
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  }
}

function exitFullscreen() {
  const d = document;
  const exit = d.exitFullscreen || d.webkitExitFullscreen;
  if (exit) {
    try {
      const p = exit.call(d);
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  }
}

function toggleFullscreen() {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) exitFullscreen();
  else enterFullscreen();
}

function updateFsBtn() {
  const d = document;
  const isFs = !!(d.fullscreenElement || d.webkitFullscreenElement);
  const b = el('fs-btn');
  if (b) b.textContent = isFs ? 'Exit Fullscreen' : 'Fullscreen';
}

document.addEventListener('fullscreenchange', updateFsBtn);
document.addEventListener('webkitfullscreenchange', updateFsBtn);
el('fs-btn').addEventListener('click', toggleFullscreen);

function togglePause() {
  if (state.over || state.screen !== 'playing') return;
  state.paused = !state.paused;
  el('pause-btn').textContent = state.paused ? 'Resume' : 'Pause';
}

el('wave-btn').addEventListener('click', () => {
  if (state.waveActive || state.over || state.screen !== 'playing') return;
  if (state.wave > 0 && state.intermission > 0) {
    const bonus = Math.ceil(state.intermission) * 3;
    state.gold += bonus;
    toast('Early bonus +' + bonus + ' gold');
  }
  startWave();
  updateHUD();
});

el('speed-btn').addEventListener('click', () => {
  state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 4 : 1;
  el('speed-btn').textContent = 'Speed ' + state.speed + 'x';
});

el('pause-btn').addEventListener('click', togglePause);

el('sound-btn').addEventListener('click', () => {
  state.sound = !state.sound;
  el('sound-btn').textContent = 'Sound: ' + (state.sound ? 'On' : 'Off');
  if (state.sound) ensureAudio();
});

document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    togglePause();
  } else if (e.key === 'Escape') {
    state.buildType = null;
    state.selectedTower = null;
    for (const j of TOWER_ORDER) {
      const c = document.getElementById('card-' + j);
      if (c) c.classList.remove('selected');
    }
    renderTowerInfo();
  } else if (e.key >= '1' && e.key <= '8') {
    selectBuild(TOWER_ORDER[+e.key - 1]);
  } else if (e.key === 'f' || e.key === 'F') {
    toggleFullscreen();
  }
});

// ================= Loop =================
let last = performance.now();

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (state.screen === 'playing' && !state.paused && !state.over) {
    for (let i = 0; i < state.speed; i++) update(dt);
  } else {
    state.time += dt; // keep animations alive on menus
  }
  render();
  updateHUD();
  requestAnimationFrame(loop);
}

buildShop();
showStartScreen();
requestAnimationFrame(loop);
