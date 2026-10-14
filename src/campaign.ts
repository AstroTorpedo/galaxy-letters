import type {ImageMode} from './cube';
import {covered,outsideStellarDisk,primaryResponse,sourcePixel} from './observing';
import type {Exposure,ObservingPlan} from './observing';
import {exposureTarget} from './targets';
import type {TargetId} from './targets';

export interface Evidence {dataset:string;x:number;y:number;snr:number;centroid:number|null;run:number}
export interface CampaignInput {exposures:Exposure[];evidence:Evidence[];views:Record<string,ImageMode[]>;milestones?:TargetId[]}
export interface MissionProgress {observed:boolean;quality:boolean;motion:boolean;inside:boolean;weak:boolean;views:boolean;count:number;done:boolean;archived:boolean}
export const coverageCount=(p:ObservingPlan)=>Array.from({length:101},(_,k)=>k*5-250).filter(v=>covered(v,p)).length;
export function usableExposure(e:Exposure){return e.reference&&e.plan.flagRfi&&coverageCount(e.plan)>=85&&primaryResponse(e.plan.east,e.plan.north)>=.5;}
export function missionProgress(state:CampaignInput,target:TargetId):MissionProgress{
  const exposures=state.exposures.filter(e=>exposureTarget(e)===target),goodExposures=exposures.filter(usableExposure),ids=new Set(goodExposures.map(e=>e.id));
  const notes=state.evidence.filter(e=>ids.has(e.dataset)&&e.run>=3).map(e=>{
    const exposure=goodExposures.find(x=>x.id===e.dataset)!;
    const point=sourcePixel(e.x,e.y,4,exposure.modelVersion===2?exposure.plan.east:0,exposure.modelVersion===2?exposure.plan.north:0);
    return {...e,...point};
  });
  const strong=notes.filter(e=>e.snr>=5&&e.centroid!==null);
  const motion=strong.some(a=>strong.some(b=>Math.hypot(a.x-b.x,a.y-b.y)>19.2&&Math.abs(a.centroid!-b.centroid!)>=25));
  const inside=strong.some(e=>!outsideStellarDisk(e.x,e.y)),weak=notes.some(e=>e.snr>=3&&e.snr<15&&outsideStellarDisk(e.x,e.y));
  const seen=new Set(exposures.flatMap(e=>state.views[e.id]??[]));
  const views=target==='sim-disk'?seen.has('moment1'):seen.has('optical')&&seen.has('moment0')&&seen.has('channel');
  const quality=goodExposures.length>0,computed=quality&&views&&(target==='sim-disk'?motion:inside&&weak),archived=!computed&&Boolean(state.milestones?.includes(target));
  return {observed:exposures.length>0,quality,motion,inside,weak,views,count:notes.length,done:computed||archived,archived};
}
export function campaignProgress(state:CampaignInput){const baseline=missionProgress(state,'sim-disk'),echo=missionProgress(state,'sim-disturbed');return {baseline,echo,done:baseline.done&&echo.done};}

export type GuideStep='target'|'point'|'tune'|'calibrate'|'reference'|'observe'|'motion'|'views'|'inside'|'weak'|'other'|'report';
export interface Guide {id:GuideStep;title:string;copy:string;surface:'night'|'workbench'}
export function nextGuide(state:CampaignInput,target:TargetId,plan:ObservingPlan,calibrated:boolean,reference:boolean):Guide{
  const progress=campaignProgress(state),mission=target==='sim-disk'?progress.baseline:progress.echo;
  if(progress.done)return {id:'report',title:'交回两份观测申请',copy:'两份任务的证据已齐。和林岚复盘，再提交双目标报告。',surface:'night'};
  if(mission.done)return {id:'other',title:'换一份档案继续调查',copy:target==='sim-disk'?'运动对照已经建立。现在选择 GX-07「回波」，复核盘外弱线。':'回波的证据已保存。再为 GX-03「归航」补上运动对照。',surface:'night'};
  if(!mission.quality){
    if(primaryResponse(plan.east,plan.north)<.9)return {id:'point',title:'让目标进入主波束中心',copy:'点击“对准档案坐标”，观察成像方框和预期视场的变化。偏离会丢失结构、削弱信号。',surface:'night'};
    if(coverageCount(plan)<85)return {id:'tune',title:'把旋转盘留在频段里',copy:'回到系统中心频率，带宽可先选 2.8 MHz。看阴影是否覆盖大部分速度。',surface:'night'};
    if(!calibrated)return {id:'calibrate',title:'先取得校准源',copy:'观测校准源需要 2 个模拟分钟，让接收器的相对读数有可比较的尺度。',surface:'night'};
    if(!reference||!plan.flagRfi)return {id:'reference',title:'核查同频窄峰',copy:'检查参考场，再标记其中的同频窄峰。灰色缺测与没有气体是两回事。',surface:'night'};
    return {id:'observe',title:'把时间真正花在目标上',copy:target==='sim-disk'?'先分配 8 分钟，点击开始观测。操作和阅读本身不会扣时间。':'弱线可以先分配 16 分钟；更长积分降低随机噪声，不能自动消除干扰。',surface:'night'};
  }
  if(target==='sim-disk'){
    if(!mission.views)return {id:'views',title:'先看速度场',copy:'切换速度场，观察两侧颜色和数值的连续变化。下一步在两侧分别提取谱。',surface:'workbench'};
    return {id:'motion',title:'给两处运动留下证据',copy:'在盘的一侧点选并保存发现，再去另一侧。比较中心速度，而不是只看哪条线更亮。',surface:'workbench'};
  }
  if(!mission.views)return {id:'views',title:'对照星光、HI 与通道',copy:'依次查看光学、HI 积分和通道扫描。亮色会随拉伸改变，请同时读色标。',surface:'workbench'};
  if(!mission.inside)return {id:'inside',title:'给盘外候选找一条盘内参照谱',copy:'先在星光参考轮廓内找到连续通道信号，记录一条盘内谱。',surface:'workbench'};
  return {id:'weak',title:'沿星光轮廓之外寻找弱线',copy:'自由点选盘外结构，核查谱和连续通道。必要时适度扩大孔径，再记录候选；不必先给形成原因下结论。',surface:'workbench'};
}
