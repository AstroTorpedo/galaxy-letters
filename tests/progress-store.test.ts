import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_KEYS,NIGHT_STORE,EXPLORER_STORE,RESET_BACKUP,resetProgress,restoreProgress,resetBackup} from '../src/progress-store.ts';
function storage(){const values=new Map<string,string>();return {values,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};}
test('reset only touches known game records and restoration swaps complete snapshots',()=>{
  const s=storage();s.setItem(NIGHT_STORE,'night-records');s.setItem(EXPLORER_STORE,'findings');s.setItem('unrelated','keep');
  resetProgress(s);assert.ok(GAME_KEYS.every(key=>s.getItem(key)===null));assert.equal(s.getItem('unrelated'),'keep');assert.ok(resetBackup(s));
  s.setItem(NIGHT_STORE,'new-game');restoreProgress(s);assert.equal(s.getItem(NIGHT_STORE),'night-records');assert.equal(s.getItem(EXPLORER_STORE),'findings');
  restoreProgress(s);assert.equal(s.getItem(NIGHT_STORE),'new-game');assert.equal(s.getItem(EXPLORER_STORE),null);
});
test('a failed backup never clears records and malformed snapshots cannot write storage',()=>{
  const s=storage();s.setItem(NIGHT_STORE,'safe');const failing={...s,setItem:(key:string,value:string)=>{if(key===RESET_BACKUP)throw new Error('quota');s.setItem(key,value);}};
  assert.throws(()=>resetProgress(failing));assert.equal(s.getItem(NIGHT_STORE),'safe');
  s.setItem(RESET_BACKUP,'{"version":1,"values":{"unexpected":"bad"}}');assert.equal(resetBackup(s),null);assert.throws(()=>restoreProgress(s));assert.equal(s.getItem(NIGHT_STORE),'safe');
});
