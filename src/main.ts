import './style.css';
import room from '../assets/concepts/concept-b-galaxy-archive-v1.png';
import { chapters, evidence, regionFeedback } from './content';
import { BRIDGE_REGIONS, CASE_REGIONS, TARGET, lineWidth50, matchPercent, projectedVelocity, spectrum } from './science';
import { canComplete, collect, freshProgress, parseProgress } from './state';
import type { View } from './state';
import { createObservatory } from './observatory';

const SAVE_KEY = 'galaxy-letters-v1';
const app = document.querySelector<HTMLDivElement>('#app')!;
document.documentElement.style.setProperty('--room-image', `url("${room}")`);
let progress = parseProgress(readSave());
let view: View = progress.chapters[progress.current].viewed.at(-1) ?? 'optical';
let map: ReturnType<typeof createObservatory> | undefined;
let message = '';
let storageAvailable = true;
let audio: AudioContext | undefined;
let dialogFocus: HTMLElement | null = null;

function readSave() { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } }
function readBackup() { try { return localStorage.getItem(`${SAVE_KEY}-backup`); } catch { return null; } }
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); }
  catch { storageAvailable = false; }
}
function ping(success = false) {
  if (!progress.sound) return;
  try {
    audio ??= new AudioContext(); void audio.resume();
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = success ? 880 : 520;
    gain.gain.setValueAtTime(.035, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .14);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + .15);
  } catch { /* Audio is optional. */ }
}
const icon = `<svg viewBox="0 0 60 60" aria-hidden="true"><g transform="translate(30 30) rotate(-28)" fill="none" stroke="currentColor"><ellipse rx="26" ry="13" stroke-width="1.4"/><ellipse rx="16" ry="8"/><circle r="4" fill="currentColor"/></g></svg>`;
const arrow = '<span aria-hidden="true">↗</span>';
function button(action: string, label: string, cls = '', attrs = '') { return `<button type="button" class="${cls}" data-action="${action}" ${attrs}>${label}</button>`; }
function notify(text: string, good = false) {
  message = text;
  const toast = document.querySelector<HTMLElement>('#live-feedback');
  if (toast) { toast.textContent = text; toast.classList.toggle('good', good); }
}
function current() { return progress.chapters[progress.current]; }
function observed() {
  if (progress.current === 1) return;
  if (!current().viewed.includes(view)) current().viewed.push(view);
}
function syncMap() {
  map?.scene.sync({ chapter: progress.current, view, region: current().region, rotation: progress.rotation, inclination: progress.inclination, hint: current().hint, geometry: progress.geometry });
  const canvas = document.querySelector<HTMLCanvasElement>('#observation-canvas canvas');
  if (canvas) { canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `教学模拟：${progress.current === 1 ? '旋转盘投影示意' : view === 'optical' ? '光学星光分布' : view === 'hi' ? '中性原子氢分布' : '相对视向速度场'}。图上区域可通过下方按钮选择。`); }
}

function showHome() {
  map?.destroy(); map = undefined;
  app.innerHTML = `<main class="home">
    <div class="home-top"><span class="wordmark">${icon}<span>THE OBSERVATORY<br><b>21cm · 星系档案室</b></span></span><span class="home-version">教学试玩版 · v0.1</span></div>
    <section class="welcome-paper">
      <span class="eyebrow">一片天空，三份未完的档案</span>
      <div class="home-orbit" aria-hidden="true">${icon}</div>
      <h1>21厘米<span>星系来信</span></h1>
      <p class="welcome-copy">星光之外，还有故事。<br>今夜，借一双射电的眼睛，<br>读懂气体留下的线索。</p>
      <div class="welcome-chapters"><span>01 看见气体</span><i>—</i><span>02 读出运动</span><i>—</i><span>03 追踪去向</span></div>
      ${button('start', `${progress.started ? '继续我的档案' : '开始今晚的观测'} ${arrow}`, 'primary start-button')}
      <p class="welcome-note">约 10–15 分钟 · 鼠标或键盘 · 无需天文基础</p>
      <div class="home-links">${button('handbook', '翻阅观测手册', 'text-button')}<span>·</span>${button('credits', '关于这个观测站', 'text-button')}${readBackup() ? button('restore', '恢复上次档案', 'text-button') : ''}</div>
    </section>
    <p class="home-foot">所有案件使用明确标注的教学模拟。你的进度仅保存在这台设备。</p>
  </main><div id="dialog-root"></div>`;
}

function mount() {
  map?.destroy(); map = undefined;
  app.innerHTML = `<main class="app-shell">
    <header class="masthead"><button class="wordmark brand-button" data-action="home" aria-label="返回封面">${icon}<span>21厘米<span class="brand-sub">星系来信</span></span></button>
      <div class="station-status"><span class="status-dot"></span>夜间观测站 <span class="divider">/</span> <span id="save-status">本地档案已保存</span></div>
      <div class="header-actions">${button('sound', '', 'quiet-button', 'id="sound-button"')}${button('handbook', '观测手册', 'quiet-button')}${button('collection', '我的档案', 'quiet-button')}</div></header>
    <nav class="chapter-nav" aria-label="案件导航" id="chapter-nav"></nav>
    <section class="workspace">
      <article class="observation-card paper">
        <div class="card-heading"><div><span class="eyebrow" id="observation-eyebrow">OBSERVATION / 观测档案</span><h2 id="observation-title"></h2></div><span class="simulation-badge">教学模拟</span></div>
        <div class="view-toolbar" id="view-toolbar" role="group" aria-label="观测方式"></div>
        <div class="observation-frame"><div id="observation-canvas"></div><span class="map-annotation" id="map-annotation"></span><span class="map-direction">N</span><span class="map-stamp">G-001 / SIMULATION</span></div>
        <div class="map-legend" id="map-legend"></div>
        <div class="region-controls" id="region-controls" role="group" aria-label="选择观测区域"></div>
      </article>
      <article class="investigation-card paper" id="investigation" aria-label="案件操作"></article>
    </section>
    <section class="evidence-section" aria-label="证据夹"><div class="evidence-label"><span class="eyebrow">EVIDENCE</span><h2>我的证据夹</h2><span id="evidence-count"></span></div><div class="evidence-slots" id="evidence-slots"></div></section>
    <footer class="bottom-bar"><div class="current-task"><span class="task-dot"></span><span id="task-text"></span></div><div>${button('hint', '需要一点提示', 'text-button', 'id="hint-button"')}<span class="footer-divider">|</span>${button('credits', '关于 / 来源', 'text-button')}</div></footer>
    <div id="live-feedback" class="live-feedback" role="status" aria-live="polite"></div>
  </main><div id="dialog-root"></div>`;
  map = createObservatory(document.querySelector<HTMLElement>('#observation-canvas')!, selectRegion);
  observed(); render(); save();
}

function render() {
  const c = chapters[progress.current], cp = current();
  const unlocked = progress.chapters[0].completed ? (progress.chapters[1].completed ? 2 : 1) : 0;
  document.querySelector('#chapter-nav')!.innerHTML = chapters.map((x, n) => `<button data-action="chapter" data-id="${n}" class="chapter-tab ${n === progress.current ? 'active' : ''} ${progress.chapters[n].completed ? 'complete' : ''}" ${n > unlocked ? 'disabled' : ''} aria-current="${n === progress.current ? 'step' : 'false'}"><span class="chapter-number">${progress.chapters[n].completed ? '✓' : x.id}</span><span>${x.title}<small>${x.tag}</small></span><span class="chapter-mark">${n > unlocked ? '待解锁' : n === progress.current ? '正在阅读' : '↗'}</span></button>`).join('');
  document.querySelector('#observation-title')!.textContent = progress.current === 2 ? '双星系档案 G-002' : progress.current === 1 ? '一份旋转模型' : '星系档案 G-001';
  document.querySelector('.map-stamp')!.textContent = `${progress.current === 2 ? 'G-002' : 'G-001'} / SIMULATION`;
  (document.querySelector('.map-direction') as HTMLElement).hidden = progress.current === 1;
  document.querySelector('#sound-button')!.textContent = progress.sound ? '♪ 声音 开' : '♪ 声音 关';
  document.querySelector('#save-status')!.textContent = storageAvailable ? '进度自动保存在本机' : '本次进度仅在内存中';
  document.querySelector('#view-toolbar')!.innerHTML = progress.current === 1
    ? `<span class="view-pill selected">旋转盘示意</span><span class="view-note">蓝 / 红表示相对视向运动</span>`
    : (['optical', 'hi', ...(progress.current === 2 ? ['velocity'] : [])] as View[]).map(v => button('view', `${v === 'optical' ? '光学星光' : v === 'hi' ? 'HI 气体' : '速度线索'} ${cp.viewed.includes(v) ? '<span class="seen-mark">✓</span>' : ''}`, `view-pill ${view === v ? 'selected' : ''}`, `data-id="${v}" aria-pressed="${view === v}"`)).join('');
  document.querySelector('#map-annotation')!.textContent = progress.current === 1 ? `i = ${progress.inclination}° · 投影示意` : view === 'velocity' ? '颜色：相对视向速度' : view === 'hi' ? '中性原子氢 · 伪彩色' : '星光分布 · 教学示意';
  document.querySelector('#map-legend')!.innerHTML = progress.current === 1
    ? `<span><i class="legend-color blue"></i>接近</span><span><i class="legend-color red"></i>远离</span><span>倾角 0° 正面，90° 侧面</span>`
    : `<span><i class="legend-dash"></i>本例星光轮廓</span>${view === 'velocity' ? '<span class="velocity-legend"><i></i>−140 → +140 km/s</span>' : `<span><i class="legend-color ${view === 'hi' ? 'teal' : 'gold'}"></i>${view === 'hi' ? 'HI 相对强度' : '光学相对强度'}</span>`}<span>同一逻辑视场</span>`;
  const regions = progress.current === 2 ? BRIDGE_REGIONS : CASE_REGIONS;
  document.querySelector('#region-controls')!.innerHTML = progress.current === 1
    ? `<div class="model-caption">薄圆盘教学模型<span>参数变化仅示意，不对应真实目标</span></div>`
    : `<span>标记区域</span>${regions.map(r => button('region', r.label, `region-button ${cp.region === r.id ? 'selected' : ''}`, `data-id="${r.id}" aria-pressed="${cp.region === r.id}"`)).join('')}`;
  document.querySelector('#investigation')!.innerHTML = progress.current === 1 ? rotationPanel() : observationPanel();
  renderEvidence(); updateTask(); syncMap();
  if (progress.current === 1) updateSpectrum();
  if (message) notify(message); else document.querySelector('#live-feedback')!.textContent = '';
}

function choices() {
  return `<div class="explanation-list" role="group" aria-label="选择解释">${chapters[progress.current].conclusions.map((c, n) => `<button data-action="explanation" data-id="${c.id}" class="explanation-card ${current().explanation === c.id ? 'chosen' : ''}" aria-pressed="${current().explanation === c.id}"><span class="choice-marker">${String.fromCharCode(65 + n)}</span><span><b>${c.title}</b><small>${c.text}</small></span><i class="choice-check">${current().explanation === c.id ? '✓' : ''}</i></button>`).join('')}</div>`;
}
function submitButton() {
  return current().completed ? button('case-summary', '查看结案卡 ↗', 'primary full-width') : button('submit', '整理我的解释 ↗', 'primary full-width');
}
function observationPanel() {
  const cp = current(), c = chapters[progress.current];
  return `<div class="card-heading"><div><span class="eyebrow">CASE ${c.id} / 调查笔记</span><h2>${c.tag}</h2></div><span class="paperclip" aria-hidden="true">⌁</span></div>
    <p class="case-objective">${c.objective}</p>
    <div class="clue-note"><span class="tiny-label">${cp.region ? '当前线索' : '观测提示'}</span><p>${cp.region ? regionFeedback[cp.region] : c.intro}</p>
      ${button('collect', progress.current === 2 && view === 'velocity' ? '＋ 保存速度线索' : '＋ 加入证据夹', 'secondary', 'id="collect-button"')}</div>
    <div class="section-label"><span>哪种解释有证据支持？</span><span class="tiny-label">可以修改</span></div>${choices()}${submitButton()}`;
}
function rotationPanel() {
  return `<div class="card-heading"><div><span class="eyebrow">CASE 02 / 模型工作台</span><h2>为什么谱线这么宽？</h2></div><span class="paperclip" aria-hidden="true">⌁</span></div>
    <div class="spectrum-key"><span><i class="solid-key"></i>教学观测样例</span><span><i class="dashed-key"></i>你的模型</span><span id="match-value"></span></div>
    <div id="spectrum" class="spectrum"></div>
    <div class="sliders"><label for="rotation">旋转速度 <output id="rotation-output">${progress.rotation}</output><span>km/s</span></label><input id="rotation" type="range" min="80" max="260" step="1" value="${progress.rotation}" aria-label="旋转速度" />
    <label for="inclination">观察倾角 <output id="inclination-output">${progress.inclination}</output><span>°</span></label><input id="inclination" type="range" min="15" max="85" step="1" value="${progress.inclination}" aria-label="观察倾角" /></div>
    <div class="model-actions">${button('record-model', progress.geometry ? '＋ 保存约束后的模型' : '＋ 记录这组匹配', 'secondary')}${button('request-geometry', progress.geometry ? '倾角线索 45° ✓' : '申请光学轮廓', 'text-button', `${!progress.matched ? 'disabled' : ''}`)}</div>
    ${progress.geometry ? '<p class="geometry-note">补充证据：在薄圆盘假设下，光学轴比约 0.71 → i ≈ 45°。</p>' : '<p class="geometry-note">先记录匹配，再寻找能区分模型的新证据。</p>'}
    ${choices()}${submitButton()}`;
}

const targetSpectrum = spectrum(TARGET.rotation, TARGET.inclination);
function updateSpectrum() {
  const points = spectrum(progress.rotation, progress.inclination);
  const path = (series: typeof points) => series.map((p, n) => `${n ? 'L' : 'M'}${48 + (p.velocity + 320) / 640 * 504},${151 - p.intensity * 114}`).join(' ');
  document.querySelector('#spectrum')!.innerHTML = `<svg viewBox="0 0 580 194" role="img" aria-label="归一化谱线。实线为教学观测样例，虚线为当前模型。横轴相对系统速度，纵轴归一化强度。"><g class="plot-grid">${[0, .5, 1].map(y => `<path d="M48 ${151 - y * 114}H552"/><text x="35" y="${156 - y * 114}" text-anchor="end">${y}</text>`).join('')}${[-300,-150,0,150,300].map(v => `<text x="${48 + (v + 320) / 640 * 504}" y="171" text-anchor="middle">${v}</text>`).join('')}</g><path class="observed-line" d="${path(targetSpectrum)}"/><path class="model-line" d="${path(points)}"/><text class="axis-title" x="300" y="191" text-anchor="middle">相对系统速度 / km s⁻¹</text><text class="axis-title" transform="translate(12 90) rotate(-90)" text-anchor="middle">归一化强度</text></svg>`;
  const percent = matchPercent(progress.rotation, progress.inclination);
  const output = document.querySelector<HTMLElement>('#match-value')!;
  output.textContent = `谱形匹配 ${percent}%`; output.className = percent >= 96 ? 'match-good' : '';
  document.querySelector('#rotation-output')!.textContent = String(progress.rotation);
  document.querySelector('#inclination-output')!.textContent = String(progress.inclination);
}

function renderEvidence() {
  const ids = current().evidence as (keyof typeof evidence)[];
  document.querySelector('#evidence-count')!.textContent = `${ids.length} 条已记录`;
  document.querySelector('#evidence-slots')!.innerHTML = ids.length ? ids.map((id, n) => `<button class="evidence-card" data-action="evidence" data-id="${id}"><span class="evidence-number">${String(n + 1).padStart(2,'0')}</span><span><b>${evidence[id].title}</b><small>点击回看这份证据</small></span><span class="evidence-tick">✓</span></button>`).join('') : `<div class="empty-evidence"><span class="empty-mark">＋</span>将观察到的线索放在这里<span>证据会陪你一起走到结案</span></div>`;
}
function updateTask() {
  const cp = current(); let text: string;
  if (cp.completed) text = progress.current === 2 ? '三个案件已完成。你的档案里，多了一双看星系的眼睛。' : '这一案已结案。可以回看线索，或打开下一份档案。';
  else if (progress.current === 0) text = !cp.viewed.includes('hi') ? '打开 HI 档案，比较星光轮廓之外的区域。' : !cp.evidence.includes('outer') ? '选中轮廓外的气体线索，加入证据夹。' : '证据已收好。选择一张得到支持的解释卡。';
  else if (progress.current === 1) text = !progress.matched ? '调节模型到 96% 以上匹配，再记录这组模型。' : !progress.geometry ? '匹配并不唯一。申请光学轮廓，补充倾角线索。' : !cp.evidence.includes('geometry') ? '结合 45° 倾角线索重新匹配，保存约束后的模型。' : '证据已收好。解释为什么补充倾角很有用。';
  else text = !cp.evidence.includes('morphology') ? '在 HI 图中选出两个星系之间的候选气体桥。' : !cp.evidence.includes('kinematics') ? '切换速度线索，保存同一区域的运动信息。' : '将形态与速度放在一起，给出可继续检验的解释。';
  document.querySelector('#task-text')!.textContent = text;
  document.querySelector('#hint-button')!.textContent = cp.hint ? `提示 ${cp.hint}/3` : '需要一点提示';
}

function selectRegion(id: string | null) {
  if (progress.current === 1) return;
  if (!id) { notify('可以点击图中的编号区域，或使用下方区域按钮。'); return; }
  if (view === 'optical') { notify('先打开 HI 档案，再检查同一位置的气体线索。'); return; }
  current().region = id; ping(); save(); render(); notify(regionFeedback[id]);
}
function collectEvidence() {
  const cp = current();
  if (!cp.viewed.includes('optical') || !cp.viewed.includes('hi')) { notify('先对比光学和 HI 两份档案。'); return; }
  if (progress.current === 0) {
    if (view !== 'hi' || cp.region !== 'outer_hi') { notify('请在 HI 图中选中星光轮廓之外的目标区域。'); return; }
    collect(cp, 'comparison', 'outer');
  } else {
    if (cp.region !== 'bridge' || view === 'optical') { notify('请在 HI 或速度视图中选中两个星系之间的候选区域。'); return; }
    collect(cp, view === 'hi' ? 'morphology' : 'kinematics');
  }
  save(); render(); ping(true); notify('线索已放入证据夹。你随时可以回看。', true);
}
function recordModel() {
  if (matchPercent(progress.rotation, progress.inclination) < 96) { notify('继续调节速度与倾角，让两条谱形更接近。'); return; }
  if (!progress.matched) {
    progress.matched = true; collect(current(), 'projection');
    notify('这组模型能解释谱形。但另一些速度和倾角的组合也能做到。试试申请光学轮廓。', true);
  } else if (progress.geometry) {
    if (Math.abs(progress.inclination - 45) > 2 || Math.abs(progress.rotation - 180) > 10) { notify('谱形接近了，还要同时满足补充的倾角线索：i ≈ 45°。'); return; }
    collect(current(), 'geometry'); notify('你结合谱线与倾角，约束了旋转速度。证据已保存。', true);
  } else notify('匹配已记录。现在申请光学轮廓，寻找新的约束。');
  save(); render(); ping(true);
}

function dialog(title: string, body: string, footer = '') {
  dialogFocus = document.activeElement as HTMLElement;
  document.querySelector('#dialog-root')!.innerHTML = `<div class="dialog-backdrop" data-dialog-backdrop><section class="dialog-paper" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="dialog-heading"><div><span class="eyebrow">THE OBSERVATORY / 星系档案室</span><h2 id="dialog-title">${title}</h2></div>${button('close-dialog', '×', 'close-button', 'aria-label="关闭对话框"')}</div><div class="dialog-body">${body}</div>${footer ? `<div class="dialog-footer">${footer}</div>` : ''}</section></div>`;
  document.querySelector<HTMLButtonElement>('[data-action="close-dialog"]')?.focus();
}
function closeDialog() { document.querySelector('#dialog-root')!.innerHTML = ''; dialogFocus?.focus(); }
function showSummary() {
  const c = chapters[progress.current];
  dialog(c.discovery, `<div class="completion-emblem">${icon}<span>CASE ${c.id} · 已结案</span></div><p class="summary-copy">${c.summary}</p><div class="summary-evidence">${current().evidence.map(id => `<span>✓ ${evidence[id as keyof typeof evidence].title}</span>`).join('')}</div><div class="next-question"><span class="tiny-label">下一页，仍有问题</span><p>${c.question}</p></div>`, `${button('close-dialog','回看这份档案','secondary')}${button(progress.current === 2 ? 'finale' : 'next', progress.current === 2 ? '收好今晚的发现 ↗' : `打开案件 ${chapters[progress.current + 1].id} ↗`, 'primary')}`);
}
function handbook(tab = 'observations') {
  const pages: Record<string, string> = {
    observations: `<h3>给天空换一种眼睛</h3><p>光学档案展示星光的教学分布。HI 档案展示中性原子氢的教学分布。21 厘米信号是射电波段的电磁辐射，并非肉眼能看见的气体颜色。</p><p>虚线是本例选定的星光轮廓，并非星系的绝对边界。颜色是可视化编码；没有显示信号，不代表那里绝对没有气体。</p><div class="handbook-callout">所有图像均为程序生成的教学模拟。相同逻辑视场方便比较，不是经过观测标定的 FITS 图。</div>`,
    motion: `<h3>宽度里藏着观察角度</h3><p>在理想薄圆盘模型里，视向运动包含投影因子：</p><div class="formula">v<sub>los</sub> = v<sub>rot</sub> sin i cos θ</div><p>i = 0° 为正面，i = 90° 为侧面。相近的 v<sub>rot</sub> sin i 可以产生相近的整体谱形，单条谱线通常不能单独区分速度与倾角。</p><p>本例固定径向分布、旋转曲线形状和速度弥散 σ = 12 km/s，叠加各圆环的高斯线型。图中强度按峰值归一化；匹配度是教学指标，不是统计置信度。</p><div class="formula">薄圆盘：cos i ≈ b / a</div><p>本案提供 b/a ≈ 0.71，对应 i ≈ 45°。真实星系还需考虑盘厚、非圆运动、噪声与仪器效应。本例的半高全宽约 ${Math.round(lineWidth50(targetSpectrum))} km/s，不能简单等同于 2v<sub>rot</sub>。</p>`,
    evolution: `<h3>星系之间的气体档案</h3><p>HI 的延展结构可以提供星系相互作用的线索。本教学样例人为设置了一条候选气体桥及沿桥平滑变化的相对视向速度。</p><p>空间结构与速度线索一起支持继续检验关联，但不能唯一证明潮汐转移、排除其他机制，或独自确定三维位置。</p><p>下一步可比较恒星结构、其他气体成分、周围环境与更完整的运动学。速度图蓝 / 红表示相对参考速度的接近 / 远离方向，不是温度。</p><div class="handbook-callout">案件允许留下不确定性。合理的“还需要更多证据”同样是一种发现。</div>`,
    sources: `<h3>来源与制作</h3><p>科学背景：<a href="https://www.cv.nrao.edu/~sransom/web/Ch7.html" target="_blank" rel="noopener noreferrer">NRAO · Essential Radio Astronomy，谱线章节 ↗</a></p><p>图像背景：<a href="https://www.nrao.edu/archives/items/show/33569" target="_blank" rel="noopener noreferrer">NRAO · THINGS 图像说明 ↗</a></p><p>游戏没有复制这些页面的观测图。星系图、谱线、速度场和教学数据由程序绘制；背景为用户选定的 AI 生成概念图 B。</p><p>技术：Phaser / TypeScript / Vite。桌面版使用 Electron。第一版无需联网和账号，不采集或上传玩家数据。</p><p>此版本用于试玩与科学审核，尚未经过外部教学效果评估。v0.1.0 · 2026</p>`,
  };
  dialog('观测手册', `<nav class="notebook-tabs">${[['observations','观测'],['motion','运动'],['evolution','演化'],['sources','来源']].map(([id,label]) => button('notebook-tab',label,tab === id ? 'selected' : '',`data-id="${id}"`)).join('')}</nav>${pages[tab] ?? pages.observations}`);
}
function collection() {
  dialog('我的星系档案', `<p>这些发现保存在本机。可以回看已完成的案件，或导出进度作备份。</p><div class="collection-grid">${chapters.map((c,n) => `<div class="collection-card ${progress.chapters[n].completed ? 'collected' : ''}"><span class="eyebrow">CASE ${c.id}</span><h3>${c.discovery}</h3><p>${progress.chapters[n].completed ? c.summary : '这份档案，还等着你的发现。'}</p><span>${progress.chapters[n].completed ? '✓ 已收录' : '待探索'}</span></div>`).join('')}</div><input id="import-progress" type="file" accept="application/json,.json" hidden />`, `${button('export','导出进度','secondary')}${button('import','导入进度','secondary')}${readBackup() ? button('restore','恢复上次档案','text-button') : ''}${button('restart','重新探索（保留备份）','text-button')}`);
}
function finale() {
  dialog('今夜，天空多了一层故事', `<div class="finale-orbit">${icon}</div><p class="summary-copy">你看见了星光之外的气体，读出了信号里的运动，也为星系之间的线索留下了一个可继续检验的解释。</p><div class="finale-stamps"><span>✓ 看见气体</span><span>✓ 读出运动</span><span>✓ 追踪去向</span></div><p>感谢你的第一晚观测。你的三张结案卡，已经收进档案夹。</p>`, `${button('collection','翻开我的档案','secondary')}${button('close-dialog','回到观测台','primary')}`);
}

app.addEventListener('click', event => {
  if ((event.target as HTMLElement).hasAttribute('data-dialog-backdrop')) { closeDialog(); return; }
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!target || target.disabled) return;
  const action = target.dataset.action, id = target.dataset.id;
  if (action !== 'sound') ping();
  switch (action) {
    case 'start': progress.started = true; mount(); break;
    case 'home': save(); showHome(); break;
    case 'chapter': {
      const n = Number(id); const unlocked = progress.chapters[0].completed ? (progress.chapters[1].completed ? 2 : 1) : 0;
      if (n > unlocked) return;
      progress.current = n; view = current().viewed.at(-1) ?? 'optical'; message = ''; observed(); save(); render(); break;
    }
    case 'view': view = id as View; observed(); save(); render(); notify(view === 'velocity' ? '图例中的颜色表示相对视向速度。保存候选区域的运动线索。' : '对照同一位置，寻找不同观测方式留下的信息。'); break;
    case 'region': selectRegion(id!); break;
    case 'collect': collectEvidence(); break;
    case 'explanation': current().explanation = id!; save(); render(); notify('解释卡已选中。你可以修改，也可以提交检验。'); break;
    case 'submit': {
      const result = canComplete(progress);
      if (!result.ok) { notify(result.message); break; }
      current().completed = true; save(); render(); ping(true); showSummary(); break;
    }
    case 'case-summary': showSummary(); break;
    case 'next': closeDialog(); progress.current = Math.min(2, progress.current + 1); view = 'optical'; observed(); message = ''; save(); render(); break;
    case 'record-model': recordModel(); break;
    case 'request-geometry':
      if (!progress.matched) break;
      progress.geometry = true; save(); render();
      dialog('补充观测：光学轮廓', `<div class="geometry-diagram"><svg viewBox="0 0 360 190" role="img" aria-label="光学盘椭圆：长短轴比约0.71"><ellipse cx="180" cy="95" rx="110" ry="78" fill="#e5d7bb" stroke="#8c7958" stroke-width="2"/><path d="M70 95H290M180 17V173" stroke="#5b7775" stroke-dasharray="5 4"/><text x="300" y="100">a</text><text x="188" y="20">b</text></svg></div><p>在本教学档案的薄圆盘假设下，光学轴比约 b/a = 0.71。</p><div class="formula">i ≈ arccos(0.71) ≈ 45°</div><p>结合这个倾角，重新调节旋转速度，再把模型加入证据夹。</p>`,button('close-dialog','带着新线索继续','primary')); break;
    case 'hint': current().hint = Math.min(3, current().hint + 1); save(); render(); dialog(`一点提示 · ${current().hint}/3`, `<p class="hint-copy">${chapters[progress.current].hints[current().hint - 1]}</p><p class="small-copy">提示不会扣分，发现的节奏由你决定。</p>`, `${button('close-dialog','回到观测','primary')}${current().hint < 3 ? button('hint','再给一点提示','text-button') : ''}`); break;
    case 'evidence': { const e = evidence[id as keyof typeof evidence]; if (e) dialog('证据回看', `<span class="eyebrow">已保存的线索</span><h3>${e.title}</h3><p>${e.description}</p><p class="small-copy">这条记录基于本游戏的教学模拟。</p>`,button('close-dialog','收好证据','primary')); break; }
    case 'handbook': handbook(); break;
    case 'notebook-tab': handbook(id); break;
    case 'credits': handbook('sources'); break;
    case 'collection': collection(); break;
    case 'finale': finale(); break;
    case 'close-dialog': closeDialog(); break;
    case 'sound': progress.sound = !progress.sound; save(); ping(); render(); break;
    case 'export': {
      const url = URL.createObjectURL(new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'galaxy-letters-progress.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); break;
    }
    case 'restart': dialog('重新探索这片天空', '<p>当前档案会先保留为本机备份，再开始一次新的观测。之后可以恢复这份备份。</p>', `${button('close-dialog','继续当前档案','secondary')}${button('confirm-restart','保留备份并重新开始','primary')}`); break;
    case 'confirm-restart': try { localStorage.setItem(`${SAVE_KEY}-backup`, JSON.stringify(progress)); } catch { notify('当前环境无法保存备份，暂时保留原进度。'); closeDialog(); return; } progress = freshProgress(); save(); showHome(); break;
    case 'restore': {
      const raw = readBackup(); if (!raw) break;
      const restored = parseProgress(raw);
      try { localStorage.setItem(`${SAVE_KEY}-backup`, JSON.stringify(progress)); } catch { break; }
      progress = restored; save(); view = current().viewed.at(-1) ?? 'optical'; message = '';
      if (progress.started) mount(); else showHome(); break;
    }
    case 'import': document.querySelector<HTMLInputElement>('#import-progress')?.click(); break;
  }
});
app.addEventListener('change', async event => {
  const input = event.target as HTMLInputElement;
  if (input.id !== 'import-progress' || !input.files?.[0]) return;
  const file = input.files[0];
  try {
    if (file.size > 100000) throw new Error('进度文件过大');
    const raw = await file.text(); const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Array.isArray(data.chapters)) throw new Error('进度文件格式不兼容');
    localStorage.setItem(`${SAVE_KEY}-backup`, JSON.stringify(progress));
    progress = parseProgress(raw); save(); view = current().viewed.at(-1) ?? 'optical'; message = '';
    if (progress.started) mount(); else showHome();
  } catch { dialog('没有导入这份档案', '<p>请选择由本游戏导出的兼容 JSON 进度文件。原有进度已保留。</p>', button('close-dialog','返回','primary')); }
});
app.addEventListener('input', event => {
  const input = event.target as HTMLInputElement;
  if (input.id !== 'rotation' && input.id !== 'inclination') return;
  if (input.id === 'rotation') progress.rotation = Number(input.value); else progress.inclination = Number(input.value);
  save(); updateSpectrum(); syncMap();
});
document.addEventListener('keydown', event => {
  const modal = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!modal) return;
  if (event.key === 'Escape') { closeDialog(); return; }
  if (event.key === 'Tab') {
    const items = [...modal.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input')];
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
showHome();
