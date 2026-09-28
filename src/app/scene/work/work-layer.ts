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
import { FaceText, WorkAtlas } from './atlas';
import { Nameplate } from './nameplate';
import { TechRing } from './tech-ring';

/** Local progress between one company's moment and the next's, in chapters with several. */
export const STEP_GAP = 0.16;
/** How much local progress a turn from one company to the next takes, centred between their moments. */
export const TURN = 0.08;

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
  /** The sign's foot and the height of its face's centre, in the chapter's anchor frame. */
  sign: [x: number, z: number, height: number];
  /** The ring's centre. */
  ring: [x: number, y: number, z: number];
  /** Where the camera frames the chapter (local progress) and how far apart its company steps are. */
  schedule: [centre: number, gap: number];
}

/** Behind the subject, over the skyline, where the camera's frame is free on desktop and phone alike. */
const PLACEMENT: Placement = {
  sign: [-4.5, -4, 12],
  ring: [-5, 7.5, 4.5],
  schedule: [0.5, STEP_GAP],
};
/** Where a chapter's own scene already stands in those places. */
const PLACEMENTS: Partial<Record<ChapterId, Partial<Placement>>> = {
  // Above the card, which is tallest here, as the camera moves on to the third company.
  'kharkiv-career': { ring: [-5, 10, 4.5] },
  // Clear of the north spire.
  krakow: { sign: [-4.5, -4, 14] },
  // The camera rides behind the car out of the war until the chapter's midpoint, and moves on soon after. The sign
  // stands behind the forest and the ring over the gap between house and castle, clear of both.
  ciklum: { sign: [-1.6, -8.8, 12], ring: [-3.5, 12, 0.2], schedule: [0.58, 0.12] },
  // The sign right of the towers, under the planes; the ring left of the Messeturm.
  iata: { sign: [4.6, -6.6, 10], ring: [-6.5, 11, 2.5] },
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
    place.sign[2],
    rebuild ? 'glass' : 'homeGlow',
  );
  sign.object.position.set(place.sign[0], 0, place.sign[1]);
  const ring = new TechRing(shared, steps, rebuild ? COOL : WARM, rebuild ? 'glass' : 'homeGlow');
  ring.object.position.set(...place.ring);
  layer.add(sign.object, ring.object);
  scene.object.add(layer);

  const weights = new Array<number>(n).fill(0);
  return {
    object: scene.object,
    update(frame) {
      scene.update?.(frame);
      const built = enter(frame.local);
      const lit = smoothstep(0.85, 1, built) * (1 - 0.4 * leave(frame.local));
      const at = stepAt(frame.local, n, ...place.schedule);
      sign.update(at, built, lit);
      for (let k = 0; k < n; k++) weights[k] = built * stepWeight(k, at, n);
      ring.update(weights, frame.time, lit);
    },
  };
}
