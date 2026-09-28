import * as THREE from 'three';
import { ChapterSpan } from '../journey/journey';

const CHAPTER_GAP = 40;
const CAMERA_OFFSET = new THREE.Vector3(0, 6, 18);
const LOOK_OFFSET = new THREE.Vector3(0, 3, 0);

/** Owns the Three.js renderer, camera and loop. Runs outside Angular change detection. */
export class SceneEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  private readonly path: THREE.CatmullRomCurve3;
  private readonly resizeObserver: ResizeObserver;
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
    spans.forEach((_, i) => this.scene.add(this.placeholder(anchors[i], i)));
    this.path = new THREE.CatmullRomCurve3(
      [anchors[0].clone().setZ(18), ...anchors].map((a) => a.clone().add(CAMERA_OFFSET)),
    );

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
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
    this.renderer.dispose();
  }

  private placeholder(at: THREE.Vector3, i: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(6, 6 + i * 3, 6),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.08 + i * 0.12, 0.6, 0.55) }),
    );
    mesh.position.copy(at).setY((6 + i * 3) / 2);
    return mesh;
  }

  private frame(): void {
    this.current += (this.target - this.current) * 0.08;
    // Map progress so each chapter's scroll span centres the camera on its anchor.
    const t = this.pathT(this.current);
    this.camera.position.copy(this.path.getPointAt(t));
    this.camera.lookAt(this.camera.position.clone().sub(CAMERA_OFFSET).add(LOOK_OFFSET));
    this.renderer.render(this.scene, this.camera);
  }

  private pathT(progress: number): number {
    const n = this.spans.length;
    const i = Math.max(this.spans.findIndex((s) => progress < s.end), 0);
    const s = this.spans[progress >= 1 ? n - 1 : i];
    const local = (progress - s.start) / (s.end - s.start);
    return Math.min((this.spans.indexOf(s) + local) / n, 1);
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
