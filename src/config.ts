/**
 * Every tunable number lives here: docs/SPEC.md §12 plus every other number the spec names.
 * Scene code reads this object and keeps no magic numbers of its own.
 *
 * Units: meters, radians and seconds unless the key says otherwise (…Deg, …Px, …Mm, …Ms, …S).
 * World frame: Y up, table surface at y = 0, origin = center of both sets.
 * Each set's hinge (the taped top edge) is its far edge, toward −z; the viewer is on +z.
 * "(not in spec)" marks starting values picked during implementation. Tune by eye.
 *
 * "locked" marks the tonal look the user approved on 2026-09-29 (docs/SPEC.md → Decisions →
 * Look; reference render docs/look-reference.jpg). Don't change those without the user's approval.
 */
export const config = {
  surface: 'table' as 'table' | 'wall',

  // §3, §5.2 — the real prints, measured from the scans' film edge print (38 mm per frame);
  // 11:14 like the scans. The spec started at 8×10 in (0.203 × 0.254).
  paper: {
    // Resin-coated pearl paper (Ilford MG RC Pearl): smooth and semi-matte, no grain.
    // The spec had roughness 0.55 with a paperGrain normal and roughness map.
    w: 0.231, h: 0.294, t: 0.00025,
    roughness: 0.4,         // locked
    // (not in spec) Half-strength reflection: the bright room's sheen had turned the prints'
    // blacks grey (29/255); at 0.5 they render ~9, matching the scans. Midtones and whites stay.
    specularIntensity: 0.5, // locked
    envMapIntensity: 0.6,   // locked
    edgeColor: '#f4f2ee',   // side faces of the box
  },

  // §3, §5.3, §5.5 — paper + 4 mm overhang left/right + 10 mm at the bottom; top edges
  // aligned at the hinge.
  acetate: {
    w: 0.239, h: 0.304, segX: 60, segY: 80, gap: 0.0003,
    ior: 1.48, clearcoat: 1, clearcoatRoughness: 0.08,
    // Clear but slightly hazy (user): the base roughness softens what's seen through the sheet
    // (spec 0.08 is clear; above ~0.1 the frames go soft) while the clearcoat keeps the surface
    // highlights crisp; transmission just under 1 adds a faint milky scatter.
    roughness: 0.12,
    transmission: 0.985,
    // (not in spec) Scales three's roughness-driven blur of what's seen through the sheet (1 = three).
    // three blurs even clear plastic noticeably; this keeps the prints a touch soft, not smeared.
    transmissionBlur: 0.5,
    normalScale: 0.05,
    tint: '#ffffff',        // neutral clear (user); spec had a faint warm #f3f1ec
    wave1: { a: 0.0012, lambda: 0.11, phase: 1.3 },
    wave2: { a: 0.0004, lambda: 0.045, phase: 0.4 },
    curl: 0.004, sagGain: 0.035, sagMax: 0.2,
    thickness: 0.0,         // no refraction offset, Fresnel kept
    metalness: 0,
    envMapIntensity: 1.0,
    normalScaleRange: { min: 0.02, max: 0.08 },
    roughnessMapRange: { min: 0.04, max: 0.25 },  // smudge map; above ~0.1 the frames go soft
    holdEnd: 0.35,          // env = smoothstep(0, holdEnd, u): the tape holds it flat near the hinge
    curlStart: 0.7,         // curl grows from u = curlStart to `curl` at the free edge
    // smoothstep over |x| / (W/2): only the free corners lift. Spec 0.25–0.5 lifted all but the
    // middle 6 cm of the free edge, leaving a saddle that caught light as a bright "Λ".
    curlCorner: { min: 0.4, max: 1.0 },
    rim: { widthPx: 1.5, color: '#ffffff', opacity: 0.35 },
    fresnelTestDeg: 80,     // M2 dev toggle: tilt the flat sheet to check the Fresnel flash

    // M3 wear, from the ambientCG scans (user), composed per sheet into a few marks instead of
    // tiling the dense scans. (not in spec: the spec generates these procedurally, §4.3)
    wear: {
      fingerprints: ['assets/wear/Fingerprints001_Roughness.png', 'assets/wear/Fingerprints002_Roughness.png'],
      spots: 'assets/wear/SurfaceImperfections001_Opacity.png',
      scratches: 'assets/wear/Scratches005_Opacity.png',
      mapPx: 1024,          // long side of each sheet's baked smudge map
      seeds: [11, 23],      // per sheet (A, B)
      fingerprintTile: 0.125,                     // m of sheet per fingerprint tile: prints ≈ 16 mm
      fingerprintWindows: { min: 3, max: 5 },     // soft windows the fingerprints show through
      windowRadius: { min: 0.012, max: 0.028 },   // m
      windowFeather: 0.6,                         // fraction of a window's radius that fades out
      spotsTile: 0.2, spotsWeight: 0.1,           // faint water-spot haze everywhere
      smudgeRoughness: 0.3, // base and clearcoat roughness scale up to this under the heaviest smudge
      scratchTile: 0.15,    // m of sheet per scratch tile
      scratchThreshold: 0.35, // mask level below which it's faint brushing, not a scratch: dropped
      scratchBlurPx: 1,     // soften the scratch mask so its normals don't stipple
      scratchSlopeRms: 0.6, // scratch normal-map strength before clearcoatNormalScale
      scratchNormalScale: 0.1,
    },

    // The user's drawing: white strokes on a transparent PNG, drawn over the scan (same canvas),
    // painted on the sheet's top surface as opaque matte white. Optional; missing = clear sheet.
    artwork: ['assets/acetate-a.png', 'assets/acetate-b.png'],
  },

  // §3, §5.4 — kraft paper tape, half on the paper and half on the acetate.
  tape: {
    w: 0.025, overhang: 0.005, color: '#b9834a', roughness: 0.95,
    lift: 0.0001,           // above the paper top
    seamRadius: 0.0005,     // optional cylinder over the hinge seam
    normalRepeat: 3,        // paperGrain tiling
    normalScale: 0.3,
    alphaTest: 0.5,
  },

  // §3 — setOffsetX = 0.030 + acetate.w / 2, so the acetates end up 60 mm apart.
  layout: { setOffsetX: 0.1495, clearAbove: 0.30 },

  // §5.1 — 4 m (spec: 2 m) so the top-down view never reaches the edge at max zoom-out and
  // pan; paperGrain tiles every 0.25 m either way.
  table: {
    size: 4, normalRepeat: 16, normalScale: 0.1,
    color: '#ede8df', roughness: 0.92,  // locked
  },

  // §3, §6.2
  camera: {
    fov: 35, tiltDeg: 0, distance: 0.9, minDistance: 0.06, maxDistance: 1.4,
    // Pan bounds keep the spec's margins around the sets and the open acetates.
    panX: 0.43, panZMin: -0.51, panZMax: 0.37,
    dampingFactor: 0.08,
    zoomStep: 1.25,         // (not in spec) distance factor per −/+ button or key press
    near: 0.01, far: 10,    // (not in spec)
  },

  // §6.1, §7.2
  flip: {
    K: 140, D: 20, wallD: 14, releaseLookahead: 0.15, minGrabDist: 0.05,
    clickPx: 4, clickMs: 200,
    settleAngle: 0.002, settleOmega: 0.01,
  },

  // §5.6
  light: {
    shadowMap: 2048,
    keyIntensity: 1.5, fillIntensity: 0.35,  // locked
    // exposure: spec starts at 1.0, which rendered the prints' midtones ~60 levels brighter than the
    // scans and the table near white (238/255). At 0.5 midtones sit within ~10–15 of the scans.
    exposure: 0.5,          // locked
    // (not in spec) Levels black point after ACES, in display units 0–1 (0.05 ≈ 13/255); 0 = off.
    // Clears the milky sheen over the prints' blacks; whites are unaffected.
    blackPoint: 0.05,       // locked
    keyColor: '#ffffff',    // locked
    keyPosition: { x: -0.6, y: 1.2, z: 0.8 },  // locked; upper-left-front, relative to the sets' center
    fillSky: '#ffffff', fillGround: '#d9d3c7',  // locked
    shadowRadius: 3,
    shadowBias: -0.00005,   // (not in spec) no acne on the paper at this value
    shadowNormalBias: 0,    // (not in spec)
    shadowMargin: 0.02,     // (not in spec) padding around the fitted shadow camera
  },

  // §5.7
  contact: {
    closedOpacity: 0.12, openOpacity: 0.10,
    lightOffset: 0.002,     // decal shift along the key light's shadow direction
    cornerBand: 0.002,      // optional dark band under the lifted free corners
    decalLift: 0.00005,     // (not in spec) decal height above the table, under the paper top
    color: '#000000',
  },

  // §3
  environment: {
    roomBlur: 0.04,         // locked; (not in spec) PMREM sigma for RoomEnvironment
    hdrIntensity: 1,        // (not in spec) scene.environmentIntensity when env.hdr is used
  },

  // (not in spec) What the acetate reflects: its own small studio, so the sheet shows highlights
  // without veiling the prints (user: "highlights only"). Overhead is dark apart from two thin
  // strips: the spec's waves tilt the sheet sideways by up to ~3.6°, swinging reflections up to
  // ~7° left or right, so strips 18° off vertical to the left and right, running front to back,
  // are caught on each sheet's outer wave crests as long streaks, while flat areas stay dark.
  // Larger softboxes 40–65° off vertical light the tilted sheet (flash, glints); the light floor
  // stands in for the table in grazing reflections. Positions are directions from the reflection
  // probe (room units); width runs along the panel's horizontal axis; intensities are HDR radiance.
  acetateStudio: {
    roomSize: 20,
    wallColor: '#0b0b0b',
    floor: { color: '#ede8df', intensity: 1.2 },
    blur: 0.02,             // PMREM sigma
    softboxes: [
      { position: { x: -2.8, y: 8.6, z: 0 }, width: 8, height: 0.8, intensity: 2 },  // streak strip, left
      { position: { x: 2.8, y: 8.6, z: 0 }, width: 8, height: 0.8, intensity: 2 },   // streak strip, right
      { position: { x: -6, y: 7, z: 5 }, width: 6, height: 4, intensity: 8 },        // key side, upper-left-front
      { position: { x: 0, y: 8, z: -6.5 }, width: 12, height: 1.2, intensity: 10 },  // long strip over the far side
      { position: { x: 9, y: 4, z: -1 }, width: 3, height: 6, intensity: 5 },        // right-hand fill
    ],
  },

  // §6.3
  parallax: { envYawDeg: 3, envPitchDeg: 2, lerp: 0.08, fallbackTiltDeg: 1.5 },

  // §6.2, §9
  perf: {
    maxPixelRatio: 2, transmissionFar: 0.5, transmissionNear: 1.0,
    // Distances for the transmission scale (spec: 0.5 / 0.25 m). At the spec's half resolution the
    // prints under the sheet turned to mush at the default 0.9 m view, so it stays full resolution
    // out to 1.0 m and only drops toward 0.5 at max zoom-out; M7's slow-frame fallback remains.
    transmissionFarDist: 1.4,   // camera distance at and above which transmission uses transmissionFar
    transmissionNearDist: 1.0,  // …at and below which it uses transmissionNear; lerp between
    slowFrameMs: 20, slowForS: 2,
    degradedTransmission: 0.35, // first fallback when slow; then clearcoat → 0
  },

  // §6.4
  ui: {
    hint: 'Drag the acetate to flip · Scroll to zoom · Middle-drag to pan',
    hintFadeS: 6,
  },

  // §7.2
  wall: { tiltDeg: 8, maxLiftDeg: 110, droop: 0.15 },

  // §3, §4.1, §9 — paths are relative to the site root (files live in public/).
  assets: {
    sheetA: 'assets/sheet-a.jpg', sheetB: 'assets/sheet-b.jpg', env: 'assets/env.hdr',
    scanMinPx: 4000, scanMaxPx: 4096,       // larger scans are downscaled to scanMaxPx
    aspectTolerance: 0.02,  // (not in spec) warn when a scan isn't 8×10 within this fraction
  },

  // §4.2 — procedural contact sheet, drawn in mm.
  placeholder: {
    pxPerMm: 11.8,                          // canvas resolution; the canvas is sized to the paper
    seedA: 1, seedB: 2,                     // (not in spec) sheet B = different seed
    borderMm: 6, borderColor: '#f2f0ea',    // white easel border
    exposedColor: '#0a0a0a',                // fully exposed paper
    vignette: 0.4,                          // (not in spec) corner darkening of the exposed area, 0–1
    strips: 6, stripMm: 35, stripGapMm: 6,
    // Spec says 6, but six frames at the 38 mm film pitch (226 mm) are wider than the 219 mm image
    // area inside the easel border; five (188 mm) fit. At 6 the border crops both end frames.
    framesPerStrip: 5,
    stripColor: '#1c1c1c',                  // film rebate
    stripJitterMm: 0.4, stripJitterDeg: 0.15,  // (not in spec) hand-laid strips
    sprocket: {
      color: '#080808', alongMm: 2.8, pitchMm: 4.75,
      acrossMm: 2.0,        // (not in spec) KS perforation is ≈ 2.8 × 2.0 mm
      edgeMm: 2.0,          // (not in spec) film edge to hole
      cornerMm: 0.5,        // (not in spec)
    },
    frame: {
      wMm: 36, hMm: 24, gapMm: 2, rects: { min: 2, max: 4 },
      cornerMm: 0.4,                        // (not in spec) film-gate corner radius
      tone: { min: 0.3, max: 0.7 },         // (not in spec) gradient ends; 0 = print black, 1 = paper white
      rectDelta: { min: 0.1, max: 0.35 },   // (not in spec) rectangles darker/lighter by this much
      rectSize: { min: 0.15, max: 0.6 },    // (not in spec) fraction of the frame
      rectSoftMm: { min: 0.1, max: 2 },     // (not in spec) edge softness
      mottle: 0.08, mottleCells: 4,         // (not in spec) low-frequency tonal wander
      grain: 0.08,                          // (not in spec) per-pixel film grain
      exposureVar: 0.6,                     // (not in spec) per-frame tone curve exponent 2^±exposureVar
    },
    marks: {
      color: '#d8d8d8', sizeMm: 1.5,
      font: '"Arial Narrow", Arial, sans-serif',  // drawn bold
      filmNames: ['MERIDIAN PAN 400', 'MERIDIAN PAN 125', 'HALDANE HP 400'],  // fake
      nameEvery: 2,                         // (not in spec) film name every N frames
    },
  },

  // §4.3 — procedural maps, generated once at startup.
  textures: {
    size: 1024,             // square, ≤ 1024²
    grain: {
      octaves: 3,
      baseCells: 128,       // (not in spec) noise cells across the tile in the first octave
      persistence: 0.6,     // (not in spec) amplitude ratio between octaves; > 0.5 favors fine tooth
      slopeRms: 0.3,        // (not in spec) RMS normal-map slope before normalScale (1 = 45°)
      seed: 7,              // (not in spec)
    },
    // smudge and scratch are the spec's procedural recipes; the ambientCG scans in acetate.wear
    // are used instead (user). Kept for reference.
    smudge: { base: 0.06, max: 0.25, ellipses: { min: 6, max: 10 }, ridgeBlobs: { min: 2, max: 3 } },
    scratch: { lines: { min: 30, max: 60 }, widthPx: { min: 1, max: 2 } },
    crease: {
      band: 0.025, lines: { min: 3, max: 5 },
      widthMm: { min: 0.6, max: 1.4 },     // (not in spec) crease ridge width
      depth: { min: 0.4, max: 1 },         // (not in spec) relative ridge heights
      wanderMm: 0.6,                       // (not in spec) how far a crease line drifts along its length
      wanderCycles: { min: 1, max: 3 },    // (not in spec) drifts per sheet width
      slopeRms: 0.8,                       // (not in spec) normal strength inside the band, before normalScale
      pxAcross: 256, pxAlong: 1024,        // (not in spec) map size: across the sheet, hinge → free edge
      seed: 5,                             // (not in spec)
    },
    kraft: { valueVar: 0.08 },              // ±8% value variation on tape.color
    dust: { specks: { min: 20, max: 40 } },
    footprint: {
      softEdge: 0.008,      // footprintShadow: 8 mm soft edge centred on the sheet's outline, alpha 1 → 0
      pxPerMm: 2,           // (not in spec) texture resolution; ≤ 1024 px either way
    },
  },
};
