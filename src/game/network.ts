import {
  CoopEvent,
  CoopWorldSnapshot,
  DungeonRoom,
  GameState,
  HeroClass,
  RemotePlayer,
} from './types';

type CoopMessage =
  | { type: 'joined'; playerId: string; roomCode: string; isHost: boolean; players: ServerPlayer[]; world?: CoopWorldSnapshot | null }
  | { type: 'snapshot'; players: ServerPlayer[]; world?: CoopWorldSnapshot | null }
  | { type: 'world'; world: CoopWorldSnapshot }
  | { type: 'clientEvent'; event: CoopEvent }
  | { type: 'playerJoined'; player: ServerPlayer }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'hostChanged'; hostId: string | null }
  | { type: 'error'; message: string }
  | { type: 'pong'; time: number };

interface ServerPlayer {
  id: string;
  name: string;
  heroClass: HeroClass;
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  aimX: number;
  aimY: number;
  hp: number;
  maxHp: number;
  level: number;
  roomId: number;
  isHost: boolean;
  updatedAt: number;
}

export class CoopClient {
  private ws: WebSocket | null = null;
  private lastSend = 0;
  private lastWorldSend = 0;
  private worldVersion = 0;
  private readonly url: string;

  constructor(url = import.meta.env.VITE_COOP_URL || defaultCoopUrl()) {
    this.url = url;
  }

  connect(state: GameState, roomCode?: string) {
    this.disconnect(state);
    state.coop.enabled = true;
    state.coop.connecting = true;
    state.coop.connected = false;
    state.coop.role = null;
    state.coop.error = null;
    state.coop.worldVersion = 0;
    state.coop.outgoingEvents = [];
    state.coop.incomingEvents = [];
    this.worldVersion = 0;

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'join',
        roomCode: roomCode?.trim().toUpperCase() || undefined,
        heroClass: state.player.heroClass,
        name: `${state.player.heroClass}-${Math.floor(Math.random() * 1000)}`,
      }));
    };

    ws.onmessage = (event) => {
      const message = this.parse(event.data);
      if (!message) return;
      this.handleMessage(state, message);
    };

    ws.onerror = () => {
      state.coop.error = 'Could not connect to co-op server';
      state.coop.connecting = false;
    };

    ws.onclose = () => {
      state.coop.connected = false;
      state.coop.connecting = false;
      state.coop.role = null;
      state.coop.remotePlayers = [];
    };
  }

  disconnect(state: GameState) {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) this.ws.close();
    this.ws = null;
    state.coop.enabled = false;
    state.coop.connected = false;
    state.coop.connecting = false;
    state.coop.role = null;
    state.coop.roomCode = null;
    state.coop.playerId = null;
    state.coop.remotePlayers = [];
    state.coop.worldVersion = 0;
    state.coop.outgoingEvents = [];
    state.coop.incomingEvents = [];
    this.worldVersion = 0;
  }

  tick(state: GameState, now: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !state.coop.connected) return;

    while (state.coop.outgoingEvents.length > 0) {
      this.ws.send(JSON.stringify({ type: 'event', event: state.coop.outgoingEvents.shift() }));
    }

    if (now - this.lastSend >= 50) {
      this.lastSend = now;
      this.ws.send(JSON.stringify({
        type: 'state',
        heroClass: state.player.heroClass,
        x: state.player.pos.x,
        y: state.player.pos.y,
        facingX: state.player.facing.x,
        facingY: state.player.facing.y,
        aimX: state.mouse.x,
        aimY: state.mouse.y,
        hp: state.player.hp,
        maxHp: state.player.maxHp,
        level: state.player.level,
        roomId: state.dungeon.currentRoomId,
      }));
    }

    if (state.coop.role === 'host' && now - this.lastWorldSend >= 100) {
      this.lastWorldSend = now;
      this.worldVersion += 1;
      const world = makeWorldSnapshot(state, this.worldVersion);
      state.coop.worldVersion = world.version;
      this.ws.send(JSON.stringify({ type: 'world', world }));
    }
  }

  private parse(data: unknown): CoopMessage | null {
    try {
      return JSON.parse(String(data)) as CoopMessage;
    } catch {
      return null;
    }
  }

  private handleMessage(state: GameState, message: CoopMessage) {
    if (message.type === 'joined') {
      state.coop.connected = true;
      state.coop.connecting = false;
      state.coop.playerId = message.playerId;
      state.coop.roomCode = message.roomCode;
      state.coop.role = message.isHost ? 'host' : 'guest';
      state.coop.remotePlayers = this.toRemotePlayers(message.players, message.playerId);
      if (!message.isHost && message.world) applyWorldSnapshot(state, message.world);
      return;
    }

    if (message.type === 'snapshot') {
      state.coop.remotePlayers = this.toRemotePlayers(message.players, state.coop.playerId);
      if (state.coop.role === 'guest' && message.world) applyWorldSnapshot(state, message.world);
      return;
    }

    if (message.type === 'world') {
      if (state.coop.role === 'guest') applyWorldSnapshot(state, message.world);
      return;
    }

    if (message.type === 'clientEvent') {
      if (state.coop.role === 'host') state.coop.incomingEvents.push(message.event);
      return;
    }

    if (message.type === 'hostChanged') {
      state.coop.role = message.hostId === state.coop.playerId ? 'host' : 'guest';
      return;
    }

    if (message.type === 'playerLeft') {
      state.coop.remotePlayers = state.coop.remotePlayers.filter(p => p.id !== message.playerId);
      return;
    }

    if (message.type === 'error') {
      state.coop.error = message.message;
      state.coop.connecting = false;
    }
  }

  private toRemotePlayers(players: ServerPlayer[], selfId: string | null): RemotePlayer[] {
    return players
      .filter(player => player.id !== selfId)
      .map(player => ({
        id: player.id,
        name: player.isHost ? `${player.name} (Host)` : player.name,
        heroClass: player.heroClass,
        pos: { x: player.x, y: player.y },
        facing: { x: player.facingX || 1, y: player.facingY || 0 },
        aim: { x: player.aimX || player.x + 50, y: player.aimY || player.y },
        hp: player.hp,
        maxHp: player.maxHp,
        level: player.level,
        roomId: player.roomId,
        lastSeen: player.updatedAt,
      }));
  }
}

function defaultCoopUrl(): string {
  if (typeof window === 'undefined') return 'ws://127.0.0.1:8787';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/coop`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeWorldSnapshot(state: GameState, version: number): CoopWorldSnapshot {
  return {
    version,
    tier: state.dungeon.tier,
    currentRoomId: state.dungeon.currentRoomId,
    hostPlayer: {
      pos: clone(state.player.pos),
      facing: clone(state.player.facing),
      roomId: state.dungeon.currentRoomId,
    },
    rooms: clone(state.dungeon.rooms),
    enemies: clone(state.enemies),
    projectiles: clone(state.projectiles),
    loot: clone(state.loot),
    traps: clone(state.traps),
    chests: clone(state.chests),
    torches: clone(state.torches),
    shopItems: clone(state.shopItems),
    roomsCleared: state.roomsCleared,
    wave: state.wave,
  };
}

function applyWorldSnapshot(state: GameState, world: CoopWorldSnapshot) {
  if (world.version < state.coop.worldVersion) return;

  const previousRoomId = state.dungeon.currentRoomId;
  const previousTier = state.dungeon.tier;
  const rooms = clone(world.rooms);
  const room = rooms[world.currentRoomId] as DungeonRoom | undefined;
  if (!room) return;

  state.coop.worldVersion = world.version;
  state.dungeon = {
    rooms,
    currentRoomId: world.currentRoomId,
    tier: world.tier,
  };
  state.room = room;
  room.enemies = clone(world.enemies);
  room.traps = clone(world.traps);
  room.chests = clone(world.chests);
  room.torches = clone(world.torches);
  state.enemies = clone(world.enemies);
  state.projectiles = clone(world.projectiles);
  state.loot = clone(world.loot);
  state.traps = clone(world.traps);
  state.chests = clone(world.chests);
  state.torches = clone(world.torches);
  state.shopItems = clone(world.shopItems);
  state.roomsCleared = world.roomsCleared;
  state.wave = world.wave;

  if (previousRoomId !== world.currentRoomId || previousTier !== world.tier) {
    state.transitionTimer = 0.18;
    state.transitionDirection = null;
    state.player.pos = {
      x: Math.max(56, Math.min(744, world.hostPlayer.pos.x + 26)),
      y: Math.max(56, Math.min(544, world.hostPlayer.pos.y + 18)),
    };
    state.player.vel = { x: 0, y: 0 };
    state.player.facing = clone(world.hostPlayer.facing);
    state.showShop = room.type === 'shop';
    state.showInventory = false;
    state.showMap = false;
  }
}
