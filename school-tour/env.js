import * as THREE from 'three';

// Surroundings of the school for the tour and walk modes: paved square,
// bike shed, trees, benches, street with parked cars, neighbouring houses,
// and the aula volume behind the lobby. Not loaded in ?capture mode.

let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const std = (color, rough = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(...repeat); return t;
}
function add(parent, geo, mat, x, y, z, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = receive; parent.add(m); return m;
}
const boxGeo = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// Dutch red-brown clinker paving in a herringbone-ish stretcher pattern
const paving = tex(512, 512, (g, w, h) => {
  g.fillStyle = '#6f645c'; g.fillRect(0, 0, w, h);
  const bw = 64, bh = 21;
  for (let y = 0; y < h; y += bh) for (let x = -(y / bh % 2) * bw / 2; x < w; x += bw) {
    const v = 0.85 + rnd() * 0.25, r = 150 * v, gr = 118 * v, b = 100 * v;
    g.fillStyle = `rgb(${r | 0},${gr | 0},${b | 0})`; g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
  }
}, [22, 18]);
const asphalt = tex(256, 256, (g, w, h) => {
  g.fillStyle = '#3d3d3f'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = 50 + rnd() * 40 | 0; g.fillStyle = `rgba(${v},${v},${v},0.6)`; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
}, [30, 3]);
const grassTex = tex(256, 256, (g, w, h) => {
  g.fillStyle = '#5d7a3c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 12000; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(120,150,70,0.5)' : 'rgba(60,85,40,0.5)'; g.fillRect(rnd() * w, rnd() * h, 1, 3); }
}, [6, 2]);

function tree(parent, x, z, s = 1, autumn = 0.3) {
  const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); parent.add(t);
  add(t, new THREE.CylinderGeometry(0.14, 0.22, 3.2, 10), std('#5b4a3a', 0.95), 0, 1.6, 0);
  const cols = ['#4c6b34', '#5d7a3c', '#6f8a3e', '#b8892f', '#a35a2a'];
  for (let i = 0; i < 9; i++) {
    const c = rnd() < autumn ? cols[3 + (rnd() * 2 | 0)] : cols[rnd() * 3 | 0];
    const m = add(t, new THREE.IcosahedronGeometry(0.9 + rnd() * 0.7, 1), std(c, 0.95), (rnd() - 0.5) * 2.2, 3.6 + rnd() * 2.2, (rnd() - 0.5) * 2.2);
    m.scale.y = 0.85;
  }
  return t;
}

function bike(parent, x, z, ry, color) {
  const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; parent.add(b);
  const tyre = std('#1d1d1d', 0.8), frame = std(color, 0.4, { metalness: 0.5 });
  for (const dz of [-0.52, 0.52]) { const w = add(b, new THREE.TorusGeometry(0.33, 0.025, 8, 28), tyre, 0, 0.34, dz); w.rotation.y = Math.PI / 2; }
  const bar = (len, y, z, rx) => { const m = add(b, new THREE.CylinderGeometry(0.018, 0.018, len, 6), frame, 0, y, z); m.rotation.x = rx; };
  bar(1.0, 0.55, 0, Math.PI / 2); bar(0.6, 0.6, -0.2, 0.4); bar(0.62, 0.62, 0.32, -0.35);
  add(b, boxGeo(0.12, 0.05, 0.26), std('#222', 0.7), 0, 0.92, -0.25);
  add(b, boxGeo(0.5, 0.025, 0.03), frame, 0, 1.0, 0.45);
  return b;
}

function car(parent, x, z, ry, color) {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; parent.add(c);
  add(c, boxGeo(1.8, 0.7, 4.2), std(color, 0.35, { metalness: 0.4 }), 0, 0.6, 0);
  add(c, boxGeo(1.6, 0.55, 2.2), std(color, 0.35, { metalness: 0.4 }), 0, 1.2, -0.2);
  add(c, boxGeo(1.62, 0.42, 2.0), new THREE.MeshPhysicalMaterial({ color: '#1c2630', roughness: 0.05, metalness: 0.2 }), 0, 1.22, -0.2, { cast: false });
  for (const [dx, dz] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) {
    const w = add(c, new THREE.CylinderGeometry(0.33, 0.33, 0.22, 18), std('#151515', 0.8), dx, 0.33, dz); w.rotation.z = Math.PI / 2;
  }
  return c;
}

function house(parent, x, z, w, d, h, color, roof) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  add(g, boxGeo(w, h, d), std(color, 0.9), 0, h / 2, 0);
  const r = add(g, new THREE.CylinderGeometry(0.01, d * 0.62, w, 4, 1), std(roof, 0.8), 0, h + d * 0.3, 0);
  r.rotation.z = Math.PI / 2; r.rotation.x = Math.PI / 4; r.scale.set(1, 1, 0.72);
  const win = std('#2b3138', 0.2);
  for (let i = -w / 2 + 1; i < w / 2 - 0.5; i += 1.6) for (const y of [1.3, h - 1.3]) add(g, boxGeo(0.9, 1.1, 0.05), win, i, y, d / 2 + 0.02, { cast: false });
}

export function buildEnvironment(scene) {
  const env = new THREE.Group(); scene.add(env);

  // ---- ground: paved square, grass, sidewalk, street ----
  const pav = add(env, new THREE.PlaneGeometry(70, 26), std('#ffffff', 0.9, { map: paving }), 0, 0.01, -2, { cast: false });
  pav.rotation.x = -Math.PI / 2;
  for (const [x, z, w, d] of [[-21, -4, 18, 14], [23, -4, 16, 14]]) {
    const gr = add(env, new THREE.PlaneGeometry(w, d), std('#ffffff', 1, { map: grassTex }), x, 0.015, z, { cast: false });
    gr.rotation.x = -Math.PI / 2;
  }
  add(env, boxGeo(80, 0.14, 3.2), std('#a8a39b', 0.9), 0, 0.07, 12.4);                // sidewalk
  add(env, boxGeo(80, 0.16, 0.2), std('#cfcac2', 0.8), 0, 0.08, 14.05);              // curb
  const road = add(env, new THREE.PlaneGeometry(80, 7), std('#ffffff', 0.95, { map: asphalt }), 0, 0.012, 17.6, { cast: false });
  road.rotation.x = -Math.PI / 2;
  for (let x = -38; x < 40; x += 4) { const l = add(env, new THREE.PlaneGeometry(2, 0.12), std('#eeeeee', 0.6), x, 0.02, 17.6, { cast: false }); l.rotation.x = -Math.PI / 2; }
  add(env, boxGeo(80, 0.16, 0.2), std('#cfcac2', 0.8), 0, 0.08, 21.15);
  add(env, boxGeo(80, 0.14, 3), std('#a8a39b', 0.9), 0, 0.07, 22.8);

  // ---- bike shed (fietsenstalling) to the left of the entrance ----
  const shed = new THREE.Group(); env.add(shed);
  const steel = std('#5c6166', 0.5, { metalness: 0.6 });
  for (const x of [-11, -7, -3]) for (const z of [-4, 0]) add(shed, new THREE.CylinderGeometry(0.06, 0.06, 2.4, 10), steel, x, 1.2, z);
  const roof = add(shed, boxGeo(8.4, 0.08, 4.8), new THREE.MeshPhysicalMaterial({ color: '#8fb3a3', roughness: 0.2, transparent: true, opacity: 0.55 }), -7, 2.45, -2);
  roof.rotation.x = 0.06;
  add(shed, boxGeo(8.4, 0.18, 0.12), steel, -7, 2.35, 0.3);
  const cols = ['#c0392b', '#2c3e50', '#16a085', '#f39c12', '#7f8c8d', '#8e44ad', '#ecf0f1', '#27ae60'];
  for (let i = 0; i < 13; i++) bike(shed, -10.6 + i * 0.6, -2, Math.PI / 2 + (rnd() - 0.5) * 0.1, cols[i % cols.length]);
  const signTex = tex(256, 64, (g, w, h) => { g.fillStyle = '#2f6f4f'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 34px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🚲 Fietsenstalling', w / 2, h / 2); });
  add(shed, new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }), -7, 2.1, 0.38, { cast: false });

  // ---- school name sign on the square ----
  const nameTex = tex(512, 160, (g, w, h) => { g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h); g.fillStyle = '#3f6a4c'; g.font = 'bold 92px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('wings', w / 2, h / 2 + 4); });
  add(env, boxGeo(2.6, 1.0, 0.25), std('#d8d2c6', 0.7), 10.5, 0.5, -5);
  add(env, new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshBasicMaterial({ map: nameTex }), 10.5, 0.55, -4.87, { cast: false });

  // ---- trees, benches, bins, street lamps ----
  for (const [x, z, s] of [[-15, -8, 1.1], [-18, 2, 1.2], [-13.5, 7, 1.0], [15, 6, 1.1], [19, -1, 1.15], [-4, 10, 0.9], [6, 10.3, 0.95], [22, -9, 1.2], [-24, -9, 1.3]]) tree(env, x, z, s);
  const wood = std('#9a6a3e', 0.8), dark = std('#3a3e40', 0.5, { metalness: 0.4 });
  for (const [x, z] of [[-2.5, 6.5], [2.5, 6.5], [13.5, 2.5]]) {
    add(env, boxGeo(1.8, 0.08, 0.5), wood, x, 0.46, z);
    add(env, boxGeo(1.8, 0.4, 0.06), wood, x, 0.75, z + 0.24);
    for (const dx of [-0.75, 0.75]) add(env, boxGeo(0.06, 0.45, 0.45), dark, x + dx, 0.22, z);
  }
  for (const [x, z] of [[0.5, 6.4], [12.5, 2.6]]) add(env, new THREE.CylinderGeometry(0.25, 0.22, 0.85, 14), std('#2f6f4f', 0.6), x, 0.43, z);
  for (const x of [-16, -4, 8, 20]) {
    add(env, new THREE.CylinderGeometry(0.06, 0.08, 4.4, 12), dark, x, 2.2, 11.4);
    add(env, new THREE.SphereGeometry(0.3, 24, 16), std('#e8e4dc', 0.5), x, 4.7, 11.4);
  }

  // ---- parked cars and houses across the street ----
  car(env, -12, 19.6, Math.PI / 2, '#7d8a96'); car(env, -5.5, 19.6, Math.PI / 2, '#a33c2e'); car(env, 9, 19.6, -Math.PI / 2, '#e8e6e0'); car(env, 16, 15.6, Math.PI / 2, '#2e4a6b');
  const houseCols = ['#9c5a43', '#b06b4f', '#8a4f3a', '#c9b79c'];
  for (let i = 0; i < 6; i++) house(env, -30 + i * 11, 30, 9, 8, 6 + (i % 2), houseCols[i % 4], '#4a3b36');

  // ---- Agora atrium behind the lobby (outside skin: timber-clad hall with a light roof) ----
  const skin = std('#e7d6b6', 0.95), clad = std('#a8673f', 0.8);
  add(env, boxGeo(24.4, 12.4, 0.2), skin, 13.5, 6.2, -46.3);
  add(env, boxGeo(0.2, 12.4, 22.4), skin, 1.3, 6.2, -35.1);
  add(env, boxGeo(0.2, 12.4, 22.4), clad, 25.7, 6.2, -35.1);
  add(env, boxGeo(24.6, 0.4, 22.6), std('#9a9da0', 0.7, { metalness: 0.3 }), 13.5, 12.2, -35.1);
  add(env, boxGeo(7.6, 12.4, 0.2), clad, 21.8, 6.2, -23.9);                  // front part of the hall right of the tower
  add(env, boxGeo(24.4, 0.6, 0.2), skin, 13.5, 4.4, -26.0);

  // ---- wing: close its left end and back so it reads as a full building ----
  add(env, boxGeo(0.3, 13.3, 15), std('#d6cfbf', 0.9), -10.1, 6.65, -22.6);
  return env;
}

// Walk-mode additions to the walkable areas / obstacles
export const ENV_WALK = [
  [-14, 20, -12.6, 13.9],      // square + sidewalk (street is off-limits)
];
export const ENV_BLOCK = [
  [-11.2, -2.8, -4.3, 0.2],    // bike shed with bikes
  [9.1, 11.9, -5.2, -4.8],     // name sign
  [-3.5, -1.5, 6.2, 6.9], [1.5, 3.5, 6.2, 6.9], [12.5, 14.5, 2.2, 2.9], // benches
  [0.2, 0.8, 6.1, 6.7], [12.2, 12.8, 2.3, 2.9],                     // bins
  ...[[-4, 10], [6, 10.3], [-13.5, 7], [15, 6], [19, -1]].map(([x, z]) => [x - 0.35, x + 0.35, z - 0.35, z + 0.35]), // tree trunks
  ...[-16, -4, 8, 20].map(x => [x - 0.2, x + 0.2, 11.2, 11.6]),       // street lamps
];
