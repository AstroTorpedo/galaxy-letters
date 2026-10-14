export type TargetId='sim-disk'|'sim-disturbed';
export interface Target {id:TargetId;code:string;name:string;role:string;brief:string}
export const TARGETS:Target[]=[
  {id:'sim-disk',code:'GX-03',name:'归航',role:'任务 01 · 建立运动对照',brief:'一份规则旋转盘档案。先确认观测能读出两处天空不同的运动。'},
  {id:'sim-disturbed',code:'GX-07',name:'回波',role:'任务 02 · 复核盘外弱线',brief:'林岚留下的未结档案。用光学、HI 和连续通道核查盘外候选。'},
];
export const isTargetId=(value:unknown):value is TargetId=>value==='sim-disk'||value==='sim-disturbed';
export const targetById=(id:TargetId)=>TARGETS.find(t=>t.id===id)!;
/** Old exposures observed GX-07 only. Never reinterpret them as the new baseline. */
export const exposureTarget=(e:{sourceId?:string}):TargetId=>isTargetId(e.sourceId)?e.sourceId:'sim-disturbed';
