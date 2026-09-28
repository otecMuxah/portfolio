import * as THREE from 'three';
import { ChapterSpan } from '../journey/journey';
import { seeded, smoothstep } from './art/kit';
import { stageAlong } from './chapters/rally';
import { ASPHALT, DASH, DASH_EVERY, DRIVE, EDGE, PAINT, ROAD } from './escape';
import { carFrom, pathT } from './path';

/**
 * The street's cross-section, in metres across the car's line (+ to its right, away from the scenes): the car keeps
 * the lane by the kerb, the other lane lies on its right, and the pavement runs between the kerb and the scenes.
 */
const LANE = 1.3;
const KERB = 0.2;
const PAVE = 1.6;
/** The kerb's and the pavement's top, above the ground; the asphalt lies at ASPHALT_Y as on the escape road. */
const KERB_Y = 0.14;
const ASPHALT_Y = 0.02;
const PAINT_Y = 0.03;
const HALF = ROAD / 2;

/** Where he walks, runs and cycles before the first car: the pavement's middle, across the car's line, and its top. */
export const PAVEMENT = { side: LANE - HALF - KERB - PAVE / 2, height: KERB_Y } as const;
/** The asphalt, across the car's line, where the street is at its full section. */
export const CARRIAGEWAY = { left: LANE - HALF, right: LANE + HALF } as const;

/** The street narrows to the escape road's own section this far either side of where the two meet (m). */
const EASE = 24;
/** Metres the road runs back behind the first chapter and on past the last, into the fog. */
const BACK = 30;
const ON = 60;
/** Length of each quad along the road (m): its bends are gentle enough (radius 130 m and up) that a chord sags under a centimetre. */
const STEP = 3;
/** The town road tucks this far under the rally's gravel at each end of the stage (m). */
const TUCK = 1;

/**
 * Kharkiv's road is worn: warmer, patched, its paint faded. After the escape the German road is the escape road's own
 * clean asphalt, fresh paint and a pale granite kerb.
 */
const OLD = {
  asphalt: new THREE.Color('#2c2b2a'),
  patch: new THREE.Color('#1c1c1d'),
  kerb: new THREE.Color('#6b665e'),
  pave: new THREE.Color('#4a4640'),
};
const NEW = {
  asphalt: ASPHALT,
  kerb: new THREE.Color('#7c8085'),
  pave: new THREE.Color('#4a4e54'),
};

const UP = new THREE.Vector3(0, 1, 0);

interface Buffers {
  position: number[];
  color: number[];
}

/**
 * The road and pavement under the whole journey (#55): asphalt, a kerb and a pavement on the side of the scenes, and
 * dashed centre lines, along the line the car rides (the camera path, less CAMERA_OFFSET, plus CAR_OFFSET: path.ts),
 * so the car and the person are on it at every progress. Before the war it is Kharkiv's worn road; it gives way to
 * the rally's gravel stage, and it hands over at the war to the escape road, which rejoins it at Ciklum on the same
 * section, colour and dashes: the German road runs on from there. Built once, merged into a few segments of one
 * vertex-coloured material (one draw call each) so the ones out of view are culled; no lights. Graded with the world.
 */
export class Road {
  readonly object = new THREE.Group();
  /** The road through the build-phase world: shown until the car drives out of the war on the escape road. */
  private readonly old: THREE.Mesh[] = [];
  private readonly length: number;
  private readonly lengths: number[];
  private readonly point = new THREE.Vector3();
  private readonly heading = new THREE.Vector3();
  private readonly side = new THREE.Vector3();

  /**
   * `path` is the camera's path and `stops` its stops (path.ts), as the engine drives them; `escape` the escape
   * road's length, so the dashes run on from its last one.
   */
  constructor(
    private readonly path: THREE.CatmullRomCurve3,
    stops: [number, number][],
    spans: ChapterSpan[],
    escape = 0,
  ) {
    this.object.name = 'road';
    this.length = path.getLength();
    this.lengths = path.getLengths();
    const count = spans.length;
    const at = (index: number) => this.lengthAt(index / (count - 1));
    /** Where the escape road rejoins it: where the car stands when the drive ends. */
    const join = this.lengthAt(pathT(stops, count, DRIVE.to));
    const rally = spans.find((s) => s.chapter.scene === 'rally');
    const stage = rally ? stageAlong(rally.index).map((a) => a + at(rally.index)) : [Infinity, Infinity];
    const cuts = (from: number, to: number): [number, number][] =>
      stage[0] < to && stage[1] > from
        ? [
            [from, stage[0] + TUCK],
            [stage[1] - TUCK, to],
          ]
        : [[from, to]];
    // Dashes every DASH_EVERY m on from the escape road's last one; it lays them from DASH_EVERY.
    const phase = escape ? DASH_EVERY - (escape % DASH_EVERY) : 0;

    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
    const random = seeded(55);
    // A segment every three chapters or so up to the join, and the German road on from it.
    const breaks = [-BACK, ...[2.5, 5.5, 8.5].map(at).filter((s) => s < join), join, this.length + ON];
    for (let i = 1; i < breaks.length; i++) {
      const old = breaks[i] <= join;
      const out: Buffers = { position: [], color: [] };
      for (const [from, to] of old ? cuts(breaks[i - 1], breaks[i]) : [[breaks[i - 1], breaks[i]]]) this.lay(from, to, join, phase, random, out);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(out.color, 3));
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = old ? 'road-kharkiv' : 'road-germany';
      if (old) this.old.push(mesh);
      this.object.add(mesh);
    }
  }

  /** Shows the build-phase road until the car leaves the war's light on the escape road. Allocation-free. */
  update(progress: number): void {
    const before = progress < DRIVE.from;
    for (const mesh of this.old) mesh.visible = before;
  }

  /** Metres along the car's line at camera path parameter `t`. */
  private lengthAt(t: number): number {
    const lengths = this.lengths;
    const x = Math.min(Math.max(t, 0), 1) * (lengths.length - 1);
    const i = Math.min(Math.floor(x), lengths.length - 2);
    return lengths[i] + (lengths[i + 1] - lengths[i]) * (x - i);
  }

  /** The car's line `s` metres along it (straight on past either end), its level heading and its right: into this. */
  private frame(s: number): void {
    const u = Math.min(Math.max(s / this.length, 0), 1);
    carFrom(this.path.getPointAt(u, this.point), this.point);
    this.path.getTangentAt(u, this.heading).setY(0).normalize();
    this.point.addScaledVector(this.heading, s - u * this.length);
    this.side.crossVectors(this.heading, UP).normalize();
  }

  /** Lays the road from `from` to `to` metres along the car's line into `out`. */
  private lay(from: number, to: number, join: number, phase: number, random: () => number, out: Buffers): void {
    const colour = new THREE.Color();
    // 1 is the full street, 0 the escape road's section where they meet: taken at each end of a step so the edges run smooth.
    const ease = (s: number) => smoothstep(0, EASE, Math.abs(s - join));
    const centre = (s: number) => LANE * ease(s);
    const edge = (s: number) => centre(s) - HALF;
    const top = (s: number) => ASPHALT_Y + (KERB_Y - ASPHALT_Y) * ease(s);
    const kerb = (s: number) => edge(s) - KERB * ease(s);
    const steps = Math.ceil((to - from) / STEP);
    const patch = [0, 0];
    for (let k = 0; k < steps; k++) {
      const a = from + ((to - from) * k) / steps;
      const b = from + ((to - from) * (k + 1)) / steps;
      const s = (a + b) / 2;
      // `worn` is how Kharkiv it looks.
      const e = ease(s);
      const worn = s < join ? e * (1 - 0.4 * Math.max(s, 0) / join) : 0;

      // Two lanes, each patched on its own where it is worn.
      for (let l = 0; l < 2; l++) {
        if (patch[l] > 0) patch[l]--;
        else if (random() < 0.05 * worn) patch[l] = 1 + Math.floor(random() * 3);
        colour.copy(NEW.asphalt).lerp(OLD.asphalt, worn > 0 ? e : 0);
        if (patch[l] > 0) colour.lerp(OLD.patch, 0.6);
        colour.multiplyScalar(1 + (random() - 0.5) * 0.08 * worn);
        this.quad(a, b, (x) => (l ? [centre(x), centre(x) + HALF, ASPHALT_Y] : [edge(x), centre(x), ASPHALT_Y]), colour, out);
      }
      // Edge lines: the escape road's on both sides where they meet; the German road keeps its right one.
      const left = 1 - e;
      const right = s < join ? 1 - e : 1;
      if (left > 0.01) this.quad(a, b, (x) => [edge(x) + 0.18, edge(x) + 0.32, PAINT_Y], colour.copy(NEW.asphalt).lerp(EDGE, left), out);
      if (right > 0.01) this.quad(a, b, (x) => [centre(x) + HALF - 0.32, centre(x) + HALF - 0.18, PAINT_Y], colour.copy(NEW.asphalt).lerp(EDGE, right), out);

      if (ease(a) < 0.01 && ease(b) < 0.01) continue;
      // The kerb rises out of the escape road's verge, and the pavement widens behind it.
      const tone = 1 + (random() - 0.5) * 0.1 * worn;
      colour.copy(NEW.kerb).lerp(OLD.kerb, worn > 0 ? e : 0).multiplyScalar(tone);
      this.wall(a, b, (x) => [edge(x), ASPHALT_Y, top(x)], colour, out);
      this.quad(a, b, (x) => [kerb(x), edge(x), top(x)], colour, out);
      // Slabs: two across, a step long, a shade apart like a chequer.
      for (let j = 0; j < 2; j++) {
        colour.copy(NEW.pave).lerp(OLD.pave, worn > 0 ? e : 0).multiplyScalar(((k + j) % 2 ? 1.03 : 0.98) * (1 + (random() - 0.5) * 0.08 * worn));
        this.quad(a, b, (x) => [kerb(x) - PAVE * ease(x) * (1 - j / 2), kerb(x) - PAVE * ease(x) * (0.5 - j / 2), top(x)], colour, out);
      }
    }

    // Dashes on the centre line, faded and here and there worn away on the old road.
    const first = join + phase + Math.ceil((from - join - phase) / DASH_EVERY) * DASH_EVERY;
    for (let d = first; d < to; d += DASH_EVERY) {
      const a = d;
      const b = Math.min(d + DASH, to);
      const s = (a + b) / 2;
      const e = ease(s);
      const worn = s < join ? e * (1 - 0.4 * Math.max(s, 0) / join) : 0;
      if (random() < 0.15 * worn) continue;
      colour.copy(PAINT).lerp(OLD.asphalt, 0.45 * worn);
      this.quad(a, b, (x) => [centre(x) - 0.08, centre(x) + 0.08, PAINT_Y], colour, out);
    }
  }

  /** A quad from `a` to `b` metres along, facing up; `span` gives its left, right and height at either end. */
  private quad(a: number, b: number, span: (s: number) => [number, number, number], colour: THREE.Color, out: Buffers): void {
    const [l0, r0] = this.across(a, ...span(a));
    const [l1, r1] = this.across(b, ...span(b));
    out.position.push(...l0, ...r0, ...l1, ...r0, ...r1, ...l1);
    for (let i = 0; i < 6; i++) out.color.push(colour.r, colour.g, colour.b);
  }

  /** An upright face from `a` to `b` metres along, facing the road (right); `rise` gives where across, its foot and its top at either end. */
  private wall(a: number, b: number, rise: (s: number) => [number, number, number], colour: THREE.Color, out: Buffers): void {
    const [b0, t0] = this.up(a, ...rise(a));
    const [b1, t1] = this.up(b, ...rise(b));
    out.position.push(...b0, ...b1, ...t0, ...b1, ...t1, ...t0);
    for (let i = 0; i < 6; i++) out.color.push(colour.r, colour.g, colour.b);
  }

  private across(s: number, l: number, r: number, y: number): number[][] {
    this.frame(s);
    const { point: p, side } = this;
    return [
      [p.x + side.x * l, y, p.z + side.z * l],
      [p.x + side.x * r, y, p.z + side.z * r],
    ];
  }

  private up(s: number, x: number, y0: number, y1: number): number[][] {
    this.frame(s);
    const { point: p, side } = this;
    return [
      [p.x + side.x * x, y0, p.z + side.z * x],
      [p.x + side.x * x, y1, p.z + side.z * x],
    ];
  }
}
