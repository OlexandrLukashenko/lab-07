import { z } from 'zod';
import { clientMessageSchema, sequenceNumber, type ClientMessage, type SequenceNumber } from './types.js';

export const PROTOCOL_VERSION = 1;
const MAGIC = 0x5347;
export function parseClientMessage(value: unknown): ClientMessage { return clientMessageSchema.parse(value); }
export function parseJsonMessage(raw: string): ClientMessage {
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; } catch (error: unknown) { throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'parse failure'}`); }
  return parseClientMessage(value);
}

// Binary input packet: magic(2), version(1), seq(4), thrust(int8), turn(int8), fire(1).
export const INPUT_PACKET_LENGTH = 11;
export function encodeInputPacket(seq: number, thrust: number, turn: number, fire: boolean): Uint8Array {
  if (!Number.isInteger(seq) || seq < 0 || seq > 0xffffffff) throw new RangeError('seq outside uint32 range');
  if (!Number.isFinite(thrust) || thrust < -1 || thrust > 1 || !Number.isFinite(turn) || turn < -1 || turn > 1) throw new RangeError('input outside [-1, 1]');
  const bytes = new Uint8Array(INPUT_PACKET_LENGTH); const view = new DataView(bytes.buffer);
  view.setUint16(0, MAGIC); view.setUint8(2, PROTOCOL_VERSION); view.setUint32(3, seq); view.setInt8(7, Math.round(thrust * 100)); view.setInt8(8, Math.round(turn * 100)); view.setUint8(9, fire ? 1 : 0); view.setUint8(10, 0);
  return bytes;
}
export function decodeInputPacket(bytes: Uint8Array): { readonly seq: SequenceNumber; readonly thrust: number; readonly turn: number; readonly fire: boolean } {
  if (bytes.byteLength !== INPUT_PACKET_LENGTH) throw new Error(`Invalid packet length: ${bytes.byteLength}`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(0) !== MAGIC) throw new Error('Invalid packet magic');
  if (view.getUint8(2) !== PROTOCOL_VERSION) throw new Error('Unsupported protocol version');
  const thrust = view.getInt8(7) / 100; const turn = view.getInt8(8) / 100; const fireByte = view.getUint8(9);
  if (thrust < -1 || thrust > 1 || turn < -1 || turn > 1 || (fireByte !== 0 && fireByte !== 1) || view.getUint8(10) !== 0) throw new Error('Invalid packet field');
  return { seq: sequenceNumber(view.getUint32(3)), thrust, turn, fire: fireByte === 1 };
}
export const configurationSchema = z.object({ HOST: z.string().default('0.0.0.0'), PORT: z.coerce.number().int().min(1).max(65535).default(3000), TICK_RATE: z.coerce.number().int().min(1).max(120).default(30), WORLD_WIDTH: z.coerce.number().positive().default(1200), WORLD_HEIGHT: z.coerce.number().positive().default(800) });
