export type View = 'optical' | 'hi' | 'velocity';
export interface ChapterProgress {
  viewed: View[];
  region: string | null;
  evidence: string[];
  explanation: string | null;
  hint: number;
  completed: boolean;
}
export interface Progress {
  version: 1;
  started: boolean;
  current: number;
  chapters: ChapterProgress[];
  rotation: number;
  inclination: number;
  matched: boolean;
  geometry: boolean;
  sound: boolean;
}
export function freshProgress(): Progress {
  return { version: 1, started: false, current: 0, chapters: Array.from({ length: 3 }, () => ({ viewed: [], region: null, evidence: [], explanation: null, hint: 0, completed: false })), rotation: 120, inclination: 30, matched: false, geometry: false, sound: false };
}
const validViews = [new Set(['optical', 'hi']), new Set<string>(), new Set(['optical', 'hi', 'velocity'])];
const validRegions = [new Set(['outer_hi', 'inner_disk', 'background']), new Set<string>(), new Set(['bridge', 'primary', 'empty'])];
const validEvidence = [new Set(['comparison', 'outer']), new Set(['projection', 'geometry']), new Set(['morphology', 'kinematics'])];
const validExplanations = [new Set(['supported', 'all_gas', 'cause_known']), new Set(['projection', 'only_speed', 'mass']), new Set(['interaction', 'certain', 'temperature'])];
function bounded(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
export function parseProgress(raw: string | null): Progress {
  const result = freshProgress();
  try {
    const input = JSON.parse(raw ?? 'null');
    if (!input || input.version !== 1 || !Array.isArray(input.chapters)) return result;
    result.started = input.started === true;
    result.sound = input.sound === true;
    result.rotation = bounded(input.rotation, 120, 80, 260);
    result.inclination = bounded(input.inclination, 30, 15, 85);
    result.matched = input.matched === true;
    result.geometry = input.geometry === true && result.matched;
    input.chapters.slice(0, 3).forEach((item: unknown, n: number) => {
      if (!item || typeof item !== 'object') return;
      const c = item as Record<string, unknown>;
      result.chapters[n] = {
        viewed: Array.isArray(c.viewed) ? [...new Set(c.viewed.filter(v => validViews[n].has(v)))].slice(0, 3) as View[] : [],
        region: typeof c.region === 'string' && validRegions[n].has(c.region) ? c.region : null,
        evidence: Array.isArray(c.evidence) ? [...new Set(c.evidence.filter(v => validEvidence[n].has(v)))].slice(0, 2) as string[] : [],
        explanation: typeof c.explanation === 'string' && validExplanations[n].has(c.explanation) ? c.explanation : null,
        hint: Math.floor(bounded(c.hint, 0, 0, 3)), completed: c.completed === true,
      };
    });
    // Progress is local, not a trust/security boundary; keep chapter navigation contiguous.
    if (!result.chapters[0].completed) result.chapters[1].completed = result.chapters[2].completed = false;
    if (!result.chapters[1].completed) result.chapters[2].completed = false;
    const unlocked = result.chapters[0].completed ? (result.chapters[1].completed ? 2 : 1) : 0;
    result.current = Math.floor(bounded(input.current, 0, 0, unlocked));
    return result;
  } catch { return result; }
}

export function collect(chapter: ChapterProgress, ...ids: string[]) {
  chapter.evidence = [...new Set([...chapter.evidence, ...ids])];
}

export function canComplete(p: Progress, chapter = p.current): { ok: boolean; message: string } {
  const c = p.chapters[chapter];
  if (chapter === 0) {
    if (!c.viewed.includes('optical') || !c.viewed.includes('hi')) return { ok: false, message: '先对比光学和 HI 两份档案，再形成解释。' };
    if (!c.evidence.includes('outer')) return { ok: false, message: '还缺一条轮廓外的 HI 线索。选中区域，再加入证据夹。' };
    if (c.explanation === 'all_gas') return { ok: false, message: 'HI 记录的是中性原子氢，不能代表所有种类的气体。再看看另一种解释。' };
    if (c.explanation === 'cause_known') return { ok: false, message: '位置线索还不能确定气体的来历。这个问题留给更多观测。' };
    return { ok: c.explanation === 'supported', message: '选择一张得到已有证据支持的解释卡。' };
  }
  if (chapter === 1) {
    if (!p.matched) return { ok: false, message: '先调节模型，使虚线谱形与观测样例接近，并记录这组匹配。' };
    if (!p.geometry) return { ok: false, message: '谱线存在投影歧义。申请光学轮廓，补充倾角线索。' };
    if (!c.evidence.includes('geometry')) return { ok: false, message: '结合倾角 45° 的线索重新匹配，并把模型存入证据夹。' };
    if (c.explanation === 'only_speed') return { ok: false, message: '倾角也会影响线宽：相同旋转速度，观察角度不同，谱线也会变化。' };
    if (c.explanation === 'mass') return { ok: false, message: '本案没有距离和标定流量，不能由谱线高度直接读出 HI 质量。' };
    return { ok: c.explanation === 'projection', message: '选择能说明投影关系与补充观测作用的解释。' };
  }
  if (!['optical', 'hi', 'velocity'].every(v => c.viewed.includes(v as View))) return { ok: false, message: '请对比光学、HI 和速度三种线索，避免只凭一张图判断。' };
  if (!c.evidence.includes('morphology') || !c.evidence.includes('kinematics')) return { ok: false, message: '选中星系之间的候选区域，分别保存 HI 形态与速度线索。' };
  if (c.explanation === 'certain') return { ok: false, message: '桥状形态与连续速度支持相互作用解释，但仍不能唯一证明成因。' };
  if (c.explanation === 'temperature') return { ok: false, message: '这张图的颜色表示相对视向速度，不是温度。请查看图例。' };
  return { ok: c.explanation === 'interaction', message: '选择与空间和速度证据相符、同时保留不确定性的解释。' };
}
