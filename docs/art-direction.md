# Art direction: the life-journey world

One world, built by several hands. Every scene ticket (#5, #6, #8–#11) follows this sheet so that the journey reads as a single piece. Code lives in `src/app/scene/art/`: `palette.ts` holds the colour script and `kit.ts` the shared materials, easing and seeded random.

## Style

- **Low-poly, flat-shaded, untextured.** Use `lowPoly(key)` for solids and `glow(key)` for practicals. No image textures, no smooth shading, no PBR metal except car trim.
- **Few, bold shapes.** Each chapter reads from its silhouette at 30 m in fog. If a shape needs a label to be understood, simplify it.
- **Facts live in the HTML cards, not in 3D text.** 3D glyphs (such as `</>` in first-code) are built from boxes and lines, with no font loading.

## Colour script

| Stretch | Mood | Key colours |
| --- | --- | --- |
| birth → family (1981–2010) | dawn, warmth gathering | dawnGold, brick, chalk, brass, sandstone, candle |
| first-code → back-home (2012–2022) | warm, fullest at back-home (chapter 10) | terminal, terracotta, wheat, krakowBrick/Roof, homeWarm, homeGlow |
| war (24.02.2022) | colour drains to ash and soot; one lastLight remains | ash, soot, lastLight |
| ciklum → iata (2022–now) | cool dawn returning to full colour; a new world, not the old one restored | dawnBlue, steel, glass, skyBlue |

Author every scene in full colour. The phase grade (the drain in the war, the return in the rebuild) is applied **globally** by #9/#10, never baked into chapter materials.

## Space and framing

- 1 unit = 1 m. Chapter anchors sit 40 m apart along the path; the engine places each scene at its anchor.
- Build around your own origin. Footprint radius ≤ 12 m and height ≤ 22 m, so that neighbours and the road never collide.
- The camera travels a road beside the scenes. At a chapter's midpoint it sits at (18, 7, 16) from the anchor and looks at y = 3 on the anchor: a front-right 3/4 view. Put the subject's centre of interest at y ≈ 2–6 and compose it for that angle.
- Keep the front-right quadrant (x > 0, z > 0) beyond the footprint clear: that is the road. The car rides at the camera's framed point + `CAR_OFFSET` (12, 0, 2) in `scene-engine.ts`, so it sits on the road at the right of frame.
- Light: the engine provides a hemisphere fill plus a warm key from the upper left. Chapters add **no** lights: practicals (CRT, candles, windows) use `glow(key)` plus a `halo(key, size, opacity)` sprite.

## Motion

- **State comes from scroll only.** Use `enter(local)` and `leave(local)` (pure functions of `local`), so reverse scrolling un-builds exactly. `time` is for idle loops only (flicker, bob, slow spin) and never changes what is built.
- Build-phase scenes **persist** after the camera leaves, because the world grows. `leave` calms a scene down (slower idle, dimmer glow); it doesn't remove anything. The war then breaks all of it.
- Seed all randomness with `seeded(n)`, so every load and every screenshot is the same.

## Shatter-readiness (for #9)

- Make build-phase structures from plain `Mesh`es: separate meshes or merged, non-instanced geometry. Don't put a main structure in an `InstancedMesh`; particles and decoration may use one.
- Put everything a chapter builds under its returned `object`. Nothing may be added to the scene directly.

## Budgets (per chapter, desktop)

- ≤ 5 000 triangles, ≤ 25 draw calls, ≤ 1 500 particles (half on mobile, see #16).
- Allocate nothing per frame: reuse vectors and colours, and mutate attributes in place.
- Builders are synchronous and cheap: the engine builds the first chapter before the page is ready, then one chapter per frame.
- Everything must be disposable. The engine's `dispose()` traverses the scene, so keep it all under `object`.
