import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateDungeon, initGameState, updateGame } from '@/game/engine';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('game engine', () => {
  it('generates procedural dungeons with required shop, boss, and bounded room count', () => {
    for (let tier = 1; tier <= 4; tier++) {
      const dungeon = generateDungeon(tier);
      expect(dungeon.rooms.length).toBeLessThanOrEqual(11);
      expect(dungeon.rooms.filter((room) => room.type === 'start')).toHaveLength(1);
      expect(dungeon.rooms.filter((room) => room.type === 'shop')).toHaveLength(1);
      expect(dungeon.rooms.filter((room) => room.type === 'boss')).toHaveLength(1);

      const visited = new Set<number>();
      const queue = [dungeon.currentRoomId];
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        for (const door of dungeon.rooms[id].doors) queue.push(door.targetRoom);
      }

      const boss = dungeon.rooms.find((room) => room.type === 'boss')!;
      expect(visited.has(boss.id)).toBe(true);
      expect(visited.size).toBe(dungeon.rooms.length);
    }
  });

  it('transitions through an open door before wall collision blocks the player', () => {
    const state = initGameState('warrior');
    const startRoom = state.room;
    const openDoor = startRoom.doors.find((door) => !door.locked);

    expect(openDoor).toBeDefined();
    expect(openDoor?.locked).toBe(false);

    state.player.pos = { x: openDoor!.x + 16, y: openDoor!.y + 16 };
    updateGame(state, 1 / 60);

    expect(state.dungeon.currentRoomId).toBe(openDoor!.targetRoom);
    expect(state.room.id).toBe(openDoor!.targetRoom);
  });

  it('keeps combat room doors locked while enemies are alive', () => {
    const state = initGameState('warrior');
    const combatRoom = state.dungeon.rooms.find((room) => room.type === 'combat');
    expect(combatRoom).toBeDefined();

    state.dungeon.currentRoomId = combatRoom!.id;
    state.room = combatRoom!;
    state.enemies = [...combatRoom!.enemies];
    const exitDoor = combatRoom!.doors[0];

    state.player.pos = { x: exitDoor.x + 16, y: exitDoor.y + 16 };
    updateGame(state, 1 / 60);

    expect(state.dungeon.currentRoomId).toBe(combatRoom!.id);
    expect(exitDoor.locked).toBe(true);
  });

  it('kills a boss when its hp reaches zero', () => {
    const state = initGameState('mage');
    const bossRoom = state.dungeon.rooms.find((room) => room.type === 'boss');
    expect(bossRoom).toBeDefined();

    state.dungeon.currentRoomId = bossRoom!.id;
    state.room = bossRoom!;
    state.enemies = [...bossRoom!.enemies];
    state.enemies[0].hp = 0;

    updateGame(state, 1 / 60);

    expect(state.enemies.some((enemy) => enemy.type === 'boss' && enemy.alive)).toBe(false);
    expect(state.bossOutro).not.toBeNull();
  });

  it('does not let player projectiles knock back bosses', () => {
    const state = initGameState('archer');
    const bossRoom = state.dungeon.rooms.find((room) => room.type === 'boss');
    expect(bossRoom).toBeDefined();

    state.dungeon.currentRoomId = bossRoom!.id;
    state.room = bossRoom!;
    state.enemies = [...bossRoom!.enemies];
    const boss = state.enemies[0];
    const startPos = { ...boss.pos };
    state.player.pos = { ...boss.pos };

    state.projectiles.push({
      pos: { ...boss.pos },
      vel: { x: 0, y: 0 },
      damage: 1,
      radius: 6,
      lifetime: 1,
      fromPlayer: true,
    });

    updateGame(state, 1 / 60);

    expect(boss.knockbackTimer).toBeLessThanOrEqual(0);
    expect(boss.vel).toEqual({ x: 0, y: 0 });
    expect(boss.pos).toEqual(startPos);
  });

  it('enemy health drops heal exactly 10 hp', () => {
    const state = initGameState('warrior');
    const combatRoom = state.dungeon.rooms.find((room) => room.type === 'combat' && room.enemies.length > 0);
    expect(combatRoom).toBeDefined();

    state.room = combatRoom!;
    state.dungeon.currentRoomId = combatRoom!.id;
    state.enemies = [combatRoom!.enemies[0]];
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const enemy = state.enemies[0];
    enemy.hp = 0;
    updateGame(state, 1 / 60);

    const healthDrops = state.loot.filter((loot) => loot.type === 'health');
    expect(healthDrops.length).toBeGreaterThan(0);
    expect(healthDrops.every((loot) => loot.value === 10)).toBe(true);
  });

  it('active spike traps do not damage enemies', () => {
    const state = initGameState('warrior');
    const combatRoom = state.dungeon.rooms.find((room) => room.type === 'combat' && room.traps.length > 0);
    expect(combatRoom).toBeDefined();

    state.room = combatRoom!;
    state.dungeon.currentRoomId = combatRoom!.id;
    state.enemies = [...combatRoom!.enemies];
    state.traps = [{
      pos: { ...state.enemies[0].pos },
      width: 28,
      height: 28,
      type: 'spikes',
      damage: 100,
      cooldown: 2,
      timer: 1,
      active: true,
    }];
    const enemyHp = state.enemies[0].hp;
    state.player.pos = { x: 400, y: 300 };

    updateGame(state, 1 / 60);

    expect(state.enemies[0].hp).toBe(enemyHp);
  });
});
