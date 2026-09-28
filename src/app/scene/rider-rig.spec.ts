import * as THREE from 'three';
import { chapterSpans, riderAt } from '../journey/journey';
import { stats } from './chapters/scene-contract';
import { RiderRig } from './rider-rig';

const spans = chapterSpans();
const span = (id: string) => spans.find((s) => s.chapter.id === id)!;
const at = (id: string, local: number) => span(id).start + (span(id).end - span(id).start) * local;

const ROAD = new THREE.Vector3(12, 0, 2);
const AHEAD = new THREE.Vector3(0, 0, -1);

/** Poses the rig at `progress` and reads every bone's world matrix. */
function pose(rig: RiderRig, progress: number, time = 3): string[] {
  rig.update(riderAt(progress), progress, ROAD, AHEAD, time);
  rig.object.updateMatrixWorld(true);
  const mesh = rig.object.children[0] as THREE.SkinnedMesh;
  return mesh.skeleton.bones.map((b) => b.matrixWorld.elements.map((e) => e.toFixed(5)).join(','));
}

describe('RiderRig', () => {
  const stops = [0, at('birth', 1), at('school', 0.5), at('lyceum', 0.5), at('university', 0), at('university', 0.5), at('dreamweaver', 0.45)];

  it('is one skinned mesh of one shared material: a single draw call within a small triangle budget', () => {
    const rig = new RiderRig();
    const { drawCalls, triangles, lights } = stats(rig.object);
    expect(drawCalls).toBe(1);
    expect(triangles).toBeLessThanOrEqual(1500);
    expect(lights).toBe(0);
    expect(new RiderRig().object.children[0]).not.toBe(rig.object.children[0]);
    expect((new RiderRig().object.children[0] as THREE.Mesh).material).toBe((rig.object.children[0] as THREE.Mesh).material);
  });

  it('poses from scroll alone: the same progress gives the same pose, whichever way it was reached', () => {
    const rig = new RiderRig();
    const forward = stops.map((p) => pose(rig, p));
    const back = [...stops].reverse().map((p) => pose(rig, p)).reverse();
    expect(back).toEqual(forward);
    expect(pose(new RiderRig(), stops[3])).toEqual(forward[3]);
  });

  it('looks different at each stage', () => {
    const rig = new RiderRig();
    const shots = [at('birth', 0.5), at('school', 0.5), at('lyceum', 0.5), at('university', 0.5)].map((p) => pose(rig, p).join(';'));
    expect(new Set(shots).size).toBe(4);
  });

  it('is hidden once the Golf carries the camera', () => {
    const rig = new RiderRig();
    pose(rig, at('university', 0.5));
    expect(rig.object.visible).toBe(true);
    pose(rig, at('dreamweaver', 0.51));
    expect(rig.object.visible).toBe(false);
  });

  it('builds nothing while it poses: the same bones, geometry and matrices every frame', () => {
    const rig = new RiderRig();
    const mesh = rig.object.children[0] as THREE.SkinnedMesh;
    const geometry = mesh.geometry;
    const bones = [...mesh.skeleton.bones];
    const positions = bones.map((b) => b.position);
    let count = 0;
    rig.object.traverse(() => count++);
    for (let i = 0; i <= 200; i++) pose(rig, (i / 200) * at('dreamweaver', 0.49), i / 30);
    let after = 0;
    rig.object.traverse(() => after++);
    expect(after).toBe(count);
    expect(mesh.geometry).toBe(geometry);
    expect(mesh.skeleton.bones).toEqual(bones);
    mesh.skeleton.bones.forEach((b, i) => expect(b.position).toBe(positions[i]));
  });
});
