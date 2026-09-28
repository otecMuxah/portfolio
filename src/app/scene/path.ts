import * as THREE from 'three';
import { ChapterSpan, spanAt } from '../journey/journey';

/** The camera travels a road beside the scenes, framing each subject from the front-right (a 3/4 view). */
export const CAMERA_OFFSET = new THREE.Vector3(18, 7, 16);
/**
 * Where the car rides relative to the point the camera frames (camera minus CAMERA_OFFSET): at a chapter's
 * midpoint that is the anchor, putting the car on the road outside the scene footprint (art-direction.md).
 */
export const CAR_OFFSET = new THREE.Vector3(12, 0, 2);
/**
 * In the war the camera parks just past back-home, so the world it built breaks in frame: it creeps this far (in
 * anchor units) and stops this share of the way into the chapter. The chapter after picks the road up from there.
 */
const WAR_PARK = 0.12;
const WAR_STOP = 0.3;
/** Reduced motion holds the war here: its world gone (SHATTERED, shatter.ts), the drive out not begun (DRIVE, escape.ts). */
const WAR_STILL = 0.81;

/** Where the camera is along the road (anchor units) at given progress points; linear between them. */
export function roadStops(spans: ChapterSpan[]): [progress: number, at: number][] {
  return spans.flatMap(({ chapter, index, start, end }): [number, number][] =>
    chapter.phase === 'shatter'
      ? [
          [start + WAR_STOP * (end - start), index - 1 + WAR_PARK],
          [end, index - 1 + WAR_PARK],
        ]
      : [[(start + end) / 2, index]],
  );
}

/**
 * The camera path's parameter at journey `progress`, for `count` chapters: the middle of each chapter's scroll span
 * puts the camera on that chapter's anchor, and the war parks it (roadStops). getPoint is uniform per segment, so
 * t = i / (count - 1) lands exactly on anchor i. Pure.
 */
export function pathT(stops: [number, number][], count: number, progress: number): number {
  let at = stops[stops.length - 1][1];
  if (progress <= stops[0][0]) at = stops[0][1];
  else
    for (let i = 1; i < stops.length; i++) {
      if (progress < stops[i][0]) {
        const k = (progress - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
        at = stops[i - 1][1] + (stops[i][1] - stops[i - 1][1]) * k;
        break;
      }
    }
  return Math.min(Math.max(at / (count - 1), 0), 1);
}

/** The camera's path: a smooth curve through the chapter anchors, CAMERA_OFFSET off them. */
export function cameraPath(anchors: THREE.Vector3[]): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(anchors.map((a) => a.clone().add(CAMERA_OFFSET)));
}

/** Where the car rides when the camera is at `camera` on its path: the framed point plus CAR_OFFSET. Writes `out`. */
export function carFrom(camera: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  return out.copy(camera).sub(CAMERA_OFFSET).add(CAR_OFFSET);
}

/**
 * Reduced motion (#16): the one progress each chapter holds still at, for any `progress` within it. The middle of its
 * span, where the camera frames it; the war once its world has broken and before the drive out. Pure.
 */
export function stillAt(spans: ChapterSpan[], progress: number): number {
  const { chapter, start, end } = spanAt(spans, progress);
  return start + (chapter.phase === 'shatter' ? WAR_STILL : 0.5) * (end - start);
}
