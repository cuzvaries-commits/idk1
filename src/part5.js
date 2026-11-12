
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
