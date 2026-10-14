import './style.css';
import './explorer.css';
import room from '../assets/concepts/concept-b-galaxy-archive-v1.png';
import {apertureSpectrum,loadCube,moments,pvSlice,channelValueRange} from './cube';
import inferno from './inferno.json';
import {ObservingNight} from './night';
import {cubeFits} from './observing';
import {spectrumBounds} from './plot-scale';
import {EXPLORER_STORE,resetBackup,resetProgress,restoreProgress} from './progress-store';
import type {Aperture,Cube,CubeMeta,ImageMode,Measurement} from './cube';

document.documentElement.style.setProperty('--room-image',`url("${room}")`);
document.documentElement.style.setProperty('--inferno-gradient',`linear-gradient(to right,${inferno.map(rgb=>`rgb(${rgb.join(',')})`).join(',')})`);
const root=document.querySelector<HTMLElement>('#explorer')!;
const STORE=EXPLORER_STORE;
const hasProgressBackup=()=>{try{return Boolean(resetBackup(localStorage));}catch{return false;}};
interface Finding {id:string;dataset:string;title:string;x:number;y:number;radius:number;channel:number;view:ImageMode;snr:number;centroid:number|null;run:number;note:string;thumbnail:string}
let findings:Finding[]=[];
try {const saved=JSON.parse(localStorage.getItem(STORE)??'[]');if(Array.isArray(saved))findings=saved.filter(x=>x&&typeof x.id==='string'&&typeof x.dataset==='string'&&/^[a-z0-9-]+$/.test(x.dataset)&&Number.isFinite(x.x)&&Number.isFinite(x.y)&&Number.isFinite(x.radius)&&Number.isFinite(x.channel)&&Number.isFinite(x.snr)).slice(-24).map(x=>({...x,title:typeof x.title==='string'?x.title:x.dataset,note:typeof x.note==='string'?x.note.slice(0,80):'',thumbnail:typeof x.thumbnail==='string'?x.thumbnail:'',run:Number.isFinite(x.run)?x.run:0,centroid:Number.isFinite(x.centroid)?x.centroid:null}));}catch{/* A damaged notebook must not prevent observing. */}
let cube:Cube, optical:HTMLImageElement;
let mode:ImageMode='moment0',channel=50,lo=0,hi=100,threshold=2.5,stretch='asinh',angle=0,scaleMode='fixed',channelScale='local';
let spectrumScale='auto',spectrumZoom=1;
let aperture:Aperture={x:63.5,y:63.5,radius:2},measurement:Measurement;
let zoom=1,pan={x:63.5,y:63.5},playing:ReturnType<typeof setInterval>|undefined,sequence=0;
let cachedMoments:ReturnType<typeof moments>|undefined,cachedKey='',limit=.004;
let catalog:Pick<CubeMeta,'id'|'title'|'description'|'kind'|'sourceId'>[]=[];
const esc=(x:unknown)=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const btn=(action:string,label:string,extra='')=>`<button type="button" data-action="${action}" ${extra}>${label}</button>`;
const format=(n:number|null,digits=1)=>n===null||!Number.isFinite(n)?'—':n.toFixed(digits);
const color=(t:number)=>{
  return inferno[Math.round(Math.max(0,Math.min(1,t))*255)];
};

root.innerHTML=`<main class="explorer-shell">
  <header class="masthead"><div class="explorer-brand"><img src="./icon.svg" alt=""/><div><span class="eyebrow">THE OBSERVATORY / 双目标调查</span><h1>21厘米 · 星系观测台</h1></div></div><div class="header-actions">${btn('night','观测室')}${btn('talk','问林岚')}${btn('book','资料书')}${btn('album','星系图鉴')}${btn('reset','重新开始')}${hasProgressBackup()?btn('restore-backup','恢复备份'):''}<a href="./legacy.html">旧版对照 ↗</a></div></header>
  <section id="night-banner" class="night-banner"></section>
  <div class="object-bar"><span class="tiny-label">今夜的观测对象</span><div id="objects"></div><span class="pending-object">自由观察 · 保留你的发现</span></div>
  <section class="observing-intro"><div><span class="eyebrow">自由选区 · 速度扫描 · 测量与收藏</span><h2 id="target-title">正在打开数据…</h2><p id="target-description">这里的每幅图、每条谱线与每张 PV 图，来自同一份 cube。</p></div><div id="dataset-badge"></div></section>
  <section class="explorer-workspace">
    <article class="sky-card paper"><div class="tool-row" id="image-modes">${[['optical','光学'],['moment0','HI 积分'],['moment1','速度场'],['channel','通道扫描']].map(([id,label])=>btn('mode',label,`data-id="${id}" class="${id==='moment0'?'selected':''}"`)).join('')}<span class="tool-spacer"></span>${btn('zoom','放大 ×1','id="zoom-button"')}${btn('center','居中选区')}</div>
      <div class="sky-stage"><canvas id="sky" width="720" height="720" role="img" aria-label="共享 cube 的天空投影，点击或拖动任意位置可提取局部谱线"></canvas><div class="sky-topline"><span id="view-label">HI 积分图</span><span id="data-type">合成观测</span></div><div class="sky-bottomline"><span id="position-label"></span><span id="beam-label"></span></div></div>
      <div id="map-legend" class="map-legend"></div>
      <div class="spectral-control"><label for="channel">速度通道 <output id="channel-output"></output></label>${btn('play','▶ 扫描','id="play-button"')}<input id="channel" type="range" min="0" max="100" value="50" aria-label="速度通道"/></div>
      <div id="channel-options" class="channel-options" hidden><label>通道色标 <select id="channel-scale" aria-label="通道图线性范围"><option value="local">逐通道线性 · 当前 min–max</option><option value="common">固定线性 · 同源比较</option></select></label><span id="channel-scale-note"></span></div>
      <p class="instrument-note">扫描的是速度轴，不是星系随时间演化。点选任何位置，让谱线回答你。</p>
      <details class="display-controls"><summary>显示与频段工具</summary><div><label>积分起点 <output id="lo-output"></output><input id="lo" type="range" min="0" max="100" value="0" aria-label="积分起点"/></label><label>积分终点 <output id="hi-output"></output><input id="hi" type="range" min="0" max="100" value="100" aria-label="积分终点"/></label><label>显示门槛 <output id="threshold-output">2.5 σ</output><input id="threshold" type="range" min="0.5" max="6" step="0.1" value="2.5" aria-label="显示门槛"/></label><label>积分图拉伸 <select id="stretch" aria-label="显示拉伸"><option value="asinh">asinh · 看弱结构</option><option value="linear">线性</option></select></label><label>积分图 / PV 比例 <select id="scale-mode" aria-label="科学图强度比例"><option value="fixed">统一比较 · 同源共用强度色标</option><option value="auto">自动增强 · 每批单独缩放</option></select></label></div><p id="scale-explanation">统一比较保留批次间的强弱差异；自动增强适合找弱线，不能据亮度比较批次。moment 图采用阈值掩膜，并要求同像素至少连续三个通道越过门槛。</p></details>
    </article>
    <aside class="measurement-card paper"><div class="card-heading"><div><span class="eyebrow">MEASURE / 让数据给出线索</span><h2>你选中的这片天空</h2></div><span class="simulation-badge" id="cube-shape"></span></div>
      <div class="aperture-control"><label for="radius">孔径半径 <output id="radius-output">2 像素</output></label><input id="radius" type="range" min="1" max="10" step="1" value="2" aria-label="孔径半径"/>${btn('ask-aperture','问林岚','class="context-help" aria-label="请林岚讲解孔径"')}</div>
      <div class="spectrum-tools"><label>谱纵轴 <select id="spectrum-scale-select" aria-label="孔径谱纵轴模式"><option value="auto">自动贴合当前谱</option><option value="common">同源共用纵轴</option></select></label><span class="tool-spacer"></span>${btn('spectrum-out','−','aria-label="纵轴缩小"')}${btn('spectrum-in','＋','aria-label="纵轴放大"')}<output id="spectrum-zoom">×1</output>${btn('spectrum-fit','适配当前谱')}</div>
      <div id="local-spectrum" class="local-spectrum"></div><p id="spectrum-scale" class="instrument-note"></p><div class="measurements"><div><span>候选信号 S/N</span><b id="snr-value">—</b><small id="peak-value"></small></div><div><span>谱中心速度</span><b id="velocity-value">—</b></div><div><span>连续越阈通道</span><b id="run-value">—</b></div></div>
      <div class="pv-heading"><div><span class="eyebrow">POSITION–VELOCITY / 切开速度结构</span><h3>沿这条切线看看</h3></div>${btn('ask-pv','问林岚','class="context-help" aria-label="请林岚讲解PV图"')}<output id="angle-output">0°</output></div><input id="angle" type="range" min="0" max="180" step="1" value="0" aria-label="PV 切线角度"/>
      <div class="pv-wrap"><span id="pv-high"></span><canvas id="pv" width="512" height="220" role="img" aria-label="当前位置的PV图，横轴为沿切线的角距离，纵轴为视向速度"></canvas><span id="pv-low"></span></div><p id="pv-axis" class="pv-axis"></p>
      <div class="finding-form"><input id="finding-note" type="text" maxlength="80" placeholder="写一句发现，例如：盘外有一条窄谱线" aria-label="发现备注"/>${btn('save-finding','＋ 收进发现手记','class="primary"')}${btn('listen','♪ 听这条谱线','class="secondary"')}</div>
      <p class="instrument-note">孔径谱为选区均值；S/N 用边缘通道估计，仅作探索提示。点击谱线可以跳到对应速度通道。</p>
    </aside>
  </section>
  <section class="exploration-goals paper"><div><span class="eyebrow">DISCOVERIES / 由你的测量解锁</span><h2>今夜可以发现什么</h2></div><div id="goal-list"></div></section>
  <section class="field-notebook paper"><div class="notebook-heading"><div><span class="eyebrow">FIELD NOTES / 每次观测都有自己的记录</span><h2>发现手记</h2></div><a id="fits-download" download>下载此 cube 的 FITS ↗</a></div><div id="findings"></div></section>
  <footer class="explorer-footer"><span id="explorer-status" role="status" aria-live="polite">正在加载数据。</span><span>浏览器试玩 · 进度保存在本机 · v0.4</span></footer>
</main><div id="explorer-dialog"></div><div id="night-root" hidden></div>`;

const night=new ObservingNight(document.querySelector('#night-root')!,document.querySelector('#night-banner')!,async (id,view)=>{mode=view??'moment0';await chooseObject(id);document.querySelector('#target-title')?.scrollIntoView({block:'start',behavior:'auto'});},syncNightCatalog,restore=>openProgressDialog(Boolean(restore)));
function syncNightCatalog(){
  catalog=[...catalog.filter(d=>!d.id.startsWith('night-')),...night.entries()];
  document.querySelector('#objects')!.innerHTML=catalog.map(d=>btn('object',esc(d.title),`data-id="${esc(d.id)}"`)).join('');
}

function status(text:string){document.querySelector('#explorer-status')!.textContent=text;}
function saveNotebook(){try{localStorage.setItem(STORE,JSON.stringify(findings));}catch{status('本地存储不可用或已满，这次记录暂留在当前页面。');}}
function stopPlay(){if(playing)clearInterval(playing);playing=undefined;document.querySelector('#play-button')!.textContent='▶ 扫描';}
function stateInputs(){
  const [nv,ny,nx]=cube.meta.shape;
  for(const id of ['channel','lo','hi']){const e=document.querySelector<HTMLInputElement>('#'+id)!;e.max=String(nv-1);e.value=String(id==='channel'?channel:id==='lo'?lo:hi);}
  document.querySelector('#channel-output')!.textContent=`${format(cube.meta.velocities[channel])} km/s · ${channel+1}/${nv}${cube.meta.validChannels&&!cube.meta.validChannels.includes(channel)?' · 缺测':''}`;
  document.querySelector('#lo-output')!.textContent=`${format(cube.meta.velocities[lo])} km/s`;
  document.querySelector('#hi-output')!.textContent=`${format(cube.meta.velocities[hi])} km/s`;
  document.querySelector('#threshold-output')!.textContent=`${threshold.toFixed(1)} σ`;
  document.querySelector('#radius-output')!.textContent=`${aperture.radius} 像素 · ${format(aperture.radius*cube.meta.pixelScaleArcsec,0)}″`;
  document.querySelector('#angle-output')!.textContent=`${angle}°`;
  document.querySelector<HTMLInputElement>('#radius')!.value=String(aperture.radius);
  document.querySelector('#cube-shape')!.textContent=`${nx} × ${ny} × ${nv}`;
  document.querySelector('#zoom-button')!.textContent=`放大 ×${zoom}`;
  const o=cube.meta.observation,skyEast=(o?.fieldEastArcmin??0)-(aperture.x-(nx-1)/2)*cube.meta.pixelScaleArcsec/60,skyNorth=(o?.fieldNorthArcmin??0)+((ny-1)/2-aperture.y)*cube.meta.pixelScaleArcsec/60;
  document.querySelector('#position-label')!.textContent=o?`天空 E ${format(skyEast)}′ / N ${format(skyNorth)}′ · N ↑ E ←`:`像素 (${format(aperture.x,0)}, ${format(aperture.y,0)}) · N ↑ E ←`;
  document.querySelector('#beam-label')!.textContent=cube.meta.beamMajorArcsec?`波束 ${format(cube.meta.beamMajorArcsec,0)}″`:'波束信息见数据说明';
  document.querySelector('#view-label')!.textContent={optical:'光学星光 · 模型示意',moment0:'HI 积分 · masked moment 0',moment1:'视向速度 · masked moment 1',channel:`通道 · ${format(cube.meta.velocities[channel])} km/s · ${channelScale==='local'?'逐通道':'固定'}线性`}[mode];
  document.querySelector<HTMLElement>('#channel-options')!.hidden=mode!=='channel';
  document.querySelectorAll<HTMLButtonElement>('#image-modes button').forEach(b=>{b.classList.toggle('selected',b.dataset.id===mode);b.setAttribute('aria-pressed',String(b.dataset.id===mode));});
}
function getMoments(){const key=`${cube.meta.id}/${threshold}/${lo}/${hi}`;if(key!==cachedKey){cachedMoments=moments(cube,threshold,lo,hi);cachedKey=key;}return cachedMoments!;}
function crop(){const [,ny,nx]=cube.meta.shape;return {x:Math.max(0,Math.min(nx-nx/zoom,pan.x-nx/zoom/2)),y:Math.max(0,Math.min(ny-ny/zoom,pan.y-ny/zoom/2)),w:nx/zoom,h:ny/zoom};}
function fixedScale(){return scaleMode==='fixed'?cube.meta.displayScale:undefined;}
function channelLimit(){return fixedScale()?.channel??limit;}
function observationCover(c:Cube){
  const [,ny,nx]=c.meta.shape,m=moments(c,2.5).moment0,canvas=document.createElement('canvas');canvas.width=nx;canvas.height=ny;
  const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(nx,ny);let top=c.meta.displayScale?.moment0??0;
  if(!top)for(const value of m)top=Math.max(top,value);top=Math.max(top,1e-9);
  for(let i=0;i<m.length;i++){const t=Math.max(0,Math.min(1,Math.asinh(m[i]/top*10)/Math.asinh(10)));pixels.data.set([...color(t),255],i*4);}ctx.putImageData(pixels,0,0);return canvas.toDataURL('image/png');
}
function mapImage(){
  const [,ny,nx]=cube.meta.shape,canvas=document.createElement('canvas');canvas.width=nx;canvas.height=ny;const ctx=canvas.getContext('2d')!;
  const legend=document.querySelector<HTMLElement>('#map-legend')!;
  if(mode==='optical'){legend.textContent='同一天空的合成星光示意 · 相对亮度';ctx.fillStyle='#000004';ctx.fillRect(0,0,nx,ny);const o=cube.meta.observation;ctx.drawImage(optical,(o?.fieldEastArcmin??0)*60/cube.meta.pixelScaleArcsec,(o?.fieldNorthArcmin??0)*60/cube.meta.pixelScaleArcsec,nx,ny);return canvas;}
  const pixels=ctx.createImageData(nx,ny),m=mode==='channel'?undefined:getMoments();
  const map=mode==='moment0'?m!.moment0:mode==='moment1'?m!.moment1:cube.data.subarray(channel*nx*ny,(channel+1)*nx*ny);
  let top=channelLimit();if(mode==='moment0'){if(fixedScale())top=fixedScale()!.moment0;else{const vals=Array.from(map).filter(x=>x>0).sort((a,b)=>a-b);top=vals[Math.floor(vals.length*.98)]||1;}}
  const range=Math.max(40,(cube.meta.velocities.at(-1)!-cube.meta.velocities[0])*.36);
  const bounds=mode==='channel'?channelValueRange(cube,channel):null;
  const lower=mode==='channel'?(channelScale==='local'?(bounds?.min??0):-((cube.meta.displayScale?.channel??limit)*.25)):0;
  if(mode==='channel')top=channelScale==='local'?(bounds?.max??0):(cube.meta.displayScale?.channel??limit);
  const labels=mode==='moment1'?[`${format(cube.meta.vsys-range,0)}`,`${format(cube.meta.vsys+range,0)} km/s`]:mode==='channel'?[`${format(lower*1000,2)}`,`${format(top*1000,2)} mJy beam⁻¹`]:['0',`${format(top,3)} Jy beam⁻¹ km s⁻¹`];
  const label=mode==='channel'?(channelScale==='local'?' · 本通道线性':' · 固定线性'):fixedScale()?' · 共用':' · 自动';
  legend.innerHTML=mode==='channel'&&!bounds?'<span>缺测 · 当前通道未覆盖或已标记，无有效像素</span>':`<span>${labels[0]}</span><i class="inferno-scale" aria-hidden="true"></i><span>${labels[1]}${mode!=='moment1'?label:''}</span>`;
  if(mode==='channel')document.querySelector('#channel-scale-note')!.textContent=!bounds?'灰色是缺测；没有可拉伸的数据。':channelScale==='local'?'按本通道有限像素的 min–max 线性映射；纯噪声也会占满色阶，请读色标幅度。':'同源通道共用固定线性范围，便于比较绝对强度。';
  for(let n=0;n<map.length;n++){
    let rgb=mode==='channel'&&!Number.isFinite(map[n])?[46,49,54]:inferno[0],v=map[n];
    if(Number.isFinite(v)){
      if(mode==='moment1'){
        const t=Math.max(-1,Math.min(1,(v-cube.meta.vsys)/range));
        rgb=color((t+1)/2);
      }else{
        let t=mode==='channel'?(top>lower?(v-lower)/(top-lower):v===0?0:.5):Math.max(0,v/top);
        if(mode!=='channel'&&stretch==='asinh')t=Math.asinh(t*10)/Math.asinh(10);
        rgb=color(t);
      }
    }
    pixels.data.set([...rgb,255],n*4);
  }
  ctx.putImageData(pixels,0,0);return canvas;
}
function drawSky(){
  const canvas=document.querySelector<HTMLCanvasElement>('#sky')!,ctx=canvas.getContext('2d')!,S=canvas.width,c=crop();
  ctx.fillStyle='#091724';ctx.fillRect(0,0,S,S);ctx.imageSmoothingEnabled=true;ctx.drawImage(mapImage(),c.x,c.y,c.w,c.h,0,0,S,S);
  const point=(x:number,y:number)=>[(x-c.x)/c.w*S,(y-c.y)/c.h*S];
  const [cx,cy]=point(aperture.x,aperture.y);
  if(night.has(cube.meta.id)){
    const o=cube.meta.observation;const [ox,oy]=point(63.5+(o?.fieldEastArcmin??0)*60/cube.meta.pixelScaleArcsec,63.5+(o?.fieldNorthArcmin??0)*60/cube.meta.pixelScaleArcsec),r=3.7/(4*8*1000/206265)/c.w*S;
    ctx.save();ctx.translate(ox,oy);ctx.rotate(-28*Math.PI/180);ctx.strokeStyle='#f4d5a477';ctx.setLineDash([3,7]);ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(0,0,r,r*Math.cos(56*Math.PI/180),0,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  ctx.save();ctx.strokeStyle='rgba(243,226,179,.7)';ctx.lineWidth=1.2;ctx.setLineDash([6,6]);
  const a=angle*Math.PI/180;ctx.beginPath();ctx.moveTo(cx-Math.cos(a)*S*2,cy+Math.sin(a)*S*2);ctx.lineTo(cx+Math.cos(a)*S*2,cy-Math.sin(a)*S*2);ctx.stroke();ctx.setLineDash([]);
  ctx.lineWidth=2;ctx.strokeStyle='#ffecd0';ctx.beginPath();ctx.arc(cx,cy,Math.max(5,aperture.radius/c.w*S),0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx-6,cy);ctx.lineTo(cx+6,cy);ctx.moveTo(cx,cy-6);ctx.lineTo(cx,cy+6);ctx.stroke();
  ctx.font='18px Georgia';ctx.textAlign='center';
  findings.filter(f=>f.dataset===cube.meta.id).forEach((f,n)=>{const [x,y]=point(f.x,f.y);ctx.fillStyle='#e9c886';ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.fill();ctx.fillStyle='#233b46';ctx.fillText(String(n+1),x,y+6);});
  if(cube.meta.beamMajorArcsec){const r=cube.meta.beamMajorArcsec/cube.meta.pixelScaleArcsec/c.w*S/2;ctx.strokeStyle='#e7dfc5';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(S-32,S-35,r,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}
function drawSpectrum(){
  const v=cube.meta.velocities,profile=measurement.profile,locked=spectrumScale==='common'?cube.meta.displayScale?.spectrum:undefined;
  const {minimum,maximum,clipped,hasData}=spectrumBounds(profile,measurement.rms,locked,spectrumZoom);
  const sx=(value:number)=>52+(value-v[0])/(v.at(-1)!-v[0])*504;
  const sy=(value:number)=>155-(value-minimum)/(maximum-minimum)*135;
  let path='',pen=false;profile.forEach((value,k)=>{if(!Number.isFinite(value)){pen=false;return;}path+=`${pen?'L':'M'}${sx(v[k]).toFixed(2)},${sy(value).toFixed(2)} `;pen=true;});
  const missing=profile.map((value,k)=>Number.isFinite(value)?'':`<rect x="${sx(v[k])-(504/profile.length)/2}" y="20" width="${504/profile.length+.5}" height="135" fill="#a2a4a3" opacity=".19"/>`).join('');
  const ticks=Array.from({length:5},(_,n)=>v[0]+(v.at(-1)!-v[0])*n/4);
  document.querySelector('#local-spectrum')!.innerHTML=`<svg viewBox="0 0 580 202" role="img" aria-label="当前自由选区的孔径均值谱。点击谱线可切换速度通道。灰带代表缺测。">
    <defs><clipPath id="spectrum-clip"><rect x="52" y="20" width="504" height="135"/></clipPath></defs>
    <g clip-path="url(#spectrum-clip)"><rect x="${sx(v[lo])}" y="20" width="${sx(v[hi])-sx(v[lo])}" height="135" fill="#d7c8a5" opacity=".15"/>${missing}<rect x="52" y="${sy(measurement.rms*3)}" width="504" height="${sy(-measurement.rms*3)-sy(measurement.rms*3)}" fill="#8da99b" opacity=".14"/>
    <g class="plot-grid"><path d="M52 155H556M52 ${sy(0)}H556"/></g><path d="${path}" stroke="#44796c" stroke-width="2.2" fill="none"/><path d="M${sx(v[channel])} 20V155" stroke="#bd8b54" stroke-dasharray="5 4"/></g>
    <g class="plot-grid">${ticks.map(t=>`<text x="${sx(t)}" y="176" text-anchor="middle">${format(t,0)}</text>`).join('')}${[minimum,0,maximum].map(t=>`<text x="43" y="${sy(t)+4}" text-anchor="end">${format(t*1000,2)}</text>`).join('')}</g>
    <text x="300" y="198" text-anchor="middle" class="axis-title">视向速度 / km s⁻¹${missing?' · 灰带：缺测':''}</text><text transform="translate(12 90) rotate(-90)" text-anchor="middle" class="axis-title">孔径均值 / mJy beam⁻¹</text></svg>`;
  document.querySelector('#spectrum-zoom')!.textContent=`×${format(spectrumZoom,2)}`;
  document.querySelector<HTMLButtonElement>('[data-action="spectrum-in"]')!.disabled=spectrumZoom>=16;
  document.querySelector<HTMLButtonElement>('[data-action="spectrum-out"]')!.disabled=spectrumZoom<=.25;
  document.querySelector('#spectrum-scale')!.textContent=`${hasData?(locked?'同源共用纵轴':'自动贴合当前孔径谱'):'此孔径无有效谱数据'} · ${format(minimum*1000,2)}…${format(maximum*1000,2)} mJy/beam${clipped?' · 部分曲线超出当前范围，可缩小或适配':''}`;
  document.querySelector('#snr-value')!.textContent=format(measurement.snr,1);
  document.querySelector('#peak-value')!.textContent=`峰 ${format(measurement.peak*1000,2)} mJy/beam`;
  document.querySelector('#velocity-value')!.textContent=`${format(measurement.centroid)} km/s`;
  document.querySelector('#run-value')!.textContent=String(measurement.run);
}
function drawPV(){
  const pv=pvSlice(cube,aperture,angle),nv=cube.meta.shape[0],small=document.createElement('canvas');small.width=pv.steps;small.height=nv;
  const ctx=small.getContext('2d')!,img=ctx.createImageData(pv.steps,nv);
  for(let y=0;y<nv;y++)for(let x=0;x<pv.steps;x++){
    const value=pv.data[(nv-1-y)*pv.steps+x],t=Number.isFinite(value)?Math.asinh(Math.max(0,value)/channelLimit()*10)/Math.asinh(10):0;
    img.data.set([...(Number.isFinite(value)?color(t):[46,49,54]),255],(y*pv.steps+x)*4);
  }
  ctx.putImageData(img,0,0);const canvas=document.querySelector<HTMLCanvasElement>('#pv')!,draw=canvas.getContext('2d')!;
  draw.imageSmoothingEnabled=true;draw.drawImage(small,0,0,canvas.width,canvas.height);
  document.querySelector('#pv-high')!.textContent=`${format(cube.meta.velocities.at(-1)!,0)}`;
  document.querySelector('#pv-low')!.textContent=`${format(cube.meta.velocities[0],0)} km/s`;
  document.querySelector('#pv-axis')!.textContent=`沿切线偏移 −${format(pv.spanArcmin/2)}′ → +${format(pv.spanArcmin/2)}′ · 3 像素宽度均值 · 0° 沿画面水平`;
}
function update(){if(!cube)return;stateInputs();measurement=apertureSpectrum(cube,aperture);drawSky();drawSpectrum();drawPV();night.recordView(cube.meta.id,mode);goals();}
function goals(){
  const mission=night.workspaceGoals(cube.meta.id);
  if(mission){document.querySelector('#goal-list')!.innerHTML=mission.map(g=>`<div class="goal ${g.done?'done':''}"><span>${g.done?'✓':'○'}</span><div><b>${esc(g.title)}</b><small>${esc(g.copy)}</small></div></div>`).join('');return;}
  const notes=findings.filter(f=>f.dataset===cube.meta.id),good=notes.filter(f=>f.snr>=5&&f.run>=3);
  const motion=good.some(a=>good.some(b=>Math.hypot(a.x-b.x,a.y-b.y)>cube.meta.shape[2]*.15&&a.centroid!==null&&b.centroid!==null&&Math.abs(a.centroid-b.centroid)>=25));
  const weak=notes.some(f=>f.snr>=3&&f.snr<15&&f.run>=3);
  document.querySelector('#goal-list')!.innerHTML=[
    [good.length>0,'捕获一条信号','找到一处跨通道出现的发射，记录你的孔径谱。'],
    [motion,'让两处天空说出不同的速度','记录空间分开的两处有效信号，比较其中心速度。'],
    [weak,'给弱线索多一点耐心','寻找较弱的候选信号，验证它在连续通道中出现。'],
  ].map(([done,title,copy])=>`<div class="goal ${done?'done':''}"><span>${done?'✓':'○'}</span><div><b>${title}</b><small>${copy}</small></div></div>`).join('');
}
function renderFindings(){
  document.querySelector('#findings')!.innerHTML=findings.length?findings.slice().reverse().map(f=>`<button class="finding-card" data-action="revisit" data-id="${esc(f.id)}"><img src="${f.thumbnail.startsWith('data:image/png;base64,')?f.thumbnail:''}" alt="所记录的观测画面"/><div><span class="eyebrow">${esc(f.title)}</span><b>${esc(f.note||'一处待继续调查的信号')}</b><small>(${format(f.x,0)}, ${format(f.y,0)}) · ${format(f.centroid)} km/s · S/N ${format(f.snr)}</small></div><span>回到这里 ↗</span></button>`).join(''):'<div class="empty-notebook">还没有画好的答案。去天空中点选一处，把你看到的线索记录下来。</div>';
  if(cube)goals();
}
async function chooseObject(id:string){
  const token=++sequence;stopPlay();status('正在解码 cube，所有派生视图会使用同一份数据。');root.classList.add('is-loading');
  try{
    const loaded=night.has(id)?await night.getCube(id):await loadCube(id);const image=new Image();image.src=`./cubes/${loaded.meta.sourceId??id}/${loaded.meta.opticalFile}`;await image.decode();if(token!==sequence)return;
    cube=loaded;optical=image;const [nv,ny,nx]=cube.meta.shape;channel=Math.floor(nv/2);lo=0;hi=nv-1;zoom=1;spectrumZoom=1;pan={x:(nx-1)/2,y:(ny-1)/2};aperture={...pan,radius:2};cachedKey='';
    const signals=Array.from(cube.data.filter((_,n)=>n%16===0)).filter(v=>v>cube.meta.rms*5).sort((a,b)=>a-b);
    limit=Math.max(cube.meta.rms*12,signals[Math.floor(signals.length*.97)]||.004);
    document.querySelector('#target-title')!.textContent=cube.meta.title;
    document.querySelector('#target-description')!.textContent=cube.meta.description;
    document.querySelector('#dataset-badge')!.innerHTML=`<span>${cube.meta.kind==='simulation'?'参数化合成观测':'真实观测派生数据'}</span><small>PPV · ${format(cube.meta.fieldArcmin)}′ 视场</small>`;
    document.querySelector('#data-type')!.textContent=cube.meta.kind==='simulation'?'模拟数据':'观测数据';
    const fits=document.querySelector<HTMLAnchorElement>('#fits-download')!;fits.href=night.has(id)?'#':`./cubes/${id}/${cube.meta.fitsFile}`;fits.textContent=night.has(id)?'下载本次观测的 FITS ↗':'下载此 cube 的 FITS ↗';
    document.querySelectorAll<HTMLButtonElement>('#objects button').forEach(b=>b.classList.toggle('selected',b.dataset.id===id));
    update();renderFindings();status('数据已就绪。点选或拖动任意位置，开始你的观测。');
  }catch(error){status(error instanceof Error?error.message:'数据加载失败');}finally{if(token===sequence)root.classList.remove('is-loading');}
}
function modal(title:string,body:string){
  stopPlay();document.querySelector('#explorer-dialog')!.innerHTML=`<div class="dialog-backdrop"><section class="dialog-paper explorer-modal" role="dialog" aria-modal="true" aria-labelledby="explore-dialog-title"><div class="dialog-heading"><div><span class="eyebrow">OBSERVATORY / 资料与发现</span><h2 id="explore-dialog-title">${title}</h2></div>${btn('close','×','class="close-button" aria-label="关闭对话框"')}</div><div class="dialog-body">${body}</div></section></div>`;
  document.querySelector<HTMLButtonElement>('[data-action="close"]')?.focus();
}
function openProgressDialog(restore:boolean){
  if(night.isBusy()){status('本批观测正在完成，请稍后再重置或恢复。');return;}
  modal(restore?'恢复最近的本地备份？':'清空记录，重新开始？',restore?
    `<p>将当前进度与最近的本地快照交换。当前进度也会成为一份可恢复快照。</p><div class="reset-scope">包括观测批次、发现手记、两份任务、对话 / 教程和交班记录。</div><div class="reset-actions">${btn('confirm-restore','确认恢复','class="primary"')}${btn('close','取消','class="secondary"')}</div>`:
    `<p>重新从林岚的交班开始。本版以下记录会被清空：</p><div class="reset-scope">观测批次 · 发现手记 · 任务进度 · 对话 / 教程 · 交班报告</div><p class="small-copy">确认后先保存一份本地快照，再清空。可以用“恢复备份”找回本次清空前的进度；最近快照会随操作更新。</p><div class="reset-actions">${btn('confirm-reset','确认清空并重新开始','class="danger"')}${btn('close','取消','class="secondary"')}${hasProgressBackup()?btn('restore-backup','恢复备份','class="secondary"'):''}</div>`);
}
function listen(){
  const a=new AudioContext(),profile=measurement.profile,max=Math.max(...profile.filter(Number.isFinite),.00001),t=a.currentTime;
  for(let k=0;k<profile.length;k++){
    const value=Math.max(0,profile[k]);if(!Number.isFinite(value)||value<max*.04)continue;
    const o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.value=130+700*k/(profile.length-1);
    const start=t+k*.025;g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(.025*value/max,start+.015);g.gain.exponentialRampToValueAtTime(.0001,start+.10);
    o.connect(g);g.connect(a.destination);o.start(start);o.stop(start+.11);
  }
  setTimeout(()=>void a.close(),profile.length*25+400);status('数据声化：速度映射为音高，强度映射为响度。这不是宇宙的原始声音。');
}
root.addEventListener('click',async event=>{
  const target=(event.target as HTMLElement).closest<HTMLElement>('[data-action]');if(!target)return;
  const action=target.dataset.action,id=target.dataset.id;
  if(action==='close'){document.querySelector('#explorer-dialog')!.innerHTML='';return;}
  if(action==='object'){document.querySelector('#explorer-dialog')!.innerHTML='';await chooseObject(id!);return;}
  if(action==='night'){stopPlay();night.open();return;}
  if(action==='talk'){stopPlay();night.talk('next');return;}
  if(action==='ask-aperture'||action==='ask-pv'){stopPlay();night.talk(action==='ask-aperture'?'aperture':'pv');return;}
  if(action==='reset'||action==='restore-backup'){openProgressDialog(action==='restore-backup');return;}
  if(action==='confirm-reset'||action==='confirm-restore'){
    if(night.isBusy())return;try{stopPlay();if(action==='confirm-reset')resetProgress(localStorage);else restoreProgress(localStorage);const url=new URL(location.href);url.search='?night=1';location.assign(url.href);}catch(error){modal('进度未清空',`<p>本地快照操作未完成，原记录已保留。</p><p>${esc(error instanceof Error?error.message:String(error))}</p>`);}return;
  }
  if(!cube)return;
  if(action==='spectrum-in'||action==='spectrum-out'||action==='spectrum-fit'){
    if(action==='spectrum-in')spectrumZoom=Math.min(16,spectrumZoom*1.5);
    if(action==='spectrum-out')spectrumZoom=Math.max(.25,spectrumZoom/1.5);
    if(action==='spectrum-fit'){spectrumScale='auto';spectrumZoom=1;document.querySelector<HTMLSelectElement>('#spectrum-scale-select')!.value='auto';}
    drawSpectrum();return;
  }
  if(action==='mode'){mode=id as ImageMode;stopPlay();update();}
  if(action==='zoom'){zoom=zoom===1?2:1;pan={x:aperture.x,y:aperture.y};update();}
  if(action==='center'){pan={x:aperture.x,y:aperture.y};update();}
  if(action==='play'){
    if(playing)stopPlay();else{mode='channel';document.querySelector('#play-button')!.textContent='Ⅱ 暂停';playing=setInterval(()=>{channel=(channel+1)%cube.meta.shape[0];stateInputs();drawSky();drawSpectrum();},140);}
  }
  if(action==='save-finding'){
    const canvas=document.querySelector<HTMLCanvasElement>('#sky')!,thumb=document.createElement('canvas');thumb.width=200;thumb.height=200;thumb.getContext('2d')!.drawImage(canvas,0,0,200,200);
    const note=document.querySelector<HTMLInputElement>('#finding-note')!.value.trim();
    findings.push({id:crypto.randomUUID(),dataset:cube.meta.id,title:cube.meta.title,x:aperture.x,y:aperture.y,radius:aperture.radius,channel,view:mode,snr:measurement.snr,centroid:measurement.centroid,run:measurement.run,note,thumbnail:thumb.toDataURL('image/png')});
    findings=findings.slice(-24);saveNotebook();
    night.recordFinding({dataset:cube.meta.id,x:aperture.x,y:aperture.y,snr:measurement.snr,centroid:measurement.centroid,run:measurement.run});
    renderFindings();drawSky();status('这处天空已收进手记。任务卡已经更新，可以继续寻找或向林岚提问。');
  }
  if(action==='revisit'){
    const f=findings.find(f=>f.id===id);if(!f)return;if(!catalog.some(d=>d.id===f.dataset)){status('这份记录对应的数据目前没有接入。');return;}if(cube.meta.id!==f.dataset)await chooseObject(f.dataset);
    aperture={x:Math.max(0,Math.min(cube.meta.shape[2]-1,f.x)),y:Math.max(0,Math.min(cube.meta.shape[1]-1,f.y)),radius:Math.max(1,Math.min(10,f.radius))};pan={x:aperture.x,y:aperture.y};mode=['optical','moment0','moment1','channel'].includes(f.view)?f.view:'moment0';channel=Math.max(0,Math.min(cube.meta.shape[0]-1,Math.floor(f.channel)));document.querySelector<HTMLInputElement>('#radius')!.value=String(aperture.radius);update();status('已回到你记录的孔径与速度通道。');
  }
  if(action==='listen')listen();
  if(action==='book')modal('观测资料书',`<h3>先让数据保持一致</h3><p>这里的通道图、积分图、速度图、局部谱线和 PV 图，都由同一份 position–position–velocity cube 得到。第三轴是速度，不是第三个空间深度。</p><h3>可以怎样探索？</h3><p>在图上自由点击或拖动，孔径谱会跟着位置变化。播放通道扫描，寻找只在某些速度出现的结构。转动 PV 切线，比较沿不同方向的运动。</p><p>放大不增加数据的物理分辨率。调拉伸能让弱结构更容易看见，却不能提高真实信噪比。孔径加大可以改变均值谱与噪声，但也可能混合不同运动成分。</p><h3>显示与测量</h3><p>moment 图采用所选频段、阈值和至少三通道条件；它们会影响图中显示的结构。孔径谱始终来自原始有正负值的 cube。S/N 使用谱边缘通道的 MAD 估计，作为探索指标，不是正式检出显著性。</p><p>光学图是模型示意；气体尾由人为设置，不是流体动力学演化结果。先记录现象，再检验成因。</p><h3>这份数据的处理</h3><ul>${cube.meta.processing.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`);
  if(action==='album'){
    try{
      const covers=await Promise.all(catalog.map(async d=>night.has(d.id)?observationCover(await night.getCube(d.id)):`./cubes/${d.id}/moment0-preview.png`));
      modal('星系图鉴',`<p>每批观测都有自己的积分图。打开档案可继续比较指向、频段与噪声。</p><div class="album-grid">${catalog.map((d,i)=>`<button data-action="object" data-id="${esc(d.id)}"><img src="${esc(covers[i])}" alt="${night.has(d.id)?'本批实际观测的积分图':'源模型积分预览'}"/><span>${esc(d.title)}</span><small>${findings.some(f=>f.dataset===d.id)?'已有发现记录':'等待你的第一次记录'}${night.has(d.id)?' · 本批成像':''}</small></button>`).join('')}</div><p class="small-copy">档案均为参数化合成观测。批次封面由各自数据生成，同源批次共用强度标尺。</p>`);
    }catch{status('图鉴加载未完成，请稍后重新打开。');}
  }
});
const sky=document.querySelector<HTMLCanvasElement>('#sky')!;let dragging=false;
function point(event:PointerEvent){if(!cube)return;const rect=sky.getBoundingClientRect(),c=crop();aperture.x=Math.max(0,Math.min(cube.meta.shape[2]-1,c.x+(event.clientX-rect.left)/rect.width*c.w));aperture.y=Math.max(0,Math.min(cube.meta.shape[1]-1,c.y+(event.clientY-rect.top)/rect.height*c.h));update();}
sky.addEventListener('pointerdown',event=>{dragging=true;sky.setPointerCapture(event.pointerId);point(event);});
sky.addEventListener('pointermove',event=>{if(dragging)point(event);});sky.addEventListener('pointerup',()=>dragging=false);sky.addEventListener('pointercancel',()=>dragging=false);
sky.tabIndex=0;sky.addEventListener('keydown',event=>{if(!cube)return;const steps:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};const d=steps[event.key];if(d){event.preventDefault();aperture.x=Math.max(0,Math.min(cube.meta.shape[2]-1,aperture.x+d[0]));aperture.y=Math.max(0,Math.min(cube.meta.shape[1]-1,aperture.y+d[1]));update();}});
root.addEventListener('input',event=>{
  if(!cube)return;const input=event.target as HTMLInputElement,value=Number(input.value);
  if(input.id==='channel'){channel=value;mode='channel';}
  if(input.id==='lo'){lo=Math.min(value,hi-1);}
  if(input.id==='hi'){hi=Math.max(value,lo+1);}
  if(input.id==='threshold')threshold=value;
  if(input.id==='radius')aperture.radius=value;
  if(input.id==='angle')angle=value;
  if(['channel','lo','hi','threshold','radius','angle'].includes(input.id))update();
});
document.querySelector('#stretch')!.addEventListener('change',event=>{stretch=(event.target as HTMLSelectElement).value;drawSky();});
document.querySelector('#scale-mode')!.addEventListener('change',event=>{scaleMode=(event.target as HTMLSelectElement).value;update();});
document.querySelector('#channel-scale')!.addEventListener('change',event=>{channelScale=(event.target as HTMLSelectElement).value;mode='channel';stopPlay();update();});
document.querySelector('#spectrum-scale-select')!.addEventListener('change',event=>{spectrumScale=(event.target as HTMLSelectElement).value;spectrumZoom=1;drawSpectrum();});
document.querySelector('#local-spectrum')!.addEventListener('pointerdown',event=>{
  if(!cube)return;const svg=document.querySelector('#local-spectrum svg')!;const r=svg.getBoundingClientRect();const x=((event as PointerEvent).clientX-r.left)/r.width*580;
  channel=Math.max(0,Math.min(cube.meta.shape[0]-1,Math.round((x-52)/504*(cube.meta.shape[0]-1))));mode='channel';update();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('#explorer-dialog')!.innerHTML='';});
document.querySelector('#fits-download')!.addEventListener('click',event=>{
  if(!cube||!night.has(cube.meta.id))return;event.preventDefault();const bytes=cubeFits(cube),url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/fits'}));
  const link=document.createElement('a');link.href=url;link.download=`${cube.meta.id}-${cube.meta.targetCode??'GX-07'}.fits`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
});
async function start(){
  try{const response=await fetch('./cubes/catalog.json');if(!response.ok)throw new Error('Cube 目录未就绪');catalog=await response.json();
    syncNightCatalog();await chooseObject(night.latest()??night.selected());if(new URLSearchParams(location.search).has('night'))night.open();
  }catch(e){status(String(e));}
}
void start();
