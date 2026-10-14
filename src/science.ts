/** Deterministic teaching models. No real observations or calibrated fluxes. */
export const DEG = Math.PI / 180;
export const CASE_REGIONS = [
  { id: 'outer_hi', label: '区域 A', x: 0.74, y: 0.52, radius: 0.075 },
  { id: 'inner_disk', label: '区域 B', x: 0.43, y: 0.52, radius: 0.07 },
  { id: 'background', label: '区域 C', x: 0.18, y: 0.23, radius: 0.07 },
] as const;
export const BRIDGE_REGIONS = [
  { id: 'bridge', label: '区域 A', x: 0.61, y: 0.4, radius: 0.08 },
  { id: 'primary', label: '区域 B', x: 0.32, y: 0.58, radius: 0.08 },
  { id: 'empty', label: '区域 C', x: 0.2, y: 0.23, radius: 0.07 },
] as const;
export type SpectrumPoint = { velocity: number; intensity: number };
export const TARGET = { rotation: 180, inclination: 45, dispersion: 12 };

export function projectedVelocity(rotation: number, inclination: number) {
  return rotation * Math.sin(inclination * DEG);
}

/** Annuli in a thin, circular gas disk. Surface density and rotation curve are fixed. */
export function spectrum(rotation: number, inclination: number, dispersion = 12): SpectrumPoint[] {
  if (!Number.isFinite(rotation) || rotation < 0 || !Number.isFinite(inclination) || inclination < 0 || inclination > 90 || !Number.isFinite(dispersion) || dispersion <= 0) {
    throw new RangeError('Invalid teaching spectrum parameters');
  }
  const bins = Array.from({ length: 161 }, (_, n) => ({ velocity: -320 + n * 4, intensity: 0 }));
  const projected = projectedVelocity(rotation, inclination);
  for (let ring = 1; ring <= 20; ring++) {
    const r = ring / 20;
    const weight = r * Math.exp(-r / 0.5);
    const speed = projected * (1 - Math.exp(-r / 0.12));
    for (let az = 0; az < 72; az++) {
      const lineVelocity = speed * Math.cos(az * 2 * Math.PI / 72);
      const low = Math.max(0, Math.floor((lineVelocity - dispersion * 4 + 320) / 4));
      const high = Math.min(bins.length - 1, Math.ceil((lineVelocity + dispersion * 4 + 320) / 4));
      for (let k = low; k <= high; k++) {
        const d = (bins[k].velocity - lineVelocity) / dispersion;
        bins[k].intensity += weight * Math.exp(-0.5 * d * d);
      }
    }
  }
  const max = Math.max(...bins.map(p => p.intensity));
  return bins.map(p => ({ ...p, intensity: p.intensity / max }));
}

export function lineWidth50(points: SpectrumPoint[]) {
  const threshold = Math.max(...points.map(p => p.intensity)) * 0.5;
  const crossings: number[] = [];
  for (let n = 1; n < points.length; n++) {
    const a = points[n - 1], b = points[n];
    if ((a.intensity - threshold) * (b.intensity - threshold) < 0) {
      crossings.push(a.velocity + (threshold - a.intensity) * (b.velocity - a.velocity) / (b.intensity - a.intensity));
    }
  }
  return crossings.length >= 2 ? crossings.at(-1)! - crossings[0] : 0;
}

export function matchPercent(rotation: number, inclination: number) {
  const delta = Math.abs(projectedVelocity(rotation, inclination) - projectedVelocity(TARGET.rotation, TARGET.inclination));
  return Math.max(0, Math.round(100 - delta / 1.35));
}

export function diskRadius(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  return Math.hypot((x - cx) / rx, (y - cy) / ry);
}

export function bridgePoint(t: number) {
  return { x: 0.43 + 0.36 * t, y: 0.54 - 0.25 * t - Math.sin(t * Math.PI) * 0.045 };
}

export function bridgeVelocity(t: number) { return 115 - 25 * t; }

export function hiField(x: number, y: number, interacting = false) {
  if (!interacting) {
    const r = diskRadius(x, y, 0.43, 0.52, 0.38, 0.25);
    return Math.exp(-r * r * 1.5) * (0.85 + 0.12 * Math.cos(Math.atan2(y - 0.52, x - 0.43) * 3));
  }
  const primary = Math.exp(-(diskRadius(x, y, 0.32, 0.58, 0.26, 0.2) ** 2) * 2);
  const companion = 0.7 * Math.exp(-(diskRadius(x, y, 0.8, 0.29, 0.13, 0.1) ** 2) * 2);
  let bridge = 0;
  for (let n = 0; n <= 32; n++) {
    const p = bridgePoint(n / 32);
    bridge = Math.max(bridge, 0.6 * Math.exp(-((x - p.x) ** 2 + (y - p.y) ** 2) / 0.0022));
  }
  return Math.max(primary, companion, bridge);
}

export function velocityField(x: number, y: number) {
  let nearest = { distance: Infinity, t: 0 };
  for (let n = 0; n <= 48; n++) {
    const t = n / 48, p = bridgePoint(t), distance = Math.hypot(x - p.x, y - p.y);
    if (distance < nearest.distance) nearest = { distance, t };
  }
  if (nearest.distance < 0.065 && x > 0.44 && x < 0.76) return bridgeVelocity(nearest.t);
  if (x > 0.69 && y < 0.4) return 90 + (x - 0.8) * 180;
  const dx = (x - 0.32) / 0.26, dy = (y - 0.58) / 0.2;
  return 125 * dx / Math.max(0.6, Math.hypot(dx, dy));
}

export function regionAt(x: number, y: number, interacting = false) {
  return (interacting ? BRIDGE_REGIONS : CASE_REGIONS).find(r => Math.hypot((x - r.x) * (900 / 560), y - r.y) < r.radius)?.id ?? null;
}
