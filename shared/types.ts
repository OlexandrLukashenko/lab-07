import { z } from 'zod';

// Brands prevent accidentally mixing entity ids, simulation ticks and packet sequence numbers.
export type Brand<T, Name extends string> = T & { readonly __brand: Name };
export type EntityId = Brand<string, 'EntityId'>;
export type StepNumber = Brand<number, 'StepNumber'>;
export type SequenceNumber = Brand<number, 'SequenceNumber'>;
export const entityId = (value: string): EntityId => value as EntityId; // Boundary: server creates stable entity identifiers.
export const stepNumber = (value: number): StepNumber => value as StepNumber; // Boundary: simulation owns integer ticks.
export const sequenceNumber = (value: number): SequenceNumber => value as SequenceNumber; // Boundary: packet encoder owns sequence values.

export interface Vec2 { readonly x: number; readonly y: number }
export interface Ship { readonly kind: 'ship'; readonly id: EntityId; readonly ownerId: string; readonly position: Vec2; readonly angle: number; readonly hp: number }
export interface Bullet { readonly kind: 'bullet'; readonly id: EntityId; readonly ownerId: string; readonly position: Vec2; readonly velocity: Vec2; readonly ttl: number }
export type Entity = Ship | Bullet;
export interface Snapshot { readonly step: StepNumber; readonly entities: readonly Entity[] }
export interface InputFrame { readonly seq: SequenceNumber; readonly thrust: number; readonly turn: number; readonly fire: boolean }

const inputSchema = z.object({ seq: z.number().int().nonnegative().max(0xffffffff), thrust: z.number().min(-1).max(1), turn: z.number().min(-1).max(1), fire: z.boolean() }).strict();
export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join'), name: z.string().trim().min(1).max(24) }).strict(),
  z.object({ type: z.literal('input'), input: inputSchema }).strict(),
  z.object({ type: z.literal('chat'), text: z.string().trim().min(1).max(300) }).strict(),
  z.object({ type: z.literal('room:create'), room: z.string().trim().min(1).max(32) }).strict(),
  z.object({ type: z.literal('room:join'), room: z.string().trim().min(1).max(32) }).strict(),
  z.object({ type: z.literal('ping'), sentAt: z.number().finite() }).strict()
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ServerMessage =
  | { readonly type: 'welcome'; readonly playerId: string; readonly room: string }
  | { readonly type: 'snapshot'; readonly snapshot: Snapshot; readonly ack: SequenceNumber }
  | { readonly type: 'chat'; readonly from: string; readonly text: string; readonly at: number }
  | { readonly type: 'rooms'; readonly rooms: readonly { readonly name: string; readonly players: number }[] }
  | { readonly type: 'pong'; readonly sentAt: number }
  | { readonly type: 'error'; readonly message: string };
