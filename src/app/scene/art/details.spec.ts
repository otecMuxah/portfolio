import * as THREE from 'three';
import {
  arch,
  asDetail,
  balcony,
  bench,
  bollard,
  box,
  busShelter,
  bush,
  canopy,
  chimney,
  cornice,
  detailMesh,
  door,
  fence,
  gable,
  gabledRoof,
  groundTile,
  litterBin,
  merge,
  paintedMaterial,
  paneSlots,
  parapet,
  pilasters,
  poplar,
  rock,
  row,
  steps,
  streetLamp,
  tower,
  tree,
  windowGrid,
} from './details';

const triangles = (g: THREE.BufferGeometry) => g.getAttribute('position').count / 3;
const positions = (g: THREE.BufferGeometry) => Array.from(g.getAttribute('position').array);

describe('detail kit', () => {
  it('paints every part: non-indexed, vertex-coloured, without uvs, all in one shared material', () => {
    const parts = [
      box(1, 1, 1, 'brick'),
      arch(1),
      door(1, 2, { double: true, glazed: true }),
      steps(1.5, 3, 0.4),
      canopy(2, 1, 2),
      cornice(4, 2),
      parapet(4, 2),
      pilasters([-1, 1], 3),
      balcony(2),
      balcony(2, { style: 'rail' }),
      chimney(0.5, 1, 0.5),
      gabledRoof(4, 1.5, 3),
      tower(1, 4, { roof: 'dome', band: 3 }),
      groundTile(5, 4),
      fence([[0, 0], [5, 0], [5, 5]], { gates: [{ at: 2.5, width: 1.2 }] }),
      streetLamp().body,
      bench(),
      tree('conifer', 1),
      tree('broadleaf', 1),
      tree('birch', 1),
      bush(1),
      rock(1),
      poplar(1),
      litterBin(),
      litterBin({ style: 'post' }),
      bollard(),
      busShelter(),
      busShelter(3, { style: 'glass' }),
    ];
    for (const g of parts) {
      expect(g.index).toBeNull();
      expect(g.getAttribute('color').count).toBe(g.getAttribute('position').count);
      expect(g.getAttribute('uv')).toBeUndefined();
      expect(triangles(g)).toBeGreaterThan(0);
    }
    expect(paintedMaterial()).toBe(paintedMaterial());
    expect(paintedMaterial().vertexColors).toBe(true);
  });

  it('merges parts into one geometry, and nothing into an empty one', () => {
    const merged = merge([box(1, 1, 1, 'brick'), box(1, 2, 1, 'chalk')]);
    expect(triangles(merged)).toBe(24);
    expect(merged.getAttribute('normal').count).toBe(merged.getAttribute('position').count);
    expect(triangles(merge([]))).toBe(0);
  });

  it('opens a box underneath when asked: one face, two triangles, fewer', () => {
    expect(triangles(box(1, 1, 1, 'brick'))).toBe(12);
    expect(triangles(box(1, 1, 1, 'brick', 1, true))).toBe(10);
    const pos = box(2, 3, 4, 'brick', 1, true).getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) {
      const a = [0, 1, 2].map((k) => pos.getY(i + k));
      expect(a.every((y) => y === 0)).toBe(false);
    }
  });

  it('keeps the lifted helpers as they were: gable and paneSlots', () => {
    const g = gable(2, 1, 3);
    g.computeBoundingBox();
    [-1, 0, -1.5].forEach((v, i) => expect(g.boundingBox!.min.getComponent(i)).toBeCloseTo(v, 6));
    [1, 1, 1.5].forEach((v, i) => expect(g.boundingBox!.max.getComponent(i)).toBeCloseTo(v, 6));
    const rhythm = { w: 0.32, h: 0.45, dx: 0.8, dy: 1.05, bottom: 0.8, top: 0.3, start: 0.45, end: 0.3 };
    const all = paneSlots([0, 4], [0, 5], rhythm);
    expect(all.length).toBe(4 * 4);
    expect(all[0]).toEqual([0.45, 0.8]);
    let i = 0;
    expect(paneSlots([0, 4], [0, 5], rhythm, 0.5, () => (i++ % 2 ? 0.9 : 0.1)).length).toBe(8);
  });

  it('spaces a row evenly about its centre', () => {
    expect(row(3, 2)).toEqual([-2, 0, 2]);
    expect(row(2, 1, 5)).toEqual([4.5, 5.5]);
  });

  describe('windowGrid', () => {
    const columns = row(6, 1);
    const rows = [0.5, 2, 3.5];

    it('puts a window in every slot, lit or dark, lit at about the share asked', () => {
      const grid = windowGrid({ columns, rows, width: 0.6, height: 0.8, lit: 0.5, seed: 4 });
      expect(grid.count).toBe(18);
      expect(grid.litCount).toBeGreaterThan(3);
      expect(grid.litCount).toBeLessThan(15);
      expect(triangles(grid.lit)).toBe(grid.litCount * 2);
      expect(windowGrid({ columns, rows, width: 0.6, height: 0.8, lit: 0 }).litCount).toBe(0);
      expect(windowGrid({ columns, rows, width: 0.6, height: 0.8, lit: 1 }).litCount).toBe(18);
    });

    it('is seeded: the same seed lights the same windows, another seed others', () => {
      const a = windowGrid({ columns, rows, width: 0.6, height: 0.8, seed: 4 });
      const b = windowGrid({ columns, rows, width: 0.6, height: 0.8, seed: 4 });
      const c = windowGrid({ columns, rows, width: 0.6, height: 0.8, seed: 5 });
      expect(positions(a.lit)).toEqual(positions(b.lit));
      expect(positions(a.frames)).toEqual(positions(b.frames));
      expect(positions(c.lit)).not.toEqual(positions(a.lit));
    });

    it('skips slots without reshuffling which of the others are lit', () => {
      const all = windowGrid({ columns, rows, width: 0.6, height: 0.8, lit: 1, seed: 9 });
      const some = windowGrid({ columns, rows, width: 0.6, height: 0.8, lit: 1, seed: 9, skip: (c, r) => c === 0 && r === 0 });
      expect(some.count).toBe(17);
      expect(some.litCount).toBe(17);
      const half = (skip?: (c: number, r: number) => boolean) =>
        windowGrid({ columns, rows, width: 0.6, height: 0.8, lit: 0.5, seed: 9, skip });
      // Skipping the last slot leaves every earlier pick as it was.
      const before = half();
      const after = half((c, r) => c === 5 && r === 2);
      expect(positions(after.lit)).toEqual(positions(before.lit).slice(0, positions(after.lit).length));
    });

    it('is cheaper bare, as phones build it: no frame bars, mullions or transoms', () => {
      const full = windowGrid({ columns, rows, width: 0.6, height: 0.8 });
      const bare = windowGrid({ columns, rows, width: 0.6, height: 0.8, frame: 0, mullions: 0, transom: false });
      expect(triangles(bare.frames) + triangles(bare.lit)).toBeLessThan((triangles(full.frames) + triangles(full.lit)) / 3);
    });

    it('arches the heads when asked', () => {
      const flat = windowGrid({ columns: [0], rows: [0], width: 1, height: 1.5 });
      const arched = windowGrid({ columns: [0], rows: [0], width: 1, height: 1.5, arched: true });
      flat.frames.computeBoundingBox();
      arched.frames.computeBoundingBox();
      expect(arched.frames.boundingBox!.max.y).toBeGreaterThan(flat.frames.boundingBox!.max.y);
    });
  });

  it('gives every seed its own tree, the same tree for the same seed, and fewer parts when low', () => {
    for (const kind of ['conifer', 'broadleaf', 'birch'] as const) {
      expect(positions(tree(kind, 3))).toEqual(positions(tree(kind, 3)));
      expect(positions(tree(kind, 3))).not.toEqual(positions(tree(kind, 4)));
      expect(triangles(tree(kind, 3, { low: true }))).toBeLessThan(triangles(tree(kind, 3)));
    }
    expect(positions(bush(2))).toEqual(positions(bush(2)));
    expect(positions(rock(2))).toEqual(positions(rock(2)));
    expect(positions(rock(2))).not.toEqual(positions(rock(3)));
    expect(positions(poplar(2))).toEqual(positions(poplar(2)));
    expect(positions(poplar(2))).not.toEqual(positions(poplar(3)));
    expect(triangles(poplar(2, { low: true }))).toBeLessThan(triangles(poplar(2)));
  });

  it('is cheaper as rails than as bars, and leaves a gap for a gate', () => {
    const path: [number, number][] = [[0, 0], [10, 0]];
    expect(triangles(fence(path, { style: 'rail' }))).toBeLessThan(triangles(fence(path, { style: 'bars' })));
    const shut = fence(path, { style: 'bars' });
    const gated = fence(path, { style: 'bars', gates: [{ at: 5, width: 2 }] });
    expect(triangles(gated)).not.toBe(triangles(shut));
  });

  it('tags detail meshes for the shatter to leave out', () => {
    const mesh = detailMesh([box(1, 1, 1, 'brick')]);
    expect(mesh.userData['detail']).toBe(true);
    expect(mesh.material).toBe(paintedMaterial());
    expect(asDetail(new THREE.Group()).userData['detail']).toBe(true);
  });
});
