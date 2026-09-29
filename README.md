# Contact sheets under acetate

A three.js viewer for two film contact sheets lying on a table. Each will get a clear acetate
sheet taped along its top edge that you can grab and flip open. Built to `docs/SPEC.md`.

## Status

| Milestone | State |
|---|---|
| M0 Scaffold | done |
| M1 Paper: scans, pearl-finish prints, key/fill light, shadows | done |
| M2 Flat acetate: clear, slightly hazy sheet over each print, contact shadow, Fresnel test | done |
| M3 Bend traces: waves and corner curl, fingerprints, scratches, hinge creases, rim; the user's drawing on the sheet | done |
| M4 Tape, M5 Flip | not started |
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
- Middle-drag (or right-drag, or two fingers on touch): pan along the table
- The left button is reserved for grabbing the acetate once it exists
- `−` `+` `Reset` buttons, keys `-` `+` `0`, double-click: zoom and reset

## Assets

| File | Notes |
|---|---|
| `public/assets/sheet-a.jpg`, `sheet-b.jpg` | The contact-sheet scans, left and right. sRGB, the paper's 11:14 aspect, 4000–4096 px on the long side. A missing scan is replaced by a procedural placeholder and logged. |
| `public/assets/env.hdr` | Optional 1K equirectangular HDRI for reflections; `RoomEnvironment` is used without it. Balance it with `environment.hdrIntensity`. |
| `public/assets/acetate-a.png`, `acetate-b.png` | Optional drawing on each acetate (left, right): white strokes on a transparent background. Draw on the scan's 3300×4200 canvas with the scan as a hidden guide layer, then export PNG with transparency. Strokes become opaque, matte white paint on the sheet's top surface; soft edges follow the alpha. Without the file the sheet is clear. |
| `public/assets/wear/*.png` | CC0 masks from [ambientCG](https://ambientcg.com) (Fingerprints001/002, SurfaceImperfections001, Scratches005), composed at startup into each sheet's smudges and scratches. |

The current scans come from `scans/page_1_pos_1114.png` and `page_2_pos_1114.png`: 16-bit gray
PNGs with a "Dot Gain 20%" profile, kept out of git. Convert such files through their embedded
profile to sRGB; dropping the profile darkens midtones by about 20 levels.

## Tuning

Every number lives in `src/config.ts`. Values marked "(not in spec)" were picked during the build.
Changes from the original spec, all recorded in `docs/SPEC.md`:

- Paper is 0.231 × 0.294 m, measured from the scans, not 8×10 in. The acetate, layout and pan
  bounds follow from it.
- The prints are smooth, semi-matte resin-coated paper (Ilford Pearl, roughness 0.4) with no
  grain texture, and reflect at half strength (`paper.specularIntensity` 0.5) so the room's
  sheen doesn't turn their blacks grey.
- The camera looks straight down instead of tilting 20°.
- Tone-mapping exposure is 0.5, not 1.0, which washed the prints out. After ACES, a Levels-style
  black point (`light.blackPoint`, 0.05) deepens the milky blacks; whites are unaffected.
- The table is 4 m, not 2 m, so zoomed-out views never reach its edge.
- The acetate is clear but slightly hazy (roughness 0.12, transmission 0.985) and neutral in tint.
  It reflects its own dark studio with softboxes instead of the room, so it adds highlights
  without greying the prints. Transmission stays at full resolution out to 1.0 m; the spec's
  half resolution blurred the prints under the sheet. A small shader patch halves three's
  roughness-driven blur of what's seen through the sheet (`acetate.transmissionBlur`).
- Acetate wear comes from ambientCG scans instead of the spec's procedural blobs and lines. The
  corners curl more locally than the spec's formula, which lifted all but the middle of the free
  edge.
- `PCFShadowMap` and `HDRLoader`, because three r186 removed `PCFSoftShadowMap` and deprecated
  `RGBELoader`.
- The placeholder sheet uses 5 frames per strip; 6 don't fit inside its white border.

## Development

- On the dev server, `window.__app` exposes `renderer`, `scene`, `camera`, `config`,
  `view(distance, x, z)` and `acetateAngle(degrees)`. For example, `__app.view(0.12, -0.1495, 0)`
  gives a close look at sheet A.
- Dev key `F` tilts both acetates to 80° and back, to check the grazing-angle flash.
- Source layout: `src/scene` (renderer, camera, environment, lighting, table, paper, acetate, set),
  `src/textures` (placeholder sheet, procedural maps, scan loader, wear, artwork), `src/interaction` (view
  controls, parallax), `src/ui` (overlay).
