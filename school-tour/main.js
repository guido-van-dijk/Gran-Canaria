import * as THREE from 'three';

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: CAPTURE });
renderer.setPixelRatio(CAPTURE ? 2 : Math.min(devicePixelRatio, 2)); // 2x supersampling for captures
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// ---------- camera: phone photo, level camera with vertical lens shift ----------
// Matches the reference photo: eye height 1.6 m, horizon ~93% down the frame.
const camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 500);
camera.position.set(0, 1.6, 0);
camera.rotation.z = -0.004; // handheld: slight roll
const view = { left: -0.692, right: 0.692, top: 1400 * 0.000692, bottom: -100 * 0.000692 };
camera.updateProjectionMatrix = function () {
  const n = this.near;
  this.projectionMatrix.makePerspective(view.left * n, view.right * n, view.top * n, view.bottom * n, n, this.far);
  this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
};
camera.updateProjectionMatrix();

// ---------- helpers ----------
function canvasTex(w, h, draw, srgb = true, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function noiseTex(size, amp, repeat, grains, blobs = 0) {
  return canvasTex(size, size, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < blobs; i++) { // low-frequency mottling
      const v = Math.floor(128 + (rnd() - 0.5) * 40), r = 20 + rnd() * 80;
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
      grd.addColorStop(0, `rgba(${v},${v},${v},0.25)`); grd.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.save(); g.translate(rnd() * w, rnd() * h); g.fillStyle = grd; g.fillRect(-r, -r, 2 * r, 2 * r); g.restore();
    }
    for (let i = 0; i < grains; i++) {
      const v = Math.floor(128 + (rnd() - 0.5) * amp);
      g.fillStyle = `rgba(${v},${v},${v},0.1)`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
  }, false, repeat);
}
const stuccoBump = noiseTex(512, 255, [5, 5], 140000, 120);
const stuccoColor = canvasTex(512, 512, (g, w, h) => { // subtle albedo mottling + anchor dots
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) {
    const r = 30 + rnd() * 120, a = 0.035 * rnd();
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grd.addColorStop(0, `rgba(150,130,100,${a})`); grd.addColorStop(1, 'rgba(150,130,100,0)');
    g.save(); g.translate(rnd() * w, rnd() * h); g.fillStyle = grd; g.fillRect(-r, -r, 2 * r, 2 * r); g.restore();
  }
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(120,110,95,0.55)'; g.beginPath(); g.arc(rnd() * w, rnd() * h, 1.6, 0, 7); g.fill(); }
}, true, [2, 2]);
const panelBump = noiseTex(256, 90, [2, 2], 16000);
const stuccoFine = noiseTex(512, 200, [10, 10], 90000);
const stuccoAlbedo = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#f2c886'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) { const r = 20 + rnd() * 90, c = rnd() > 0.5 ? '255,240,215' : '150,120,80';
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, r); grd.addColorStop(0, `rgba(${c},0.035)`); grd.addColorStop(1, `rgba(${c},0)`);
    g.save(); g.translate(rnd() * w, rnd() * h); g.fillStyle = grd; g.fillRect(-r, -r, 2 * r, 2 * r); g.restore(); }
  for (let i = 0; i < 60000; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '90,70,40'},0.05)`; g.fillRect(rnd() * w, rnd() * h, 1, 1); }
  for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(90,80,65,0.6)'; g.beginPath(); g.arc(rnd() * w, rnd() * h, 1.5, 0, 7); g.fill(); }
}, true, [3, 3]);

const box = (w, h, d, mat, x, y, z, parent = scene) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
};
const std = (color, rough = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

// ---------- sky ----------
const skyGeo = new THREE.SphereGeometry(300, 32, 16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, toneMapped: false,
  uniforms: { top: { value: new THREE.Color('#6f97c8') }, mid: { value: new THREE.Color('#86a9d1') }, horizon: { value: new THREE.Color('#9cbcd9') } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; varying vec3 vP;
    void main(){ vec3 d = normalize(vP); float h = clamp(d.y,0.0,1.0);
      vec3 c = mix(horizon, mid, smoothstep(0.0,0.4,h)); c = mix(c, top, smoothstep(0.4,0.95,h));
      c += vec3(0.05,0.05,0.04) * clamp(-d.x,0.0,1.0) * (1.0 - smoothstep(0.2,0.7,h));
      gl_FragColor = vec4(c,1.0);
      #include <colorspace_fragment>
    }`,
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

// environment for reflections: sky, warm low sun glow, dark tree line, ground
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(skyGeo, skyMat.clone()));
const envGround = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: '#5d5548' }));
envGround.rotation.x = -Math.PI / 2; envGround.position.y = -1; envScene.add(envGround);
for (let i = 0; i < 40; i++) {
  const a = rnd() * Math.PI * 2, r = 60 + rnd() * 30;
  const t = new THREE.Mesh(new THREE.SphereGeometry(8 + rnd() * 10, 8, 6), new THREE.MeshBasicMaterial({ color: rnd() > 0.5 ? '#2f3a26' : '#4a4630' }));
  t.position.set(Math.cos(a) * r, 4 + rnd() * 8, Math.sin(a) * r); envScene.add(t);
}
const glow = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffd28a' }));
glow.position.set(55, 25, 70); envScene.add(glow);
scene.environment = pmrem.fromScene(envScene, 0.02).texture;
scene.environmentIntensity = 0.45;

// ---------- light: low golden-hour sun from the front-right ----------
const SUN_DIR = new THREE.Vector3(0.55, 0.33, 0.77).normalize();
const sun = new THREE.DirectionalLight('#ffcf8c', 4.4);
sun.target.position.set(0, 6, -14);
sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 140 });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03; sun.shadow.radius = 9; sun.shadow.blurSamples = 16;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight('#aabfdb', '#9a8a6c', 2.4));

// Off-frame neighbouring building behind the camera (right): casts the diagonal
// shadow across the left wing. Invisible, but writes to the shadow map.
{
  const s = new THREE.Shape();
  s.moveTo(11.9, -5); s.lineTo(14.2, -5); s.lineTo(14.2, 30); s.lineTo(11.6, 30); s.closePath();
  const occMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
  const occ = new THREE.Mesh(new THREE.ShapeGeometry(s), occMat);
  occ.position.z = 5; occ.castShadow = true; scene.add(occ);
  // trees / buildings behind the camera shade the ground floor and part of the middle floor
  const low = new THREE.Mesh(new THREE.PlaneGeometry(32, 20), occMat);
  low.position.set(-4.2, 13.2 - 10, 5); low.castShadow = true; scene.add(low);

}

// ---------- ground ----------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), std('#8d8984', 0.95));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// =====================================================================
// LEFT WING: coloured panel facade, facade plane z = -15
// =====================================================================
const FZ = -15;
const L = new THREE.Group(); scene.add(L);
const X0 = -9.76, X1 = 1.45;
const concrete = std('#c8beaa', 0.9, { bumpMap: stuccoBump, bumpScale: 0.4 });
box(X1 - X0, 12.95, 15, std('#c9c4b8', 0.9), (X0 + X1) / 2, 12.95 / 2, FZ - 7.5 - 0.1, L);

// horizontal concrete bands, nearly flush
for (const [a, b] of [[4.30, 5.03], [8.45, 9.07]]) {
  box(X1 - X0 + 0.06, b - a, 0.12, concrete, (X0 + X1) / 2, (a + b) / 2, FZ + 0.02, L);
  box(X1 - X0 + 0.06, 0.035, 0.02, std('#5f5a52'), (X0 + X1) / 2, a - 0.006, FZ + 0.07, L);
}
// two-tier parapet: wide fascia, then set-back upper coping
box(X1 - X0 + 0.06, 0.66, 0.14, concrete, (X0 + X1) / 2, 12.62, FZ + 0.03, L);
box(X1 - X0 + 0.08, 0.05, 0.2, std('#bdb8ad', 0.7), (X0 + X1) / 2, 12.97, FZ + 0.03, L);
box(X1 + 9.24, 0.78, 0.5, std('#d6d2c8', 0.8, { bumpMap: stuccoBump, bumpScale: 0.3 }), (X1 - 9.24) / 2, 13.34, FZ - 0.55, L);
box(X1 + 9.24, 0.05, 0.54, std('#ece9e2', 0.5, { metalness: 0.2 }), (X1 - 9.24) / 2, 13.75, FZ - 0.55, L);
box(X1 - X0, 0.03, 0.05, std('#4a463f'), (X0 + X1) / 2, 12.965, FZ + 0.11, L);
// roof antenna mast
const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.016, 6, 6), std('#cfd8e0', 0.4, { metalness: 0.3 }));
ant.position.set(-3.8, 16.2, -21); scene.add(ant);

const COL = {
  cream: '#efc77d', yellow: '#f6c444', gold: '#c9a040', orange: '#e8a23e', red: '#a85a4a', blue: '#3a6e82',
  olive: '#8a8f55', khaki: '#c6bd98', terra: '#b96443', pale: '#d6cfb3', lightgrey: '#c4c0b5',
};
function panel(x0, x1, y0, y1, color) {
  const w = x1 - x0, h = y1 - y0;
  const c = new THREE.Color(color);
  for (let i = 0; i < 2; i++) { // two strips with a central seam
    const cc = c.clone().offsetHSL(0, 0, i ? -0.008 : 0.004);
    const m = std(cc, 0.42, { bumpMap: panelBump, bumpScale: 0.15, envMapIntensity: 0.6 });
    box(w / 2 - 0.01, h - 0.03, 0.06, m, x0 + w / 4 + i * w / 2, (y0 + y1) / 2, FZ + 0.03, L);
  }
}
const blindTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#ab9e86'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(42, 0, 1, h); g.fillRect(85, 0, 1, h); });
const blindMat = std('#ffffff', 0.8, { map: blindTex });
const winGlass = new THREE.MeshPhysicalMaterial({ color: '#000000', roughness: 0.05, transparent: true, opacity: 0.12, envMapIntensity: 1.0 });
const frameMat = std('#cfcdc7', 0.45, { metalness: 0.4 });
function windowUnit(x0, x1, y0, y1, tint) {
  const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, f = 0.04;
  box(w, f, 0.08, frameMat, cx, y1 - f / 2, FZ + 0.02, L);
  box(w, f, 0.08, frameMat, cx, y0 + f / 2, FZ + 0.02, L);
  box(f, h, 0.08, frameMat, x0 + f / 2, cy, FZ + 0.02, L);
  box(f, h, 0.08, frameMat, x1 - f / 2, cy, FZ + 0.02, L);
  const blind = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * f, h - 2 * f), tint ? std(tint, 0.8) : blindMat);
  blind.position.set(cx, cy, FZ - 0.06); blind.receiveShadow = true; L.add(blind);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * f, h - 2 * f), winGlass);
  g.position.set(cx, cy, FZ - 0.01); L.add(g);
}
// Row 1 (top floor)
const R1 = [9.07, 12.29];
panel(X0, -8.20, ...R1, COL.cream);
windowUnit(-8.20, -6.75, ...R1);
panel(-6.75, -5.45, ...R1, COL.yellow);
windowUnit(-5.45, -4.07, ...R1);
panel(-4.07, -2.82, ...R1, COL.orange);
windowUnit(-2.82, -1.51, ...R1);
panel(-1.51, -0.31, ...R1, COL.red);
windowUnit(-0.31, 1.04, ...R1, '#5e5e5d');
panel(1.04, X1, ...R1, COL.lightgrey);
// Row 2 (middle floor)
const R2 = [5.03, 8.45];
panel(X0, -9.03, ...R2, COL.gold);
windowUnit(-9.03, -7.49, ...R2);
panel(-7.49, -6.14, ...R2, COL.blue);
windowUnit(-6.14, -4.69, ...R2);
panel(-4.69, -3.45, ...R2, COL.olive);
windowUnit(-3.45, -2.08, ...R2, '#c2a57a');
panel(-2.08, -0.83, ...R2, COL.pale);
windowUnit(-0.83, 0.62, ...R2, '#77746c');
panel(0.62, X1, ...R2, COL.gold);
// Ground floor
const R0 = [0, 4.30];
box(0.3, 4.3, 0.4, std('#a5503a', 0.8), -10.02, 2.15, FZ - 0.1, L);
panel(X0, -8.41, ...R0, COL.pale);
panel(-8.41, -6.95, ...R0, COL.khaki);
windowUnit(-6.95, -5.5, ...R0);
panel(-5.5, -4.05, ...R0, COL.pale);
panel(-4.05, -2.70, ...R0, COL.red);
panel(-2.70, -1.35, ...R0, COL.yellow);
windowUnit(-1.35, 0.05, ...R0);
windowUnit(0.05, X1, ...R0);
box(0.12, 4.0, 0.12, std('#2a2a2a', 0.7), 1.28, 10.7, FZ + 0.12, L);
// small utility boxes on the ground-floor panels
box(0.5, 0.46, 0.16, std('#c8623e', 0.6), -2.95, 1.73, FZ + 0.11, L);
box(0.5, 0.46, 0.16, std('#d4a132', 0.6), -1.6, 1.68, FZ + 0.11, L);
// wall-mounted floodlight at the left corner
box(0.25, 0.18, 0.25, std('#f0f0ec', 0.5), -10.05, 5.3, FZ + 0.25, L);

// golden sun spot focused through a porthole onto the dark middle-floor window
const lemon = canvasTex(128, 192, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.filter = 'blur(1px)';
  g.fillStyle = 'rgba(200,178,130,1)';
  g.beginPath(); g.moveTo(w * 0.3, 14); g.lineTo(w * 0.75, 10); g.bezierCurveTo(w * 0.98, h * 0.3, w * 0.98, h * 0.75, w * 0.78, h - 8);
  g.bezierCurveTo(w * 0.4, h * 0.95, w * 0.04, h * 0.8, w * 0.06, h * 0.45); g.bezierCurveTo(w * 0.08, h * 0.2, w * 0.15, 20, w * 0.3, 14); g.fill();
  g.filter = 'none'; g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '255,240,200' : '120,100,70'},0.12)`; g.beginPath(); g.arc(rnd() * w, rnd() * h, 2 + rnd() * 5, 0, 7); g.fill(); }
});
const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.4), new THREE.MeshBasicMaterial({ map: lemon, transparent: true, toneMapped: false, opacity: 0.9 }));
patch.position.set(-0.21, 6.79, FZ - 0.04); L.add(patch);

// =====================================================================
// TOWER: cream rendered volume with acrylic porthole domes, front z = -12.5
// =====================================================================
const TZ = -12.5, TB = 4.63, TH = 14.2, TX = 1.64;
const SIDE_BACK = [0.45, 16.33]; // x, -z of the side wall's back corner
const stucco = std('#ffffff', 0.92, { map: stuccoAlbedo, bumpMap: stuccoFine, bumpScale: 0.12 });
{
  const s = new THREE.Shape();
  s.moveTo(TX, 12.5); s.lineTo(18, 12.5); s.lineTo(18, 26); s.lineTo(SIDE_BACK[0], 26); s.lineTo(...SIDE_BACK); s.lineTo(1.36, 15.0); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: TH - TB, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const t = new THREE.Mesh(geo, stucco);
  t.position.y = TB; t.castShadow = t.receiveShadow = true; scene.add(t);
}
{ // the side face sits in deep shade: darker overlay plane
  const a = new THREE.Vector3(TX, 0, -12.5), b = new THREE.Vector3(1.36, 0, -15.0);
  const len = a.distanceTo(b), n = new THREE.Vector3(b.z - a.z, 0, -(b.x - a.x)).normalize(); if (n.x > 0) n.negate();
  const side = new THREE.Mesh(new THREE.PlaneGeometry(len, TH - TB), std('#8e8d8a', 0.95));
  side.position.copy(a).add(b).multiplyScalar(0.5).addScaledVector(n, 0.004); side.position.y = (TB + TH) / 2;
  side.rotation.y = Math.atan2(n.x, n.z); scene.add(side);
}
{ // soft shade over the lower-left of the tower front (bounce from the street, trees behind the camera)
  const W = 10.4, H = TH - TB;
  const tex = canvasTex(512, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = TX + (i / w) * W, y = TH - (j / h) * H;
      const edge = 6.6 - (x - TX) * (1.7 / 7.4);
      const a = Math.min(1, Math.max(0, (edge - y + 0.6) / 2.0)) * 0.42;
      const k = (j * w + i) * 4; img.data[k] = 95; img.data[k + 1] = 100; img.data[k + 2] = 112; img.data[k + 3] = a * 255;
    }
    g.putImageData(img, 0, 0);
  });
  const ov = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  ov.position.set(TX + W / 2, TB + H / 2, TZ + 0.003); scene.add(ov);
}
// navy entrance column under the tower corner
box(0.2, TB, 0.3, std('#1b1d26', 0.55), TX + 0.05, TB / 2, TZ - 0.5);
// fascia edge and soffit
box(16.6, 0.06, 0.04, std('#b9b2a2'), 9.8, TB + 0.03, TZ + 0.02);
const soffit = new THREE.Mesh(new THREE.PlaneGeometry(16.5, 2.6), std('#6a5e4a', 0.85));
soffit.rotation.x = Math.PI / 2; soffit.position.set(9.8, TB - 0.001, TZ - 1.3); scene.add(soffit);
const lightMat = new THREE.MeshBasicMaterial({ color: '#fff4dc', toneMapped: false });
for (let x = 2.3; x < 16; x += 2.2) for (const z of [-0.6, -1.6]) {
  const dl = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), lightMat);
  dl.rotation.x = Math.PI / 2; dl.position.set(x + (z < -1 ? 0.5 : 0), TB - 0.01, TZ + z); scene.add(dl);
}
// small sensor light on the tower front

// --- entrance: glass curtain wall at z = -15, lobby behind ---
const GZ = -15.0;
box(16, 0.1, 9, std('#6e685e', 0.7), 9.5, 4.15, GZ - 4.5);             // lobby ceiling
box(16, 4.2, 0.1, std('#4a453c', 0.9), 9.5, 2.1, GZ - 9);              // back wall
box(16, 0.05, 9, std('#4d4943', 0.4), 9.5, 0.02, GZ - 4.5);            // floor
for (let x = 2.2; x < 16; x += 0.75) for (let z = -0.6; z > -8; z -= 1.1) {
  const l = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10), lightMat);
  l.rotation.x = Math.PI / 2; l.position.set(x, 4.09, GZ + z); scene.add(l);
}
// white curved spiral stair ribbon
{
  const pts = [];
  for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 1.25 + 0.4; pts.push(new THREE.Vector3(Math.cos(a) * 1.6, i / 40 * 4.0, Math.sin(a) * 1.6)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const ribbon = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.16, 4, false), std('#aeaca6', 0.6));
  ribbon.scale.set(0.6, 0.6, 0.36); ribbon.position.set(5.7, 0.4, GZ - 3.2); scene.add(ribbon);
  const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.05, 6, false), std('#ffffff', 0.4));
  rail.scale.set(0.63, 0.6, 0.38); rail.position.set(5.7, 0.95, GZ - 3.2); scene.add(rail);
}
const intLight = new THREE.PointLight('#ffe2b8', 2, 10, 1.6); intLight.position.set(7, 3.6, GZ - 3); scene.add(intLight);
// dark leaf-cluster sculpture (alpha-cut planes)
const leafTex = canvasTex(512, 512, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(22,22,18,1)'; g.strokeStyle = 'rgba(22,22,18,1)';
  g.lineWidth = 6; g.beginPath(); g.moveTo(256, 512); g.bezierCurveTo(250, 380, 240, 300, 230, 200); g.stroke();
  for (let i = 0; i < 26; i++) {
    const cx = 120 + rnd() * 280, cy = 40 + rnd() * 380, s = 26 + rnd() * 34;
    g.save(); g.translate(cx, cy); g.rotate(rnd() * Math.PI * 2);
    g.beginPath(); g.moveTo(0, -s); g.bezierCurveTo(s * 0.7, -s * 0.4, s * 0.6, s * 0.5, 0, s); g.bezierCurveTo(-s * 0.6, s * 0.5, -s * 0.7, -s * 0.4, 0, -s); g.fill(); g.restore();
    g.lineWidth = 2.5; g.beginPath(); g.moveTo(236, 260 + rnd() * 200); g.lineTo(cx, cy); g.stroke();
  }
});
for (const [x, s] of [[3.0, 2.6], [4.4, 3.0]]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: leafTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
  m.position.set(x, s / 2, GZ - 0.6 - x * 0.1); scene.add(m);
}
const leafDecal = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.4), new THREE.MeshBasicMaterial({ map: leafTex, transparent: true, opacity: 0.95 }));
leafDecal.position.set(3.4, 1.25, GZ + 0.03); scene.add(leafDecal);

const curtainGlass = new THREE.MeshPhysicalMaterial({ color: '#9a8a58', roughness: 0.03, metalness: 0.0, transparent: true, opacity: 0.5, envMapIntensity: 3.0, clearcoat: 1, clearcoatRoughness: 0.03 });
const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(16, TB), curtainGlass);
glassPane.position.set(9.8, TB / 2, GZ); scene.add(glassPane);
const alu = std('#bfae86', 0.45, { metalness: 0.3 });
for (let x = 1.95; x < 17; x += 1.38) box(0.1, TB, 0.1, alu, x, TB / 2, GZ + 0.04);
for (const y of [0.35, 3.45, 4.2]) box(16, 0.1, 0.1, alu, 9.8, y, GZ + 0.04);
// revolving door: glass drum, steel posts, curved header under the transom
const world = { doorWings: new THREE.Group() };
{
  const rd = new THREE.Group(); rd.position.set(6.91, 0, GZ + 0.95); scene.add(rd);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.4, 64, 1, true, -Math.PI / 2, Math.PI),
    new THREE.MeshPhysicalMaterial({ color: '#d8dcd8', roughness: 0.03, transparent: true, opacity: 0.16, side: THREE.DoubleSide, envMapIntensity: 1.2 }));
  drum.position.y = 1.7; rd.add(drum);
  const header = new THREE.Mesh(new THREE.CylinderGeometry(1.33, 1.33, 0.26, 64, 1, true, -Math.PI / 2, Math.PI), std('#b9bab8', 0.35, { metalness: 0.7, side: THREE.DoubleSide }));
  header.position.y = 3.55; rd.add(header);
  for (const a of [-1.45, -0.6, 0.3, 1.2]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.4, 8), std('#a9aaa8', 0.3, { metalness: 0.8 }));
    p.position.set(Math.sin(a) * 1.3, 1.7, Math.cos(a) * 1.3); rd.add(p);
  }
  rd.add(world.doorWings);
  for (let i = 0; i < 3; i++) {
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 3.2), new THREE.MeshPhysicalMaterial({ color: '#cfd5d4', roughness: 0.05, transparent: true, opacity: 0.2, side: THREE.DoubleSide }));
    wing.geometry.translate(0.625, 1.6, 0); wing.rotation.y = i * 2.094 + 0.5; world.doorWings.add(wing);
  }
}
// info sign inside the entrance
box(0.7, 0.45, 0.04, std('#f2f2ee', 0.6), 6.0, 0.5, GZ + 0.2);

// --- porthole domes ---
function portholeTex(variant) {
  return canvasTex(256, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#9ea39d'); grd.addColorStop(0.55, '#6c726a'); grd.addColorStop(1, '#353d33');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(248,247,242,0.88)'; g.lineCap = 'butt';
    if (variant === 0) { g.lineWidth = 32; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(0, 118); g.lineTo(256, 112); g.stroke(); g.lineWidth = 16; g.beginPath(); g.moveTo(40, 20); g.lineTo(236, 236); g.stroke(); g.globalAlpha = 1; }
    if (variant === 1) { g.lineWidth = 20; g.beginPath(); g.moveTo(10, 50); g.lineTo(246, 236); g.stroke(); g.lineWidth = 9; g.beginPath(); g.moveTo(70, 10); g.lineTo(256, 170); g.stroke(); }
    if (variant === 2) { g.lineWidth = 16; g.beginPath(); g.moveTo(150, 0); g.lineTo(150, 256); g.stroke(); g.lineWidth = 10; g.beginPath(); g.moveTo(0, 140); g.lineTo(256, 130); g.stroke(); }
    g.fillStyle = 'rgba(45,55,38,0.45)'; g.beginPath(); g.ellipse(128, 250, 150, 70, 0, 0, Math.PI * 2); g.fill();
  });
}
const domeMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, metalness: 0, transmission: 0.92, ior: 1.49, thickness: 0.01, transparent: true, envMapIntensity: 2.4, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1 });
const haze = new THREE.MeshBasicMaterial({ color: '#dfe3e0', transparent: true, opacity: 0.05, depthWrite: false });
const rimMat = std('#f4f2ec', 0.35, { metalness: 0.1 });
const crescentTex = canvasTex(64, 64, (g, w, h) => { const grd = g.createLinearGradient(w, 0, 0, h); grd.addColorStop(0, 'rgba(60,45,25,0)'); grd.addColorStop(1, 'rgba(60,45,25,0.55)'); g.fillStyle = grd; g.fillRect(0, 0, w, h); });
function porthole(r, variant) {
  const g = new THREE.Group();
  const inside = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ map: portholeTex(variant), roughness: 0.9 }));
  inside.position.z = 0.01; inside.receiveShadow = true; g.add(inside);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.05, 12, 96), rimMat);
  rim.position.z = 0.03; rim.castShadow = true; g.add(rim);
  const sh = new THREE.Mesh(new THREE.RingGeometry(r * 0.96, r * 1.1, 64), new THREE.MeshBasicMaterial({ map: crescentTex, transparent: true, depthWrite: false }));
  sh.position.set(-r * 0.07, -r * 0.07, 0.004); g.add(sh);
  const hgt = r * 0.45, R = (r * r + hgt * hgt) / (2 * hgt), th = Math.asin(r / R);
  const capGeo = new THREE.SphereGeometry(R, 64, 24, 0, Math.PI * 2, 0, th);
  const cap = new THREE.Mesh(capGeo, domeMat);
  cap.rotation.x = Math.PI / 2; cap.position.z = -(R - hgt) + 0.03; cap.castShadow = true; g.add(cap);
  const hz = new THREE.Mesh(capGeo, haze); hz.rotation.x = Math.PI / 2; hz.position.z = cap.position.z + 0.002; g.add(hz);
  return g;
}
const ph = [[4.28, 11.63, 0.94, 0], [7.35, 11.33, 0.56, 2], [3.94, 7.22, 0.98, 1], [6.49, 7.96, 0.66, 2], [8.26, 6.36, 0.6, 1], [10.6, 12.2, 0.9, 1]];
for (const [x, y, r, v] of ph) { const p = porthole(r, v); p.position.set(x, y, TZ + 0.005); scene.add(p); }
// side-wall portholes (domes seen almost edge-on)
{
  const a = new THREE.Vector3(TX, 0, -12.5), b = new THREE.Vector3(SIDE_BACK[0], 0, -SIDE_BACK[1]);
  const dir = b.clone().sub(a).normalize();
  const nrm = new THREE.Vector3(dir.z, 0, -dir.x); if (nrm.x > 0) nrm.negate();
  for (const [t, y] of [[0.86, 11.46], [0.64, 6.9]]) {
    const p = porthole(0.72, 2);
    p.position.copy(a).addScaledVector(dir, t).addScaledVector(nrm, 0.01); p.position.y = y;
    p.lookAt(p.position.clone().add(nrm)); scene.add(p);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.25), std('#f2f0ea', 0.5));
    sill.position.copy(p.position).addScaledVector(nrm, 0.1); sill.position.y = y - 0.78; sill.rotation.y = Math.atan2(nrm.x, nrm.z); if (y > 10) scene.add(sill);
  }
}

// =====================================================================
// STREET FURNITURE
// =====================================================================
{ // lamp post with globe and sign plate
  const darkMetal = std('#3a3e40', 0.5, { metalness: 0.3 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 4.4, 16), darkMetal);
  pole.position.set(3.12, 2.2, -8); pole.rotation.z = 0.03; pole.castShadow = true; scene.add(pole);
  box(0.22, 0.8, 0.03, std('#aaaaa5', 0.5, { metalness: 0.3 }), 3.06, 3.12, -7.9).rotation.z = 0.05;
  box(0.24, 0.05, 0.12, darkMetal, 3.06, 3.5, -7.95); box(0.24, 0.05, 0.12, darkMetal, 3.06, 2.75, -7.95);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.34, 48, 32), std('#c9bca6', 0.5));
  globe.position.set(3.06, 4.73, -8); globe.castShadow = true; scene.add(globe);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.12, 16), darkMetal); collar.position.set(3.06, 4.4, -8); scene.add(collar);
}
{ // flagpole with banner
  const fp = new THREE.Group(); fp.position.set(4.19, 0, -6); fp.rotation.z = 0.099; scene.add(fp);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 9.5, 16), std('#d0cdc4', 0.4, { metalness: 0.5, envMapIntensity: 1.2 }));
  pole.position.y = 4.75; fp.add(pole);
  const banTex = canvasTex(256, 1024, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, 774); grd.addColorStop(0, '#e8c3a2'); grd.addColorStop(1, '#d9b78f');
    g.fillStyle = grd; g.fillRect(0, 0, w, 774);                    // peach-to-tan field
    g.fillStyle = '#e4dccb'; g.fillRect(0, 358, w, 416);
    const bg = g.createLinearGradient(0, 774, 0, 957); bg.addColorStop(0, '#9fa8b8'); bg.addColorStop(1, '#c9cfd9'); g.fillStyle = bg; g.fillRect(0, 774, w, 183);
    g.fillStyle = '#f1f1ee'; g.fillRect(0, 957, w, 67);             // pale blue-grey lower part
    g.fillStyle = '#3c5a3c';                                         // jagged leaf / tree mass
    g.save(); g.translate(170, 610); g.rotate(-0.35); g.scale(0.85, 0.8);
    g.beginPath(); for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, rr = (i % 2 ? 150 : 185) + rnd() * 20; g.lineTo(Math.sin(a) * rr * 0.75, -Math.cos(a) * rr); } g.fill();
    g.strokeStyle = '#7c8a72'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, -190); g.lineTo(0, 200); g.stroke(); g.restore();
    g.fillStyle = '#46554a';
    for (let i = 0; i < 30; i++) { g.beginPath(); g.ellipse(20 + rnd() * 100, 380 + rnd() * 360, 10, 4, rnd() * 3, 0, 7); g.fill(); }
    g.fillStyle = '#78787f'; g.font = 'bold 28px sans-serif'; g.fillText('wing', 40, 1000);
  });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 4.0), std('#a6a6a6', 0.7, { map: banTex, side: THREE.DoubleSide }));
  banner.position.set(0.56, 6.8, 0.03); fp.add(banner);
  for (const y of [8.82, 4.78]) box(1.05, 0.04, 0.04, std('#a8acb0', 0.4, { metalness: 0.6 }), 0.55, y, 0, fp);
  for (const y of [6.3, 5.0]) box(0.12, 0.05, 0.12, std('#333333', 0.8), 0.02, y, 0, fp); // ties
}
{ // trees at the far left edge (no cast shadows onto the facade)
  const leaf = std('#5a5a4a', 1.0), leaf2 = std('#9a6a3a', 1.0);
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + rnd() * 0.5, 0), rnd() > 0.85 ? leaf2 : leaf);
    m.position.set(-10.7 - rnd() * 1.6, 1.3 + rnd() * 7.8, -16.2 + rnd() * 0.8);
    scene.add(m);
  }
}

// ---------- render loop ----------
function resize() {
  const w = CAPTURE ? 1288 : innerWidth, h = CAPTURE ? 966 : innerHeight;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
  const half = ((view.top - view.bottom) * (w / h)) / 2; view.left = -half; view.right = half;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const frameHooks = [];
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  for (const f of frameHooks) f(dt);
  renderer.render(scene, camera);
  window.__frames = (window.__frames || 0) + 1;
  if (CAPTURE && window.__frames >= 3) { renderer.setAnimationLoop(null); window.__png = renderer.domElement.toDataURL('image/png'); }
});
if (!CAPTURE) {
  Promise.all([import('./tour.js'), import('./walk.js')]).then(([tourMod, walkMod]) => {
    const onFrame = f => frameHooks.push(f);
    let tour = null;
    const walk = walkMod.startWalk({ scene, camera, renderer, onFrame, world, onExit: () => { walk.setActive(false); tour.setActive(true); } });
    tour = tourMod.startTour({ camera, view, renderer, onFrame, onWalk: () => { tour.setActive(false); walk.setActive(true); } });
    if (params.has('walk')) { tour.setActive(false); walk.setActive(true); }
  });
}
