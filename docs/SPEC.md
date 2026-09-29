# Contact Sheet + Acetate Viewer — Build Spec

Realistic web viewer: two film contact sheets, each with a clear acetate sheet taped over it. The user grabs the acetate and flips it open. Zoom and pan are supported. Desktop browser only.

## How to use this file (Claude Code)

- Save this file as `docs/SPEC.md` in an empty repo.
- Create `CLAUDE.md` at the repo root with this content:

  ```
  Read @docs/SPEC.md before doing anything. Follow its build order and working rules.
  ```

- First prompt for the session:

  ```
  Set up the project and do milestones M0 and M1 from docs/SPEC.md. Stop after M1 and tell me what to look at.
  ```

## Working rules for Claude Code

- Read this whole file before writing code.
- Do milestones in order. Stop after each one and report what to check in the browser.
- Keep every tunable number in `src/config.ts`. No magic numbers in scene code.
- No React, no UI framework, no physics engine, no state library.
- Do not change anything in "Decisions" without asking first.
- `npm run build` and type-check must pass at every milestone. Commit per milestone.
- Real image assets may be missing. Always fall back to procedural placeholders and log it.

---

## 1. Hard requirements (do not change)

- Desktop web app. Mouse, trackpad, keyboard.
- Two fixed sets, side by side. Each set = one contact sheet print + one clear acetate sheet, joined along one edge by brown kraft paper tape.
- Content is static: two fixed scans. No upload or switching UI.
- Acetate is transparent but must read as plastic: reflections, Fresnel flash at grazing angles, faint smudges and scratches, bend streaks (glare stretched along waves in the sheet).
- User can grab the acetate and flip it about the taped edge. One axis only. Snaps to closed (0°) or open (180°).
- Sheets sit on an off-white surface. Table top is the default. Wall is a variant.
- Acetate is the same size as the paper or slightly larger.
- Zoom in/out (camera dolly, zoom toward cursor), pan, reset view.

## 2. Non-goals

- No physics simulation. Bending and sag are hand-made formulas.
- No touch/mobile layout beyond basic pinch zoom.
- No multi-page, no image switching, no editing.

---

## 3. Decisions

| Topic | Decision |
|---|---|
| Stack | Vite + TypeScript + three.js (latest). Vanilla three, no React. |
| Units | Meters. Y is up. Table surface at y = 0. |
| Paper | The real prints, measured from the scans: 0.231 × 0.294 m portrait (11:14), thickness 0.00025 m. (Was 8×10 in, 0.203 × 0.254 m.) |
| Acetate | Paper + overhang: 0.239 × 0.304 m. Top edges aligned at the hinge. Overhang 4 mm left/right, 10 mm at the bottom. |
| Tape | Kraft paper tape, 0.025 m wide, 12.5 mm on paper + 12.5 mm on acetate, runs the full top edge plus 5 mm past each end. |
| Hinge | Top edge = the edge farthest from the camera. Acetate flips away from the viewer and lies open on the table above the paper. |
| Layout | Sets centered at x = ±0.1495 (60 mm gap). Keep ≥ 0.30 m of clear table beyond the top edge for the open acetate. |
| Camera | PerspectiveCamera fov 35°, looking straight down (image plane parallel to the paper, tilt 0°; was 20°) at the center of both sets. Default distance 0.9 m. |
| Renderer | WebGLRenderer, ACES filmic tone mapping followed by a Levels-style black point (implemented as `CustomToneMapping` wrapping three's ACES), sRGB output, `PCFShadowMap` (soft via `shadow.radius`; `PCFSoftShadowMap` was removed in three r186), pixel ratio = min(devicePixelRatio, 2). |
| Environment | `RoomEnvironment` through `PMREMGenerator` by default. Optional real HDRI at `public/assets/env.hdr` (1K) loaded with `HDRLoader` if present (`RGBELoader` is its deprecated alias since r180). |
| Deformation | Acetate vertices are transformed on the CPU every frame (rest shape + hinge rotation + sag), then `computeVertexNormals()`. Grid 60×80. |
| Scans | `public/assets/sheet-a.jpg` and `sheet-b.jpg`, same aspect as the paper (11:14), ≥ 4000 px long side. Procedural placeholder if missing. |

---

## 4. Assets

### 4.1 User-supplied (may be missing at start)

- `public/assets/sheet-a.jpg`, `public/assets/sheet-b.jpg` — contact sheet scans.
- `public/assets/env.hdr` — optional. A room with a window or a softbox gives longer, nicer streaks than `RoomEnvironment`.

Loader rule: try the file; on 404 use the placeholder and `console.warn`.

### 4.2 Placeholder contact sheet (procedural, canvas 2D)

Canvas sized to the paper at ≈ 11.8 px/mm (2726 × 3469 px). Draw in mm.

- White easel border 6 mm (`#f2f0ea`).
- Inside: fully exposed paper, near black `#0a0a0a`, faint vignette.
- 6 horizontal film strips, 35 mm tall, 6 mm vertical gap, 6 frames each.
- Strip base (film rebate) `#1c1c1c`. Sprocket holes `#080808`, 2.8 mm square-ish, 4.75 mm pitch, two rows.
- Frames 36×24 mm, 2 mm apart, centered in the strip. Fill each with a mid-grey noise gradient plus 2–4 random darker/lighter rectangles. Vary exposure per frame.
- Edge markings in `#d8d8d8`: frame numbers ("12", "12A") and a fake film name between frames, 1.5 mm text.
- Sheet B = different seed.

### 4.3 Procedural maps (generate once at startup, ≤ 1024²)

| Map | Use | Recipe |
|---|---|---|
| paperGrain | table normalMap (not the prints: smooth RC paper) | fractal noise, 3 octaves; normal from finite differences |
| smudge | acetate roughnessMap | base 0.06; 6–10 soft blurred ellipses up to 0.25; 2–3 fingerprint-like ridge blobs |
| scratch | acetate normalMap | 30–60 thin random lines, 1–2 px, slight blur, height → normal |
| crease | acetate normalMap band, top 25 mm only | 3–5 faint lines parallel to the hinge |
| kraft | tape map + roughnessMap + alphaMap | fiber noise on `#b9834a` with ±8% value variation; alpha 1 except jagged torn ends |
| dust | optional decal | 20–40 tiny light specks, alpha |
| footprintShadow | soft shadow decal under acetate | rectangle with 8 mm soft edge, alpha 1 → 0 |

Combine scratch + crease into one normal map for the acetate.

---

## 5. Scene spec

### 5.1 Table

- `PlaneGeometry` 4 × 4 m at y = 0 (was 2 × 2; the top-down view reached its edge at max zoom-out and pan), `MeshStandardMaterial`, color `#ede8df`, roughness 0.92, normalMap = paperGrain tiled 16× (one tile per 0.25 m), normalScale 0.1. `receiveShadow`.
- Wall variant (later): same objects, whole world group rotated so the surface is vertical, camera looks horizontally.

### 5.2 Paper (contact sheet)

- `BoxGeometry` 0.231 × 0.00025 × 0.294. Top face = scan. Side faces = `#f4f2ee`.
- `MeshPhysicalMaterial` (top face; sides stay `MeshStandardMaterial`): map = scan (sRGB), roughness 0.4, specularIntensity 0.5, envMapIntensity 0.6. The prints are resin-coated Ilford Pearl: smooth and semi-matte, so no grain maps. specularIntensity 0.5 keeps the bright room's sheen from greying the blacks: they render ~9/255, like the scans. (Was `MeshStandardMaterial`, roughness 0.55, with a paperGrain roughness and normal map.)
- Scan texture: `anisotropy = renderer.capabilities.getMaxAnisotropy()`, mipmaps on.
- `castShadow`, `receiveShadow`.
- Slight cupping: not needed on the paper. The acetate carries the wave.

### 5.3 Acetate

Geometry
- `PlaneGeometry` 0.239 × 0.304, segments 60 × 80. Local frame: hinge along the top edge at v = 0, free edge at v = 1 (u across width, −1..1).
- Keep the flat rest positions in a copy. Rebuild positions every frame from formulas (5.5), never accumulate.
- `frustumCulled = false` (bounds change every frame).

Material — `MeshPhysicalMaterial`

| Property | Value | Note |
|---|---|---|
| color | `#f3f1ec` | faint warm-grey tint; with thickness 0 this is the only tint |
| transmission | 1.0 | |
| thickness | 0.0 | no refraction offset, Fresnel kept |
| ior | 1.48 | cellulose acetate |
| roughness | 0.08 | roughnessMap = smudge (0.04–0.25). Above ~0.1 the frames go soft. |
| metalness | 0 | |
| clearcoat | 1.0 | |
| clearcoatRoughness | 0.08 | |
| normalMap | scratch+crease | normalScale 0.05 (range 0.02–0.08) |
| envMapIntensity | 1.0 | |
| side | `DoubleSide` | seen from both sides mid-flip |
| castShadow | false | a transmissive mesh casts a solid shadow; fake it instead (5.7) |

Edges
- Thin bright rim: `Line2` + `LineMaterial` (three addons), linewidth 1.5 px, color `#ffffff`, transparent, opacity 0.35, along the sheet outline. Copy its positions each frame from the deformed grid's outer ring. Set `LineMaterial.resolution` on resize.

### 5.4 Tape

- Two strips, each 0.0125 × (0.239 + 0.010) m.
  - `tapePaper`: static, on the paper side of the hinge, y = paper top + 0.0001.
  - `tapeAcetate`: on the acetate side, parented to an `Object3D` at the hinge that rotates by θ. The acetate has zero sag at the hinge, so they agree.
- Optional seam cover: cylinder radius 0.5 mm along the hinge, same material.
- `MeshStandardMaterial`: map/roughnessMap/alphaMap = kraft, roughness 0.95, normalMap = paperGrain tiled 3×, normalScale 0.3, `alphaTest` 0.5, `DoubleSide`. `castShadow`.

### 5.5 Acetate deformation formulas

Local coords per vertex: `x` across (−W/2..W/2), `d` = distance from hinge (0..H), `u = d / H`.

```
// rest shape (meters). Lift only: zRest >= 0 everywhere.
env      = smoothstep(0, 0.35, u)                   // tape holds it flat near the hinge
wave     = 0.0012 * (0.5 + 0.5 * sin(2π x / 0.11 + 1.3)) * env
         + 0.0004 * (0.5 + 0.5 * sin(2π x / 0.045 + 0.4)) * env
curl     = 0.004 * max(0, u - 0.7)^2 / 0.09
         * smoothstep(0.25, 0.5, |x| / (W/2))      // free corners lift
zRest    = wave + curl

// height off the surface: on paper when closed, on table when open
z0       = lerp(paperThickness + gap, gap, θ / π)   // gap = 0.0003

// sag: far vertices lag the hinge during motion (ω = angular velocity)
sag      = clamp(-ω * 0.035 * u², -0.2, 0.2)
θv       = θ + sag

// rotate about the hinge (x axis of the sheet)
// |cos| keeps the bulge facing away from the surface on both sides.
// Physically a hack; visually right, and nothing ever dips below the surface.
y' = z0 + zRest * |cos(θv)| + d * sin(θv)
z' = d * cos(θv) - zRest * sin(θv)     // measured from the hinge line, positive toward the viewer
```

Then `positions.needsUpdate = true`, `computeVertexNormals()`, `computeBoundingSphere()` (raycasting uses the bounding sphere).

Tunables: wave amplitudes, wavelengths, curl height, sag gain 0.035, gap.

### 5.6 Lighting

- `scene.environment` = PMREM of `RoomEnvironment` (or the HDRI).
- Key: `DirectionalLight` intensity 1.5 from upper-left-front (e.g. position (−0.6, 1.2, 0.8) relative to the sets' center), `castShadow`, shadow map 2048, shadow camera fitted tightly to the two sets plus the open-acetate area, `shadow.radius` 3, bias tuned to remove acne on the paper.
- Fill: `HemisphereLight` sky `#ffffff` ground `#d9d3c7` intensity 0.35.
- Tone mapping exposure 0.5 (was 1.0, which washed the prints out), then a black point of 0.05 in display space (≈ 13/255): values at or below it go to black, white stays white. This clears the milky sheen over the prints' blacks.

### 5.7 Shadows and contact

- Paper and tape cast real shadows.
- Acetate: two footprintShadow decals (`MeshBasicMaterial`, color `#000`, transparent, depthWrite false), one at the closed footprint, one at the open footprint. Opacity closed = 0.12 · (1 − θ/π), open = 0.10 · θ/π. Slight offset toward the key light's shadow direction (2 mm).
- Optional: darken a 2 mm band under the acetate's free corners where the curl lifts.

---

## 6. Interaction spec

### 6.1 Flip (per set)

State: `closed | dragging | settling | open`. Variables: `θ` (0..π), `ω`.

Grab
- Raycast on pointer move; over an acetate → cursor `grab`.
- `pointerdown` on an acetate: `setPointerCapture`, state = `dragging`. Record `d0` = grabbed point's distance from the hinge (use `max(d0, 0.05)` so grabs near the hinge are not twitchy). Cursor `grabbing`.

Drag
- Each frame: project the pointer onto the table plane (y = 0). `s` = signed distance from the hinge line, positive on the closed side.
- `θ_target = acos(clamp(s / d0, -1, 1))`. The grabbed point stays under the pointer.
- `ω = (θ_target − θ) / dt` (clamped), `θ = θ_target`.
- All math is in world units, so drag feels the same at any zoom.

Release
- `predicted = θ + ω * 0.15`. Target = `predicted > π/2 ? π : 0`. State = `settling`.
- Spring per frame: `ω += (K (target − θ) − D ω) dt; θ += ω dt` with `K = 140`, `D = 20` (slight overshoot = the sheet lands and bounces once). Settle when |target − θ| < 0.002 and |ω| < 0.01 → state `open`/`closed`.

Click
- pointerdown→up with < 4 px movement and < 200 ms: toggle flip (spring to the other state).

Keyboard
- `1` / `2`: toggle set A / B.

### 6.2 Zoom and pan

- `OrbitControls`: `enableRotate = false`, `enablePan = true`, `enableDamping = true`, `dampingFactor = 0.08`, `zoomToCursor = true`, `screenSpacePanning = false` (pan stays on the table plane).
- `minDistance = 0.06` (one 24 mm frame fills ~60% of the screen height), `maxDistance = 1.4` (both sets plus open acetates fit).
- After each `controls.update()`, clamp `controls.target.x` to ±0.43 and `target.z` to [−0.51, 0.37]. Move the camera by the same delta so the tilt never changes.
- Pan with a middle-button (or right-button) drag, or a two-finger drag on touch. The left button and one-finger touch never pan; they are reserved for grabbing the acetate (flip, later shown with a virtual hand).
- Wheel / trackpad pinch = zoom. HTML buttons `−` `+` `Reset` top-right. Keys `+`, `−`, `0` reset. Double-click on empty table = reset.
- Transmission resolution follows zoom: `renderer.transmissionResolutionScale` = 0.5 when distance > 0.5, 1.0 when < 0.25, lerp between. If the property does not exist in the installed three version, skip this and note it.

### 6.3 Pointer parallax (reflections move)

- On pointer move (not dragging): `scene.environmentRotation.y` = pointer.x · 3°, `.x` = pointer.y · 2°, lerped 0.08/frame. If `environmentRotation` is unavailable, tilt the world group ±1.5° instead.

### 6.4 UI overlay

- Bottom-left hint: "Drag the acetate to flip · Scroll to zoom · Middle-drag to pan". Fades after 6 s.
- Buttons top-right: `−` `+` `Reset`.
- Dev toggle `W`: wall variant (see 7.2).

---

## 7. Variants

### 7.1 Table (default)
As specified.

### 7.2 Wall
- Rotate the world group so the surface is vertical; camera looks horizontally, slight downward tilt 8°.
- Flip becomes hold-to-lift: clamp θ ≤ 110°. Release always springs back to 0 with `D = 14` (visible bounce). No `open` state.
- Gravity droop while lifted: far vertices hang back toward the wall, `θv = θ + sag − 0.15 · sin(θ) · u²`.
- Kept behind `config.surface = 'table' | 'wall'`.

---

## 8. Visual acceptance ("what done looks like")

- Closed, at rest: acetate reads as clear plastic. One or two soft, long highlight streaks follow the wave crests. Paper under it is fully readable, no more than ~5% darker. Bottom and side overhang show as a faint bright line. Tape is matte and fibrous.
- Moving the mouse slides the highlights across the acetate.
- Mid-flip (60°–120°): the sheet flashes near mirror-like; the table and paper are visible reflected in it.
- Landing: the sheet overshoots once and settles; the far edge lags the hinge during the motion.
- Open: acetate lies flat above the paper, slightly wavy, tape folded at the hinge, paper bare.
- Zoomed in: frames stay sharp, no shimmer or moiré on the scan, scratches and smudges become visible.
- Two sets never touch when both are open.

## 9. Performance budget

- ≥ 60 fps at 1440p on a mid laptop GPU (Iris Xe / Apple M1 class).
- Transmission at 0.5 scale when zoomed out.
- Scans ≤ 4096 px, procedurals ≤ 1024 px, HDRI 1K. Consider KTX2 later, not now.
- CPU deform: 2 × 4941 vertices per frame is fine. Do not subdivide beyond 60×80.
- If frame time > 20 ms for 2 s: drop transmission scale to 0.35, then clearcoat to 0.

---

## 10. Build order

Each milestone ends with: type-check + build pass, commit, short note on what to look at.

- **M0 — Scaffold.** Vite + TS + three. Canvas fills the window, resize handled. Renderer settings from §3. `RoomEnvironment`. Off-white table renders. `config.ts` exists with every number from this spec.
- **M1 — Paper.** Placeholder sheet generator. Paper box with scan, grain maps, anisotropy. Key + fill light, shadows on the table. Camera per §3. Both sets placed.
- **M2 — Flat acetate.** Physical material per 5.3, flat, closed. Verify Fresnel by temporarily rotating it 80° in a dev toggle. Footprint shadow decal.
- **M3 — Bend traces.** Rest-shape formulas, smudge/scratch/crease maps, rim edge. Tune until streaks look like bent plastic, not ripples on water.
- **M4 — Tape.** Two halves + kraft maps + torn ends. Hinge object rotates the acetate half.
- **M5 — Flip.** Grab, drag math, release snap, spring, sag, click toggle, keys 1/2, cursors.
- **M6 — View.** OrbitControls setup, bounds, buttons, keys, reset, transmission scale by zoom, pointer parallax.
- **M7 — Polish.** Dust decal, corner contact darkening, HDRI loader, wall variant behind the flag, perf pass, README.

---

## 11. Suggested file layout

```
index.html
src/
  main.ts                 // boot, loop, resize
  config.ts               // every tunable
  scene/
    renderer.ts
    camera.ts
    environment.ts        // RoomEnvironment / HDRI
    lighting.ts
    table.ts
    paper.ts
    acetate.ts            // geometry + material + deform()
    tape.ts
    set.ts                // assembles paper + acetate + tape + decals for one set
  interaction/
    flip.ts               // state machine, drag math, spring
    viewControls.ts       // OrbitControls wrapper, bounds, buttons, keys
    parallax.ts
  textures/
    placeholderSheet.ts
    procedural.ts         // noise, grain, smudge, scratch, kraft, decals
    loader.ts             // try real asset, fall back
  ui/
    overlay.ts
public/assets/            // sheet-a.jpg, sheet-b.jpg, env.hdr (user-supplied)
docs/SPEC.md
CLAUDE.md
```

## 12. Config defaults (put in `src/config.ts`)

```ts
export const config = {
  surface: 'table' as 'table' | 'wall',
  paper:   { w: 0.231, h: 0.294, t: 0.00025, roughness: 0.4 },
  acetate: { w: 0.239, h: 0.304, segX: 60, segY: 80, gap: 0.0003,
             ior: 1.48, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.08,
             normalScale: 0.05, tint: '#f3f1ec',
             wave1: { a: 0.0012, lambda: 0.11, phase: 1.3 },
             wave2: { a: 0.0004, lambda: 0.045, phase: 0.4 },
             curl: 0.004, sagGain: 0.035, sagMax: 0.2 },
  tape:    { w: 0.025, overhang: 0.005, color: '#b9834a', roughness: 0.95 },
  layout:  { setOffsetX: 0.1495, clearAbove: 0.30 },
  camera:  { fov: 35, tiltDeg: 0, distance: 0.9, minDistance: 0.06, maxDistance: 1.4,
             panX: 0.43, panZMin: -0.51, panZMax: 0.37 },
  flip:    { K: 140, D: 20, wallD: 14, releaseLookahead: 0.15, minGrabDist: 0.05,
             clickPx: 4, clickMs: 200 },
  light:   { keyIntensity: 1.5, fillIntensity: 0.35, shadowMap: 2048, exposure: 0.5, blackPoint: 0.05 },
  parallax:{ envYawDeg: 3, envPitchDeg: 2, lerp: 0.08 },
  perf:    { maxPixelRatio: 2, transmissionFar: 0.5, transmissionNear: 1.0 },
};
```

## 13. Assumptions

- "Preset flip" = single hinge axis with snap to open/closed. No free rotation, no dragging the sheet around.
- Scans arrive later. Placeholders assume 35 mm film (6 strips × 6 frames). Real scans replace them without code changes.
- Table is the primary target. Wall is secondary and may ship rough.
- Numbers in this spec are starting points. Tune by eye; keep the tuned values in `config.ts`.
