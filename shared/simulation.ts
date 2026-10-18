import { entityId, stepNumber, type Entity, type EntityId, type InputFrame, type Ship, type Snapshot, type Vec2 } from './types.js';

export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 800;
const SHIP_SPEED = 3.4;
const TURN_SPEED = 0.065;
const BULLET_SPEED = 7.5;

export interface World { step: number; ships: Map<EntityId, Ship>; bullets: Map<EntityId, Extract<Entity, {kind:'bullet'}>>; nextBullet: number }
export function createWorld(): World { return { step: 0, ships: new Map(), bullets: new Map(), nextBullet: 0 }; }
export function addShip(world: World, id: string, ownerId: string, position: Vec2 = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }): Ship {
  const ship: Ship = { kind: 'ship', id: entityId(id), ownerId, position: { x: position.x, y: position.y }, angle: 0, hp: 100 };
  world.ships.set(ship.id, ship); return ship;
}
export function applyInput(world: World, ownerId: string, input: InputFrame): void {
  const ship = [...world.ships.values()].find((candidate) => candidate.ownerId === ownerId);
  if (!ship) return;
  const angle = ship.angle + input.turn * TURN_SPEED;
  const position = input.thrust === 0 ? ship.position : {
    x: wrap(ship.position.x + Math.cos(angle) * SHIP_SPEED * input.thrust, WORLD_WIDTH),
    y: wrap(ship.position.y + Math.sin(angle) * SHIP_SPEED * input.thrust, WORLD_HEIGHT)
  };
  world.ships.set(ship.id, { ...ship, angle, position });
  if (input.fire) {
    const id = entityId(`bullet-${ownerId}-${world.step}-${world.nextBullet++}`);
    const bullet = { kind: 'bullet' as const, id, ownerId, position: { x: wrap(position.x + Math.cos(angle) * 20, WORLD_WIDTH), y: wrap(position.y + Math.sin(angle) * 20, WORLD_HEIGHT) }, velocity: { x: Math.cos(angle) * BULLET_SPEED, y: Math.sin(angle) * BULLET_SPEED }, ttl: 60 };
    world.bullets.set(id, bullet);
  }
}
export function tick(world: World): void {
  world.step += 1;
  for (const [id, bullet] of world.bullets) {
    const ttl = bullet.ttl - 1;
    if (ttl <= 0) world.bullets.delete(id);
    else world.bullets.set(id, { ...bullet, ttl, position: { x: wrap(bullet.position.x + bullet.velocity.x, WORLD_WIDTH), y: wrap(bullet.position.y + bullet.velocity.y, WORLD_HEIGHT) } });
  }
  resolveCollisions(world);
}

/** Deterministic bullet/ship collision pass; shots cannot damage their owner. */
export function resolveCollisions(world: World): void {
  for (const [bulletId, bullet] of world.bullets) {
    let hitShip: Ship | undefined;
    for (const ship of world.ships.values()) {
      if (ship.ownerId === bullet.ownerId) continue;
      const dx = ship.position.x - bullet.position.x;
      const dy = ship.position.y - bullet.position.y;
      if (dx * dx + dy * dy <= 12 * 12) { hitShip = ship; break; }
    }
    if (hitShip) {
      world.bullets.delete(bulletId);
      const hp = Math.max(0, hitShip.hp - 25);
      if (hp === 0) world.ships.delete(hitShip.id);
      else world.ships.set(hitShip.id, { ...hitShip, hp });
    }
  }
}
export function snapshot(world: World): Snapshot {
  return { step: stepNumber(world.step), entities: [...world.ships.values(), ...world.bullets.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}
export function wrap(value: number, max: number): number { return ((value % max) + max) % max; }
