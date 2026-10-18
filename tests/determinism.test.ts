import assert from 'node:assert/strict';
import { addShip, applyInput, createWorld, snapshot, tick } from '../shared/simulation.js';
import { sequenceNumber } from '../shared/types.js';
import { decodeInputPacket, encodeInputPacket, parseClientMessage } from '../shared/protocol.js';

function runScenario(): string {
  const world = createWorld(); addShip(world, 'ship-test', 'player-1', { x: 100, y: 100 });
  for (let step = 0; step < 120; step += 1) {
    applyInput(world, 'player-1', { seq: sequenceNumber(step), thrust: step % 3 === 0 ? 1 : 0.25, turn: step % 2 === 0 ? 1 : -1, fire: step % 8 === 0 });
    tick(world);
  }
  return JSON.stringify(snapshot(world));
}
assert.equal(runScenario(), runScenario(), 'same input sequence must produce identical snapshots');
const packet = encodeInputPacket(42, 1, -0.5, true); const decoded = decodeInputPacket(packet);
assert.equal(decoded.seq, 42); assert.equal(decoded.thrust, 1); assert.equal(decoded.turn, -0.5); assert.equal(decoded.fire, true);
assert.throws(() => decodeInputPacket(new Uint8Array(3)), /length/);
assert.throws(() => parseClientMessage({ type: 'input', input: { seq: -1, thrust: 0, turn: 0, fire: false } }));
console.log('✓ deterministic simulation, binary protocol validation, and Zod input validation passed');
