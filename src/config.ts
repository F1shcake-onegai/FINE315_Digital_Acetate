/**
 * Every tunable number lives here: docs/SPEC.md §12 plus every other number the spec names.
 * Scene code reads this object and keeps no magic numbers of its own.
 *
 * Units: meters, radians and seconds unless the key says otherwise (…Deg, …Px, …Mm, …Ms, …S).
 * World frame: Y up, table surface at y = 0, origin = center of both sets.
 * Each set's hinge (the taped top edge) is its far edge, toward −z; the viewer is on +z.
 * "(not in spec)" marks starting values picked during implementation. Tune by eye.
 */
export const config = {
  surface: 'table' as 'table' | 'wall',

  // §3, §5.2 — the real prints, measured from the scans' film edge print (38 mm per frame);
  // 11:14 like the scans. The spec started at 8×10 in (0.203 × 0.254).
  paper: {
    w: 0.231, h: 0.294, t: 0.00025, roughness: 0.55,
    roughnessVar: 0.10,     // paperGrain remaps roughness to roughness ± roughnessVar (0.45–0.65)
    normalScale: 0.15,
    envMapIntensity: 0.6,
    edgeColor: '#f4f2ee',   // side faces of the box
  },

  // §3, §5.3, §5.5 — paper + 4 mm overhang left/right + 10 mm at the bottom; top edges
  // aligned at the hinge.
  acetate: {
    w: 0.239, h: 0.304, segX: 60, segY: 80, gap: 0.0003,
    ior: 1.48, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.08,
    normalScale: 0.05, tint: '#f3f1ec',
    wave1: { a: 0.0012, lambda: 0.11, phase: 1.3 },
    wave2: { a: 0.0004, lambda: 0.045, phase: 0.4 },
    curl: 0.004, sagGain: 0.035, sagMax: 0.2,
    transmission: 1.0,
    thickness: 0.0,         // no refraction offset, Fresnel kept
    metalness: 0,
    envMapIntensity: 1.0,
    normalScaleRange: { min: 0.02, max: 0.08 },
    roughnessMapRange: { min: 0.04, max: 0.25 },  // smudge map; above ~0.1 the frames go soft
    holdEnd: 0.35,          // env = smoothstep(0, holdEnd, u): the tape holds it flat near the hinge
    curlStart: 0.7,         // curl grows from u = curlStart to `curl` at the free edge
    curlCorner: { min: 0.25, max: 0.5 },  // smoothstep over |x| / (W/2): only the free corners lift
    rim: { widthPx: 1.5, color: '#ffffff', opacity: 0.35 },
    fresnelTestDeg: 80,     // M2 dev toggle: tilt the flat sheet to check the Fresnel flash
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

  // §5.1
  table: { size: 2, color: '#ede8df', roughness: 0.92, normalRepeat: 8, normalScale: 0.1 },

  // §3, §6.2
  camera: {
    fov: 35, tiltDeg: 0, distance: 0.9, minDistance: 0.06, maxDistance: 1.4,
    // Pan bounds keep the spec's margins around the sets and the open acetates.
    panX: 0.43, panZMin: -0.51, panZMax: 0.37,
    dampingFactor: 0.08,
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
    // exposure: spec starts at 1.0, which rendered the prints' midtones ~60 levels brighter than the
    // scans and the table near white (238/255). At 0.5 midtones sit within ~10–15 of the scans.
    keyIntensity: 1.5, fillIntensity: 0.35, shadowMap: 2048, exposure: 0.5,
    keyColor: '#ffffff',
    keyPosition: { x: -0.6, y: 1.2, z: 0.8 },  // upper-left-front, relative to the sets' center
    fillSky: '#ffffff', fillGround: '#d9d3c7',
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
  },

  // §3
  environment: {
    roomBlur: 0.04,         // (not in spec) PMREM sigma for RoomEnvironment
  },

  // §6.3
  parallax: { envYawDeg: 3, envPitchDeg: 2, lerp: 0.08, fallbackTiltDeg: 1.5 },

  // §6.2, §9
  perf: {
    maxPixelRatio: 2, transmissionFar: 0.5, transmissionNear: 1.0,
    transmissionFarDist: 0.5,   // camera distance above which transmission uses transmissionFar
    transmissionNearDist: 0.25, // …below which it uses transmissionNear; lerp between
    slowFrameMs: 20, slowForS: 2,
    degradedTransmission: 0.35, // first fallback when slow; then clearcoat → 0
  },

  // §6.4
  ui: { hintFadeS: 6 },

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
    smudge: { base: 0.06, max: 0.25, ellipses: { min: 6, max: 10 }, ridgeBlobs: { min: 2, max: 3 } },
    scratch: { lines: { min: 30, max: 60 }, widthPx: { min: 1, max: 2 } },
    crease: { band: 0.025, lines: { min: 3, max: 5 } },
    kraft: { valueVar: 0.08 },              // ±8% value variation on tape.color
    dust: { specks: { min: 20, max: 40 } },
    footprint: { softEdge: 0.008 },         // footprintShadow: 8 mm soft edge, alpha 1 → 0
  },
};
