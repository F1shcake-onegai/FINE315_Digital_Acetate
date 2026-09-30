# Contact sheets under acetate

A three.js viewer for two film contact sheets lying on a table, each under a clear acetate sheet
hinged along its top edge that you can grab and flip open. Built to `docs/SPEC.md`.

## Status

| Milestone | State |
|---|---|
| M0 Scaffold | done |
| M1 Paper: scans, pearl-finish prints, key/fill light, shadows | done |
| M2 Flat acetate: clear, slightly hazy sheet over each print, contact shadow, Fresnel test | done |
| M3 Bend traces: waves and corner curl (now off: flat at rest, user), fingerprints, scratches, hinge creases, rim; the user's drawing on the sheet | done |
| M4 Tape: kraft strip over the hinge, wrapped onto the paper's back, torn ends, follows the hinge angle | done; hidden for now at the user's request (`tape.visible`) |
| M5 Flip: grab and drag with a hand pointer, release snap, spring landing, sag, click, keys 1/2 | done |
| M6 View: zoom, pan, buttons, keys, parallax, hint | done |
| M7 Polish | optional HDRI, slow-frame fallback and this README done; dust and wall variant to do; the corner contact shadow is moot now the sheet lies flat |

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
- Left-drag an acetate to flip it about its top edge; over a sheet the pointer becomes a hand,
  pinching while you hold it. Let go and it springs open or shut, whichever way it was going.
- Click an acetate, or press `1` / `2`, to flip sheet A / B
- `−` `+` `Reset` buttons, keys `-` `+` `0`, double-click the table: zoom and reset

## Assets

| File | Notes |
|---|---|
| `public/assets/sheet-a.jpg`, `sheet-b.jpg` | The contact-sheet scans, left and right. sRGB, the paper's 11:14 aspect, 4000–4096 px on the long side. A missing scan is replaced by a procedural placeholder and logged. |
| `public/assets/env.hdr` | Optional 1K equirectangular HDRI for reflections; `RoomEnvironment` is used without it. Balance it with `environment.hdrIntensity`. |
| `public/assets/acetate-a.png`, `acetate-b.png` | Optional drawing on each acetate (left, right): white strokes on a transparent background. Draw on the scan's 3300×4200 canvas with the scan as a hidden guide layer, then export PNG with transparency. Strokes become opaque, matte white paint on the sheet's top surface; soft edges follow the alpha. Without the file the sheet is clear. |
| `public/assets/wear/*.png` | CC0 masks from [ambientCG](https://ambientcg.com) (Fingerprints001/002, SurfaceImperfections001, Scratches005), composed at startup into each sheet's smudges and scratches. |
| `public/assets/tape/Paper006_Color.jpg` | Kraft color for the tape: a CC0 scan from [ambientCG](https://ambientcg.com/view?id=Paper006), tinted at load so its mean is `tape.color`. Without it the tape uses procedural kraft. Only loaded while `tape.visible` is true. |

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
- The acetate lies flat on the paper at rest (user): the spec's rest waves and corner curl are
  set to zero, and the studio's two side lights moved from 18° to 30° off vertical so the flat
  sheet doesn't veil the prints' outer edges.
- The acetate is clear but slightly hazy (roughness 0.12, transmission 0.985) and neutral in tint.
  It reflects its own dark studio with softboxes instead of the room, so it adds highlights
  without greying the prints. Transmission stays at full resolution out to 1.0 m; the spec's
  half resolution blurred the prints under the sheet. The print is seen through the sheet sharp,
  with a faint glow mixed in for softness (`acetate.haze`), instead of three's roughness-driven
  blur, which smeared it; fingerprints raise the glow, so they read milky.
- Acetate wear comes from ambientCG scans instead of the spec's procedural blobs and lines. The
  corners curl more locally than the spec's formula, which lifted all but the middle of the free
  edge.
- The tape is hidden for now (user): `tape.visible` is false, so the sheets hinge along the top
  edge with nothing drawn there. As built, the tape wraps over the top edge onto the back of the
  paper; the spec put half of it on the paper's face, under the closed acetate. It is one strip
  whose fold is rebuilt from the hinge angle, rather than two strips and a seam cylinder. Its
  color comes from an ambientCG scan instead of generated noise. The ends are torn with a light
  fiber margin. The adhesive side, which shows through the open acetate, looks darker, like damp
  paper.
- Dragging: away from the table the grabbed point follows the pointer exactly (the spec's table
  projection left a lifted edge up to 7 cm from it); near closed and open the projection is kept.
  Landing damping is 16, not 20, so the sheet visibly lands and bounces once, and no part ever
  passes through the table or paper. The sheet flexes in smooth curves that never crease
  (user): held, it sags under its own weight (peeling off the print as it's lifted); in flight it
  trails in one even arc (`acetate.droop`, `sagGain`, `sagMax`). The spec's clamped sag creased it.
  The pointer over a sheet is a drawn hand (user) instead of the grab/grabbing cursors.
- `PCFShadowMap` and `HDRLoader`, because three r186 removed `PCFSoftShadowMap` and deprecated
  `RGBELoader`.
- The placeholder sheet uses 5 frames per strip; 6 don't fit inside its white border.

## Development

- On the dev server, `window.__app` exposes `renderer`, `scene`, `camera`, `config`,
  `view(distance, x, z)`, `acetateAngle(degrees)`, which poses both acetates (0 closed, 180
  open), and `flip` (`flip.states()`, `flip.toggle(0)`). For example, `__app.view(0.12, -0.1495, 0)`
  gives a close look at sheet A.
- Dev key `F` tilts both acetates to 80° and back, to check the grazing-angle flash.
- Source layout: `src/scene` (renderer, camera, environment, lighting, table, paper, acetate, tape,
  set), `src/textures` (placeholder sheet, procedural maps, scan loader, wear, artwork, kraft),
  `src/interaction` (view controls, parallax, flip), `src/ui` (overlay, hand pointer and its drawings).
