/** Three.js renders with WebGL 2; without it the journey falls back to the plain story list. */
export function supportsWebGL(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}
