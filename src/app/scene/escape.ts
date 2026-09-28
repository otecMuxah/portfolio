import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ESCAPE_ROUTE } from '../content/life';
import { chapterSpans } from '../journey/journey';
import { haloMap, lightPool, lowPoly, mergedMesh, smoothstep } from './art/kit';
import { PALETTE } from './art/palette';

const SPANS = chapterSpans();
const WAR = SPANS.find((s) => s.chapter.phase === 'shatter')!;
const FIRST = SPANS.find((s) => s.chapter.phase === 'rebuild')!;
const AFTER = SPANS[FIRST.index + 1];

/**
 * The escape (#44), in journey progress: from late in the war, once its one light has been alone a while, to the
 * middle of Ciklum, where the camera road takes the car on again.
 */
export const DRIVE = {
  from: WAR.start + 0.84 * (WAR.end - WAR.start),
  to: (FIRST.start + FIRST.end) / 2,
} as const;

/** How far through the drive the journey is at `progress`: 0 before it, 1 once the car has arrived. Pure. */
export function driveAt(progress: number): number {
  return Math.min(Math.max((progress - DRIVE.from) / (DRIVE.to - DRIVE.from), 0), 1);
}

/** The journey progress `u` of the way through the drive. */
export function driveProgress(u: number): number {
  return DRIVE.from + (DRIVE.to - DRIVE.from) * u;
}

/** The war's light drops and splits into the two headlights over this first share of the drive; the car waits for it. */
export const SPLIT = 0.05;
/** The share of the drive where the night starts to lift: past Italy, into France (grade.ts). */
export const DAWN = 0.6;

const STEPS = 256;
/** Share of the road covered by each step of the drive: pulling away slowly, cruising, slowing to arrive. */
const TRAVEL = (() => {
  const speed = (u: number) => smoothstep(SPLIT, 0.2, u) * (1 - smoothstep(0.82, 1, u));
  const table = new Float32Array(STEPS + 1);
  for (let i = 1; i <= STEPS; i++) table[i] = table[i - 1] + speed((i - 0.5) / STEPS);
  for (let i = 1; i <= STEPS; i++) table[i] /= table[STEPS];
  return table;
})();

/** How far along the road (0..1 of its length) the car is `u` through the drive. Pure and monotonic. */
export function travelAt(u: number): number {
  const x = Math.min(Math.max(u, 0), 1) * STEPS;
  const i = Math.min(Math.floor(x), STEPS - 1);
  return TRAVEL[i] + (TRAVEL[i + 1] - TRAVEL[i]) * (x - i);
}

/**
 * Where each border sign stands along the road (share of its length), in ESCAPE_ROUTE order: the first once the camera
 * has fallen in behind the car, Germany just before it arrives.
 */
export const SIGNS = ESCAPE_ROUTE.map((_, i) => 0.22 + (i * 0.72) / (ESCAPE_ROUTE.length - 1));

/**
 * How much the camera rides behind the car rather than on its own road: none while the light splits and the car comes
 * out of the dark, all of it on the open road, none again as the car arrives and the road takes the camera back.
 */
export function chaseAt(u: number): number {
  return smoothstep(0.1, 0.28, u) * (1 - smoothstep(0.84, 1, u));
}

const CHASE_BACK = 13;
const CHASE_UP = 4.6;
/** The camera looks ahead and a little to the left of the road, where the signs stand: the car rides right of centre. */
const LOOK_AHEAD = 14;
const LOOK_LEFT = 2.2;
const UP = new THREE.Vector3(0, 1, 0);
const side = new THREE.Vector3();

/** The chase camera for a car at `position` heading along `direction`: behind, above and a little to its right. */
export function chaseCamera(position: THREE.Vector3, direction: THREE.Vector3, camera: THREE.Vector3, look: THREE.Vector3): void {
  side.crossVectors(direction, UP).normalize();
  camera.copy(position).addScaledVector(direction, -CHASE_BACK).setY(position.y + CHASE_UP);
  look.copy(position).addScaledVector(direction, LOOK_AHEAD).addScaledVector(side, -LOOK_LEFT).setY(position.y + 1.2);
}

const from = new THREE.Vector3();
const to = new THREE.Vector3();

/**
 * Moves `camera` and `look` `k` of the way to the chase camera and its look, swinging around the car at `position`
 * rather than cutting past it: bearing, distance and height from the car blend apart. Allocation-free.
 */
export function fallIn(position: THREE.Vector3, camera: THREE.Vector3, look: THREE.Vector3, chase: THREE.Vector3, chaseLook: THREE.Vector3, k: number): void {
  from.subVectors(camera, position);
  to.subVectors(chase, position);
  const a = Math.atan2(from.z, from.x);
  let turn = Math.atan2(to.z, to.x) - a;
  turn -= Math.PI * 2 * Math.round(turn / (Math.PI * 2));
  const bearing = a + turn * k;
  const reach = THREE.MathUtils.lerp(Math.hypot(from.x, from.z), Math.hypot(to.x, to.z), k);
  camera.set(position.x + Math.cos(bearing) * reach, THREE.MathUtils.lerp(camera.y, chase.y, k), position.z + Math.sin(bearing) * reach);
  look.lerp(chaseLook, k);
}

/**
 * The road's bends, metres from the war's anchor (x, z), after the last light it starts under: toward the camera, a
 * hairpin, then winding south-east and back to where the camera road picks the car up. Clear of every standing scene.
 */
export const BENDS: [x: number, z: number][] = [
  [-3.5, 14],
  [2, 18.5],
  [8.5, 16.5],
  [14, 9],
  [24, 6],
  [36, 10],
  [48, 8],
  [57, 0],
  [58, -11],
  [51, -20],
  [40, -23],
  [29, -19],
  [19, -19],
  [14, -24],
];

const ROAD = 5.6;
const DASH = 2;
const DASH_EVERY = 5;
const REFLECTOR_EVERY = 9;
/** Where a sign stands off the road's centre (left verge, m), how it turns toward the camera behind the car, its size. */
const SIGN_OFF = ROAD / 2 + 1.3;
const SIGN_TURN = 0.45;
const SIGN_W = 2.6;
const SIGN_H = 1.3;
const SIGN_Y = 2.3;
/** Headlight and tail-light, in the F30's own space (front is +x): see cars.ts. */
const HEAD = new THREE.Vector3(2.4, 0.73, 0.65);
const TAIL = new THREE.Vector3(-2.4, 0.73, 0.65);

/** Metres the road runs on past where the car arrives, on into the fog ahead of it. */
const RUN_ON = 30;
const ASPHALT = new THREE.Color('#25272d');
const PAINT = new THREE.Color(PALETTE.chalk);
const EDGE = new THREE.Color(PALETTE.gravel);
const HEAD_GLOW = new THREE.Color(PALETTE.lastLight);
const TAIL_GLOW = new THREE.Color(PALETTE.tailLight);
const AMBER = new THREE.Color(PALETTE.candle);

/** The eight border signs, one per cell of a 2 × 4 atlas: blue, a ring of gold stars for the EU, the name in white. */
function signAtlas(): THREE.CanvasTexture {
  const W = 512;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = 2 * W;
  canvas.height = 4 * H;
  const ctx = canvas.getContext('2d')!;
  ESCAPE_ROUTE.forEach(({ code, name }, i) => {
    const x = (i % 2) * W;
    const y = Math.floor(i / 2) * H;
    ctx.fillStyle = PALETTE.signBlue;
    ctx.fillRect(x, y, W, H);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.strokeRect(x + 14, y + 14, W - 28, H - 28);
    // Moldova is not in the EU: its sign carries the name alone.
    const eu = code !== 'MD';
    if (eu) {
      ctx.fillStyle = PALETTE.signGold;
      for (let s = 0; s < 12; s++) {
        const a = (s / 12) * Math.PI * 2;
        star(ctx, x + 108 + Math.cos(a) * 58, y + H / 2 + Math.sin(a) * 58, 11);
      }
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const left = eu ? 190 : 40;
    ctx.fillText(name.toUpperCase(), x + (left + W - 36) / 2, y + H / 2 + 4, W - 36 - left);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const d = k % 2 ? r * 0.42 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
}

/** A flat quad lying on the road, `a`..`b` metres along it, from `l` to `r` metres off its centre, into `out`. */
function strip(curve: THREE.Curve<THREE.Vector3>, length: number, a: number, b: number, l: number, r: number, colour: THREE.Color, y: number, out: { position: number[]; color: number[] }): void {
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const corner = (s: number, o: number) => {
    curve.getPointAt(Math.min(s / length, 1), p);
    curve.getTangentAt(Math.min(s / length, 1), t);
    side.crossVectors(t, UP).normalize();
    return [p.x + side.x * o, y, p.z + side.z * o];
  };
  const [a0, a1, b0, b1] = [corner(a, l), corner(a, r), corner(b, l), corner(b, r)];
  out.position.push(...a0, ...a1, ...b0, ...a1, ...b1, ...b0);
  for (let i = 0; i < 6; i++) out.color.push(colour.r, colour.g, colour.b);
}

/**
 * The road out of the war (#44): a ribbon from the war's last light to where the camera road picks the car up, past
 * a border sign for each country in ESCAPE_ROUTE, with reflector posts along its verges. At night the F30's headlights
 * are the only light on it: the signs and reflectors light up as the car comes at them, and a pool of light runs
 * ahead of it on the asphalt. Built once, merged: road, sign posts, sign faces, reflectors, lamps and the beam are six
 * draw calls. Everything is posed from the drive's progress alone, so scrolling back reverses it exactly.
 */
export class EscapeRoute {
  readonly object = new THREE.Group();
  readonly curve: THREE.CatmullRomCurve3;
  readonly length: number;
  /** Metres along the road of each sign and each reflector. */
  readonly signs: number[];
  private readonly reflectorAt: number[] = [];
  private readonly faces: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly reflectors: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly lamps: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly beam: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly at = new THREE.Vector3();
  private readonly heading = new THREE.Vector3();
  private readonly lamp = new THREE.Vector3();

  /** `points` are the road's bends in world space, ground level; `light` is the war's last light (world). */
  constructor(
    points: THREE.Vector3[],
    private readonly light: THREE.Vector3,
  ) {
    this.object.name = 'escape';
    this.curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    this.length = this.curve.getLength();
    this.signs = SIGNS.map((s) => s * this.length);

    const road = { position: [] as number[], color: [] as number[] };
    const [last, end] = points.slice(-2);
    const onward = new THREE.LineCurve3(end, end.clone().sub(last).setLength(RUN_ON).add(end));
    for (const [curve, length] of [[this.curve, this.length], [onward, RUN_ON]] as const) {
      const step = length / Math.ceil(length / 1.5);
      for (let s = 0; s < length - 1e-6; s += step) {
        strip(curve, length, s, s + step, -ROAD / 2, ROAD / 2, ASPHALT, 0.02, road);
        for (const o of [-ROAD / 2 + 0.25, ROAD / 2 - 0.25]) strip(curve, length, s, s + step, o - 0.07, o + 0.07, EDGE, 0.03, road);
      }
      for (let s = DASH_EVERY; s < length - DASH; s += DASH_EVERY) strip(curve, length, s, s + DASH, -0.08, 0.08, PAINT, 0.03, road);
    }
    const ribbon = new THREE.BufferGeometry();
    ribbon.setAttribute('position', new THREE.Float32BufferAttribute(road.position, 3));
    ribbon.setAttribute('color', new THREE.Float32BufferAttribute(road.color, 3));
    ribbon.computeVertexNormals();
    const asphalt = new THREE.Mesh(ribbon, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));

    // Each sign: two posts and a panel back (one merged mesh for all eight), and its face out of the atlas.
    const posts: THREE.BufferGeometry[] = [];
    const faces: THREE.BufferGeometry[] = [];
    const place = new THREE.Matrix4();
    const normal = new THREE.Vector3();
    const across = new THREE.Vector3();
    this.signs.forEach((s, i) => {
      this.curve.getPointAt(s / this.length, this.at);
      this.curve.getTangentAt(s / this.length, this.heading);
      side.crossVectors(this.heading, UP).normalize();
      // It faces the oncoming car, turned a little toward the road so the camera behind reads it.
      normal.copy(this.heading).negate().addScaledVector(side, SIGN_TURN).normalize();
      across.crossVectors(UP, normal);
      place.makeBasis(across, UP, normal).setPosition(this.at.addScaledVector(side, -SIGN_OFF));
      for (const x of [-SIGN_W * 0.36, SIGN_W * 0.36]) posts.push(new THREE.BoxGeometry(0.09, SIGN_Y, 0.09).translate(x, SIGN_Y / 2, -0.06).applyMatrix4(place));
      posts.push(new THREE.BoxGeometry(SIGN_W + 0.08, SIGN_H + 0.08, 0.06).translate(0, SIGN_Y, -0.04).applyMatrix4(place));
      const face = new THREE.PlaneGeometry(SIGN_W, SIGN_H).translate(0, SIGN_Y, 0).applyMatrix4(place);
      const uv = face.getAttribute('uv');
      for (let k = 0; k < uv.count; k++) uv.setXY(k, ((i % 2) + uv.getX(k)) / 2, 1 - (Math.floor(i / 2) + 1 - uv.getY(k)) / 4);
      faces.push(face);
    });
    const furniture = mergedMesh(posts, lowPoly('concrete'));
    const faceGeometry = mergeGeometries(faces);
    faces.forEach((g) => g.dispose());
    faceGeometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(faceGeometry.getAttribute('position').count * 3), 3));
    this.faces = new THREE.Mesh(
      faceGeometry,
      new THREE.MeshBasicMaterial({ map: signAtlas(), vertexColors: true, fog: false }),
    );

    // Reflector posts on both verges: amber points that flare as the headlights reach them.
    const reflectors: number[] = [];
    for (let s = REFLECTOR_EVERY / 2; s < this.length; s += REFLECTOR_EVERY) {
      this.curve.getPointAt(s / this.length, this.at);
      this.curve.getTangentAt(s / this.length, this.heading);
      side.crossVectors(this.heading, UP).normalize();
      for (const o of [-1, 1]) {
        reflectors.push(this.at.x + side.x * o * (ROAD / 2 + 0.5), 0.7, this.at.z + side.z * o * (ROAD / 2 + 0.5));
        this.reflectorAt.push(s);
      }
    }
    const glowing = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, fog: false, map: haloMap() };
    const reflectorGeometry = new THREE.BufferGeometry();
    reflectorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(reflectors, 3));
    reflectorGeometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(reflectors.length), 3));
    this.reflectors = new THREE.Points(reflectorGeometry, new THREE.PointsMaterial({ ...glowing, size: 0.7 }));

    // The car's lamps: two headlights (the war's light, split in two) and two tail-lights.
    const lampGeometry = new THREE.BufferGeometry();
    lampGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3).setUsage(THREE.DynamicDrawUsage));
    lampGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(12), 3).setUsage(THREE.DynamicDrawUsage));
    this.lamps = new THREE.Points(lampGeometry, new THREE.PointsMaterial({ ...glowing, size: 1.5 }));
    this.beam = lightPool('lastLight', 15, 6);

    for (const o of [this.faces, this.reflectors, this.lamps, this.beam]) {
      o.material.userData['ungraded'] = true;
      o.material.fog = false;
      o.frustumCulled = false;
    }
    this.object.add(asphalt, furniture, this.faces, this.reflectors, this.beam, this.lamps);
  }

  /** Where the car is `u` through the drive, and which way it heads (unit, level). Allocation-free. */
  pose(u: number, position: THREE.Vector3, direction: THREE.Vector3): void {
    const k = travelAt(u);
    this.curve.getPointAt(k, position);
    this.curve.getTangentAt(k, direction).setY(0).normalize();
    position.y = 0;
  }

  /**
   * Poses the road for journey `progress`: hidden before the drive and once the camera has gone on past Ciklum.
   * `dawn` (0..1, grade.ts dawnAt) lifts the signs out of the night as the sky turns. Allocation-free.
   */
  update(progress: number, dawn: number): void {
    const u = driveAt(progress);
    this.object.visible = u > 0 && progress < AFTER.start;
    if (!this.object.visible) return;
    this.pose(u, this.at, this.heading);
    const travelled = travelAt(u) * this.length;
    side.crossVectors(this.heading, UP).normalize();

    // The light comes down into the headlights and splits in two; tail-lights come on as the car pulls away.
    const split = smoothstep(0, SPLIT, u);
    const on = 1 - smoothstep(0.86, 1, u);
    const position = this.lamps.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colour = this.lamps.geometry.getAttribute('color') as THREE.BufferAttribute;
    [HEAD, TAIL].forEach((lamp, j) => {
      for (const s of [-1, 1]) {
        const i = j * 2 + (s + 1) / 2;
        this.lamp.copy(this.at).addScaledVector(this.heading, lamp.x).addScaledVector(side, lamp.z * s).setY(lamp.y);
        if (j === 0) this.lamp.lerpVectors(this.light, this.lamp, split);
        position.setXYZ(i, this.lamp.x, this.lamp.y, this.lamp.z);
        const b = j === 0 ? (0.6 + 0.4 * split) * on : 0.7 * split * on;
        const c = j === 0 ? HEAD_GLOW : TAIL_GLOW;
        colour.setXYZ(i, c.r * b, c.g * b, c.b * b);
      }
    });
    position.needsUpdate = colour.needsUpdate = true;

    this.beam.position.copy(this.at).addScaledVector(this.heading, 9).setY(0.05);
    this.beam.rotation.y = Math.atan2(-this.heading.z, this.heading.x);
    this.beam.material.opacity = 0.5 * split * on * (1 - 0.5 * dawn);
    this.beam.visible = this.beam.material.opacity > 0;

    // Signs and reflectors catch the headlights as the car comes at them, and keep a little of it once it is past.
    // Headlights shine ahead, so what stands beside the car goes dark again.
    const caught = (ahead: number, reach: number) => smoothstep(1, 7, ahead) * (1 - smoothstep(reach * 0.45, reach, ahead));
    const face = this.faces.geometry.getAttribute('color') as THREE.BufferAttribute;
    const perSign = face.count / this.signs.length;
    this.signs.forEach((s, i) => {
      const b = Math.max(0.9 * dawn, caught(s - travelled, 42) * split * on);
      for (let k = 0; k < perSign; k++) face.setXYZ(i * perSign + k, b, b, b);
    });
    face.needsUpdate = true;
    const glint = this.reflectors.geometry.getAttribute('color') as THREE.BufferAttribute;
    this.reflectorAt.forEach((s, i) => {
      const b = caught(s - travelled, 30) * split * on * (1 - dawn);
      glint.setXYZ(i, AMBER.r * b, AMBER.g * b, AMBER.b * b);
    });
    glint.needsUpdate = true;
  }
}
