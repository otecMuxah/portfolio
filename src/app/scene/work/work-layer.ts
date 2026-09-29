import * as THREE from 'three';
import {
  CHAPTERS,
  CHAPTER_TEXT,
  Chapter,
  ChapterId,
  DOMAIN_TEXT,
  RoleCard,
} from '../../content/life';
import { enter, leave, smoothstep } from '../art/kit';
import { PaletteKey } from '../art/palette';
import { ChapterScene } from '../chapter-scene';
import { CAMERA_OFFSET } from '../path';
import { FaceText, WorkAtlas } from './atlas';
import { Nameplate } from './nameplate';
import { TechRing } from './tech-ring';

/** Local progress between one company's moment and the next's, in chapters with several. */
export const STEP_GAP = 0.16;
/** How much local progress a turn from one company to the next takes, centred between their moments. */
export const TURN = 0.08;
/** The local progress by which a chapter's layer has folded away after the camera leaves it. */
export const FOLD = 1.3;

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

/** The local progress at which step `k` of `n` stands alone, facing the camera: centred on `centre`, `gap` apart. */
export function stepMoment(k: number, n: number, centre = 0.5, gap = STEP_GAP): number {
  return centre + gap * (k - (n - 1) / 2);
}

/**
 * Which of `n` steps shows at `local`, as a continuous index: whole numbers between turns, fractional during one.
 * Pure, so scrolling back turns the steps back exactly.
 */
export function stepAt(local: number, n: number, centre = 0.5, gap = STEP_GAP): number {
  let at = 0;
  for (let k = 0; k < n - 1; k++) {
    const turn = (stepMoment(k, n, centre, gap) + stepMoment(k + 1, n, centre, gap)) / 2;
    at += smoothstep(turn - TURN / 2, turn + TURN / 2, local);
  }
  return at;
}

/** How far step `k` shows (0..1) at `at`: it leaves over the first half of the turn after it, the next joins over the second. */
export function stepWeight(k: number, at: number, n: number): number {
  const joined = k === 0 ? 1 : clamp01(2 * (at - (k - 1)) - 1);
  const left = k === n - 1 ? 1 : clamp01(1 - 2 * (at - k));
  return Math.min(joined, left);
}

/** A chapter's roles, in the order they started. */
export function workSteps(id: ChapterId): RoleCard[] {
  const roles = CHAPTER_TEXT.en[id].roles ?? [];
  return [...roles].sort((a, b) => parseInt(a.years, 10) - parseInt(b.years, 10));
}

/** What a step's nameplate says: the company, then who it was through, when, and what about. */
export function faceText(role: RoleCard): FaceText {
  const line = [
    role.via && `via ${role.via}`,
    role.years,
    role.domain && DOMAIN_TEXT.en[role.domain],
  ];
  return { name: role.company, line: line.filter(Boolean).join('  ·  ') };
}

let atlas: WorkAtlas | undefined;

/** One atlas for every career chapter, drawn the first time one is built. */
function sharedAtlas(): WorkAtlas {
  const roles = CHAPTERS.flatMap((c) => CHAPTER_TEXT.en[c.id].roles ?? []);
  atlas ??= new WorkAtlas(
    roles.map(faceText),
    roles.flatMap((r) => r.tech),
  );
  return atlas;
}

interface Placement {
  /**
   * The sign, from the chapter camera: how far behind the anchor its foot stands, how far right of the camera's line of
   * sight (negative: left), and the height of its face's centre.
   */
  sign: [behind: number, across: number, height: number];
  /** The ring's centre, the same way. */
  ring: [behind: number, across: number, height: number];
  /** Where the camera frames the chapter (local progress) and how far apart its company steps are. */
  schedule: [centre: number, gap: number];
}

/** Level directions from the anchor: away from the camera road (straight behind the subject), and to screen right. */
const BACK = new THREE.Vector3(-CAMERA_OFFSET.x, 0, -CAMERA_OFFSET.z).normalize();
const RIGHT = new THREE.Vector3(-BACK.z, 0, BACK.x);

/** A point `behind` the anchor from the chapter camera and `across` to the right of its line of sight, at `height`. */
export function behindScene(behind: number, across: number, height: number): THREE.Vector3 {
  return BACK.clone().multiplyScalar(behind).addScaledVector(RIGHT, across).setY(height);
}

/** The sign and ring stand this much larger than built, so they read the same from their place behind the scene. */
export const BACKDROP_SCALE = 1.2;

/**
 * Behind the scene, past its 12 m plot from the chapter camera, whatever the set piece: high up, framing it from behind.
 * The sign over the subject, a little right, toward the car, where a phone held upright looks; any further right and it
 * stands in the next chapter's view, down the road. The ring up to the left.
 */
const PLACEMENT: Placement = {
  sign: [13, 4, 15],
  ring: [14.35, -6.5, 13.5],
  schedule: [0.5, STEP_GAP],
};
/** Where a chapter's camera frames it otherwise. */
const PLACEMENTS: Partial<Record<ChapterId, Partial<Placement>>> = {
  // The camera rides behind the car out of the war until the chapter's midpoint, and moves on soon after.
  ciklum: { schedule: [0.58, 0.12] },
};

const WARM: PaletteKey[] = [
  'terracotta',
  'wheat',
  'homeWarm',
  'dawnGold',
  'brass',
  'candle',
  'brick',
];
const COOL: PaletteKey[] = ['glass', 'skyBlue', 'chalk', 'screenGlow', 'steel'];

/** The local progress at which a chapter's company step `k` stands alone, facing the camera. */
export function chapterMoment(id: ChapterId, k: number): number {
  const [centre, gap] = { ...PLACEMENT, ...PLACEMENTS[id] }.schedule;
  return stepMoment(k, workSteps(id).length, centre, gap);
}

/**
 * Adds the work layer to a career chapter's scene: a nameplate naming each company in turn, and a ring of the step's
 * stack with its domain's emblem at the hub. Chapters without roles come back unchanged. The layer sits in the
 * chapter's anchor frame, whatever way the chapter's own object is turned, and updates after the chapter does.
 */
export function withWorkLayer(scene: ChapterScene, chapter: Chapter): ChapterScene {
  const steps = workSteps(chapter.id);
  if (!steps.length) return scene;
  const n = steps.length;
  const place = { ...PLACEMENT, ...PLACEMENTS[chapter.id] };
  const rebuild = chapter.phase === 'rebuild';
  const shared = sharedAtlas();

  const layer = new THREE.Group();
  layer.name = 'work-layer';
  scene.object.updateMatrix();
  scene.object.matrix.clone().invert().decompose(layer.position, layer.quaternion, layer.scale);

  const sign = new Nameplate(
    shared,
    steps.map((s) => shared.face(faceText(s))),
    place.sign[2] / BACKDROP_SCALE,
    rebuild ? 'glass' : 'homeGlow',
  );
  // The sign scales itself as it builds in, so it stands larger on a stand of its own.
  const stand = new THREE.Group();
  stand.position.copy(behindScene(place.sign[0], place.sign[1], 0));
  stand.scale.setScalar(BACKDROP_SCALE);
  stand.add(sign.object);
  const ring = new TechRing(shared, steps, rebuild ? COOL : WARM, rebuild ? 'glass' : 'homeGlow');
  ring.object.position.copy(behindScene(...place.ring));
  ring.object.scale.setScalar(BACKDROP_SCALE);
  layer.add(stand, ring.object);
  scene.object.add(layer);

  const weights = new Array<number>(n).fill(0);
  return {
    object: scene.object,
    update(frame) {
      scene.update?.(frame);
      // It folds away once the camera has moved on, before the next chapter frames its first company: from there, it
      // would stand at the edge of that chapter's view.
      const built = enter(frame.local) * (1 - smoothstep(1, FOLD, frame.local));
      const lit = smoothstep(0.85, 1, built) * (1 - 0.4 * leave(frame.local));
      const at = stepAt(frame.local, n, ...place.schedule);
      sign.update(at, built, lit);
      for (let k = 0; k < n; k++) weights[k] = built * stepWeight(k, at, n);
      ring.update(weights, frame.time, lit);
    },
  };
}
