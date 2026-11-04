import * as THREE from 'three';

// The Agora atrium behind the lobby, modelled after a reference photo of the
// real hall: three storeys under a glass roof, a timber volume with a grass
// roof terrace, a curved yellow balcony with a winged statue, glass boxes on
// the upper floors, coloured floor circles, a globe, chessboard cabinets,
// a space mural, pendant lamps and flags.
// Atrium footprint: x 1.5 .. 25.5, z -24 .. -46, roof at y 12.

export const A = { x0: 1.5, x1: 25.5, z0: -46, z1: -24, h: 12, balconyY: 4 };

const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
function box(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.receiveShadow = true; parent.add(m); return m;
}
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
let seed = 5;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// world -> floor texture pixel
const FW = 2048, FH = 2048;
const fx = x => (x - A.x0) / (A.x1 - A.x0) * FW, fz = z => (z - A.z0) / (A.z1 - A.z0) * FH;

export function buildAgora(g, sign) {
  // ---------- floor: polished white with dark path, yellow and green circles ----------
  const floorTex = canvasTex(FW, FH, (c) => {
    c.fillStyle = '#e9e8e4'; c.fillRect(0, 0, FW, FH);
    for (let i = 0; i < 30000; i++) { c.fillStyle = `rgba(0,0,0,${rnd() * 0.03})`; c.fillRect(rnd() * FW, rnd() * FH, 2, 2); }
    const s = FW / 24;
    // dark grey sweeping path from the entrance into the hall
    c.fillStyle = '#3c3f44'; c.beginPath();
    c.moveTo(fx(3.5), fz(-24)); c.bezierCurveTo(fx(9), fz(-30), fx(4), fz(-36), fx(12), fz(-46));
    c.lineTo(fx(17), fz(-46)); c.bezierCurveTo(fx(9), fz(-37), fx(14), fz(-30), fx(7), fz(-24)); c.fill();
    c.beginPath(); c.moveTo(fx(18), fz(-24)); c.bezierCurveTo(fx(19), fz(-32), fx(25.5), fz(-36), fx(25.5), fz(-40)); c.lineTo(fx(25.5), fz(-24)); c.fill();
    // orange carpet for the creative work zone under the left mezzanine
    c.fillStyle = '#d9692a'; c.fillRect(fx(1.5), fz(-41), 5 * s, 10 * s);
    // red zone under the stair
    c.fillStyle = '#c2312a'; c.fillRect(fx(12), fz(-26.2), 5 * s, 2.6 * s);
    // yellow circle and green circle
    c.fillStyle = '#f2c230'; c.beginPath(); c.arc(fx(14.5), fz(-31.5), 3.2 * s, 0, 7); c.fill();
    c.fillStyle = '#5aa04a'; c.beginPath(); c.arc(fx(7.8), fz(-38.5), 3.4 * s, 0, 7); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.beginPath(); c.arc(fx(14.5), fz(-31.5), 3.2 * s, 0, 7); c.stroke();
  });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(A.x1 - A.x0, A.z1 - A.z0), std('#ffffff', 0.25, { map: floorTex, envMapIntensity: 0.6 }));
  fl.rotation.x = -Math.PI / 2; fl.position.set((A.x0 + A.x1) / 2, 0.035, (A.z0 + A.z1) / 2); g.add(fl);

  // ---------- walls: timber right wall, space mural left, white back ----------
  const timberTex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#b8683a'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      const v = 0.9 + rnd() * 0.2; c.fillStyle = `rgb(${184 * v | 0},${104 * v | 0},${58 * v | 0})`; c.fillRect(x + 1, 0, 30, h);
      for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(90,40,15,0.08)'; c.fillRect(x + rnd() * 30, rnd() * h, 1, 20 + rnd() * 60); }
    }
  }, [6, 3]);
  const timber = std('#ffffff', 0.7, { map: timberTex });
  box(g, 0.15, 9, A.z1 - A.z0, timber, A.x1 - 0.1, 4.5, (A.z0 + A.z1) / 2);
  box(g, 0.15, 3, A.z1 - A.z0, std('#a9a9a6', 0.9), A.x1 - 0.1, 10.5, (A.z0 + A.z1) / 2);
  for (let z = -26.5; z > -45; z -= 2.2) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 32), std('#ffffff', 0.4)); ring.rotation.y = Math.PI / 2; ring.position.set(A.x1 - 0.2, 10.4, z); g.add(ring);
    const pane = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshBasicMaterial({ color: '#cfe6f7', toneMapped: false })); pane.rotation.y = -Math.PI / 2; pane.position.set(A.x1 - 0.19, 10.4, z); g.add(pane);
  }
  const muralTex = canvasTex(1024, 512, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#13205a'); gr.addColorStop(0.5, '#2a4fb0'); gr.addColorStop(1, '#6a2a8a');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(255,255,255,${rnd()})`; c.fillRect(rnd() * w, rnd() * h, 2, 2); }
    const pl = c.createRadialGradient(780, 300, 10, 800, 320, 170); pl.addColorStop(0, '#ffcf6b'); pl.addColorStop(0.6, '#e0522a'); pl.addColorStop(1, 'rgba(120,20,40,0)');
    c.fillStyle = pl; c.beginPath(); c.arc(800, 320, 170, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 4; c.beginPath(); c.ellipse(800, 320, 260, 50, -0.3, 0, 7); c.stroke();
    const pk = c.createRadialGradient(300, 160, 5, 300, 160, 120); pk.addColorStop(0, '#ff6fb0'); pk.addColorStop(1, 'rgba(160,40,140,0)');
    c.fillStyle = pk; c.beginPath(); c.arc(300, 160, 120, 0, 7); c.fill();
    c.strokeStyle = '#f2e34a'; c.lineWidth = 6; c.beginPath(); for (let i = 0; i < 9; i++) c.lineTo(250 + Math.sin(i) * 60 + i * 10, 120 + i * 12); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = 'italic 44px system-ui'; c.fillText('wings', 420, 250);
  });
  muralTex.rotation = Math.PI / 2; muralTex.center.set(0.5, 0.5);
  // tall mural with a climbing wall on the back wall (right part)
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 11.6), new THREE.MeshBasicMaterial({ map: muralTex, toneMapped: false }));
  mural.position.set(21.8, 5.85, A.z0 + 0.17); g.add(mural);
  const holdCols = ['#f2c230', '#5aa04a', '#e8862c', '#ffffff', '#c2312a'];
  for (let i = 0; i < 70; i++) {
    const h = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 + rnd() * 0.06, 0), std(holdCols[i % 5], 0.7));
    h.position.set(18.8 + rnd() * 6, 0.4 + rnd() * 10.8, A.z0 + 0.22); g.add(h);
  }
  for (const x of [20.3, 23.3]) { const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 11.4, 4), std('#3a7fd0', 0.6)); rope.position.set(x, 5.7, A.z0 + 0.6); g.add(rope); }
  box(g, 6.8, 0.25, 1.4, std('#2c2f35', 0.9), 21.8, 0.13, A.z0 + 0.9);       // safety mat
  box(g, A.x1 - A.x0, A.h, 0.15, std('#ecebe7', 0.9), (A.x0 + A.x1) / 2, A.h / 2, A.z0 + 0.08);

  // ---------- glass roof with steel trusses ----------
  const deckTex = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#7c7f83'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { c.fillStyle = '#5f6266'; c.fillRect(x, 0, 3, h); } }, [1, 60]);
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(A.x1 - A.x0, A.z1 - A.z0), std('#ffffff', 0.6, { map: deckTex, metalness: 0.3 }));
  deck.rotation.x = Math.PI / 2; deck.position.set((A.x0 + A.x1) / 2, A.h - 0.05, (A.z0 + A.z1) / 2); g.add(deck);
  const glulam = std('#c98a4e', 0.6);
  for (let z = -26; z > -46; z -= 3.4) box(g, A.x1 - A.x0, 0.8, 0.3, glulam, (A.x0 + A.x1) / 2, A.h - 0.45, z);
  box(g, 0.3, 0.6, A.z1 - A.z0, glulam, 13.5, A.h - 0.35, (A.z0 + A.z1) / 2);
  for (let x = 4.5; x < 25; x += 4.5) for (let z = -27.7; z > -46; z -= 3.4) {
    const sk = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), new THREE.MeshBasicMaterial({ color: '#dff0ff', toneMapped: false }));
    sk.rotation.x = Math.PI / 2; sk.position.set(x, A.h - 0.07, z); g.add(sk);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.05, 6, 32), std('#ffffff', 0.5)); rim.rotation.x = Math.PI / 2; rim.position.set(x, A.h - 0.1, z); g.add(rim);
  }

  // ---------- yellow curved balcony (y = 4) with white railing and winged statue ----------
  const by = A.balconyY;
  const bShape = new THREE.Shape();
  bShape.moveTo(1.5, 26.2); bShape.lineTo(12, 26.2); bShape.lineTo(12, 28.6);
  bShape.bezierCurveTo(11, 30.8, 7, 31.4, 4.5, 30.8); bShape.bezierCurveTo(3, 30.5, 1.5, 30.4, 1.5, 30.4); bShape.closePath();
  const bGeo = new THREE.ExtrudeGeometry(bShape, { depth: 0.3, bevelEnabled: false }); bGeo.rotateX(Math.PI / 2);
  const slab = new THREE.Mesh(bGeo, [std('#f2c230', 0.45, { side: THREE.DoubleSide }), std('#ffffff', 0.6, { side: THREE.DoubleSide })]);
  slab.position.y = by; slab.scale.z = -1; g.add(slab);
  // railing following the curved edge
  const edge = new THREE.CubicBezierCurve3(new THREE.Vector3(12, by, -28.6), new THREE.Vector3(11, by, -30.8), new THREE.Vector3(7, by, -31.4), new THREE.Vector3(4.5, by, -30.8));
  const pts = edge.getPoints(40).concat([new THREE.Vector3(1.6, by, -30.4)]);
  const railMat = std('#ffffff', 0.4);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
    const panel = box(g, len, 1.05, 0.06, railMat, mid.x, by + 0.52, mid.z); panel.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    for (let k = 0; k < 3; k++) {
      const bar = box(g, len, 0.02, 0.07, std('#e0e0e0', 0.4), mid.x, by + 0.2 + k * 0.3, mid.z); bar.rotation.y = panel.rotation.y;
    }
  }
  // winged statue (Nike of Samothrace replica) on a pedestal
  {
    const st = new THREE.Group(); st.position.set(4.2, by, -29.0); st.rotation.y = 0.5; g.add(st);
    const marble = std('#f3f1ea', 0.5);
    box(st, 0.9, 0.5, 0.9, marble, 0, 0.25, 0);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 1.6, 16), marble); body.position.y = 1.3; st.add(body);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), marble); chest.position.y = 2.1; chest.scale.set(1, 1.1, 0.8); st.add(chest);
    const wingShape = new THREE.Shape(); wingShape.moveTo(0, 0); wingShape.bezierCurveTo(0.4, 0.6, 1.1, 1.0, 1.6, 1.4); wingShape.bezierCurveTo(1.2, 0.7, 0.9, 0.1, 0.2, -0.5); wingShape.closePath();
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.ExtrudeGeometry(wingShape, { depth: 0.06, bevelEnabled: false }), marble);
      w.position.set(0, 1.9, -0.15); w.scale.x = sx; w.rotation.y = sx * 0.6; st.add(w);
    }
    // a few dry branches next to it
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 1.4, 4), std('#6b5a40', 0.9)); b.position.set(0.55, 0.9, 0.2); b.rotation.z = (rnd() - 0.5) * 0.8; b.rotation.x = (rnd() - 0.5) * 0.5; st.add(b); }
  }

  // inner face of the atrium's front wall above the lobby
  box(g, A.x1 - A.x0, 7.9, 0.15, std('#ecebe7', 0.9), (A.x0 + A.x1) / 2, 8.1, -26.1);

  // ---------- stair from the balcony down to the hall (x 12 -> 17) ----------
  for (let i = 0; i < 20; i++) {
    const x = 12 + (i + 0.5) * 0.25, y = by - (i + 1) * 0.2;
    box(g, 0.26, 0.06, 1.9, std('#f5f5f2', 0.5), x, y + 0.17, -27.75);
    box(g, 0.26, 0.2, 0.06, std('#c2312a', 0.6), x, y + 0.1, -28.7);
  }
  const stairRail = box(g, 5.2, 1.0, 0.06, railMat, 14.5, 2.5, -28.75); stairRail.rotation.z = Math.atan2(4, 5);

  // ---------- timber volume with grass roof terrace (right) ----------
  {
    const t = new THREE.Group(); t.position.set(20.5, 0, -35); g.add(t);
    box(t, 7, 4.2, 8, timber, 0, 5.5, 0);
    for (const [dx, dz] of [[-3.3, -3.8], [3.3, -3.8], [-3.3, 3.8], [3.3, 3.8]]) box(t, 0.25, 3.4, 0.25, std('#cfd0d0', 0.5, { metalness: 0.4 }), dx, 1.7, dz);
    const win = new THREE.MeshPhysicalMaterial({ color: '#2a3a44', roughness: 0.05, transparent: true, opacity: 0.6 });
    for (const dx of [-1.6, 1.6]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), win); w.rotation.y = -Math.PI / 2; w.position.set(-3.51, 5.3, dx); t.add(w);
      const bar = box(t, 0.02, 0.08, 2.8, std('#ffffff', 0.4), -3.53, 5.3, dx); bar.rotation.x = 0.45;
    }
    box(t, 7.2, 0.15, 8.2, std('#5f9a3a', 1.0), 0, 7.65, 0);                       // grass roof
    const tent = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.1, 4), std('#5b4fb0', 0.7)); tent.position.set(-1.0, 8.27, 1.5); tent.rotation.y = Math.PI / 4; t.add(tent);
    for (const [dx, dz] of [[-2.8, -2.6], [2.6, -3.0], [2.0, 2.8]]) {
      const tree = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 10), std('#2f5a2a', 0.9)); tree.position.set(dx, 8.5, dz); t.add(tree);
    }
    box(t, 7.2, 0.9, 0.05, std('#ffffff', 0.5), 0, 8.15, 4.1);                     // terrace railing
  }

  // ---------- glass boxes / mezzanines on the upper floors ----------
  const frame = std('#f4f4f2', 0.4), glassMat = new THREE.MeshPhysicalMaterial({ color: '#cfdde3', roughness: 0.05, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
  function glassBox(x0, x1, z0, z1, y0, y1) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, h = y1 - y0;
    box(g, w, 0.3, d, std('#e7e6e2', 0.8), cx, y0, cz);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat); front.position.set(cx, y0 + h / 2, z1); g.add(front);
    for (let x = x0; x <= x1 + 0.01; x += 1.5) box(g, 0.08, h, 0.08, frame, Math.min(x, x1), y0 + h / 2, z1);
    box(g, w, 0.1, 0.1, frame, cx, y1, z1); box(g, w, 0.1, 0.1, frame, cx, y0 + 1.1, z1);
    return { cx, cz };
  }
  // left mezzanines (two levels) with tables visible through the glass
  for (const y of [4.2, 8.2]) {
    box(g, 5, 0.3, 16, std('#e7e6e2', 0.8), 4, y, -38);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.6), glassMat); side.rotation.y = Math.PI / 2; side.position.set(6.5, y + 1.95, -38); g.add(side);
    for (let z = -46; z <= -30; z += 1.6) box(g, 0.08, 3.6, 0.08, frame, 6.5, y + 1.95, z);
    box(g, 0.1, 0.1, 16, frame, 6.5, y + 1.1, -38);
    for (let z = -44; z < -31; z += 3) { box(g, 1.2, 0.05, 0.8, std('#ffffff', 0.5), 4.2, y + 0.9, z); for (const dz of [-0.6, 0.6]) box(g, 0.45, 0.8, 0.45, std('#2c4a8a', 0.7), 4.2, y + 0.55, z + dz); }
  }
  glassBox(9, 18, -46, -41, 8.2, 11.6);
  // suspended yellow box and white tubes, as in the photo
  {
    const corkTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#c8955a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 6000; i++) { c.fillStyle = `rgba(${rnd() > 0.5 ? '90,55,25' : '230,190,140'},0.25)`; c.fillRect(rnd() * w, rnd() * h, 2, 2); } });
    const cube = new THREE.Group(); cube.position.set(9.5, 7.3, -33.5); cube.rotation.y = 0.3; g.add(cube);
    box(cube, 3.0, 2.6, 3.0, std('#ffffff', 0.9, { map: corkTex }), 0, 0, 0);
    for (const [px, pz, ry] of [[-0.6, 1.51, 0], [0.7, 1.51, 0], [1.51, 0, Math.PI / 2]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 8, 32), std('#f4f4f2', 0.4)); ring.position.set(px, 0.1, pz); ring.rotation.y = ry; cube.add(ring);
      const pane = new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), new THREE.MeshPhysicalMaterial({ color: '#2a3a44', roughness: 0.05, transparent: true, opacity: 0.7 }));
      pane.position.set(px + (ry ? 0.01 : 0), 0.1, pz + (ry ? 0 : 0.01)); pane.rotation.y = ry; cube.add(pane);
    }
  }
  // white shade sail over the green circle and a red kayak hanging from the roof
  { const sail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(4, 6.5, -35), new THREE.Vector3(12, 5.2, -37), new THREE.Vector3(6, 4.8, -43)]), std('#f6f6f4', 0.8, { side: THREE.DoubleSide })); sail.geometry.computeVertexNormals(); g.add(sail); }
  { const kayak = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 3.4, 6, 12), std('#d63a24', 0.5)); kayak.rotation.z = Math.PI / 2; kayak.scale.set(1, 1, 0.6); kayak.position.set(15.5, 6.2, -28.5); g.add(kayak); }
  for (const [a, b] of [[[2, 10.5, -31], [8.5, 8.2, -33.5]], [[3, 9.6, -34], [10.5, 8.6, -36.5]]]) {
    const A0 = new THREE.Vector3(...a), B0 = new THREE.Vector3(...b), mid = A0.clone().add(B0).multiplyScalar(0.5);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, A0.distanceTo(B0), 16), std('#f4f4f4', 0.5));
    tube.position.copy(mid); tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B0.clone().sub(A0).normalize()); g.add(tube);
  }

  // ---------- furniture on the hall floor ----------
  const white = std('#f7f7f5', 0.4), blue = std('#2c4a8a', 0.6), orange = std('#e8862c', 0.6);
  const pieTex = canvasTex(256, 256, (c) => { ['#5aa04a', '#f2c230', '#d63a24', '#2f6fb3'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.moveTo(128, 128); c.arc(128, 128, 128, i * Math.PI / 2, (i + 1) * Math.PI / 2); c.fill(); }); });
  const pie = std('#ffffff', 0.4, { map: pieTex });
  for (const [x, z] of [[6.0, -36.8], [9.5, -37.2], [6.6, -40.2], [9.9, -40.5], [8.0, -38.7]]) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 24), [white, pie, white]); top.position.set(x, 0.74, z); g.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.22, 0.72, 10), std('#333', 0.5)); leg.position.set(x, 0.36, z); g.add(leg);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.3; box(g, 0.42, 0.45, 0.42, blue, x + Math.cos(a) * 0.9, 0.23, z + Math.sin(a) * 0.9); box(g, 0.42, 0.45, 0.06, blue, x + Math.cos(a) * 1.1, 0.68, z + Math.sin(a) * 1.1).rotation.y = -a + Math.PI / 2; }
  }
  for (const [x, z] of [[13.2, -30.6], [15.8, -32.6], [14.2, -33.4]]) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 20), orange); top.position.set(x, 1.1, z); g.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.2, 1.08, 10), std('#333', 0.5)); leg.position.set(x, 0.54, z); g.add(leg);
    for (const a of [0.5, 2.6]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.75, 14), orange); s.position.set(x + Math.cos(a) * 0.6, 0.38, z + Math.sin(a) * 0.6); g.add(s); }
  }
  // globe
  const globeTex = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#2f6fb3'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#6a9a4a';
    for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(rnd() * w, 40 + rnd() * (h - 80), 20 + rnd() * 50, 15 + rnd() * 35, rnd() * 3, 0, 7); c.fill(); }
    c.fillStyle = '#f4f4f4'; c.fillRect(0, 0, w, 14); c.fillRect(0, h - 14, w, 14);
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.75, 40, 24), std('#ffffff', 0.35, { map: globeTex })); globe.position.set(17.6, 1.7, -33.2); globe.rotation.z = 0.4; g.add(globe);
  g.userData.globe = globe;
  const gs = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.3, 0.95, 12), std('#444', 0.5)); gs.position.set(17.6, 0.48, -33.2); g.add(gs);
  // chessboard cabinets along the timber wall
  const chess = canvasTex(256, 512, (c, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; c.fillRect(x * 64, y * 64, 64, 64); } });
  const chessMat = std('#ffffff', 0.4, { map: chess });
  for (const z of [-27.5, -29.4, -42.5]) box(g, 0.7, 2.2, 1.6, chessMat, 24.8, 1.1, z);
  // display boards with student work
  const posters = canvasTex(1024, 256, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    const pc = ['#e8862c', '#3a6e82', '#c2312a', '#5aa04a', '#f2c230', '#6a2a8a'];
    for (let i = 0; i < 8; i++) { c.fillStyle = pc[i % 6]; c.fillRect(20 + i * 125, 30 + (i % 2) * 20, 100, 170); c.fillStyle = '#fff'; c.fillRect(30 + i * 125, 50 + (i % 2) * 20, 80, 50); }
  });
  for (const [x, z, ry] of [[11.6, -29.6, 0.35], [10.2, -31.2, 0.35]]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: posters, side: THREE.DoubleSide, roughness: 0.7 }));
    b.position.set(x, 1.35, z); b.rotation.y = ry; g.add(b);
  }
  // book tower sculpture and dress sculpture
  for (let i = 0; i < 26; i++) {
    const bk = box(g, 0.5 + rnd() * 0.2, 0.08, 0.35, std(['#c2312a', '#2c4a8a', '#f2c230', '#5aa04a', '#e8e4dc'][i % 5], 0.8), 12.4, 0.05 + i * 0.085, -32.4);
    bk.rotation.y = i * 0.35;
  }
  const dress = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 18, 1, true), std('#2e2e33', 0.6, { side: THREE.DoubleSide })); dress.position.set(19.8, 0.8, -29.5); g.add(dress);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.55, 12), std('#3a3a40', 0.6)); torso.position.set(19.8, 1.8, -29.5); g.add(torso);
  // flags near the timber wall
  const flagCols = [['#c2312a', '#ffffff', '#2c4a8a'], ['#000000', '#c2312a', '#f2c230'], ['#2c4a8a', '#f2c230', '#2c4a8a'], ['#5aa04a', '#ffffff', '#c2312a']];
  flagCols.forEach((cols, i) => {
    const ft = canvasTex(96, 64, (c, w, h) => cols.forEach((col, k) => { c.fillStyle = col; c.fillRect(0, k * h / 3, w, h / 3); }));
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshStandardMaterial({ map: ft, side: THREE.DoubleSide, roughness: 0.9 }));
    f.position.set(24.9, 2.6 + i * 0.25, -27.0 - i * 0.55); f.rotation.y = -Math.PI / 2 + 0.6; f.rotation.z = -0.4; g.add(f);
  });
  // pendant lamps
  for (let i = 0; i < 14; i++) {
    const x = 5 + rnd() * 18, z = -26 - rnd() * 18, y = 4.6 + rnd() * 4.5;
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std('#ffffff', 0.4, { side: THREE.DoubleSide })); shade.position.set(x, y, z); g.add(shade);
    const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), new THREE.MeshBasicMaterial({ color: '#fff3d6', toneMapped: false })); bulb.rotation.x = Math.PI / 2; bulb.position.set(x, y + 0.01, z); g.add(bulb);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, A.h - y, 4), std('#222', 0.5)); cord.position.set(x, y + (A.h - y) / 2, z); g.add(cord);
  }

  // ---------- kantine: yellow food trailer ----------
  {
    const tr = new THREE.Group(); tr.position.set(9.5, 0, -43.6); g.add(tr);
    const yel = std('#f2c230', 0.45);
    box(tr, 3.4, 1.9, 1.9, yel, 0, 1.45, 0);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 3.4, 24, 1, false, 0, Math.PI), yel); roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.scale.set(1, 0.35, 1); roof.position.y = 2.4; tr.add(roof);
    box(tr, 2.2, 0.8, 0.05, std('#2a2a2a', 0.3), 0, 1.75, 0.96);                       // serving hatch
    box(tr, 2.4, 0.06, 0.4, std('#f4f2ee', 0.4), 0, 1.33, 1.15);                      // counter shelf
    const aw = canvasTex(128, 32, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#d63a24'; c.fillRect(i * 16, 0, 16, h); } });
    const awning = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), std('#ffffff', 0.7, { map: aw, side: THREE.DoubleSide })); awning.position.set(0, 2.35, 1.25); awning.rotation.x = -0.9; tr.add(awning);
    for (const dx of [-0.9, 0.9]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.18, 18), std('#1a1a1a', 0.8)); w.rotation.x = Math.PI / 2; w.position.set(dx, 0.33, 0.98); tr.add(w); }
    box(tr, 1.2, 0.08, 0.08, std('#555', 0.5), 2.2, 0.45, 0);
    for (const [x, c] of [[-0.6, '#e8a23e'], [-0.2, '#c0392b'], [0.2, '#8a8f55'], [0.6, '#f6c444']]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), std(c, 0.5)); f.position.set(x, 1.42, 1.2); tr.add(f); }
    sign(tr, ['Kantine'], 1.4, 0.35, 0, 2.62, 0.97, 0, { bg: '#d63a24', size: 64 });
  }
  sign(g, ['Menu', 'Broodje kaas · Soep · Fruit · Water'], 2.8, 0.9, 9.5, 3.6, -45.85, 0, { w: 1024, h: 340, bg: '#262a2e', size: 92 });
  // chessboard table on the yellow circle and a foosball table
  const chessTop = canvasTex(256, 64, (c) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { c.fillStyle = (x + y) % 2 ? '#1a1a1a' : '#f4f4f4'; c.fillRect(x * 16, y * 16, 16, 16); } });
  box(g, 3.2, 0.06, 0.9, std('#ffffff', 0.4, { map: chessTop }), 16.3, 0.76, -30.0);
  for (const dx of [-1.4, 1.4]) box(g, 0.08, 0.74, 0.8, std('#333', 0.5), 16.3 + dx, 0.37, -30.0);
  box(g, 1.4, 0.25, 0.8, std('#1f4a2a', 0.6), 13.2, 0.85, -35.6); box(g, 1.5, 0.75, 0.9, std('#222', 0.6), 13.2, 0.38, -35.6);
  for (let i = 0; i < 6; i++) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 6), std('#ccc', 0.3, { metalness: 0.8 })); rod.rotation.x = Math.PI / 2; rod.position.set(12.65 + i * 0.22, 1.02, -35.6); g.add(rod); }
  // tree in a planter next to the globe
  box(g, 0.9, 0.6, 0.9, std('#e8e4dc', 0.6), 16.1, 0.3, -35.3);
  for (let i = 0; i < 10; i++) { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + rnd() * 0.25, 0), std('#4f7a45', 0.9)); l.position.set(16.1 + (rnd() - 0.5) * 1.2, 2.0 + rnd() * 1.6, -35.3 + (rnd() - 0.5) * 1.2); g.add(l); }
  { const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8), std('#6b5a40', 0.9)); trunk.position.set(16.1, 1.6, -35.3); g.add(trunk); }

  // ---------- creative workplaces built by students (orange carpet zone) ----------
  {
    const z0 = -32.5;
    // desk made from the front of a light-blue classic car
    const car = new THREE.Group(); car.position.set(4.0, 0, z0 - 0.5); car.rotation.y = Math.PI / 2; g.add(car);
    const paint = std('#8fd0dc', 0.3, { metalness: 0.5 }), chrome = std('#e6e6e6', 0.2, { metalness: 0.9 });
    box(car, 2.0, 0.55, 1.4, paint, 0, 0.6, 0.2);
    const hood = box(car, 2.0, 0.08, 1.2, paint, 0, 0.92, -0.05); hood.rotation.x = 0.08;
    box(car, 2.1, 0.14, 0.12, chrome, 0, 0.38, 0.92); box(car, 1.0, 0.25, 0.04, chrome, 0, 0.62, 0.92);
    for (const dx of [-0.8, 0.8]) { const hl = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), std('#fffbe6', 0.2, { emissive: '#fff4c0', emissiveIntensity: 0.6 })); hl.position.set(dx, 0.65, 0.93); car.add(hl); }
    for (const dx of [-0.85, 0.85]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16), std('#151515', 0.8)); w.rotation.z = Math.PI / 2; w.position.set(dx, 0.3, 0.4); car.add(w); }
    box(car, 1.8, 0.04, 0.9, std('#f4f4f2', 0.5), 0, 0.98, -0.4);                   // desk top on the hood
    // desk on stacks of books
    box(g, 1.6, 0.05, 0.8, std('#6b3f26', 0.5), 4.2, 0.78, z0 - 4.0);
    for (const dx of [-0.6, 0.6]) for (let i = 0; i < 9; i++) { const b = box(g, 0.32, 0.08, 0.24, std(['#c2312a', '#2c4a8a', '#f2c230', '#e8e4dc', '#5aa04a'][(i + (dx > 0 ? 2 : 0)) % 5], 0.8), 4.2 + dx, 0.04 + i * 0.085, z0 - 4.0); b.rotation.y = (rnd() - 0.5) * 0.4; }
    // decorative antique-style pillars
    for (const z of [z0 - 1.9, z0 - 6.2]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 2.6, 16), std('#a8946a', 0.8)); col.position.set(5.9, 1.3, z); g.add(col);
      box(g, 0.6, 0.15, 0.6, std('#a8946a', 0.8), 5.9, 2.65, z);
    }
    sign(g, ['Zelfgebouwde werkplekken'], 2.4, 0.4, 1.58, 2.7, z0 - 3.2, Math.PI / 2, { w: 768, h: 128, bg: '#d9692a', size: 54 });
  }
  sign(g, ['Leerplein'], 3.4, 0.85, 13.5, 6.6, -45.85, 0, { bg: '#2f6f4f', size: 70 });
  // water tap next to the doorway
  box(g, 0.5, 1.2, 0.3, std('#3a6e82', 0.5), 7.6, 0.6, -24.25);
  sign(g, ['💧 Water'], 0.6, 0.2, 7.6, 1.45, -24.09, Math.PI, { w: 256, h: 84, bg: '#3a6e82', size: 52 });

  // ---------- light ----------
  for (const [x, y, z, i] of [[8, 9, -30, 20], [18, 9, -30, 20], [8, 9, -41, 18], [18, 9, -41, 18], [6, 3.4, -26, 6], [5, 3.6, -41, 6], [20.5, 3.0, -35, 5]]) {
    const l = new THREE.PointLight('#fff6ea', i, 22, 1.4); l.position.set(x, y, z); g.add(l);
  }
}

const ramp = (x) => Math.max(0, Math.min(A.balconyY, A.balconyY * (17 - x) / 5));

// Walkable areas: [x0, x1, z0, z1, floorHeight | (x, z) => height]
export const AGORA_WALK = [
  [3.6, 6.2, -24.6, -23.3],             // doorway from the lobby
  [1.9, 25.1, -45.6, -24.4],            // hall floor
  [1.9, 12.05, -30.2, -26.45, A.balconyY],// yellow balcony (approximate; the curved edge has a railing)
  [11.9, 17.0, -28.65, -26.8, ramp],    // stair down from the balcony
];
// Obstacles: [x0, x1, z0, z1, maxFloor = 99, minFloor = -1] (only block when the player's floor is in range)
export const AGORA_BLOCK = [
  [12.0, 16.6, -28.9, -26.6, 0.05],     // the space under the stair, only at ground level (not on the steps)
  [7.6, 11.9, -44.9, -42.4, 2.0],       // food trailer
  [2.2, 6.3, -38.0, -32.0, 2.0],        // creative desks zone (car desk, book desk, pillars)
  [14.6, 18.0, -30.6, -29.4, 2.0],      // chessboard table
  [12.4, 14.0, -36.1, -35.1, 2.0],      // foosball table
  [15.6, 16.6, -35.8, -34.8, 2.0],      // tree planter
  [18.4, 25.2, -45.8, -44.4, 2.0],      // climbing wall mat
  ...[[6.0, -36.8], [9.5, -37.2], [6.6, -40.2], [9.9, -40.5], [8.0, -38.7]].map(([x, z]) => [x - 1.1, x + 1.1, z - 1.1, z + 1.1, 2.0]),
  ...[[13.2, -30.6], [15.8, -32.6], [14.2, -33.4]].map(([x, z]) => [x - 0.7, x + 0.7, z - 0.7, z + 0.7, 2.0]),
  [16.8, 18.4, -34.0, -32.4, 2.0],      // globe
  [12.0, 12.8, -32.8, -32.0, 2.0],      // book tower
  [19.3, 20.3, -30.0, -29.0, 2.0],      // dress sculpture

  [9.0, 12.3, -32.0, -29.0, 2.0],       // display boards
  ...[[-3.8, -3.8], [3.8, -3.8], [-3.8, 3.8], [3.8, 3.8]].map(([dx, dz]) => [20.5 + dx * 0.87 - 0.2, 20.5 + dx * 0.87 + 0.2, -35 + dz - 0.2, -35 + dz + 0.2, 2.0]),
  [24.3, 25.2, -30.3, -26.6, 2.0], [24.3, 25.2, -43.4, -41.6, 2.0], // chess cabinets
  [3.5, 5.0, -29.8, -28.2, 99, 3.0],    // statue on the balcony
];
