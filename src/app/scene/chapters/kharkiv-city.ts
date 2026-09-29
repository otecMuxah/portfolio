import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PaneRhythm, paneSlots } from '../art/details';
import { kharkivSkyline } from '../art/kharkiv';
import { lowPoly, seeded, smoothstep } from '../art/kit';
import { PaletteKey } from '../art/palette';

export type SkylineTints = Record<'derzhprom' | 'panel-blocks' | 'brick-blocks', PaletteKey>;

/** Kharkiv's skyline from #5, recoloured for a chapter, whose layers rise out of the ground one after another. */
export function risingSkyline(tints: SkylineTints) {
  const skyline = kharkivSkyline();
  const layers = skyline.children as THREE.Mesh[];
  for (const layer of layers) layer.material = lowPoly(tints[layer.name as keyof SkylineTints]);
  // Derzhprom first, then the blocks around it.
  const order = ['derzhprom', 'panel-blocks', 'brick-blocks'];
  return {
    skyline,
    /** `built` is enter(local): 0 = nothing standing, 1 = the whole city up. */
    rise(built: number): void {
      for (const layer of layers) {
        const delay = order.indexOf(layer.name) * 0.15;
        const k = smoothstep(delay, delay + 0.6, built);
        layer.visible = k > 0;
        // The footprint gathers in with the first of the rise, so a barely-started city is a
        // speck in the previous chapter's frame, not a full-width slab seen edge-on.
        const footprint = Math.max(smoothstep(0, 0.25, k), 1e-3);
        layer.scale.set(footprint, Math.max(k, 1e-3), footprint);
      }
    },
  };
}

const WINDOW: PaneRhythm = { w: 0.32, h: 0.45, dx: 0.8, dy: 1.05, bottom: 0.8, top: 0.3, start: 0.45, end: 0.3 };

/**
 * Window panes on the skyline's camera-facing walls (+z fronts and +x sides), as one merged
 * geometry for a glow mesh. `share` is the fraction lit; the pick is seeded.
 */
export function skylineWindows(
  skyline: THREE.Group,
  share: number,
  seed: number,
): THREE.BufferGeometry {
  const random = seeded(seed);
  const panes: THREE.BufferGeometry[] = [];
  const box = new THREE.Box3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (const layer of skyline.children as THREE.Mesh[]) {
    const pos = layer.geometry.getAttribute('position');
    // Merged boxes are non-indexed: every face is two consecutive triangles (six vertices).
    for (let i = 0; i < pos.count; i += 6) {
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1);
      c.fromBufferAttribute(pos, i + 2);
      normal.subVectors(c, b).cross(a.clone().sub(b)).normalize();
      const front = normal.z > 0.9;
      const side = normal.x > 0.9;
      if (!front && !side) continue;
      box.makeEmpty();
      for (let k = 0; k < 6; k++) box.expandByPoint(a.fromBufferAttribute(pos, i + k));
      const across: [number, number] = front ? [box.min.x, box.max.x] : [box.min.z, box.max.z];
      for (const [u, y] of paneSlots(across, [box.min.y, box.max.y], WINDOW, share, random)) {
        const pane = new THREE.PlaneGeometry(WINDOW.w, WINDOW.h);
        if (front) pane.translate(u + WINDOW.w / 2, y + WINDOW.h / 2, box.max.z + 0.03);
        else
          pane
            .rotateY(Math.PI / 2)
            .translate(box.max.x + 0.03, y + WINDOW.h / 2, u + WINDOW.w / 2);
        panes.push(pane);
      }
    }
  }
  const merged = mergeGeometries(panes);
  panes.forEach((p) => p.dispose());
  return merged;
}
