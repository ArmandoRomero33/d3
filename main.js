import * as THREE from 'three';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const CONFIG = {
  apertura:  1.5,
  velocidad: 0.06,
  FL:    { dir: -0.7, offX:  0.3,  offY: 0.0, offZ: -0.2 },
  FR:    { dir:  0.7, offX: -0.3,  offY: 0.0, offZ: -0.2 },
  RL:    { dir: -0.7, offX:  0.3,  offY: 0.0, offZ: -0.2 },
  RR:    { dir:  0.7, offX: -0.3,  offY: 0.0, offZ: -0.2 },
  TRUNK: { dir:  0.5, offX:  0.0,  offY: -0.2, offZ: 0.8 }
};

const doorState = { FL: false, FR: false, RL: false, RR: false, TRUNK: false };

// === RENDERER ================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07090f);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
camera.position.set(5, 3, 7);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFShadowMap;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace  = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// === CONTROLS ================================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance   = 3;
controls.maxDistance   = 18;
controls.maxPolarAngle = Math.PI / 2.05;

// === LIGHTS ==================================================================


const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
keyLight.position.set(4, 9, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near   =  1;
keyLight.shadow.camera.far    = 25;
keyLight.shadow.camera.left   = -5;
keyLight.shadow.camera.right  =  5;
keyLight.shadow.camera.top    =  5;
keyLight.shadow.camera.bottom = -5;
keyLight.shadow.bias = -0.001;
scene.add(keyLight);



scene.add(new THREE.AmbientLight(0xffffff, 1.2));

// === FLOOR ===================================================================
(function buildFloor() {
  // Dark reflective base
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x050810, metalness: 0.8, roughness: 0.25 })
  );
  base.rotation.x = -Math.PI / 2;
  base.receiveShadow = true;
  scene.add(base);

  // Grid drawn once on canvas
  const S   = 1024;
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = S;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const CELLS = 20;
  const STEP  = S / CELLS;

  const fade = ctx.createRadialGradient(S/2, S/2, S*0.05, S/2, S/2, S*0.52);
  fade.addColorStop(0,    'rgba(0,210,255,0.55)');
  fade.addColorStop(0.55, 'rgba(0,170,220,0.20)');
  fade.addColorStop(1,    'rgba(0,0,0,0)');

  ctx.strokeStyle = fade;
  ctx.lineWidth   = 0.8;

  for (let i = 0; i <= CELLS; i++) {
    const p = i * STEP;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(S, p); ctx.stroke();
  }

  const tex  = new THREE.CanvasTexture(cvs);
  const grid = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 28),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  grid.rotation.x = -Math.PI / 2;
  grid.position.y =  0.001;
  scene.add(grid);
})();

// === MODEL ===================================================================
const raycaster  = new THREE.Raycaster();
const mouse      = new THREE.Vector2();
const meshToDoor = new Map();

let car;
let doors      = { FL: null, FR: null, RL: null, RR: null, TRUNK: null };
let pivots     = {};
let hingeBases = {};

const loader = new GLTFLoader();

loader.load(
  './01-passat-generic-sedan-full-v3.gltf',

  // onLoad
  (gltf) => {
    car = gltf.scene;

    // Center model
    const box    = new THREE.Box3().setFromObject(car);
    const center = box.getCenter(new THREE.Vector3());
    car.position.set(-center.x, -box.min.y, -center.z);
    scene.add(car);










    
    // Identify meshes + apply materials
    car.traverse(obj => {
      if (!obj.isMesh) return;
      obj.castShadow = obj.receiveShadow = true;
      obj.material   = obj.material.clone();
      const n        = obj.name.toLowerCase();

      if (n === 'door-front-l') doors.FL    = obj;
      if (n === 'door-front-r') doors.FR    = obj;
      if (n === 'door-rear-l')  doors.RL    = obj;
      if (n === 'door-rear-r')  doors.RR    = obj;
      if (n === 'trunk')        doors.TRUNK = obj;

      if (n.includes('glass') || n.includes('window')) {
        obj.material = new THREE.MeshPhysicalMaterial({
          color: 0xffffff, transparent: true, opacity: 0.05,
          roughness: 0, transmission: 1.0, thickness: 0.1, ior: 1.5,
        });
      } else if (n.includes('tire') || n.includes('tyre')) {
        obj.material = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
      } else if (n.includes('wheel') || n.includes('rim')) {
        obj.material = new THREE.MeshStandardMaterial({ color: 0xccccdd, roughness: 0.12, metalness: 0.95 });
      } else if (n.includes('chrome') || n.includes('trim') || n.includes('grille')) {
        obj.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 1.0 });
      } else if (n.includes('interior') || n.includes('seat') || n.includes('dashboard')) {
        obj.material = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.75 });
      } else if (n.includes('panel')) {
        obj.material = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.6 });
      } else if (n.includes('light') || n.includes('lamp')) {
        obj.material = new THREE.MeshStandardMaterial({
          color: 0xfff8e8, emissive: 0xfff0c0, emissiveIntensity: 0.4, roughness: 0.1,
        });
      } else {
        obj.material = new THREE.MeshPhysicalMaterial({
          color: 0xffffff, 
          roughness: 0.4,
           metalness: 0.1,
          clearcoat: 1.0,
           clearcoatRoughness: 0.04,
        });
      }
    });

    console.log('Model loaded. Doors found:', Object.fromEntries(
      Object.entries(doors).map(([k,v]) => [k, v ? v.name : 'NOT FOUND'])
    ));

    // Link secondary parts to main door mesh
    function linkParts(mainDoor, type) {
      if (!mainDoor) return;
      const id    = mainDoor.id;
      const parts = [];
      car.traverse(obj => {
        if (!obj.isMesh || obj.id === id) return;
        const n = obj.name.toLowerCase();
        if (type === 'RL') {
          if ((n.startsWith('door-rear-') && n.endsWith('-l')) ||
              n === 'door-rear-interior-panel-l' || n === 'door-rear-glass-l') parts.push(obj);
        } else if (type === 'RR') {
          if ((n.startsWith('door-rear-') && n.endsWith('-r')) ||
              n === 'door-rear-interior-panel-r' || n === 'door-rear-glass-r') parts.push(obj);
        } else if (type === 'FL') {
          if ((n.startsWith('door-front-') && n.endsWith('-l')) ||
              n.includes('side-mirror-l')) parts.push(obj);
        } else if (type === 'FR') {
          if ((n.startsWith('door-front-') && n.endsWith('-r')) ||
              n.includes('side-mirror-r')) parts.push(obj);
        } else if (type === 'TRUNK') {
          if (n.includes('trunk')) parts.push(obj);
        }
      });
      parts.forEach(p => {
        const wPos  = p.getWorldPosition(new THREE.Vector3());
        const wQuat = p.getWorldQuaternion(new THREE.Quaternion());
        mainDoor.add(p);
        p.position.copy(mainDoor.worldToLocal(wPos));
        p.quaternion.copy(wQuat);
      });
    }
    Object.keys(doors).forEach(k => linkParts(doors[k], k));

    // Create hinge pivots
    function createPivot(door, key) {
      if (!door) return;
      const bbox = new THREE.Box3().setFromObject(door);
      const cfg  = CONFIG[key];
      let hX = key.includes('L') ? bbox.min.x + cfg.offX : bbox.max.x + cfg.offX;
      let hY = bbox.min.y + cfg.offY;
      let hZ = key === 'TRUNK' ? bbox.min.z + cfg.offZ : bbox.max.z + cfg.offZ;
      if (key === 'TRUNK') hY = bbox.max.y + cfg.offY;

      const pivot = new THREE.Object3D();
      pivot.position.set(hX, hY, hZ);
      hingeBases[key] = pivot.position.clone();
      door.parent.add(pivot);
      const dWPos = door.getWorldPosition(new THREE.Vector3());
      pivot.add(door);
      door.position.set(dWPos.x - hX, dWPos.y - hY, dWPos.z - hZ);
      pivots[key] = pivot;
    }
    Object.keys(doors).forEach(k => createPivot(doors[k], k));

    // Map meshes to door keys for raycasting
    Object.entries(doors).forEach(([key, dm]) => {
      if (!dm) return;
      meshToDoor.set(dm, key);
      dm.traverse(c => { if (c.isMesh) meshToDoor.set(c, key); });
    });
    car.traverse(obj => {
      if (!obj.isMesh) return;
      const n = obj.name.toLowerCase();
      if (n.includes('door-front-') && n.endsWith('-l') || n.includes('side-mirror-l')) meshToDoor.set(obj, 'FL');
      if (n.includes('door-front-') && n.endsWith('-r') || n.includes('side-mirror-r')) meshToDoor.set(obj, 'FR');
      if (n.includes('door-rear-')  && n.endsWith('-l'))  meshToDoor.set(obj, 'RL');
      if (n.includes('door-rear-')  && n.endsWith('-r'))  meshToDoor.set(obj, 'RR');
      if (n.includes('trunk'))                            meshToDoor.set(obj, 'TRUNK');
    });

    console.log('meshToDoor size:', meshToDoor.size);
  },

  // onProgress
  (xhr) => {
    if (xhr.total) console.log('Loading: ' + Math.round(xhr.loaded / xhr.total * 100) + '%');
  },

  // onError
  (err) => {
    console.error('GLTF load error:', err);
    document.body.insertAdjacentHTML('beforeend',
      '<div style="position:fixed;top:20px;left:50%;transform:translateX(-50%);color:#ff4444;font-family:monospace;font-size:13px;background:rgba(0,0,0,.8);padding:12px 20px;border-radius:4px;">' +
      'Error al cargar el modelo: ' + err.message + '</div>');
  }
);

// === CLICK → TOGGLE DOOR =====================================================
renderer.domElement.addEventListener('pointerdown', e => {
  if (!car) return;
  mouse.set(
    ( e.clientX / innerWidth ) * 2 - 1,
    -(e.clientY / innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(car, true);
  if (!hits.length) return;
  const key = meshToDoor.get(hits[0].object);
  if (!key) return;
  doorState[key] = !doorState[key];
  console.log(key, doorState[key] ? 'open' : 'closed');
});

// Pointer cursor on doors
renderer.domElement.addEventListener('pointermove', e => {
  if (!car) return;
  mouse.set(
    ( e.clientX / innerWidth ) * 2 - 1,
    -(e.clientY / innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(car, true);
  renderer.domElement.style.cursor =
    (hits.length && meshToDoor.has(hits[0].object)) ? 'pointer' : 'default';
});

// === ANIMATION LOOP ==========================================================
function animate() {
  requestAnimationFrame(animate);
  Object.keys(pivots).forEach(key => {
    const p      = pivots[key];
    const target = doorState[key] ? CONFIG.apertura * CONFIG[key].dir : 0;
    if (key === 'TRUNK') {
      p.rotation.x = THREE.MathUtils.lerp(p.rotation.x, target, CONFIG.velocidad);
    } else {
      p.rotation.y = THREE.MathUtils.lerp(p.rotation.y, target, CONFIG.velocidad);
    }
    p.position.copy(hingeBases[key]);
  });
  controls.update();
  renderer.render(scene, camera);
}
animate();

// === RESIZE ==================================================================
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// === KEY T → all doors =======================================================
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() !== 't') return;
  const allOpen = Object.values(doorState).every(v => v);
  Object.keys(doorState).forEach(k => doorState[k] = !allOpen);
});