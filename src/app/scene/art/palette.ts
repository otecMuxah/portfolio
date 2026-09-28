/**
 * The colour script. Scenes author in full colour from here; the phase grade
 * (warmth peaking at back-home, drain to grey in the war, return in the rebuild)
 * is applied globally, never baked into chapter materials.
 */
export const PALETTE = {
  night: '#0d0f14',
  sky: '#ffe8c7',
  ground: '#1a1d26',
  sun: '#ffd9a0',

  dawnGold: '#f4b860',
  brick: '#c8553d',
  chalk: '#d8e2dc',
  brass: '#d4a373',
  sandstone: '#e9c46a',
  crtBeige: '#d6ccb8',
  screenGlow: '#7fd6ff',
  candle: '#ffb347',
  terminal: '#5dff9e',
  terracotta: '#e07a5f',
  wheat: '#f2cc8f',
  krakowRoof: '#6aa391',
  krakowBrick: '#b5484b',
  homeWarm: '#ff9f45',
  homeGlow: '#ffcf70',

  ash: '#3a3a3a',
  soot: '#16171a',
  lastLight: '#fff1d6',

  dawnBlue: '#8ecae6',
  steel: '#4d7ea8',
  glass: '#a8dadc',
  skyBlue: '#7fb7e6',

  concrete: '#6b6b6b',
  studio: '#e6e6e6',
} as const;

export type PaletteKey = keyof typeof PALETTE;
