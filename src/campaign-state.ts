import type {ImageMode} from './cube';
import {defaultPlan,validatePlan} from './observing';
import type {Exposure,ObservingPlan} from './observing';
import {exposureTarget,isTargetId} from './targets';
import type {TargetId} from './targets';
import type {Evidence} from './campaign';

export interface ArchivedReport {dataset:string;night:number;text:string}
export interface CampaignState {
  version:2;night:number;accepted:boolean;calibrated:boolean;reference:boolean;plan:ObservingPlan;
  selectedTarget:TargetId;exposures:Exposure[];evidence:Evidence[];views:Record<string,ImageMode[]>;
  report:string;history:ArchivedReport[];finalReport:string;tutorialEnabled:boolean;seenDialogue:string[];milestones:TargetId[];
}
export const initialCampaign=():CampaignState=>({version:2,night:1,accepted:false,calibrated:false,reference:false,plan:defaultPlan(),selectedTarget:'sim-disk',exposures:[],evidence:[],views:{},report:'',history:[],finalReport:'',tutorialEnabled:true,seenDialogue:[],milestones:[]});
const modes:ImageMode[]=['optical','moment0','moment1','channel'];
export function readCampaign(text:string|null):CampaignState{
  const fresh=initialCampaign();try{
    const r=JSON.parse(text??'null');if(!r||![1,2].includes(r.version)||!Number.isInteger(r.night)||r.night<1||r.night>9999||!validatePlan(r.plan))return fresh;
    const exposures:Exposure[]=Array.isArray(r.exposures)?r.exposures.filter((e:Exposure)=>e&&/^night-\d+$/.test(e.id)&&Number.isInteger(e.night)&&e.night>0&&e.night<=r.night&&validatePlan(e.plan)&&typeof e.reference==='boolean'&&(e.modelVersion===undefined||e.modelVersion===1||e.modelVersion===2)&&(e.sourceId===undefined||isTargetId(e.sourceId))).slice(-32):[];
    const evidence:Evidence[]=Array.isArray(r.evidence)?r.evidence.filter((e:Evidence)=>e&&typeof e.dataset==='string'&&[e.x,e.y,e.snr,e.run].every(Number.isFinite)&&(e.centroid===null||Number.isFinite(e.centroid))).slice(-96):[];
    const views:Record<string,ImageMode[]>={};if(r.views&&typeof r.views==='object')for(const e of exposures){const list=r.views[e.id];if(Array.isArray(list))views[e.id]=[...new Set(list.filter((v:ImageMode)=>modes.includes(v)))];}
    const history:ArchivedReport[]=Array.isArray(r.history)?r.history.filter((h:ArchivedReport)=>h&&typeof h.dataset==='string'&&Number.isInteger(h.night)&&typeof h.text==='string').slice(-24).map((h:ArchivedReport)=>({...h,text:h.text.slice(0,1500)})):[];
    return {...fresh,night:r.night,accepted:r.accepted===true,calibrated:r.calibrated===true,reference:r.reference===true,plan:validatePlan(r.plan)!,
      selectedTarget:isTargetId(r.selectedTarget)?r.selectedTarget:exposures.length?exposureTarget(exposures.at(-1)!):'sim-disk',exposures,evidence,views,history,
      report:typeof r.report==='string'?r.report.slice(0,1500):'',finalReport:typeof r.finalReport==='string'?r.finalReport.slice(0,1500):'',tutorialEnabled:r.tutorialEnabled!==false,
      seenDialogue:Array.isArray(r.seenDialogue)?r.seenDialogue.filter((t:unknown)=>typeof t==='string'&&/^[a-z-]+$/.test(t)).slice(-40):[],milestones:Array.isArray(r.milestones)?[...new Set<TargetId>(r.milestones.filter(isTargetId))]:[]};
  }catch{return fresh;}
}
