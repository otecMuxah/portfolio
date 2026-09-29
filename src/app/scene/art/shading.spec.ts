import * as THREE from 'three';
import { box, merge, paint, place } from './details';
import { haloMap } from './kit';
import { bakeAO, contactShadow, contactShadows } from './shading';

/** Brightness (sum of rgb) of the vertex nearest `at` among those on faces turned toward `normal`. */
function brightness(g: THREE.BufferGeometry, at: THREE.Vector3, normal: THREE.Vector3): number {
  const pos = g.getAttribute('position');
  const col = g.getAttribute('color');
  let best = Infinity;
  let out = NaN;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const t = new THREE.Triangle();
  for (let i = 0; i < pos.count; i++) {
    const f = i - (i % 3);
    t.setFromAttributeAndIndices(pos, f, f + 1, f + 2).getNormal(n);
    if (n.dot(normal) < 0.99) continue;
    const d = p.fromBufferAttribute(pos, i).distanceTo(at);
    if (d < best) {
      best = d;
      out = col.getX(i) + col.getY(i) + col.getZ(i);
    }
  }
  return out;
}

const Z = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

describe('bakeAO', () => {
  beforeAll(() => {
    const ctx = { createRadialGradient: () => ({ addColorStop: () => undefined }), fillRect: () => undefined };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
  });

  it('darkens a wall toward its foot and leaves its top and roof as painted', () => {
    const plain = box(2, 4, 2, 'chalk');
    const baked = bakeAO(box(2, 4, 2, 'chalk'), { corner: 0 });
    const foot = new THREE.Vector3(1, 0, 1);
    const top = new THREE.Vector3(1, 4, 1);
    expect(brightness(baked, foot, Z)).toBeLessThan(brightness(plain, foot, Z) * 0.8);
    expect(brightness(baked, top, Z)).toBeCloseTo(brightness(plain, top, Z), 5);
    expect(brightness(baked, top, UP)).toBeCloseTo(brightness(plain, top, UP), 5);
  });

  it('darkens faces turned down', () => {
    const plain = box(2, 1, 2, 'chalk');
    plain.translate(0, 3, 0);
    const baked = bakeAO(plain.clone(), { corner: 0 });
    const under = new THREE.Vector3(0, 3, 0);
    const down = new THREE.Vector3(0, -1, 0);
    expect(brightness(baked, under, down)).toBeLessThan(brightness(plain, under, down));
  });

  it('darkens an inner corner but not an outer one', () => {
    // An L: a wall standing on a slab, the slab's top meeting the wall's front in an inner corner.
    const build = () => merge([paint(new THREE.BoxGeometry(4, 0.2, 4).translate(0, 5, 0), 'chalk'), place(box(4, 2, 0.2, 'chalk'), 0, 5.1, -1.9)]);
    const plain = build();
    const baked = bakeAO(build(), { base: 0, under: 0 });
    // The slab's top just in front of the wall: an inner corner.
    const inner = new THREE.Vector3(0, 5.1, -1.8);
    expect(brightness(baked, inner, UP)).toBeLessThan(brightness(plain, inner, UP));
    // The top of the wall is only near outer edges.
    const outer = new THREE.Vector3(2, 7.1, -1.8);
    expect(brightness(baked, outer, UP)).toBeCloseTo(brightness(plain, outer, UP), 5);
  });

  it('takes occluders into account without shading them, and is deterministic', () => {
    const ground = paint(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2).translate(0, 5, 0), 'meadow');
    const groundBefore = Array.from(ground.getAttribute('color').array);
    const alone = bakeAO(place(box(1, 1, 1, 'chalk'), 0, 5, 0), { base: 0, under: 0 });
    const onGround = bakeAO(place(box(1, 1, 1, 'chalk'), 0, 5, 0), { base: 0, under: 0, occluders: [ground] });
    const foot = new THREE.Vector3(0.5, 5, 0.5);
    expect(brightness(onGround, foot, Z)).toBeLessThan(brightness(alone, foot, Z));
    expect(Array.from(ground.getAttribute('color').array)).toEqual(groundBefore);
    const again = bakeAO(place(box(1, 1, 1, 'chalk'), 0, 5, 0), { base: 0, under: 0, occluders: [ground] });
    expect(Array.from(again.getAttribute('color').array)).toEqual(Array.from(onGround.getAttribute('color').array));
  });

  it('refuses geometry it cannot paint', () => {
    expect(() => bakeAO(new THREE.BoxGeometry())).toThrow(/colour/);
  });

  it('lays contact shadows as one soft, transparent detail mesh on the halo', () => {
    const one = contactShadow(2, 3);
    expect(one.userData['detail']).toBe(true);
    expect(one.material.map).toBe(haloMap());
    expect(one.material.transparent).toBe(true);
    expect(one.material.depthWrite).toBe(false);
    const many = contactShadows([
      { x: 0, z: 0, w: 2, d: 2 },
      { x: 3, z: 1, w: 1, d: 1 },
    ]);
    expect(many.geometry.getAttribute('position').count).toBe(one.geometry.getAttribute('position').count * 2);
  });
});
