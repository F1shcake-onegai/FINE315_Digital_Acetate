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
- Two fixed sets, side by side. Each set = one contact sheet print + one clear acetate sheet, joined along one edge by brown kraft paper tape. (The tape is hidden for now at the user's request, 2026-09-29: the sheets still hinge along that edge, with nothing drawn there. See Tape in Decisions.)
- Content is static: two fixed scans. No upload or switching UI.
- Acetate is transparent but must read as plastic: reflections, Fresnel flash at grazing angles, faint smudges and scratches, bend streaks (glare stretched along waves in the sheet). (The user wants the sheet flat when it lies on the paper, 2026-09-30, so there are no waves at rest: glare sweeps along the sheet while it bends in motion.)
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
| Tape | Kraft paper tape, 0.025 m wide, runs the full top edge plus 5 mm past each end. Half lies on the acetate's top face; the other half wraps over the top edge onto the back of the paper (user, 2026-09-29), so the print's face stays bare when the sheet is open. (Was "12.5 mm on paper + 12.5 mm on acetate", which put the paper half under the closed acetate.) **Hidden for now (user, 2026-09-29):** `tape.visible` is false, so nothing is drawn at the hinge and the kraft texture isn't loaded. The strip, its fold and its textures stay in the code; `true` brings them back. |
| Hinge | Top edge = the edge farthest from the camera. Acetate flips away from the viewer and lies open on the table above the paper. |
| Layout | Sets centered at x = ±0.1495 (60 mm gap). Keep ≥ 0.30 m of clear table beyond the top edge for the open acetate. |
| Camera | PerspectiveCamera fov 35°, looking straight down (image plane parallel to the paper, tilt 0°; was 20°) at the center of both sets. Default distance 0.9 m. |
| Renderer | WebGLRenderer, ACES filmic tone mapping followed by a Levels-style black point (implemented as `CustomToneMapping` wrapping three's ACES), sRGB output, `PCFShadowMap` (soft via `shadow.radius`; `PCFSoftShadowMap` was removed in three r186), pixel ratio = min(devicePixelRatio, 2). |
| Environment | `RoomEnvironment` through `PMREMGenerator` by default. Optional real HDRI at `public/assets/env.hdr` (1K) loaded with `HDRLoader` if present (`RGBELoader` is its deprecated alias since r180). The acetate reflects its own procedural studio instead (`config.acetateStudio`, PMREM as the material's `envMap`). It is dark overhead, so the flat sheet never veils the prints (user: "highlights only"). Two thin strips 30° left and right of vertical, running front to back, light the sheet only at steep views near the screen's sides. (They were 18°, where the rest shape's wave crests caught them as streaks; once the sheet lay flat at rest (user) they veiled the outer quarter of each print, lifting its blacks from 16 to 25.) Larger softboxes 40–65° off vertical and a light floor provide glints and the grazing-angle flash. Pointer parallax rotates it too. |
| Deformation | Acetate vertices are transformed on the CPU every frame (rest shape + hinge rotation + sag), then `computeVertexNormals()`. Grid 60×80. |
| Scans | `public/assets/sheet-a.jpg` and `sheet-b.jpg`, same aspect as the paper (11:14), ≥ 4000 px long side. Procedural placeholder if missing. |
| Look (locked 2026-09-29) | The tonal look the user approved. Don't change it without their approval. `RoomEnvironment` (no HDRI), key light 1.5 at (−0.6, 1.2, 0.8), hemisphere fill 0.35, exposure 0.5, black point 0.05; prints roughness 0.4, specularIntensity 0.5, envMapIntensity 0.6; table `#ede8df`, roughness 0.92. Measured at the default view (1600 × 1000, 0.9 m): print blacks ≈ 9/255, blank white frame ≈ 222, table ≈ 217. Reference render: `docs/look-reference.jpg`. Later work (the acetate, HDRIs) is tuned on top of this look, never by moving these values. These keys are tagged `locked` in `src/config.ts`. |

---

## 4. Assets

### 4.1 User-supplied (may be missing at start)

- `public/assets/sheet-a.jpg`, `public/assets/sheet-b.jpg` — contact sheet scans.
- `public/assets/env.hdr` — optional. A room with a window or a softbox gives longer, nicer streaks than `RoomEnvironment`.
- `public/assets/acetate-a.png`, `acetate-b.png` — optional. The user's drawing on each acetate: white strokes on a transparent background, drawn on the scan's canvas (3300×4200, the scan as a hidden guide layer) so the strokes land over the photos. Painted on the sheet's top surface as opaque, matte white, following alpha; missing means a clear sheet.

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
| smudge | acetate roughnessMap + clearcoatRoughnessMap | Built instead from the ambientCG scans (user): fingerprints (Fingerprints001/002 roughness) shown only through 3–5 soft windows per sheet (seeded), plus a faint water-spot haze (SurfaceImperfections001 at 0.1). Was: base 0.06; 6–10 soft blurred ellipses up to 0.25; 2–3 fingerprint-like ridge blobs. |
| scratch | acetate clearcoatNormalMap | Built instead from the ambientCG Scratches005 mask (user): thresholded at 0.35 to keep real scratches (not the faint brushing), 1 px blur, height → normal, tiled every 0.15 m. Was: 30–60 thin random lines. |
| crease | acetate normalMap band, top 25 mm only | 3–5 faint lines parallel to the hinge (procedural; Gaussian ridges/valleys that drift slightly) |
| kraft | tape map + alphaMap | Color from the ambientCG Paper006 scan (CC0, `public/assets/tape/`), tinted so that its mean is `#b9834a`; the original recipe (fBm on `#b9834a`, ±8% value) is the fallback when the file is missing. Torn ends are a separate map on uv1: alpha 1 except past a jagged tear at each end (random slant plus angular noise), with a light fiber margin and loose fibers in R. No roughnessMap: at roughness 0.95 its variation doesn't show. |
| dust | optional decal | 20–40 tiny light specks, alpha |
| footprintShadow | soft shadow decal under acetate | rectangle with 8 mm soft edge, alpha 1 → 0 |

Scratches go on the clear coat (the glossy top surface, `clearcoatNormalMap`) and the crease on the base layer (`normalMap`), so scratches only show where light catches the surface. The spec originally combined both into one normal map.

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
| color | `#ffffff` | neutral clear (user choice; was `#f3f1ec`, which darkened the prints ~8%) |
| transmission | 0.985 | just under 1: a faint milky scatter, since the user's acetate is "clear, slightly hazy" |
| thickness | 0.0 | no refraction offset, Fresnel kept |
| ior | 1.48 | cellulose acetate |
| roughness | 0.12 | slightly hazy (user): broadens the base layer's sheen (what's seen through the sheet is set by the haze row below); the clearcoat keeps highlights crisp. Was 0.08 (clear). roughnessMap = smudge: up to 0.3 under the heaviest fingerprint (clearcoatRoughness 0.08 → 0.2 likewise). |
| haze (what's seen through) | glow 15%, up to 60% under fingerprints; glow at mip 2 | Replaces three's blur of what's seen through a transmissive surface, a mip level tied to roughness, which smeared the prints even through clean plastic (at 0.5 of it: edges 3 px at 1600 px, too blurry, user). Slightly hazy plastic lying on a print passes it sharp and scatters a little light into a soft glow. So a shader patch samples the print sharp and mixes in a quarter-resolution copy: 15% everywhere for a touch of softness, rising with the smudge map's roughness so fingerprints read milky rather than smeared. Reflections keep the full roughness. |
| metalness | 0 | |
| clearcoat | 1.0 | |
| clearcoatRoughness | 0.08 | |
| normalMap | crease | normalScale 0.05 (range 0.02–0.08) |
| clearcoatNormalMap | scratches | clearcoatNormalScale 0.1 |
| transmissionMap, clearcoatMap, specularIntensityMap | the user's drawing, as 1 − alpha | where there is paint the sheet is opaque, matte white (no transmission, clear coat or specular); placed over the paper area |
| envMapIntensity | 1.0 | on the acetate's own reflection environment (`envMap`), not the room: see Environment in Decisions |
| side | `DoubleSide` | seen from both sides mid-flip |
| castShadow | false | a transmissive mesh casts a solid shadow; fake it instead (5.7) |

Edges
- Thin bright rim: `Line2` + `LineMaterial` (three addons), linewidth 1.5 px, color `#ffffff`, transparent, opacity 0.35, along the sheet outline. Copy its positions each frame from the deformed grid's outer ring. Set `LineMaterial.resolution` on resize.

### 5.4 Tape

Hidden for now (user): with `config.tape.visible` false none of this is built or loaded. As built in M4:

- One strip, 0.025 m across × (0.239 + 0.010) m long, posed on the CPU together with the acetate. Across the tape, starting from its free edge on the acetate:
  - Acetate half: on the sheet's top face, 0.1 mm above it (the tape's thickness), turning rigidly with θ about the sheet's hinge line (§5.5 z0). The acetate has zero sag at the hinge, so they agree.
  - Fold: bends around the top edge as a cubic Bézier rebuilt from θ, with circular-arc handles for the turn between the two halves. It makes half a turn around the stacked edges when closed (paper and acetate edges are aligned) and is nearly straight when open.
  - Paper half: glued to the back of the paper, static, 0.1 mm above the table (inside the paper's box, which hides it). Only its ends show, as flaps past the paper's sides once the sheet opens.
  - Normals are analytic (perpendicular to the strip's cross-section), so the glued halves shade flat.
  - (Was: two strips, `tapePaper` on the paper's face and `tapeAcetate` on a hinge `Object3D`, plus an optional 0.5 mm seam cylinder.)
- Ends are hand-torn, via the tear map on uv1 (§4.3). The two layers show different stretches of the same tear, so in places the wrapped layer's edge peeks out past the top one.
- `MeshStandardMaterial`: map = kraft (tiled every 0.1 m in table space, skewed so that no tile repeats along a tape), roughness 0.95, normalMap = paperGrain tiled 3× along the tape, normalScale 0.3, alphaMap = tear map, `alphaTest` 0.5, `DoubleSide`. `castShadow`, `receiveShadow`.
- A shader patch lightens the fiber margin along each tear and darkens the adhesive side (back faces): paper glued to film, seen through the open acetate, looks darker and richer, like damp paper (albedo^1.25).

### 5.5 Acetate deformation formulas

Local coords per vertex: `x` across (−W/2..W/2), `d` = distance from hinge (0..H), `u = d / H`.

```
// rest shape (meters). Lift only: zRest >= 0 everywhere.
// Flat at rest (user, 2026-09-30: "the acetate is usually flat on paper"): the amplitudes below
// are 0 in config (wave1.a, wave2.a, curl). M3 used 0.0012, 0.0004 and 0.004, shown here.
env      = smoothstep(0, 0.35, u)                   // tape holds it flat near the hinge
wave     = 0.0012 * (0.5 + 0.5 * sin(2π x / 0.11 + 1.3)) * env
         + 0.0004 * (0.5 + 0.5 * sin(2π x / 0.045 + 0.4)) * env
curl     = 0.004 * max(0, u - 0.7)^2 / 0.09
         * smoothstep(0.4, 1.0, |x| / (W/2))       // free corners lift (was 0.25–0.5: all but the middle 6 cm lifted, leaving a saddle that caught light)
zRest    = wave + curl

// height off the surface: on paper when closed, on table when open
z0       = lerp(paperThickness + gap, gap, θ / π)   // gap = 0.0003

// The user wants the sheet to flex a little while flipped, in smooth curves that never crease
// ("no carvings"). The spec's sag, clamp(-ω * 0.035 * u², ±0.2), creased the sheet where the
// clamp cut in and curled the free edge rather than bending the sheet.

// sag: the sheet trails its motion in one even arc (ω = angular velocity). The arc's strength
// saturates smoothly: the free edge's chord angle trails at most 0.22, its tangent twice that.
trail    = 0.22 * tanh(ω * 0.05 / 0.22)
sag      = -trail * (u - u_pivot)
         // u_pivot = u_grip * held. held eases to 1 while the sheet is dragged (0.12 s) and back
         // to 0 once let go. While held the arc passes through the grabbed point, which stays put.

// droop: a held sheet bends under its own weight, toward the table on the side it leans
// (cos θ): it peels off the paper as it's lifted, hangs straight when upright, lies flat when down.
// θ is the angle of the line from the hinge to the grabbed point, which the droop leaves alone.
// Between hinge and hand it sags in a parabola (leaving the hinge flatter than that line,
// reaching the hand steeper); past the hand the free part carries on and hangs (hang = 2).
droop    = -0.3 * held * cos(θ) * (u <= u_grip ? u_grip - u
                                  : (u - u_grip) * (hang * (u - u_grip) / 2 - u_grip) / u)

// never through the paper (0) or the table (π); where a bending sheet meets them it rounds onto
// the surface over an angle of 0.5 * |sag + droop| (a smooth blend) instead of folding
θv       = ontoSurface(θ + sag + droop)

// rotate about the hinge (x axis of the sheet)
// |cos| keeps the bulge facing away from the surface on both sides.
// Physically a hack; visually right, and nothing ever dips below the surface.
y' = z0 + zRest * |cos(θv)| + d * sin(θv)
z' = d * cos(θv) - zRest * sin(θv)     // measured from the hinge line, positive toward the viewer
```

Then `positions.needsUpdate = true`, `computeVertexNormals()`, `computeBoundingSphere()` (raycasting uses the bounding sphere).

Tunables: wave amplitudes, wavelengths, curl height, sag gain 0.05 and max 0.22, droop 0.3 and hang 2, contact softness 0.5, gap. Each vertex sits at its distance from the hinge along its angle θv, so a bent sheet stretches slightly (a few percent at the strongest bend): unnoticeable in motion.

### 5.6 Lighting

- `scene.environment` = PMREM of `RoomEnvironment` (or the HDRI).
- Key: `DirectionalLight` intensity 1.5 from upper-left-front (e.g. position (−0.6, 1.2, 0.8) relative to the sets' center), `castShadow`, shadow map 2048, shadow camera fitted tightly to the two sets plus the open-acetate area, `shadow.radius` 3, bias tuned to remove acne on the paper.
- Fill: `HemisphereLight` sky `#ffffff` ground `#d9d3c7` intensity 0.35.
- Tone mapping exposure 0.5 (was 1.0, which washed the prints out), then a black point of 0.05 in display space (≈ 13/255): values at or below it go to black, white stays white. This clears the milky sheen over the prints' blacks.

### 5.7 Shadows and contact

- Paper and tape cast real shadows.
- Acetate: two footprintShadow decals (`MeshBasicMaterial`, color `#000`, depthWrite false), one at the closed footprint, one at the open footprint. Opacity closed = 0.12 · (1 − θ/π), open = 0.10 · θ/π. Slight offset toward the key light's shadow direction (2 mm). They draw in the opaque pass (`transparent: false`, CustomBlending with three's NormalBlending factors including alpha, renderOrder 1), because three's transmission pass only captures opaque objects: a transparent decal would vanish under the sheet. Keeping the alpha factors matters too, since three always creates the canvas with an alpha channel.
- Optional: darken a 2 mm band under the acetate's free corners where the curl lifts.

---

## 6. Interaction spec

### 6.1 Flip (per set)

State: `closed | dragging | settling | open`. Variables: `θ` (0..π), `ω`.

Grab
- Raycast on pointer move, against each sheet as the flat rectangle through its hinge at its current angle (waves and sag move it by millimeters). Over an acetate the pointer becomes a drawn hand (user; `src/ui/cursors/`), open while hovering. It replaces the spec's `grab` / `grabbing` cursors, and is a page element rather than a CSS cursor so it keeps its size on any display. It isn't shown for touch.
- `pointerdown` on an acetate: `setPointerCapture`, state = `dragging`. Record `d0` = grabbed point's distance from the hinge (use `max(d0, 0.05)` so grabs near the hinge are not twitchy). The hand pinches, its pinch point on the grabbed point. When `d0` was raised to 0.05, the sheet turns about an axis moved back along it, so the grabbed point starts on its circle and nothing jumps.

Drag
- Each frame: project the pointer onto the table plane (y = 0). `s` = signed distance from the hinge line, positive on the closed side. `θ_projected = acos(clamp(s / d0, -1, 1))`.
- From straight above, that projection leaves a lifted edge up to ~7 cm from the pointer on screen (at 90°, default view). So away from the table the grabbed point follows the pointer exactly: the pointer's ray is met with the circle the grabbed point sweeps, seen along the hinge (the ray's first crossing of its upper half). Near closed and open the exact answer folds back: lifting a point first moves it away from the view's center, so it would jump. There the projection rules. The two blend by the sheet's current angle over 30° (`trackBlendDeg`), so a grab never jumps, whether the sheet lies flat or is caught mid-swing. The projection alone is used when the camera is inside the circle (zoomed in closer than the grab's reach). Measured at max zoom-out: exact from 30° to 150°, within 17 px (~15 mm) near the ends.
- `ω = (θ_target − θ) / dt`, clamped to ±20 rad/s and eased with a 0.05 s time constant so sag and the release don't flicker; `θ = θ_target`.
- While held, sag pivots at the grabbed point and the sheet droops under its weight between the hinge and the hand (§5.5); both leave the grabbed point under the hand.
- All math is in world units, so drag feels the same at any zoom. At the default view a sheet passes ~95° with the pointer at the window's top; dragging on beyond the window or releasing there both open it.

Release
- `predicted = θ + ω * 0.15`. Target = `predicted > π/2 ? π : 0`. State = `settling`.
- Spring per frame: `ω += (K (target − θ) − D ω) dt; θ += ω dt` with `K = 140`, `D = 16` (was 20, which let the sheet creep onto the table with no visible overshoot). A sheet that reaches the table (π) or the paper (0) bounces off it, keeping 0.3 of its speed: it lands after ~0.25 s, its free edge rebounds 5–15 mm, and it settles by ~0.65 s. Settle when |target − θ| < 0.002 and |ω| < 0.01 → state `open`/`closed`.
- After release the hand's hold eases off (0.12 s): the droop fades and sag's pivot moves back to the hinge, so the far edge lags as §5.5 describes without a jump.
- Time steps are capped at 0.05 s, and three's `Timer` skips the gap after a hidden tab.

Click
- pointerdown→up with < 4 px movement and < 200 ms: toggle flip (spring to the other state).
- Double-clicking an acetate doesn't reset the view (it flips twice); double-clicking the table does.

Keyboard
- `1` / `2`: toggle set A / B.

Touch
- One finger drags or taps an acetate. A second finger lets go of the sheet, so pinch zoom and two-finger pan take over.

### 6.2 Zoom and pan

- `OrbitControls`: `enableRotate = false`, `enablePan = true`, `enableDamping = true`, `dampingFactor = 0.08`, `zoomToCursor = true`, `screenSpacePanning = false` (pan stays on the table plane).
- `minDistance = 0.06` (one 24 mm frame fills ~60% of the screen height), `maxDistance = 1.4` (both sets plus open acetates fit).
- After each `controls.update()`, clamp `controls.target.x` to ±0.43 and `target.z` to [−0.51, 0.37]. Move the camera by the same delta so the tilt never changes.
- Pan with a middle-button (or right-button) drag, or a two-finger drag on touch. The left button and one-finger touch never pan; they grab the acetate (flip, shown with the hand pointer).
- Wheel / trackpad pinch = zoom. HTML buttons `−` `+` `Reset` top-right. Keys `+`, `−`, `0` reset. Double-click on empty table = reset.
- Transmission resolution follows zoom: `renderer.transmissionResolutionScale` = 1.0 up to 1.0 m, lerping to 0.5 at 1.4 m (max zoom-out). The original 0.5 above 0.5 m blurred the prints under the sheet to mush at the default 0.9 m view (edge width 7 px vs 4 px at full resolution). The §9 slow-frame fallback still applies.

### 6.3 Pointer parallax (reflections move)

- On pointer move (not dragging): `scene.environmentRotation.y` = pointer.x · 3°, `.x` = pointer.y · 2°, lerped 0.08/frame. If `environmentRotation` is unavailable, tilt the world group ±1.5° instead.

### 6.4 UI overlay

- Bottom-left hint: removed at the user's request (2026-09-30). Was "Drag the acetate to flip · Scroll to zoom · Middle-drag to pan", fading after 6 s.
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

- Closed, at rest: acetate lies flat on the paper and reads as clear plastic: a faint haze and its bright overhang edges, with no streaks or veil (user). Paper under it is fully readable, no more than ~5% darker (measured 1–3% on midtones and whites). Bottom and side overhang show as a faint bright line. Tape (when shown) is matte and fibrous, wrapped over the top edge, with torn ends.
- Moving the mouse slides the highlights across the acetate.
- Mid-flip (60°–120°): the sheet flashes near mirror-like; the table and paper are visible reflected in it.
- Landing: the sheet overshoots once and settles; the far edge lags the hinge during the motion.
- Open: acetate lies flat above the paper, slightly wavy, paper bare. With the tape shown, it lies under the sheet's hinge edge (glued side seen through the plastic).
- Zoomed in: frames stay sharp, no shimmer or moiré on the scan, scratches and smudges become visible.
- Two sets never touch when both are open.

## 9. Performance budget

- ≥ 60 fps at 1440p on a mid laptop GPU (Iris Xe / Apple M1 class).
- Transmission at 0.5 scale when zoomed out.
- Scans ≤ 4096 px, procedurals ≤ 1024 px, HDRI 1K. Consider KTX2 later, not now.
- CPU deform: 2 × 4941 vertices per frame is fine. Do not subdivide beyond 60×80.
- If frame time > 20 ms for 2 s: drop transmission scale to 0.35, then clearcoat to 0. Each step is logged to the console; slow frames count from 3 s after the scene is ready, once shaders have compiled and textures uploaded (`src/scene/quality.ts`).

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
             ior: 1.48, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08,
             normalScale: 0.05, tint: '#ffffff',
             wave1: { a: 0, lambda: 0.11, phase: 1.3 },
             wave2: { a: 0, lambda: 0.045, phase: 0.4 },
             curl: 0, sagGain: 0.05, sagMax: 0.35 },
  tape:    { w: 0.025, overhang: 0.005, color: '#b9834a', roughness: 0.95 },
  layout:  { setOffsetX: 0.1495, clearAbove: 0.30 },
  camera:  { fov: 35, tiltDeg: 0, distance: 0.9, minDistance: 0.06, maxDistance: 1.4,
             panX: 0.43, panZMin: -0.51, panZMax: 0.37 },
  flip:    { K: 140, D: 16, wallD: 14, releaseLookahead: 0.15, minGrabDist: 0.05,
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
