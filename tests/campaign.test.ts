import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignProgress,nextGuide} from '../src/campaign.ts';
import {readCampaign} from '../src/campaign-state.ts';
import {defaultPlan,REST_MHZ} from '../src/observing.ts';
import {exposureTarget} from '../src/targets.ts';
import type {Exposure} from '../src/observing.ts';

const plan={...defaultPlan(),east:0,north:0,centerMHz:REST_MHZ,bandwidthMHz:2.8,flagRfi:true};
const exposure=(id:string,sourceId:'sim-disk'|'sim-disturbed'):Exposure=>({id,night:1,sourceId,plan,reference:true,modelVersion:2});
test('two missions require their own observed samples, measured evidence and relevant views',()=>{
  const state={exposures:[exposure('night-1','sim-disk'),exposure('night-2','sim-disturbed')],evidence:[{dataset:'night-1',x:43.5,y:63.5,snr:20,centroid:-80,run:5},{dataset:'night-1',x:83.5,y:63.5,snr:20,centroid:80,run:5}],views:{'night-1':['moment1' as const]}};
  assert.equal(campaignProgress(state).baseline.done,true);assert.equal(campaignProgress(state).echo.done,false);
  const full={...state,evidence:[...state.evidence,{dataset:'night-2',x:63.5,y:63.5,snr:20,centroid:0,run:8},{dataset:'night-2',x:36.5,y:47.5,snr:7,centroid:-55,run:3}],views:{...state.views,'night-2':['optical','moment0','channel'] as ('optical'|'moment0'|'channel')[]}};
  assert.equal(campaignProgress(full).done,true);
  assert.equal(campaignProgress({...full,exposures:[exposure('night-1','sim-disk'),{...exposure('night-2','sim-disturbed'),reference:false}]}).echo.done,false);
});
test('tutorial responds to actual setup and old exposures never turn into the new baseline',()=>{
  const empty={exposures:[],evidence:[],views:{}};
  assert.equal(nextGuide(empty,'sim-disk',defaultPlan(),false,false).id,'point');
  assert.equal(nextGuide(empty,'sim-disk',plan,false,false).id,'calibrate');
  assert.equal(nextGuide(empty,'sim-disk',plan,true,false).id,'reference');
  assert.equal(exposureTarget({}),'sim-disturbed');
  const old=readCampaign(JSON.stringify({version:1,night:1,accepted:true,plan,exposures:[{id:'night-1',night:1,plan,reference:true}],evidence:[],history:[]}));
  assert.equal(old.selectedTarget,'sim-disturbed');assert.equal(old.exposures[0].modelVersion,undefined);assert.equal(old.version,2);assert.equal(old.tutorialEnabled,true);
  assert.equal(readCampaign('{broken').selectedTarget,'sim-disk');
});
