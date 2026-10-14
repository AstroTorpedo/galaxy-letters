import Phaser from 'phaser';
import { BRIDGE_REGIONS, CASE_REGIONS, DEG, hiField, regionAt, velocityField } from './science';
import type { View } from './state';

const W = 900, H = 560;
export interface MapState { chapter: number; view: View; region: string | null; rotation: number; inclination: number; hint: number; geometry: boolean }

function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

/** Procedural, explicitly synthetic images. No generated artwork is used as observational data. */
function makeImage(view: View, interacting: boolean) {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0c1b2a'; ctx.fillRect(0, 0, W, H);
  const rand = rng(2101);
  if (view === 'optical') {
    for (let n = 0; n < 110; n++) {
      const x = rand() * W, y = rand() * H, alpha = 0.15 + rand() * 0.5;
      ctx.fillStyle = `rgba(218,230,243,${alpha})`; ctx.beginPath(); ctx.arc(x, y, rand() * 1.2 + 0.3, 0, Math.PI * 2); ctx.fill();
    }
    const galaxy = (cx: number, cy: number, rx: number, ry: number, seed: number) => {
      const r = rng(seed);
      ctx.save(); ctx.translate(cx * W, cy * H); ctx.scale(rx * W, ry * H);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.3);
      glow.addColorStop(0, 'rgba(255,231,184,.95)'); glow.addColorStop(0.16, 'rgba(234,195,137,.6)'); glow.addColorStop(0.7, 'rgba(125,156,185,.13)'); glow.addColorStop(1, 'rgba(105,142,174,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      for (let n = 0; n < 3000; n++) {
        const radius = r(), arm = n % 3, angle = arm * Math.PI * 2 / 3 + radius * 5.5 + (r() - .5) * .65;
        const x = (cx + Math.cos(angle) * radius * rx) * W;
        const y = (cy + Math.sin(angle) * radius * ry) * H;
        const a = (1 - radius) * .5 + .06;
        ctx.fillStyle = n % 4 === 0 ? `rgba(175,205,231,${a})` : `rgba(241,216,178,${a})`;
        ctx.beginPath(); ctx.arc(x, y, .35 + r() * 1.3, 0, Math.PI * 2); ctx.fill();
      }
    };
    if (interacting) { galaxy(.32, .58, .16, .105, 7); galaxy(.8, .29, .085, .06, 9); }
    else galaxy(.43, .52, .20, .13, 7);
  } else {
    const small = document.createElement('canvas'); small.width = 450; small.height = 280;
    const sc = small.getContext('2d')!, pixels = sc.createImageData(450, 280);
    for (let y = 0; y < 280; y++) for (let x = 0; x < 450; x++) {
      const density = hiField(x / 450, y / 280, interacting), n = (y * 450 + x) * 4;
      const noise = rand() * .02;
      let color = [91, 190, 183];
      if (view === 'velocity') {
        const v = Math.max(-1, Math.min(1, velocityField(x / 450, y / 280) / 140));
        color = v > 0 ? [216, 155 - 65 * v, 107 - 50 * v] : [106 + 30 * v, 160 + 20 * v, 212];
      }
      const strength = density < .13 ? noise : Math.min(1, density * 1.05);
      pixels.data[n] = 12 + color[0] * strength;
      pixels.data[n + 1] = 27 + color[1] * strength;
      pixels.data[n + 2] = 42 + color[2] * strength;
      pixels.data[n + 3] = 255;
    }
    sc.putImageData(pixels, 0, 0); ctx.drawImage(small, 0, 0, W, H);
  }
  ctx.strokeStyle = 'rgba(205,222,231,.055)'; ctx.lineWidth = 1;
  for (let x = 60; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 40; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  return canvas;
}

export class ObservatoryScene extends Phaser.Scene {
  state: MapState = { chapter: 0, view: 'optical', region: null, rotation: 120, inclination: 30, hint: 0, geometry: false };
  private image?: Phaser.GameObjects.Image;
  private overlay?: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private onRegion: (id: string | null) => void;

  constructor(onRegion: (id: string | null) => void) { super('observatory'); this.onRegion = onRegion; }
  create() {
    for (const interacting of [false, true]) for (const view of ['optical', 'hi', 'velocity'] as View[]) {
      if (!interacting && view === 'velocity') continue;
      this.textures.addCanvas(`${interacting ? 'pair' : 'single'}-${view}`, makeImage(view, interacting));
    }
    this.image = this.add.image(0, 0, 'single-optical').setOrigin(0).setDisplaySize(W, H);
    this.overlay = this.add.graphics();
    for (let n = 0; n < 3; n++) this.labels.push(this.add.text(0, 0, '', { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#f3ead7', backgroundColor: '#152a3b', padding: { x: 8, y: 4 } }).setOrigin(.5));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.state.chapter !== 1) this.onRegion(regionAt(pointer.x / W, pointer.y / H, this.state.chapter === 2));
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.game.canvas.style.cursor = this.state.chapter !== 1 && regionAt(pointer.x / W, pointer.y / H, this.state.chapter === 2) ? 'pointer' : 'default';
    });
    this.sync(this.state);
  }
  sync(state: MapState) {
    this.state = { ...state };
    if (!this.image) return;
    this.image.setVisible(state.chapter !== 1);
    if (state.chapter !== 1) this.image.setTexture(`${state.chapter === 2 ? 'pair' : 'single'}-${state.view}`);
    const regions = state.chapter === 2 ? BRIDGE_REGIONS : CASE_REGIONS;
    this.labels.forEach((label, n) => {
      label.setVisible(state.chapter !== 1).setPosition(regions[n].x * W, regions[n].y * H - 50).setText(String.fromCharCode(65 + n));
      label.setColor(state.region === regions[n].id ? '#f8d19b' : '#dfebed');
    });
    this.paint(0);
  }
  private ellipse(cx: number, cy: number, rx: number, ry: number) {
    const g = this.overlay!;
    for (let n = 0; n < 80; n += 2) {
      const a = n * Math.PI * 2 / 80, b = (n + 1) * Math.PI * 2 / 80;
      g.lineBetween((cx + Math.cos(a) * rx) * W, (cy + Math.sin(a) * ry) * H, (cx + Math.cos(b) * rx) * W, (cy + Math.sin(b) * ry) * H);
    }
  }
  private paint(time: number) {
    if (!this.overlay) return;
    const g = this.overlay; g.clear();
    const s = this.state;
    if (s.chapter === 1) {
      g.fillStyle(0x0c1b2a); g.fillRect(0, 0, W, H);
      const cx = 450, cy = 285, rx = 275, ry = 275 * Math.cos(s.inclination * DEG);
      for (let r = 1; r > 0; r -= .08) {
        g.fillStyle(0x4d8190, .035); g.fillEllipse(cx, cy, rx * 2 * r, Math.max(8, ry * 2 * r));
      }
      g.lineStyle(1.5, 0x83acb4, .45);
      for (const r of [.35, .65, 1]) g.strokeEllipse(cx, cy, rx * 2 * r, Math.max(8, ry * 2 * r));
      g.lineStyle(1, 0x658698, .25); g.lineBetween(80, cy, 820, cy); g.lineBetween(cx, 70, cx, 485);
      for (let n = 0; n < 64; n++) {
        const angle = n * Math.PI * 2 / 64 + time * s.rotation / 1800000;
        const r = .45 + .5 * ((n * 17 % 31) / 31);
        const x = cx + rx * r * Math.cos(angle), y = cy + ry * r * Math.sin(angle);
        g.fillStyle(Math.cos(angle) > 0 ? 0xd89573 : 0x88b8da, .9); g.fillCircle(x, y, 3 + (n % 3));
      }
      g.fillStyle(0xe7c18a); g.fillCircle(cx, cy, 12);
      if (s.geometry) { g.lineStyle(2.5, 0xe7c18a, .7); g.strokeEllipse(cx, cy, 550, 550 * Math.cos(45 * DEG)); }
    } else {
      g.lineStyle(2, 0xf1d5a2, .8);
      if (s.chapter === 2) { this.ellipse(.32, .58, .16, .105); this.ellipse(.8, .29, .085, .06); }
      else this.ellipse(.43, .52, .20, .13);
      const regions = s.chapter === 2 ? BRIDGE_REGIONS : CASE_REGIONS;
      for (const r of regions) {
        const selected = s.region === r.id;
        const hinted = s.hint >= 3 && (r.id === 'outer_hi' || r.id === 'bridge');
        g.lineStyle(selected || hinted ? 3 : 1.5, selected || hinted ? 0xf0c58c : 0xc4d4df, selected || hinted ? 1 : .55);
        g.strokeCircle(r.x * W, r.y * H, r.radius * H);
        if (selected || hinted) { g.fillStyle(0xf0c58c, .1); g.fillCircle(r.x * W, r.y * H, r.radius * H); }
      }
    }
    // A fixed orientation mark is an interface annotation, not a calibrated celestial WCS.
    g.lineStyle(1.5, 0xc1d1db, .6); g.lineBetween(852, 70, 852, 37); g.lineBetween(852, 37, 846, 47); g.lineBetween(852, 37, 858, 47);
  }
  update(time: number) { if (this.state.chapter === 1) this.paint(time); }
}

export function createObservatory(parent: HTMLElement, onRegion: (id: string | null) => void) {
  const scene = new ObservatoryScene(onRegion);
  const game = new Phaser.Game({
    type: Phaser.CANVAS, width: W, height: H, parent,
    backgroundColor: '#0c1b2a', scene: [scene],
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { keyboard: false }, audio: { noAudio: true },
    render: { antialias: true, roundPixels: false },
    banner: false,
  });
  const observer = new ResizeObserver(() => game.scale.refresh()); observer.observe(parent);
  return { scene, destroy() { observer.disconnect(); game.destroy(true); } };
}
