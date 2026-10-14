export const NIGHT_STORE='galaxy-observing-night-v2';
export const LEGACY_NIGHT_STORE='galaxy-observing-night-v1';
export const EXPLORER_STORE='galaxy-explorer-v2';
export const RESET_BACKUP='galaxy-reset-backup-v1';
export const GAME_KEYS=[NIGHT_STORE,LEGACY_NIGHT_STORE,EXPLORER_STORE] as const;
export type ProgressStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
interface Backup {version:1;savedAt:string;reason:'reset'|'restore';values:Record<string,string|null>}
const capture=(s:ProgressStorage)=>Object.fromEntries(GAME_KEYS.map(key=>[key,s.getItem(key)]));
function write(s:ProgressStorage,values:Record<string,string|null>){for(const key of GAME_KEYS){const value=values[key];if(value===null)s.removeItem(key);else s.setItem(key,value);}}
export function resetBackup(s:ProgressStorage):Backup|null{
  try{const b=JSON.parse(s.getItem(RESET_BACKUP)??'null');if(b?.version===1&&typeof b.savedAt==='string'&&GAME_KEYS.every(k=>b.values&&(b.values[k]===null||typeof b.values[k]==='string')))return b;}catch{}
  return null;
}
/** Backup must succeed before anything is cleared. No unrelated storage is touched. */
export function resetProgress(s:ProgressStorage){
  const values=capture(s),oldBackup=s.getItem(RESET_BACKUP);
  s.setItem(RESET_BACKUP,JSON.stringify({version:1,savedAt:new Date().toISOString(),reason:'reset',values} satisfies Backup));
  try{for(const key of GAME_KEYS)s.removeItem(key);}catch(error){write(s,values);if(oldBackup===null)s.removeItem(RESET_BACKUP);else s.setItem(RESET_BACKUP,oldBackup);throw error;}
}
/** Swap active state and snapshot, so restoring can itself be reversed. */
export function restoreProgress(s:ProgressStorage){
  const backup=resetBackup(s);if(!backup)throw new Error('没有有效的本地备份');
  const current=capture(s),oldBackup=s.getItem(RESET_BACKUP)!;
  s.setItem(RESET_BACKUP,JSON.stringify({version:1,savedAt:new Date().toISOString(),reason:'restore',values:current} satisfies Backup));
  try{write(s,backup.values);}catch(error){write(s,current);s.setItem(RESET_BACKUP,oldBackup);throw error;}
}
