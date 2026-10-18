import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { addShip, applyInput, createWorld, snapshot, tick } from '../shared/simulation.js';
import { configurationSchema, decodeInputPacket, parseJsonMessage } from '../shared/protocol.js';
import { sequenceNumber, type ClientMessage, type ServerMessage } from '../shared/types.js';
import { allowRate } from './rate-limit.js';

const config = configurationSchema.parse(process.env);
const httpServer = createServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('Space game WebSocket server is running. Open the Vite client on port 5173.'); });
const wss = new WebSocketServer({ server: httpServer });
const world = createWorld();
type Peer = { readonly id: string; name: string; room: string; lastSeq: number; lastFireStep: number; chatRate: { windowStartedAt: number; count: number }; socket: WebSocket };
const peers = new Map<WebSocket, Peer>();
const rooms = new Map<string, Set<string>>([['lobby', new Set()]]);
function send(socket: WebSocket, message: ServerMessage): void { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }
function roomList(): ServerMessage { return { type: 'rooms', rooms: [...rooms.entries()].map(([name, ids]) => ({ name, players: ids.size })) }; }
function broadcastRoom(room: string, message: ServerMessage): void { for (const peer of peers.values()) if (peer.room === room) send(peer.socket, message); }
function moveToRoom(peer: Peer, roomName: string): void {
  const room = roomName.trim().slice(0, 32) || 'lobby';
  rooms.get(peer.room)?.delete(peer.id);
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room)?.add(peer.id); peer.room = room;
  broadcastRoom(room, { type: 'chat', from: 'system', text: `${peer.name} joined ${room}`, at: Date.now() });
  for (const p of peers.values()) send(p.socket, roomList());
}
function handle(peer: Peer, message: ClientMessage): void {
  switch (message.type) {
    case 'join': peer.name = message.name; send(peer.socket, { type: 'welcome', playerId: peer.id, room: peer.room }); break;
    case 'input': {
      if (message.input.seq <= peer.lastSeq) break;
      peer.lastSeq = message.input.seq;
      const fire = message.input.fire && world.step - peer.lastFireStep >= 8;
      if (fire) peer.lastFireStep = world.step;
      applyInput(world, peer.id, { ...message.input, fire });
      break;
    }
    case 'chat': if (allowRate(peer.chatRate, Date.now(), 5, 2000)) broadcastRoom(peer.room, { type: 'chat', from: peer.name, text: message.text, at: Date.now() }); break;
    case 'room:create': moveToRoom(peer, message.room); break;
    case 'room:join': moveToRoom(peer, message.room); break;
    case 'ping': send(peer.socket, { type: 'pong', sentAt: message.sentAt }); break;
    default: { const exhaustive: never = message; return exhaustive; }
  }
}
wss.on('connection', (socket) => {
  const id = randomUUID(); const peer: Peer = { id, name: `Pilot-${id.slice(0, 4)}`, room: 'lobby', lastSeq: -1, lastFireStep: -100, chatRate: { windowStartedAt: Date.now(), count: 0 }, socket };
  peers.set(socket, peer); rooms.get('lobby')?.add(id); addShip(world, `ship-${id}`, id);
  send(socket, { type: 'welcome', playerId: id, room: 'lobby' }); send(socket, roomList());
  socket.on('message', (data, isBinary) => {
    try {
      if (isBinary) {
        const bytes: Uint8Array = Array.isArray(data) ? Buffer.concat(data) : data instanceof ArrayBuffer ? new Uint8Array(data) : data;
        const input = decodeInputPacket(bytes);
        if (input.seq > peer.lastSeq) { peer.lastSeq = input.seq; applyInput(world, peer.id, { ...input, fire: input.fire && world.step - peer.lastFireStep >= 8 }); if (input.fire) peer.lastFireStep = world.step; }
      } else handle(peer, parseJsonMessage(data.toString()));
    } catch (error: unknown) {
      console.warn(`[protocol] closing ${peer.id}: ${error instanceof Error ? error.message : 'unknown invalid message'}`);
      socket.close(1003, 'Invalid message');
    }
  });
  socket.on('close', () => { peers.delete(socket); rooms.get(peer.room)?.delete(peer.id); for (const [shipId, ship] of world.ships) if (ship.ownerId === peer.id) world.ships.delete(shipId); for (const p of peers.values()) send(p.socket, roomList()); });
  socket.on('error', (error: Error) => console.warn('[websocket]', error.message));
});
const interval = 1000 / config.TICK_RATE;
let nextTime = performance.now();
setInterval(() => {
  const now = performance.now();
  if (now < nextTime) return;
  // Advance to target time, rather than adding a fixed delay after each update.
  nextTime += interval;
  tick(world);
  const state = snapshot(world);
  for (const peer of peers.values()) send(peer.socket, { type: 'snapshot', snapshot: state, ack: sequenceNumber(Math.max(0, peer.lastSeq)) });
  if (now - nextTime > interval * 5) nextTime = now + interval;
}, Math.max(1, interval / 2));
httpServer.listen(config.PORT, config.HOST, () => console.log(`Authoritative game server listening on ${config.HOST}:${config.PORT} (${config.TICK_RATE} Hz)`));
process.on('SIGINT', () => { wss.close(); httpServer.close(); process.exit(0); });
