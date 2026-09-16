/*
  3D-сад. three.js весь на мутациях (position.set, add, remove...), поэтому он тут,
  а не в core. Как выглядит дерево и где оно стоит, решают plant.js и daytime.js,
  здесь это только рисуется.

  Наружу торчат:
    sync(tasks)           подогнать сад под список задач
    setPhase(phase)       утро / вечер / ночь, с плавным переходом
    setViewShift(x, y)    сдвиг картинки, чтобы сад не уезжал под панель
    setReducedMotion(on)
*/
import * as THREE from 'three';
import { plantFor, gardenSlot, gardenRadius, gardenDecor, starField, SPECIES_NAMES } from '../core/plant.js';
import { SCENE_PALETTES } from '../core/daytime.js';

// --- материалы и геометрия ---

const COLORS = {
  trunk: '#6b4a2e',
  birchBark: '#efece2',
  birchMark: '#2a2a2a',
  leaf: ['#3f8f4a', '#5aa854', '#2f7340'],
  needle: ['#2d6a45', '#3b7f52', '#245a3a'],
  blossom: ['#f2a7bf', '#e98aab', '#f7c3d3'],
  birchLeaf: ['#8cc56a', '#a7d27c', '#74b057'],
  fruit: '#d64533',
  petal: '#fff5f8',
  sprout: '#63b457',
  mound: '#7a5638',
  grass: ['#5f9a45', '#6fae4f', '#4f8a3c'],
  flower: ['#f7d154', '#f28fb0', '#ffffff'],
  stone: '#9a978c',
};

// кешируем материал по цвету, иначе на каждую деталь создавался бы новый
const materials = new Map();
const material = (color) => {
  if (!materials.has(color)) {
    materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }));
  }
  return materials.get(color);
};

// геометрия общая и единичного размера, размер детали задаётся через scale
const SHAPES = {
  crown: new THREE.IcosahedronGeometry(1, 1),
  trunk: new THREE.CylinderGeometry(0.55, 1, 1, 7),
  cone: new THREE.ConeGeometry(1, 1, 8),
  ball: new THREE.SphereGeometry(1, 10, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
  stone: new THREE.IcosahedronGeometry(1, 0),
  mound: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
};

const part = (shape, color, { position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], shadow = true } = {}) => {
  const mesh = new THREE.Mesh(SHAPES[shape], material(color));
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  return mesh;
};

// --- деревья (данные берутся из plantFor) ---

const trunk = (plant, color = COLORS.trunk, width = 0.11) =>
  part('trunk', color, { position: [0, plant.trunkHeight / 2, 0], scale: [width, plant.trunkHeight, width] });

const crown = (plant, palette, { stretch = 1, shrink = 1 } = {}) =>
  plant.crown.map((blob) =>
    part('crown', palette[blob.tone], {
      position: [blob.x * shrink, plant.trunkHeight + blob.y, blob.z * shrink],
      scale: [blob.r * shrink, blob.r * shrink * stretch, blob.r * shrink],
    }));

// точка на шаре кроны: сферические координаты -> x, y, z
const onCrown = (plant, fruit) => {
  const blob = plant.crown[fruit.blob];
  const r = blob.r * 0.97;
  return [
    blob.x + r * Math.sin(fruit.phi) * Math.cos(fruit.theta),
    plant.trunkHeight + blob.y + r * Math.cos(fruit.phi),
    blob.z + r * Math.sin(fruit.phi) * Math.sin(fruit.theta),
  ];
};

// порода -> из чего собрать дерево
const TREES = {
  oak: (plant) => [trunk(plant), ...crown(plant, COLORS.leaf)],
  apple: (plant) => [
    trunk(plant),
    ...crown(plant, COLORS.leaf),
    ...plant.fruits.slice(0, 6).map((f) => part('ball', COLORS.fruit, { position: onCrown(plant, f), scale: [0.08, 0.08, 0.08] })),
  ],
  blossom: (plant) => [
    trunk(plant),
    ...crown(plant, COLORS.blossom),
    ...plant.fruits.map((f) =>
      part('ball', COLORS.petal, { position: onCrown(plant, f), scale: [0.055, 0.055, 0.055], shadow: false })),
  ],
  fir: (plant) => [
    part('trunk', COLORS.trunk, { position: [0, 0.2, 0], scale: [0.1, 0.4, 0.1] }),
    ...plant.tiers.map((tier) =>
      part('cone', COLORS.needle[tier.tone], {
        position: [0, 0.4 + tier.y + tier.height / 2, 0],
        scale: [tier.radius, tier.height, tier.radius],
      })),
  ],
  birch: (plant) => [
    trunk(plant, COLORS.birchBark, 0.08),
    ...plant.marks.map((mark) => {
      const radius = 0.082 * (1 - 0.45 * mark.y);
      return part('box', COLORS.birchMark, {
        position: [Math.cos(mark.angle) * radius, mark.y * plant.trunkHeight, Math.sin(mark.angle) * radius],
        scale: [0.012, 0.025, 0.07],
        rotation: [0, -mark.angle, 0],
        shadow: false,
      });
    }),
    ...crown(plant, COLORS.birchLeaf, { stretch: 1.35, shrink: 0.75 }),
  ],
};

const sprout = () => [
  part('trunk', COLORS.sprout, { position: [0, 0.15, 0], scale: [0.02, 0.3, 0.02] }),
  part('ball', COLORS.sprout, { position: [-0.09, 0.29, 0], scale: [0.11, 0.025, 0.055], rotation: [0, 0, 0.5] }),
  part('ball', COLORS.sprout, { position: [0.09, 0.31, 0], scale: [0.11, 0.025, 0.055], rotation: [0, 0, -0.5] }),
];

// --- декор и небо ---

const decorItem = (item) => {
  const group = new THREE.Group();
  group.position.set(item.x, 0, item.z);
  const s = item.size;
  if (item.kind === 'grass') {
    [-0.05, 0, 0.05].forEach((dx, i) =>
      group.add(part('cone', COLORS.grass[(item.tone + i) % 3], {
        position: [dx * s, 0.12 * s, (i - 1) * 0.03 * s],
        scale: [0.025 * s, 0.25 * s, 0.025 * s],
        rotation: [0, 0, dx * 3],
        shadow: false,
      })));
  } else if (item.kind === 'flower') {
    group.add(part('trunk', COLORS.grass[0], { position: [0, 0.1 * s, 0], scale: [0.012, 0.2 * s, 0.012], shadow: false }));
    group.add(part('ball', COLORS.flower[item.tone], { position: [0, 0.21 * s, 0], scale: [0.05 * s, 0.035 * s, 0.05 * s], shadow: false }));
  } else {
    group.add(part('stone', COLORS.stone, { position: [0, 0.03 * s, 0], scale: [0.14 * s, 0.08 * s, 0.11 * s], rotation: [0, item.tone, 0] }));
  }
  return group;
};

const skyMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color() },
      bottom: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 bottom;
      uniform vec3 horizon;
      varying vec3 vDirection;
      void main() {
        // у горизонта красим в цвет тумана, иначе виден шов между землёй и небом
        float h = clamp(vDirection.y, 0.0, 1.0);
        vec3 sky = mix(bottom, top, pow(smoothstep(0.05, 0.9, h), 0.8));
        gl_FragColor = vec4(mix(horizon, sky, smoothstep(0.0, 0.12, h)), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });

// --- всякое ---

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
const easeInCubic = (t) => t ** 3;

const GROW_MS = 950;
const REMOVE_MS = 450;

// строки '#rrggbb' -> THREE.Color, у них есть lerp для плавной смены времени суток
const toLivePalette = (palette) => ({
  ...palette,
  ...Object.fromEntries(
    Object.entries(palette)
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => [key, new THREE.Color(value)]),
  ),
  lightDirection: new THREE.Vector3(palette.lightDirection.x, palette.lightDirection.y, palette.lightDirection.z).normalize(),
});

// --- сцена ---

export const createGardenScene = (canvas, { reducedMotion = false, onHover = () => {} } = {}) => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);

  const settings = { reducedMotion, viewShift: { x: 0, y: 0 } };

  // небо, солнце/луна и звёзды каждый кадр переезжают вместе с камерой (см. цикл ниже)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), skyMaterial());
  sky.renderOrder = -1;
  scene.add(sky);

  const disk = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), new THREE.MeshBasicMaterial({ fog: false }));
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(9, 24, 16),
    new THREE.MeshBasicMaterial({ fog: false, transparent: true, opacity: 0.25, depthWrite: false }),
  );
  scene.add(disk, halo);

  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute(starField(700).flatMap((s) => [s.x * 140, s.y * 140, s.z * 140]), 3),
    ),
    new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }),
  );
  scene.add(stars);

  // земля
  const groundMaterial = new THREE.MeshStandardMaterial({ roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 64), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  gardenDecor(170).forEach((item) => scene.add(decorItem(item)));

  // светлячки, видно только вечером и ночью (opacity из палитры)
  const FIREFLIES = 45;
  const fireflySeeds = starField(FIREFLIES, 99);
  const fireflyPositions = new Float32Array(FIREFLIES * 3);
  const fireflies = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3)),
    new THREE.PointsMaterial({
      color: '#ffe68a', size: 5, sizeAttenuation: false, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  scene.add(fireflies);

  // свет. bias нужен, иначе на кронах рябь от собственных теней
  const hemi = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.Fog();

  // current каждый кадр понемногу подтягивается к target
  const palette = { current: toLivePalette(SCENE_PALETTES.morning), target: toLivePalette(SCENE_PALETTES.morning) };

  const applyPalette = (p) => {
    sky.material.uniforms.top.value.copy(p.skyTop);
    sky.material.uniforms.bottom.value.copy(p.skyBottom);
    sky.material.uniforms.horizon.value.copy(p.fog);
    scene.fog.color.copy(p.fog);
    groundMaterial.color.copy(p.ground);
    hemi.color.copy(p.hemiSky);
    hemi.groundColor.copy(p.hemiGround);
    hemi.intensity = p.hemiIntensity;
    sun.color.copy(p.light);
    sun.intensity = p.lightIntensity;
    disk.material.color.copy(p.disk);
    halo.material.color.copy(p.disk);
    stars.material.opacity = p.stars;
    fireflies.material.opacity = p.fireflies;
    renderer.setClearColor(p.fog);
  };

  const blendPalette = (amount) => {
    const { current, target } = palette;
    Object.keys(target).forEach((key) => {
      if (current[key] instanceof THREE.Color) current[key].lerp(target[key], amount);
      else if (current[key] instanceof THREE.Vector3) current[key].lerp(target[key], amount).normalize();
      else if (typeof current[key] === 'number') current[key] += (target[key] - current[key]) * amount;
    });
  };

  // --- растения ---
  const plantsGroup = new THREE.Group();
  scene.add(plantsGroup);
  const plants = new Map(); // taskId -> record

  const setContent = (record, done, animate) => {
    record.grow.clear();
    const parts = done ? TREES[record.plant.species](record.plant) : sprout();
    parts.forEach((mesh) => {
      mesh.userData.taskId = record.id;
      record.grow.add(mesh);
    });
    record.done = done;
    record.finalScale = done ? record.plant.scale : 1;
    record.growStart = performance.now();
    record.growFrom = animate && !settings.reducedMotion ? 0.05 : 1;
  };

  const createPlant = (task, animate) => {
    const plant = plantFor(task.id);
    const root = new THREE.Group();
    const sway = new THREE.Group();
    const grow = new THREE.Group();
    const mound = part('mound', COLORS.mound, { scale: [0.42, 0.07, 0.42], shadow: false });
    root.rotation.y = plant.yaw;
    sway.rotation.set(plant.leanX, 0, plant.leanZ);
    sway.add(grow);
    root.add(mound, sway);
    plantsGroup.add(root);

    const record = { id: task.id, title: task.title, plant, root, sway, grow, removing: false, target: new THREE.Vector3() };
    setContent(record, task.done, animate);
    return record;
  };

  const layout = { radius: gardenRadius(0) };

  const sync = (tasks, { animate = true } = {}) => {
    const ids = new Set(tasks.map((task) => task.id));

    plants.forEach((record) => {
      if (!ids.has(record.id) && !record.removing) {
        record.removing = true;
        record.removeStart = performance.now();
      }
    });

    tasks.forEach((task, index) => {
      const existing = plants.get(task.id);
      const record = existing && !existing.removing ? existing : createPlant(task, animate);
      if (record !== existing) plants.set(task.id, record);
      if (record.done !== task.done) setContent(record, task.done, animate);
      record.title = task.title;

      const slot = gardenSlot(index);
      record.target.set(slot.x, 0, slot.z);
      if (!existing) record.root.position.copy(record.target);
    });

    layout.radius = gardenRadius(tasks.length);
    const extent = layout.radius + 3;
    Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, far: 80 });
    sun.shadow.camera.updateProjectionMatrix();
  };

  // --- камера: тянем мышью/пальцем, колесом зум ---
  const view = {
    azimuth: 0.9,
    elevation: 0.3,
    zoom: 1,
    distance: 12,
    dragging: false,
    lastX: 0,
    lastY: 0,
    lastInteraction: -Infinity,
  };

  canvas.addEventListener('pointerdown', (event) => {
    view.dragging = true;
    view.lastX = event.clientX;
    view.lastY = event.clientY;
    view.lastInteraction = performance.now();
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerup', (event) => {
    view.dragging = false;
    canvas.releasePointerCapture(event.pointerId);
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  canvas.addEventListener('pointermove', (event) => {
    if (view.dragging) {
      view.azimuth += (event.clientX - view.lastX) * 0.006;
      view.elevation = clamp(view.elevation + (event.clientY - view.lastY) * 0.004, 0.12, 1.25);
      view.lastX = event.clientX;
      view.lastY = event.clientY;
      view.lastInteraction = performance.now();
      onHover(null);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(plantsGroup.children, true).find((h) => h.object.userData.taskId);
    const record = hit && plants.get(hit.object.userData.taskId);
    onHover(
      record && !record.removing
        ? { title: record.title, kind: record.done ? SPECIES_NAMES[record.plant.species] : 'росток' }
        : null,
      event.clientX,
      event.clientY,
    );
  });
  canvas.addEventListener('pointerleave', () => onHover(null));

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    view.zoom = clamp(view.zoom * Math.exp(event.deltaY * 0.001), 0.45, 1.8);
    view.lastInteraction = performance.now();
  }, { passive: false });

  // --- ресайз ---
  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const { x, y } = settings.viewShift;
    if (x === 0 && y === 0) camera.clearViewOffset();
    else camera.setViewOffset(width, height, -x, y, width, height);
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  // --- каждый кадр ---
  const clock = { last: performance.now() };
  const target = new THREE.Vector3(0, 1.4, 0);

  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - clock.last) / 1000, 0.1); // после фоновой вкладки не прыгаем разом
    clock.last = now;
    const motion = settings.reducedMotion ? 0 : 1;

    // цвета неба/света понемногу едут к нужному времени суток
    blendPalette(settings.reducedMotion ? 1 : 1 - Math.exp(-dt * 2.2));
    applyPalette(palette.current);

    // если 4 сек никто не трогал - камера сама медленно облетает сад
    if (motion && !view.dragging && now - view.lastInteraction > 4000) view.azimuth += dt * 0.05;
    // на телефоне по ширине влезает меньше, отъезжаем подальше
    const narrow = Math.max(1, 0.9 / Math.sqrt(camera.aspect));
    const wanted = Math.max(7, layout.radius * 1.75 + 2) * narrow * view.zoom;
    view.distance += (wanted - view.distance) * (1 - Math.exp(-dt * 3));
    camera.position.set(
      target.x + view.distance * Math.cos(view.elevation) * Math.cos(view.azimuth),
      target.y + view.distance * Math.sin(view.elevation),
      target.z + view.distance * Math.cos(view.elevation) * Math.sin(view.azimuth),
    );
    camera.lookAt(target);
    scene.fog.near = view.distance * 1.1;
    scene.fog.far = view.distance * 4.5;

    // небо ездит за камерой, так до него никогда не добраться зумом
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
    const direction = palette.current.lightDirection;
    disk.position.copy(camera.position).addScaledVector(direction, 120);
    halo.position.copy(disk.position);
    sun.position.copy(direction).multiplyScalar(30);

    // светлячки летают по кругу и чуть покачиваются
    fireflySeeds.forEach((seed, i) => {
      const t = now / 1000;
      const radius = layout.radius * (0.3 + 0.9 * seed.brightness);
      const angle = seed.y * 40 + t * 0.08 * motion * (i % 2 ? 1 : -1);
      fireflyPositions.set([
        Math.cos(angle) * radius + Math.sin(t * 0.7 + i) * 0.3 * motion,
        0.5 + seed.z * 0.6 + 0.8 + Math.sin(t * 1.3 + i * 2) * 0.25 * motion,
        Math.sin(angle) * radius + Math.cos(t * 0.6 + i) * 0.3 * motion,
      ], i * 3);
    });
    fireflies.geometry.attributes.position.needsUpdate = true;

    // растения: рост, переезд на новое место, покачивание, исчезновение
    plants.forEach((record) => {
      if (record.removing) {
        const p = settings.reducedMotion ? 1 : clamp((now - record.removeStart) / REMOVE_MS, 0, 1);
        record.grow.scale.setScalar(record.finalScale * (1 - easeInCubic(p)));
        record.root.scale.setScalar(1 - p);
        if (p >= 1) {
          plantsGroup.remove(record.root);
          // пока дерево исчезало, могли нажать "Вернуть" - тогда под этим id уже новое, его не трогаем
          if (plants.get(record.id) === record) plants.delete(record.id);
        }
        return;
      }
      const p = clamp((now - record.growStart) / GROW_MS, 0, 1);
      const growth = record.growFrom + (1 - record.growFrom) * easeOutBack(p);
      record.grow.scale.setScalar(record.finalScale * growth);
      record.root.position.lerp(record.target, 1 - Math.exp(-dt * 5));
      const phase = record.plant.yaw * 3;
      record.sway.rotation.x = record.plant.leanX + Math.sin(now / 1100 + phase) * 0.025 * motion;
      record.sway.rotation.z = record.plant.leanZ + Math.cos(now / 1400 + phase) * 0.02 * motion;
    });

    renderer.render(scene, camera);
  });

  return {
    sync,
    setPhase: (phase, { instant = false } = {}) => {
      palette.target = toLivePalette(SCENE_PALETTES[phase] ?? SCENE_PALETTES.morning);
      if (instant) palette.current = toLivePalette(SCENE_PALETTES[phase] ?? SCENE_PALETTES.morning);
    },
    setViewShift: (x, y) => {
      settings.viewShift = { x: Math.round(x), y: Math.round(y) };
      resize();
    },
    setReducedMotion: (on) => {
      settings.reducedMotion = on;
    },
  };
};
