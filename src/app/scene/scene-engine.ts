import * as THREE from 'three';
import { ChapterSpan, spanAt } from '../journey/journey';
import { PALETTE } from './art/palette';
import { ChapterScene } from './chapter-scene';
import { CHAPTER_BUILDERS } from './chapters';

const CHAPTER_GAP = 40;
const CAMERA_OFFSET = new THREE.Vector3(0, 6, 18);
const LOOK_OFFSET = new THREE.Vector3(0, 3, 0);

/** Owns the Three.js renderer, camera and loop. Runs outside Angular change detection. */
export class SceneEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  private readonly anchors: THREE.Vector3[];
  private readonly path: THREE.CatmullRomCurve3;
  private readonly resizeObserver: ResizeObserver;
  /** Sparse until every chapter has been built. */
  private readonly chapterScenes: ChapterScene[] = [];
  private readonly clock = new THREE.Timer();
  private target = 0;
  private disposed = false;
  private current = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly spans: ChapterSpan[],
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(PALETTE.night);
    this.scene.fog = new THREE.Fog(PALETTE.night, 20, 90);
    this.scene.add(new THREE.HemisphereLight(PALETTE.sky, PALETTE.ground, 1.2));
    // A low key light from the upper left gives flat-shaded facets readable contrast.
    const sun = new THREE.DirectionalLight(PALETTE.sun, 2);
    sun.position.set(-20, 30, 15);
    this.scene.add(sun);

    this.anchors = spans.map((_, i) => new THREE.Vector3(Math.sin(i) * 12, 0, -i * CHAPTER_GAP));
    this.path = new THREE.CatmullRomCurve3(this.anchors.map((a) => a.clone().add(CAMERA_OFFSET)));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  /**
   * Builds and compiles the first chapter, starts the loop and resolves: the page is ready.
   * The other chapters then build in the background, one per frame. Reports progress 0..1
   * toward that first chapter so the page can show a loader meanwhile.
   */
  async load(onProgress: (progress: number) => void): Promise<void> {
    onProgress(0);
    this.build(0);
    onProgress(0.5);
    await this.renderer.compileAsync(this.scene, this.camera);
    if (this.disposed) return;
    this.frame();
    this.renderer.setAnimationLoop(() => this.frame());
    onProgress(1);
    this.buildRest().catch((err) => console.warn('Chapter scenes failed to build', err));
  }

  private async buildRest(): Promise<void> {
    for (let i = 1; i < this.spans.length; i++) {
      await new Promise(requestAnimationFrame);
      if (this.disposed) return;
      // Compile now, not on the first frame that shows it, so scrolling there doesn't hitch.
      await this.renderer.compileAsync(this.build(i), this.camera, this.scene);
    }
  }

  private build(index: number): THREE.Object3D {
    const { chapter } = this.spans[index];
    const built = CHAPTER_BUILDERS[chapter.scene](chapter, index);
    built.object.position.add(this.anchors[index]);
    this.scene.add(built.object);
    this.chapterScenes[index] = built;
    return built.object;
  }

  /** Journey progress 0..1; the camera eases toward it each frame. */
  setProgress(progress: number): void {
    this.target = progress;
  }

  dispose(): void {
    this.disposed = true;
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
      this.chapterScenes[i]?.update?.({ progress: this.current, local: (this.current - start) / (end - start), time }),
    );
    // getPoint is uniform per segment, so t = i / (n - 1) lands exactly on anchor i.
    const t = this.pathT(this.current);
    this.camera.position.copy(this.path.getPoint(t));
    this.camera.lookAt(this.camera.position.clone().sub(CAMERA_OFFSET).add(LOOK_OFFSET));
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
