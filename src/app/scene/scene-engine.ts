import * as THREE from 'three';
import { ChapterSpan, journeyAt, spanAt } from '../journey/journey';
import { CarRig } from './car-rig';
import { ChapterScene } from './chapter-scene';
import { CHAPTER_BUILDERS } from './chapters';

const CHAPTER_GAP = 40;
const CAMERA_OFFSET = new THREE.Vector3(0, 6, 18);
const LOOK_OFFSET = new THREE.Vector3(0, 3, 0);
/** Where the car rides relative to the camera's chapter anchor: ahead of the camera, beside the chapter's scene. */
const CAR_OFFSET = new THREE.Vector3(4.5, 0, 5);

/** Owns the Three.js renderer, camera and loop. Runs outside Angular change detection. */
export class SceneEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  private readonly path: THREE.CatmullRomCurve3;
  private readonly resizeObserver: ResizeObserver;
  private readonly chapterScenes: ChapterScene[];
  private readonly clock = new THREE.Timer();
  private readonly carRig = new CarRig();
  private target = 0;
  private current = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly spans: ChapterSpan[],
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color('#0d0f14');
    this.scene.fog = new THREE.Fog('#0d0f14', 20, 90);
    this.scene.add(new THREE.HemisphereLight('#ffe8c7', '#1a1d26', 2));

    const anchors = spans.map((_, i) => new THREE.Vector3(Math.sin(i) * 12, 0, -i * CHAPTER_GAP));
    this.chapterScenes = spans.map(({ chapter }, i) => {
      const built = CHAPTER_BUILDERS[chapter.scene](chapter, i);
      built.object.position.add(anchors[i]);
      this.scene.add(built.object);
      return built;
    });
    this.path = new THREE.CatmullRomCurve3(anchors.map((a) => a.clone().add(CAMERA_OFFSET)));
    this.scene.add(this.carRig.object);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Journey progress 0..1; the camera eases toward it each frame. */
  setProgress(progress: number): void {
    this.target = progress;
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
        obj.geometry.dispose();
        [obj.material].flat().forEach((m: THREE.Material) => m.dispose());
      }
    });
    this.renderer.dispose();
  }

  private frame(): void {
    this.current += (this.target - this.current) * 0.08;
    this.clock.update();
    const time = this.clock.getElapsed();
    this.spans.forEach(({ start, end }, i) =>
      this.chapterScenes[i].update?.({ progress: this.current, local: (this.current - start) / (end - start), time }),
    );
    // getPoint is uniform per segment, so t = i / (n - 1) lands exactly on anchor i.
    const t = this.pathT(this.current);
    this.camera.position.copy(this.path.getPoint(t));
    this.camera.lookAt(this.camera.position.clone().sub(CAMERA_OFFSET).add(LOOK_OFFSET));
    const carAt = this.camera.position.clone().sub(CAMERA_OFFSET).add(CAR_OFFSET);
    this.carRig.update(journeyAt(this.current).carId, carAt, this.path.getTangent(t), time);
    this.renderer.render(this.scene, this.camera);
  }

  /** The middle of each chapter's scroll span puts the camera on that chapter's anchor. */
  private pathT(progress: number): number {
    const { index, start, end } = spanAt(this.spans, progress);
    const local = (Math.min(Math.max(progress, 0), 1) - start) / (end - start);
    return Math.min(Math.max((index + local - 0.5) / (this.spans.length - 1), 0), 1);
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
