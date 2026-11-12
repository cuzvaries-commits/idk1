
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
