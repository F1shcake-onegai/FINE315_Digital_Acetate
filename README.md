# Contact sheets under acetate

A three.js viewer for two film contact sheets lying on a table. Each will get a clear acetate
sheet taped along its top edge that you can grab and flip open. Built to `docs/SPEC.md`.

## Status

| Milestone | State |
|---|---|
| M0 Scaffold | done |
| M1 Paper: scans, paper grain, key/fill light, shadows | done |
| M2 Flat acetate, M3 Bend traces, M4 Tape, M5 Flip | not started; waiting on the acetate layer |
| M6 View: zoom, pan, buttons, keys, parallax, hint | done |
| M7 Polish | optional HDRI and this README done; dust, corner contact shadow, wall variant and perf fallbacks act on the acetate and come after it |

## Run

Needs Node 20.19 or newer (developed on 24).

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check, then production build into dist/
npm run preview    # serve dist/
npm run typecheck
```

## Controls

- Scroll or pinch: zoom toward the cursor (0.06–1.4 m)
- Drag with the left or right button: pan along the table
- `−` `+` `Reset` buttons, keys `-` `+` `0`, double-click: zoom and reset

## Assets

| File | Notes |
|---|---|
| `public/assets/sheet-a.jpg`, `sheet-b.jpg` | The contact-sheet scans, left and right. sRGB, the paper's 11:14 aspect, 4000–4096 px on the long side. A missing scan is replaced by a procedural placeholder and logged. |
| `public/assets/env.hdr` | Optional 1K equirectangular HDRI for reflections; `RoomEnvironment` is used without it. Balance it with `environment.hdrIntensity`. |

The current scans come from `scans/page_1_pos_1114.png` and `page_2_pos_1114.png`: 16-bit gray
PNGs with a "Dot Gain 20%" profile, kept out of git. Convert such files through their embedded
profile to sRGB; dropping the profile darkens midtones by about 20 levels.

## Tuning

Every number lives in `src/config.ts`. Values marked "(not in spec)" were picked during the build.
Changes from the original spec, all recorded in `docs/SPEC.md`:

- Paper is 0.231 × 0.294 m, measured from the scans, not 8×10 in. The acetate, layout and pan
  bounds follow from it.
- The camera looks straight down instead of tilting 20°.
- Tone-mapping exposure is 0.5, not 1.0, which washed the prints out.
- The table is 4 m, not 2 m, so zoomed-out views never reach its edge.
- `PCFShadowMap` and `HDRLoader`, because three r186 removed `PCFSoftShadowMap` and deprecated
  `RGBELoader`.
- The placeholder sheet uses 5 frames per strip; 6 don't fit inside its white border.

## Development

- On the dev server, `window.__app` exposes `renderer`, `scene`, `camera`, `config` and
  `view(distance, x, z)`. For example, `__app.view(0.12, -0.1495, 0)` gives a close look at sheet A.
- Source layout: `src/scene` (renderer, camera, environment, lighting, table, paper, set),
  `src/textures` (placeholder sheet, procedural maps, scan loader), `src/interaction` (view
  controls, parallax), `src/ui` (overlay).
