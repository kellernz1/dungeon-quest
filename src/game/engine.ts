import {
  GameState, Enemy,
  Room, Vector2, HeroClass, HERO_CONFIGS, EnemyType,
} from './types';

const TILE = 32;
const ROOM_W = 800;
const ROOM_H = 600;

/** Create initial player */
function createPlayer(heroClass: HeroClass): Player {
  const cfg = HERO_CONFIGS[heroClass];
  return {
    pos: { x: ROOM_W / 2, y: ROOM_H / 2 },
    vel: { x: 0, y: 0 },
    width: 24, height: 24,
    hp: cfg.hp, maxHp: cfg.hp,
    alive: true,
    speed: cfg.speed,
    attackCooldown: cfg.attackSpeed,
    attackTimer: 0,
    attackDamage: cfg.damage,
    attackRange: cfg.attackRange,
    facing: { x: 1, y: 0 },
    isAttacking: false,
    attackAnimTimer: 0,
    iFrames: 0,
    xp: 0, xpToNext: 100, level: 1, gold: 0,
    mana: cfg.mana, maxMana: cfg.mana,
    heroClass,
    abilityTimer: 0,
    abilityCooldown: 3,
  };
}

/** Create an enemy */
function createEnemy(type: EnemyType, x: number, y: number): Enemy {
  const configs: Record<EnemyType, { hp: number; speed: number; damage: number; size: number; xp: number; gold: number }> = {
    goblin: { hp: 30, speed: 100, damage: 8, size: 18, xp: 15, gold: 5 },
    skeleton: { hp: 50, speed: 80, damage: 12, size: 20, xp: 25, gold: 8 },
    orc: { hp: 90, speed: 60, damage: 20, size: 26, xp: 40, gold: 15 },
    boss: { hp: 300, speed: 50, damage: 30, size: 36, xp: 200, gold: 100 },
  };
  const c = configs[type];
  return {
    pos: { x, y }, vel: { x: 0, y: 0 },
    width: c.size, height: c.size,
    hp: c.hp, maxHp: c.hp, alive: true,
    speed: c.speed, damage: c.damage,
    attackCooldown: 1, attackTimer: 0,
    state: 'idle', type,
    knockbackTimer: 0, flashTimer: 0,
    xpValue: c.xp, goldValue: c.gold,
  };
}

/** Generate room with walls */
function generateRoom(wave: number): Room {
  const walls: Room['walls'] = [];
  // Border walls
  const wallThickness = TILE;
  walls.push({ x: 0, y: 0, w: ROOM_W, h: wallThickness }); // top
  walls.push({ x: 0, y: ROOM_H - wallThickness, w: ROOM_W, h: wallThickness }); // bottom
  walls.push({ x: 0, y: 0, w: wallThickness, h: ROOM_H }); // left
  walls.push({ x: ROOM_W - wallThickness, y: 0, w: wallThickness, h: ROOM_H }); // right

  // Interior obstacles
  if (wave > 1) {
    const numObstacles = Math.min(wave, 6);
    for (let i = 0; i < numObstacles; i++) {
      const ox = TILE * 2 + Math.random() * (ROOM_W - TILE * 6);
      const oy = TILE * 2 + Math.random() * (ROOM_H - TILE * 6);
      walls.push({ x: ox, y: oy, w: TILE * 2, h: TILE });
    }
  }

  // Spawn enemies
  const enemies: Enemy[] = [];
  const count = Math.min(3 + wave * 2, 20);
  for (let i = 0; i < count; i++) {
    const types: EnemyType[] = wave < 3 ? ['goblin'] : wave < 5 ? ['goblin', 'skeleton'] : ['goblin', 'skeleton', 'orc'];
    const type = types[Math.floor(Math.random() * types.length)];
    const ex = TILE * 2 + Math.random() * (ROOM_W - TILE * 4);
    const ey = TILE * 2 + Math.random() * (ROOM_H - TILE * 4);
    enemies.push(createEnemy(type, ex, ey));
  }
  // Boss every 5 waves
  if (wave % 5 === 0 && wave > 0) {
    enemies.push(createEnemy('boss', ROOM_W / 2, ROOM_H / 4));
  }

  return {
    x: 0, y: 0, width: ROOM_W, height: ROOM_H,
    walls, enemies, cleared: false,
    doors: [],
  };
}

/** Initialize game state */
export function initGameState(heroClass: HeroClass): GameState {
  const room = generateRoom(1);
  return {
    player: createPlayer(heroClass),
    enemies: room.enemies,
    projectiles: [],
    particles: [],
    loot: [],
    damageNumbers: [],
    room,
    keys: new Set(),
    mouse: { x: 0, y: 0 },
    mouseDown: false,
    screenShake: 0,
    roomsCleared: 0,
    wave: 1,
    waveTimer: 0,
    gameOver: false,
    paused: false,
  };
}

/** Distance between two points */
function dist(a: Vector2, b: Vector2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Normalize a vector */
function normalize(v: Vector2): Vector2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/** Check AABB collision */
function aabbCollision(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** Spawn particles */
function spawnParticles(state: GameState, pos: Vector2, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 150;
    state.particles.push({
      pos: { x: pos.x, y: pos.y },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      lifetime: 0.3 + Math.random() * 0.4,
      maxLifetime: 0.3 + Math.random() * 0.4,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

/** Spawn damage number */
function spawnDamageNumber(state: GameState, pos: Vector2, value: number, color: string, isCrit = false) {
  state.damageNumbers.push({
    pos: { x: pos.x + (Math.random() - 0.5) * 20, y: pos.y - 10 },
    value, lifetime: 0.8, color, isCrit,
  });
}

/** Spawn loot */
function spawnLoot(state: GameState, pos: Vector2, goldValue: number) {
  // Gold
  state.loot.push({
    pos: { x: pos.x + (Math.random() - 0.5) * 30, y: pos.y + (Math.random() - 0.5) * 30 },
    type: 'gold', value: goldValue,
    rarity: 'common', lifetime: 15, bobOffset: Math.random() * Math.PI * 2,
  });
  // Chance for health potion
  if (Math.random() < 0.3) {
    state.loot.push({
      pos: { x: pos.x + (Math.random() - 0.5) * 30, y: pos.y + (Math.random() - 0.5) * 30 },
      type: 'health', value: 20,
      rarity: 'common', lifetime: 15, bobOffset: Math.random() * Math.PI * 2,
    });
  }
}

/** Main update function */
export function updateGame(state: GameState, dt: number): void {
  if (state.gameOver || state.paused) return;

  const p = state.player;

  // -- Player movement --
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

  // Apply velocity
  p.pos.x += p.vel.x * dt;
  p.pos.y += p.vel.y * dt;

  // Wall collision
  for (const w of state.room.walls) {
    if (aabbCollision(p.pos.x - p.width / 2, p.pos.y - p.height / 2, p.width, p.height, w.x, w.y, w.w, w.h)) {
      // Push player out
      const overlapX = Math.min(
        p.pos.x + p.width / 2 - w.x,
        w.x + w.w - (p.pos.x - p.width / 2)
      );
      const overlapY = Math.min(
        p.pos.y + p.height / 2 - w.y,
        w.y + w.h - (p.pos.y - p.height / 2)
      );
      if (overlapX < overlapY) {
        p.pos.x += p.pos.x < w.x + w.w / 2 ? -overlapX : overlapX;
      } else {
        p.pos.y += p.pos.y < w.y + w.h / 2 ? -overlapY : overlapY;
      }
    }
  }

  // -- Player attack --
  p.attackTimer -= dt;
  p.attackAnimTimer -= dt;
  p.iFrames -= dt;
  p.abilityTimer -= dt;

  if (state.mouseDown && p.attackTimer <= 0) {
    p.attackTimer = p.attackCooldown;
    p.isAttacking = true;
    p.attackAnimTimer = 0.15;

    const dir = normalize({ x: state.mouse.x - p.pos.x, y: state.mouse.y - p.pos.y });
    p.facing = dir;

    if (p.heroClass === 'archer' || p.heroClass === 'mage') {
      // Ranged attack — spawn projectile
      const speed = p.heroClass === 'mage' ? 350 : 450;
      state.projectiles.push({
        pos: { x: p.pos.x, y: p.pos.y },
        vel: { x: dir.x * speed, y: dir.y * speed },
        damage: p.attackDamage,
        radius: p.heroClass === 'mage' ? 6 : 4,
        lifetime: 1.5,
        fromPlayer: true,
      });
      spawnParticles(state, p.pos, p.heroClass === 'mage' ? '#3498db' : '#27ae60', 3);
    } else {
      // Melee attack — hit enemies in arc
      const attackPos = { x: p.pos.x + dir.x * p.attackRange, y: p.pos.y + dir.y * p.attackRange };
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist(attackPos, e.pos) < p.attackRange + e.width / 2) {
          const isCrit = Math.random() < 0.15;
          const dmg = isCrit ? Math.floor(p.attackDamage * 2) : p.attackDamage;
          e.hp -= dmg;
          e.flashTimer = 0.1;
          e.knockbackTimer = 0.15;
          const kb = normalize({ x: e.pos.x - p.pos.x, y: e.pos.y - p.pos.y });
          e.vel = { x: kb.x * 300, y: kb.y * 300 };
          spawnParticles(state, e.pos, '#e74c3c', 5);
          spawnDamageNumber(state, e.pos, dmg, isCrit ? '#f1c40f' : '#e74c3c', isCrit);
          state.screenShake = 0.1;
        }
      }
      spawnParticles(state, attackPos, '#aaa', 3);
    }
  }

  // -- Ability (Space key) --
  if (state.keys.has(' ') && p.abilityTimer <= 0 && p.mana >= 20) {
    p.abilityTimer = p.abilityCooldown;
    p.mana -= 20;

    if (p.heroClass === 'warrior') {
      // Spin attack — damage all nearby enemies
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist(p.pos, e.pos) < 80) {
          e.hp -= p.attackDamage * 2;
          e.flashTimer = 0.15;
          const kb = normalize({ x: e.pos.x - p.pos.x, y: e.pos.y - p.pos.y });
          e.vel = { x: kb.x * 400, y: kb.y * 400 };
          e.knockbackTimer = 0.2;
          spawnDamageNumber(state, e.pos, p.attackDamage * 2, '#f39c12', true);
        }
      }
      spawnParticles(state, p.pos, '#e74c3c', 20);
      state.screenShake = 0.2;
    } else if (p.heroClass === 'mage') {
      // Frost nova
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist(p.pos, e.pos) < 120) {
          e.hp -= p.attackDamage * 1.5;
          e.speed *= 0.5;
          e.flashTimer = 0.2;
          spawnDamageNumber(state, e.pos, Math.floor(p.attackDamage * 1.5), '#3498db', false);
        }
      }
      spawnParticles(state, p.pos, '#3498db', 25);
      state.screenShake = 0.15;
    } else if (p.heroClass === 'archer') {
      // Multi-shot
      for (let i = -2; i <= 2; i++) {
        const angle = Math.atan2(p.facing.y, p.facing.x) + i * 0.25;
        state.projectiles.push({
          pos: { x: p.pos.x, y: p.pos.y },
          vel: { x: Math.cos(angle) * 450, y: Math.sin(angle) * 450 },
          damage: p.attackDamage,
          radius: 4, lifetime: 1,
          fromPlayer: true,
        });
      }
      spawnParticles(state, p.pos, '#27ae60', 10);
    } else if (p.heroClass === 'rogue') {
      // Dash
      p.pos.x += p.facing.x * 120;
      p.pos.y += p.facing.y * 120;
      p.iFrames = 0.5;
      // Damage enemies along path
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist(p.pos, e.pos) < 60) {
          e.hp -= p.attackDamage * 3;
          e.flashTimer = 0.15;
          spawnDamageNumber(state, e.pos, p.attackDamage * 3, '#8e44ad', true);
        }
      }
      spawnParticles(state, p.pos, '#8e44ad', 15);
      state.screenShake = 0.1;
    }
  }

  // Mana regen
  p.mana = Math.min(p.maxMana, p.mana + 5 * dt);

  // -- Projectiles --
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const proj = state.projectiles[i];
    proj.pos.x += proj.vel.x * dt;
    proj.pos.y += proj.vel.y * dt;
    proj.lifetime -= dt;

    if (proj.lifetime <= 0) {
      state.projectiles.splice(i, 1);
      continue;
    }

    // Wall collision
    let hitWall = false;
    for (const w of state.room.walls) {
      if (proj.pos.x > w.x && proj.pos.x < w.x + w.w && proj.pos.y > w.y && proj.pos.y < w.y + w.h) {
        hitWall = true;
        break;
      }
    }
    if (hitWall) {
      spawnParticles(state, proj.pos, '#888', 3);
      state.projectiles.splice(i, 1);
      continue;
    }

    if (proj.fromPlayer) {
      // Hit enemies
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist(proj.pos, e.pos) < proj.radius + e.width / 2) {
          const isCrit = Math.random() < 0.1;
          const dmg = isCrit ? Math.floor(proj.damage * 2) : proj.damage;
          e.hp -= dmg;
          e.flashTimer = 0.1;
          e.knockbackTimer = 0.1;
          const kb = normalize({ x: e.pos.x - proj.pos.x, y: e.pos.y - proj.pos.y });
          e.vel = { x: kb.x * 200, y: kb.y * 200 };
          spawnParticles(state, e.pos, '#e74c3c', 4);
          spawnDamageNumber(state, e.pos, dmg, isCrit ? '#f1c40f' : '#e74c3c', isCrit);
          state.projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  // -- Enemy AI --
  for (const e of state.enemies) {
    if (!e.alive) continue;

    e.attackTimer -= dt;
    e.knockbackTimer -= dt;
    e.flashTimer -= dt;

    if (e.knockbackTimer > 0) {
      e.pos.x += e.vel.x * dt;
      e.pos.y += e.vel.y * dt;
      continue;
    }

    const d = dist(e.pos, p.pos);

    if (d < 200) {
      e.state = 'chase';
    }

    if (e.state === 'chase') {
      const dir = normalize({ x: p.pos.x - e.pos.x, y: p.pos.y - e.pos.y });
      e.pos.x += dir.x * e.speed * dt;
      e.pos.y += dir.y * e.speed * dt;

      // Attack player
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
      // Idle patrol
      if (Math.random() < 0.01) {
        const angle = Math.random() * Math.PI * 2;
        e.vel = { x: Math.cos(angle) * e.speed * 0.3, y: Math.sin(angle) * e.speed * 0.3 };
      }
      e.pos.x += e.vel.x * dt;
      e.pos.y += e.vel.y * dt;
    }

    // Wall collision
    e.pos.x = Math.max(TILE + e.width / 2, Math.min(ROOM_W - TILE - e.width / 2, e.pos.x));
    e.pos.y = Math.max(TILE + e.height / 2, Math.min(ROOM_H - TILE - e.height / 2, e.pos.y));

    // Check death
    if (e.hp <= 0) {
      e.alive = false;
      spawnParticles(state, e.pos, enemyColor(e.type), 15);
      spawnLoot(state, e.pos, e.goldValue);
      p.xp += e.xpValue;

      // Level up
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
        spawnDamageNumber(state, { x: p.pos.x, y: p.pos.y - 20 }, 0, '#f1c40f');
      }
    }
  }

  // Remove dead enemies
  state.enemies = state.enemies.filter(e => e.alive);

  // -- Wave clear --
  if (state.enemies.length === 0) {
    state.waveTimer += dt;
    if (state.waveTimer >= 2) {
      state.wave++;
      state.roomsCleared++;
      state.waveTimer = 0;
      const room = generateRoom(state.wave);
      state.room = room;
      state.enemies = room.enemies;
      p.pos = { x: ROOM_W / 2, y: ROOM_H / 2 };
      // Heal between waves
      p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.2));
    }
  }

  // -- Loot pickup --
  for (let i = state.loot.length - 1; i >= 0; i--) {
    const l = state.loot[i];
    l.lifetime -= dt;
    if (l.lifetime <= 0) {
      state.loot.splice(i, 1);
      continue;
    }
    if (dist(l.pos, p.pos) < 25) {
      if (l.type === 'gold') {
        p.gold += l.value;
        spawnDamageNumber(state, l.pos, l.value, '#f1c40f');
      } else if (l.type === 'health') {
        p.hp = Math.min(p.maxHp, p.hp + l.value);
        spawnDamageNumber(state, l.pos, l.value, '#2ecc71');
      }
      spawnParticles(state, l.pos, '#f1c40f', 5);
      state.loot.splice(i, 1);
    }
  }

  // -- Particles --
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const part = state.particles[i];
    part.pos.x += part.vel.x * dt;
    part.pos.y += part.vel.y * dt;
    part.vel.x *= 0.95;
    part.vel.y *= 0.95;
    part.lifetime -= dt;
    if (part.lifetime <= 0) {
      state.particles.splice(i, 1);
    }
  }

  // -- Damage numbers --
  for (let i = state.damageNumbers.length - 1; i >= 0; i--) {
    const dn = state.damageNumbers[i];
    dn.pos.y -= 40 * dt;
    dn.lifetime -= dt;
    if (dn.lifetime <= 0) {
      state.damageNumbers.splice(i, 1);
    }
  }

  // -- Screen shake decay --
  state.screenShake *= 0.9;
  if (state.screenShake < 0.01) state.screenShake = 0;

  // -- Player death --
  if (p.hp <= 0) {
    p.alive = false;
    state.gameOver = true;
    spawnParticles(state, p.pos, '#e74c3c', 30);
  }

  // Clamp player position
  p.pos.x = Math.max(TILE + p.width / 2, Math.min(ROOM_W - TILE - p.width / 2, p.pos.x));
  p.pos.y = Math.max(TILE + p.height / 2, Math.min(ROOM_H - TILE - p.height / 2, p.pos.y));
}

function enemyColor(type: EnemyType): string {
  switch (type) {
    case 'goblin': return '#2ecc71';
    case 'skeleton': return '#bdc3c7';
    case 'orc': return '#e67e22';
    case 'boss': return '#e74c3c';
  }
}

/** Render game state to canvas */
export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  const { player: p, room } = state;

  ctx.save();

  // Screen shake
  if (state.screenShake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * state.screenShake * 30,
      (Math.random() - 0.5) * state.screenShake * 30,
    );
  }

  // -- Floor --
  ctx.fillStyle = '#2a2520';
  ctx.fillRect(0, 0, ROOM_W, ROOM_H);

  // Floor tiles
  for (let x = TILE; x < ROOM_W - TILE; x += TILE) {
    for (let y = TILE; y < ROOM_H - TILE; y += TILE) {
      const brightness = ((x + y) / TILE) % 2 === 0 ? '#2e2924' : '#26221e';
      ctx.fillStyle = brightness;
      ctx.fillRect(x, y, TILE, TILE);
    }
  }

  // -- Walls --
  for (const w of room.walls) {
    ctx.fillStyle = '#1a1714';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    // Wall top highlight
    ctx.fillStyle = '#332e28';
    ctx.fillRect(w.x, w.y, w.w, 3);
  }

  // -- Loot --
  for (const l of state.loot) {
    const bob = Math.sin(time * 3 + l.bobOffset) * 3;
    ctx.save();
    ctx.translate(l.pos.x, l.pos.y + bob);

    if (l.type === 'gold') {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (l.type === 'health') {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-4, -2, 8, 4);
      ctx.fillRect(-2, -4, 4, 8);
    }
    ctx.restore();
  }

  // -- Enemies --
  for (const e of state.enemies) {
    if (!e.alive) continue;
    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, e.height / 2, e.width / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const baseColor = e.flashTimer > 0 ? '#fff' : enemyColor(e.type);
    ctx.fillStyle = baseColor;

    if (e.type === 'boss') {
      // Boss — larger, with horns
      ctx.beginPath();
      ctx.arc(0, 0, e.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(-e.width / 2, -e.height / 2 - 8, 6, 10);
      ctx.fillRect(e.width / 2 - 6, -e.height / 2 - 8, 6, 10);
    } else {
      ctx.fillRect(-e.width / 2, -e.height / 2, e.width, e.height);
    }

    // Eyes
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-4, -3, 3, 3);
    ctx.fillRect(2, -3, 3, 3);

    // HP bar
    if (e.hp < e.maxHp) {
      ctx.fillStyle = '#333';
      ctx.fillRect(-e.width / 2, -e.height / 2 - 8, e.width, 4);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-e.width / 2, -e.height / 2 - 8, e.width * (e.hp / e.maxHp), 4);
    }

    ctx.restore();
  }

  // -- Player --
  if (p.alive) {
    ctx.save();
    ctx.translate(p.pos.x, p.pos.y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, p.height / 2, p.width / 2 + 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // I-frames flash
    if (p.iFrames > 0 && Math.floor(p.iFrames * 20) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Body
    const cfg = HERO_CONFIGS[p.heroClass];
    ctx.fillStyle = cfg.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
    ctx.fill();

    // Inner detail
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

    // Attack animation
    if (p.attackAnimTimer > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      const angle = Math.atan2(p.facing.y, p.facing.x);
      ctx.beginPath();
      ctx.arc(0, 0, p.attackRange, angle - 0.6, angle + 0.6);
      ctx.stroke();
    }

    ctx.restore();
  }

  // -- Projectiles --
  for (const proj of state.projectiles) {
    ctx.save();
    ctx.translate(proj.pos.x, proj.pos.y);
    ctx.fillStyle = proj.fromPlayer ?
      (state.player.heroClass === 'mage' ? '#3498db' : '#27ae60') : '#e74c3c';
    ctx.beginPath();
    ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    ctx.fillStyle = proj.fromPlayer ?
      (state.player.heroClass === 'mage' ? 'rgba(52,152,219,0.3)' : 'rgba(39,174,96,0.3)') : 'rgba(231,76,60,0.3)';
    ctx.beginPath();
    ctx.arc(0, 0, proj.radius * 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // -- Particles --
  for (const part of state.particles) {
    ctx.globalAlpha = part.lifetime / part.maxLifetime;
    ctx.fillStyle = part.color;
    ctx.fillRect(part.pos.x - part.size / 2, part.pos.y - part.size / 2, part.size, part.size);
  }
  ctx.globalAlpha = 1;

  // -- Damage numbers --
  for (const dn of state.damageNumbers) {
    ctx.globalAlpha = dn.lifetime / 0.8;
    ctx.font = dn.isCrit ? 'bold 18px Inter' : '14px Inter';
    ctx.fillStyle = dn.color;
    ctx.textAlign = 'center';
    if (dn.value === 0) {
      ctx.fillText('LEVEL UP!', dn.pos.x, dn.pos.y);
    } else {
      ctx.fillText(dn.value.toString(), dn.pos.x, dn.pos.y);
    }
  }
  ctx.globalAlpha = 1;

  // -- Wave clear message --
  if (state.enemies.length === 0 && !state.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(ROOM_W / 2 - 120, ROOM_H / 2 - 25, 240, 50);
    ctx.font = 'bold 20px Cinzel';
    ctx.fillStyle = '#f1c40f';
    ctx.textAlign = 'center';
    ctx.fillText('ROOM CLEARED!', ROOM_W / 2, ROOM_H / 2 + 7);
  }

  // -- Game over --
  if (state.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);
    ctx.font = 'bold 36px Cinzel';
    ctx.fillStyle = '#e74c3c';
    ctx.textAlign = 'center';
    ctx.fillText('DEFEATED', ROOM_W / 2, ROOM_H / 2 - 20);
    ctx.font = '16px Inter';
    ctx.fillStyle = '#bdc3c7';
    ctx.fillText(`Wave ${state.wave} · ${state.roomsCleared} rooms cleared`, ROOM_W / 2, ROOM_H / 2 + 15);
    ctx.fillText('Click to restart', ROOM_W / 2, ROOM_H / 2 + 45);
  }

  ctx.restore();
}
