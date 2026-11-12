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
