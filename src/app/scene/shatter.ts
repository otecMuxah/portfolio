import * as THREE from 'three';
import { seeded, smoothstep } from './art/kit';
import { graded } from './grade';

/** Share of the war's local progress each shard spends in flight. */
const FLIGHT = 0.38;
/** How far the cracks open before a chunk flies: the share of its size it loses. */
const GAP = 0.14;
/** How far along its flight path a chunk shifts as it cracks, before it flies. */
const NUDGE = 0.03;
/** Triangles with a longer edge (m) split first, so walls break into pieces rather than slabs. */
const MAX_EDGE = 1.4;
/** Phones split coarser: fewer, bigger pieces, fewer triangles to draw while the world flies (#16). */
export const PHONE_MAX_EDGE = 3;
/** Chunk size (m): triangles whose centres share a cell fly as one rigid piece. */
const CELL = 1.6;
/** Lights (halos, light pools) go out over this first share of the war, before anything breaks. */
const LIGHTS_OUT = 0.25;

/** A shard's pose at war-local progress `t`: the TypeScript twin of SHARD_GLSL, kept in step by hand. */
export interface ShardPose {
  /** 0..1: how far its cracks have opened. */
  crack: number;
  /** 0..1: eased share of its flight flown. */
  flight: number;
  /** Size relative to whole: shrinks a little as it cracks, then to nothing at the end of its flight. */
  scale: number;
  /** Radians turned about its tumble axis. */
  angle: number;
  /** Share of its drift vector it has moved: a nudge as it cracks, then its flight. */
  shift: number;
}

/** Pure: the same `t` always gives the same pose, whichever way the scroll reached it. */
export function shardPose(t: number, delay: number, spin: number, out: ShardPose): ShardPose {
  out.crack = smoothstep(0, delay, t);
  const f = Math.min(Math.max((t - delay) / FLIGHT, 0), 1);
  out.flight = 1 - (1 - f) * (1 - f) * (1 - f);
  out.scale = (1 - GAP * out.crack) * (1 - smoothstep(0.45, 1, f));
  out.angle = spin * out.flight;
  out.shift = NUDGE * out.crack + out.flight;
  return out;
}

const TUMBLE_REF = new THREE.Vector3(0.31, 0.93, 0.19);

/** The axis a shard tumbles about, across its drift: the twin of shardAxis in SHARD_GLSL. */
export function tumbleAxis(drift: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  out.crossVectors(drift, TUMBLE_REF).z += 1e-4;
  return out.normalize();
}

/** The latest a shard can finish: every shard is gone by then. */
export const SHATTERED = 0.06 + 0.22 + 0.12 + FLIGHT;

const SHARD_GLSL = /* glsl */ `
uniform float uShatter;
attribute vec4 shardCentre; // xyz: the chunk's centre (world); w: its delay
attribute vec4 shardDrift;  // xyz: where its flight takes it (m); w: how far it tumbles (rad)
float shardCrack;
float shardFlight;
float shardScale;
float shardAngle;
float shardShift;
vec3 shardAxis;
void shardPose() {
  shardCrack = smoothstep(0.0, shardCentre.w, uShatter);
  float f = clamp((uShatter - shardCentre.w) / ${FLIGHT.toFixed(4)}, 0.0, 1.0);
  shardFlight = 1.0 - (1.0 - f) * (1.0 - f) * (1.0 - f);
  shardScale = (1.0 - ${GAP.toFixed(4)} * shardCrack) * (1.0 - smoothstep(0.45, 1.0, f));
  shardAngle = shardDrift.w * shardFlight;
  shardShift = ${NUDGE.toFixed(4)} * shardCrack + shardFlight;
  shardAxis = normalize(cross(shardDrift.xyz, vec3(0.31, 0.93, 0.19)) + vec3(0.0, 0.0, 1e-4));
}
vec3 shardRotate(vec3 v) {
  float c = cos(shardAngle);
  float s = sin(shardAngle);
  return v * c + cross(shardAxis, v) * s + shardAxis * dot(shardAxis, v) * (1.0 - c);
}
`;

const SHARD_VERTEX = /* glsl */ `
  shardPose();
  transformed = shardCentre.xyz + shardRotate(transformed - shardCentre.xyz) * shardScale
    + shardDrift.xyz * shardShift;`;

/** Clones `source` into a material whose vertices fly as shards, driven by `progress`; graded like everything else. */
function shardMaterial(source: THREE.Material, progress: { value: number }): THREE.Material {
  const material = source.clone();
  const isPoints = material instanceof THREE.PointsMaterial;
  // Shards tumble; their back faces must show.
  if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
    material.side = THREE.DoubleSide;
  }
  material.onBeforeCompile = (shader) => {
    shader.uniforms['uShatter'] = progress;
    shader.vertexShader = (SHARD_GLSL + shader.vertexShader)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  shardPose();\n  objectNormal = shardRotate(objectNormal);')
      .replace('#include <begin_vertex>', `#include <begin_vertex>${SHARD_VERTEX}`);
    // A point is its own shard: it only shrinks.
    if (isPoints) shader.vertexShader = shader.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\n  gl_PointSize *= shardScale;');
  };
  material.customProgramCacheKey = () => (isPoints ? 'shard-points' : 'shard');
  graded(material);
  return material;
}

/** Vertex data of one batch: everything sharing one source material becomes one draw call. */
class Batch {
  readonly position: number[] = [];
  readonly normal: number[] = [];
  readonly color: number[] = [];
  readonly centre: number[] = [];
  readonly drift: number[] = [];
  colorSize = 0;
  constructor(readonly material: THREE.Material) {}

  geometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    if (this.normal.length) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normal, 3));
    if (this.colorSize) geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.color, this.colorSize));
    geometry.setAttribute('shardCentre', new THREE.Float32BufferAttribute(this.centre, 4));
    geometry.setAttribute('shardDrift', new THREE.Float32BufferAttribute(this.drift, 4));
    return geometry;
  }
}

/** One vertex while splitting: position, normal, colour. */
interface Corner {
  p: THREE.Vector3;
  n: THREE.Vector3;
  c: number[];
}

const lerpCorner = (a: Corner, b: Corner, k: number): Corner => ({
  p: a.p.clone().lerp(b.p, k),
  n: a.n.clone().lerp(b.n, k).normalize(),
  c: a.c.map((v, i) => v + (b.c[i] - v) * k),
});

/** Splits a triangle along its longest edge at a seeded point until no edge is longer than `maxEdge`. */
function split(tri: Corner[], random: () => number, out: Corner[][], maxEdge: number, depth = 0): void {
  const edges = [0, 1, 2].map((i) => tri[i].p.distanceTo(tri[(i + 1) % 3].p));
  const longest = edges.indexOf(Math.max(...edges));
  if (edges[longest] <= maxEdge || depth > 7) {
    out.push(tri);
    return;
  }
  const [a, b, c] = [tri[longest], tri[(longest + 1) % 3], tri[(longest + 2) % 3]];
  const m = lerpCorner(a, b, 0.35 + random() * 0.3);
  split([a, m, c], random, out, maxEdge, depth + 1);
  split([m, b, c], random, out, maxEdge, depth + 1);
}

/** Budget readout: what the shattered world costs while it flies. */
export interface ShatterStats {
  triangles: number;
  /** Rigid pieces (chunks, line segments, points) flying independently. */
  shards: number;
  particles: number;
  drawCalls: number;
}

/**
 * The war breaking the world (#9). Built once, after every build-phase chapter exists: each source's visible meshes
 * are copied in world space, split into chunks and baked into one geometry per material, with each chunk's centre,
 * delay, flight and tumble as vertex attributes. From then on the pose of every shard is computed on the GPU from a
 * single uniform, the war's local progress, so a frame costs one uniform write and scrolling back un-breaks exactly.
 * Lights (halos, light pools, embers) don't break; they go out first.
 */
export class Shatter {
  readonly object = new THREE.Group();
  readonly stats: ShatterStats = { triangles: 0, shards: 0, particles: 0, drawCalls: 0 };
  private readonly progress = { value: 0 };
  private readonly lights: { material: THREE.Material; opacity: number }[] = [];

  /**
   * `sources` must be posed as they should break; each flies apart from its own origin. No triangle edge longer than
   * `maxEdge` (m) is left unsplit.
   */
  constructor(
    sources: THREE.Object3D[],
    seed = 2402,
    private readonly maxEdge = MAX_EDGE,
  ) {
    this.object.name = 'shatter';
    const solids = new Map<THREE.Material, Batch>();
    const points = new Map<THREE.Material, Batch>();
    const lines = new Map<THREE.Material, Batch>();
    const batch = (map: Map<THREE.Material, Batch>, material: THREE.Material) => {
      let b = map.get(material);
      if (!b) map.set(material, (b = new Batch(material)));
      return b;
    };

    sources.forEach((source, s) => {
      const random = seeded(seed + s * 7919);
      source.updateMatrixWorld(true);
      const origin = new THREE.Vector3().setFromMatrixPosition(source.matrixWorld);
      // The blast comes from above and behind each scene, so its cracks spread from there.
      const epicentre = origin.clone().add(new THREE.Vector3(0, 10, -4));
      /** Seeded flight for a chunk centred at `centre`; appends its attributes `count` times. */
      const shard = (b: Batch, centre: THREE.Vector3, count: number) => {
        const delay = 0.06 + 0.22 * Math.min(centre.distanceTo(epicentre) / 16, 1) + 0.12 * random();
        const out = centre.clone().sub(origin).setY(0);
        if (out.lengthSq() < 0.01) out.set(random() - 0.5, 0, random() - 0.5);
        out.normalize().add(new THREE.Vector3(random() - 0.5, 0, random() - 0.5)).normalize();
        out.multiplyScalar(4 + 10 * random());
        // The camera watches from the front right; keep the debris out of its lens.
        if (out.x > 0) out.x *= 0.35;
        if (out.z > 0) out.z *= 0.35;
        out.y = 3 + 9 * random();
        const spin = (2 + 5 * random()) * (random() < 0.5 ? -1 : 1);
        for (let i = 0; i < count; i++) {
          b.centre.push(centre.x, centre.y, centre.z, delay);
          b.drift.push(out.x, out.y, out.z, spin);
        }
        this.stats.shards++;
      };

      const visible: THREE.Object3D[] = [];
      source.traverseVisible((obj) => visible.push(obj));
      for (const obj of visible) {
        if (obj instanceof THREE.Sprite) {
          this.addLight(new THREE.Sprite(obj.material.clone()), obj);
        } else if (obj instanceof THREE.Mesh) {
          const material = obj.material as THREE.Material;
          if ('map' in material && material.map) {
            this.addLight(new THREE.Mesh(obj.geometry, material.clone()), obj);
            continue;
          }
          const b = batch(solids, material);
          const colorAttr = (material as THREE.MeshStandardMaterial).vertexColors
            ? (obj.geometry.getAttribute('color') as THREE.BufferAttribute | undefined)
            : undefined;
          b.colorSize = colorAttr?.itemSize ?? 0;
          if (obj instanceof THREE.InstancedMesh) {
            const instance = new THREE.Matrix4();
            for (let k = 0; k < obj.count; k++) {
              obj.getMatrixAt(k, instance);
              this.addMesh(obj.geometry, obj.matrixWorld.clone().multiply(instance), colorAttr, b, random, shard);
            }
          } else this.addMesh(obj.geometry, obj.matrixWorld, colorAttr, b, random, shard);
        } else if (obj instanceof THREE.Points) {
          const pos = obj.geometry.getAttribute('position');
          // Points that move on their own (embers) would jump to a frozen copy as the war starts: they stay live, on
          // their own geometry, and go out with the lights.
          if ((pos as THREE.BufferAttribute).usage === THREE.DynamicDrawUsage) {
            this.addLight(new THREE.Points(obj.geometry, (obj.material as THREE.Material).clone()), obj);
            continue;
          }
          const b = batch(points, obj.material as THREE.Material);
          const colorAttr = (obj.material as THREE.PointsMaterial).vertexColors ? obj.geometry.getAttribute('color') : undefined;
          b.colorSize = colorAttr?.itemSize ?? 0;
          const p = new THREE.Vector3();
          for (let i = 0; i < pos.count; i++) {
            p.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
            b.position.push(p.x, p.y, p.z);
            for (let k = 0; k < b.colorSize; k++) b.color.push(colorAttr!.getComponent(i, k));
            shard(b, p, 1);
            this.stats.particles++;
          }
        } else if (obj instanceof THREE.Line) {
          const b = batch(lines, obj.material as THREE.Material);
          const pos = obj.geometry.getAttribute('position');
          const step = obj instanceof THREE.LineSegments ? 2 : 1;
          const a = new THREE.Vector3();
          const c = new THREE.Vector3();
          for (let i = 0; i + 1 < pos.count; i += step) {
            a.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
            c.fromBufferAttribute(pos, i + 1).applyMatrix4(obj.matrixWorld);
            b.position.push(a.x, a.y, a.z, c.x, c.y, c.z);
            shard(b, a.clone().add(c).multiplyScalar(0.5), 2);
          }
        }
      }
    });

    for (const b of solids.values()) {
      const mesh = new THREE.Mesh(b.geometry(), shardMaterial(b.material, this.progress));
      this.stats.triangles += b.position.length / 9;
      this.addBatch(mesh);
    }
    for (const b of points.values()) this.addBatch(new THREE.Points(b.geometry(), shardMaterial(b.material, this.progress)));
    for (const b of lines.values()) this.addBatch(new THREE.LineSegments(b.geometry(), shardMaterial(b.material, this.progress)));
  }

  /**
   * Poses the world for the war's local progress: before it (<= 0) nothing shows here, the originals do; at 1 every
   * shard has flown and shrunk away. Allocation-free. Returns the progress used, clamped to 0..1.
   */
  update(local: number): number {
    const t = Math.min(Math.max(local, 0), 1);
    this.progress.value = t;
    this.object.visible = t > 0 && t < SHATTERED;
    const out = 1 - smoothstep(0, LIGHTS_OUT, t);
    for (const light of this.lights) light.material.opacity = light.opacity * out;
    return t;
  }

  private addBatch(object: THREE.Mesh | THREE.Points | THREE.LineSegments): void {
    // Bounds would be those of the unbroken world; the shards fly well outside them.
    object.frustumCulled = false;
    this.object.add(object);
    this.stats.drawCalls++;
  }

  private addLight(copy: THREE.Sprite | THREE.Mesh | THREE.Points, of: THREE.Object3D): void {
    const material = copy.material as THREE.Material;
    graded(material);
    copy.matrixAutoUpdate = false;
    copy.matrix.copy(of.matrixWorld);
    copy.renderOrder = of.renderOrder;
    this.lights.push({ material, opacity: material.opacity });
    this.object.add(copy);
    this.stats.drawCalls++;
    if (copy instanceof THREE.Mesh) this.stats.triangles += (copy.geometry.index?.count ?? copy.geometry.getAttribute('position').count) / 3;
  }

  /** Splits a mesh's triangles (in world space) and groups them into chunks, appending them to `b`. */
  private addMesh(
    geometry: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    colorAttr: THREE.BufferAttribute | undefined,
    b: Batch,
    random: () => number,
    shard: (b: Batch, centre: THREE.Vector3, count: number) => void,
  ): void {
    const pos = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const index = geometry.index;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const corner = (i: number): Corner => {
      const v = index ? index.getX(i) : i;
      return {
        p: new THREE.Vector3().fromBufferAttribute(pos, v).applyMatrix4(matrix),
        n: normal ? new THREE.Vector3().fromBufferAttribute(normal, v).applyMatrix3(normalMatrix).normalize() : new THREE.Vector3(0, 1, 0),
        c: colorAttr ? Array.from({ length: colorAttr.itemSize }, (_, k) => colorAttr.getComponent(v, k)) : [],
      };
    };
    const count = index ? index.count : pos.count;
    const triangles: Corner[][] = [];
    for (let i = 0; i + 2 < count; i += 3) split([corner(i), corner(i + 1), corner(i + 2)], random, triangles, this.maxEdge);

    // Chunks: a seeded offset per mesh keeps the cell grid from lining up with every block edge.
    const jitter = new THREE.Vector3(random(), random(), random()).multiplyScalar(CELL);
    const chunks = new Map<string, Corner[][]>();
    for (const tri of triangles) {
      const c = tri[0].p.clone().add(tri[1].p).add(tri[2].p).divideScalar(3).add(jitter).divideScalar(CELL).floor();
      const key = `${c.x},${c.y},${c.z}`;
      const chunk = chunks.get(key);
      if (chunk) chunk.push(tri);
      else chunks.set(key, [tri]);
    }
    for (const chunk of chunks.values()) {
      const centre = new THREE.Vector3();
      for (const tri of chunk) for (const v of tri) centre.add(v.p);
      centre.divideScalar(chunk.length * 3);
      for (const tri of chunk)
        for (const v of tri) {
          b.position.push(v.p.x, v.p.y, v.p.z);
          b.normal.push(v.n.x, v.n.y, v.n.z);
          b.color.push(...v.c);
        }
      shard(b, centre, chunk.length * 3);
    }
  }
}

const NOISE = (() => {
  const random = seeded(2402);
  return Float32Array.from({ length: 256 }, () => random() * 2 - 1);
})();

/** Smooth seeded value noise in -1..1. */
function noise(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = NOISE[i & 255];
  return a + (NOISE[(i + 1) & 255] - a) * f * f * (3 - 2 * f);
}

/** The shake stops dead here; the rest of the war is still. */
export const SHAKE_STOP = 0.62;
/** Peak camera displacement, metres. */
const SHAKE = 0.35;

/**
 * Camera shake from the war's local progress, never from time: seeded noise of progress, building to a peak
 * mid-chapter and stopping dead at SHAKE_STOP. Writes the offset into `out` and returns a roll in radians.
 */
export function shakeAt(local: number, out: THREE.Vector3): number {
  const amplitude =
    local > 0 && local < SHAKE_STOP ? SHAKE * smoothstep(0.04, 0.4, local) * (1 - 0.35 * smoothstep(0.4, SHAKE_STOP, local)) : 0;
  const x = local * 90;
  out.set(noise(x), noise(x + 97.3) * 0.6, noise(x + 211.7)).multiplyScalar(amplitude);
  return noise(x + 53.1) * amplitude * 0.05;
}
