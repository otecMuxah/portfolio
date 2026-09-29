import * as THREE from 'three';
import { CHAPTERS } from '../content/life';
import { buildCar } from './cars';
import { chapterAnchor } from './chapter-scene';
import { build, stubCanvas } from './chapters/scene-contract';
import { PHONE_MAX_EDGE, SHAKE_STOP, SHATTERED, Shatter, ShardPose, shakeAt, shardPose, tumbleAxis } from './shatter';

/** Everything built before the war, posed as it stands once built, plus the F30 on the road: what the engine breaks. */
function world(): THREE.Object3D[] {
  const sources: THREE.Object3D[] = CHAPTERS.flatMap((chapter, index) => {
    if (chapter.phase !== 'build') return [];
    const scene = build(chapter.id);
    scene.update?.({ progress: 0, local: 1.2, time: 3 });
    scene.object.position.copy(chapterAnchor(index));
    return [scene.object];
  });
  const car = buildCar('f30');
  car.position.set(-6, 0, -398);
  return [...sources, car];
}

/** Where a shard vertex is at war-local `t`: the vertex shader's maths, run on the CPU. */
function vertexAt(geometry: THREE.BufferGeometry, i: number, t: number, out: THREE.Vector3): THREE.Vector3 {
  const centre = geometry.getAttribute('shardCentre');
  const drift = geometry.getAttribute('shardDrift');
  const pose = shardPose(t, centre.getW(i), drift.getW(i), {} as ShardPose);
  const c = new THREE.Vector3().fromBufferAttribute(centre as THREE.BufferAttribute, i);
  const d = new THREE.Vector3().fromBufferAttribute(drift as THREE.BufferAttribute, i);
  const axis = tumbleAxis(d, new THREE.Vector3());
  return out
    .fromBufferAttribute(geometry.getAttribute('position') as THREE.BufferAttribute, i)
    .sub(c)
    .applyAxisAngle(axis, pose.angle)
    .multiplyScalar(pose.scale)
    .add(c)
    .addScaledVector(d, pose.shift);
}

/** A sample of shard vertices across every batch, posed at `t`, rounded to a millimetre. */
function poses(shatter: Shatter, t: number): number[] {
  shatter.update(t);
  const out: number[] = [];
  const v = new THREE.Vector3();
  shatter.object.traverse((o) => {
    if (!(o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.LineSegments)) return;
    if (!o.geometry.getAttribute('shardCentre')) return;
    const count = o.geometry.getAttribute('position').count;
    for (let i = 0; i < count; i += Math.max(1, Math.floor(count / 50))) {
      vertexAt(o.geometry, i, t, v);
      out.push(...v.toArray().map((x) => Math.round(x * 1000)));
    }
  });
  return out;
}

describe('the shatter', () => {
  beforeAll(stubCanvas);
  let shatter: Shatter;
  let sources: THREE.Object3D[];
  beforeAll(() => {
    sources = world();
    shatter = new Shatter(sources);
  });

  it('stays within budget while it flies: triangles, draw calls and particles for the whole broken world', () => {
    const { triangles, drawCalls, particles, shards } = shatter.stats;
    // 45k until #64 gave the pre-war career cards the CV's full stack (about 200 more).
    expect(triangles).toBeLessThanOrEqual(46_000);
    expect(drawCalls).toBeLessThanOrEqual(70);
    expect(particles).toBeLessThanOrEqual(3_000);
    expect(shards).toBeGreaterThan(1_000);
  });

  it('breaks coarser on a phone: the same world in fewer triangles', () => {
    const phone = new Shatter(world(), 2402, PHONE_MAX_EDGE).stats;
    // About 45.2k on a desktop, 18.7k on a phone.
    expect(phone.triangles).toBeLessThanOrEqual(20_000);
    expect(phone.drawCalls).toBe(shatter.stats.drawCalls);
  });

  it('starts as the world it copies: at rest every shard sits where the built world is', () => {
    const solid = (o: THREE.Object3D) => {
      const m = (o as THREE.Mesh).material as THREE.Material & { map?: THREE.Texture | null };
      return o instanceof THREE.Mesh && !m.map;
    };
    // Every vertex, instances included: Box3.expandByObject only bounds an InstancedMesh loosely.
    const built = new THREE.Box3();
    const p = new THREE.Vector3();
    const m = new THREE.Matrix4();
    for (const s of sources) {
      s.updateMatrixWorld(true);
      s.traverseVisible((o) => {
        if (!solid(o)) return;
        const mesh = o as THREE.Mesh;
        const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const count = o instanceof THREE.InstancedMesh ? o.count : 1;
        for (let k = 0; k < count; k++) {
          m.copy(mesh.matrixWorld);
          if (o instanceof THREE.InstancedMesh) m.multiply(o.getMatrixAt(k, new THREE.Matrix4()));
          for (let i = 0; i < pos.count; i++) built.expandByPoint(p.fromBufferAttribute(pos, i).applyMatrix4(m));
        }
      });
    }
    const rest = new THREE.Box3();
    const v = new THREE.Vector3();
    shatter.object.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !o.geometry.getAttribute('shardCentre')) return;
      for (let i = 0; i < o.geometry.getAttribute('position').count; i++) rest.expandByPoint(vertexAt(o.geometry, i, 0, v));
    });
    expect(rest.min.distanceTo(built.min)).toBeLessThan(1e-3);
    expect(rest.max.distanceTo(built.max)).toBeLessThan(1e-3);
  });

  it('gives the same shard poses for the same progress, scrolling forward or back', () => {
    const steps = Array.from({ length: 21 }, (_, i) => i / 20);
    const forward = steps.map((t) => poses(shatter, t));
    const back = [...steps].reverse().map((t) => poses(shatter, t)).reverse();
    expect(back).toEqual(forward);
    // And it really moves: the middle of the war is not the start.
    expect(forward[10]).not.toEqual(forward[0]);
  });

  it('shows nothing before the war or once its shards are gone', () => {
    expect(shatter.update(-0.5)).toBe(0);
    expect(shatter.object.visible).toBe(false);
    expect(shatter.update(0.3)).toBe(0.3);
    expect(shatter.object.visible).toBe(true);
    shatter.update(SHATTERED);
    expect(shatter.object.visible).toBe(false);
    const pose = {} as ShardPose;
    for (const delay of [0.06, 0.2, 0.4]) expect(shardPose(SHATTERED, delay, 5, pose).scale).toBe(0);
  });

  it('puts every light out early and back exactly on the way back', () => {
    const opacities = () => {
      const out: number[] = [];
      shatter.object.children.forEach((o) => {
        if (o instanceof THREE.Sprite || (o instanceof THREE.Mesh && !o.geometry.getAttribute('shardCentre'))) {
          out.push((o.material as THREE.Material).opacity);
        }
      });
      return out;
    };
    shatter.update(0.001);
    const lit = opacities();
    expect(lit.length).toBeGreaterThan(0);
    shatter.update(0.3);
    expect(opacities().every((o) => o === 0)).toBe(true);
    shatter.update(0.001);
    expect(opacities()).toEqual(lit);
  });

  it('allocates nothing per frame: updates only rewrite a uniform, visibility and opacities', () => {
    const snapshot = () =>
      shatter.object.children.map((o) => {
        const g = (o as THREE.Mesh).geometry;
        return [o, (o as THREE.Mesh).material, g, g?.getAttribute('position'), (g?.getAttribute('position') as THREE.BufferAttribute | undefined)?.version];
      });
    const before = snapshot();
    for (let i = 0; i < 500; i++) shatter.update(Math.sin(i) * 0.7 + 0.3);
    expect(snapshot()).toEqual(before);
  });

  it('breaks inside its shader: every shard material is patched at the three.js chunks it relies on', () => {
    shatter.object.traverse((o) => {
      if (!(o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.LineSegments)) return;
      if (!o.geometry.getAttribute('shardCentre')) return;
      const material = o.material as THREE.Material;
      const kind = o instanceof THREE.Points ? 'points' : material instanceof THREE.MeshStandardMaterial ? 'physical' : 'basic';
      const lib = THREE.ShaderLib[kind];
      const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader };
      material.onBeforeCompile(shader as never, undefined as never);
      expect(shader.vertexShader).toMatch(/#include <begin_vertex>\s+shardPose\(\);/);
      expect(shader.fragmentShader).toContain('gradeLuma');
      if (o instanceof THREE.Points) expect(shader.vertexShader).toContain('gl_PointSize *= shardScale');
      shatter.update(0.42);
      expect(shader.uniforms['uShatter'].value).toBe(0.42);
    });
  });
});

describe('shardPose', () => {
  it('is whole at rest, cracks before it flies, and is gone at the end of its flight', () => {
    const pose = {} as ShardPose;
    expect(shardPose(0, 0.2, 4, pose)).toEqual({ crack: 0, flight: 0, scale: 1, angle: 0, shift: 0 });
    shardPose(0.19, 0.2, 4, pose);
    expect(pose.crack).toBeGreaterThan(0.9);
    expect(pose.flight).toBe(0);
    expect(pose.scale).toBeLessThan(1);
    expect(shardPose(1, 0.2, 4, pose).scale).toBe(0);
  });
});

describe('shakeAt', () => {
  const out = new THREE.Vector3();
  const size = (local: number) => shakeAt(local, out) !== 0 || out.length() > 0;

  it('is still before the war and from the stop to its end', () => {
    for (const local of [-1, -0.01, 0, SHAKE_STOP, 0.7, 0.9, 1, 1.5]) {
      expect(Math.abs(shakeAt(local, out))).toBe(0);
      expect(out.length()).toBe(0);
    }
  });

  it('builds to a peak mid-chapter, then stops dead', () => {
    const peak = (from: number, to: number) => {
      let max = 0;
      for (let l = from; l < to; l += 0.001) {
        shakeAt(l, out);
        max = Math.max(max, out.length());
      }
      return max;
    };
    expect(size(0.3)).toBe(true);
    expect(peak(0.35, 0.55)).toBeGreaterThan(peak(0, 0.1) * 3);
    expect(peak(0.35, 0.55)).toBeLessThan(0.6);
    shakeAt(SHAKE_STOP - 0.005, out);
    expect(out.length()).toBeGreaterThan(0);
    shakeAt(SHAKE_STOP, out);
    expect(out.length()).toBe(0);
  });

  it('comes from progress alone: the same local shakes the same way, and it writes into the vector it is given', () => {
    const a = shakeAt(0.4321, out);
    const first = out.clone();
    shakeAt(0.1, out);
    expect(shakeAt(0.4321, out)).toBe(a);
    expect(out).toEqual(first);
  });
});
