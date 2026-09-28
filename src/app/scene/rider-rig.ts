import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RiderState } from '../journey/journey';
import { smoothstep } from './art/kit';

/** Gait cycles (strides, pedal turns) over the whole journey's scroll: about six a chapter. */
const STRIDES = 110;

/** A body's proportions (m) at one stage. `scale` enlarges the small ones so they read from the road camera. */
interface Body {
  scale: number;
  head: number;
  torso: number;
  shoulders: number;
  hips: number;
  chest: number;
  upperArm: number;
  foreArm: number;
  thigh: number;
  shin: number;
  foot: number;
  limb: number;
}

const FIELDS = ['scale', 'head', 'torso', 'shoulders', 'hips', 'chest', 'upperArm', 'foreArm', 'thigh', 'shin', 'foot', 'limb'] as const;

/** Crawl (a baby), walk (six), run (fourteen), bike (seventeen): each stage's proportions, head large when small. */
const BODIES: Body[] = [
  { scale: 1.7, head: 0.17, torso: 0.24, shoulders: 0.17, hips: 0.13, chest: 0.12, upperArm: 0.08, foreArm: 0.09, thigh: 0.13, shin: 0.12, foot: 0.08, limb: 0.065 },
  { scale: 1.3, head: 0.2, torso: 0.34, shoulders: 0.24, hips: 0.17, chest: 0.14, upperArm: 0.18, foreArm: 0.21, thigh: 0.27, shin: 0.26, foot: 0.15, limb: 0.08 },
  { scale: 1.08, head: 0.21, torso: 0.48, shoulders: 0.34, hips: 0.22, chest: 0.17, upperArm: 0.27, foreArm: 0.32, thigh: 0.4, shin: 0.39, foot: 0.23, limb: 0.09 },
  { scale: 1, head: 0.22, torso: 0.54, shoulders: 0.4, hips: 0.25, chest: 0.2, upperArm: 0.3, foreArm: 0.36, thigh: 0.45, shin: 0.44, foot: 0.26, limb: 0.1 },
];

/** The bicycle, in rig space (forward +x): wheel radius, axles, bottom bracket, saddle, grips, crank length. */
const WHEEL = 0.33;
const REAR = [-0.52, WHEEL] as const;
const FRONT = [0.54, WHEEL] as const;
const CRANK_AT = [0, 0.3] as const;
const SADDLE = [-0.25, 0.95] as const;
const BAR = [0.38, 1.03] as const;
const CRANK = 0.17;
/** Wheel turns per pedal turn. */
const GEAR = 2.2;
/** Where the Golf's driver sits (rig space, left of centre), where he waits for it. */
const SEAT = [-0.25, 0.5, -0.4] as const;

const COLOURS = {
  skin: '#e8b890',
  hair: '#6b4428',
  shirt: '#f4b860',
  trousers: '#4d7ea8',
  shoes: '#2e2a28',
  frame: '#3f9c9a',
  tyre: '#6a6e78',
  metal: '#26282e',
};

/** One pose in the body's side plane. Limb angles are world, swung forward from hanging straight down; left then right. */
class Pose {
  x = 0;
  y = 0;
  /** Torso forward from upright. */
  lean = 0;
  /** Head tilt, world: 0 upright, negative nodding forward. */
  head = 0;
  readonly thigh = [0, 0];
  readonly shin = [0, 0];
  /** Foot at the ankle, relative to the shin: 0 square to it. */
  readonly ankle = [0, 0];
  readonly upper = [0, 0];
  readonly fore = [0, 0];

  /** This pose `k` of the way from `a` to `b`; either may be this one. */
  mix(a: Pose, b: Pose, k: number): this {
    this.x = lerp(a.x, b.x, k);
    this.y = lerp(a.y, b.y, k);
    this.lean = lerp(a.lean, b.lean, k);
    this.head = lerp(a.head, b.head, k);
    for (let i = 0; i < 2; i++) {
      this.thigh[i] = lerp(a.thigh[i], b.thigh[i], k);
      this.shin[i] = lerp(a.shin[i], b.shin[i], k);
      this.ankle[i] = lerp(a.ankle[i], b.ankle[i], k);
      this.upper[i] = lerp(a.upper[i], b.upper[i], k);
      this.fore[i] = lerp(a.fore[i], b.fore[i], k);
    }
    return this;
  }
}

/** A joint and the segment hanging off it: a leaf bone, so its scale sizes that part alone and not the joints beyond. */
interface Limb {
  joint: THREE.Bone;
  segment: THREE.Bone;
}

/**
 * The person on the road before the first car (#46): a baby crawling, a child walking, a teen running, a young man
 * on a bicycle, then off it to wait where the Golf 2 arrives. One skinned mesh (one draw call): every body part is
 * rigid on its own bone, posed from scroll alone; `time` only breathes and turns the head.
 */
export class RiderRig {
  readonly object = new THREE.Group();
  private readonly bones: THREE.Bone[] = [];
  private readonly body: Body = { ...BODIES[0] };
  private readonly pose = new Pose();
  private readonly from = new Pose();
  private readonly to = new Pose();
  private readonly root: THREE.Bone;
  private readonly hips: THREE.Bone;
  private readonly pelvis: THREE.Bone;
  private readonly torso: Limb;
  private readonly neck: Limb;
  private readonly arms: [Limb, Limb][] = [];
  private readonly legs: [Limb, Limb, Limb][] = [];
  private readonly bike: THREE.Bone;
  private readonly wheels: THREE.Bone[];
  private readonly crank: THREE.Bone;

  constructor() {
    const parts: THREE.BufferGeometry[] = [];
    const add = (geometry: THREE.BufferGeometry, bone: THREE.Bone, colour: string) =>
      parts.push(rigid(geometry, this.bones.indexOf(bone), colour));
    const limb = (parent: THREE.Object3D): Limb => {
      const joint = this.bone(parent);
      return { joint, segment: this.bone(joint) };
    };

    this.root = this.bone(null);
    this.hips = this.bone(this.root);
    this.pelvis = this.bone(this.hips);
    this.torso = limb(this.hips);
    this.neck = limb(this.torso.joint);
    for (let i = 0; i < 2; i++) {
      const upper = limb(this.torso.joint);
      const fore = limb(upper.joint);
      this.arms.push([upper, fore]);
      const thigh = limb(this.hips);
      const shin = limb(thigh.joint);
      const foot = limb(shin.joint);
      this.legs.push([thigh, shin, foot]);
    }

    // Unit parts, sized by their segment's scale: limbs hang from 0 to -1, the torso rises from 0 to 1.
    const limbPart = () => new THREE.CylinderGeometry(0.5, 0.42, 1, 5).translate(0, -0.5, 0);
    add(new THREE.BoxGeometry(1, 1, 1).translate(0, -0.25, 0), this.pelvis, COLOURS.trousers);
    add(new THREE.CylinderGeometry(0.5, 0.4, 1, 6).translate(0, 0.5, 0), this.torso.segment, COLOURS.shirt);
    // Faceless: a round head with a cap of hair set back, so it reads which way he faces.
    add(new THREE.IcosahedronGeometry(0.5, 1).translate(0, 0.5, 0), this.neck.segment, COLOURS.skin);
    add(new THREE.IcosahedronGeometry(0.52, 1).translate(-0.08, 0.57, 0), this.neck.segment, COLOURS.hair);
    for (const [upper, fore] of this.arms) {
      add(limbPart(), upper.segment, COLOURS.shirt);
      add(limbPart(), fore.segment, COLOURS.skin);
    }
    for (const [thigh, shin, foot] of this.legs) {
      add(limbPart(), thigh.segment, COLOURS.trousers);
      add(limbPart(), shin.segment, COLOURS.trousers);
      add(new THREE.BoxGeometry(1, 1, 1).translate(0.25, -0.5, 0), foot.segment, COLOURS.shoes);
    }

    this.bike = this.bone(null);
    this.wheels = [REAR, FRONT].map(([x, y]) => {
      const wheel = this.bone(this.bike);
      wheel.position.set(x, y, 0);
      add(new THREE.TorusGeometry(WHEEL - 0.045, 0.045, 4, 14), wheel, COLOURS.tyre);
      for (const turn of [0, Math.PI / 2])
        add(new THREE.BoxGeometry(2 * (WHEEL - 0.04), 0.014, 0.014).rotateZ(turn), wheel, COLOURS.metal);
      return wheel;
    });
    this.crank = this.bone(this.bike);
    this.crank.position.set(...CRANK_AT, 0);
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 10).rotateX(Math.PI / 2).translate(0, 0, 0.06), this.crank, COLOURS.metal);
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(CRANK, 0.025, 0.02).translate((side * CRANK) / 2, 0, side * 0.1), this.crank, COLOURS.metal);
      add(new THREE.BoxGeometry(0.06, 0.02, 0.1).translate(side * CRANK, 0, side * 0.15), this.crank, COLOURS.metal);
    }
    const [bx, by] = CRANK_AT;
    const seat = [-0.2, 0.84] as const;
    const head = [0.42, 0.84] as const;
    const fork = [0.46, 0.68] as const;
    const frame = [
      tube(bx, by, ...seat),
      tube(...seat, ...head),
      tube(bx, by, ...fork),
      tube(...head, ...fork),
      tube(...seat, SADDLE[0] + 0.02, SADDLE[1] - 0.03),
      ...[-0.05, 0.05].flatMap((z) => [tube(bx, by, ...REAR, z), tube(...seat, ...REAR, z), tube(...fork, ...FRONT, z)]),
    ];
    frame.forEach((g) => add(g, this.bike, COLOURS.frame));
    add(tube(...head, ...BAR, 0, 0.035), this.bike, COLOURS.metal);
    add(new THREE.BoxGeometry(0.04, 0.035, 0.52).translate(...BAR, 0), this.bike, COLOURS.metal);
    add(new THREE.BoxGeometry(0.26, 0.05, 0.13).translate(...SADDLE, 0), this.bike, COLOURS.metal);

    const geometry = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    const mesh = new THREE.SkinnedMesh(geometry, MATERIAL);
    mesh.add(this.root, this.bike);
    // Bone inverses and bind matrix are identity: each part is modelled in its own bone's space.
    mesh.bind(
      new THREE.Skeleton(
        this.bones,
        this.bones.map(() => new THREE.Matrix4()),
      ),
      new THREE.Matrix4(),
    );
    mesh.frustumCulled = false;
    this.object.add(mesh);
  }

  /**
   * Places him at `position` facing along `direction`, as he is at journey `progress`: `state` says how grown and how
   * far off the bike. Hidden once a car carries the camera. Allocates nothing.
   */
  update(state: RiderState, progress: number, position: THREE.Vector3, direction: THREE.Vector3, time: number): void {
    this.object.visible = state.riderId !== null;
    if (!this.object.visible) return;
    this.object.position.copy(position);
    this.object.rotation.y = Math.atan2(-direction.z, direction.x);

    const g = state.growth;
    const stage = Math.min(Math.floor(g), BODIES.length - 2);
    const k = g - stage;
    const b = this.body;
    for (let i = 0; i < FIELDS.length; i++) b[FIELDS[i]] = lerp(BODIES[stage][FIELDS[i]], BODIES[stage + 1][FIELDS[i]], k);
    const phase = progress * STRIDES * Math.PI * 2;
    const off = smoothstep(0, 0.45, state.handover);
    const sit = smoothstep(0.55, 1, state.handover);

    // Off the bike he steps to its left, where the Golf's driver will sit.
    this.root.position.set(0, 0, SEAT[2] * off);
    this.root.scale.setScalar(b.scale);
    this.posed(stage, phase, this.from);
    this.posed(stage + 1, phase, this.to);
    const pose = this.pose.mix(this.from, this.to, k);
    if (off > 0) pose.mix(pose, walk(b, phase, 0, this.to), off);
    if (sit > 0) pose.mix(pose, this.seated(b, this.to), sit);
    this.apply(pose, time);

    // The bike grows in under him as he takes to it, and lies down and goes once he is off it.
    const gone = smoothstep(0.25, 0.6, state.handover);
    this.bike.scale.setScalar(Math.max(Math.max(g - 2, 0) * (1 - gone), 0.001));
    this.bike.rotation.x = gone * 0.9;
    this.crank.rotation.z = -phase;
    for (const wheel of this.wheels) wheel.rotation.z = -phase * GEAR;
  }

  private posed(stage: number, phase: number, out: Pose): Pose {
    const b = this.body;
    if (stage === 0) return crawl(b, phase, out);
    if (stage === 1) return walk(b, phase, 1, out);
    if (stage === 2) return run(b, phase, out);
    return this.cycling(b, phase, out);
  }

  /** In the saddle, feet on the pedals and hands on the bar: reached for from the body's own space. */
  private cycling(b: Body, phase: number, out: Pose): Pose {
    const s = b.scale;
    const z = this.root.position;
    out.x = (SADDLE[0] - z.x) / s;
    out.y = (SADDLE[1] + 0.04) / s;
    out.lean = 0.72;
    out.head = -0.15;
    const shoulder = b.torso - b.limb * 0.6;
    const sx = out.x + Math.sin(out.lean) * shoulder;
    const sy = out.y + Math.cos(out.lean) * shoulder;
    for (let i = 0; i < 2; i++) {
      // Left (i = 0) pedal half a turn from the right, which the crank carries at -phase.
      const a = -phase + (i === 0 ? Math.PI : 0);
      const px = (CRANK_AT[0] + CRANK * Math.cos(a) - z.x) / s;
      const py = (CRANK_AT[1] + CRANK * Math.sin(a) + 0.03) / s + b.limb * 0.8;
      reach(out.x, out.y, px, py, b.thigh, b.shin, 1, out.thigh, out.shin, i);
      out.ankle[i] = -out.shin[i];
      reach(sx, sy, (BAR[0] - z.x) / s, BAR[1] / s, b.upperArm, b.foreArm, -1, out.upper, out.fore, i);
    }
    return out;
  }

  /** Settling low into where the Golf's driver sits, feet on the ground and hands out to a wheel not there yet. */
  private seated(b: Body, out: Pose): Pose {
    out.x = (SEAT[0] - this.root.position.x) / b.scale;
    out.y = SEAT[1] / b.scale;
    out.lean = -0.1;
    out.head = 0;
    for (let i = 0; i < 2; i++) {
      reach(out.x, out.y, out.x + b.thigh * 0.8, b.limb * 0.8, b.thigh, b.shin, 1, out.thigh, out.shin, i);
      out.ankle[i] = -out.shin[i];
      out.upper[i] = 0.55;
      out.fore[i] = 1.35;
    }
    return out;
  }

  /** Poses every bone from `pose` and the body's proportions; `time` only breathes and turns the head. */
  private apply(pose: Pose, time: number): void {
    const b = this.body;
    this.hips.position.set(pose.x, pose.y, 0);
    this.pelvis.scale.set(b.chest * 0.9, b.limb * 1.5, b.hips + b.limb);
    this.torso.joint.rotation.z = -pose.lean;
    this.torso.segment.scale.set(b.chest, b.torso * (1 + 0.015 * Math.sin(time * 2.3)), b.shoulders);
    this.neck.joint.position.y = b.torso + 0.02;
    this.neck.joint.rotation.set(0, 0.25 * Math.sin(time * 0.6), pose.head + pose.lean);
    this.neck.segment.scale.setScalar(b.head);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const [upper, fore] = this.arms[i];
      upper.joint.position.set(0, b.torso - b.limb * 0.6, side * (b.shoulders / 2 + b.limb * 0.35));
      upper.joint.rotation.z = pose.upper[i] + pose.lean;
      upper.segment.scale.set(b.limb, b.upperArm, b.limb);
      fore.joint.position.y = -b.upperArm;
      fore.joint.rotation.z = pose.fore[i] - pose.upper[i];
      fore.segment.scale.set(b.limb * 0.85, b.foreArm, b.limb * 0.85);
      const [thigh, shin, foot] = this.legs[i];
      thigh.joint.position.set(0, 0, (side * b.hips) / 2);
      thigh.joint.rotation.z = pose.thigh[i];
      thigh.segment.scale.set(b.limb * 1.2, b.thigh, b.limb * 1.2);
      shin.joint.position.y = -b.thigh;
      shin.joint.rotation.z = pose.shin[i] - pose.thigh[i];
      shin.segment.scale.set(b.limb, b.shin, b.limb);
      foot.joint.position.y = -b.shin;
      foot.joint.rotation.z = pose.ankle[i];
      foot.segment.scale.set(b.foot, b.limb * 0.8, b.limb * 1.1);
    }
  }

  private bone(parent: THREE.Object3D | null): THREE.Bone {
    const bone = new THREE.Bone();
    parent?.add(bone);
    this.bones.push(bone);
    return bone;
  }
}

/** Shared by every part: colour is per vertex, so the whole figure is one material and one draw call. */
const MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });

/** On hands and knees, diagonal limbs together; the torso tilts so straight arms reach the ground. */
function crawl(b: Body, phase: number, out: Pose): Pose {
  out.x = 0;
  out.y = b.thigh + b.limb / 2;
  const shoulder = b.torso - b.limb * 0.6;
  out.lean = Math.acos(clamp((b.upperArm + b.foreArm + b.limb / 2 - out.y) / shoulder, -1, 1));
  out.head = -0.25;
  for (let i = 0; i < 2; i++) {
    const p = phase + i * Math.PI;
    out.thigh[i] = 0.3 * Math.sin(p);
    out.shin[i] = -Math.PI / 2 + 0.3 * Math.max(0, Math.cos(p));
    out.ankle[i] = -1.3;
    out.upper[i] = 0.35 * Math.sin(p + Math.PI);
    out.fore[i] = out.upper[i] + 0.35 * Math.max(0, Math.cos(p + Math.PI));
  }
  return out;
}

/** Walking, arms swinging against the legs; at `amp` 0 he stands still. */
function walk(b: Body, phase: number, amp: number, out: Pose): Pose {
  out.x = 0;
  out.y = (b.thigh + b.shin) * (1 - 0.04 * amp * Math.sin(phase) ** 2) + b.limb * 0.8;
  out.lean = 0.05 * amp;
  out.head = 0;
  for (let i = 0; i < 2; i++) {
    const p = phase + i * Math.PI;
    out.thigh[i] = 0.45 * amp * Math.sin(p);
    out.shin[i] = out.thigh[i] - amp * (0.08 + 0.9 * Math.max(0, Math.cos(p)) ** 2);
    out.ankle[i] = -out.shin[i] * 0.85;
    out.upper[i] = -0.45 * amp * Math.sin(p);
    out.fore[i] = out.upper[i] + 0.15 + 0.25 * amp;
  }
  return out;
}

/** Running: leaning in, knees high, heels kicking up behind, elbows bent. */
function run(b: Body, phase: number, out: Pose): Pose {
  out.x = 0;
  out.y = (b.thigh + b.shin) * (0.91 + 0.05 * Math.sin(phase) ** 2) + b.limb * 0.8;
  out.lean = 0.25;
  out.head = -0.1;
  for (let i = 0; i < 2; i++) {
    const p = phase + i * Math.PI;
    out.thigh[i] = 0.25 + 0.65 * Math.sin(p);
    out.shin[i] = out.thigh[i] - (0.3 + 1.6 * Math.max(0, Math.cos(p)));
    out.ankle[i] = -out.shin[i] * 0.6;
    out.upper[i] = 0.1 - 0.75 * Math.sin(p);
    out.fore[i] = out.upper[i] + 1.6;
  }
  return out;
}

/**
 * Two-bone reach in the side plane from (x0, y0) toward (x1, y1): writes the world angles of both bones into
 * upper[i] and lower[i]. `bend` 1 bends the joint forward (knees), -1 down and back (elbows).
 */
function reach(x0: number, y0: number, x1: number, y1: number, l1: number, l2: number, bend: number, upper: number[], lower: number[], i: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const d = Math.max(Math.min(Math.hypot(dx, dy), (l1 + l2) * 0.999), Math.abs(l1 - l2) + 1e-3);
  const aim = Math.atan2(dx, -dy);
  upper[i] = aim + bend * Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  lower[i] = aim - bend * Math.acos(clamp((l2 * l2 + d * d - l1 * l1) / (2 * l2 * d), -1, 1));
}

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** A bar from (ax, ay) to (bx, by) in the side plane, at depth z. */
function tube(ax: number, ay: number, bx: number, by: number, z = 0, r = 0.03): THREE.BufferGeometry {
  return new THREE.BoxGeometry(Math.hypot(bx - ax, by - ay), r, r)
    .rotateZ(Math.atan2(by - ay, bx - ax))
    .translate((ax + bx) / 2, (ay + by) / 2, z);
}

/** A part bound rigidly to one bone, in one colour. */
function rigid(geometry: THREE.BufferGeometry, bone: number, colour: string): THREE.BufferGeometry {
  const part = geometry.index ? geometry.toNonIndexed() : geometry;
  if (part !== geometry) geometry.dispose();
  const n = part.getAttribute('position').count;
  const { r, g, b } = new THREE.Color(colour);
  const colours = new Float32Array(n * 3);
  const index = new Uint16Array(n * 4);
  const weight = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    colours.set([r, g, b], v * 3);
    index[v * 4] = bone;
    weight[v * 4] = 1;
  }
  part.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  part.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
  part.setAttribute('skinWeight', new THREE.BufferAttribute(weight, 4));
  return part;
}
