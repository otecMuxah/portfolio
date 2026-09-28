import * as THREE from 'three';
import { ChapterBuilder } from '../chapter-scene';

export const placeholder: ChapterBuilder = (_chapter, index) => {
  const height = 6 + index * 3;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(6, height, 6),
    new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.08 + index * 0.12, 0.6, 0.55) }),
  );
  mesh.position.y = height / 2;
  return { object: mesh };
};
