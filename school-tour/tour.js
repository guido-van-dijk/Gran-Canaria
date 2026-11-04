import * as THREE from 'three';

// Onboarding layer for new students: numbered stops on the building,
// a camera flight to each stop and an info card in Dutch.
const STOPS = [
  {
    title: 'Welkom!',
    text: 'Dit is je nieuwe school. In deze korte tour laten we je zien waar je naartoe moet op je eerste dag. Klik op "Volgende" of op een van de nummers.',
    pos: [0, 1.6, 0], look: [0, 7.5, -15], marker: null,
  },
  {
    title: 'De hoofdingang',
    text: 'Je komt binnen via de draaideur onder de grote witte toren. Direct binnen is de receptie: hier meld je je als je te laat bent, iets kwijt bent of iemand zoekt.',
    pos: [4.5, 1.7, -4], look: [7.3, 1.8, -15], marker: [7.3, 3.4, -13.6],
  },
  {
    title: 'Het trappenhuis met patrijspoorten',
    text: 'Achter de ronde ramen zit het trappenhuis. Via deze trap kom je bij alle verdiepingen. Tip: links houden op de trap, dan loopt iedereen soepel door.',
    pos: [2, 6, -3], look: [4.2, 9.5, -12.5], marker: [4.28, 11.63, -12],
  },
  {
    title: 'De lesvleugel',
    text: 'In de vleugel met de gekleurde panelen zitten de lokalen. Elke verdieping heeft een eigen kleur, zodat je snel ziet waar je bent. Je rooster vertelt je in welk lokaal je les hebt.',
    pos: [-4.5, 5, -5], look: [-4.5, 7, -15], marker: [-4.5, 10.7, -14.5],
  },
  {
    title: 'Mentor en hulp',
    text: 'Op de begane grond vind je je mentor en de zorgcoördinator. Heb je vragen of zit je ergens mee? Loop gerust binnen of stuur je mentor een bericht.',
    pos: [-2, 1.7, -6], look: [-2.5, 2.2, -15], marker: [-2.0, 2.6, -14.5],
  },
];

const css = `
.tour-card{position:fixed;left:16px;bottom:16px;max-width:min(420px,calc(100vw - 32px));background:rgba(255,253,248,.94);color:#222;border-radius:14px;padding:18px 20px;box-shadow:0 8px 30px rgba(0,0,0,.25);font:15px/1.5 system-ui,sans-serif}
.tour-card h2{margin:0 0 6px;font-size:20px}
.tour-card .row{display:flex;gap:8px;margin-top:12px;align-items:center}
.tour-card button{border:0;border-radius:999px;padding:8px 16px;font:600 14px system-ui;cursor:pointer;background:#e9e4da;color:#222}
.tour-card button.primary{background:#2f6f4f;color:#fff}
.tour-card button.walk{background:#f0a63a;color:#222;width:100%}
.tour-card .step{margin-left:auto;font-size:13px;color:#666}
.tour-dot{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:#2f6f4f;color:#fff;font:700 15px/34px system-ui;text-align:center;cursor:pointer;box-shadow:0 0 0 4px rgba(255,255,255,.7);transition:transform .15s}
.tour-dot:hover,.tour-dot.active{transform:scale(1.18);background:#f0a63a;color:#222}
`;

export function startTour({ camera, view, renderer, onFrame, onWalk }) {
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const card = document.createElement('div'); card.className = 'tour-card'; document.body.appendChild(card);

  const dots = STOPS.map((s, i) => {
    if (!s.marker) return null;
    const d = document.createElement('div'); d.className = 'tour-dot'; d.textContent = i;
    d.onclick = () => go(i); document.body.appendChild(d); return d;
  });

  // Free perspective once we leave the photo viewpoint.
  const photoProjection = camera.updateProjectionMatrix;
  const freeProjection = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;

  let current = 0, flight = null, active = true;
  const lookNow = new THREE.Vector3(...STOPS[0].look);

  function render() {
    const s = STOPS[current], last = current === STOPS.length - 1;
    card.innerHTML = `<h2>${s.title}</h2><div>${s.text}</div>
      <div class="row">${current ? '<button data-a="prev">Vorige</button>' : ''}
      <button class="primary" data-a="next">${last ? 'Opnieuw' : 'Volgende'}</button>
      <span class="step">${current + 1} / ${STOPS.length}</span></div>
      <div class="row"><button class="walk" data-a="walk">🚶 Zelf rondlopen en naar binnen</button></div>`;
    card.querySelectorAll('button').forEach(b => b.onclick = () => b.dataset.a === 'walk' ? onWalk && onWalk() : go(b.dataset.a === 'prev' ? current - 1 : (last ? 0 : current + 1)));
    dots.forEach((d, i) => d && d.classList.toggle('active', i === current));
  }

  function go(i) {
    current = i;
    const s = STOPS[i];
    if (i === 0) { camera.updateProjectionMatrix = photoProjection; } else if (camera.updateProjectionMatrix !== freeProjection) {
      camera.updateProjectionMatrix = freeProjection; camera.fov = 60; camera.aspect = innerWidth / innerHeight;
    }
    camera.updateProjectionMatrix();
    flight = { t: 0, fromPos: camera.position.clone(), toPos: new THREE.Vector3(...s.pos), fromLook: lookNow.clone(), toLook: new THREE.Vector3(...s.look) };
    render();
  }

  addEventListener('resize', () => { if (camera.updateProjectionMatrix === freeProjection) { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); } });

  const v = new THREE.Vector3();
  onFrame((dt) => {
    if (!active) return;
    if (flight) {
      flight.t = Math.min(1, flight.t + dt / 2.2);
      const e = flight.t < 0.5 ? 2 * flight.t * flight.t : 1 - Math.pow(-2 * flight.t + 2, 2) / 2;
      camera.position.lerpVectors(flight.fromPos, flight.toPos, e);
      lookNow.lerpVectors(flight.fromLook, flight.toLook, e);
      if (flight.t >= 1) flight = null;
    }
    if (camera.updateProjectionMatrix === photoProjection && !flight) camera.rotation.set(0, 0, -0.004);
    else camera.lookAt(lookNow);
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    dots.forEach((d, i) => {
      if (!d) return;
      v.set(...STOPS[i].marker).project(camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      d.style.display = vis ? 'block' : 'none';
      d.style.left = ((v.x + 1) / 2) * w + 'px'; d.style.top = ((1 - v.y) / 2) * h + 'px';
    });
  });
  render();

  return {
    setActive(on) {
      active = on;
      card.style.display = on ? '' : 'none';
      dots.forEach(d => d && (d.style.display = on ? '' : 'none'));
      if (on) { camera.rotation.order = 'XYZ'; go(current); }
    },
  };
}
