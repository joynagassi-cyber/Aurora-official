import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ArrowLeft, Expand, Pause, Play, RotateCcw, Sparkles, Volume2 } from 'lucide-react';
import './butterfly3d.css';

type AgentState = 'idle' | 'listening' | 'thinking' | 'tool' | 'approval' | 'speaking' | 'error' | 'done';
type WingPivot = { group: THREE.Group; side: -1 | 1; phase: number };
type SceneModel = { root: THREE.Group; wings: WingPivot[]; abdomen: THREE.Group; halo: THREE.Mesh; trails: THREE.Group; materials: THREE.Material[] };

const stateInfo: Record<AgentState, { title: string; description: string; speed: number; amplitude: number; color: string }> = {
  idle: { title: 'Au repos', description: 'Le papillon respire doucement, prêt à écouter.', speed: 1.1, amplitude: 0.08, color: '#8c77ff' },
  listening: { title: 'À l’écoute', description: 'Les ailes s’ouvrent pour accueillir ta demande.', speed: 2.4, amplitude: 0.24, color: '#4bcfff' },
  thinking: { title: 'Réflexion', description: 'Un battement lent accompagne la recherche d’une idée.', speed: 1.45, amplitude: 0.13, color: '#9b72ff' },
  tool: { title: 'En action', description: 'L’agent compose et modifie les éléments du projet.', speed: 4.2, amplitude: 0.36, color: '#6b70ff' },
  approval: { title: 'En attente de ton accord', description: 'Le mouvement ralentit : Aurora attend ta validation.', speed: 0.85, amplitude: 0.035, color: '#ffc15d' },
  speaking: { title: 'Réponse en cours', description: 'Des battements plus légers accompagnent la réponse.', speed: 3.1, amplitude: 0.2, color: '#f27cd2' },
  error: { title: 'Une difficulté', description: 'Les ailes se replient brièvement avant la prochaine action.', speed: 1.5, amplitude: 0.05, color: '#ff687f' },
  done: { title: 'Terminé', description: 'Le papillon s’ouvre : le résultat est prêt à être découvert.', speed: 2, amplitude: 0.22, color: '#71e4c0' },
};
const states = Object.keys(stateInfo) as AgentState[];

const hex = (value: string) => new THREE.Color(value);
function gradientColor(stops: Array<[number, string]>, position: number) {
  const x = THREE.MathUtils.clamp(position, 0, 1);
  for (let index = 0; index < stops.length - 1; index += 1) {
    const [from, fromColor] = stops[index];
    const [to, toColor] = stops[index + 1];
    if (x <= to) return hex(fromColor).lerp(hex(toColor), (x - from) / Math.max(.001, to - from));
  }
  return hex(stops[stops.length - 1][1]);
}

function applyGradient(geometry: THREE.BufferGeometry, stops: Array<[number, string]>) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const position = geometry.getAttribute('position');
  const colors: number[] = [];
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const u = (x - box.min.x) / Math.max(.001, box.max.x - box.min.x);
    const color = gradientColor(stops, u);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function wingShape(kind: 'fore' | 'hind') {
  const shape = new THREE.Shape();
  if (kind === 'fore') {
    shape.moveTo(.07, .12);
    shape.bezierCurveTo(.34, .22, .77, .76, 1.24, 1.25);
    shape.bezierCurveTo(1.52, 1.54, 1.82, 1.78, 1.96, 1.57);
    shape.bezierCurveTo(2.08, 1.37, 1.82, 1.08, 1.51, .77);
    shape.bezierCurveTo(1.12, .37, .56, .04, .1, -.03);
    shape.bezierCurveTo(.01, .03, .02, .08, .07, .12);
  } else {
    shape.moveTo(.08, .06);
    shape.bezierCurveTo(.43, -.04, .91, -.28, 1.19, -.73);
    shape.bezierCurveTo(1.47, -1.16, 1.18, -1.63, .83, -1.82);
    shape.bezierCurveTo(.5, -1.65, .25, -1.08, .1, -.52);
    shape.bezierCurveTo(.03, -.28, .02, -.08, .08, .06);
  }
  return shape;
}

function addWingLines(group: THREE.Group, kind: 'fore' | 'hind', color: string) {
  const lines = kind === 'fore'
    ? [
      [[.13, .14], [.4, .48], [.8, .91], [1.22, 1.27]],
      [[.1, .09], [.45, .14], [.88, .3], [1.38, .57]],
      [[.11, .12], [.32, .62], [.62, 1.02], [.92, 1.42]],
    ]
    : [
      [[.1, .03], [.37, -.34], [.71, -.8], [.86, -1.38]],
      [[.08, .02], [.37, -.14], [.77, -.39], [1.14, -.76]],
    ];
  for (const points of lines) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, .105)));
    const geometry = new THREE.TubeGeometry(curve, 36, kind === 'fore' ? .009 : .008, 6, false);
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .2, roughness: .28, metalness: .1 });
    const line = new THREE.Mesh(geometry, material);
    group.add(line);
  }
}

function tube(points: Array<[number, number, number]>, color: string, radius: number, opacity = 1) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const geometry = new THREE.TubeGeometry(curve, 72, radius, 8, false);
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .45, roughness: .32, metalness: .18, transparent: opacity < 1, opacity });
  return new THREE.Mesh(geometry, material);
}

function buildButterfly(scene: THREE.Scene): SceneModel {
  const root = new THREE.Group();
  scene.add(root);
  const materials: THREE.Material[] = [];
  const wings: WingPivot[] = [];
  const palettes = {
    foreLeft: [[0, '#6a39ff'], [.31, '#2548ff'], [.68, '#16a9ff'], [1, '#74edff']] as Array<[number, string]>,
    foreRight: [[0, '#6a39ff'], [.32, '#a43bff'], [.7, '#f052bd'], [1, '#ffad3e']] as Array<[number, string]>,
    hindLeft: [[0, '#772dff'], [.42, '#2755ff'], [.78, '#20c7ff'], [1, '#a6f4ff']] as Array<[number, string]>,
    hindRight: [[0, '#7135ff'], [.38, '#e149d7'], [.76, '#ff6e9d'], [1, '#ffbd51']] as Array<[number, string]>,
  };
  const wingSpecs: Array<{ kind: 'fore' | 'hind'; side: -1 | 1; colorStops: Array<[number, string]>; phase: number }> = [
    { kind: 'fore', side: -1, colorStops: palettes.foreLeft, phase: .08 },
    { kind: 'fore', side: 1, colorStops: palettes.foreRight, phase: 0 },
    { kind: 'hind', side: -1, colorStops: palettes.hindLeft, phase: .34 },
    { kind: 'hind', side: 1, colorStops: palettes.hindRight, phase: .28 },
  ];

  for (const spec of wingSpecs) {
    const pivot = new THREE.Group();
    pivot.position.set(0, spec.kind === 'fore' ? .12 : -.04, 0);
    const mirror = new THREE.Group();
    mirror.scale.x = spec.side;
    pivot.add(mirror);
    const geometry = new THREE.ExtrudeGeometry(wingShape(spec.kind), {
      depth: .055, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .025, bevelThickness: .035, curveSegments: 28,
    });
    applyGradient(geometry, spec.colorStops);
    const material = new THREE.MeshPhysicalMaterial({
      vertexColors: true, side: THREE.DoubleSide, roughness: .27, metalness: .12,
      clearcoat: .78, clearcoatRoughness: .22, emissive: '#27106c', emissiveIntensity: .06,
    });
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mirror.add(mesh);
    addWingLines(mirror, spec.kind, spec.side === -1 ? '#8feeff' : '#ffd58a');
    root.add(pivot);
    wings.push({ group: pivot, side: spec.side, phase: spec.phase });
  }

  // Corps fuselé et tête lisse : le logo ne porte pas de visage, on conserve son langage abstrait.
  const body = new THREE.Group();
  const abdomenMaterial = new THREE.MeshPhysicalMaterial({ color: '#241260', emissive: '#4520a1', emissiveIntensity: .25, roughness: .24, metalness: .22, clearcoat: 1 });
  materials.push(abdomenMaterial);
  const abdomen = new THREE.Mesh(new THREE.CapsuleGeometry(.095, .68, 8, 18), abdomenMaterial);
  abdomen.position.set(0, -.28, .11); abdomen.castShadow = true; body.add(abdomen);
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(.15, 32, 24), new THREE.MeshPhysicalMaterial({ color: '#4722cd', emissive: '#632eff', emissiveIntensity: .28, roughness: .18, metalness: .18, clearcoat: 1 }));
  thorax.scale.set(.82, 1.12, .82); thorax.position.set(0, .2, .16); body.add(thorax); materials.push(thorax.material);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.13, 32, 24), new THREE.MeshPhysicalMaterial({ color: '#4431d8', emissive: '#6656ff', emissiveIntensity: .35, roughness: .16, metalness: .2, clearcoat: 1 }));
  head.scale.set(.9, .9, .85); head.position.set(0, .43, .16); body.add(head); materials.push(head.material);
  for (let i = 0; i < 3; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.09 - i * .008, .008, 8, 32), new THREE.MeshStandardMaterial({ color: i === 1 ? '#b697ff' : '#3d21a1', emissive: '#5836d6', emissiveIntensity: .28, roughness: .3 }));
    ring.position.set(0, -.04 - i * .13, .16); body.add(ring); materials.push(ring.material);
  }
  root.add(body);

  const antennaMaterial = new THREE.MeshStandardMaterial({ color: '#a88dff', emissive: '#6a48ff', emissiveIntensity: .55, roughness: .24 });
  materials.push(antennaMaterial);
  for (const side of [-1, 1] as const) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * .04, .47, .16),
      new THREE.Vector3(side * .12, .72, .14),
      new THREE.Vector3(side * .28, 1.02, .12),
      new THREE.Vector3(side * .49, 1.12, .12),
    ]);
    const antenna = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, .013, 8, false), antennaMaterial);
    root.add(antenna);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.052, 20, 16), new THREE.MeshPhysicalMaterial({ color: side < 0 ? '#46dfff' : '#ff89d5', emissive: side < 0 ? '#25bdff' : '#fb57c5', emissiveIntensity: .85, roughness: .18, clearcoat: 1 }));
    tip.position.copy(curve.getPoint(1)); root.add(tip); materials.push(tip.material);
  }

  const trails = new THREE.Group();
  trails.add(tube([[-.25, -.62, -.04], [-.95, -1.55, -.06], [-1.8, -1.58, -.08], [-2.12, -.9, -.08], [-1.65, -.35, -.08]], '#37cfff', .018, .82));
  trails.add(tube([[.22, -.68, -.05], [1.05, -1.58, -.08], [1.84, -1.46, -.09], [2.08, -.55, -.09], [1.67, .24, -.09]], '#d55cff', .016, .76));
  trails.add(tube([[.9, 1.48, -.08], [1.54, 1.84, -.09], [2.15, 1.79, -.1]], '#ffb547', .014, .74));
  root.add(trails);

  const haloMaterial = new THREE.MeshBasicMaterial({ color: '#8e6aff', transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false });
  materials.push(haloMaterial);
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.88, 1.91, 96), haloMaterial);
  halo.position.z = -.24; root.add(halo);
  return { root, wings, abdomen: body, halo, trails, materials };
}

function disposeModel(model: SceneModel) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  model.root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.forEach((material) => materials.add(material));
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function Butterfly3D() {
  const hostRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<SceneModel | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const stateRef = useRef<AgentState>('idle');
  const multiplierRef = useRef(1);
  const timersRef = useRef<number[]>([]);
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [multiplier, setMultiplier] = useState(1);
  const [events, setEvents] = useState<Array<{ at: string; label: string }>>([{ at: '—', label: 'En attente d’une demande' }]);
  const [sequencePlaying, setSequencePlaying] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
    camera.position.set(0, .12, 7.8);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.className = 'butterfly-webgl';
    renderer.domElement.setAttribute('aria-label', 'Modèle 3D interactif du papillon Aurora');
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight('#fff8ff', '#4b347d', 2.05));
    const keyLight = new THREE.DirectionalLight('#ffffff', 3.2); keyLight.position.set(-3, 4, 6); keyLight.castShadow = true; scene.add(keyLight);
    const cyanLight = new THREE.PointLight('#2acfff', 22, 8); cyanLight.position.set(-2.5, .5, 2.1); scene.add(cyanLight);
    const violetLight = new THREE.PointLight('#9b53ff', 20, 8); violetLight.position.set(2.4, .9, 2.2); scene.add(violetLight);
    const warmLight = new THREE.PointLight('#ff9958', 13, 6); warmLight.position.set(1.1, -1.2, 2); scene.add(warmLight);

    const model = buildButterfly(scene); modelRef.current = model;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .065; controls.enablePan = false;
    controls.minDistance = 4.7; controls.maxDistance = 10.4;
    controls.minPolarAngle = Math.PI * .22; controls.maxPolarAngle = Math.PI * .78;
    controlsRef.current = controls;

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      const width = Math.max(1, bounds.width), height = Math.max(1, bounds.height);
      camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let last = performance.now(); let elapsed = 0; let frameId = 0;
    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      const delta = Math.min(.05, (now - last) / 1000); last = now;
      if (!reducedMotion.matches) elapsed += delta;
      const current = stateInfo[stateRef.current];
      const speed = reducedMotion.matches ? .18 : current.speed;
      const amplitude = reducedMotion.matches ? .015 : current.amplitude * multiplierRef.current;
      for (const wing of model.wings) {
        const phase = elapsed * speed * 2.2 + wing.phase;
        const fold = Math.sin(phase) * amplitude;
        const errorFold = stateRef.current === 'error' ? .28 : 0;
        wing.group.rotation.y = wing.side * (fold + errorFold);
        wing.group.rotation.z = wing.side * Math.sin(phase * .5) * amplitude * .09;
      }
      model.abdomen.position.y = -.012 + Math.sin(elapsed * 1.5) * (reducedMotion.matches ? .005 : .025);
      model.halo.rotation.z += delta * (stateRef.current === 'tool' ? .42 : .09);
      (model.halo.material as THREE.MeshBasicMaterial).color.set(current.color);
      (model.halo.material as THREE.MeshBasicMaterial).opacity = stateRef.current === 'approval' ? .2 : stateRef.current === 'error' ? .19 : .1;
      model.root.rotation.z = Math.sin(elapsed * .55) * (reducedMotion.matches ? 0 : .018);
      controls.update(); renderer.render(scene, camera);
    };
    frameId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frameId); observer.disconnect(); controls.dispose(); controlsRef.current = null;
      disposeModel(model); renderer.dispose(); renderer.domElement.remove(); modelRef.current = null;
    };
  }, []);

  const selectState = (next: AgentState, log = true) => {
    stateRef.current = next; setAgentState(next);
    if (log) setEvents((current) => [{ at: new Date().toLocaleTimeString('fr-FR'), label: stateInfo[next].title }, ...current].slice(0, 5));
  };
  const clearSequence = () => { timersRef.current.forEach(window.clearTimeout); timersRef.current = []; setSequencePlaying(false); };
  const playSequence = () => {
    clearSequence(); setSequencePlaying(true);
    const steps: Array<[number, AgentState]> = [[0, 'listening'], [1250, 'thinking'], [2750, 'tool'], [5200, 'approval'], [7350, 'tool'], [9400, 'speaking'], [11900, 'done']];
    steps.forEach(([delay, next], index) => {
      const timer = window.setTimeout(() => { selectState(next); if (index === steps.length - 1) setSequencePlaying(false); }, delay);
      timersRef.current.push(timer);
    });
  };
  const resetView = () => {
    controlsRef.current?.reset();
    clearSequence(); selectState('idle');
  };
  useEffect(() => () => { timersRef.current.forEach(window.clearTimeout); }, []);
  const changeAmplitude = (value: number) => { multiplierRef.current = value; setMultiplier(value); };

  return <main className="butterfly-page">
    <header className="butterfly-topbar">
      <a className="butterfly-back" href="/" aria-label="Retour au studio Aurora"><ArrowLeft size={17} /> <span>Retour au studio</span></a>
      <div className="butterfly-wordmark">aurora <span>/ AGENT BUTTERFLY</span></div>
      <span className="butterfly-live"><i /> MODÈLE 3D INTERACTIF</span>
    </header>
    <div className="butterfly-content">
      <section className="butterfly-heading">
        <p className="butterfly-eyebrow">UN AVATAR POUR L’AGENT</p>
        <h1>La métamorphose<br />prend <em>forme.</em></h1>
        <p>Un papillon 3D généré par géométrie, inspiré des formes et des couleurs de ton logo. Fais glisser pour l’observer sous tous les angles.</p>
      </section>
      <section className="butterfly-workspace">
        <div className="butterfly-stage-card">
          <div className="butterfly-stage-head"><div><span className="stage-kicker">AVATAR AURORA</span><strong>{stateInfo[agentState].title}</strong></div><div className="drag-hint"><Expand size={14} /> Glisse pour tourner · molette pour zoomer</div></div>
          <div className="butterfly-stage" ref={hostRef}>
            <div className={`butterfly-stage-glow is-${agentState}`} />
            <div className="stage-floater" aria-hidden="true"><span /><span /><span /><span /></div>
            <div className="webgl-fallback">Chargement du modèle 3D…</div>
          </div>
          <div className="butterfly-caption"><span className="state-light" style={{ background: stateInfo[agentState].color }} /><div><strong>{stateInfo[agentState].title}</strong><small>{stateInfo[agentState].description}</small></div><span className="live-tag">{sequencePlaying ? 'SCÉNARIO EN COURS' : 'APERÇU EN DIRECT'}</span></div>
        </div>
        <aside className="butterfly-controls">
          <section className="control-block">
            <div className="control-title"><span>États de l’agent</span><small>8 états</small></div>
            <div className="agent-state-grid">
              {states.map((state) => <button key={state} type="button" className={`agent-state-button ${agentState === state ? 'selected' : ''}`} aria-pressed={agentState === state} onClick={() => { clearSequence(); selectState(state); }}>
                <span className={`agent-state-dot ${state}`} /><span>{stateInfo[state].title}</span>
              </button>)}
            </div>
          </section>
          <section className="control-block">
            <div className="control-title"><span>Animation</span><small>contrôle du battement</small></div>
            <label className="wing-slider"><span>Amplitude des ailes</span><b>{Math.round(multiplier * 100)}%</b><input type="range" min="0.45" max="1.5" step="0.05" value={multiplier} onChange={(event) => changeAmplitude(Number(event.target.value))} /></label>
            <div className="animation-actions">
              <button className="scenario-button" type="button" onClick={sequencePlaying ? clearSequence : playSequence}>{sequencePlaying ? <Pause size={15} /> : <Play size={15} />}<span>{sequencePlaying ? 'Arrêter le scénario' : 'Jouer le scénario complet'}</span></button>
              <button className="icon-action" type="button" onClick={resetView} aria-label="Réinitialiser la vue"><RotateCcw size={16} /></button>
            </div>
          </section>
          <section className="control-block event-block">
            <div className="control-title"><span>Journal d’activité</span><small>événements simulés</small></div>
            <ol className="butterfly-events">{events.map((event, index) => <li key={`${event.at}-${event.label}-${index}`}><time>{event.at}</time><span>{event.label}</span>{index === 0 && <i />}</li>)}</ol>
          </section>
          <div className="interaction-note"><span><Volume2 size={15} /></span><p><strong>Ton logo, transformé en volume</strong><br />Les ailes, nervures, antennes et rubans sont des maillages 3D créés en JavaScript, pas une image plaquée sur un plan.</p></div>
        </aside>
      </section>
      <footer className="butterfly-footnote"><span><Sparkles size={13} /> Modèle procédural · Three.js</span><span>La forme est une interprétation 3D du logo, pas une extrusion exacte du fichier PNG.</span></footer>
    </div>
  </main>;
}

export default Butterfly3D;
