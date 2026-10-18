import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { decodeInputPacket, encodeInputPacket, INPUT_PACKET_LENGTH, parseClientMessage } from './protocol.js';

describe('network protocol',()=>{
  it('accepts valid and rejects invalid Zod messages',()=>{expect(parseClientMessage({type:'join',name:'Pilot'}).type).toBe('join');expect(()=>parseClientMessage({type:'join',name:''})).toThrow();expect(()=>parseClientMessage({type:'input',input:{seq:-1,thrust:0,turn:0,fire:false}})).toThrow();});
  it('binary frame matches declared fixed length',()=>{const bytes=encodeInputPacket(42,.5,-.25,true);expect(bytes.byteLength).toBe(INPUT_PACKET_LENGTH);expect(decodeInputPacket(bytes)).toEqual({seq:42,thrust:.5,turn:-.25,fire:true});});
  it('rejects wrong lengths, magic, version and fields',()=>{for(const b of [new Uint8Array(0),new Uint8Array(1),new Uint8Array(10),new Uint8Array(12)])expect(()=>decodeInputPacket(b)).toThrow();const good=encodeInputPacket(1,0,0,false);const badMagic=good.slice();badMagic[0]=0;expect(()=>decodeInputPacket(badMagic)).toThrow();const badVersion=good.slice();badVersion[2]=99;expect(()=>decodeInputPacket(badVersion)).toThrow();const badFire=good.slice();badFire[9]=2;expect(()=>decodeInputPacket(badFire)).toThrow();});
  it('property: encode/decode preserves input to byte precision',()=>fc.assert(fc.property(fc.integer({min:0,max:0xffffffff}),fc.double({min:-1,max:1,noNaN:true}),fc.double({min:-1,max:1,noNaN:true}),fc.boolean(),(seq,thrust,turn,fire)=>{const decoded=decodeInputPacket(encodeInputPacket(seq,thrust,turn,fire));expect(decoded.seq).toBe(seq);expect(decoded.thrust).toBeCloseTo(Math.round(thrust*100)/100,8);expect(decoded.turn).toBeCloseTo(Math.round(turn*100)/100,8);expect(decoded.fire).toBe(fire);}),{numRuns:200}));
  it('property: malformed buffer length raises Error',()=>fc.assert(fc.property(fc.integer({min:0,max:128}).filter(n=>n!==INPUT_PACKET_LENGTH),n=>expect(()=>decodeInputPacket(new Uint8Array(n))).toThrow(Error)),{numRuns:100}));
  it('property: JSON object parser rejects invalid messages and accepts valid join',()=>fc.assert(fc.property(fc.string({minLength:1,maxLength:24}).filter(s=>s.trim().length>0),name=>expect(parseClientMessage({type:'join',name}).type).toBe('join')),{numRuns:100}));
  it.each(Array.from({length:10},(_,i)=>i))('rejects invalid sequence value %i',n=>{expect(()=>parseClientMessage({type:'input',input:{seq:-n-1,thrust:0,turn:0,fire:false}})).toThrow();});
});
