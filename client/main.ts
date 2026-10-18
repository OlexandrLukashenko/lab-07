import './style.css';
import type { ServerMessage, Snapshot, Entity } from '../shared/types.js';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const ctx = canvas?.getContext('2d');
const connection = document.querySelector<HTMLElement>('#connection');
const statusText = document.querySelector<HTMLElement>('#statusText');
const playersLabel = document.querySelector<HTMLElement>('#players');
const tickLabel = document.querySelector<HTMLElement>('#tick');
const pingLabel = document.querySelector<HTMLElement>('#ping');
const netLabel = document.querySelector<HTMLElement>('#netgraph');
const chat = document.querySelector<HTMLElement>('#chat');
const roomInfo = document.querySelector<HTMLElement>('#roomInfo');
if (!canvas || !ctx || !connection || !statusText || !playersLabel || !tickLabel || !pingLabel || !netLabel || !chat || !roomInfo) throw new Error('Required UI element missing');
const context = ctx;
const socketUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:3000`;
let socket: WebSocket | undefined; let playerId = ''; let room = 'lobby'; let seq = 0; let currentSnapshot: Snapshot | undefined; let previousSnapshot: Snapshot | undefined; let lastSnapshotAt = performance.now(); let pingSentAt = 0; let rtt = 0; let lostSnapshots = 0;
const keys = new Set<string>(); const starField = Array.from({ length: 150 }, (_, i) => ({ x: (i * 7919 % 1200), y: (i * 3571 % 800), r: (i % 3) * 0.45 + 0.35 }));
function send(value: unknown): void { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value)); }
function appendChat(from: string, text: string, at: number): void {
  const entry = document.createElement('div'); entry.className = 'entry';
  const name = document.createElement('span'); name.className = 'from'; name.textContent = `${from}: `;
  const body = document.createElement('span'); body.textContent = text;
  const time = document.createElement('div'); time.className = 'time'; time.textContent = new Date(at).toLocaleTimeString();
  entry.append(name, body, time); chat.append(entry); while (chat.childElementCount > 80) chat.firstElementChild?.remove(); chat.scrollTop = chat.scrollHeight;
}
function connect(): void {
  socket = new WebSocket(socketUrl); socket.binaryType = 'arraybuffer';
  socket.addEventListener('open', () => { connection.classList.add('online'); statusText.textContent = 'Online'; send({ type: 'join', name: (document.querySelector<HTMLInputElement>('#name')?.value || 'Pilot').slice(0, 24) }); });
  socket.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (typeof event.data !== 'string') return;
    let value: unknown; try { value = JSON.parse(event.data) as unknown; } catch { return; }
    if (typeof value !== 'object' || value === null || !('type' in value)) return;
    const message = value as ServerMessage; // Boundary: client accepts server messages after basic shape guard; server protocol is trusted on this local demo connection.
    switch (message.type) {
      case 'welcome': playerId = message.playerId; room = message.room; roomInfo.textContent = `Room: ${room}`; break;
      case 'snapshot': previousSnapshot = currentSnapshot; currentSnapshot = message.snapshot; lastSnapshotAt = performance.now(); lostSnapshots = Math.max(0, lostSnapshots - 1); tickLabel.textContent = `Tick: ${message.snapshot.step}`; playersLabel.textContent = `Players: ${message.snapshot.entities.filter((entity) => entity.kind === 'ship').length}`; break;
      case 'chat': appendChat(message.from, message.text, message.at); break;
      case 'rooms': { const found = message.rooms.find((candidate) => candidate.name === room); roomInfo.textContent = `Room: ${room} · ${found?.players ?? 0} pilot(s)`; break; }
      case 'pong': rtt = performance.now() - message.sentAt; pingLabel.textContent = `Ping: ${Math.round(rtt)} ms`; break;
      case 'error': appendChat('system', message.message, Date.now()); break;
      default: { const exhaustive: never = message; return exhaustive; }
    }
  });
  socket.addEventListener('close', () => { connection.classList.remove('online'); statusText.textContent = 'Disconnected'; window.setTimeout(connect, 1500); });
  socket.addEventListener('error', () => { statusText.textContent = 'Connection error'; });
}
function sendInput(): void {
  const thrust = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
  const turn = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  send({ type: 'input', input: { seq: seq++, thrust, turn, fire: keys.has(' ') } });
}
window.addEventListener('keydown', (event) => { const key = event.key.toLowerCase(); if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault(); keys.add(key); });
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase())); window.addEventListener('blur', () => keys.clear());
document.querySelector<HTMLButtonElement>('#join')?.addEventListener('click', () => send({ type: 'join', name: document.querySelector<HTMLInputElement>('#name')?.value || 'Pilot' }));
document.querySelector<HTMLButtonElement>('#joinRoom')?.addEventListener('click', () => { const nextRoom = document.querySelector<HTMLInputElement>('#roomName')?.value.trim(); if (nextRoom) { send({ type: 'room:join', room: nextRoom }); room = nextRoom; roomInfo.textContent = `Room: ${room}`; } });
document.querySelector<HTMLFormElement>('#chatForm')?.addEventListener('submit', (event) => { event.preventDefault(); const input = document.querySelector<HTMLInputElement>('#chatInput'); const text = input?.value.trim(); if (text) { send({ type: 'chat', text }); if (input) input.value = ''; } });
function drawEntity(entity: Entity, alpha: number): void {
  const x = entity.position.x; const y = entity.position.y; context.save(); context.globalAlpha = alpha;
  if (entity.kind === 'ship') {
    context.translate(x, y); context.rotate(entity.angle); context.strokeStyle = entity.ownerId === playerId ? '#61e8d5' : '#ffb86b'; context.lineWidth = entity.ownerId === playerId ? 2.5 : 1.7; context.beginPath(); context.moveTo(18, 0); context.lineTo(-12, -10); context.lineTo(-7, 0); context.lineTo(-12, 10); context.closePath(); context.stroke();
    context.fillStyle = '#e8f2ff'; context.font = '12px IBM Plex Mono'; context.textAlign = 'center'; context.fillText(entity.ownerId === playerId ? 'YOU' : entity.ownerId.slice(0, 5), 0, 25);
  } else { context.fillStyle = entity.ownerId === playerId ? '#61e8d5' : '#ff6f91'; context.shadowBlur = 12; context.shadowColor = context.fillStyle; context.beginPath(); context.arc(x, y, 3, 0, Math.PI * 2); context.fill(); }
  context.restore();
}
function render(): void {
  context.clearRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#080f20'; context.fillRect(0, 0, canvas.width, canvas.height);
  for (const star of starField) { context.globalAlpha = 0.35 + star.r / 4; context.fillStyle = '#a8c9ff'; context.fillRect(star.x, star.y, star.r, star.r); } context.globalAlpha = 1;
  context.strokeStyle = '#182943'; context.lineWidth = 1; for (let x = 0; x <= 1200; x += 100) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 800); context.stroke(); } for (let y = 0; y <= 800; y += 100) { context.beginPath(); context.moveTo(0, y); context.lineTo(1200, y); context.stroke(); }
  const age = performance.now() - lastSnapshotAt; if (age > 1000) lostSnapshots += 1;
  const entities = currentSnapshot?.entities ?? []; for (const entity of entities) drawEntity(entity, Math.max(0.2, 1 - age / 1200));
  netLabel.textContent = age > 500 ? `Network: stale ${Math.round(age)}ms` : lostSnapshots > 2 ? 'Network: packet gaps' : 'Network: stable';
  requestAnimationFrame(render);
}
window.setInterval(sendInput, 1000 / 30); window.setInterval(() => { pingSentAt = performance.now(); send({ type: 'ping', sentAt: pingSentAt }); }, 2000); connect(); render();
