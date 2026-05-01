import {
  GameState, Player, Enemy, DungeonRoom, Dungeon, Door, Trap, Chest, Torch,
  Vector2, HeroClass, HERO_CONFIGS, EnemyType, WeaponRarity, LevelUpStat,
  generateWeapon, RARITY_COLORS, EFFECT_COLORS, ShopItem,
} from './types';
import { audio } from './audio';

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

// ── Torch & Chest Creation ──

function createTorches(room: DungeonRoom): Torch[] {
  const torches: Torch[] = [];
  // Place torches along walls
  const positions = [
    { x: TILE * 3, y: TILE * 2 },
    { x: ROOM_W - TILE * 3, y: TILE * 2 },
    { x: TILE * 3, y: ROOM_H - TILE * 2 },
    { x: ROOM_W - TILE * 3, y: ROOM_H - TILE * 2 },
  ];
  // Add mid-wall torches for larger rooms
  if (room.type !== 'start') {
    positions.push({ x: ROOM_W / 2, y: TILE * 2 });
    positions.push({ x: ROOM_W / 2, y: ROOM_H - TILE * 2 });
  }
  for (const p of positions) {
    torches.push({ pos: { ...p }, radius: 80 + Math.random() * 30, flickerOffset: Math.random() * Math.PI * 2 });
  }
  return torches;
}

function createChests(type: DungeonRoom['type'], tier: number): Chest[] {
  const chests: Chest[] = [];
  if (type === 'treasure') {
    // Big chest in center
    const rarity: WeaponRarity = tier >= 3 ? 'epic' : tier >= 2 ? 'rare' : 'common';
    chests.push({ pos: { x: ROOM_W / 2, y: ROOM_H / 2 }, rarity, opened: false, openTimer: 0, lootSpawned: false });
    // Side chests
    chests.push({ pos: { x: ROOM_W / 2 - 80, y: ROOM_H / 2 + 40 }, rarity: 'common', opened: false, openTimer: 0, lootSpawned: false });
    chests.push({ pos: { x: ROOM_W / 2 + 80, y: ROOM_H / 2 + 40 }, rarity: 'common', opened: false, openTimer: 0, lootSpawned: false });
  } else if (type === 'combat' && Math.random() < 0.3) {
    // Rare chance of chest in combat room
    chests.push({
      pos: { x: TILE * 4 + Math.random() * (ROOM_W - TILE * 8), y: TILE * 4 + Math.random() * (ROOM_H - TILE * 8) },
      rarity: Math.random() < 0.1 ? 'rare' : 'common', opened: false, openTimer: 0, lootSpawned: false,
    });
  }
  return chests;
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
    const numWalls = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numWalls; i++) {
      const ox = TILE * 3 + Math.random() * (ROOM_W - TILE * 8);
      const oy = TILE * 3 + Math.random() * (ROOM_H - TILE * 8);
      walls.push({ x: ox, y: oy, w: TILE * 2, h: TILE });
    }

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
    traps.push(createTrap('fire_vent', 150, 150));
    traps.push(createTrap('fire_vent', ROOM_W - 150, 150));
    traps.push(createTrap('fire_vent', 150, ROOM_H - 150));
    traps.push(createTrap('fire_vent', ROOM_W - 150, ROOM_H - 150));
  } else if (type === 'treasure') {
    walls.push({ x: ROOM_W / 2 - TILE * 3, y: ROOM_H / 2 - TILE, w: TILE * 6, h: TILE });
    walls.push({ x: ROOM_W / 2 - TILE * 3, y: ROOM_H / 2 + TILE, w: TILE * 6, h: TILE });
  }

  const room: DungeonRoom = {
    id, gridX, gridY, width: ROOM_W, height: ROOM_H,
    walls, enemies, traps,
    chests: createChests(type, tier),
    torches: [],
    cleared: type === 'start' || type === 'treasure' || type === 'shop',
    doors: [], visited: type === 'start',
    type, theme,
  };
  room.torches = createTorches(room);
  return room;
}

function generateDungeon(tier: number): Dungeon {
  const themes: DungeonRoom['theme'][] = ['cave', 'crypt', 'fortress', 'shadow'];
  const theme = themes[Math.min(tier - 1, 3)];

  const numCombat = 3 + Math.floor(Math.random() * 3);
  const rooms: DungeonRoom[] = [];

  rooms.push(generateDungeonRoom(0, 0, 0, 'start', tier, theme));

  let cx = 1;
  const cy = 0;
  for (let i = 0; i < numCombat; i++) {
    const type = (i === Math.floor(numCombat / 2)) ? 'treasure' : 'combat';
    rooms.push(generateDungeonRoom(rooms.length, cx, cy, type, tier, theme));
    cx++;
  }

  rooms.push(generateDungeonRoom(rooms.length, Math.floor(numCombat / 2) + 1, 1, 'shop', tier, theme));
  rooms.push(generateDungeonRoom(rooms.length, cx, cy, 'boss', tier, theme));

  // Connect rooms with doors
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
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

function spawnChestLoot(state: GameState, chest: Chest, tier: number) {
  const pos = chest.pos;
  // Gold piles
  for (let i = 0; i < 3; i++) {
    state.loot.push({
      pos: { x: pos.x + (Math.random() - 0.5) * 40, y: pos.y + (Math.random() - 0.5) * 40 },
      type: 'gold', value: 10 + tier * 8 + (chest.rarity === 'common' ? 0 : chest.rarity === 'rare' ? 15 : 40),
      rarity: 'common', lifetime: 30, bobOffset: Math.random() * Math.PI * 2,
    });
  }
  // Health
  state.loot.push({
    pos: { x: pos.x + (Math.random() - 0.5) * 30, y: pos.y + 20 },
    type: 'health', value: 25 + tier * 10, rarity: 'common', lifetime: 30, bobOffset: Math.random() * Math.PI * 2,
  });
  // Weapon from non-common chests
  if (chest.rarity !== 'common' || Math.random() < 0.4) {
    const weapon = generateWeapon(chest.rarity);
    state.loot.push({
      pos: { x: pos.x, y: pos.y - 15 },
      type: 'weapon', value: 0, rarity: chest.rarity, lifetime: 60, bobOffset: 0, weapon,
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
    speed: cfg.speed, baseSpeed: cfg.speed,
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
    dodgeTimer: 0,
    dodgeCooldownTimer: 0,
    baseMaxHp: cfg.hp,
    baseMaxMana: cfg.mana,
    baseAttackDamage: cfg.damage,
    skillPoints: 0,
    unlockedSkills: [],
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
    chests: [...room.chests],
    torches: [...room.torches],
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
    levelUpChoices: null,
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
  state.chests = [...room.chests];
  state.torches = [...room.torches];
  state.projectiles = [];
  state.loot = [];
  audio.play('door');

  const p = state.player;
  if (direction === 'e') { p.pos.x = TILE * 2; p.pos.y = ROOM_H / 2; }
  else if (direction === 'w') { p.pos.x = ROOM_W - TILE * 2; p.pos.y = ROOM_H / 2; }
  else if (direction === 's') { p.pos.x = ROOM_W / 2; p.pos.y = TILE * 2; }
  else { p.pos.x = ROOM_W / 2; p.pos.y = ROOM_H - TILE * 2; }

  if (room.type === 'shop' && state.shopItems.length === 0) {
    state.shopItems = generateShopItems(state.dungeon.tier);
    state.showShop = true;
  }
}

// ── Level Up ──

function triggerLevelUp(state: GameState) {
  const p = state.player;
  p.level++;
  p.xp -= p.xpToNext;
  p.xpToNext = Math.floor(p.xpToNext * 1.5);
  spawnParticles(state, p.pos, '#f1c40f', 30);
  spawnDamageNumber(state, { x: p.pos.x, y: p.pos.y - 20 }, 0, '#f1c40f', false, 'LEVEL UP!');
  notify(state, `Level ${p.level}! Choose an upgrade`, '#f1c40f');
  audio.play('level_up');

  // Show level up choices
  state.levelUpChoices = ['hp', 'attack', 'speed', 'mana'];
  state.paused = true;
}

export function applyLevelUpChoice(state: GameState, choice: LevelUpStat) {
  const p = state.player;
  switch (choice) {
    case 'hp': p.maxHp += 15; p.hp = p.maxHp; break;
    case 'attack': p.attackDamage += 5; break;
    case 'speed': p.speed += 20; p.baseSpeed += 20; break;
    case 'mana': p.maxMana += 20; p.mana = p.maxMana; break;
  }
  state.levelUpChoices = null;
  state.paused = false;
}

// ════════════════════════════════════════
// ── MAIN UPDATE
// ════════════════════════════════════════

export function updateGame(state: GameState, dt: number): void {
  if (state.gameOver) return;
  if (state.paused) return;
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

  // ── Dodge Roll ──
  p.dodgeTimer -= dt;
  p.dodgeCooldownTimer -= dt;

  if (state.keys.has('shift') && p.dodgeCooldownTimer <= 0 && p.dodgeTimer <= 0 && (p.vel.x !== 0 || p.vel.y !== 0)) {
    p.dodgeTimer = 0.25;
    p.dodgeCooldownTimer = 0.8;
    p.iFrames = 0.3;
    spawnParticles(state, p.pos, '#aaa', 6);
    audio.play('dodge');
  }

  // ── Player Movement ──
  let dx = 0, dy = 0;
  if (state.keys.has('w') || state.keys.has('arrowup')) dy -= 1;
  if (state.keys.has('s') || state.keys.has('arrowdown')) dy += 1;
  if (state.keys.has('a') || state.keys.has('arrowleft')) dx -= 1;
  if (state.keys.has('d') || state.keys.has('arrowright')) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const dir = normalize({ x: dx, y: dy });
    const speed = p.dodgeTimer > 0 ? p.speed * 2.5 : p.speed;
    p.vel.x = dir.x * speed;
    p.vel.y = dir.y * speed;
    p.facing = dir;
  } else {
    if (p.dodgeTimer > 0) {
      // Continue dodge in facing direction
      p.vel.x = p.facing.x * p.speed * 2.5;
      p.vel.y = p.facing.y * p.speed * 2.5;
    } else {
      p.vel.x = 0;
      p.vel.y = 0;
    }
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

  // ── Chest Interaction ──
  for (const chest of state.chests) {
    if (chest.opened) {
      if (chest.openTimer > 0) chest.openTimer -= dt;
      continue;
    }
    if (dist(p.pos, chest.pos) < 35 && state.keys.has('e')) {
      state.keys.delete('e');
      chest.opened = true;
      chest.openTimer = 1.5;
      spawnParticles(state, chest.pos, RARITY_COLORS[chest.rarity], 15);
      state.screenShake = 0.05;
      audio.play('chest_open');
      if (!chest.lootSpawned) {
        chest.lootSpawned = true;
        spawnChestLoot(state, chest, state.dungeon.tier);
        notify(state, `Opened ${chest.rarity} chest!`, RARITY_COLORS[chest.rarity]);
      }
    }
  }

  // ── Timers ──
  p.attackTimer -= dt;
  p.attackAnimTimer -= dt;
  p.iFrames -= dt;
  p.abilityTimer -= dt;

  // Status effects on player
  updateStatusEffects(p, dt, state);

  // ── Player Attack ──
  if (state.mouseDown && p.attackTimer <= 0 && !state.showInventory && !state.showShop && p.dodgeTimer <= 0) {
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
      audio.play('attack_ranged');
    } else {
      audio.play('attack_melee');
      const attackPos = { x: p.pos.x + dir.x * w.range, y: p.pos.y + dir.y * w.range };
      let didHit = false;
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
          didHit = true;

          if (w.effect && w.effectChance && Math.random() < w.effectChance) {
            if (w.effect === 'fire') applyStatusEffect(e, 'burn', 5);
            else if (w.effect === 'ice') applyStatusEffect(e, 'freeze', 0);
            else if (w.effect === 'poison') applyStatusEffect(e, 'poison', 4);
            else if (w.effect === 'lightning') {
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
      if (didHit) audio.play('hit');
      spawnParticles(state, attackPos, '#aaa', 3);
    }
  }

  // ── Ability (Space) ──
  if (state.keys.has(' ') && p.abilityTimer <= 0 && p.mana >= 20) {
    p.abilityTimer = p.abilityCooldown;
    p.mana -= 20;
    audio.play('ability');

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
      if (p.iFrames <= 0 && dist(proj.pos, p.pos) < proj.radius + p.width / 2) {
        p.hp -= proj.damage;
        p.iFrames = 0.5;
        spawnParticles(state, p.pos, '#e74c3c', 6);
        spawnDamageNumber(state, p.pos, proj.damage, '#ff6b6b');
        state.screenShake = 0.12;
        audio.play('player_hurt');
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

    if (trap.active && (trap.type === 'spikes' || trap.type === 'fire_vent')) {
      if (p.iFrames <= 0 && dist(p.pos, trap.pos) < trap.width) {
        p.hp -= Math.floor(trap.damage * 0.3);
        p.iFrames = 0.3;
        spawnDamageNumber(state, p.pos, Math.floor(trap.damage * 0.3), '#e74c3c');
        if (trap.type === 'fire_vent') applyStatusEffect(p, 'burn', 3);
      }
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
      if (e.state === 'chase') {
        if (d > 150) {
          const dir = normalize({ x: p.pos.x - e.pos.x, y: p.pos.y - e.pos.y });
          e.pos.x += dir.x * e.speed * dt;
          e.pos.y += dir.y * e.speed * dt;
        } else if (d < 100) {
          const dir = normalize({ x: e.pos.x - p.pos.x, y: e.pos.y - p.pos.y });
          e.pos.x += dir.x * e.speed * 0.7 * dt;
          e.pos.y += dir.y * e.speed * 0.7 * dt;
        }

        if (e.shootTimer <= 0 && d < 300) {
          e.shootTimer = e.shootCooldown;
          const dir = normalize({ x: p.pos.x - e.pos.x, y: p.pos.y - e.pos.y });

          if (e.type === 'boss' && e.phase === 2) {
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
          audio.play('player_hurt');
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

    // Clamp enemy
    e.pos.x = Math.max(TILE + e.width / 2, Math.min(ROOM_W - TILE - e.width / 2, e.pos.x));
    e.pos.y = Math.max(TILE + e.height / 2, Math.min(ROOM_H - TILE - e.height / 2, e.pos.y));

    // Death
    if (e.hp <= 0) {
      e.alive = false;
      p.killCount++;
      spawnParticles(state, e.pos, '#e74c3c', 15);
      spawnLoot(state, e.pos, e.goldValue, state.dungeon.tier);
      p.xp += e.xpValue;
      audio.play('enemy_death');

      if (p.xp >= p.xpToNext) {
        triggerLevelUp(state);
      }
    }
  }

  state.enemies = state.enemies.filter(e => e.alive);

  // ── Room Clear ──
  if (room.type !== 'start' && room.type !== 'treasure' && room.type !== 'shop' && !room.cleared && state.enemies.length === 0) {
    room.cleared = true;
    state.roomsCleared++;
    for (const door of room.doors) door.locked = false;
    for (const door of room.doors) {
      const targetRoom = state.dungeon.rooms[door.targetRoom];
      for (const td of targetRoom.doors) {
        if (td.targetRoom === room.id) td.locked = false;
      }
    }
    notify(state, 'ROOM CLEARED!', '#f1c40f');
    p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.15));

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
        state.chests = [...startRoom.chests];
        state.torches = [...startRoom.torches];
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
        audio.play('pickup_gold');
      } else if (l.type === 'health') {
        p.hp = Math.min(p.maxHp, p.hp + l.value);
        spawnDamageNumber(state, l.pos, l.value, '#2ecc71');
        audio.play('pickup_health');
      } else if (l.type === 'mana') {
        p.mana = Math.min(p.maxMana, p.mana + l.value);
        spawnDamageNumber(state, l.pos, l.value, '#74c0fc');
        audio.play('pickup_health');
      } else if (l.type === 'weapon' && l.weapon) {
        if (p.inventory.length < 8) {
          p.inventory.push(l.weapon);
          notify(state, `Found: ${l.weapon.name} (${l.weapon.rarity})`, RARITY_COLORS[l.weapon.rarity]);
          audio.play('pickup_weapon');
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
  if (p.hp <= 0 && p.alive) {
    p.alive = false;
    state.gameOver = true;
    spawnParticles(state, p.pos, '#e74c3c', 30);
    audio.play('game_over');
  }

  // Clamp
  p.pos.x = Math.max(TILE + p.width / 2, Math.min(ROOM_W - TILE - p.width / 2, p.pos.x));
  p.pos.y = Math.max(TILE + p.height / 2, Math.min(ROOM_H - TILE - p.height / 2, p.pos.y));
}
