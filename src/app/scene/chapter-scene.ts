import * as THREE from 'three';
import { Chapter } from '../content/life';

export interface FrameState {
  /** Smoothed journey progress, 0..1. */
  progress: number;
  /** Progress through this chapter's scroll span: 0 at its start, 1 at its end, <0 before, >1 after. */
  local: number;
  /** Seconds since the engine started, for idle motion. */
  time: number;
}

/** A chapter's 3D content, built around its own origin; the engine places it at the chapter's anchor. */
export interface ChapterScene {
  object: THREE.Object3D;
  update?(frame: FrameState): void;
}

export type ChapterBuilder = (chapter: Chapter, index: number) => ChapterScene;

const CHAPTER_GAP = 40;

/** Where chapter `index` sits in the world: 40 m apart along -z, swaying across; the camera path runs through these. */
export function chapterAnchor(index: number, target = new THREE.Vector3()): THREE.Vector3 {
  return target.set(Math.sin(index) * 12, 0, -index * CHAPTER_GAP);
}
