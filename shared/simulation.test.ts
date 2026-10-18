import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { addShip, applyInput, createWorld, snapshot, tick, wrap, WORLD_HEIGHT, WORLD_WIDTH } from './simulation.js';
import { sequenceNumber } from './types.js';

describe('simulation', () => {
  it('wraps both sides of arena', () => { expect(wrap(WORLD_WIDTH + 1, WORLD_WIDTH)).toBe(1); expect(wrap(-1, WORLD_WIDTH)).toBe(WORLD_WIDTH - 1); });
  it('keeps generated movement inside arena', () => fc.assert(fc.property(fc.array(fc.record({ thrust: fc.double({min:-1,max:1,noNaN:true}), turn: fc.double({min:-1,max:1,noNaN:true}), fire: fc.boolean() }), {maxLength:100}), inputs => {
    const w=createWorld(); addShip(w,'ship','owner',{x:600,y:400}); inputs.forEach((input,i)=>{applyInput(w,'owner',{seq:sequenceNumber(i),...input});tick(w);});
    const ship=[...w.ships.values()][0]!; expect(ship.position.x).toBeGreaterThanOrEqual(0); expect(ship.position.x).toBeLessThan(WORLD_WIDTH); expect(ship.position.y).toBeGreaterThanOrEqual(0); expect(ship.position.y).toBeLessThan(WORLD_HEIGHT);
  }), {numRuns:100}));
  it('is deterministic for identical input sequences', () => { const run=()=>{const w=createWorld();addShip(w,'s','p');for(let i=0;i<40;i++){applyInput(w,'p',{seq:sequenceNumber(i),thrust:i%2,turn:i%3===0?.5:-.5,fire:i%8===0});tick(w);}return snapshot(w);}; expect(run()).toEqual(run()); });
  it('bullet collision damages another ship and consumes the bullet', () => { const w=createWorld(); addShip(w,'shooter','a',{x:100,y:100}); addShip(w,'target','b',{x:130,y:100}); applyInput(w,'a',{seq:sequenceNumber(0),thrust:0,turn:0,fire:true}); tick(w); expect(w.ships.get('target')?.hp).toBe(75); expect(w.bullets.size).toBe(0); });
  it('fires and expires bullets', () => { const w=createWorld();addShip(w,'s','p');applyInput(w,'p',{seq:sequenceNumber(0),thrust:0,turn:0,fire:true});expect(w.bullets.size).toBe(1);for(let i=0;i<60;i++)tick(w);expect(w.bullets.size).toBe(0); });
  it('ignores input for unknown owner', () => { const w=createWorld();const ship=addShip(w,'s','p');applyInput(w,'unknown',{seq:sequenceNumber(1),thrust:1,turn:1,fire:true});expect(w.ships.get(ship.id)).toEqual(ship); });
  it.each(Array.from({length:30},(_,i)=>i))('step and snapshot remain aligned (%i)', n=>{const w=createWorld();addShip(w,`s${n}`,`p${n}`);for(let i=0;i<n;i++)tick(w);expect(w.step).toBe(n);expect(snapshot(w).step).toBe(n);});
  it.each(Array.from({length:20},(_,i)=>i+1))('wrap stays in range (%i)', n=>{const x=wrap(n*WORLD_WIDTH*3.7,WORLD_WIDTH);expect(x).toBeGreaterThanOrEqual(0);expect(x).toBeLessThan(WORLD_WIDTH);});
  it('property: wrap bounds arbitrary finite values', () => fc.assert(fc.property(fc.double({min:-1e8,max:1e8,noNaN:true}),fc.double({min:1,max:1e5,noNaN:true}),(v,m)=>{const x=wrap(v,m);expect(x).toBeGreaterThanOrEqual(0);expect(x).toBeLessThan(m);}),{numRuns:150}));
});
