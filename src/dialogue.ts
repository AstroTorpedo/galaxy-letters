import type {Guide} from './campaign';
import type {TargetId} from './targets';
import {targetById} from './targets';
export type DialogueTopic='welcome'|'history'|'targets'|'tutorial'|'next'|'help'|'pointing'|'tuning'|'calibration'|'rfi'|'aperture'|'spectrum'|'rotation'|'weak'|'pv'|'baseline-done'|'echo-done'|'finish';
export interface DialogueChoice {label:string;topic?:DialogueTopic;action?:'accept'|'guide'|'baseline'|'echo'|'finish'|'close'}
export interface DialogueNode {title:string;lines:string[];choices:DialogueChoice[]}
export interface DialogueContext {target:TargetId;guide:Guide;baselineDone:boolean;echoDone:boolean;finalReport:string}
const back:DialogueChoice[]=[{label:'带我去下一步',action:'guide'},{label:'我还想问一个方法问题',topic:'help'},{label:'我先自己试试',action:'close'}];
export function dialogueFor(topic:DialogueTopic,c:DialogueContext):DialogueNode{
  const target=targetById(c.target);
  const nodes:Record<Exclude<DialogueTopic,'next'|'finish'>,DialogueNode>={
    welcome:{title:'两份申请，一件没做完的事',lines:['你来得正好。我是林岚，今晚和你一起值班。桌上有两份申请：GX-03「归航」是运动对照，GX-07「回波」是我还没结完的档案。','今晚想留下的不是最亮的图片，而是下一班能重新检查的证据。我们先知道仪器和方法能读出什么，再去问那条弱线值不值得继续追。'],choices:[{label:'之前发生了什么？',topic:'history'},{label:'我没做过观测，带我学',topic:'tutorial'},{label:'我准备好了，开始接班',action:'accept'}]},
    history:{title:'那张被搁置的积分图',lines:['上一班在回波的星光盘外看见一点发射。那时只有一张积分图，参考方向也没做完整。我在报告上写了“待复核”，没有写“发现气体尾”。','追加时间的申请就这样留了下来。这次有了归航作对照：先验证我们能读出有序运动，再用同一套方法复查回波。你可以替这份申请补上它缺少的证据。'],choices:[{label:'两个目标各要做什么？',topic:'targets'},{label:'请从第一步教我',topic:'tutorial'},{label:'接下这两份申请',action:'accept'}]},
    targets:{title:'两个目标，两个具体问题',lines:['归航是一份规则旋转盘样本。你的任务是在速度场中找到两侧，并各保存一条有效孔径谱，比较中心速度。','回波有更复杂的外盘。先把光学、HI 和通道对照起来，保存一条盘内参照谱，再在星光轮廓外核查连续通道弱候选。两份任务可以跨批次、跨夜晚接着做。'],choices:[{label:'先观测归航',action:'baseline'},{label:'先观测回波',action:'echo'},{label:'给我当前操作提示',topic:'next'}]},
    tutorial:{title:'我陪你走一遍，但证据由你留下',lines:['引导会指向当前需要的控件：选目标、指向、频段、校准、参考场，再分配时间。你随时可以关掉引导，也可以回来问我。','拿到数据后，点击任意位置读谱，保存发现。提示只告诉你怎样核查，不会替你圈出唯一答案。'],choices:[{label:'开启引导，带我操作',action:'accept'},{label:'我想先问个方法问题',topic:'help'},{label:'先自己探索',action:'close'}]},
    help:{title:'你想先弄清哪一步？',lines:[`我们正在处理 ${target.code}「${target.name}」。你可以问具体方法，也可以回顾交班往事或当前任务。`],choices:[{label:'指向和频段怎么选？',topic:'pointing'},{label:'为什么要校准？',topic:'calibration'},{label:'亮色、噪声和干扰怎么分？',topic:'rfi'},{label:'孔径该选多大？',topic:'aperture'},{label:'孔径谱和双峰怎么看？',topic:'spectrum'},{label:'PV 能帮我判断什么？',topic:'pv'},{label:'我想再听听交班往事',topic:'history'},{label:'下一步该做什么？',topic:'next'}]},
    pointing:{title:'让想看的天空进入画幅',lines:['选择目标只是准备下一份观测。对准档案坐标后，看成像方框和预期视场：偏离会让目标移动、变弱，甚至离开画幅。','频段也要对准。先回到系统中心频率，选 2.8 MHz 观察完整运动范围。修改设置之后，要重新开始一批观测；已经完成的批次保留原来的配置。'],choices:[{label:'再说说频率与速度',topic:'tuning'},...back]},
    tuning:{title:'第三轴是速度，不是时间',lines:['同一条 HI 谱线会因运动落在不同频率。这里按模型系统参考系演示；通道图是在切换速度切片。','总带宽决定哪些速度有数据，当前通道分辨率固定。没有覆盖的通道是缺测，不能把它当作没有气体。'],choices:back},
    calibration:{title:'给读数找一把尺',lines:['已知亮度的校准源帮我们检查接收器的尺度。本教学环节把它简化成一个增益系数；实际阵列还有相位、带通等校准。','校准和参考场各用 2 个模拟分钟。阅读、调节和提问不扣时间；把剩下的时间真正留给目标。'],choices:back},
    rfi:{title:'最亮的那一根不一定来自星系',lines:['参考方向没有我们的目标，却也出现相同频率的窄峰时，它值得先按干扰线索核查。标记后那些通道会变灰，表示没有可用测量。','通道逐个线性拉伸，纯噪声也可能很亮。看色标的实际 mJy/beam 范围，再结合谱和跨通道连续性；更长积分降低随机噪声，不能自动消除干扰。'],choices:[{label:'怎样核查弱线？',topic:'weak'},...back]},
    aperture:{title:'孔径，是你让哪一片天空一起说话',lines:['这里的谱是圆形选区内的均值。半径变大，会纳入更多气体，也可能把不同速度的成分混在一起；谱变宽不一定意味着同一团气体更湍动。','先用小孔径定位，再适度扩大检查弱线是否稳定。噪声在邻近像素间相关，像素更小或孔径更小，都不会把 16″ 合成波束变得更精细。'],choices:[{label:'接着讲怎样读谱',topic:'spectrum'},{label:'带我核查当前任务',action:'guide'},{label:'回到孔径继续操作',action:'close'}]},
    spectrum:{title:'一条谱对应一片天空',lines:['移动孔径，谱会随位置改变；自动纵轴和“＋ / −”只改变显示，实际峰值、速度和 S/N 不变。记录两处谱时，要一起读中心速度与位置。','整座旋转星系的积分谱可能呈双角形，小孔径局部单峰很正常。两股气体叠加也可能双峰；灰色缺测带造成的断口不能当成物理谷底。'],choices:[{label:'怎样用它判断运动？',topic:'rotation'},...back]},
    rotation:{title:'把运动放回天空上',lines:['先看速度场的连续变化，再在空间分开的两侧取谱。两个速度的差别和天空位置连起来，才比单看一条宽谱更有说服力。','观测速度受倾角和气体弥散影响。归航任务是建立有序运动的对照，不要求你仅凭线宽报出真实旋转速度。'],choices:back},
    weak:{title:'慢一点，把候选核查清楚',lines:['先保存盘内参照谱，再沿星光参考轮廓之外自由寻找。检查弱峰是否跨连续通道出现，适度扩大孔径也许有帮助，但可能混入不同运动。','这里的 S/N 和连续通道条件是探索提示，不是正式检出标准。留下“值得复查”的候选已经有价值，不必替它编一个确定的潮汐故事。'],choices:back},
    pv:{title:'沿一条切线，同时看位置和速度',lines:['PV 横轴是沿切线的角距离，纵轴是视向速度。转动切线，看看运动结构随方向怎样变化，再回到通道图找它的位置。','它能帮助核查有序运动或叠加成分，但仍需要形态和其他证据。第三轴不是气体的空间深度。'],choices:back},
    'baseline-done':{title:'现在，我们有一份可靠的对照了',lines:['归航的运动记录已经齐了：你看过速度场，也让两处空间分开的信号说出了不同速度。','这正是旧申请缺少的那一页。带着同样的核查方法，去看看回波的盘外弱线吧。'],choices:[{label:'接受回波调查',action:'echo'},{label:'先复习弱线方法',topic:'weak'},{label:'我还想继续看归航',action:'close'}]},
    'echo-done':{title:'这条弱线终于有了可复查的上下文',lines:['你把星光轮廓、盘内参照和盘外连续通道候选放在了一起，也核查了参考场干扰。','它现在值得独立复观测，仍不能仅凭这些就决定形成原因。看看另一份任务是否齐全，再把两份申请交回来。'],choices:[{label:'查看当前任务',topic:'next'},{label:'复盘两份申请',topic:'finish'},{label:'我再补一点观测',action:'close'}]},
  };
  if(topic==='next')return {title:c.guide.title,lines:[`我们下一步做这个：${c.guide.copy}`,c.target==='sim-disk'?'归航是在替之后的调查建立对照。把位置与运动的关系记录下来。':'回波需要可复查的弱线证据。我们可以保留疑问，不必急着给成因命名。'],choices:back};
  if(topic==='finish')return {title:c.finalReport?'两份申请，已经交到下一班手里':c.baselineDone&&c.echoDone?'两份申请可以一起交回去了':'还有一页需要补上',lines:[c.finalReport|| (c.baselineDone&&c.echoDone?'归航给了有序运动对照，回波留下了值得复查的盘外候选。你补齐的是证据链，而不是一个预设答案。':'我们先补齐任务卡上的证据。时间不够可以交班、安排下一夜，之前的记录还在。'),'下一班会看到你留下的位置、谱和仍未确定的事情。调查可以从这里继续。'],choices:c.finalReport?[{label:'回到数据，继续探索',action:'close'},{label:'再问一个方法问题',topic:'help'}]:c.baselineDone&&c.echoDone?[{label:'提交双目标报告',action:'finish'},{label:'再检查一遍数据',action:'close'}]:[{label:'带我去补下一步',action:'guide'},{label:'选择另一份目标',topic:'targets'},{label:'我先继续探索',action:'close'}]};
  return nodes[topic];
}
