import {
  GameState, Player, Enemy, DungeonRoom, Dungeon, Door, Trap,
  Vector2, HeroClass, HERO_CONFIGS, EnemyType, WeaponRarity,
  generateWeapon, RARITY_COLORS, EFFECT_COLORS, ShopItem,
} from './types';

const TILE = 32;
const ROOM_W = 800;
const ROOM_H = 600;

// ── Helpers ──

function dist(a: Vector2, b: Vector2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function normalize(v: Vector2): Vector2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function aabbCollision(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function spawnParticles(state: GameState, pos: Vector2, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 150;
    state.particles.push({
      pos: { x: pos.x, y: pos.y },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      lifetime: 0.3 + Math.random() * 0.4,
      maxLifetime: 0.7,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function spawnDamageNumber(state: GameState, pos: Vector2, value: number, color: string, isCrit = false, text?: string) {
  state.damageNumbers.push({
    pos: { x: pos.x + (Math.random() - 0.5) * 20, y: pos.y - 10 },
    value, lifetime: 0.8, color, isCrit, text,
  });
}

function notify(state: GameState, text: string, color: string) {
  state.notification = { text, timer: 2.5, color };
}

// ── Enemy Creation ──

function createEnemy(type: EnemyType, x: number, y: number, tierMul = 1): Enemy {
  const configs: Record<EnemyType, {
    hp: number; speed: number; damage: number; size: number;
    xp: number; gold: number; isRanged: boolean; shootCd: number;
  }> = {
    goblin:     { hp: 30, speed: 100, damage: 8,  size: 18, xp: 15,  gold: 5,   isRanged: false, shootCd: 0 },
    skeleton:   { hp: 50, speed: 80,  damage: 12, size: 20, xp: 25,  gold: 8,   isRanged: false, shootCd: 0 },
    orc:        { hp: 90, speed: 60,  damage: 20, size: 26, xp: 40,  gold: 15,  isRanged: false, shootCd: 0 },
    necromancer:{ hp: 45, speed: 70,  damage: 15, size: 20, xp: 35,  gold: 12,  isRanged: true,  shootCd: 1.5 },
    boss:       { hp: 400,speed: 45,  damage: 30, size: 38, xp: 250, gold: 120, isRanged: true,  shootCd: 2 },
  };
  const c = configs[type];
  return {
    pos: { x, y }, vel: { x: 0, y: 0 },
    width: c.size, height: c.size,
    hp: Math.floor(c.hp * tierMul), maxHp: Math.floor(c.hp * tierMul),
    alive: true,
    speed: c.speed, baseSpeed: c.speed, damage: Math.floor(c.damage * tierMul),
    attackCooldown: 1, attackTimer: 0,
    state: 'idle', type,
    knockbackTimer: 0, flashTimer: 0,
    xpValue: Math.floor(c.xp * tierMul), goldValue: Math.floor(c.gold * tierMul),
    isRanged: c.isRanged,
    shootCooldown: c.shootCd, shootTimer: c.shootCd,
    statusEffects: [],
    phase: type === 'boss' ? 1 : undefined,
    phaseHP: type === 'boss' ? Math.floor(c.hp * tierMul * 0.5) : undefined,
  };
}

// ── Trap Creation ──

function createTrap(type: Trap['type'], x: number, y: number, dir?: Vector2): Trap {
  const configs: Record<Trap['type'], { w: number; h: number; damage: number; cd: number }> = {
    spikes:         { w: 28, h: 28, damage: 15, cd: 2 },
    arrow_launcher: { w: 20, h: 20, damage: 12, cd: 1.5 },
    fire_vent:      { w: 32, h: 32, damage: 20, cd: 3 },
  };
  const c = configs[type];
  return {
    pos: { x, y }, width: c.w, height: c.h,
    type, damage: c.damage, cooldown: c.cd, timer: Math.random() * c.cd,
    active: false, direction: dir,
  };
}

// ── Dungeon Generation ──

function generateDungeonRoom(
  id: number, gridX: number, gridY: number,
  type: DungeonRoom['type'], tier: number, theme: DungeonRoom['theme'],
): DungeonRoom {
  const walls: DungeonRoom['walls'] = [];
  walls.push({ x: 0, y: 0, w: ROOM_W, h: TILE });
  walls.push({ x: 0, y: ROOM_H - TILE, w: ROOM_W, h: TILE });
  walls.push({ x: 0, y: 0, w: TILE, h: ROOM_H });
  walls.push({ x: ROOM_W - TILE, y: 0, w: TILE, h: ROOM_H });

  const enemies: Enemy[] = [];
  const traps: Trap[] = [];
  const tierMul = 1 + (tier - 1) * 0.4;

  if (type === 'combat') {
    // Interior walls
    const numWalls = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numWalls; i++) {
      const ox = TILE * 3 + Math.random() * (ROOM_W - TILE * 8);
      const oy = TILE * 3 + Math.random() * (ROOM_H - TILE * 8);
      walls.push({ x: ox, y: oy, w: TILE * 2, h: TILE });
    }

    // Enemies
    const count = 4 + tier * 2 + Math.floor(Math.random() * 3);
    const types: EnemyType[] = tier < 2
      ? ['goblin', 'goblin', 'skeleton']
      : tier < 3
        ? ['goblin', 'skeleton', 'orc', 'necromancer']
        : ['skeleton', 'orc', 'necromancer', 'necromancer'];

    for (let i = 0; i < count; i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      const ex = TILE * 3 + Math.random() * (ROOM_W - TILE * 6);
      const ey = TILE * 3 + Math.random() * (ROOM_H - TILE * 6);
      enemies.push(createEnemy(t, ex, ey, tierMul));
    }

    // Traps
    const numTraps = Math.min(tier, 4);
    for (let i = 0; i < numTraps; i++) {
      const tx = TILE * 3 + Math.random() * (ROOM_W - TILE * 6);
      const ty = TILE * 3 + Math.random() * (ROOM_H - TILE * 6);
      const trapTypes: Trap['type'][] = theme === 'fortress' ? ['fire_vent', 'arrow_launcher'] : ['spikes', 'arrow_launcher'];
      const tt = trapTypes[Math.floor(Math.random() * trapTypes.length)];
      const dir = tt === 'arrow_launcher'
        ? normalize({ x: Math.random() - 0.5, y: Math.random() - 0.5 })
        : undefined;
      traps.push(createTrap(tt, tx, ty, dir));
    }
  } else if (type === 'boss') {
    enemies.push(createEnemy('boss', ROOM_W / 2, ROOM_H / 3, tierMul));
    // Fire vents around arena
    traps.push(createTrap('fire_vent', 150, 150));
    traps.push(createTrap('fire_vent', ROOM_W - 150, 150));
    traps.push(createTrap('fire_vent', 150, ROOM_H - 150));
    traps.push(createTrap('fire_vent', ROOM_W - 150, ROOM_H - 150));
  } else if (type === 'treasure') {
    // No enemies, just walls forming a vault shape
    walls.push({ x: ROOM_W / 2 - TILE * 3, y: ROOM_H / 2 - TILE, w: TILE * 6, h: TILE });
    walls.push({ x: ROOM_W / 2 - TILE * 3, y: ROOM_H / 2 + TILE, w: TILE * 6, h: TILE });
  }

  return {
    id, gridX, gridY, width: ROOM_W, height: ROOM_H,
    walls, enemies, traps, cleared: type === 'start' || type === 'treasure' || type === 'shop',
    doors: [], visited: type === 'start',
    type, theme,
  };
}

function generateDungeon(tier: number): Dungeon {
  const themes: DungeonRoom['theme'][] = ['cave', 'crypt', 'fortress', 'shadow'];
  const theme = themes[Math.min(tier - 1, 3)];

  // Generate a grid layout: start → 3-5 combat rooms → boss
  const numCombat = 3 + Math.floor(Math.random() * 3);
  const rooms: DungeonRoom[] = [];

  // Start room
  rooms.push(generateDungeonRoom(0, 0, 0, 'start', tier, theme));

  // Combat rooms in a line with occasional branches
  let cx = 1;
  let cy = 0;
  for (let i = 0; i < numCombat; i++) {
    const type = (i === Math.floor(numCombat / 2)) ? 'treasure' : 'combat';
    rooms.push(generateDungeonRoom(rooms.length, cx, cy, type, tier, theme));
    cx++;
  }

  // Shop room as a branch
  rooms.push(generateDungeonRoom(rooms.length, Math.floor(numCombat / 2) + 1, 1, 'shop', tier, theme));

  // Boss room
  rooms.push(generateDungeonRoom(rooms.length, cx, cy, 'boss', tier, theme));

  // Connect rooms with doors
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    // Find adjacent rooms
    for (let j = 0; j < rooms.length; j++) {
      if (i === j) continue;
      const o = rooms[j];
      const dx = o.gridX - r.gridX;
      const dy = o.gridY - r.gridY;
      if (Math.abs(dx) + Math.abs(dy) !== 1) continue;

      let dir: Door['direction'];
      let doorX: number, doorY: number;
      if (dx === 1) { dir = 'e'; doorX = ROOM_W - TILE; doorY = ROOM_H / 2 - 16; }
      else if (dx === -1) { dir = 'w'; doorX = 0; doorY = ROOM_H / 2 - 16; }
      else if (dy === 1) { dir = 's'; doorX = ROOM_W / 2 - 16; doorY = ROOM_H - TILE; }
      else { dir = 'n'; doorX = ROOM_W / 2 - 16; doorY = 0; }

      // Check if door already exists
      if (!r.doors.find(d => d.direction === dir)) {
        r.doors.push({
          x: doorX, y: doorY, width: 32, height: 32,
          direction: dir, locked: !r.cleared, targetRoom: j,
        });
      }
    }
  }

  return { rooms, currentRoomId: 0, tier };
}

// ── Loot ──

function spawnLoot(state: GameState, pos: Vector2, goldValue: number, tier: number) {
  state.loot.push({
    pos: { x: pos.x + (Math.random() - 0.5) * 30, y: pos.y + (Math.random() - 0.5) * 30 },
    type: 'gold', value: goldValue, rarity: 'common', lifetime: 20, bobOffset: Math.random() * Math.PI * 2,
  });

  if (Math.random() < 0.25) {
    state.loot.push({
      pos: { x: pos.x + (Math.random() - 0.5) * 30, y: pos.y + (Math.random() - 0.5) * 30 },
      type: 'health', value: 20 + tier * 5, rarity: 'common', lifetime: 20, bobOffset: Math.random() * Math.PI * 2,
    });
  }

  if (Math.random() < 0.08) {
    state.loot.push({
      pos: { x: pos.x + (Math.random() - 0.5) * 30, y: pos.y + (Math.random() - 0.5) * 30 },
      type: 'mana', value: 15 + tier * 5, rarity: 'common', lifetime: 20, bobOffset: Math.random() * Math.PI * 2,
    });
  }

  // Weapon drop
  const weaponChance = tier < 2 ? 0.08 : tier < 3 ? 0.1 : 0.12;
  if (Math.random() < weaponChance) {
    const roll = Math.random();
    const rarity: WeaponRarity = roll < 0.55 ? 'common' : roll < 0.85 ? 'rare' : roll < 0.97 ? 'epic' : 'legendary';
    const weapon = generateWeapon(rarity);
    state.loot.push({
      pos: { x: pos.x + (Math.random() - 0.5) * 20, y: pos.y + (Math.random() - 0.5) * 20 },
      type: 'weapon', value: 0, rarity, lifetime: 30, bobOffset: Math.random() * Math.PI * 2,
      weapon,
    });
  }
}

// ── Shop ──

function generateShopItems(tier: number): ShopItem[] {
  const items: ShopItem[] = [];
  for (let i = 0; i < 3; i++) {
    const roll = Math.random();
    const rarity: WeaponRarity = roll < 0.3 ? 'common' : roll < 0.7 ? 'rare' : roll < 0.95 ? 'epic' : 'legendary';
    const weapon = generateWeapon(rarity);
    const prices: Record<WeaponRarity, number> = { common: 30, rare: 80, epic: 200, legendary: 500 };
    items.push({ weapon, price: prices[rarity] + tier * 20, sold: false });
  }
  // Add health potion
  return items;
}

// ── Player Creation ──

function createPlayer(heroClass: HeroClass): Player {
  const cfg = HERO_CONFIGS[heroClass];
  return {
    pos: { x: ROOM_W / 2, y: ROOM_H / 2 },
    vel: { x: 0, y: 0 },
    width: 24, height: 24,
    hp: cfg.hp, maxHp: cfg.hp, alive: true,
    speed: cfg.speed,
    attackCooldown: cfg.attackSpeed, attackTimer: 0,
    attackDamage: cfg.damage, attackRange: cfg.attackRange,
    facing: { x: 1, y: 0 },
    isAttacking: false, attackAnimTimer: 0,
    iFrames: 0,
    xp: 0, xpToNext: 100, level: 1, gold: 0,
    mana: cfg.mana, maxMana: cfg.mana,
    heroClass,
    abilityTimer: 0, abilityCooldown: 3,
    weapon: { ...cfg.startWeapon },
    inventory: [],
    statusEffects: [],
    killCount: 0,
  };
}

// ── Init ──

export function initGameState(heroClass: HeroClass): GameState {
  const dungeon = generateDungeon(1);
  const room = dungeon.rooms[0];
  return {
    player: createPlayer(heroClass),
    enemies: [...room.enemies],
    projectiles: [],
    particles: [],
    loot: [],
    damageNumbers: [],
    traps: [...room.traps],
    dungeon,
    room,
    keys: new Set(),
    mouse: { x: 0, y: 0 },
    mouseDown: false,
    screenShake: 0,
    roomsCleared: 0,
    wave: dungeon.tier,
    waveTimer: 0,
    gameOver: false,
    paused: false,
    transitionTimer: 0,
    transitionDirection: null,
    showInventory: false,
    shopItems: [],
    showShop: false,
    notification: null,
    time: 0,
  };
}

// ── Status Effects ──

function applyStatusEffect(target: { statusEffects: { type: string; duration: number; tickTimer: number; damage: number }[] }, type: 'burn' | 'freeze' | 'poison', damage: number) {
  const existing = target.statusEffects.find(s => s.type === type);
  if (existing) {
    existing.duration = Math.max(existing.duration, type === 'freeze' ? 1.5 : 3);
  } else {
    target.statusEffects.push({ type, duration: type === 'freeze' ? 1.5 : 3, tickTimer: 0.5, damage });
  }
}

function updateStatusEffects(entity: { statusEffects: { type: string; duration: number; tickTimer: number; damage: number }[]; hp: number; pos: Vector2; speed?: number; baseSpeed?: number }, dt: number, state: GameState) {
  for (let i = entity.statusEffects.length - 1; i >= 0; i--) {
    const se = entity.statusEffects[i];
    se.duration -= dt;
    se.tickTimer -= dt;

    if (se.type === 'freeze' && 'baseSpeed' in entity && entity.baseSpeed) {
      (entity as Enemy).speed = (entity as Enemy).baseSpeed * 0.3;
    }

    if (se.tickTimer <= 0 && (se.type === 'burn' || se.type === 'poison')) {
      se.tickTimer = 0.5;
      entity.hp -= se.damage;
      const color = se.type === 'burn' ? '#e74c3c' : '#51cf66';
      spawnParticles(state, entity.pos, color, 2);
      spawnDamageNumber(state, entity.pos, se.damage, color);
    }

    if (se.duration <= 0) {
      if (se.type === 'freeze' && 'baseSpeed' in entity && entity.baseSpeed) {
        (entity as Enemy).speed = (entity as Enemy).baseSpeed;
      }
      entity.statusEffects.splice(i, 1);
    }
  }
}

// ── Room Transition ──

function transitionToRoom(state: GameState, targetRoomId: number, direction: Door['direction']) {
  const room = state.dungeon.rooms[targetRoomId];
  state.dungeon.currentRoomId = targetRoomId;
  room.visited = true;
  state.room = room;
  state.enemies = [...room.enemies];
  state.traps = [...room.traps];
  state.projectiles = [];
  state.loot = [];

  // Position player at opposite door
  const p = state.player;
  if (direction === 'e') { p.pos.x = TILE * 2; p.pos.y = ROOM_H / 2; }
  else if (direction === 'w') { p.pos.x = ROOM_W - TILE * 2; p.pos.y = ROOM_H / 2; }
  else if (direction === 's') { p.pos.x = ROOM_W / 2; p.pos.y = TILE * 2; }
  else { p.pos.x = ROOM_W / 2; p.pos.y = ROOM_H - TILE * 2; }

  // Shop room
  if (room.type === 'shop' && state.shopItems.length === 0) {
    state.shopItems = generateShopItems(state.dungeon.tier);
    state.showShop = true;
  }

  // Treasure room — spawn loot
  if (room.type === 'treasure') {
    const rarity: WeaponRarity = state.dungeon.tier >= 3 ? 'epic' : 'rare';
    const weapon = generateWeapon(rarity);
    state.loot.push({
      pos: { x: ROOM_W / 2, y: ROOM_H / 2 },
      type: 'weapon', value: 0, rarity, lifetime: 60,
      bobOffset: 0, weapon,
    });
    for (let i = 0; i < 5; i++) {
      state.loot.push({
        pos: { x: ROOM_W / 2 + (Math.random() - 0.5) * 80, y: ROOM_H / 2 + (Math.random() - 0.5) * 80 },
        type: 'gold', value: 15 + state.dungeon.tier * 10, rarity: 'common', lifetime: 60, bobOffset: Math.random() * Math.PI * 2,
      });
    }
  }
}

// ════════════════════════════════════════
// ── MAIN UPDATE
// ════════════════════════════════════════

export function updateGame(state: GameState, dt: number): void {
  if (state.gameOver || state.paused) return;
  state.time += dt;

  // Transition animation
  if (state.transitionTimer > 0) {
    state.transitionTimer -= dt;
    return;
  }

  // Notification timer
  if (state.notification) {
    state.notification.timer -= dt;
    if (state.notification.timer <= 0) state.notification = null;
  }

  const p = state.player;
  const room = state.room;

  // ── Player Movement ──
  let dx = 0, dy = 0;
  if (state.keys.has('w') || state.keys.has('arrowup')) dy -= 1;
  if (state.keys.has('s') || state.keys.has('arrowdown')) dy += 1;
  if (state.keys.has('a') || state.keys.has('arrowleft')) dx -= 1;
  if (state.keys.has('d') || state.keys.has('arrowright')) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const dir = normalize({ x: dx, y: dy });
    p.vel.x = dir.x * p.speed;
    p.vel.y = dir.y * p.speed;
    p.facing = dir;
  } else {
    p.vel.x = 0;
    p.vel.y = 0;
  }

  // Freeze effect on player
  const playerFrozen = p.statusEffects.some(s => s.type === 'freeze');
  if (playerFrozen) { p.vel.x *= 0.3; p.vel.y *= 0.3; }

  p.pos.x += p.vel.x * dt;
  p.pos.y += p.vel.y * dt;

  // Wall collision
  for (const w of room.walls) {
    if (aabbCollision(p.pos.x - p.width / 2, p.pos.y - p.height / 2, p.width, p.height, w.x, w.y, w.w, w.h)) {
      const overlapX = Math.min(p.pos.x + p.width / 2 - w.x, w.x + w.w - (p.pos.x - p.width / 2));
      const overlapY = Math.min(p.pos.y + p.height / 2 - w.y, w.y + w.h - (p.pos.y - p.height / 2));
      if (overlapX < overlapY) {
        p.pos.x += p.pos.x < w.x + w.w / 2 ? -overlapX : overlapX;
      } else {
        p.pos.y += p.pos.y < w.y + w.h / 2 ? -overlapY : overlapY;
      }
    }
  }

  // ── Door Check ──
  for (const door of room.doors) {
    if (door.locked) continue;
    if (aabbCollision(p.pos.x - p.width / 2, p.pos.y - p.height / 2, p.width, p.height,
      door.x, door.y, door.width, door.height)) {
      state.transitionTimer = 0.3;
      state.transitionDirection = door.direction;
      transitionToRoom(state, door.targetRoom, door.direction);
      return;
    }
  }

  // ── Toggle Inventory ──
  if (state.keys.has('i') || state.keys.has('tab')) {
    state.keys.delete('i');
    state.keys.delete('tab');
    state.showInventory = !state.showInventory;
  }

  // ── Timers ──
  p.attackTimer -= dt;
  p.attackAnimTimer -= dt;
  p.iFrames -= dt;
  p.abilityTimer -= dt;

  // Status effects on player
  updateStatusEffects(p, dt, state);

  // ── Player Attack ──
  if (state.mouseDown && p.attackTimer <= 0 && !state.showInventory && !state.showShop) {
    const w = p.weapon;
    p.attackTimer = w.attackSpeed;
    p.isAttacking = true;
    p.attackAnimTimer = 0.15;

    const dir = normalize({ x: state.mouse.x - p.pos.x, y: state.mouse.y - p.pos.y });
    p.facing = dir;

    if (w.isRanged) {
      const speed = 400;
      state.projectiles.push({
        pos: { x: p.pos.x, y: p.pos.y },
        vel: { x: dir.x * speed, y: dir.y * speed },
        damage: w.damage + p.attackDamage * 0.5,
        radius: 5, lifetime: 1.5, fromPlayer: true,
        color: w.effect ? EFFECT_COLORS[w.effect] : undefined,
        effect: w.effect,
      });
      spawnParticles(state, p.pos, w.effect ? EFFECT_COLORS[w.effect] : '#ccc', 3);
    } else {
      const attackPos = { x: p.pos.x + dir.x * w.range, y: p.pos.y + dir.y * w.range };
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist(attackPos, e.pos) < w.range + e.width / 2) {
          const isCrit = Math.random() < 0.15;
          const dmg = Math.floor((isCrit ? 2 : 1) * (w.damage + p.attackDamage * 0.3));
          e.hp -= dmg;
          e.flashTimer = 0.1;
          e.knockbackTimer = 0.15;
          const kb = normalize({ x: e.pos.x - p.pos.x, y: e.pos.y - p.pos.y });
          e.vel = { x: kb.x * 300, y: kb.y * 300 };
          spawnParticles(state, e.pos, '#e74c3c', 5);
          spawnDamageNumber(state, e.pos, dmg, isCrit ? '#f1c40f' : '#e74c3c', isCrit);
          state.screenShake = isCrit ? 0.15 : 0.08;

          // Weapon effect
          if (w.effect && w.effectChance && Math.random() < w.effectChance) {
            if (w.effect === 'fire') applyStatusEffect(e, 'burn', 5);
            else if (w.effect === 'ice') applyStatusEffect(e, 'freeze', 0);
            else if (w.effect === 'poison') applyStatusEffect(e, 'poison', 4);
            else if (w.effect === 'lightning') {
              // Chain lightning
              for (const e2 of state.enemies) {
                if (e2 === e || !e2.alive || dist(e.pos, e2.pos) > 100) continue;
                e2.hp -= Math.floor(dmg * 0.4);
                spawnParticles(state, e2.pos, '#ffd43b', 4);
                spawnDamageNumber(state, e2.pos, Math.floor(dmg * 0.4), '#ffd43b');
              }
            }
          }
        }
      }
      spawnParticles(state, attackPos, '#aaa', 3);
    }
  }

  // ── Ability (Space) ──
  if (state.keys.has(' ') && p.abilityTimer <= 0 && p.mana >= 20) {
    p.abilityTimer = p.abilityCooldown;
    p.mana -= 20;

    if (p.heroClass === 'warrior') {
      for (const e of state.enemies) {
        if (!e.alive || dist(p.pos, e.pos) > 80) continue;
        const dmg = Math.floor(p.attackDamage * 2);
        e.hp -= dmg;
        e.flashTimer = 0.15;
        const kb = normalize({ x: e.pos.x - p.pos.x, y: e.pos.y - p.pos.y });
        e.vel = { x: kb.x * 400, y: kb.y * 400 };
        e.knockbackTimer = 0.2;
        spawnDamageNumber(state, e.pos, dmg, '#f39c12', true);
      }
      spawnParticles(state, p.pos, '#e74c3c', 20);
      state.screenShake = 0.2;
    } else if (p.heroClass === 'mage') {
      for (const e of state.enemies) {
        if (!e.alive || dist(p.pos, e.pos) > 120) continue;
        const dmg = Math.floor(p.attackDamage * 1.5);
        e.hp -= dmg;
        applyStatusEffect(e, 'freeze', 0);
        e.flashTimer = 0.2;
        spawnDamageNumber(state, e.pos, dmg, '#74c0fc');
      }
      spawnParticles(state, p.pos, '#74c0fc', 25);
      state.screenShake = 0.15;
    } else if (p.heroClass === 'archer') {
      for (let i = -2; i <= 2; i++) {
        const angle = Math.atan2(p.facing.y, p.facing.x) + i * 0.25;
        state.projectiles.push({
          pos: { x: p.pos.x, y: p.pos.y },
          vel: { x: Math.cos(angle) * 450, y: Math.sin(angle) * 450 },
          damage: p.attackDamage, radius: 4, lifetime: 1, fromPlayer: true,
        });
      }
      spawnParticles(state, p.pos, '#27ae60', 10);
    } else if (p.heroClass === 'rogue') {
      p.pos.x += p.facing.x * 120;
      p.pos.y += p.facing.y * 120;
      p.iFrames = 0.5;
      for (const e of state.enemies) {
        if (!e.alive || dist(p.pos, e.pos) > 60) continue;
        const dmg = Math.floor(p.attackDamage * 3);
        e.hp -= dmg;
        e.flashTimer = 0.15;
        spawnDamageNumber(state, e.pos, dmg, '#b197fc', true);
      }
      spawnParticles(state, p.pos, '#b197fc', 15);
      state.screenShake = 0.1;
    }
  }

  // Mana regen
  p.mana = Math.min(p.maxMana, p.mana + 5 * dt);

  // ── Projectiles ──
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const proj = state.projectiles[i];
    proj.pos.x += proj.vel.x * dt;
    proj.pos.y += proj.vel.y * dt;
    proj.lifetime -= dt;

    if (proj.lifetime <= 0) { state.projectiles.splice(i, 1); continue; }

    let hitWall = false;
    for (const w of room.walls) {
      if (proj.pos.x > w.x && proj.pos.x < w.x + w.w && proj.pos.y > w.y && proj.pos.y < w.y + w.h) {
        hitWall = true; break;
      }
    }
    if (hitWall) { spawnParticles(state, proj.pos, '#888', 3); state.projectiles.splice(i, 1); continue; }

    if (proj.fromPlayer) {
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist(proj.pos, e.pos) < proj.radius + e.width / 2) {
          const isCrit = Math.random() < 0.1;
          const dmg = Math.floor((isCrit ? 2 : 1) * proj.damage);
          e.hp -= dmg;
          e.flashTimer = 0.1;
          e.knockbackTimer = 0.1;
          const kb = normalize({ x: e.pos.x - proj.pos.x, y: e.pos.y - proj.pos.y });
          e.vel = { x: kb.x * 200, y: kb.y * 200 };
          spawnParticles(state, e.pos, proj.color || '#e74c3c', 4);
          spawnDamageNumber(state, e.pos, dmg, isCrit ? '#f1c40f' : '#e74c3c', isCrit);

          if (proj.effect) {
            if (proj.effect === 'fire') applyStatusEffect(e, 'burn', 5);
            else if (proj.effect === 'ice') applyStatusEffect(e, 'freeze', 0);
            else if (proj.effect === 'poison') applyStatusEffect(e, 'poison', 4);
          }

          state.projectiles.splice(i, 1);
          break;
        }
      }
    } else {
      // Enemy projectile hitting player
      if (p.iFrames <= 0 && dist(proj.pos, p.pos) < proj.radius + p.width / 2) {
        p.hp -= proj.damage;
        p.iFrames = 0.5;
        spawnParticles(state, p.pos, '#e74c3c', 6);
        spawnDamageNumber(state, p.pos, proj.damage, '#ff6b6b');
        state.screenShake = 0.12;
        state.projectiles.splice(i, 1);
      }
    }
  }

  // ── Traps ──
  for (const trap of state.traps) {
    trap.timer -= dt;
    if (trap.timer <= 0) {
      trap.active = !trap.active;
      trap.timer = trap.active ? 0.8 : trap.cooldown;

      if (trap.active && trap.type === 'arrow_launcher' && trap.direction) {
        state.projectiles.push({
          pos: { x: trap.pos.x, y: trap.pos.y },
          vel: { x: trap.direction.x * 300, y: trap.direction.y * 300 },
          damage: trap.damage, radius: 3, lifetime: 2, fromPlayer: false,
          color: '#888',
        });
      }
    }

    // Damage entities on active traps
    if (trap.active && (trap.type === 'spikes' || trap.type === 'fire_vent')) {
      // Player
      if (p.iFrames <= 0 && dist(p.pos, trap.pos) < trap.width) {
        p.hp -= Math.floor(trap.damage * 0.3);
        p.iFrames = 0.3;
        spawnDamageNumber(state, p.pos, Math.floor(trap.damage * 0.3), '#e74c3c');
        if (trap.type === 'fire_vent') applyStatusEffect(p, 'burn', 3);
      }
      // Enemies too (friendly fire)
      for (const e of state.enemies) {
        if (!e.alive || e.knockbackTimer > 0) continue;
        if (dist(e.pos, trap.pos) < trap.width) {
          e.hp -= Math.floor(trap.damage * 0.3);
          e.flashTimer = 0.1;
        }
      }
    }
  }

  // ── Enemy AI ──
  for (const e of state.enemies) {
    if (!e.alive) continue;

    e.attackTimer -= dt;
    e.knockbackTimer -= dt;
    e.flashTimer -= dt;
    e.shootTimer -= dt;

    updateStatusEffects(e, dt, state);

    if (e.knockbackTimer > 0) {
      e.pos.x += e.vel.x * dt;
      e.pos.y += e.vel.y * dt;
      continue;
    }

    // Stun check
    if (e.statusEffects.some(s => s.type === 'stun')) continue;

    const d = dist(e.pos, p.pos);

    if (d < 250) e.state = 'chase';

    // Boss phase transition
    if (e.type === 'boss' && e.phase === 1 && e.phaseHP && e.hp <= e.phaseHP) {
      e.phase = 2;
      e.speed = e.baseSpeed * 1.5;
      e.shootCooldown *= 0.6;
      e.damage = Math.floor(e.damage * 1.3);
      spawnParticles(state, e.pos, '#e74c3c', 30);
      notify(state, 'BOSS ENRAGED!', '#e74c3c');
      state.screenShake = 0.3;
    }

    if (e.isRanged) {
      // Ranged AI: keep distance, shoot
      if (e.state === 'chase') {
        if (d > 150) {
          const dir = normalize({ x: p.pos.x - e.pos.x, y: p.pos.y - e.pos.y });
          e.pos.x += dir.x * e.speed * dt;
          e.pos.y += dir.y * e.speed * dt;
        } else if (d < 100) {
          // Retreat
          const dir = normalize({ x: e.pos.x - p.pos.x, y: e.pos.y - p.pos.y });
          e.pos.x += dir.x * e.speed * 0.7 * dt;
          e.pos.y += dir.y * e.speed * 0.7 * dt;
        }

        // Shoot
        if (e.shootTimer <= 0 && d < 300) {
          e.shootTimer = e.shootCooldown;
          const dir = normalize({ x: p.pos.x - e.pos.x, y: p.pos.y - e.pos.y });

          if (e.type === 'boss' && e.phase === 2) {
            // Boss shoots burst of 3
            for (let b = -1; b <= 1; b++) {
              const angle = Math.atan2(dir.y, dir.x) + b * 0.3;
              state.projectiles.push({
                pos: { x: e.pos.x, y: e.pos.y },
                vel: { x: Math.cos(angle) * 200, y: Math.sin(angle) * 200 },
                damage: e.damage, radius: 5, lifetime: 2, fromPlayer: false,
                color: '#e74c3c',
              });
            }
          } else {
            state.projectiles.push({
              pos: { x: e.pos.x, y: e.pos.y },
              vel: { x: dir.x * 180, y: dir.y * 180 },
              damage: e.damage, radius: 4, lifetime: 2, fromPlayer: false,
              color: e.type === 'necromancer' ? '#b197fc' : '#e74c3c',
            });
          }
        }
      }
    } else {
      // Melee AI
      if (e.state === 'chase') {
        const dir = normalize({ x: p.pos.x - e.pos.x, y: p.pos.y - e.pos.y });
        e.pos.x += dir.x * e.speed * dt;
        e.pos.y += dir.y * e.speed * dt;

        if (d < 30 && e.attackTimer <= 0 && p.iFrames <= 0) {
          e.attackTimer = e.attackCooldown;
          p.hp -= e.damage;
          p.iFrames = 0.5;
          const kb = normalize({ x: p.pos.x - e.pos.x, y: p.pos.y - e.pos.y });
          p.pos.x += kb.x * 30;
          p.pos.y += kb.y * 30;
          spawnParticles(state, p.pos, '#e74c3c', 6);
          spawnDamageNumber(state, p.pos, e.damage, '#ff6b6b');
          state.screenShake = 0.12;
        }
      } else {
        if (Math.random() < 0.01) {
          const angle = Math.random() * Math.PI * 2;
          e.vel = { x: Math.cos(angle) * e.speed * 0.3, y: Math.sin(angle) * e.speed * 0.3 };
        }
        e.pos.x += e.vel.x * dt;
        e.pos.y += e.vel.y * dt;
      }
    }

    // Clamp enemy position
    e.pos.x = Math.max(TILE + e.width / 2, Math.min(ROOM_W - TILE - e.width / 2, e.pos.x));
    e.pos.y = Math.max(TILE + e.height / 2, Math.min(ROOM_H - TILE - e.height / 2, e.pos.y));

    // Death
    if (e.hp <= 0) {
      e.alive = false;
      p.killCount++;
      spawnParticles(state, e.pos, enemyColor(e.type), 15);
      spawnLoot(state, e.pos, e.goldValue, state.dungeon.tier);
      p.xp += e.xpValue;

      if (p.xp >= p.xpToNext) {
        p.xp -= p.xpToNext;
        p.level++;
        p.xpToNext = Math.floor(p.xpToNext * 1.5);
        p.maxHp += 10;
        p.hp = p.maxHp;
        p.attackDamage += 3;
        p.maxMana += 10;
        p.mana = p.maxMana;
        spawnParticles(state, p.pos, '#f1c40f', 30);
        spawnDamageNumber(state, { x: p.pos.x, y: p.pos.y - 20 }, 0, '#f1c40f', false, 'LEVEL UP!');
        notify(state, `Level ${p.level}!`, '#f1c40f');
      }
    }
  }

  state.enemies = state.enemies.filter(e => e.alive);

  // ── Room Clear ──
  if (room.type !== 'start' && room.type !== 'treasure' && room.type !== 'shop' && !room.cleared && state.enemies.length === 0) {
    room.cleared = true;
    state.roomsCleared++;
    // Unlock doors
    for (const door of room.doors) door.locked = false;
    // Also unlock connected room doors pointing back
    for (const door of room.doors) {
      const targetRoom = state.dungeon.rooms[door.targetRoom];
      for (const td of targetRoom.doors) {
        if (td.targetRoom === room.id) td.locked = false;
      }
    }
    notify(state, 'ROOM CLEARED!', '#f1c40f');
    p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.15));

    // Boss clear → next dungeon tier
    if (room.type === 'boss') {
      const nextTier = state.dungeon.tier + 1;
      const themes: DungeonRoom['theme'][] = ['cave', 'crypt', 'fortress', 'shadow'];
      notify(state, `Dungeon Tier ${nextTier} — ${themes[Math.min(nextTier - 1, 3)].toUpperCase()}!`, '#ffd43b');
      setTimeout(() => {
        const newDungeon = generateDungeon(nextTier);
        state.dungeon = newDungeon;
        state.wave = nextTier;
        const startRoom = newDungeon.rooms[0];
        state.room = startRoom;
        state.enemies = [...startRoom.enemies];
        state.traps = [...startRoom.traps];
        state.projectiles = [];
        state.loot = [];
        state.shopItems = [];
        p.pos = { x: ROOM_W / 2, y: ROOM_H / 2 };
        p.hp = p.maxHp;
        p.mana = p.maxMana;
      }, 2500);
    }
  }

  // ── Loot ──
  for (let i = state.loot.length - 1; i >= 0; i--) {
    const l = state.loot[i];
    l.lifetime -= dt;
    if (l.lifetime <= 0) { state.loot.splice(i, 1); continue; }
    if (dist(l.pos, p.pos) < 28) {
      if (l.type === 'gold') {
        p.gold += l.value;
        spawnDamageNumber(state, l.pos, l.value, '#f1c40f');
      } else if (l.type === 'health') {
        p.hp = Math.min(p.maxHp, p.hp + l.value);
        spawnDamageNumber(state, l.pos, l.value, '#2ecc71');
      } else if (l.type === 'mana') {
        p.mana = Math.min(p.maxMana, p.mana + l.value);
        spawnDamageNumber(state, l.pos, l.value, '#74c0fc');
      } else if (l.type === 'weapon' && l.weapon) {
        if (p.inventory.length < 8) {
          p.inventory.push(l.weapon);
          notify(state, `Found: ${l.weapon.name} (${l.weapon.rarity})`, RARITY_COLORS[l.weapon.rarity]);
        } else {
          notify(state, 'Inventory full!', '#e74c3c');
          continue;
        }
      }
      spawnParticles(state, l.pos, '#f1c40f', 5);
      state.loot.splice(i, 1);
    }
  }

  // ── Particles ──
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const part = state.particles[i];
    part.pos.x += part.vel.x * dt;
    part.pos.y += part.vel.y * dt;
    part.vel.x *= 0.95;
    part.vel.y *= 0.95;
    part.lifetime -= dt;
    if (part.lifetime <= 0) state.particles.splice(i, 1);
  }

  // ── Damage Numbers ──
  for (let i = state.damageNumbers.length - 1; i >= 0; i--) {
    const dn = state.damageNumbers[i];
    dn.pos.y -= 40 * dt;
    dn.lifetime -= dt;
    if (dn.lifetime <= 0) state.damageNumbers.splice(i, 1);
  }

  // Screen shake decay
  state.screenShake *= 0.9;
  if (state.screenShake < 0.01) state.screenShake = 0;

  // Player death
  if (p.hp <= 0) {
    p.alive = false;
    state.gameOver = true;
    spawnParticles(state, p.pos, '#e74c3c', 30);
  }

  // Clamp
  p.pos.x = Math.max(TILE + p.width / 2, Math.min(ROOM_W - TILE - p.width / 2, p.pos.x));
  p.pos.y = Math.max(TILE + p.height / 2, Math.min(ROOM_H - TILE - p.height / 2, p.pos.y));
}

// ════════════════════════════════════════
// ── RENDER
// ════════════════════════════════════════

function enemyColor(type: EnemyType): string {
  switch (type) {
    case 'goblin': return '#2ecc71';
    case 'skeleton': return '#bdc3c7';
    case 'orc': return '#e67e22';
    case 'necromancer': return '#b197fc';
    case 'boss': return '#e74c3c';
  }
}

const THEME_COLORS: Record<string, { floor1: string; floor2: string; wall: string; wallHighlight: string }> = {
  cave: { floor1: '#2e2924', floor2: '#26221e', wall: '#1a1714', wallHighlight: '#332e28' },
  crypt: { floor1: '#252530', floor2: '#1e1e28', wall: '#141420', wallHighlight: '#2e2e3a' },
  fortress: { floor1: '#302820', floor2: '#28221a', wall: '#1c1610', wallHighlight: '#3a3228' },
  shadow: { floor1: '#1a1a24', floor2: '#14141e', wall: '#0e0e16', wallHighlight: '#222230' },
};

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  const { player: p, room } = state;
  const theme = THEME_COLORS[room.theme] || THEME_COLORS.cave;

  ctx.save();

  // Screen shake
  if (state.screenShake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * state.screenShake * 30,
      (Math.random() - 0.5) * state.screenShake * 30,
    );
  }

  // Transition fade
  if (state.transitionTimer > 0) {
    ctx.globalAlpha = 1 - state.transitionTimer / 0.3;
  }

  // ── Floor ──
  ctx.fillStyle = theme.floor1;
  ctx.fillRect(0, 0, ROOM_W, ROOM_H);
  for (let x = TILE; x < ROOM_W - TILE; x += TILE) {
    for (let y = TILE; y < ROOM_H - TILE; y += TILE) {
      ctx.fillStyle = ((x + y) / TILE) % 2 === 0 ? theme.floor1 : theme.floor2;
      ctx.fillRect(x, y, TILE, TILE);
    }
  }

  // Floor details (cracks, etc.)
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 8; i++) {
    const cx = TILE + ((i * 97) % (ROOM_W - TILE * 2));
    const cy = TILE + ((i * 137) % (ROOM_H - TILE * 2));
    ctx.fillStyle = '#000';
    ctx.fillRect(cx, cy, 2 + (i % 3) * 2, 1);
  }
  ctx.globalAlpha = 1;

  // ── Walls ──
  for (const w of room.walls) {
    ctx.fillStyle = theme.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = theme.wallHighlight;
    ctx.fillRect(w.x, w.y, w.w, 3);
    // Side highlight
    ctx.fillStyle = theme.wallHighlight;
    ctx.fillRect(w.x, w.y, 2, w.h);
  }

  // ── Doors ──
  for (const door of room.doors) {
    ctx.fillStyle = door.locked ? '#8b4513' : '#f1c40f';
    ctx.fillRect(door.x, door.y, door.width, door.height);
    if (door.locked) {
      // Lock icon
      ctx.fillStyle = '#555';
      ctx.fillRect(door.x + 12, door.y + 8, 8, 10);
      ctx.beginPath();
      ctx.arc(door.x + 16, door.y + 10, 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // Arrow indicator
      ctx.fillStyle = '#333';
      ctx.font = '16px Inter';
      ctx.textAlign = 'center';
      const arrows = { n: '▲', s: '▼', e: '►', w: '◄' };
      ctx.fillText(arrows[door.direction], door.x + 16, door.y + 22);
    }
  }

  // ── Traps ──
  for (const trap of state.traps) {
    ctx.save();
    ctx.translate(trap.pos.x, trap.pos.y);

    if (trap.type === 'spikes') {
      ctx.fillStyle = trap.active ? '#888' : '#555';
      ctx.fillRect(-trap.width / 2, -trap.height / 2, trap.width, trap.height);
      if (trap.active) {
        ctx.fillStyle = '#aaa';
        for (let sx = -10; sx <= 10; sx += 5) {
          for (let sy = -10; sy <= 10; sy += 5) {
            ctx.fillRect(sx - 1, sy - 4, 2, 4);
          }
        }
      }
    } else if (trap.type === 'fire_vent') {
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.arc(0, 0, trap.width / 2, 0, Math.PI * 2);
      ctx.fill();
      if (trap.active) {
        ctx.fillStyle = 'rgba(231,76,60,0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, trap.width, 0, Math.PI * 2);
        ctx.fill();
        spawnParticles(state, trap.pos, '#e74c3c', 1);
      }
    } else if (trap.type === 'arrow_launcher') {
      ctx.fillStyle = '#666';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#444';
      ctx.fillRect(-4, -4, 8, 8);
    }

    ctx.restore();
  }

  // ── Loot ──
  for (const l of state.loot) {
    const bob = Math.sin(time * 3 + l.bobOffset) * 3;
    ctx.save();
    ctx.translate(l.pos.x, l.pos.y + bob);

    if (l.type === 'gold') {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f39c12';
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    } else if (l.type === 'health') {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-4, -2, 8, 4);
      ctx.fillRect(-2, -4, 4, 8);
    } else if (l.type === 'mana') {
      ctx.fillStyle = '#74c0fc';
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(5, 4); ctx.lineTo(-5, 4);
      ctx.closePath(); ctx.fill();
    } else if (l.type === 'weapon') {
      // Weapon glow
      const rc = RARITY_COLORS[l.rarity];
      ctx.shadowColor = rc;
      ctx.shadowBlur = 12;
      ctx.fillStyle = rc;
      ctx.fillRect(-6, -3, 12, 6);
      ctx.fillRect(-3, -6, 6, 12);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  // ── Enemies ──
  for (const e of state.enemies) {
    if (!e.alive) continue;
    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, e.height / 2, e.width / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const baseColor = e.flashTimer > 0 ? '#fff' :
      e.statusEffects.some(s => s.type === 'freeze') ? '#74c0fc' :
      e.statusEffects.some(s => s.type === 'burn') ? '#ff7f50' :
      e.statusEffects.some(s => s.type === 'poison') ? '#98fb98' :
      enemyColor(e.type);
    ctx.fillStyle = baseColor;

    if (e.type === 'boss') {
      ctx.beginPath(); ctx.arc(0, 0, e.width / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = e.phase === 2 ? '#ff0000' : '#c0392b';
      ctx.fillRect(-e.width / 2, -e.height / 2 - 8, 6, 10);
      ctx.fillRect(e.width / 2 - 6, -e.height / 2 - 8, 6, 10);
      // Aura for phase 2
      if (e.phase === 2) {
        ctx.globalAlpha = 0.2 + Math.sin(time * 5) * 0.1;
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath(); ctx.arc(0, 0, e.width / 2 + 8, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else if (e.type === 'necromancer') {
      ctx.beginPath(); ctx.arc(0, 0, e.width / 2, 0, Math.PI * 2); ctx.fill();
      // Hat
      ctx.fillStyle = '#4a0080';
      ctx.beginPath();
      ctx.moveTo(0, -e.height / 2 - 10);
      ctx.lineTo(-8, -e.height / 2 + 2);
      ctx.lineTo(8, -e.height / 2 + 2);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillRect(-e.width / 2, -e.height / 2, e.width, e.height);
    }

    // Eyes
    ctx.fillStyle = e.type === 'necromancer' ? '#b197fc' : '#c0392b';
    ctx.fillRect(-4, -3, 3, 3);
    ctx.fillRect(2, -3, 3, 3);

    // HP bar
    if (e.hp < e.maxHp) {
      const barW = Math.max(e.width, 30);
      ctx.fillStyle = '#333';
      ctx.fillRect(-barW / 2, -e.height / 2 - 8, barW, 4);
      ctx.fillStyle = e.type === 'boss' ? '#ff4444' : '#e74c3c';
      ctx.fillRect(-barW / 2, -e.height / 2 - 8, barW * (e.hp / e.maxHp), 4);
    }

    ctx.restore();
  }

  // ── Player ──
  if (p.alive) {
    ctx.save();
    ctx.translate(p.pos.x, p.pos.y);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, p.height / 2, p.width / 2 + 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (p.iFrames > 0 && Math.floor(p.iFrames * 20) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    const cfg = HERO_CONFIGS[p.heroClass];
    ctx.fillStyle = cfg.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(-3, -3, p.width / 4, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    const ex = p.facing.x * 3;
    const ey = p.facing.y * 3;
    ctx.fillRect(ex - 3, ey - 3, 3, 3);
    ctx.fillRect(ex + 1, ey - 3, 3, 3);

    ctx.globalAlpha = 1;

    // Attack arc
    if (p.attackAnimTimer > 0) {
      const wColor = p.weapon.effect ? EFFECT_COLORS[p.weapon.effect] : 'rgba(255,255,255,0.6)';
      ctx.strokeStyle = wColor;
      ctx.lineWidth = 2;
      const angle = Math.atan2(p.facing.y, p.facing.x);
      ctx.beginPath();
      ctx.arc(0, 0, p.weapon.range, angle - 0.6, angle + 0.6);
      ctx.stroke();
    }

    // Status effect indicators
    if (p.statusEffects.length > 0) {
      let ox = -p.statusEffects.length * 5;
      for (const se of p.statusEffects) {
        ctx.fillStyle = se.type === 'burn' ? '#e74c3c' : se.type === 'freeze' ? '#74c0fc' : '#51cf66';
        ctx.fillRect(ox, -p.height / 2 - 10, 4, 4);
        ox += 10;
      }
    }

    ctx.restore();
  }

  // ── Projectiles ──
  for (const proj of state.projectiles) {
    ctx.save();
    ctx.translate(proj.pos.x, proj.pos.y);
    ctx.fillStyle = proj.color || (proj.fromPlayer ? '#ccc' : '#e74c3c');
    ctx.beginPath(); ctx.arc(0, 0, proj.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = (proj.color || '#e74c3c') + '44';
    ctx.beginPath(); ctx.arc(0, 0, proj.radius * 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ── Particles ──
  for (const part of state.particles) {
    ctx.globalAlpha = part.lifetime / part.maxLifetime;
    ctx.fillStyle = part.color;
    ctx.fillRect(part.pos.x - part.size / 2, part.pos.y - part.size / 2, part.size, part.size);
  }
  ctx.globalAlpha = 1;

  // ── Damage Numbers ──
  for (const dn of state.damageNumbers) {
    ctx.globalAlpha = dn.lifetime / 0.8;
    ctx.font = dn.isCrit ? 'bold 18px Inter' : '14px Inter';
    ctx.fillStyle = dn.color;
    ctx.textAlign = 'center';
    ctx.fillText(dn.text || (dn.value === 0 ? 'LEVEL UP!' : dn.value.toString()), dn.pos.x, dn.pos.y);
  }
  ctx.globalAlpha = 1;

  // ── Notification ──
  if (state.notification) {
    const n = state.notification;
    ctx.globalAlpha = Math.min(1, n.timer);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(ROOM_W / 2 - 150, 50, 300, 36);
    ctx.font = 'bold 16px Cinzel';
    ctx.fillStyle = n.color;
    ctx.textAlign = 'center';
    ctx.fillText(n.text, ROOM_W / 2, 74);
    ctx.globalAlpha = 1;
  }

  // ── Minimap ──
  renderMinimap(ctx, state);

  // ── Room type label ──
  if (room.type === 'shop') {
    ctx.font = 'bold 20px Cinzel';
    ctx.fillStyle = '#f1c40f';
    ctx.textAlign = 'center';
    ctx.fillText('SHOP', ROOM_W / 2, ROOM_H / 2 - 60);
    ctx.font = '12px Inter';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press E to browse', ROOM_W / 2, ROOM_H / 2 - 40);
  }

  // ── Game Over ──
  if (state.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);
    ctx.font = 'bold 36px Cinzel';
    ctx.fillStyle = '#e74c3c';
    ctx.textAlign = 'center';
    ctx.fillText('DEFEATED', ROOM_W / 2, ROOM_H / 2 - 40);
    ctx.font = '16px Inter';
    ctx.fillStyle = '#bdc3c7';
    ctx.fillText(`Tier ${state.dungeon.tier} · ${state.roomsCleared} rooms · ${p.killCount} kills · ${p.gold} gold`, ROOM_W / 2, ROOM_H / 2);
    ctx.fillText(`Level ${p.level} ${HERO_CONFIGS[p.heroClass].name}`, ROOM_W / 2, ROOM_H / 2 + 25);
    ctx.fillStyle = '#f1c40f';
    ctx.fillText('Click to restart', ROOM_W / 2, ROOM_H / 2 + 60);
  }

  ctx.restore();
}

// ── Minimap ──

function renderMinimap(ctx: CanvasRenderingContext2D, state: GameState) {
  const mm = { x: ROOM_W - 140, y: 8, cellW: 18, cellH: 14 };
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(mm.x - 4, mm.y - 4, 138, 80);

  for (const room of state.dungeon.rooms) {
    if (!room.visited) continue;
    const rx = mm.x + room.gridX * (mm.cellW + 3);
    const ry = mm.y + room.gridY * (mm.cellH + 3);

    const isCurrent = room.id === state.dungeon.currentRoomId;
    const colors: Record<string, string> = {
      start: '#555', combat: room.cleared ? '#2d5a2d' : '#5a2d2d',
      treasure: '#5a5a2d', boss: '#5a1a1a', shop: '#2d4a5a',
    };
    ctx.fillStyle = colors[room.type] || '#444';
    ctx.fillRect(rx, ry, mm.cellW, mm.cellH);

    if (isCurrent) {
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, mm.cellW, mm.cellH);
    }

    // Room type icons
    ctx.font = '8px Inter';
    ctx.fillStyle = '#ccc';
    ctx.textAlign = 'center';
    const labels: Record<string, string> = { boss: '☠', treasure: '♦', shop: '$', start: '•' };
    if (labels[room.type]) ctx.fillText(labels[room.type], rx + mm.cellW / 2, ry + mm.cellH / 2 + 3);

    // Draw connections
    for (const door of room.doors) {
      const target = state.dungeon.rooms[door.targetRoom];
      if (!target.visited) continue;
      ctx.strokeStyle = door.locked ? '#5a3a1a' : '#666';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx + mm.cellW / 2, ry + mm.cellH / 2);
      const tx = mm.x + target.gridX * (mm.cellW + 3) + mm.cellW / 2;
      const ty = mm.y + target.gridY * (mm.cellH + 3) + mm.cellH / 2;
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
  }

  ctx.restore();
}
