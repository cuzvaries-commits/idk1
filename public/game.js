import * as THREE from 'three';

// short dom lookup used by every hud and menu routine
const $ = (id) => document.getElementById(id);
// uniform random in a range for spread, bot timing and effects
const rand = (a, b) => a + Math.random() * (b - a);
// bounds a value so tuning numbers cannot run away
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// linear blend used by smoothing and damage falloff
const lerp = (a, b, t) => a + (b - a) * t;
// frame rate independent smoothing factor for camera and viewmodel springs
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

// shortest signed angle so turning never spins the long way round
function angDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// team colours as numbers for meshes and effects
const TEAM_COL = [0x2f9bff, 0xff8a1f];
// team colours as css for hud text
const TEAM_CSS = ['#2f9bff', '#ff8a1f'];
// movement tuning lives in one table because feel needs iteration
const MOVE = { run: 8, crouch: 4, slideBoost: 1.5, slideChain: 2.2, slideDecel: 7.5, slideMin: 6, slideSteer: 1.5, cap: 16, jump: 8.6, gravity: 24, accel: 70, air: 26, friction: 55, bleed: 13, step: 0.6, radius: 0.4, height: 1.8, crouchH: 1.15, eye: 1.62, crouchEye: 0.95, coyote: 0.1, buffer: 0.12 };
// match rules and payouts kept together so balance edits stay in one place
const RULES = { hp: 150, toWin: 5, roundTime: 90, countdown: 3, roundEnd: 3, winKeys: 3, lossKeys: 1, winXp: 100, lossXp: 50, elimXp: 10, xpLevel: 500 };
// bot presets so difficulty changes reaction, aim error and turn rate together
const DIFF = [
  { name: 'Easy', react: 0.6, err: [8, 4.2], turn: 5, speed: 0.85 },
  { name: 'Normal', react: 0.36, err: [5, 2.3], turn: 8, speed: 0.95 },
  { name: 'Hard', react: 0.2, err: [3, 1.1], turn: 12, speed: 1 },
];
// bot display names so the kill feed and scoreboard read like a lobby
const BOT_NAMES = ['Vex', 'Nova', 'Juno', 'Rook', 'Pike', 'Echo', 'Dash', 'Mako', 'Onyx', 'Kite'];

// every weapon is data so adding one is a table entry rather than new code
const WEAPONS = {
  ar: { name: 'Assault Rifle', slot: 0, type: 'hitscan', auto: true, dmg: [12, 3], head: [15, 4], fall: [18, 72], interval: 0.10, mag: 20, reserve: 100, reload: 1.56, speed: -0.10, cost: 0, spread: 0.9, bloom: 0.32, maxBloom: 3, adsMul: 0.4, zoom: 0.78, recoil: 0.5, vm: 'rifle', snd: 'rifle' },
  shotgun: { name: 'Shotgun', slot: 0, type: 'hitscan', pellets: 10, dmg: [8, 2.5], head: [12, 3.7], fall: [5.4, 21.6], interval: 0.70, mag: 7, reserve: 35, reload: 0.42, shell: true, speed: 0, cost: 20, spread: 4.5, bloom: 0, maxBloom: 0, adsMul: 0.8, zoom: 0.9, recoil: 3, vm: 'shotgun', snd: 'shotgun' },
  sniper: { name: 'Sniper', slot: 0, type: 'hitscan', dmg: [50, 50], head: [150, 150], fall: [1, 2], interval: 1.5, mag: 4, reserve: 12, reload: 1.8, speed: -0.20, cost: 75, spread: 5, bloom: 0, maxBloom: 0, adsMul: 0, zoom: 0.28, scope: true, recoil: 3.5, vm: 'sniper', snd: 'sniper' },
  rpg: { name: 'RPG', slot: 0, type: 'rocket', interval: 0.25, mag: 1, reserve: 17, reload: 1.04, speed: -0.15, cost: 25, spread: 0.3, bloom: 0, maxBloom: 0, adsMul: 0.5, zoom: 0.85, recoil: 2.5, vm: 'launcher', snd: 'rocket' },
  handgun: { name: 'Handgun', slot: 1, type: 'hitscan', dmg: [12, 3], head: [15, 4], fall: [18, 72], interval: 0.13, mag: 13, reserve: 91, reload: 1.06, speed: 0, cost: 0, spread: 0.8, bloom: 0.5, maxBloom: 3, adsMul: 0.45, zoom: 0.82, recoil: 0.9, vm: 'pistol', snd: 'pistol' },
  revolver: { name: 'Revolver', slot: 1, type: 'hitscan', dmg: [30, 8], head: [40, 10], fall: [18, 72], interval: 0.40, mag: 6, reserve: 36, reload: 1.8, speed: -0.05, cost: 25, spread: 0.7, bloom: 1.2, maxBloom: 3, adsMul: 0.4, zoom: 0.8, recoil: 2.4, vm: 'revolver', snd: 'revolver' },
  uzi: { name: 'Uzi', slot: 1, type: 'hitscan', auto: true, dmg: [8, 2], head: [10, 2], fall: [18, 72], interval: 0.07, mag: 27, reserve: 108, reload: 1.5, speed: 0, cost: 20, spread: 1.6, bloom: 0.3, maxBloom: 4, adsMul: 0.5, zoom: 0.85, recoil: 0.45, vm: 'smg', snd: 'smg' },
  shorty: { name: 'Shorty', slot: 1, type: 'hitscan', pellets: 10, dmg: [7.5, 2.5], head: [11.2, 3.7], fall: [5.4, 21.6], interval: 0.12, mag: 2, reserve: 18, reload: 1.7, speed: 0, cost: 20, spread: 6, bloom: 0, maxBloom: 0, adsMul: 0.85, zoom: 0.92, recoil: 3.5, vm: 'shorty', snd: 'shotgun' },
  fists: { name: 'Fists', slot: 2, type: 'melee', dmg: 30, interval: 0.35, speed: 0.05, cost: 0, doubleJump: true, vm: 'fists' },
  knife: { name: 'Knife', slot: 2, type: 'melee', dmg: 40, back: 150, interval: 0.6, speed: 0.10, cost: 20, vm: 'knife' },
  katana: { name: 'Katana', slot: 2, type: 'melee', dmg: 45, interval: 0.7, speed: 0, cost: 45, alt: 'block', vm: 'katana' },
  scythe: { name: 'Scythe', slot: 2, type: 'melee', dmg: 35, interval: 0.7, speed: 0, cost: 40, alt: 'dash', vm: 'scythe' },
  grenade: { name: 'Grenade', slot: 3, type: 'throw', proj: 'grenade', cooldown: 30, cook: true, speed: 0, cost: 0, vm: 'nade' },
  flash: { name: 'Flashbang', slot: 3, type: 'throw', proj: 'flash', charges: 2, speed: 0, cost: 15, vm: 'flash' },
  smoke: { name: 'Smoke Grenade', slot: 3, type: 'throw', proj: 'smoke', charges: 3, speed: 0, cost: 10, vm: 'smokeg' },
  medkit: { name: 'Medkit', slot: 3, type: 'heal', heal: 50, cooldown: 90, use: 0.9, speed: -0.10, cost: 40, vm: 'medkit' },
};
for (const id in WEAPONS) WEAPONS[id].id = id;

// storage key versioned so a future format change cannot load stale data
const SAVE_KEY = 'slipstrike.save.v1';
// starter profile so a fresh or corrupt save still boots into a playable state
const DEF_SAVE = { keys: 25, xp: 0, wins: 0, losses: 0, elims: 0, owned: ['ar', 'handgun', 'fists', 'grenade'], loadout: ['ar', 'handgun', 'fists', 'grenade'], set: { sens: 1, fov: 80, vol: 0.6, shake: !matchMedia('(prefers-reduced-motion: reduce)').matches, unlock: false, size: 1, map: 0, diff: 1 } };

// reads the profile defensively because storage can be missing, blocked or hand edited
function loadSave() {
  const s = structuredClone(DEF_SAVE);
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (raw && typeof raw === 'object') {
      for (const k of ['keys', 'xp', 'wins', 'losses', 'elims']) if (Number.isFinite(raw[k]) && raw[k] >= 0) s[k] = Math.floor(raw[k]);
      if (Array.isArray(raw.owned)) for (const id of raw.owned) if (WEAPONS[id] && !s.owned.includes(id)) s.owned.push(id);
      if (Array.isArray(raw.loadout)) raw.loadout.forEach((id, i) => { if (i < 4 && WEAPONS[id] && WEAPONS[id].slot === i && s.owned.includes(id)) s.loadout[i] = id; });
      if (raw.set && typeof raw.set === 'object') for (const k in s.set) if (typeof raw.set[k] === typeof s.set[k]) s.set[k] = raw.set[k];
    }
  } catch { /* unreadable storage falls back to the starter profile */ }
  s.set.size = clamp(Math.round(s.set.size), 1, 5); s.set.map = clamp(Math.round(s.set.map), 0, 2); s.set.diff = clamp(Math.round(s.set.diff), 0, 2);
  s.set.sens = clamp(s.set.sens, 0.2, 3); s.set.fov = clamp(s.set.fov, 60, 110); s.set.vol = clamp(s.set.vol, 0, 1);
  return s;
}
// the live profile every system reads and mutates
const SAVE = loadSave();
// writes the profile and ignores failures so private browsing never breaks play
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch { /* storage unavailable */ } }
// ownership check that also honours the sandbox unlock toggle
function owns(id) { return SAVE.set.unlock || SAVE.owned.includes(id); }
// level is derived from xp so the two can never disagree
function levelOf(xp) { return 1 + Math.floor(xp / RULES.xpLevel); }

// audio graph handles created lazily because browsers require a user gesture
const AU = { ctx: null, master: null, buf: null };
// starts or resumes audio on the first click or tap
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    AU.ctx = new C(); AU.master = AU.ctx.createGain(); AU.master.gain.value = SAVE.set.vol; AU.master.connect(AU.ctx.destination);
    const n = AU.ctx.sampleRate; AU.buf = AU.ctx.createBuffer(1, n, n);
    const d = AU.buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  } catch { AU.ctx = null; }
}
// pitched blip used as the tonal layer of every synthesised sound
function tone(f0, f1, dur, vol, type = 'sine', delay = 0) {
  if (!AU.ctx || vol <= 0.001) return;
  const t = AU.ctx.currentTime + delay, o = AU.ctx.createOscillator(), g = AU.ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + dur + 0.02);
}
// filtered noise burst used for gunshots, explosions and slides
function noise(dur, vol, freq, type = 'lowpass') {
  if (!AU.ctx || vol <= 0.001) return;
  const t = AU.ctx.currentTime, s = AU.ctx.createBufferSource(), f = AU.ctx.createBiquadFilter(), g = AU.ctx.createGain();
  s.buffer = AU.buf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(AU.master); s.start(t, Math.random() * 0.5, dur + 0.05);
}
// sound recipes generated in code so the game ships with no audio files
const SFX = {
  rifle: (v) => { noise(0.1, 0.5 * v, 2400); tone(210, 60, 0.08, 0.3 * v, 'square'); },
  smg: (v) => { noise(0.07, 0.4 * v, 3200); tone(300, 90, 0.05, 0.22 * v, 'square'); },
  pistol: (v) => { noise(0.09, 0.45 * v, 2800); tone(260, 70, 0.07, 0.28 * v, 'square'); },
  revolver: (v) => { noise(0.18, 0.6 * v, 1800); tone(170, 45, 0.14, 0.4 * v, 'square'); },
  shotgun: (v) => { noise(0.25, 0.75 * v, 1300); tone(130, 40, 0.18, 0.45 * v, 'sawtooth'); },
  sniper: (v) => { noise(0.4, 0.8 * v, 1500); tone(120, 30, 0.3, 0.5 * v, 'sawtooth'); },
  rocket: (v) => { noise(0.35, 0.5 * v, 900); tone(90, 300, 0.3, 0.2 * v, 'sawtooth'); },
  boom: (v) => { noise(0.7, 0.9 * v, 520); tone(80, 25, 0.5, 0.6 * v, 'sine'); },
  swing: (v) => noise(0.12, 0.25 * v, 1500, 'bandpass'),
  hit: () => tone(900, 700, 0.05, 0.25, 'square'),
  head: () => { tone(1500, 1200, 0.07, 0.3, 'square'); tone(2200, 1800, 0.07, 0.15, 'sine', 0.03); },
  kill: () => { tone(660, 660, 0.09, 0.3, 'triangle'); tone(990, 990, 0.16, 0.3, 'triangle', 0.09); },
  hurt: () => tone(160, 80, 0.12, 0.3, 'sawtooth'),
  death: () => tone(300, 50, 0.6, 0.35, 'sawtooth'),
  jump: () => tone(260, 420, 0.08, 0.1, 'sine'),
  land: () => noise(0.1, 0.25, 500),
  slide: () => noise(0.35, 0.22, 1200, 'bandpass'),
  dash: () => noise(0.25, 0.4, 2500, 'bandpass'),
  reload: () => { tone(500, 400, 0.04, 0.15, 'square'); tone(700, 600, 0.04, 0.15, 'square', 0.12); },
  swap: () => tone(420, 520, 0.05, 0.1, 'triangle'),
  ui: () => tone(620, 760, 0.05, 0.12, 'triangle'),
  deny: () => tone(180, 140, 0.12, 0.18, 'square'),
  buy: () => { tone(700, 700, 0.07, 0.2, 'triangle'); tone(1050, 1050, 0.12, 0.2, 'triangle', 0.07); },
  beep: () => tone(520, 520, 0.09, 0.2, 'square'),
  go: () => tone(880, 880, 0.25, 0.25, 'square'),
  win: () => { tone(523, 523, 0.12, 0.25, 'triangle'); tone(659, 659, 0.12, 0.25, 'triangle', 0.12); tone(784, 784, 0.25, 0.25, 'triangle', 0.24); },
  lose: () => { tone(392, 392, 0.15, 0.25, 'triangle'); tone(311, 311, 0.15, 0.25, 'triangle', 0.15); tone(233, 233, 0.3, 0.25, 'triangle', 0.3); },
  heal: () => tone(500, 900, 0.3, 0.2, 'sine'),
  bounce: (v) => tone(240, 180, 0.04, 0.12 * v, 'square'),
  flash: (v) => { noise(0.3, 0.6 * v, 6000, 'highpass'); tone(3000, 2400, 0.8, 0.15 * v, 'sine'); },
  smoke: (v) => noise(0.9, 0.3 * v, 900),
};
// single entry point so a missing recipe or muted audio never throws
function sfx(name, v = 1) { if (AU.ctx && SFX[name]) SFX[name](v); }
// loudness falloff so distant gunfire is quieter than your own
function volAt(x, y, z) { return clamp(1 - camera.position.distanceTo(TMP.set(x, y, z)) / 60, 0, 1); }

// scratch vector reused where a temporary is needed without allocating
const TMP = new THREE.Vector3();
// canvas the whole game renders into
const canvas = $('c');
// renderer is created once and reported clearly when webgl is unavailable
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (err) { $('fatal').classList.remove('hidden'); $('fatal').textContent = 'WebGL is not available in this browser, so the game cannot start.'; throw err; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.autoClear = false;
// world scene holding the map, characters and effects
const scene = new THREE.Scene();
// first person and spectator camera
const camera = new THREE.PerspectiveCamera(80, 1, 0.05, 500);
camera.rotation.order = 'YXZ';
// separate scene so the held weapon never clips into walls
const vmScene = new THREE.Scene();
// fixed fov camera so the weapon keeps its proportions when the world fov changes
const vmCam = new THREE.PerspectiveCamera(58, 1, 0.01, 20);
// ambient sky light tinted per map
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 2);
// shadow casting key light positioned per map
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006;
Object.assign(sun.shadow.camera, { left: -52, right: 52, top: 52, bottom: -52, near: 1, far: 200 });
scene.add(hemi, sun, sun.target);
vmScene.add(new THREE.HemisphereLight(0xffffff, 0x667088, 2.2));
// key light for the held weapon so it reads the same on every map
const vmSun = new THREE.DirectionalLight(0xffffff, 1.6);
vmSun.position.set(1, 2, 1.5); vmScene.add(vmSun);
// container rebuilt on every map load
const worldGroup = new THREE.Group();
// container for pooled effects that rays must never hit
const fxGroup = new THREE.Group();
scene.add(worldGroup, fxGroup);

// grid tile drawn in code so surfaces show speed without any image assets
function gridTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#c9c9c9'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#f4f4f4'; g.fillRect(3, 3, 122, 122);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// one shared tile texture for every block
const GRID = gridTexture();
// material cache so maps reuse one material per colour
const MATS = new Map();
// returns a cached surface material, textured for blocks and plain for ramps
function matFor(color, plain) {
  const key = color + (plain ? 'p' : 't');
  if (!MATS.has(key)) MATS.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.9, map: plain ? null : GRID, side: plain ? THREE.DoubleSide : THREE.FrontSide }));
  return MATS.get(key);
}
// box with uvs scaled to world size so the grid tile never stretches
function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / 2, uv.getY(k) * dims[f][1] / 2); }
  return g;
}
// wedge mesh rising toward local plus x so ramps match their collision shape
function wedgeGeo(L, H, W) {
  const a = L / 2, b = W / 2;
  const A0 = [-a, 0, -b], A1 = [-a, 0, b], B0 = [a, 0, -b], B1 = [a, 0, b], C0 = [a, H, -b], C1 = [a, H, b];
  const tris = [A0, A1, C1, A0, C1, C0, B0, C0, C1, B0, C1, B1, A0, B0, B1, A0, B1, A1, A0, C0, B0, A1, B1, C1];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

// adds an axis aligned solid so collision, rays, nav and rendering share one list
function addBox(m, x0, x1, y0, y1, z0, z1, color, floor) { m.solids.push({ min: [x0, y0, z0], max: [x1, y1, z1], color, ramp: null, floor: !!floor }); }
// adds a wedge whose top rises along one axis so slide jumps have launch surfaces
function addRamp(m, x0, x1, y0, y1, z0, z1, axis, dir, color) { m.solids.push({ min: [x0, y0, z0], max: [x1, y1, z1], color, ramp: { axis, dir }, floor: false }); }
// shared floor, boundary walls and spawn rows so each map only lists its own cover
function mapShell(name, hx, hz, pal) {
  const m = { name, solids: [], hazards: [], spawns: [[], []], bounds: { x0: -hx, x1: hx, z0: -hz, z1: hz }, pal, nav: null };
  addBox(m, -hx, hx, -1, 0, -hz, hz, pal.floor, true);
  addBox(m, -hx - 1, -hx, 0, 9, -hz - 1, hz + 1, pal.wall); addBox(m, hx, hx + 1, 0, 9, -hz - 1, hz + 1, pal.wall);
  addBox(m, -hx, hx, 0, 9, -hz - 1, -hz, pal.wall); addBox(m, -hx, hx, 0, 9, hz, hz + 1, pal.wall);
  for (const z of [0, -4, 4, -8, 8]) { m.spawns[0].push([-hx + 4, 0, z]); m.spawns[1].push([hx - 4, 0, z]); }
  return m;
}
// the three arenas, each a function so a fresh copy is built per match
const MAPS = [
  // mirrored arena with side ramps onto raised walkways and a central wall
  () => {
    const p = { sky: 0x9fd4ff, fog: 0xc4e4ff, fogFar: 200, floor: 0xd9dee6, wall: 0x8f9bb0, block: 0xf4f6fa, deck: 0xcfd6e2, ramp: 0xffc84a, crate: 0x6f7d95, hemiA: 0xdff1ff, hemiB: 0x8b93a3, hemiI: 2, sun: 0xfff3dd, sunI: 2.6, sunPos: [30, 60, 20] };
    const m = mapShell('Foundry', 32, 22, p);
    addBox(m, -1.5, 1.5, 0, 4.5, -9, 9, p.block);
    for (const s of [-1, 1]) {
      const z0 = s > 0 ? 17 : -22, z1 = s > 0 ? 22 : -17;
      addBox(m, -10, 10, 0, 3, z0, z1, p.deck);
      addRamp(m, -18, -10, 0, 3, z0, z1, 'x', 1, p.ramp); addRamp(m, 10, 18, 0, 3, z0, z1, 'x', -1, p.ramp);
      addBox(m, -1.2, 1.2, 0, 1.3, s > 0 ? 11 : -14, s > 0 ? 14 : -11, p.crate);
      addBox(m, s * 12 - 1, s * 12 + 1, 0, 2.4, -3, 3, p.block);
      addBox(m, s * 19 - 1, s * 19 + 1, 0, 1.3, 6, 9, p.crate); addBox(m, s * 19 - 1, s * 19 + 1, 0, 1.3, -9, -6, p.crate);
      addBox(m, s * 7 - 1, s * 7 + 1, 0, 1.3, 11.5, 13.5, p.crate); addBox(m, s * 7 - 1, s * 7 + 1, 0, 1.3, -13.5, -11.5, p.crate);
    }
    return m;
  },
  // four lanes meeting at a plaza with doorways and raised decks
  () => {
    const p = { sky: 0xffc59a, fog: 0xffd9b8, fogFar: 190, floor: 0xe6ddcf, wall: 0x9a8f86, block: 0xf7efe2, deck: 0xb9a999, ramp: 0x5fd0c0, crate: 0x7b6f66, hemiA: 0xffe6cc, hemiB: 0x8a7a6e, hemiI: 1.9, sun: 0xffd2a0, sunI: 2.6, sunPos: [-35, 45, 25] };
    const m = mapShell('Crossing', 30, 30, p);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      addBox(m, sx > 0 ? 12 : -30, sx > 0 ? 30 : -12, 0, 7, sz > 0 ? 12 : -30, sz > 0 ? 30 : -12, p.deck);
      addBox(m, sx * 7.5 - 1, sx * 7.5 + 1, 0, 1.3, sz * 7.5 - 1, sz * 7.5 + 1, p.crate);
    }
    for (const s of [-1, 1]) {
      const x0 = s > 0 ? 14 : -15, x1 = s > 0 ? 15 : -14;
      addBox(m, x0, x1, 0, 4.5, -12, -4, p.block); addBox(m, x0, x1, 0, 4.5, 4, 12, p.block);
      addBox(m, -12, 12, 0, 2.4, s > 0 ? 20 : -30, s > 0 ? 30 : -20, p.block);
      if (s > 0) addRamp(m, -4, 4, 0, 2.4, 13, 20, 'z', 1, p.ramp); else addRamp(m, -4, 4, 0, 2.4, -20, -13, 'z', -1, p.ramp);
      addBox(m, s * 21 - 1, s * 21 + 1, 0, 1.3, -9, -7, p.crate); addBox(m, s * 21 - 1, s * 21 + 1, 0, 1.3, 7, 9, p.crate);
    }
    addBox(m, -2, 2, 0, 5, -5, 5, p.block);
    return m;
  },
  // dark arena with glowing pools that burn and bounce instead of killing
  () => {
    const p = { sky: 0x1b1422, fog: 0x2b1b24, fogFar: 130, floor: 0x55505f, wall: 0x34303d, block: 0x7a7486, deck: 0x625c6e, ramp: 0xff8a3a, crate: 0x4a4553, hemiA: 0x9a8fb5, hemiB: 0x5a2a1a, hemiI: 1.7, sun: 0xffb48a, sunI: 1.6, sunPos: [20, 55, -25] };
    const m = mapShell('Magma', 30, 22, p);
    m.hazards.push([-5, 5, -14, 14]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.hazards.push([sx > 0 ? 14 : -20, sx > 0 ? 20 : -14, sz > 0 ? 9 : -15, sz > 0 ? 15 : -9]);
    addBox(m, -7, 7, 0, 0.5, -3, 3, p.deck); addBox(m, -1, 1, 0.5, 5, -1, 1, p.block);
    for (const s of [-1, 1]) {
      addBox(m, -1.5, 1.5, 0, 0.5, s > 0 ? 10 : -13, s > 0 ? 13 : -10, p.deck);
      addBox(m, -1.5, 1.5, 0, 6, s > 0 ? 5.5 : -8.5, s > 0 ? 8.5 : -5.5, p.block);
      addBox(m, s > 0 ? 12.5 : -14, s > 0 ? 14 : -12.5, 0, 4, -6, 6, p.block);
      const z0 = s > 0 ? 17 : -22, z1 = s > 0 ? 22 : -17;
      addBox(m, -8, 8, 0, 2, z0, z1, p.deck);
      addRamp(m, -14, -8, 0, 2, z0, z1, 'x', 1, p.ramp); addRamp(m, 8, 14, 0, 2, z0, z1, 'x', -1, p.ramp);
      addBox(m, s * 22 - 1, s * 22 + 1, 0, 1.3, -1.5, 1.5, p.crate);
    }
    return m;
  },
];

// the map currently loaded, shared by physics, rays, nav and rendering
let world = null;

// surface height of a solid at a point, sloped for ramps and flat for boxes
function topAt(s, x, z) {
  if (!s.ramp) return s.max[1];
  const a = s.ramp.axis === 'x' ? 0 : 2;
  let t = ((a === 0 ? x : z) - s.min[a]) / (s.max[a] - s.min[a]);
  if (s.ramp.dir < 0) t = 1 - t;
  return s.min[1] + clamp(t, 0, 1) * (s.max[1] - s.min[1]);
}
// tells physics and nav whether a ground point sits inside a burning pool
function inHazard(x, z) {
  for (const h of world.hazards) if (x > h[0] && x < h[1] && z > h[2] && z < h[3]) return true;
  return false;
}

// swaps the arena geometry, lighting and nav grid for the chosen map
function loadMap(idx) {
  for (const c of [...worldGroup.children]) { worldGroup.remove(c); if (c.geometry) c.geometry.dispose(); }
  world = MAPS[idx]();
  const p = world.pal;
  scene.background = new THREE.Color(p.sky); scene.fog = new THREE.Fog(p.fog, 45, p.fogFar);
  hemi.color.setHex(p.hemiA); hemi.groundColor.setHex(p.hemiB); hemi.intensity = p.hemiI;
  sun.color.setHex(p.sun); sun.intensity = p.sunI; sun.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]); sun.target.position.set(0, 0, 0);
  for (const s of world.solids) {
    const w = s.max[0] - s.min[0], h = s.max[1] - s.min[1], d = s.max[2] - s.min[2];
    let mesh;
    if (s.ramp) {
      const alongX = s.ramp.axis === 'x';
      mesh = new THREE.Mesh(wedgeGeo(alongX ? w : d, h, alongX ? d : w), matFor(s.color, true));
      mesh.position.set((s.min[0] + s.max[0]) / 2, s.min[1], (s.min[2] + s.max[2]) / 2);
      mesh.rotation.y = alongX ? (s.ramp.dir > 0 ? 0 : Math.PI) : (s.ramp.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    } else {
      mesh = new THREE.Mesh(boxGeo(w, h, d), matFor(s.color, false));
      mesh.position.set((s.min[0] + s.max[0]) / 2, (s.min[1] + s.max[1]) / 2, (s.min[2] + s.max[2]) / 2);
    }
    mesh.castShadow = !s.floor; mesh.receiveShadow = true;
    worldGroup.add(mesh);
  }
  for (const h of world.hazards) {
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(h[1] - h[0], h[3] - h[2]), new THREE.MeshBasicMaterial({ color: 0xff5a14 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set((h[0] + h[1]) / 2, 0.03, (h[2] + h[3]) / 2);
    const glow = new THREE.PointLight(0xff6a20, 60, 26);
    glow.position.set((h[0] + h[1]) / 2, 2, (h[2] + h[3]) / 2);
    worldGroup.add(pool, glow);
  }
  buildNav();
}

// precomputes a walkable height grid so bots can path without a navmesh
function buildNav() {
  const b = world.bounds, w = Math.round(b.x1 - b.x0), h = Math.round(b.z1 - b.z0);
  const hgt = new Float32Array(w * h), ok = new Uint8Array(w * h);
  const offs = [[0, 0], [0.42, 0.42], [-0.42, 0.42], [0.42, -0.42], [-0.42, -0.42], [0.42, 0], [-0.42, 0], [0, 0.42], [0, -0.42]];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = b.x0 + i + 0.5, z = b.z0 + j + 0.5;
    let top = -99;
    for (const s of world.solids) { if (x < s.min[0] || x > s.max[0] || z < s.min[2] || z > s.max[2]) continue; const t = topAt(s, x, z); if (t <= 4.6 && t > top) top = t; }
    hgt[j * w + i] = top;
    let clear = top > -50 && !(top < 0.1 && inHazard(x, z));
    for (let k = 0; clear && k < offs.length; k++) {
      const px = x + offs[k][0], pz = z + offs[k][1];
      for (const s of world.solids) {
        if (px < s.min[0] || px > s.max[0] || pz < s.min[2] || pz > s.max[2]) continue;
        if (topAt(s, px, pz) > top + MOVE.step && s.min[1] < top + 1.7) { clear = false; break; }
      }
    }
    ok[j * w + i] = clear ? 1 : 0;
  }
  world.nav = { w, h, hgt, ok, x0: b.x0, z0: b.z0, fields: new Map(), queue: new Int32Array(w * h) };
}
// maps a world position to its nav cell index, clamped inside the grid
function navCell(x, z) {
  const n = world.nav;
  return clamp(Math.floor(z - n.z0), 0, n.h - 1) * n.w + clamp(Math.floor(x - n.x0), 0, n.w - 1);
}
// finds a reachable cell near a target standing on a crate or in a pool
function nearestOk(c) {
  const n = world.nav, ci = c % n.w, cj = (c / n.w) | 0;
  let best = c, bd = 1e9;
  for (let dj = -5; dj <= 5; dj++) for (let di = -5; di <= 5; di++) {
    const i = ci + di, j = cj + dj;
    if (i < 0 || j < 0 || i >= n.w || j >= n.h || !n.ok[j * n.w + i]) continue;
    const d = di * di + dj * dj;
    if (d < bd) { bd = d; best = j * n.w + i; }
  }
  return best;
}
// distance field toward one target, cached until that target changes cell
function flowFor(t) {
  const n = world.nav;
  let goal = navCell(t.pos.x, t.pos.z);
  if (!n.ok[goal]) goal = nearestOk(goal);
  let f = n.fields.get(t);
  if (f && f.cell === goal) return f;
  if (!f) { f = { dist: new Int16Array(n.w * n.h), cell: -1 }; n.fields.set(t, f); }
  f.cell = goal; f.dist.fill(-1);
  if (!n.ok[goal]) return f;
  const q = n.queue; let head = 0, tail = 0;
  q[tail++] = goal; f.dist[goal] = 0;
  while (head < tail) {
    const c = q[head++], ci = c % n.w, cj = (c / n.w) | 0, d = f.dist[c] + 1;
    for (let k = 0; k < 4; k++) {
      const i = ci + (k === 0 ? 1 : k === 1 ? -1 : 0), j = cj + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (i < 0 || j < 0 || i >= n.w || j >= n.h) continue;
      const m = j * n.w + i;
      if (f.dist[m] >= 0 || !n.ok[m] || Math.abs(n.hgt[m] - n.hgt[c]) > 0.62) continue;
      f.dist[m] = d; q[tail++] = m;
    }
  }
  return f;
}
// reusable result so bot steering does not allocate every frame
const NAVD = { x: 0, z: 0 };
// picks the neighbouring cell closest to the target and returns the heading to it
function navDir(b, t) {
  const n = world.nav, f = flowFor(t), c = navCell(b.pos.x, b.pos.z), ci = c % n.w, cj = (c / n.w) | 0;
  const here = n.ok[c] ? f.dist[c] : -1;
  let best = -1, bd = here >= 0 ? here : 1e9;
  if (here < 0 || here > 1) {
    const r = here < 0 ? 2 : 1;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (!di && !dj) continue;
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= n.w || j >= n.h) continue;
      const m = j * n.w + i, d = f.dist[m];
      if (d < 0 || d >= bd) continue;
      if (here >= 0) {
        if (Math.abs(n.hgt[m] - n.hgt[c]) > 0.62) continue;
        if (di && dj && (!n.ok[cj * n.w + i] || !n.ok[j * n.w + ci])) continue;
      }
      bd = d; best = m;
    }
  }
  let dx, dz;
  if (best >= 0) { dx = n.x0 + (best % n.w) + 0.5 - b.pos.x; dz = n.z0 + ((best / n.w) | 0) + 0.5 - b.pos.z; }
  else { dx = t.pos.x - b.pos.x; dz = t.pos.z - b.pos.z; }
  const l = Math.hypot(dx, dz) || 1;
  NAVD.x = dx / l; NAVD.z = dz / l;
  return NAVD;
}
// keeps strafing bots off ledges, out of pools and away from walls
function navSafe(b, dx, dz) {
  const n = world.nav, l = Math.hypot(dx, dz);
  if (l < 0.01) return true;
  const x = b.pos.x + dx / l * 1.1, z = b.pos.z + dz / l * 1.1, bd = world.bounds;
  if (x < bd.x0 || x > bd.x1 || z < bd.z0 || z > bd.z1) return false;
  const c = navCell(x, z);
  return !!n.ok[c] && Math.abs(n.hgt[c] - b.pos.y) < 0.8;
}

// horizontal move test that returns the step up height or null when a wall blocks
function blockedAt(e, nx, nz) {
  const r = MOVE.radius, y = e.pos.y;
  let step = y;
  for (const s of world.solids) {
    if (nx + r <= s.min[0] || nx - r >= s.max[0] || nz + r <= s.min[2] || nz - r >= s.max[2]) continue;
    if (s.min[1] >= y + e.height) continue;
    const top = topAt(s, nx, nz);
    if (top <= y + 1e-3) continue;
    if (top - y > MOVE.step) return null;
    if (top > step) step = top;
  }
  return step;
}
// highest surface at or below the feet so landing and ground snapping agree
function groundAt(x, z, y) {
  const r = MOVE.radius;
  let g = -Infinity;
  for (const s of world.solids) {
    if (x + r <= s.min[0] || x - r >= s.max[0] || z + r <= s.min[2] || z - r >= s.max[2]) continue;
    const top = topAt(s, x, z);
    if (top <= y + 0.05 && top > g) g = top;
  }
  return g;
}
// swept character move in small substeps so fast slides and dashes cannot tunnel
function moveCollide(e, dt) {
  const was = e.grounded, r = MOVE.radius;
  const n = clamp(Math.ceil(Math.max(Math.abs(e.vel.x), Math.abs(e.vel.y), Math.abs(e.vel.z)) * dt / 0.3), 1, 12), h = dt / n;
  for (let i = 0; i < n; i++) {
    const nx = e.pos.x + e.vel.x * h;
    let st = blockedAt(e, nx, e.pos.z);
    if (st === null) e.vel.x = 0; else { e.pos.x = nx; if (st > e.pos.y) { e.pos.y = st; if (e.vel.y < 0) e.vel.y = 0; } }
    const nz = e.pos.z + e.vel.z * h;
    st = blockedAt(e, e.pos.x, nz);
    if (st === null) e.vel.z = 0; else { e.pos.z = nz; if (st > e.pos.y) { e.pos.y = st; if (e.vel.y < 0) e.vel.y = 0; } }
    let ny = e.pos.y + e.vel.y * h;
    if (e.vel.y <= 0) {
      const g = groundAt(e.pos.x, e.pos.z, e.pos.y);
      if (g > -Infinity && ny <= g) { ny = g; if (!e.grounded) e.landV = -e.vel.y; e.vel.y = 0; e.grounded = true; }
      else if (was && e.grounded && g > -Infinity && e.pos.y - g <= MOVE.step + 0.05) { ny = g; e.vel.y = 0; }
      else e.grounded = false;
    } else {
      e.grounded = false;
      for (const s of world.solids) {
        if (e.pos.x + r <= s.min[0] || e.pos.x - r >= s.max[0] || e.pos.z + r <= s.min[2] || e.pos.z - r >= s.max[2]) continue;
        if (s.min[1] >= e.pos.y + e.height - 0.05 && ny + e.height > s.min[1]) { ny = s.min[1] - e.height; e.vel.y = 0; }
      }
    }
    e.pos.y = ny;
  }
  if (e.grounded) e.lastGround = G.time;
}

// last world ray hit normal, read by bounces and impact effects
const HIT = { nx: 0, ny: 1, nz: 0 };
// nearest map hit along a ray, returning the max distance when nothing is struck
function rayWorld(ox, oy, oz, dx, dy, dz, maxT) {
  let best = maxT;
  for (const s of world.solids) {
    let t0 = 0, t1 = best, ax = -1, sg = 0, miss = false;
    for (let i = 0; i < 3; i++) {
      const o = i === 0 ? ox : i === 1 ? oy : oz, d = i === 0 ? dx : i === 1 ? dy : dz;
      if (Math.abs(d) < 1e-9) { if (o < s.min[i] || o > s.max[i]) { miss = true; break; } continue; }
      let a = (s.min[i] - o) / d, b = (s.max[i] - o) / d, g = -1;
      if (a > b) { const q = a; a = b; b = q; g = 1; }
      if (a > t0) { t0 = a; ax = i; sg = g; }
      if (b < t1) t1 = b;
      if (t0 > t1) { miss = true; break; }
    }
    if (miss) continue;
    if (!s.ramp) { best = t0; HIT.nx = ax === 0 ? sg : 0; HIT.ny = ax === 1 ? sg : ax < 0 ? 1 : 0; HIT.nz = ax === 2 ? sg : 0; continue; }
    if (oy + dy * t0 < topAt(s, ox + dx * t0, oz + dz * t0) - 1e-3) { best = t0; HIT.nx = ax === 0 ? sg : 0; HIT.ny = ax === 1 ? sg : ax < 0 ? 1 : 0; HIT.nz = ax === 2 ? sg : 0; continue; }
    for (let t = t0 + 0.12; t <= t1; t += 0.12) {
      if (oy + dy * t < topAt(s, ox + dx * t, oz + dz * t)) {
        const a = s.ramp.axis === 'x' ? 0 : 2, rise = s.max[1] - s.min[1], run = s.max[a] - s.min[a], l = Math.hypot(rise, run);
        best = t; HIT.nx = a === 0 ? -s.ramp.dir * rise / l : 0; HIT.ny = run / l; HIT.nz = a === 2 ? -s.ramp.dir * rise / l : 0;
        break;
      }
    }
  }
  return best;
}
// ray against one box, used for character bodies
function rayAABB(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1, maxT) {
  let t0 = 0, t1 = maxT;
  const o = [ox, oy, oz], d = [dx, dy, dz], mn = [x0, y0, z0], mx = [x1, y1, z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return -1; continue; }
    let a = (mn[i] - o[i]) / d[i], b = (mx[i] - o[i]) / d[i];
    if (a > b) { const q = a; a = b; b = q; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return -1;
  }
  return t0;
}
// ray against one sphere, used for headshots
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxT) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz, tc = lx * dx + ly * dy + lz * dz, d2 = lx * lx + ly * ly + lz * lz - tc * tc;
  if (d2 > r * r) return -1;
  const th = Math.sqrt(r * r - d2), t = tc - th;
  if (t >= 0) return t <= maxT ? t : -1;
  return tc + th >= 0 ? 0 : -1;
}
// nearest enemy struck by a ray, with friendly fire excluded by design
function rayEnts(shooter, ox, oy, oz, dx, dy, dz, maxT) {
  let best = null, bt = maxT, head = false;
  for (const e of G.ents) {
    if (!e.alive || e === shooter || e.team === shooter.team) continue;
    const th = raySphere(ox, oy, oz, dx, dy, dz, e.pos.x, e.pos.y + e.height - 0.24, e.pos.z, 0.27, bt);
    const tb = rayAABB(ox, oy, oz, dx, dy, dz, e.pos.x - 0.4, e.pos.y, e.pos.z - 0.4, e.pos.x + 0.4, e.pos.y + e.height - 0.44, e.pos.z + 0.4, bt);
    if (th >= 0 && (tb < 0 || th <= tb) && th < bt) { bt = th; best = e; head = true; }
    else if (tb >= 0 && tb < bt) { bt = tb; best = e; head = false; }
  }
  return best ? { ent: best, t: bt, head } : null;
}
// sightline test against the map and optionally against active smoke
function losClear(ax, ay, az, bx, by, bz, smoke) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return true;
  if (rayWorld(ax, ay, az, dx / len, dy / len, dz / len, len) < len - 0.02) return false;
  if (smoke) for (const s of G.smokes) {
    const t = clamp(((s.x - ax) * dx + (s.y - ay) * dy + (s.z - az) * dz) / (len * len), 0, 1);
    if (Math.hypot(ax + dx * t - s.x, ay + dy * t - s.y, az + dz * t - s.z) < s.r * 0.9) return false;
  }
  return true;
}
// whether one combatant can see another, checking chest then head
function canSee(a, b) {
  const ey = a.pos.y + a.height * 0.9;
  return losClear(a.pos.x, ey, a.pos.z, b.pos.x, b.pos.y + b.height * 0.6, b.pos.z, true) || losClear(a.pos.x, ey, a.pos.z, b.pos.x, b.pos.y + b.height - 0.2, b.pos.z, true);
}

// all mutable match state in one object so every system reads the same truth
const G = { mode: 'menu', state: 'idle', time: 0, paused: false, locked: false, touch: false, ents: [], player: null, projs: [], smokes: [], score: [0, 0], round: 0, stateT: 0, roundT: 0, flash: 0, hurt: 0, shake: 0, punch: 0, dip: 0, roll: 0, spectate: null, killer: null, elims: 0, lastBeep: 0 };

// blocky team coloured rig so bots read clearly without any uploaded assets
function makeBody(team) {
  const g = new THREE.Group(), u = {};
  const cm = new THREE.MeshStandardMaterial({ color: TEAM_COL[team], roughness: 0.65 });
  const dk = new THREE.MeshStandardMaterial({ color: 0x20232b, roughness: 0.8 });
  const sk = new THREE.MeshStandardMaterial({ color: 0xf3d7b4, roughness: 0.8 });
  const part = (parent, w, h, d, x, y, z, m) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x, y, z); k.castShadow = true; parent.add(k); return k; };
  u.legL = new THREE.Group(); u.legL.position.set(-0.19, 0.8, 0); part(u.legL, 0.3, 0.8, 0.3, 0, -0.4, 0, dk);
  u.legR = new THREE.Group(); u.legR.position.set(0.19, 0.8, 0); part(u.legR, 0.3, 0.8, 0.3, 0, -0.4, 0, dk);
  part(g, 0.78, 0.68, 0.42, 0, 1.14, 0, cm);
  u.head = new THREE.Group(); u.head.position.set(0, 1.48, 0); part(u.head, 0.44, 0.44, 0.44, 0, 0.22, 0, sk); part(u.head, 0.46, 0.14, 0.1, 0, 0.26, -0.2, dk);
  u.aim = new THREE.Group(); u.aim.position.set(0, 1.36, 0);
  part(u.aim, 0.2, 0.2, 0.62, 0.48, 0, -0.26, cm); part(u.aim, 0.2, 0.2, 0.62, -0.4, -0.02, -0.3, cm).rotation.y = -0.5; part(u.aim, 0.1, 0.16, 0.8, 0.3, -0.02, -0.72, dk);
  g.add(u.legL, u.legR, u.head, u.aim);
  g.userData = u;
  return g;
}
// per slot runtime state kept apart from the shared weapon definition
function makeItem(id) { const d = WEAPONS[id]; return { def: d, mag: d.mag || 0, reserve: d.reserve || 0, nextFire: 0, charges: d.charges || 0, cdUntil: 0, bloom: 0 }; }
// one combatant record shared by the player and bots so combat never special cases
function makeEnt(name, team, isPlayer, ids) {
  const e = { name, team, isPlayer, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, hp: RULES.hp, alive: true, grounded: true, height: MOVE.height, eyeH: MOVE.eye, crouching: false, sliding: false, slideArmed: false, slideCd: 0, lastGround: 0, airJumps: 0, landV: 0, dashUntil: 0, dashing: false, dashVel: new THREE.Vector3(), blockUntil: 0, altCd: 0, hazCd: 0, speedMul: 1, inv: ids.map(makeItem), slot: 0, prevSlot: 1, equipEnd: 0, reloadEnd: 0, useEnd: 0, cook: 0, swingT: -9, ads: false, fireBuf: 0, walk: 0, stats: { kills: 0, deaths: 0, dmg: 0 }, body: makeBody(team), target: null, thinkT: Math.random() * 0.3, sees: false, seeT: 0, reactAt: 0, blindUntil: 0, strafeT: 0, strafeDir: 1, burst: 6, pauseUntil: 0, nadeAt: 0, stuckT: 0, sx: 0, sz: 0, unstick: 0, ux: 0, uz: 0 };
  scene.add(e.body);
  return e;
}
// returns a combatant to a spawn with full health, ammo and cooldowns for a new round
function resetEnt(e, sp) {
  e.pos.set(sp[0], sp[1], sp[2]); e.vel.set(0, 0, 0); e.yaw = e.team === 0 ? -Math.PI / 2 : Math.PI / 2; e.pitch = 0;
  e.hp = RULES.hp; e.alive = true; e.grounded = true; e.height = MOVE.height; e.eyeH = MOVE.eye; e.crouching = e.sliding = e.slideArmed = e.dashing = e.ads = false;
  e.dashUntil = e.blockUntil = e.altCd = e.hazCd = e.equipEnd = e.reloadEnd = e.useEnd = e.cook = e.fireBuf = e.blindUntil = e.pauseUntil = e.unstick = 0;
  e.slot = 0; e.prevSlot = 1; e.swingT = -9; e.target = null; e.sees = false; e.nadeAt = G.time + rand(6, 16); e.stuckT = G.time + 1;
  for (const it of e.inv) { it.mag = it.def.mag || 0; it.reserve = it.def.reserve || 0; it.charges = it.def.charges || 0; it.nextFire = it.cdUntil = it.bloom = 0; }
}
// unit look vector from yaw and pitch, matching the camera convention
function lookDir(yaw, pitch, out) { const cp = Math.cos(pitch); return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp); }

// shared movement for players and bots: run, crouch, slide, slide jump, air control, dash
function stepEntity(e, dt, wx, wz, jump, crouch) {
  const now = G.time, def = e.inv[e.slot].def;
  let run = MOVE.run * (1 + (def.speed || 0)) * e.speedMul;
  if (e.ads) run *= 0.8;
  const wl = Math.hypot(wx, wz), has = wl > 0.01, ux = has ? wx / wl : 0, uz = has ? wz / wl : 0, mag = Math.min(1, wl);
  let sp = Math.hypot(e.vel.x, e.vel.z), jumped = false;
  if (now < e.dashUntil) { e.vel.copy(e.dashVel); e.sliding = false; }
  else {
    if (e.dashing) { e.dashing = false; e.vel.multiplyScalar(0.4); sp = Math.hypot(e.vel.x, e.vel.z); }
    if (e.grounded) {
      e.airJumps = def.doubleJump ? 1 : 0;
      if (!crouch) e.slideArmed = false;
      if (crouch && e.slideArmed && !e.sliding && sp >= MOVE.slideMin && now >= e.slideCd) {
        const ns = Math.min(MOVE.cap, Math.max(sp + MOVE.slideChain, run * MOVE.slideBoost));
        const dx = has ? ux : e.vel.x / sp, dz = has ? uz : e.vel.z / sp;
        e.vel.x = dx * ns; e.vel.z = dz * ns; e.sliding = true; e.slideArmed = false; e.slideCd = now + 0.2;
        if (e.isPlayer) sfx('slide');
      }
      if (e.sliding) {
        if (!crouch) e.sliding = false;
        else {
          sp = Math.hypot(e.vel.x, e.vel.z) || 0.001;
          let ns = sp - MOVE.slideDecel * dt, a = Math.atan2(e.vel.x, e.vel.z);
          if (has) a += clamp(angDiff(a, Math.atan2(ux, uz)), -MOVE.slideSteer * dt, MOVE.slideSteer * dt);
          if (ns <= MOVE.crouch) { ns = MOVE.crouch; e.sliding = false; }
          e.vel.x = Math.sin(a) * ns; e.vel.z = Math.cos(a) * ns;
        }
      }
      if (!e.sliding) {
        sp = Math.hypot(e.vel.x, e.vel.z);
        const max = crouch ? MOVE.crouch * (1 + (def.speed || 0)) : run;
        const tgt = has ? Math.max(max * mag, sp - MOVE.bleed * dt) : 0;
        const ddx = ux * tgt - e.vel.x, ddz = uz * tgt - e.vel.z, dl = Math.hypot(ddx, ddz), rate = (has ? MOVE.accel : MOVE.friction) * dt;
        if (dl <= rate) { e.vel.x = ux * tgt; e.vel.z = uz * tgt; } else { e.vel.x += ddx / dl * rate; e.vel.z += ddz / dl * rate; }
      }
    } else {
      e.sliding = false;
      if (has) {
        const keep = Math.max(sp, run * mag);
        e.vel.x += ux * MOVE.air * dt; e.vel.z += uz * MOVE.air * dt;
        const ns = Math.hypot(e.vel.x, e.vel.z);
        if (ns > keep) { e.vel.x *= keep / ns; e.vel.z *= keep / ns; }
      }
    }
    if (jump) {
      if (e.grounded || now - e.lastGround <= MOVE.coyote) { e.vel.y = MOVE.jump; e.grounded = false; e.lastGround = -9; e.sliding = false; jumped = true; }
      else if (e.airJumps > 0) {
        e.airJumps--; e.vel.y = MOVE.jump; jumped = true;
        if (has) { const s2 = Math.max(Math.hypot(e.vel.x, e.vel.z), run); e.vel.x = ux * s2; e.vel.z = uz * s2; }
      }
    }
    e.vel.y -= MOVE.gravity * dt;
    sp = Math.hypot(e.vel.x, e.vel.z);
    if (sp > MOVE.cap) { e.vel.x *= MOVE.cap / sp; e.vel.z *= MOVE.cap / sp; }
  }
  e.crouching = crouch || e.sliding;
  e.height = e.crouching ? MOVE.crouchH : MOVE.height;
  moveCollide(e, dt);
  if (e.landV > 0) {
    if (crouch) e.slideArmed = true;
    if (e.isPlayer) { G.dip = Math.min(0.28, e.landV * 0.02); if (e.landV > 7) sfx('land'); }
    e.landV = 0;
  }
  if (e.grounded && e.pos.y < 0.1 && now >= e.hazCd && inHazard(e.pos.x, e.pos.z)) {
    e.hazCd = now + 0.4; e.vel.y = 13; e.grounded = false;
    burst(e.pos.x, e.pos.y + 0.3, e.pos.z, 1, 0.45, 0.1, 14);
    damage(e, 25, null, { w: 'magma' });
  }
  if (e.pos.y < -15 && e.alive) { e.hp = 0; if (G.state === 'live') kill(e, null, {}); }
  return jumped;
}

// random direction inside a cone so spread is uniform across the crosshair
function coneDir(d, deg) {
  if (deg <= 0.001) return d.clone();
  const a = deg * Math.PI / 180 * Math.sqrt(Math.random()), ph = Math.random() * Math.PI * 2;
  const up = Math.abs(d.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(d, up).normalize(), v = new THREE.Vector3().crossVectors(d, u);
  return d.clone().multiplyScalar(Math.cos(a)).addScaledVector(u, Math.sin(a) * Math.cos(ph)).addScaledVector(v, Math.sin(a) * Math.sin(ph)).normalize();
}
// where tracers start so the player's shots appear to leave the held gun
function muzzle(e, o, d) {
  const m = o.clone().addScaledVector(d, 0.7);
  if (e.isPlayer) { m.x += Math.cos(e.yaw) * 0.2; m.z -= Math.sin(e.yaw) * 0.2; m.y -= 0.14; }
  return m;
}
// instant bullets with falloff, headshots and katana deflection, one damage event per target
function hitscan(e, def, o, d, spreadDeg) {
  const acc = new Map(), n = def.pellets || 1, mz = muzzle(e, o, d), col = e.team === 0 ? 0xbfe4ff : 0xffd9a8;
  for (let i = 0; i < n; i++) {
    const dir = coneDir(d, spreadDeg);
    const tw = rayWorld(o.x, o.y, o.z, dir.x, dir.y, dir.z, 220), wnx = HIT.nx, wny = HIT.ny, wnz = HIT.nz;
    const h = rayEnts(e, o.x, o.y, o.z, dir.x, dir.y, dir.z, tw), t = h ? h.t : tw;
    const ex = o.x + dir.x * t, ey = o.y + dir.y * t, ez = o.z + dir.z * t;
    if (h) {
      const f = clamp((t - def.fall[0]) / (def.fall[1] - def.fall[0]), 0, 1), tab = h.head ? def.head : def.dmg;
      const a = acc.get(h.ent) || { dmg: 0, head: false };
      a.dmg += lerp(tab[0], tab[1], f); a.head = a.head || h.head; acc.set(h.ent, a);
      burst(ex, ey, ez, 1, 0.9, 0.6, 3);
    } else if (tw < 220) impact(ex, ey, ez, wnx, wny, wnz);
    if (i < 5) tracer(mz.x, mz.y, mz.z, ex, ey, ez, col);
  }
  for (const [t, a] of acc) {
    if (t.blockUntil > G.time && Math.sin(t.yaw) * d.x + Math.cos(t.yaw) * d.z > 0.2) {
      burst(t.pos.x, t.pos.y + 1.3, t.pos.z, 1, 1, 1, 10); sfx('bounce', volAt(t.pos.x, t.pos.y, t.pos.z) * 2);
      damage(e, a.dmg, t, { w: 'deflect' });
    } else damage(t, a.dmg, e, { head: a.head, w: def.name });
  }
}
// short forward cast for melee, with the knife backstab bonus
function meleeHit(e, def, o, d) {
  let best = null, bd = 2.8;
  for (const t of G.ents) {
    if (!t.alive || t.team === e.team) continue;
    const vx = t.pos.x - o.x, vy = t.pos.y + t.height * 0.6 - o.y, vz = t.pos.z - o.z, l = Math.hypot(vx, vy, vz);
    if (l > bd || (l > 0.6 && (vx * d.x + vy * d.y + vz * d.z) / l < 0.5)) continue;
    if (!losClear(o.x, o.y, o.z, t.pos.x, t.pos.y + t.height * 0.6, t.pos.z, false)) continue;
    bd = l; best = t;
  }
  if (!best) return;
  const back = def.back && (Math.sin(best.yaw) * d.x + Math.cos(best.yaw) * d.z) < -0.35;
  burst(best.pos.x, best.pos.y + 1.2, best.pos.z, 1, 0.9, 0.6, 6);
  damage(best, back ? def.back : def.dmg, e, { head: back, w: def.name });
}
// availability of a utility, covering both charge based and cooldown based items
function avail(it) { return it.def.charges ? it.charges > 0 : G.time >= it.cdUntil; }
// spends a utility use in whichever way that item is limited
function consume(it) { if (it.def.charges) it.charges--; else it.cdUntil = G.time + it.def.cooldown; }
// begins a reload when it makes sense, shared by the key, auto reload and bots
function startReload(e) {
  const it = e.inv[e.slot], def = it.def;
  if (e.reloadEnd || !def.mag || it.mag >= def.mag || it.reserve <= 0 || G.time < e.equipEnd) return;
  e.reloadEnd = G.time + def.reload;
  if (e.isPlayer) sfx('reload');
}
// switches the held slot and cancels anything the old weapon was doing
function equip(e, slot) {
  if (slot === e.slot || slot < 0 || slot > 3) return;
  e.prevSlot = e.slot; e.slot = slot; e.equipEnd = G.time + 0.3; e.reloadEnd = 0; e.useEnd = 0; e.cook = 0; e.ads = false; e.blockUntil = 0;
  if (e.isPlayer) { equipVM(e.inv[slot].def); sfx('swap'); }
}
// fires the held gun or swings the held melee, enforcing interval and ammo for everyone
function attack(e, o, d, spreadDeg) {
  const it = e.inv[e.slot], def = it.def, now = G.time;
  if (now < it.nextFire || now < e.equipEnd) return false;
  if (def.type === 'melee') {
    it.nextFire = now + def.interval; e.swingT = now;
    meleeHit(e, def, o, d);
    sfx('swing', e.isPlayer ? 1 : volAt(e.pos.x, e.pos.y, e.pos.z));
    return true;
  }
  if (def.type !== 'hitscan' && def.type !== 'rocket') return false;
  if (it.mag <= 0) { startReload(e); return false; }
  if (e.reloadEnd) { if (def.shell) e.reloadEnd = 0; else return false; }
  it.mag--; it.nextFire = now + def.interval;
  if (def.type === 'hitscan') hitscan(e, def, o, d, spreadDeg); else throwProj(e, 'rocket', o, coneDir(d, spreadDeg), 4);
  it.bloom = Math.min(def.maxBloom, it.bloom + def.bloom);
  sfx(def.snd, e.isPlayer ? 1 : volAt(e.pos.x, e.pos.y, e.pos.z) * 0.8);
  muzzleFlash(e, o, d);
  return true;
}
// finishes reloads and heals and auto reloads an empty magazine
function weaponTick(e, dt) {
  const it = e.inv[e.slot], def = it.def, now = G.time;
  it.bloom = Math.max(0, it.bloom - dt * 7);
  if (e.reloadEnd && now >= e.reloadEnd) {
    if (def.shell) { it.mag++; it.reserve--; e.reloadEnd = it.mag < def.mag && it.reserve > 0 ? now + def.reload : 0; if (e.isPlayer) sfx('swap'); }
    else { const n = Math.min(def.mag - it.mag, it.reserve); it.mag += n; it.reserve -= n; e.reloadEnd = 0; }
  }
  if (e.useEnd && now >= e.useEnd) { e.useEnd = 0; e.hp = Math.min(RULES.hp, e.hp + def.heal); consume(it); if (e.isPlayer) sfx('heal'); }
  if (def.mag && it.mag === 0 && it.reserve > 0 && !e.reloadEnd && now >= it.nextFire + 0.05) startReload(e);
}
// launches a rocket or thrown utility as a ray stepped projectile
function throwProj(e, kind, o, d, fuse) {
  const rocket = kind === 'rocket';
  const col = rocket ? 0xff7a2a : kind === 'grenade' ? 0x3f6b3a : kind === 'flash' ? 0xeef2f6 : 0x8a94a2;
  const mesh = new THREE.Mesh(rocket ? PROJ_BOX : PROJ_BALL, new THREE.MeshBasicMaterial({ color: col }));
  const p = { type: kind, owner: e, pos: o.clone(), vel: d.clone().multiplyScalar(rocket ? 48 : 21), grav: !rocket, boom: G.time + fuse, rest: false, mesh };
  if (!rocket) { p.vel.y += 3; p.vel.x += e.vel.x * 0.5; p.vel.z += e.vel.z * 0.5; }
  mesh.position.copy(p.pos); fxGroup.add(mesh); G.projs.push(p);
  return p;
}
// shared projectile shapes so throws never allocate geometry
const PROJ_BALL = new THREE.SphereGeometry(0.13, 10, 8);
// rocket body shape shared across every launch
const PROJ_BOX = new THREE.BoxGeometry(0.14, 0.14, 0.5);
// advances projectiles with ray steps so they bounce off or burst on the map reliably
function projUpdate(dt) {
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const p = G.projs[i];
    let done = false;
    if (G.time >= p.boom) { detonate(p, null); done = true; }
    else if (!p.rest) {
      if (p.grav) p.vel.y -= 20 * dt;
      const sp = p.vel.length();
      if (sp > 0.05) {
        const dx = p.vel.x / sp, dy = p.vel.y / sp, dz = p.vel.z / sp, step = sp * dt, reach = step + 0.12;
        const tw = rayWorld(p.pos.x, p.pos.y, p.pos.z, dx, dy, dz, reach), nx = HIT.nx, ny = HIT.ny, nz = HIT.nz, hitW = tw < reach - 1e-6;
        if (p.type === 'rocket') {
          const h = rayEnts(p.owner, p.pos.x, p.pos.y, p.pos.z, dx, dy, dz, Math.min(tw, reach + 0.2));
          if (h) { p.pos.set(p.pos.x + dx * h.t, p.pos.y + dy * h.t, p.pos.z + dz * h.t); detonate(p, h.ent); done = true; }
          else if (hitW) { const t = Math.max(0, tw - 0.06); p.pos.set(p.pos.x + dx * t, p.pos.y + dy * t, p.pos.z + dz * t); detonate(p, null); done = true; }
          else { p.pos.addScaledVector(p.vel, dt); if (Math.random() < 0.7) spark(p.pos.x, p.pos.y, p.pos.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), 0.35, 1, 0.6, 0.2, 0); }
        } else if (hitW) {
          const t = Math.max(0, tw - 0.12), vn = p.vel.x * nx + p.vel.y * ny + p.vel.z * nz;
          p.pos.set(p.pos.x + dx * t, p.pos.y + dy * t, p.pos.z + dz * t);
          p.vel.x = (p.vel.x - 1.45 * vn * nx) * 0.75; p.vel.y = (p.vel.y - 1.45 * vn * ny) * 0.75; p.vel.z = (p.vel.z - 1.45 * vn * nz) * 0.75;
          if (ny > 0.6 && p.vel.length() < 1.6) { p.vel.set(0, 0, 0); p.rest = true; } else sfx('bounce', volAt(p.pos.x, p.pos.y, p.pos.z));
        } else p.pos.addScaledVector(p.vel, dt);
      }
      if (!done) { p.mesh.position.copy(p.pos); if (p.type === 'rocket') p.mesh.lookAt(p.pos.x + p.vel.x, p.pos.y + p.vel.y, p.pos.z + p.vel.z); }
    }
    if (done) { fxGroup.remove(p.mesh); p.mesh.material.dispose(); G.projs.splice(i, 1); }
  }
}
// resolves what a projectile does when its fuse ends or it strikes something
function detonate(p, direct) {
  const { x, y, z } = p.pos;
  if (p.type === 'rocket') explode(x, y, z, p.owner, 50, 5, direct, 'RPG');
  else if (p.type === 'grenade') explode(x, y, z, p.owner, 100, 6.5, null, 'Grenade');
  else if (p.type === 'flash') flashBang(x, y, z);
  else addSmoke(x, y, z);
}
// splash damage with linear falloff, line of sight and knockback that enables rocket jumps
function explode(x, y, z, owner, maxDmg, radius, direct, wname) {
  boomFx(x, y, z, radius);
  const v = volAt(x, y, z); sfx('boom', v); G.shake = Math.min(1, G.shake + v * v * 0.9);
  for (const e of G.ents) {
    if (!e.alive || (e.team === owner.team && e !== owner)) continue;
    const cx = e.pos.x, cy = e.pos.y + e.height * 0.5, cz = e.pos.z;
    let dx = cx - x, dy = cy - y, dz = cz - z;
    const d = Math.hypot(dx, dy, dz);
    if (e !== direct && (d > radius || !losClear(x, y + 0.15, z, cx, cy, cz, false))) continue;
    const f = e === direct ? 1 : 1 - d / radius;
    if (d < 0.2) { dx = 0; dy = 1; dz = 0; } else { dx /= d; dy /= d; dz /= d; }
    e.vel.x += dx * (5 + 13 * f); e.vel.z += dz * (5 + 13 * f); e.vel.y += Math.max(0.3, dy) * (5 + 9 * f); e.grounded = false; e.sliding = false;
    damage(e, (e === direct ? 100 : maxDmg * f) * (e === owner ? 0.4 : 1), owner, { w: wname });
  }
}
// blinds anyone with a sightline, scaled by distance and how directly they faced it
function flashBang(x, y, z) {
  sfx('flash', volAt(x, y, z)); boomFx(x, y, z, 2.5);
  for (const e of G.ents) {
    if (!e.alive) continue;
    const ey = e.pos.y + e.height * 0.9, d = Math.hypot(x - e.pos.x, y - ey, z - e.pos.z);
    if (d > 30 || !losClear(x, y + 0.2, z, e.pos.x, ey, e.pos.z, false)) continue;
    const near = 1 - d / 30;
    if (e.isPlayer) {
      const f = lookDir(e.yaw, e.pitch, TMP), facing = d < 0.5 ? 1 : Math.max(0, (f.x * (x - e.pos.x) + f.y * (y - ey) + f.z * (z - e.pos.z)) / d);
      G.flash = Math.max(G.flash, near * (0.3 + 0.7 * facing) * 4);
    } else e.blindUntil = G.time + 1 + 2.5 * near;
  }
}
// spawns an opaque cloud that hides players and blocks bot sightlines
function addSmoke(x, y, z) {
  sfx('smoke', volAt(x, y, z));
  const g = new THREE.Group();
  for (let i = 0; i < 11; i++) { const m = new THREE.Mesh(SMOKE_GEO, SMOKE_MAT); m.position.set(rand(-2.6, 2.6), rand(0, 2.6), rand(-2.6, 2.6)); m.scale.setScalar(rand(1.9, 2.9)); g.add(m); }
  g.position.set(x, y, z); g.scale.setScalar(0.01); fxGroup.add(g);
  G.smokes.push({ x, y: y + 1.2, z, r: 5, start: G.time, end: G.time + 10, mesh: g });
}
// shared smoke puff shape
const SMOKE_GEO = new THREE.SphereGeometry(1, 10, 8);
// double sided so the cloud stays opaque from the inside
const SMOKE_MAT = new THREE.MeshLambertMaterial({ color: 0xd3d9e2, side: THREE.DoubleSide });
// scythe dash: a short burst along the look direction that ignores gravity
function startDash(e, d) {
  e.dashVel.copy(d).multiplyScalar(34); e.dashUntil = G.time + 0.3; e.dashing = true; e.grounded = false; e.altCd = G.time + 6;
  if (e.isPlayer) sfx('dash');
}

// single place health changes so feedback, stats and eliminations stay consistent
function damage(t, amt, src, info) {
  if (!t.alive || G.state !== 'live' || amt <= 0) return;
  amt = Math.min(amt, t.hp); t.hp -= amt;
  if (src && src !== t) src.stats.dmg += amt;
  const P = G.player, dead = t.hp <= 0.01;
  if (t === P) { G.hurt = Math.min(1, G.hurt + amt / 50); G.shake = Math.min(1, G.shake + amt / 220); sfx('hurt'); if (src && src !== t) showDirHit(src.pos); }
  if (src === P && t !== P) { hitmarker(info.head, dead); dmgNumber(t, amt, info.head); sfx(info.head ? 'head' : 'hit'); }
  if (dead) kill(t, src, info);
}
// removes a combatant from the round and credits whoever caused it
function kill(t, src, info) {
  t.alive = false; t.hp = 0; t.stats.deaths++; t.body.visible = false; t.cook = 0; t.useEnd = 0;
  const c = new THREE.Color(TEAM_COL[t.team]);
  burst(t.pos.x, t.pos.y + 1, t.pos.z, c.r, c.g, c.b, 40);
  const by = src && src !== t ? src : null;
  if (by) by.stats.kills++;
  feed(by, t, info.w);
  if (t === G.player) { G.killer = by; G.spectate = null; sfx('death'); }
  else if (by === G.player) { sfx('kill'); G.elims++; }
}

// bot brain: pick a target, path or strafe, aim with human error and fire in bursts
function botUpdate(b, dt) {
  if (!b.alive) return;
  const now = G.time, D = DIFF[SAVE.set.diff], live = G.state === 'live';
  let wx = 0, wz = 0, jump = false;
  b.speedMul = D.speed;
  b.thinkT -= dt;
  if (b.thinkT <= 0) {
    b.thinkT = rand(0.18, 0.3);
    let best = null, bs = 1e9, bv = false;
    for (const e of G.ents) {
      if (!e.alive || e.team === b.team) continue;
      const vis = now >= b.blindUntil && canSee(b, e), sc = Math.hypot(e.pos.x - b.pos.x, e.pos.z - b.pos.z) * (vis ? 0.5 : 1);
      if (sc < bs) { bs = sc; best = e; bv = vis; }
    }
    if (bv && (best !== b.target || !b.sees)) { b.reactAt = now + D.react * rand(0.8, 1.3); b.seeT = now; }
    b.target = best; b.sees = bv;
  }
  const t = b.target;
  if (t && t.alive && G.state !== 'countdown') {
    const dx = t.pos.x - b.pos.x, dz = t.pos.z - b.pos.z, d = Math.hypot(dx, dz) || 0.001;
    if (live) { const want = d < 2.3 || (b.slot === 2 && d < 3.4) ? 2 : b.inv[0].mag + b.inv[0].reserve > 0 ? 0 : 1; if (want !== b.slot) equip(b, want); }
    const def = b.inv[b.slot].def, melee = def.type === 'melee';
    const range = melee ? 1.4 : def.pellets ? 7 : def.scope ? 30 : 15;
    if (now < b.unstick) { wx = b.ux; wz = b.uz; jump = b.grounded; }
    else if (b.sees && d < range * 1.25) {
      if (now >= b.strafeT) { b.strafeT = now + rand(0.35, 1.1); b.strafeDir = Math.random() < 0.5 ? -1 : 1; if (b.grounded && Math.random() < 0.22) jump = true; }
      const fwd = melee || d > range ? 1 : d < range * 0.45 ? -0.7 : 0;
      wx = -dz / d * b.strafeDir + dx / d * fwd; wz = dx / d * b.strafeDir + dz / d * fwd;
      if (!navSafe(b, wx, wz)) {
        b.strafeDir *= -1; wx = -dz / d * b.strafeDir + dx / d * fwd; wz = dx / d * b.strafeDir + dz / d * fwd;
        if (!navSafe(b, wx, wz)) { const nd = navDir(b, t); wx = nd.x; wz = nd.z; }
      }
    } else { const nd = navDir(b, t); wx = nd.x; wz = nd.z; }
    const ex = b.pos.x, ey = b.pos.y + b.height * 0.9, ez = b.pos.z;
    const ax = t.pos.x - ex, ay = t.pos.y + t.height * 0.62 - ey, az = t.pos.z - ez, al = Math.hypot(ax, ay, az) || 0.001;
    let wantYaw = b.yaw, wantPitch = 0;
    if (b.sees) { wantYaw = Math.atan2(-ax, -az); wantPitch = Math.asin(clamp(ay / al, -1, 1)); }
    else if (wx || wz) wantYaw = Math.atan2(-wx, -wz);
    b.yaw += clamp(angDiff(b.yaw, wantYaw), -D.turn * dt, D.turn * dt);
    b.pitch += clamp(wantPitch - b.pitch, -D.turn * dt, D.turn * dt);
    if (live && b.sees && now >= b.reactAt && now >= b.blindUntil && Math.abs(angDiff(b.yaw, wantYaw)) < 0.25) {
      const o = new THREE.Vector3(ex, ey, ez), dir = new THREE.Vector3(ax / al, ay / al, az / al);
      if (melee) { if (al < 2.7) attack(b, o, dir, 0); }
      else if (now >= b.pauseUntil) {
        const err = lerp(D.err[0], D.err[1], clamp((now - b.seeT) / 1.5, 0, 1)) * (Math.hypot(t.vel.x, t.vel.z) > 9 ? 1.5 : 1) * (t.grounded ? 1 : 1.25);
        if (attack(b, o, dir, err + (def.pellets ? def.spread : def.spread * 0.4))) {
          if (!def.auto) b.pauseUntil = now + rand(0.1, 0.35);
          else if (--b.burst <= 0) { b.burst = 4 + ((Math.random() * 6) | 0); b.pauseUntil = now + rand(0.25, 0.6); }
        }
        if (now >= b.nadeAt && d > 7 && d < 24 && Math.random() < dt * 0.3) { b.nadeAt = now + rand(14, 24); throwProj(b, 'grenade', o, new THREE.Vector3(ax / al, ay / al + 0.22, az / al).normalize(), 2.4); }
      }
    }
  }
  stepEntity(b, dt, wx, wz, jump, false);
  weaponTick(b, dt);
  if (now >= b.stuckT) {
    if (live && (wx || wz) && Math.hypot(b.pos.x - b.sx, b.pos.z - b.sz) < 0.35) { const a = Math.random() * Math.PI * 2; b.ux = Math.cos(a); b.uz = Math.sin(a); b.unstick = now + 0.45; }
    b.sx = b.pos.x; b.sz = b.pos.z; b.stuckT = now + 0.8;
  }
}

// pooled tracer streaks so sustained fire never allocates
const TRACERS = [];
// unit box stretched along z for every tracer
const TR_GEO = new THREE.BoxGeometry(1, 1, 1);
for (let i = 0; i < 48; i++) {
  const m = new THREE.Mesh(TR_GEO, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.visible = false; fxGroup.add(m); TRACERS.push({ m, life: 0 });
}
// round robin index into the tracer pool
let trNext = 0;
// draws a brief streak from muzzle to impact so shots are readable
function tracer(ax, ay, az, bx, by, bz, color) {
  const len = Math.hypot(bx - ax, by - ay, bz - az);
  if (len < 0.6) return;
  const t = TRACERS[trNext++ % TRACERS.length];
  t.m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); t.m.scale.set(0.035, 0.035, len); t.m.lookAt(bx, by, bz);
  t.m.material.color.setHex(color); t.m.material.opacity = 0.9; t.m.visible = true; t.life = 0.09;
}

// particle capacity sized for several overlapping explosions
const PN = 600;
// particle buffers kept as flat arrays so one draw call renders every spark
const P = { pos: new Float32Array(PN * 3), col: new Float32Array(PN * 3), base: new Float32Array(PN * 3), vel: new Float32Array(PN * 3), life: new Float32Array(PN), max: new Float32Array(PN), grav: new Float32Array(PN), next: 0 };
P.pos.fill(-9999);
// geometry wrapper around the particle buffers
const P_GEO = new THREE.BufferGeometry();
P_GEO.setAttribute('position', new THREE.BufferAttribute(P.pos, 3)); P_GEO.setAttribute('color', new THREE.BufferAttribute(P.col, 3));
// the single points object that draws all sparks additively
const P_MESH = new THREE.Points(P_GEO, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
P_MESH.frustumCulled = false; fxGroup.add(P_MESH);
// emits one spark, recycling the oldest slot when the pool is full
function spark(x, y, z, vx, vy, vz, life, r, g, b, grav) {
  const i = P.next++ % PN, k = i * 3;
  P.pos[k] = x; P.pos[k + 1] = y; P.pos[k + 2] = z; P.vel[k] = vx; P.vel[k + 1] = vy; P.vel[k + 2] = vz;
  P.base[k] = r; P.base[k + 1] = g; P.base[k + 2] = b; P.life[i] = P.max[i] = life; P.grav[i] = grav;
}
// radial spray used for hits, deaths and hazard burns
function burst(x, y, z, r, g, b, n) {
  for (let i = 0; i < n; i++) spark(x, y, z, rand(-4, 4), rand(-1, 6), rand(-4, 4), rand(0.25, 0.7), r, g, b, 14);
}
// sparks thrown off a surface along its normal when a bullet lands
function impact(x, y, z, nx, ny, nz) {
  for (let i = 0; i < 5; i++) spark(x, y, z, nx * rand(1, 5) + rand(-2, 2), ny * rand(1, 5) + rand(-1, 3), nz * rand(1, 5) + rand(-2, 2), rand(0.15, 0.4), 1, 0.85, 0.5, 12);
}
// pooled fireballs so explosions never allocate
const BOOMS = [];
for (let i = 0; i < 6; i++) {
  const m = new THREE.Mesh(SMOKE_GEO, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.visible = false; fxGroup.add(m); BOOMS.push({ m, life: 0, r: 1 });
}
// round robin index into the fireball pool
let boomNext = 0;
// light that flashes for explosions so they brighten nearby walls
const BOOM_LIGHT = new THREE.PointLight(0xffa050, 0, 30);
// light that flashes for the nearest gunshot
const MUZ_LIGHT = new THREE.PointLight(0xffd9a0, 0, 12);
scene.add(BOOM_LIGHT, MUZ_LIGHT);
// expanding fireball, debris and a light flash for any blast
function boomFx(x, y, z, radius) {
  const b = BOOMS[boomNext++ % BOOMS.length];
  b.m.position.set(x, y, z); b.m.visible = true; b.life = 0.35; b.r = radius;
  BOOM_LIGHT.position.set(x, y + 0.5, z); BOOM_LIGHT.intensity = 400;
  for (let i = 0; i < 34; i++) spark(x, y, z, rand(-9, 9), rand(-2, 11), rand(-9, 9), rand(0.3, 0.9), 1, rand(0.4, 0.8), 0.15, 12);
}
// brief light and viewmodel flash when any weapon fires
function muzzleFlash(e, o, d) {
  MUZ_LIGHT.position.set(o.x + d.x * 0.8, o.y + d.y * 0.8, o.z + d.z * 0.8); MUZ_LIGHT.intensity = 40;
  if (e.isPlayer) VM.flashT = 0.05;
}
// advances every pooled effect and retires the ones that have expired
function fxUpdate(dt) {
  for (const t of TRACERS) if (t.life > 0) { t.life -= dt; t.m.material.opacity = Math.max(0, t.life / 0.09) * 0.9; if (t.life <= 0) t.m.visible = false; }
  for (let i = 0; i < PN; i++) {
    if (P.life[i] <= 0) continue;
    const k = i * 3;
    P.life[i] -= dt;
    if (P.life[i] <= 0) { P.pos[k + 1] = -9999; continue; }
    P.vel[k + 1] -= P.grav[i] * dt;
    P.pos[k] += P.vel[k] * dt; P.pos[k + 1] += P.vel[k + 1] * dt; P.pos[k + 2] += P.vel[k + 2] * dt;
    const f = P.life[i] / P.max[i];
    P.col[k] = P.base[k] * f; P.col[k + 1] = P.base[k + 1] * f; P.col[k + 2] = P.base[k + 2] * f;
  }
  P_GEO.attributes.position.needsUpdate = true; P_GEO.attributes.color.needsUpdate = true;
  for (const b of BOOMS) if (b.life > 0) {
    b.life -= dt;
    const f = clamp(1 - b.life / 0.35, 0, 1);
    b.m.scale.setScalar(0.4 + b.r * 0.75 * f); b.m.material.opacity = (1 - f) * 0.9;
    if (b.life <= 0) b.m.visible = false;
  }
  BOOM_LIGHT.intensity *= Math.exp(-dt * 9); MUZ_LIGHT.intensity *= Math.exp(-dt * 30);
  for (let i = G.smokes.length - 1; i >= 0; i--) {
    const s = G.smokes[i];
    if (G.time >= s.end) { fxGroup.remove(s.mesh); G.smokes.splice(i, 1); continue; }
    s.mesh.scale.setScalar(Math.max(0.01, Math.min(1, (G.time - s.start) / 0.7, (s.end - G.time) / 1.2)));
  }
}

// pooled floating damage numbers projected from world space each frame
const NUMS = [];
for (let i = 0; i < 14; i++) { const el = document.createElement('span'); el.style.opacity = '0'; $('nums').appendChild(el); NUMS.push({ el, t: 0, pos: new THREE.Vector3(), on: false }); }
// round robin index into the damage number pool
let numNext = 0;
// shows how much a hit dealt above the target, yellow for headshots
function dmgNumber(t, amt, head) {
  const n = NUMS[numNext++ % NUMS.length];
  n.pos.set(t.pos.x + rand(-0.3, 0.3), t.pos.y + t.height + 0.25, t.pos.z + rand(-0.3, 0.3)); n.t = 0.8; n.on = true;
  n.el.textContent = String(Math.max(1, Math.round(amt))); n.el.style.color = head ? '#ffd84a' : '#ffffff';
}
// restarts a css animation, needed because re-adding a class alone does nothing
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
// crosshair confirmation that distinguishes body hits, headshots and eliminations
function hitmarker(head, dead) { const el = $('hitm'); el.style.color = dead ? '#ff4a4a' : head ? '#ffd84a' : '#ffffff'; replay(el, 'show'); }
// where the last damage came from, kept so the indicator can track as you turn
const DIRHIT = { x: 0, z: 0, t: 0 };
// arms the damage direction arc toward an attacker
function showDirHit(pos) { DIRHIT.x = pos.x; DIRHIT.z = pos.z; DIRHIT.t = 1; }
// adds a kill feed row that removes itself when its fade finishes
function feed(by, t, w) {
  const d = document.createElement('div');
  d.className = 'frow';
  d.innerHTML = (by ? `<b style="color:${TEAM_CSS[by.team]}">${by.name}</b><i>${w || 'eliminated'}</i>` : '') + `<b style="color:${TEAM_CSS[t.team]}">${t.name}</b>` + (by ? '' : `<i>${w === 'magma' ? 'burned' : 'fell'}</i>`);
  d.addEventListener('animationend', () => d.remove());
  $('feed').prepend(d);
  while ($('feed').children.length > 5) $('feed').lastChild.remove();
}
// large centre announcement for round starts and results
function banner(text, color) { const el = $('banner'); el.textContent = text; el.style.color = color || '#fff'; replay(el, 'show'); }

// held weapon state: the mesh plus the springs that animate it
const VM = { root: new THREE.Group(), group: null, flash: null, flashT: 0, kick: 0, sx: 0, sy: 0, bob: 0, ads: 0, muz: -0.6 };
vmScene.add(VM.root);
VM.flash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthTest: false }));
VM.flash.visible = false; VM.root.add(VM.flash);
// material cache for held weapon parts
const VM_MATS = new Map();
// returns a cached material for a held weapon colour
function vmMat(c) { if (!VM_MATS.has(c)) VM_MATS.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.15 })); return VM_MATS.get(c); }
// part lists that describe each held weapon as boxes: w h d x y z colour
const VM_PARTS = (() => {
  const D = 0x2a2e38, M = 0xb9c0cc, A = 0x2f9bff, S = 0xf3d7b4, Wd = 0x8a5a33;
  return {
    rifle: [[.07, .1, .6, 0, 0, -.2, D], [.035, .035, .24, 0, .012, -.6, M], [.05, .17, .07, 0, -.12, -.14, A], [.05, .12, .06, 0, -.09, .04, D], [.06, .08, .2, 0, -.01, .2, D], [.02, .04, .1, 0, .07, -.1, A]],
    shotgun: [[.08, .09, .7, 0, 0, -.25, D], [.05, .05, .5, 0, -.06, -.3, Wd], [.06, .1, .22, 0, -.03, .18, Wd]],
    sniper: [[.06, .09, .9, 0, 0, -.3, D], [.03, .03, .3, 0, .01, -.85, M], [.05, .06, .26, 0, .085, -.2, D], [.05, .14, .06, 0, -.1, -.05, A], [.06, .09, .24, 0, -.02, .24, D]],
    launcher: [[.14, .14, .8, 0, .02, -.2, 0x4a5a3a], [.17, .17, .12, 0, .02, -.62, D], [.05, .14, .06, 0, -.11, -.1, D], [.1, .1, .14, 0, .02, -.72, 0xff7a2a]],
    pistol: [[.055, .08, .28, 0, 0, -.1, D], [.05, .14, .06, 0, -.1, 0, D], [.056, .03, .27, 0, .05, -.1, M]],
    revolver: [[.05, .07, .34, 0, .01, -.14, M], [.08, .09, .1, 0, 0, -.04, D], [.05, .15, .06, 0, -.1, .02, Wd]],
    smg: [[.07, .1, .3, 0, 0, -.1, D], [.035, .035, .14, 0, .01, -.32, M], [.045, .26, .055, 0, -.16, -.08, A], [.05, .12, .06, 0, -.09, .04, D]],
    shorty: [[.1, .07, .36, 0, 0, -.14, D], [.06, .1, .14, 0, -.05, .06, Wd]],
    fists: [[.11, .11, .15, 0, -.02, -.12, S], [.11, .11, .15, -.42, -.02, -.2, S], [.1, .1, .3, -.42, -.04, .02, A]],
    knife: [[.02, .06, .3, 0, .02, -.22, M], [.035, .05, .13, 0, 0, -.01, D]],
    katana: [[.02, .05, .85, 0, .03, -.5, M], [.09, .09, .02, 0, .02, -.07, 0xd9b24a], [.035, .05, .2, 0, .01, .04, D]],
    scythe: [[.035, .035, .9, 0, 0, -.3, Wd], [.4, .03, .12, -.2, .02, -.72, M]],
    nade: [[.11, .13, .11, 0, 0, -.08, 0x3f6b3a], [.05, .04, .05, 0, .085, -.08, M]],
    flash: [[.09, .15, .09, 0, 0, -.08, 0xdfe6ee], [.05, .03, .05, 0, .09, -.08, D]],
    smokeg: [[.09, .16, .09, 0, 0, -.08, 0x7c8794], [.092, .03, .092, 0, .02, -.08, 0xffd84a]],
    medkit: [[.22, .16, .1, 0, 0, -.1, 0xf2f2f2], [.1, .03, .105, 0, 0, -.1, 0xe53b3b], [.03, .1, .105, 0, 0, -.1, 0xe53b3b]],
  };
})();
// barrel tip distance per weapon shape so the flash sits on the muzzle
const VM_MUZ = { rifle: -.74, shotgun: -.62, sniper: -1.02, launcher: -.8, pistol: -.26, revolver: -.33, smg: -.41, shorty: -.34 };
// rebuilds the held weapon mesh when the player changes slot
function equipVM(def) {
  if (VM.group) { VM.root.remove(VM.group); VM.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  const g = new THREE.Group();
  const parts = [...VM_PARTS[def.vm], [.09, .09, .36, .02, -.08, .22, 0x2f9bff], [.085, .085, .1, .02, -.07, .01, 0xf3d7b4]];
  for (const p of parts) { const m = new THREE.Mesh(new THREE.BoxGeometry(p[0], p[1], p[2]), vmMat(p[6])); m.position.set(p[3], p[4], p[5]); g.add(m); }
  VM.group = g; VM.muz = VM_MUZ[def.vm] || -0.4; VM.root.add(g);
}
// animates the held weapon: equip, sway, bob, recoil, reload, swings and aiming
function updateVM(dt) {
  const p = G.player, now = G.time, it = p.inv[p.slot], def = it.def;
  const scoped = p.ads && def.scope;
  VM.root.visible = G.mode === 'match' && p.alive && !scoped;
  if (!VM.root.visible) return;
  const sp = Math.hypot(p.vel.x, p.vel.z);
  VM.ads = lerp(VM.ads, p.ads ? 1 : 0, damp(18, dt));
  VM.kick *= Math.exp(-dt * 14);
  VM.sx = lerp(VM.sx, clamp(-IN.mdx * 0.0025, -0.06, 0.06), damp(10, dt));
  VM.sy = lerp(VM.sy, clamp(IN.mdy * 0.0025, -0.05, 0.05), damp(10, dt));
  if (p.grounded && !p.sliding) VM.bob += sp * dt * 1.5;
  const bobAmt = p.grounded && !p.sliding ? Math.min(1, sp / 8) * (1 - VM.ads) : 0;
  let x = lerp(0.25, 0, VM.ads) + VM.sx + Math.cos(VM.bob) * 0.008 * bobAmt;
  let y = lerp(-0.23, -0.15, VM.ads) + VM.sy + Math.sin(VM.bob * 2) * 0.008 * bobAmt - clamp(p.vel.y * 0.004, -0.04, 0.04);
  let z = lerp(-0.5, -0.42, VM.ads) + VM.kick * 0.09;
  let rx = VM.kick * 0.14 - VM.sy * 1.5, ry = VM.sx * 1.5, rz = p.sliding ? 0.3 : 0;
  const eq = clamp((p.equipEnd - now) / 0.3, 0, 1);
  y -= eq * 0.32; rx -= eq * 0.9;
  if (p.reloadEnd) { const r = Math.sin(clamp(1 - (p.reloadEnd - now) / def.reload, 0, 1) * Math.PI); y -= 0.12 * r; rx += 0.55 * r; rz += 0.3 * r; }
  const sw = clamp((now - p.swingT) / 0.25, 0, 1);
  if (sw < 1) { const s = Math.sin(sw * Math.PI); ry += s * 0.9; rx -= s * 0.5; z -= s * 0.25; x -= s * 0.12; }
  if (p.blockUntil > now) { rz += 1.2; x -= 0.2; y += 0.06; }
  if (p.cook || p.useEnd) { y += 0.06; rx += 0.3; }
  VM.root.position.set(x, y, z); VM.root.rotation.set(rx, ry, rz);
  VM.flashT -= dt;
  VM.flash.visible = VM.flashT > 0;
  if (VM.flash.visible) { VM.flash.position.set(0, 0.01, VM.muz - 0.06); VM.flash.rotation.z = Math.random() * 3; VM.flash.scale.setScalar(rand(0.7, 1.3)); }
}

// last value written per hud element so the dom is only touched on change
const HC = {};
// writes text only when it actually changed
function setText(id, v) { if (HC[id] !== v) { HC[id] = v; $(id).textContent = v; } }
// toggles a class only when the state actually changed
function setFlag(id, cls, on) { const k = id + cls; if (HC[k] !== on) { HC[k] = on; $(id).classList.toggle(cls, on); } }
// short readout for a utility slot: charges left, ready, or seconds remaining
function utilText(it) { return it.def.charges ? 'x' + it.charges : G.time >= it.cdUntil ? 'READY' : Math.ceil(it.cdUntil - G.time) + 's'; }
// creates the four hotbar slots once per match from the player's loadout
function buildHotbar() {
  $('hotbar').innerHTML = G.player.inv.map((it, i) => `<div class="slot" id="slot${i}"><div class="k">${i + 1}</div><div class="n">${it.def.name}</div><div class="a" id="slotA${i}"></div></div>`).join('');
  for (const k in HC) delete HC[k];
}
// redraws the round win pips when the score changes
function drawPips() {
  for (let t = 0; t < 2; t++) $(t ? 'pipsB' : 'pipsA').innerHTML = Array.from({ length: RULES.toWin }, (_, i) => `<span class="${(t ? i < G.score[1] : RULES.toWin - 1 - i < G.score[0]) ? 'on' : ''}"></span>`).join('');
}
// builds the stat table shared by the tab scoreboard and the results screen
function boardHtml() {
  let h = '<table><tr><th>Player</th><th>Elims</th><th>Deaths</th><th>Damage</th></tr>';
  for (const e of [...G.ents].sort((a, b) => a.team - b.team || b.stats.dmg - a.stats.dmg)) h += `<tr class="${e.isPlayer ? 'me' : ''}"><td style="color:${TEAM_CSS[e.team]}">${e.name}</td><td>${e.stats.kills}</td><td>${e.stats.deaths}</td><td>${Math.round(e.stats.dmg)}</td></tr>`;
  return h + '</table>';
}
// per frame hud refresh covering health, ammo, timers, crosshair and overlays
function hudUpdate(dt) {
  const p = G.player, now = G.time, it = p.inv[p.slot], def = it.def;
  setText('hpText', String(Math.ceil(p.hp)));
  const hpw = Math.round(p.hp / RULES.hp * 100);
  if (HC.hpw !== hpw) { HC.hpw = hpw; $('hpFill').style.width = hpw + '%'; $('hpFill').style.background = hpw > 50 ? '#3fe07a' : hpw > 25 ? '#ffc23a' : '#ff4a4a'; }
  setText('wname', def.name);
  let main, sub = '';
  if (def.mag) { main = String(it.mag); sub = p.reloadEnd ? 'RELOADING' : '/ ' + it.reserve; }
  else if (def.type === 'melee') { main = ''; sub = def.alt ? (now < p.altCd ? def.alt + ' ' + Math.ceil(p.altCd - now) + 's' : 'right click: ' + def.alt) : def.doubleJump ? 'double jump' : def.back ? 'backstab 150' : ''; }
  else { main = utilText(it); sub = p.cook ? 'COOKING ' + Math.max(0, 3 - (now - p.cook)).toFixed(1) : p.useEnd ? 'HEALING' : ''; }
  setText('ammoMain', main); setText('ammoSub', sub);
  for (let i = 0; i < 4; i++) {
    const s = p.inv[i], d = s.def;
    setFlag('slot' + i, 'on', i === p.slot);
    setText('slotA' + i, d.mag ? s.mag + '/' + s.reserve : d.type === 'melee' ? (d.alt && now < p.altCd ? Math.ceil(p.altCd - now) + 's' : '') : utilText(s));
  }
  const tl = Math.max(0, Math.ceil(G.roundT));
  setText('timer', Math.floor(tl / 60) + ':' + String(tl % 60).padStart(2, '0'));
  setText('roundLabel', 'ROUND ' + G.round);
  const sk = G.score[0] + '-' + G.score[1];
  if (HC.score !== sk) { HC.score = sk; drawPips(); }
  setText('big', G.state === 'countdown' ? String(Math.ceil(G.stateT)) : '');
  const scoped = p.alive && p.ads && def.scope;
  setFlag('scope', 'hidden', !scoped); setFlag('cross', 'hidden', !p.alive || scoped);
  let spread = def.spread ? def.spread + it.bloom : 0.6;
  if (def.spread) { if (p.ads) spread *= def.adsMul; if (!p.grounded && !def.pellets) spread *= 1.5; }
  $('cross').style.setProperty('--g', Math.round(4 + spread * innerHeight / camera.fov) + 'px');
  G.hurt = Math.max(0, G.hurt - dt * 1.4); G.flash = Math.max(0, G.flash - dt);
  $('hurtOv').style.opacity = Math.max(G.hurt, p.alive && p.hp < 45 ? 0.35 + Math.sin(now * 6) * 0.1 : 0).toFixed(2);
  $('flashOv').style.opacity = Math.min(1, G.flash).toFixed(2);
  DIRHIT.t = Math.max(0, DIRHIT.t - dt * 0.9);
  if (DIRHIT.t > 0) {
    const dx = DIRHIT.x - p.pos.x, dz = DIRHIT.z - p.pos.z;
    const ang = Math.atan2(dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw), -dx * Math.sin(p.yaw) - dz * Math.cos(p.yaw));
    $('dirHit').style.transform = `rotate(${ang}rad)`;
  }
  $('dirHit').style.opacity = DIRHIT.t.toFixed(2);
  for (const n of NUMS) {
    if (!n.on) continue;
    n.t -= dt;
    if (n.t <= 0) { n.on = false; n.el.style.opacity = '0'; continue; }
    TMP.copy(n.pos); TMP.y += (0.8 - n.t) * 1.2; TMP.project(camera);
    if (TMP.z > 1) { n.el.style.opacity = '0'; continue; }
    n.el.style.opacity = Math.min(1, n.t * 3).toFixed(2);
    n.el.style.transform = `translate(${((TMP.x + 1) / 2 * innerWidth).toFixed(0)}px,${((1 - TMP.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%,-50%)`;
  }
  setFlag('spec', 'hidden', p.alive || !G.spectate);
  if (!p.alive && G.spectate) setText('spec', 'SPECTATING ' + G.spectate.name);
  setFlag('lockHint', 'hidden', G.locked || G.touch || G.state === 'matchEnd');
  setFlag('board', 'hidden', !IN.board);
  if (IN.board) { const h = boardHtml(); if (HC.board !== h) { HC.board = h; $('board').innerHTML = h; } }
}

// live input shared by keyboard, mouse and touch so gameplay reads one source
const IN = { keys: {}, fire: false, alt: false, firePressed: false, altPressed: false, reloadPressed: false, slotReq: -1, jumpBuf: 0, mdx: 0, mdy: 0, tx: 0, tz: 0, tCrouch: false, board: false };
// drops every held input so nothing sticks after a pause, blur or menu
function clearInput() { IN.keys = {}; IN.fire = IN.alt = IN.firePressed = IN.altPressed = IN.reloadPressed = IN.tCrouch = IN.board = false; IN.slotReq = -1; IN.tx = IN.tz = 0; }

// removes thrown objects and smoke so a new round starts clean
function clearTransient() {
  for (const p of G.projs) { fxGroup.remove(p.mesh); p.mesh.material.dispose(); }
  for (const s of G.smokes) fxGroup.remove(s.mesh);
  G.projs.length = 0; G.smokes.length = 0;
}
// frees every combatant mesh when a match ends or restarts
function clearEnts() {
  clearTransient();
  for (const e of G.ents) { scene.remove(e.body); e.body.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  G.ents.length = 0; G.player = null;
}
// random bot kit drawn from weapons the bot brain knows how to use
function botLoadout() {
  const pick = (a) => a[(Math.random() * a.length) | 0];
  return [pick(['ar', 'ar', 'shotgun', 'sniper']), pick(['handgun', 'revolver', 'uzi']), pick(['fists', 'knife']), 'grenade'];
}
// builds the arena and both teams, then starts round one
function startMatch() {
  clearEnts(); loadMap(SAVE.set.map);
  const n = SAVE.set.size, names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  G.time = 0; G.score = [0, 0]; G.round = 0; G.elims = 0; G.mode = 'match'; G.paused = false;
  G.player = makeEnt('You', 0, true, SAVE.loadout.map((id, i) => (owns(id) ? id : DEF_SAVE.loadout[i])));
  G.ents.push(G.player);
  for (let i = 1; i < n; i++) G.ents.push(makeEnt(names.pop(), 0, false, botLoadout()));
  for (let i = 0; i < n; i++) G.ents.push(makeEnt(names.pop(), 1, false, botLoadout()));
  clearInput(); buildHotbar(); $('feed').innerHTML = '';
  $('menu').classList.add('hidden'); $('results').classList.add('hidden'); $('pause').classList.add('hidden'); $('hud').classList.remove('hidden');
  startRound();
}
// resets everyone to their spawns and begins the pre round countdown
function startRound() {
  G.round++; clearTransient();
  const idx = [0, 0];
  for (const e of G.ents) { resetEnt(e, world.spawns[e.team][idx[e.team]++ % 5]); e.body.visible = !e.isPlayer; }
  G.state = 'countdown'; G.stateT = RULES.countdown; G.roundT = RULES.roundTime; G.spectate = null; G.killer = null;
  G.flash = G.hurt = G.shake = G.punch = 0; G.lastBeep = 99; IN.jumpBuf = 0;
  equipVM(G.player.inv[0].def);
  banner('ROUND ' + G.round);
}
// awards the round, or replays it when nobody is ahead
function endRound(w) {
  G.state = 'roundEnd'; G.stateT = RULES.roundEnd;
  if (w >= 0) G.score[w]++;
  banner(w < 0 ? 'DRAW  REPLAY' : w === 0 ? 'ROUND WON' : 'ROUND LOST', w < 0 ? '#fff' : TEAM_CSS[w]);
  sfx(w === 0 ? 'win' : w === 1 ? 'lose' : 'beep');
}
// pays out keys and xp, saves, and shows the results screen
function endMatch() {
  G.state = 'matchEnd';
  const won = G.score[0] > G.score[1], before = levelOf(SAVE.xp);
  const keys = won ? RULES.winKeys : RULES.lossKeys, xp = (won ? RULES.winXp : RULES.lossXp) + G.elims * RULES.elimXp;
  SAVE.xp += xp;
  const ups = levelOf(SAVE.xp) - before;
  SAVE.keys += keys + ups; SAVE.elims += G.elims;
  if (won) SAVE.wins++; else SAVE.losses++;
  persist(); clearInput();
  $('resTitle').textContent = won ? 'VICTORY' : 'DEFEAT'; $('resTitle').style.color = won ? TEAM_CSS[0] : TEAM_CSS[1];
  $('resScore').textContent = G.score[0] + ' : ' + G.score[1] + '   ' + world.name;
  $('resTable').innerHTML = boardHtml();
  $('resReward').textContent = '+' + keys + ' keys   +' + xp + ' XP' + (ups > 0 ? '   Level up to ' + levelOf(SAVE.xp) + ' (+' + ups + ' key)' : '');
  $('results').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}
// round state machine: countdown, live play with win checks, and the pause between rounds
function matchLogic(dt) {
  if (G.state === 'countdown') {
    G.stateT -= dt;
    const c = Math.ceil(G.stateT);
    if (c !== G.lastBeep && c > 0) { G.lastBeep = c; sfx('beep'); }
    if (G.stateT <= 0) { G.state = 'live'; banner('FIGHT'); sfx('go'); }
  } else if (G.state === 'live') {
    G.roundT -= dt;
    let a = 0, b = 0, ha = 0, hb = 0;
    for (const e of G.ents) if (e.alive) { if (e.team === 0) { a++; ha += e.hp; } else { b++; hb += e.hp; } }
    if (!a || !b) endRound(!a && !b ? -1 : a ? 0 : 1);
    else if (G.roundT <= 0) endRound(a !== b ? (a > b ? 0 : 1) : Math.abs(ha - hb) > 0.5 ? (ha > hb ? 0 : 1) : -1);
  } else if (G.state === 'roundEnd') {
    G.stateT -= dt;
    if (G.stateT <= 0) { if (G.score[0] >= RULES.toWin || G.score[1] >= RULES.toWin) endMatch(); else startRound(); }
  }
}
// leaves the match and returns to the menu with a refreshed profile
function toMenu() {
  clearEnts(); clearInput();
  G.mode = 'menu'; G.state = 'idle'; G.paused = false;
  $('hud').classList.add('hidden'); $('pause').classList.add('hidden'); $('results').classList.add('hidden'); $('menu').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  refreshMenu();
}
// freezes or resumes the simulation and shows the pause overlay
function setPaused(v) {
  if (G.mode !== 'match' || G.state === 'matchEnd') return;
  G.paused = v; clearInput();
  $('pause').classList.toggle('hidden', !v);
  if (v && document.pointerLockElement) document.exitPointerLock();
}
// requests mouse capture, tolerated to fail because look also works without it
function lock() {
  if (G.touch || document.pointerLockElement === canvas) return;
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* embedded frames may forbid capture */ }
}

// turns the player's input into movement, aiming, firing, throwing and reloading
function playerUpdate(dt) {
  const p = G.player, now = G.time;
  if (!p.alive) return;
  const live = G.state === 'live', frozen = G.state === 'countdown', k = IN.keys;
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  const ix = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + IN.tx, iz = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + IN.tz;
  const crouch = !frozen && !!(k.KeyC || k.ShiftLeft || k.ControlLeft || IN.tCrouch);
  const jump = !frozen && (now <= IN.jumpBuf || (!!k.Space && p.grounded));
  if (stepEntity(p, dt, frozen ? 0 : cy * ix - sy * iz, frozen ? 0 : -sy * ix - cy * iz, jump, crouch)) { IN.jumpBuf = 0; sfx('jump'); }
  if (!p.alive) return;
  if (IN.slotReq >= 0) equip(p, IN.slotReq);
  const it = p.inv[p.slot], def = it.def, gun = def.type === 'hitscan' || def.type === 'rocket', ready = now >= p.equipEnd;
  p.ads = IN.alt && gun && !p.reloadEnd && ready;
  if (IN.reloadPressed) startReload(p);
  const o = new THREE.Vector3(p.pos.x, p.pos.y + p.eyeH, p.pos.z), d = lookDir(p.yaw, p.pitch + G.punch, new THREE.Vector3());
  if (live) {
    if (IN.altPressed && def.alt && now >= p.altCd && ready) {
      if (def.alt === 'dash') startDash(p, d); else { p.blockUntil = now + 1.5; p.altCd = now + 4; sfx('swap'); }
    }
    if (IN.firePressed) p.fireBuf = now + 0.12;
    if (def.type === 'throw') {
      if (def.cook) {
        if (IN.firePressed && avail(it) && !p.cook && ready) p.cook = now;
        if (p.cook) {
          if (now - p.cook >= 3) { p.cook = 0; consume(it); explode(o.x, o.y, o.z, p, 100, 6.5, null, 'Grenade'); }
          else if (!IN.fire) { throwProj(p, def.proj, o, d, 3 - (now - p.cook)); p.cook = 0; consume(it); p.swingT = now; equip(p, p.prevSlot); }
        }
      } else if (IN.firePressed && avail(it) && ready) { throwProj(p, def.proj, o, d, 1.4); consume(it); p.swingT = now; if (!avail(it)) equip(p, p.prevSlot); }
    } else if (def.type === 'heal') {
      if (IN.firePressed && avail(it) && p.hp < RULES.hp && !p.useEnd && ready) p.useEnd = now + def.use;
    } else if (IN.fire && (def.auto || def.type === 'melee' || now <= p.fireBuf)) {
      let s = 0;
      if (gun) { s = def.spread + it.bloom; if (p.ads) s *= def.adsMul; if (!p.grounded && !def.pellets) s *= 1.5; }
      if (attack(p, o, d, s)) {
        p.fireBuf = 0;
        if (gun) { const kick = def.recoil * 0.0175; G.punch += kick * 0.65; p.pitch = clamp(p.pitch + kick * 0.35, -1.5, 1.5); VM.kick = 1; }
      }
    }
  }
  if (p.alive) weaponTick(p, dt);
}
// first person camera with crouch, landing dip, slide tilt, shake and speed fov, or a chase view when dead
function updateCamera(dt) {
  const p = G.player;
  if (p.alive) {
    const sp = Math.hypot(p.vel.x, p.vel.z), def = p.inv[p.slot].def;
    p.eyeH = lerp(p.eyeH, p.crouching ? MOVE.crouchEye : MOVE.eye, damp(16, dt));
    G.dip = lerp(G.dip, 0, damp(9, dt)); G.punch *= Math.exp(-dt * 9);
    G.roll = lerp(G.roll, p.sliding ? 0.07 : 0, damp(10, dt));
    camera.position.set(p.pos.x, p.pos.y + p.eyeH - G.dip, p.pos.z);
    camera.rotation.set(p.pitch + G.punch, p.yaw, G.roll);
    if (SAVE.set.shake && G.shake > 0.002) { camera.position.x += rand(-1, 1) * G.shake * 0.2; camera.position.y += rand(-1, 1) * G.shake * 0.2; camera.rotation.z += rand(-1, 1) * G.shake * 0.03; }
    const kick = SAVE.set.shake && !p.ads ? clamp((sp - 8.6) / 7.4, 0, 1) * 10 : 0;
    camera.fov = lerp(camera.fov, SAVE.set.fov * (p.ads ? def.zoom : 1) + kick, damp(12, dt));
  } else {
    if (!G.spectate || !G.spectate.alive) G.spectate = G.ents.find((e) => e.alive && e.team === 0) || (G.killer && G.killer.alive ? G.killer : G.ents.find((e) => e.alive)) || null;
    const t = G.spectate;
    if (t) {
      const bx = Math.sin(t.yaw), bz = Math.cos(t.yaw), l = Math.hypot(bx, 0.4, bz), dx = bx / l, dy = 0.4 / l, dz = bz / l, ty = t.pos.y + 1.5;
      const dist = Math.max(0.8, rayWorld(t.pos.x, ty, t.pos.z, dx, dy, dz, 5.5) - 0.3);
      camera.position.set(t.pos.x + dx * dist, ty + dy * dist, t.pos.z + dz * dist); camera.lookAt(t.pos.x, ty, t.pos.z);
    }
    camera.fov = lerp(camera.fov, 70, damp(8, dt));
  }
  G.shake *= Math.exp(-dt * 7);
  camera.updateProjectionMatrix();
}
// poses a bot rig from its movement and aim so it reads as running, crouching or aiming
function animateBody(e, dt) {
  const b = e.body, u = b.userData;
  b.visible = e.alive && !e.isPlayer;
  if (!b.visible) return;
  const sp = Math.hypot(e.vel.x, e.vel.z);
  e.walk += sp * dt * 1.6;
  const sw = e.grounded ? Math.sin(e.walk) * Math.min(1, sp / 8) * 0.8 : 0.4;
  b.position.copy(e.pos); b.rotation.y = e.yaw; b.scale.y = lerp(b.scale.y, e.height / MOVE.height, 0.3);
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.aim.rotation.x = e.pitch; u.head.rotation.x = e.pitch * 0.6;
}
// one simulation step in a fixed order so rules, movement, combat and visuals stay in sync
function update(dt) {
  G.time += dt;
  matchLogic(dt);
  if (G.state !== 'matchEnd') {
    playerUpdate(dt);
    for (const e of G.ents) if (!e.isPlayer) botUpdate(e, dt);
    projUpdate(dt);
  }
  fxUpdate(dt);
  for (const e of G.ents) animateBody(e, dt);
  updateCamera(dt); updateVM(dt); hudUpdate(dt);
  IN.firePressed = IN.altPressed = IN.reloadPressed = false; IN.slotReq = -1; IN.mdx = IN.mdy = 0;
}

// applies look deltas from the mouse or a touch drag
function onLook(dx, dy) {
  if (G.mode !== 'match' || G.paused || G.state === 'matchEnd' || !G.player.alive) return;
  const p = G.player, k = 0.0022 * SAVE.set.sens * (p.ads ? p.inv[p.slot].def.zoom : 1);
  dx = clamp(dx, -400, 400); dy = clamp(dy, -400, 400);
  p.yaw -= dx * k; p.pitch = clamp(p.pitch - dy * k, -1.5, 1.5); IN.mdx += dx; IN.mdy += dy;
}
// keys the page must not act on while playing, such as tab focus and space scroll
const GAME_KEYS = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyC', 'ShiftLeft', 'ControlLeft']);
addEventListener('keydown', (e) => {
  if (G.mode !== 'match') return;
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  IN.keys[e.code] = true;
  if (e.code === 'Escape') { if (!G.locked) setPaused(!G.paused); return; }
  if (G.paused) return;
  if (e.code === 'Space') IN.jumpBuf = G.time + MOVE.buffer;
  else if (e.code === 'KeyC' || e.code === 'ShiftLeft' || e.code === 'ControlLeft') G.player.slideArmed = true;
  else if (e.code === 'KeyR') IN.reloadPressed = true;
  else if (e.code === 'KeyQ') IN.slotReq = G.player.prevSlot;
  else if (e.code === 'Tab') IN.board = true;
  else if (/^Digit[1-4]$/.test(e.code)) IN.slotReq = +e.code[5] - 1;
});
addEventListener('keyup', (e) => { IN.keys[e.code] = false; if (e.code === 'Tab') IN.board = false; });
addEventListener('blur', () => { if (G.mode === 'match' && !G.paused && G.state !== 'matchEnd') setPaused(true); else clearInput(); });
addEventListener('mousemove', (e) => onLook(e.movementX || 0, e.movementY || 0));
canvas.addEventListener('mousedown', (e) => {
  audioInit();
  if (G.mode !== 'match' || G.paused) return;
  e.preventDefault(); lock();
  if (e.button === 0) { IN.fire = true; IN.firePressed = true; } else if (e.button === 2) { IN.alt = true; IN.altPressed = true; }
});
addEventListener('mouseup', (e) => { if (e.button === 0) IN.fire = false; else if (e.button === 2) IN.alt = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => { if (G.mode === 'match' && !G.paused) { e.preventDefault(); IN.slotReq = (G.player.slot + (e.deltaY > 0 ? 1 : 3)) % 4; } }, { passive: false });
document.addEventListener('pointerlockchange', () => {
  const now = document.pointerLockElement === canvas;
  if (!now && G.locked && G.mode === 'match' && !G.paused && G.state !== 'matchEnd') setPaused(true);
  G.locked = now;
});

// active touch ids for the move stick and the look drag
const TCH = { move: null, look: null };
// reveals the on screen controls the first time a finger touches the game
function enableTouch() { if (!G.touch) { G.touch = true; $('touch').classList.remove('hidden'); } }
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault(); enableTouch(); audioInit();
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.4 && !TCH.move) { TCH.move = { id: t.identifier, x: t.clientX, y: t.clientY }; const j = $('tJoy'); j.style.display = 'block'; j.style.left = t.clientX + 'px'; j.style.top = t.clientY + 'px'; }
    else if (!TCH.look) TCH.look = { id: t.identifier, x: t.clientX, y: t.clientY };
  }
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (TCH.move && t.identifier === TCH.move.id) {
      const dx = t.clientX - TCH.move.x, dy = t.clientY - TCH.move.y, l = Math.hypot(dx, dy) || 1, m = Math.min(1, l / 50);
      IN.tx = dx / l * m; IN.tz = -dy / l * m;
      $('tKnob').style.transform = `translate(${(IN.tx * 30).toFixed(0)}px,${(-IN.tz * 30).toFixed(0)}px)`;
    } else if (TCH.look && t.identifier === TCH.look.id) { onLook((t.clientX - TCH.look.x) * 2.4, (t.clientY - TCH.look.y) * 2.4); TCH.look.x = t.clientX; TCH.look.y = t.clientY; }
  }
}, { passive: false });
// releases whichever control a lifted finger was driving
function touchEnd(e) {
  for (const t of e.changedTouches) {
    if (TCH.move && t.identifier === TCH.move.id) { TCH.move = null; IN.tx = IN.tz = 0; $('tJoy').style.display = 'none'; $('tKnob').style.transform = ''; }
    if (TCH.look && t.identifier === TCH.look.id) TCH.look = null;
  }
}
canvas.addEventListener('touchend', touchEnd); canvas.addEventListener('touchcancel', touchEnd);
for (const b of $('touch').querySelectorAll('button')) {
  const act = b.dataset.act;
  b.addEventListener('touchstart', (e) => {
    e.preventDefault(); enableTouch(); audioInit();
    if (act === 'pause') { setPaused(true); return; }
    if (G.mode !== 'match' || G.paused) return;
    if (act === 'fire') { IN.fire = true; IN.firePressed = true; }
    else if (act === 'alt') { IN.alt = !IN.alt; IN.altPressed = true; }
    else if (act === 'jump') IN.jumpBuf = G.time + MOVE.buffer;
    else if (act === 'slide') { IN.tCrouch = true; G.player.slideArmed = true; }
    else if (act === 'reload') IN.reloadPressed = true;
    else if (act === 'swap') IN.slotReq = (G.player.slot + 1) % 4;
  }, { passive: false });
  b.addEventListener('touchend', (e) => { e.preventDefault(); if (act === 'fire') IN.fire = false; else if (act === 'slide') IN.tCrouch = false; });
}

// one line summary of a weapon for its loadout card
function statLine(d) {
  if (d.type === 'hitscan') return (d.pellets ? d.pellets + ' x ' : '') + d.dmg[0] + ' dmg, ' + d.mag + '/' + d.reserve;
  if (d.type === 'rocket') return '50 splash, 100 direct';
  if (d.type === 'melee') return d.dmg + ' dmg' + (d.alt ? ', ' + d.alt : d.doubleJump ? ', double jump' : d.back ? ', 150 backstab' : '');
  if (d.type === 'heal') return 'heal ' + d.heal + ', ' + d.cooldown + 's cooldown';
  return d.charges ? d.charges + ' per round' : d.cooldown + 's cooldown';
}
// redraws the loadout grid with owned, equipped and locked states
function renderLoadout() {
  const names = ['Primary', 'Secondary', 'Melee', 'Utility'];
  let h = '';
  for (let s = 0; s < 4; s++) {
    h += `<div class="lrow"><div class="lbl">${names[s]}</div><div class="lgrid">`;
    for (const id in WEAPONS) {
      const d = WEAPONS[id];
      if (d.slot !== s) continue;
      const own = owns(id), eq = SAVE.loadout[s] === id;
      h += `<button class="card ${eq ? 'eq' : ''} ${own ? '' : 'lock'}" data-id="${id}"><b>${d.name}</b><span>${statLine(d)}</span><i>${eq ? 'EQUIPPED' : own ? 'EQUIP' : d.cost + ' KEYS'}</i></button>`;
    }
    h += '</div></div>';
  }
  $('loadGrid').innerHTML = h;
}
// syncs every menu control and the profile strip with the saved profile
function refreshMenu() {
  const s = SAVE.set;
  for (const [id, key] of [['sizeBtns', 'size'], ['mapBtns', 'map'], ['diffBtns', 'diff']]) for (const b of $(id).children) b.classList.toggle('on', +b.dataset.v === s[key]);
  $('profLevel').textContent = 'LVL ' + levelOf(SAVE.xp); $('xpFill').style.width = (SAVE.xp % RULES.xpLevel) / RULES.xpLevel * 100 + '%';
  $('profKeys').textContent = SAVE.keys + ' KEYS'; $('profWL').textContent = SAVE.wins + 'W ' + SAVE.losses + 'L';
  $('setSens').value = s.sens; $('vSens').textContent = s.sens.toFixed(2); $('setFov').value = s.fov; $('vFov').textContent = String(s.fov);
  $('setVol').value = s.vol; $('vVol').textContent = Math.round(s.vol * 100) + '%'; $('setShake').checked = s.shake; $('setUnlock').checked = s.unlock;
  renderLoadout();
}
// creates the menu buttons once and wires every control to the profile
function buildMenu() {
  $('sizeBtns').innerHTML = [1, 2, 3, 4, 5].map((n) => `<button class="opt" data-v="${n}">${n}v${n}</button>`).join('');
  $('mapBtns').innerHTML = MAPS.map((m, i) => `<button class="opt" data-v="${i}">${['Foundry', 'Crossing', 'Magma'][i]}</button>`).join('');
  $('diffBtns').innerHTML = DIFF.map((d, i) => `<button class="opt" data-v="${i}">${d.name}</button>`).join('');
  for (const [id, key] of [['sizeBtns', 'size'], ['mapBtns', 'map'], ['diffBtns', 'diff']]) $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    audioInit(); SAVE.set[key] = +b.dataset.v; persist(); sfx('ui');
    if (key === 'map') loadMap(SAVE.set.map);
    refreshMenu();
  });
  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    audioInit(); sfx('ui');
    for (const t of $('tabs').children) { t.classList.toggle('on', t === b); $(t.dataset.tab).classList.toggle('hidden', t !== b); }
  });
  $('loadGrid').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    audioInit();
    const d = WEAPONS[b.dataset.id];
    if (!owns(d.id)) {
      if (SAVE.keys < d.cost) { sfx('deny'); replay(b, 'deny'); return; }
      SAVE.keys -= d.cost; SAVE.owned.push(d.id); sfx('buy');
    } else sfx('ui');
    SAVE.loadout[d.slot] = d.id; persist(); refreshMenu();
  });
  $('setSens').addEventListener('input', (e) => { SAVE.set.sens = +e.target.value; persist(); refreshMenu(); });
  $('setFov').addEventListener('input', (e) => { SAVE.set.fov = +e.target.value; persist(); refreshMenu(); });
  $('setVol').addEventListener('input', (e) => { audioInit(); SAVE.set.vol = +e.target.value; if (AU.master) AU.master.gain.value = SAVE.set.vol; persist(); refreshMenu(); });
  $('setShake').addEventListener('change', (e) => { SAVE.set.shake = e.target.checked; persist(); });
  $('setUnlock').addEventListener('change', (e) => { SAVE.set.unlock = e.target.checked; persist(); refreshMenu(); });
  $('startBtn').addEventListener('click', () => { audioInit(); startMatch(); lock(); });
  $('againBtn').addEventListener('click', () => { audioInit(); startMatch(); lock(); });
  $('menuBtn').addEventListener('click', toMenu); $('quitBtn').addEventListener('click', toMenu);
  $('resumeBtn').addEventListener('click', () => { setPaused(false); lock(); });
  $('title').textContent = 'SLIPSTRIKE';
}

// keeps the canvas and both cameras matched to the window, including rotation and dpi
function resize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = vmCam.aspect = innerWidth / Math.max(1, innerHeight); camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix();
}
addEventListener('resize', resize);
// runtime errors collected so a broken build is visible instead of silent
window.__errs = [];
addEventListener('error', (e) => window.__errs.push(String(e.message)));
// timestamp of the previous frame for delta time
let lastT = performance.now();
// render loop with a clamped delta so a suspended tab cannot cause a huge step
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
  lastT = t;
  if (G.mode === 'match') { if (!G.paused) update(dt); }
  else {
    const a = t * 0.00008;
    camera.position.set(Math.cos(a) * 48, 24, Math.sin(a) * 48); camera.lookAt(0, 1, 0);
    if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
  }
  renderer.clear(); renderer.render(scene, camera);
  if (G.mode === 'match' && VM.root.visible) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
}
// hooks used by automated checks to drive the simulation without real input
window.__dbg = { G, SAVE, WEAPONS, IN, start: startMatch, menu: toMenu, sim: (sec, dt = 1 / 60) => { const n = Math.round(sec / dt); for (let i = 0; i < n; i++) update(dt); } };

buildMenu(); loadMap(SAVE.set.map); refreshMenu(); resize();
requestAnimationFrame(frame);
