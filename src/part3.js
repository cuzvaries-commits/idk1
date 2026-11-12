
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
