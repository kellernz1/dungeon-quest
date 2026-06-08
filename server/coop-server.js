import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.COOP_PORT ?? 8787);
const TICK_MS = 1000 / 20;

const rooms = new Map();

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function broadcast(room, payload, exceptId = null) {
  for (const player of room.players.values()) {
    if (player.id === exceptId) continue;
    send(player.ws, payload);
  }
}

function snapshot(room) {
  return [...room.players.values()].map(({ ws: _ws, ...player }) => ({
    ...player,
    isHost: player.id === room.hostId,
  }));
}

function getOrCreateRoom(requestedCode) {
  if (requestedCode && rooms.has(requestedCode)) return rooms.get(requestedCode);
  const code = requestedCode || (() => {
    let next = makeCode();
    while (rooms.has(next)) next = makeCode();
    return next;
  })();
  const room = { code, players: new Map(), createdAt: Date.now(), hostId: null, world: null };
  rooms.set(code, room);
  return room;
}

function chooseHost(room) {
  if (room.hostId && room.players.has(room.hostId)) return;
  const nextHost = room.players.keys().next();
  room.hostId = nextHost.done ? null : nextHost.value;
  broadcast(room, { type: 'hostChanged', hostId: room.hostId });
}

const server = new WebSocketServer({ port: PORT });

server.on('listening', () => {
  console.log(`Dungeon Quest co-op server listening on ws://127.0.0.1:${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the existing co-op server or set COOP_PORT to another port.`);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});

server.on('connection', (ws) => {
  let currentRoom = null;
  let playerId = null;

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: 'error', message: 'Invalid JSON' });
      return;
    }

    if (message.type === 'join') {
      const room = getOrCreateRoom(message.roomCode);
      currentRoom = room;
      playerId = randomUUID();

      const player = {
        id: playerId,
        ws,
        name: message.name || `Hero ${room.players.size + 1}`,
        heroClass: message.heroClass,
        x: 400,
        y: 300,
        facingX: 1,
        facingY: 0,
        aimX: 450,
        aimY: 300,
        hp: 1,
        maxHp: 1,
        level: 1,
        roomId: 0,
        updatedAt: Date.now(),
      };
      room.players.set(playerId, player);
      if (!room.hostId) room.hostId = playerId;

      send(ws, {
        type: 'joined',
        playerId,
        roomCode: room.code,
        isHost: room.hostId === playerId,
        players: snapshot(room),
        world: room.world,
      });
      broadcast(room, { type: 'playerJoined', player: { ...player, ws: undefined } }, playerId);
      return;
    }

    if (!currentRoom || !playerId) {
      send(ws, { type: 'error', message: 'Join a room first' });
      return;
    }

    const player = currentRoom.players.get(playerId);
    if (!player) return;

    if (message.type === 'state') {
      player.x = Number(message.x) || 0;
      player.y = Number(message.y) || 0;
      player.facingX = Number.isFinite(Number(message.facingX)) ? Number(message.facingX) : player.facingX;
      player.facingY = Number.isFinite(Number(message.facingY)) ? Number(message.facingY) : player.facingY;
      player.aimX = Number.isFinite(Number(message.aimX)) ? Number(message.aimX) : player.aimX;
      player.aimY = Number.isFinite(Number(message.aimY)) ? Number(message.aimY) : player.aimY;
      player.hp = Number(message.hp) || 0;
      player.maxHp = Number(message.maxHp) || 1;
      player.level = Number(message.level) || 1;
      player.roomId = Number(message.roomId) || 0;
      player.heroClass = message.heroClass || player.heroClass;
      player.updatedAt = Date.now();
      return;
    }

    if (message.type === 'world') {
      if (currentRoom.hostId !== playerId) {
        send(ws, { type: 'error', message: 'Only the host can sync the dungeon' });
        return;
      }
      currentRoom.world = message.world;
      broadcast(currentRoom, { type: 'world', world: currentRoom.world }, playerId);
      return;
    }

    if (message.type === 'event') {
      const host = currentRoom.hostId ? currentRoom.players.get(currentRoom.hostId) : null;
      if (host && host.id !== playerId) {
        send(host.ws, { type: 'clientEvent', event: message.event });
      } else {
        broadcast(currentRoom, { type: 'clientEvent', event: message.event }, playerId);
      }
      return;
    }

    if (message.type === 'ping') send(ws, { type: 'pong', time: Date.now() });
  });

  ws.on('close', () => {
    if (!currentRoom || !playerId) return;
    currentRoom.players.delete(playerId);
    chooseHost(currentRoom);
    broadcast(currentRoom, { type: 'playerLeft', playerId });
    if (currentRoom.players.size === 0) rooms.delete(currentRoom.code);
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    broadcast(room, { type: 'snapshot', players: snapshot(room), world: room.world });
  }
}, TICK_MS);
