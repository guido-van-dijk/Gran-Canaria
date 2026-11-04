import * as THREE from 'three';

// Free-walk mode: walk from the square through the revolving door into the
// lobby and the classroom corridor, and talk to people about your first day.

// ---------------------------------------------------------------------------
// Conversations (Dutch). Each node: text + choices; a choice may complete a
// checklist task and point to the next node ('end' closes the conversation).
// ---------------------------------------------------------------------------
const TASKS = {
  receptie: 'Meld je bij de receptie',
  buddy: 'Praat met je buddy',
  mentor: 'Maak kennis met je mentor',
};

const PEOPLE = [
  {
    id: 'sandra', name: 'Sandra', role: 'receptie',
    pos: [11.5, -20.7], face: 0,
    look: { skin: '#e9c3a0', hair: '#6b3f26', hairStyle: 'bun', shirt: '#2f6f4f', pants: '#2b2f3a', height: 1.68 },
    dialog: {
      start: { text: 'Hoi! Welkom op school. Ik ben Sandra van de receptie. Waarmee kan ik je helpen?', choices: [
        ['Ik ben nieuw. Waar moet ik me melden?', 'melden'],
        ['Wat doe ik als ik te laat ben?', 'laat'],
        ['Ik ben iets kwijt.', 'kwijt'],
        ['Ik voel me niet lekker.', 'ziek'],
        ['Doei!', 'end'],
      ] },
      melden: { task: 'receptie', text: 'Fijn dat je er bent! Op je eerste dag meld je je hier even, dan zet ik een vinkje achter je naam. Daarna haalt je mentor je klas op in de aula.', back: 'start' },
      laat: { text: 'Kom dan eerst hier langs voor een te-laatbriefje. Zonder briefje mag je de les niet in. Geen paniek: het overkomt iedereen weleens.', back: 'start' },
      kwijt: { text: 'Gevonden voorwerpen bewaren we in de bak achter de balie. Kom gerust kijken. Tip: zet je naam in je jas en op je spullen!', back: 'start' },
      ziek: { text: 'Vervelend! Meld je hier, dan bellen we samen naar huis. Ga nooit zomaar weg zonder je af te melden.', back: 'start' },
    },
  },
  {
    id: 'noor', name: 'Noor', role: 'buddy, 3e klas',
    pos: [8.6, -17.6], face: 2.4,
    look: { skin: '#8d5a3b', hair: '#1c1512', hairStyle: 'long', shirt: '#f0a63a', pants: '#3d4f7a', height: 1.62 },
    dialog: {
      start: { text: 'Hé! Ik ben Noor, ik zit in de derde. Ik ben een van de buddy\'s voor nieuwe leerlingen. Vraag maar raak!', choices: [
        ['Hoe vind ik mijn lokaal?', 'lokaal'],
        ['Waar kan ik eten in de pauze?', 'eten'],
        ['Heb je tips voor de eerste week?', 'tips'],
        ['Waar vind ik mijn mentor?', 'mentor'],
        ['Bedankt, doei!', 'end'],
      ] },
      lokaal: { task: 'buddy', text: 'Kijk naar het lokaalnummer: het eerste cijfer is de verdieping. 0.12 is dus beneden, 2.05 op de tweede. De gekleurde panelen buiten helpen ook: elke verdieping heeft zijn eigen kleuren.', back: 'start' },
      eten: { task: 'buddy', text: 'In de pauze kun je in de aula zitten of buiten op het plein. In de kleine pauze blijf je wel op het schoolterrein.', back: 'start' },
      tips: { task: 'buddy', text: 'Pak je tas de avond ervoor in met je rooster ernaast. Zet je rooster op je telefoon. En durf het te vragen als je iets niet weet: iedereen is in het begin de weg kwijt!', back: 'start' },
      mentor: { text: 'De mentoren zitten in de gang links, via de opening naast de trap. Meneer Bakker staat daar meestal bij de kluisjes.', back: 'start' },
    },
  },
  {
    id: 'bakker', name: 'Meneer Bakker', role: 'mentor brugklas',
    pos: [-5.6, -18.3], face: -1.2,
    look: { skin: '#f1cdb0', hair: '#9a8f86', hairStyle: 'short', shirt: '#3a6e82', pants: '#4a4238', height: 1.84, glasses: true },
    dialog: {
      start: { text: 'Goedemiddag! Ik ben meneer Bakker, mentor van de brugklas. Kom je even kennismaken?', choices: [
        ['Wat doet een mentor eigenlijk?', 'wat'],
        ['Ik zit ergens mee...', 'zorg'],
        ['Hoe werkt het rooster?', 'rooster'],
        ['Wat neem ik mee op de eerste dag?', 'mee'],
        ['Tot ziens!', 'end'],
      ] },
      wat: { task: 'mentor', text: 'Ik ben je eerste aanspreekpunt. Ik houd je cijfers en hoe het met je gaat in de gaten, geef mentorlessen en heb contact met je ouders. Loop je ergens tegenaan, dan kom je bij mij.', back: 'start' },
      zorg: { task: 'mentor', text: 'Goed dat je het zegt. Je kunt me altijd een bericht sturen of na de les even blijven. Praat je liever met iemand anders, dan kan dat bij de vertrouwenspersoon of de zorgcoördinator.', back: 'start' },
      rooster: { text: 'Je rooster staat in de app. Check het elke ochtend: soms valt een uur uit of verandert een lokaal. Heb je een tussenuur, dan kun je in de aula of op de stiltewerkplek zitten.', back: 'start' },
      mee: { text: 'Een etui, een schrift, je laptop als je die hebt en je lunch. Je boeken krijg je in de eerste week.', back: 'start' },
    },
  },
];

// Walkable areas (x0, x1, z0, z1) and blocked areas inside them.
const WALK = [
  [-12, 18, -12.6, 8],          // square in front of the school
  [6.25, 7.55, -15.8, -12.4],   // through the revolving door
  [2.2, 17.0, -23.6, -15.5],    // lobby
  [-9.0, 2.6, -18.9, -17.1],    // classroom corridor (ground floor of the wing)
];
const BLOCK = [
  [9.9, 13.1, -20.1, -18.9],    // reception desk
  [4.7, 6.7, -19.2, -17.2],     // spiral stair
  [2.9, 3.35, -8.25, -7.75],    // lamp post
  [3.6, 4.3, -6.3, -5.7],       // flagpole
  [13.6, 16.6, -22.6, -21.6],   // benches
];

const css = `
.walk-hud{position:fixed;left:16px;top:16px;max-width:min(330px,calc(100vw - 32px));background:rgba(255,253,248,.93);border-radius:14px;padding:14px 16px;font:14px/1.45 system-ui,sans-serif;color:#222;box-shadow:0 6px 24px rgba(0,0,0,.2)}
.walk-hud h3{margin:0 0 6px;font-size:16px}
.walk-hud ul{list-style:none;margin:8px 0 0;padding:0}
.walk-hud li{margin:3px 0}
.walk-hud li.done{color:#2f6f4f;text-decoration:line-through}
.walk-hud .keys{color:#555;font-size:13px}
.walk-exit{position:fixed;right:16px;top:16px;border:0;border-radius:999px;padding:10px 16px;font:600 14px system-ui;background:#2f6f4f;color:#fff;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25)}
.walk-prompt{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:rgba(20,24,22,.82);color:#fff;border-radius:999px;padding:10px 18px;font:600 15px system-ui;cursor:pointer;white-space:nowrap}
.walk-tag{position:fixed;transform:translate(-50%,-100%);background:rgba(255,255,255,.92);border-radius:8px;padding:3px 9px;font:600 13px system-ui;color:#222;pointer-events:none;white-space:nowrap}
.walk-tag small{display:block;font-weight:400;color:#666;font-size:11px;text-align:center}
.walk-dialog{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);width:min(620px,calc(100vw - 32px));background:rgba(255,253,248,.97);border-radius:16px;padding:18px 20px;font:16px/1.5 system-ui,sans-serif;color:#222;box-shadow:0 10px 36px rgba(0,0,0,.3)}
.walk-dialog .who{font-weight:700;color:#2f6f4f;margin-bottom:4px}
.walk-dialog .who small{font-weight:400;color:#777}
.walk-dialog .choices{display:flex;flex-direction:column;gap:6px;margin-top:12px}
.walk-dialog button{text-align:left;border:0;border-radius:10px;padding:9px 12px;font:15px system-ui;background:#eee8dc;cursor:pointer;color:#222}
.walk-dialog button:hover,.walk-dialog button:focus{background:#f0a63a;outline:none}
.walk-pad{position:fixed;right:16px;bottom:16px;display:grid;grid-template-columns:repeat(3,52px);grid-template-rows:repeat(2,52px);gap:6px}
.walk-pad button{border:0;border-radius:12px;background:rgba(255,253,248,.85);font:22px system-ui;touch-action:none;user-select:none}
.walk-pad .up{grid-column:2}
.walk-banner{position:fixed;left:50%;top:20%;transform:translateX(-50%);background:#2f6f4f;color:#fff;border-radius:16px;padding:16px 24px;font:700 18px system-ui;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.3)}
@media (hover:hover) and (pointer:fine){.walk-pad{display:none}}
`;

// ---------------------------------------------------------------------------
// Interior
// ---------------------------------------------------------------------------
const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
function addBox(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true; parent.add(m); return m;
}
function textTex(lines, { w = 512, h = 128, bg = '#2f6f4f', fg = '#ffffff', size = 54 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const list = Array.isArray(lines) ? lines : [lines];
  list.forEach((t, i) => { g.font = `bold ${i ? size * 0.55 : size}px system-ui, sans-serif`; g.fillText(t, w / 2, h / 2 + (i - (list.length - 1) / 2) * size * 0.95); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function sign(parent, lines, w, h, x, y, z, ry = 0, opts) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTex(lines, opts), toneMapped: false }));
  m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m;
}

function buildInterior(scene) {
  const g = new THREE.Group(); scene.add(g);
  const wall = std('#e9e3d6', 0.9), floor = std('#b9b2a5', 0.45), ceil = std('#f1eee8', 0.9);

  // lobby side walls; the west wall has an opening into the corridor
  addBox(g, 0.2, 4.1, 2.2, wall, 1.75, 2.05, -15.9);
  addBox(g, 0.2, 4.1, 4.9, wall, 1.75, 2.05, -21.65);
  addBox(g, 0.2, 0.6, 2.4, wall, 1.75, 3.8, -18.0);
  addBox(g, 0.2, 4.1, 9, wall, 17.4, 2.05, -19.5);
  // feature wall behind reception in school green
  addBox(g, 7, 4.0, 0.1, std('#2f6f4f', 0.8), 11.5, 2.05, -23.85);
  sign(g, ['Receptie'], 2.4, 0.6, 11.5, 3.2, -23.78, 0, { bg: '#2f6f4f', size: 64 });
  sign(g, ['Welkom op school!', 'Nieuwe leerlingen: meld je bij de receptie'], 3.6, 0.9, 11.5, 2.25, -23.78, 0, { w: 1024, h: 256, bg: '#2f6f4f', size: 80 });

  // reception desk
  addBox(g, 3.2, 1.1, 0.9, std('#d9c7a6', 0.6), 11.5, 0.55, -19.5);
  addBox(g, 3.3, 0.06, 1.0, std('#f4f2ee', 0.3), 11.5, 1.13, -19.5);
  addBox(g, 3.2, 0.12, 0.05, std('#2f6f4f', 0.6), 11.5, 0.9, -19.03);
  const screen = addBox(g, 0.5, 0.32, 0.03, std('#202428', 0.3), 11.0, 1.35, -19.75); screen.rotation.y = Math.PI;
  addBox(g, 0.05, 0.2, 0.05, std('#555', 0.5), 11.0, 1.2, -19.75);

  // benches and plants
  for (const x of [14.3, 15.9]) {
    addBox(g, 1.4, 0.45, 0.55, std('#f0a63a', 0.7), x, 0.23, -22.1);
  }
  for (const [x, z] of [[16.6, -16.2], [2.8, -23.0], [16.6, -23.0]]) {
    addBox(g, 0.5, 0.5, 0.5, std('#e8e4dc', 0.6), x, 0.25, z);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + Math.random() * 0.15, 0), std('#4f7a45', 0.9));
      leaf.position.set(x + (Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.8, z + (Math.random() - 0.5) * 0.4); g.add(leaf);
    }
  }
  // direction sign to the corridor
  sign(g, ['← Lokalen 0.01–0.12', 'Mentoraat · Kluisjes'], 1.9, 0.55, 2.0, 2.8, -18.0, Math.PI / 2, { w: 760, h: 220, bg: '#3a6e82', size: 64 });

  // classroom corridor through the ground floor of the coloured wing
  const cx0 = -9.4, cx1 = 1.75, czN = -19.1, czS = -16.9, cw = cx1 - cx0, cmid = (cx0 + cx1) / 2;
  addBox(g, cw, 0.05, 2.3, floor, cmid, 0.02, -18.0);
  addBox(g, cw, 0.1, 2.3, ceil, cmid, 3.6, -18.0);
  addBox(g, cw, 3.6, 0.15, wall, cmid, 1.8, czN - 0.07);
  addBox(g, cw, 3.6, 0.15, wall, cmid, 1.8, czS + 0.07);
  addBox(g, 0.15, 3.6, 2.3, wall, cx0 - 0.07, 1.8, -18.0);
  // lockers along the north wall, in the wing's facade colours
  const lockerCols = ['#f6c444', '#e8a23e', '#a85a4a', '#3a6e82', '#8a8f55'];
  for (let i = 0; i < 16; i++) {
    const x = -8.6 + i * 0.52;
    if (x > -6.1 && x < -4.9) continue; // gap for the classroom door
    addBox(g, 0.5, 1.9, 0.45, std(lockerCols[Math.floor(i / 3) % lockerCols.length], 0.5, { metalness: 0.2 }), x, 0.95, czN + 0.24);
    addBox(g, 0.04, 0.12, 0.02, std('#ddd', 0.3, { metalness: 0.8 }), x + 0.17, 1.1, czN + 0.47);
  }
  // classroom doors with numbers
  const doors = [[-5.5, czN + 0.01, 0, '0.04'], [-7.6, czS - 0.01, Math.PI, '0.03'], [-3.0, czS - 0.01, Math.PI, '0.05'], [0.0, czS - 0.01, Math.PI, '0.07']];
  for (const [x, z, ry, n] of doors) {
    const d = addBox(g, 1.0, 2.2, 0.05, std('#c98f4a', 0.6), x, 1.1, z); d.rotation.y = ry;
    sign(g, [n], 0.45, 0.22, x, 2.45, z + (ry ? -0.03 : 0.03), ry, { w: 256, h: 128, bg: '#ffffff', fg: '#222', size: 80 });
  }
  const md = addBox(g, 0.05, 2.2, 1.0, std('#3a6e82', 0.6), cx0 + 0.02, 1.1, -18.0);
  sign(g, ['Mentoraat'], 0.9, 0.25, cx0 + 0.05, 2.5, -18.0, Math.PI / 2, { w: 512, h: 128, bg: '#ffffff', fg: '#3a6e82', size: 64 });
  md.material.color.set('#3a6e82');

  // interior lighting (warm, bright enough to read the signs)
  for (const [x, y, z, i] of [[9.5, 3.6, -19, 9], [4.5, 3.6, -21, 5], [14.5, 3.6, -21, 5], [-1.5, 3.2, -18, 4], [-6.5, 3.2, -18, 4]]) {
    const l = new THREE.PointLight('#fff1dc', i, 11, 1.5); l.position.set(x, y, z); g.add(l);
  }
  for (let x = -8.5; x < 1.5; x += 2) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ color: '#fffaf0', toneMapped: false }));
    p.rotation.x = Math.PI / 2; p.position.set(x, 3.54, -18.0); g.add(p);
  }
  return g;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
function makePerson(look) {
  const s = look.height / 1.75;
  const p = new THREE.Group();
  const body = new THREE.Group(); body.scale.setScalar(s); p.add(body);
  const skin = std(look.skin, 0.7), shirt = std(look.shirt, 0.85), pants = std(look.pants, 0.85), hair = std(look.hair, 0.9);
  for (const sx of [-0.1, 0.1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.7, 4, 10), pants); leg.position.set(sx, 0.45, 0); body.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.24), std('#222', 0.6)); shoe.position.set(sx, 0.04, 0.04); body.add(shoe);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.42, 6, 16), shirt); torso.position.y = 1.12; torso.scale.z = 0.7; body.add(torso);
  const arms = [];
  for (const sx of [-0.26, 0.26]) {
    const arm = new THREE.Group(); arm.position.set(sx, 1.36, 0); body.add(arm);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 4, 10), shirt); upper.position.y = -0.3; arm.add(upper);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), skin); hand.position.y = -0.62; arm.add(hand);
    arms.push(arm);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 10), skin); neck.position.y = 1.47; body.add(neck);
  const head = new THREE.Group(); head.position.y = 1.62; body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 18), skin); skull.scale.set(0.92, 1.05, 1); head.add(skull);
  for (const sx of [-0.045, 0.045]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), std('#1d1d1d', 0.3)); eye.position.set(sx, 0.02, 0.115); head.add(eye);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 6, 16, Math.PI), std('#8a4a3a', 0.6));
  smile.rotation.z = Math.PI; smile.position.set(0, -0.045, 0.113); head.add(smile);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.138, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair); cap.position.y = 0.01; cap.rotation.x = -0.25; head.add(cap);
  if (look.hairStyle === 'bun') { const bun = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), hair); bun.position.set(0, 0.1, -0.11); head.add(bun); }
  if (look.hairStyle === 'long') { const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.22, 4, 12), hair); back.position.set(0, -0.1, -0.07); back.scale.z = 0.6; head.add(back); }
  if (look.glasses) for (const sx of [-0.045, 0.045]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.005, 6, 16), std('#222', 0.4)); ring.position.set(sx, 0.02, 0.122); head.add(ring);
  }
  p.userData = { head, arms, body, hitHeight: look.height };
  return p;
}

// ---------------------------------------------------------------------------
export function startWalk({ scene, camera, renderer, onFrame, world, onExit }) {
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  buildInterior(scene);

  const done = new Set();
  const hud = document.createElement('div'); hud.className = 'walk-hud';
  const exitBtn = document.createElement('button'); exitBtn.className = 'walk-exit'; exitBtn.textContent = '🧭 Terug naar rondleiding';
  const prompt = document.createElement('div'); prompt.className = 'walk-prompt';
  const dialog = document.createElement('div'); dialog.className = 'walk-dialog';
  const pad = document.createElement('div'); pad.className = 'walk-pad';
  pad.innerHTML = '<button class="up" data-k="f">▲</button><button data-k="l">◀</button><button data-k="b">▼</button><button data-k="r">▶</button>';
  const banner = document.createElement('div'); banner.className = 'walk-banner';
  for (const el of [hud, exitBtn, prompt, dialog, pad, banner]) { el.style.display = 'none'; document.body.appendChild(el); }
  exitBtn.onclick = () => onExit && onExit();

  function renderHud() {
    hud.innerHTML = `<h3>Je eerste dag</h3>
      <div class="keys">Lopen: <b>W A S D</b> of pijltjes · Rondkijken: slepen met de muis · Praten: <b>E</b> of klikken</div>
      <ul>${Object.entries(TASKS).map(([k, t]) => `<li class="${done.has(k) ? 'done' : ''}">${done.has(k) ? '✅' : '⬜'} ${t}</li>`).join('')}</ul>`;
  }

  // people
  const npcs = PEOPLE.map(def => {
    const obj = makePerson(def.look);
    obj.position.set(def.pos[0], 0, def.pos[1]); obj.rotation.y = def.face; scene.add(obj);
    const tag = document.createElement('div'); tag.className = 'walk-tag'; tag.innerHTML = `${def.name}<small>${def.role}</small>`; tag.style.display = 'none'; document.body.appendChild(tag);
    return { def, obj, tag, baseYaw: def.face, phase: Math.random() * 6 };
  });

  // player state
  const player = { x: 6.9, z: -6.5, yaw: 0, pitch: 0.05 };
  const keys = new Set();
  window.__player = player; // handy for debugging and automated checks
  let active = false, talking = null, near = null;

  const inRect = (x, z, r, pad = 0) => x > r[0] + pad && x < r[1] - pad && z > r[2] + pad && z < r[3] - pad;
  function canStand(x, z) {
    const R = 0.28;
    if (!WALK.some(r => inRect(x, z, r) && inRect(x, z, r, 0) )) return false;
    // keep a body radius inside walkable space: check the four offset points
    for (const [dx, dz] of [[R, 0], [-R, 0], [0, R], [0, -R]]) if (!WALK.some(r => inRect(x + dx, z + dz, r))) return false;
    if (BLOCK.some(r => x > r[0] - R && x < r[1] + R && z > r[2] - R && z < r[3] + R)) return false;
    if (npcs.some(n => Math.hypot(n.obj.position.x - x, n.obj.position.z - z) < 0.6)) return false;
    return true;
  }

  // ---- dialog ----
  function openDialog(npc, nodeId = 'start') {
    talking = npc;
    const node = npc.def.dialog[nodeId];
    if (node.task && !done.has(node.task)) { done.add(node.task); renderHud(); checkFinished(); }
    const choices = node.choices || [['Ik heb nog een vraag', node.back || 'start'], ['Bedankt, doei!', 'end']];
    dialog.innerHTML = `<div class="who">${npc.def.name} <small>· ${npc.def.role}</small></div><div>${node.text}</div>
      <div class="choices">${choices.map(([t, to], i) => `<button data-to="${to}">${i + 1}. ${t}</button>`).join('')}</div>`;
    dialog.querySelectorAll('button').forEach(b => b.onclick = () => b.dataset.to === 'end' ? closeDialog() : openDialog(npc, b.dataset.to));
    dialog.style.display = ''; prompt.style.display = 'none';
    dialog.querySelector('button').focus({ preventScroll: true });
  }
  function closeDialog() { talking = null; dialog.style.display = 'none'; }
  let bannerTimer = 0;
  function checkFinished() {
    if (done.size === Object.keys(TASKS).length) {
      banner.innerHTML = '🎉 Top! Je weet de weg en je kent de belangrijkste mensen.<br>Je bent klaar voor je eerste schooldag!';
      banner.style.display = ''; bannerTimer = 7;
    }
  }

  // ---- input ----
  addEventListener('keydown', e => {
    if (!active) return;
    if (talking) {
      if (e.key === 'Escape') closeDialog();
      const n = parseInt(e.key, 10);
      if (n >= 1) { const b = dialog.querySelectorAll('button')[n - 1]; if (b) b.click(); }
      return;
    }
    if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && near) { openDialog(near); return; }
    keys.add(e.key.toLowerCase());
    if (e.key.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  pad.querySelectorAll('button').forEach(b => {
    const k = { f: 'arrowup', b: 'arrowdown', l: 'arrowleft', r: 'arrowright' }[b.dataset.k];
    b.addEventListener('pointerdown', e => { e.preventDefault(); keys.add(k); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => keys.delete(k));
  });

  const canvas = renderer.domElement;
  let drag = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener('pointerdown', e => { if (!active) return; drag = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!active || !drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    player.yaw -= dx * 0.005; player.pitch = Math.max(-1.1, Math.min(1.1, player.pitch - dy * 0.004));
  });
  canvas.addEventListener('pointerup', e => {
    if (!active || !drag) return;
    const click = drag.moved < 6; drag = null;
    if (!click || talking) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (const n of npcs) {
      if (ray.intersectObject(n.obj, true).length && Math.hypot(n.obj.position.x - player.x, n.obj.position.z - player.z) < 4) { openDialog(n); return; }
    }
  });
  prompt.onclick = () => near && openDialog(near);

  // ---- per frame ----
  const v = new THREE.Vector3();
  onFrame(dt => {
    // ambient life: door turns, people breathe and look around
    world.doorWings.rotation.y += dt * (active && Math.hypot(player.x - 6.9, player.z + 14) < 3 ? 1.1 : 0.25);
    for (const n of npcs) {
      n.phase += dt;
      const ud = n.obj.userData;
      ud.body.position.y = Math.sin(n.phase * 1.6) * 0.006;
      ud.arms[0].rotation.x = Math.sin(n.phase * 1.1) * 0.05; ud.arms[1].rotation.x = -Math.sin(n.phase * 1.1) * 0.05;
      const dx = player.x - n.obj.position.x, dz = player.z - n.obj.position.z, dist = Math.hypot(dx, dz);
      const want = active && dist < 5 ? Math.atan2(dx, dz) : n.baseYaw;
      let diff = want - n.obj.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      n.obj.rotation.y += diff * Math.min(1, dt * 3);
      if (n === talking) ud.arms[1].rotation.z = 0.15 + Math.sin(n.phase * 4) * 0.12; else ud.arms[1].rotation.z *= 0.9;
    }
    if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) banner.style.display = 'none'; }
    if (!active) return;

    // movement
    if (!talking) {
      let f = 0, s = 0;
      if (keys.has('w') || keys.has('arrowup')) f += 1;
      if (keys.has('s') || keys.has('arrowdown')) f -= 1;
      if (keys.has('a')) s -= 1;
      if (keys.has('d')) s += 1;
      if (keys.has('arrowleft')) player.yaw += dt * 1.8;
      if (keys.has('arrowright')) player.yaw -= dt * 1.8;
      const speed = (keys.has('shift') ? 4.5 : 2.6) * dt;
      const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
      const mx = (fx * f + -fz * s), mz = (fz * f + fx * s), len = Math.hypot(mx, mz);
      if (len > 0) {
        const nx = player.x + (mx / len) * speed, nz = player.z + (mz / len) * speed;
        if (canStand(nx, nz)) { player.x = nx; player.z = nz; }
        else if (canStand(nx, player.z)) player.x = nx;
        else if (canStand(player.x, nz)) player.z = nz;
      }
    }
    const moving = !talking && ['w', 's', 'a', 'd', 'arrowup', 'arrowdown'].some(k => keys.has(k));
    camera.position.set(player.x, 1.6 + (moving ? Math.sin(performance.now() / 140) * 0.025 : 0), player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);

    // who is close enough to talk to?
    near = null; let best = 2.6;
    for (const n of npcs) { const d = Math.hypot(n.obj.position.x - player.x, n.obj.position.z - player.z); if (d < best) { best = d; near = n; } }
    if (!talking) {
      prompt.style.display = near ? '' : 'none';
      if (near) prompt.textContent = `💬 Druk op E (of tik hier) om met ${near.def.name} te praten`;
    }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const n of npcs) {
      v.set(n.obj.position.x, n.obj.userData.hitHeight + 0.3, n.obj.position.z).project(camera);
      const d = Math.hypot(n.obj.position.x - player.x, n.obj.position.z - player.z);
      const vis = v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && d < 14;
      n.tag.style.display = vis ? '' : 'none';
      if (vis) { n.tag.style.left = ((v.x + 1) / 2) * w + 'px'; n.tag.style.top = ((1 - v.y) / 2) * h + 'px'; }
    }
  });

  renderHud();
  return {
    setActive(on) {
      active = on;
      for (const el of [hud, exitBtn, pad]) el.style.display = on ? '' : 'none';
      if (!on) { prompt.style.display = 'none'; closeDialog(); npcs.forEach(n => n.tag.style.display = 'none'); keys.clear(); return; }
      camera.updateProjectionMatrix = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
      camera.fov = 70; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      camera.rotation.order = 'YXZ';
      Object.assign(player, { x: 6.9, z: -6.5, yaw: 0, pitch: 0.05 });
    },
  };
}
