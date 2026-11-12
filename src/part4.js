
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
