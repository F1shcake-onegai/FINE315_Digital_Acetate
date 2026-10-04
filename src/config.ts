export const config = {
  paper: {
    w: 0.231, h: 0.294, t: 0.00025,
    roughness: 0.15, // RC pearl
    specularIntensity: 0.5, // locked
    envMapIntensity: 0.6, // locked
    edgeColor: '#f4f2ee',
  },
  acetate: {
    w: 0.239, h: 0.304, segX: 60, segY: 80, gap: 0.0003,
    ior: 1.48, clearcoat: 1, clearcoatRoughness: 0.08,
    roughness: 0.06,
    transmission: 0.99,
    haze: { share: 0.05, glowLod: 2 }, // transmission blur mix
    normalScale: 0.05,
    tint: '#ffffff',
    wave1: { a: 0, lambda: 0.11, phase: 1.3 },
    wave2: { a: 0, lambda: 0.045, phase: 0.4 },
    curl: 0,
    sagGain: 0.05, sagMax: 0.22,
    contactSoftness: 0.5,
    droop: 0.3,
    droopHang: 2,
    thickness: 0.0,
    metalness: 0,
    envMapIntensity: 1.0,
    holdEnd: 0.35,
    curlStart: 0.7,
    curlCorner: { min: 0.4, max: 1.0 },
    rim: { widthPx: 1.5, color: '#ffffff', opacity: 0.35 },
    artwork: ['assets/acetate-a.png?v=2', 'assets/acetate-b.png?v=2'], // bump v to bust cdn cache
  },
  layout: { setOffsetX: 0.1495, clearAbove: 0.30 },
  table: {
    size: 4,
    color: '#ede8df', roughness: 0.92, // locked
  },
  camera: {
    fov: 35, tiltDeg: 0, distance: 0.9, minDistance: 0.06, maxDistance: 1.4,
    panX: 0.43, panZMin: -0.51, panZMax: 0.37,
    dampingFactor: 0.08,
    zoomStep: 1.25,
    near: 0.01, far: 10,
  },
  mobile: {
    fitMargin: 1.08,
    panX: 0.2,
    slideS: 0.45,
  },
  flip: {
    K: 140, D: 16, releaseLookahead: 0.15, minGrabDist: 0.05,
    clickPx: 4, clickMs: 200,
    settleAngle: 0.002, settleOmega: 0.01,
    keys: ['1', '2'],
    trackBlendDeg: 30,
    maxOmega: 20, // rad/s
    omegaSmoothS: 0.05,
    bounce: 0.3,
    holdEaseS: 0.12,
    maxStepS: 0.05,
  },
  light: {
    shadowMap: 2048,
    keyIntensity: 1.5, fillIntensity: 0.35, // locked
    exposure: 0.5, // locked
    blackPoint: 0.05, // locked
    keyColor: '#ffffff', // locked
    keyPosition: { x: -0.6, y: 1.2, z: 0.8 }, // locked
    fillSky: '#ffffff', fillGround: '#d9d3c7', // locked
    shadowRadius: 3,
    shadowBias: -0.00005,
    shadowNormalBias: 0,
    shadowMargin: 0.02,
  },
  contact: {
    closedOpacity: 0.12, openOpacity: 0.10,
    lightOffset: 0.002,
    decalLift: 0.00005,
    color: '#000000',
  },
  environment: {
    roomBlur: 0.04, // locked
    hdrIntensity: 1,
  },
  acetateStudio: {
    roomSize: 20,
    wallColor: '#0b0b0b',
    floor: { color: '#ede8df', intensity: 1.2 },
    blur: 0.02, // PMREM sigma
    softboxes: [
      { position: { x: -4.97, y: 8.6, z: 0 }, width: 8, height: 0.8, intensity: 2 },
      { position: { x: 4.97, y: 8.6, z: 0 }, width: 8, height: 0.8, intensity: 2 },
      { position: { x: -6, y: 7, z: 5 }, width: 6, height: 4, intensity: 8 },
      { position: { x: 0, y: 8, z: -6.5 }, width: 12, height: 1.2, intensity: 10 },
      { position: { x: 9, y: 4, z: -1 }, width: 3, height: 6, intensity: 5 },
    ],
  },
  perf: {
    maxPixelRatio: 2, transmissionFar: 0.5, transmissionNear: 1.0,
    transmissionFarDist: 1.4,
    transmissionNearDist: 1.0,
  },
  ui: {
    hand: {
      sizePx: 56,
      hotspot: { x: 13.2, y: 21.4 },
    },
  },
  assets: {
    sheetA: 'assets/sheet-a.jpg', sheetB: 'assets/sheet-b.jpg', env: 'assets/env.hdr',
  },
  textures: {
    size: 1024,
    crease: {
      band: 0.025, lines: { min: 3, max: 5 },
      widthMm: { min: 0.6, max: 1.4 },
      depth: { min: 0.4, max: 1 },
      wanderMm: 0.6,
      wanderCycles: { min: 1, max: 3 },
      slopeRms: 0.8,
      pxAcross: 256, pxAlong: 1024,
      seed: 5,
    },
    footprint: {
      softEdge: 0.008,
      pxPerMm: 2,
    },
  },
};
