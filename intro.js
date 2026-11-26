function mountCloudIntro(openLab) {
  const intro = document.getElementById('cloud-intro');
  const title = document.getElementById('intro-title');
  const description = document.getElementById('intro-description');
  const resources = document.getElementById('intro-resources');
  const algorithms = document.getElementById('intro-algorithms');
  const next = document.getElementById('intro-next');
  const replay = document.getElementById('intro-replay');
  const status = document.getElementById('intro-status');
  const viewport = document.getElementById('intro-viewport');
  const diagram = document.getElementById('intro-diagram');
  const caption = document.getElementById('intro-scene-footer');
  const lab = document.getElementById('cloud-lab');
  const labTitle = document.getElementById('cloud-lab-title');
  const panel = document.getElementById('intro-lab-panel');
  const stops = intro.querySelectorAll('.intro-stops li');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = [
    {
      id: 'welcome',
      title: title.textContent,
      description: description.textContent,
      action: 'Mulai Tur',
    },
    {
      id: 'resources',
      title: 'Siapkan kapasitas VM',
      description: 'Operator mengaktifkan tiga mesin virtual. Untuk task yang sama, VM dengan kapasitas MIPS lebih besar menyelesaikannya lebih cepat.',
      action: 'Lanjut ke Scheduling',
      walking: 'Operator sedang berjalan ke rak VM.',
    },
    {
      id: 'scheduling',
      title: 'Dua cara mencari jadwal',
      description: 'Enam cloudlet dan tiga VM yang sama menjadi masukan untuk DMFO-DE dan SA-SCA.',
      action: 'Masuk Lab',
      walking: 'Operator sedang berjalan ke meja penjadwalan.',
    },
  ];

  let step = 0;
  let destination = 0;
  let frame = 0;
  let closed = false;
  let entering = false;
  let approachFrame = 0;
  let panelAnimation;
  let view;

  function showStep(index, announce = false) {
    step = index;
    destination = index;
    const scene = scenes[index];
    intro.dataset.scene = scene.id;
    title.textContent = scene.title;
    description.textContent = scene.description;
    resources.hidden = index !== 1;
    algorithms.hidden = index !== 2;
    replay.hidden = index !== 2;
    next.textContent = scene.action;
    next.removeAttribute('aria-disabled');
    stops.forEach((stop, position) => {
      if (position === index) stop.setAttribute('aria-current', 'step');
      else stop.removeAttribute('aria-current');
    });
    caption.textContent = index === 2 ? 'Ilustrasi penjadwalan' : view ? 'Diorama 3D' : 'Denah pusat data';
    if (announce) status.textContent = scene.title + '. ' + scene.description;
  }

  function finishTransition() {
    cancelAnimationFrame(frame);
    frame = 0;
    view?.draw(destination, destination, 1);
    showStep(destination, true);
  }

  function onMotionPreferenceChange(event) {
    if (!event.matches) return;
    if (entering) finishLabEntry();
    else if (frame) finishTransition();
  }

  function showLab() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(frame);
    view?.dispose();
    view = undefined;
    openLab(false);
  }

  function finishLabEntry() {
    if (closed && !entering) return;
    entering = false;
    cancelAnimationFrame(approachFrame);
    panel.hidden = true;
    panelAnimation?.cancel();
    reducedMotion.removeEventListener('change', onMotionPreferenceChange);
    showLab();
    lab.inert = false;
    labTitle.focus({ preventScroll: true });
  }

  async function animateLabEntry() {
    if (reducedMotion.matches || typeof panel.animate !== 'function') {
      finishLabEntry();
      return;
    }

    entering = true;
    next.setAttribute('aria-disabled', 'true');
    replay.disabled = true;
    status.textContent = 'Membuka lab.';
    panel.hidden = false;
    const duration = 450;
    // Leave the console visible on the right while the panel crosses the screen.
    const cover = panel.animate(
      [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }],
      { duration, easing: 'cubic-bezier(.68, 0, 1, 1)', fill: 'forwards' },
    );
    panelAnimation = cover;

    function approachConsole() {
      if (!view || cover.playState === 'finished') return;
      view.approach(cover.effect.getComputedTiming().progress ?? 0);
      approachFrame = requestAnimationFrame(approachConsole);
    }
    if (view) approachFrame = requestAnimationFrame(approachConsole);

    await cover.finished.catch(() => {});
    if (!entering) return;
    cancelAnimationFrame(approachFrame);
    lab.inert = true;
    showLab();

    panelAnimation = panel.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }],
      { duration, easing: 'cubic-bezier(0, 0, .32, 1)', fill: 'forwards' },
    );
    cover.cancel();
    await panelAnimation.finished.catch(() => {});
    if (entering) finishLabEntry();
  }

  next.addEventListener('click', () => {
    if (closed || entering || frame) return;
    if (step === scenes.length - 1) {
      animateLabEntry();
      return;
    }
    destination = step + 1;
    if (!view || reducedMotion.matches) {
      finishTransition();
      return;
    }

    next.setAttribute('aria-disabled', 'true');
    next.textContent = 'Operator sedang berjalan…';
    status.textContent = scenes[destination].walking;
    let started;
    function animate(now) {
      started ??= now;
      const progress = Math.min((now - started) / 3000, 1);
      if (progress === 1) {
        finishTransition();
        return;
      }
      view.draw(step, destination, progress);
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
  });

  replay.addEventListener('click', () => {
    if (closed || entering || frame) return;
    view?.draw(0, 0, 1);
    showStep(0, true);
    next.focus();
  });

  document.getElementById('intro-skip').addEventListener('click', finishLabEntry);
  reducedMotion.addEventListener('change', onMotionPreferenceChange);

  function useDiagram() {
    view?.dispose();
    view = undefined;
    diagram.hidden = false;
    if (frame) finishTransition();
    else if (!entering) showStep(step);
  }

  if ('WebGL2RenderingContext' in window) {
    import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js')
      .then((three) => {
        if (closed || entering) return;
        view = buildCloudDiorama(three, viewport, useDiagram);
        view.draw(step, step, 1);
        diagram.hidden = true;
        showStep(step);
      })
      .catch(() => {
        if (!closed) useDiagram();
      });
  }
}

function buildCloudDiorama(three, viewport, onContextLost) {
  const renderer = new three.WebGLRenderer({ antialias: true, alpha: false });
  const canvas = renderer.domElement;
  canvas.className = 'intro-canvas';
  renderer.setClearColor(0xebe7dc);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = three.PCFShadowMap;

  const scene = new three.Scene();
  const camera = new three.OrthographicCamera(-1, 1, 1, -1, 0.1, 80);
  scene.add(new three.HemisphereLight(0xfff8ed, 0x777566, 2));
  const sun = new three.DirectionalLight(0xfff2dd, 2.3);
  sun.position.set(-6, 13, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 10, bottom: -10, far: 35 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);

  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const cube = new three.BoxGeometry(1, 1, 1);
  geometries.add(cube);

  function material(color, options = {}) {
    const finish = new three.MeshStandardMaterial({ color, roughness: 0.85, ...options });
    materials.add(finish);
    return finish;
  }

  const graphite = material(0x323b36);
  const dark = material(0x181f1e);
  const metal = material(0x687780);
  const cream = material(0xe9e5d8);
  const olive = material(0x56684d);
  const oliveLight = material(0x819973);
  const railMfo = material(0x97452e);
  const railSca = material(0x315282);
  const tileMfo = material(0xe1764e);
  const tileSca = material(0x6492d9);

  function mesh(geometry, finish, parent, x, y, z) {
    const item = new three.Mesh(geometry, finish);
    item.position.set(x, y, z);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }

  function box(parent, finish, x, y, z, width, height, depth) {
    const item = mesh(cube, finish, parent, x, y, z);
    item.scale.set(width, height, depth);
    return item;
  }

  function group(parent, x, y, z) {
    const model = new three.Group();
    model.position.set(x, y, z);
    parent.add(model);
    return model;
  }

  function label(parent, text, x, y, z, width, background = '#29352e') {
    const surface = document.createElement('canvas');
    surface.width = 256;
    surface.height = 80;
    const paint = surface.getContext('2d');
    paint.fillStyle = background;
    paint.fillRect(0, 0, 256, 80);
    paint.fillStyle = '#fffaf0';
    paint.font = '700 36px monospace';
    paint.textAlign = 'center';
    paint.textBaseline = 'middle';
    paint.fillText(text, 128, 42);
    const texture = new three.CanvasTexture(surface);
    texture.colorSpace = three.SRGBColorSpace;
    textures.add(texture);
    const face = new three.MeshBasicMaterial({ map: texture, toneMapped: false });
    materials.add(face);
    const plane = new three.PlaneGeometry(width, width * 80 / 256);
    geometries.add(plane);
    const sign = mesh(plane, face, parent, x, y, z);
    sign.castShadow = false;
    sign.receiveShadow = false;
  }

  // Cutaway floor slab, with an aisle connecting the three stations.
  const slab = material(0x73796a);
  const floor = material(0xcac7b8);
  const aisle = material(0xaeb5a1);
  const foundation = box(scene, slab, 0, -0.38, 0, 14.5, 0.55, 7.5);
  foundation.castShadow = false;
  box(scene, floor, 0, -0.06, 0, 14.45, 0.13, 7.45);
  box(scene, aisle, 0, 0.018, 1.85, 12.8, 0.018, 1.05);
  for (let x = -6; x <= 6; x += 0.55) {
    box(scene, cream, x, 0.032, 2.12, 0.25, 0.012, 0.035).castShadow = false;
  }
  for (const x of [-3.45, 2.25]) {
    box(scene, slab, x, 0.012, -1.43, 0.025, 0.012, 4.05).castShadow = false;
  }
  box(scene, slab, 0, 0.11, -3.6, 14.35, 0.25, 0.18);
  box(scene, olive, -5.2, 0.16, 3.0, 2.1, 0.25, 0.7);
  for (const x of [-5.85, -4.55]) {
    box(scene, graphite, x, 1.26, 0.65, 0.23, 2.52, 0.45);
    box(scene, metal, x, 0.18, 0.65, 0.42, 0.32, 0.56);
  }
  box(scene, graphite, -5.2, 2.55, 0.65, 1.55, 0.34, 0.45);
  label(scene, 'MASUK', -5.2, 2.55, 0.886, 1.02);
  box(scene, oliveLight, -4.55, 1.43, 0.892, 0.07, 0.23, 0.035);
  box(scene, dark, -6.28, 0.51, -1.8, 0.93, 1.03, 0.9);
  box(scene, metal, -6.28, 1.06, -1.8, 0.94, 0.085, 0.9);
  for (let i = 0; i < 4; i++) {
    box(scene, cream, -6.28, 0.39 + i * 0.115, -1.336, 0.65, 0.028, 0.028);
  }

  // Each rack exposes its own state as the operator turns the VMs on.
  const lights = [];
  const rackFinish = material(0x394542);
  const diskFinish = material(0x46544f);
  const cableFinish = material(0xc49d67);
  for (const [i, x] of [-2.35, -0.85, 0.65].entries()) {
    const rack = group(scene, x, 0, -0.85);
    box(rack, graphite, 0, 0.06, 0, 1.32, 0.12, 1.4);
    box(rack, rackFinish, 0, 1.17, 0, 1.17, 2.14, 1.15);
    box(rack, dark, 0, 1.14, 0.586, 1.01, 1.82, 0.06);
    box(rack, metal, 0, 2.26, 0, 1.21, 0.08, 1.19);
    const led = material(0x626655, { emissive: 0x81bd4c, emissiveIntensity: 0 });
    lights.push(led);
    for (let row = 0; row < 5; row++) {
      const y = 0.4 + row * 0.3;
      box(rack, diskFinish, 0, y, 0.64, 0.93, 0.21, 0.085);
      box(rack, dark, -0.13, y, 0.693, 0.47, 0.052, 0.023);
      box(rack, led, 0.34, y, 0.697, 0.065, 0.065, 0.026);
    }
    label(rack, 'VM 0' + (i + 1), 0, 1.96, 0.675, 0.77);
    box(scene, cableFinish, x, 0.046, -2.48, 0.055, 0.075, 1.48);
  }
  box(scene, cableFinish, -0.85, 0.048, -3.17, 5.9, 0.08, 0.065);

  const schedulingTable = group(scene, 3.88, 0, -0.27);
  box(schedulingTable, graphite, 0, 0.48, 0, 3.4, 0.96, 1.88);
  box(schedulingTable, cream, 0, 1.02, 0, 3.55, 0.16, 2.05);
  box(schedulingTable, metal, 0, 1.19, -0.79, 3.42, 0.31, 0.27);
  const parcels = [];
  for (const [lane, z, finish, tile, name, ink] of [
    [0, -0.42, railMfo, tileMfo, 'DMFO-DE', '#87391f'],
    [1, 0.43, railSca, tileSca, 'SA-SCA', '#294980'],
  ]) {
    box(schedulingTable, finish, 0.26, 1.125, z, 2.2, 0.05, 0.41);
    box(schedulingTable, metal, -1.26, 1.22, z, 0.52, 0.26, 0.53);
    box(schedulingTable, dark, -1.26, 1.36, z, 0.48, 0.04, 0.49);
    label(schedulingTable, name, lane ? 0.8 : -0.62, 0.74, 0.958, 1.28, ink);
    for (let slot = 0; slot < 6; slot++) {
      const block = box(schedulingTable, tile, 0, 1.24, z, 0.21, 0.17, 0.24);
      parcels.push({ block, z, slot });
    }
  }
  box(scene, graphite, 6.14, 0.28, -2.6, 1.13, 0.55, 1.03);
  box(scene, metal, 6.14, 0.57, -2.6, 1.2, 0.1, 1.08);
  box(scene, olive, 6.14, 0.64, -2.6, 0.55, 0.08, 0.63);

  const operator = group(scene, 0, 0, 0);
  const body = group(operator, 0, 0, 0);
  const skin = material(0xb87954);
  const pants = material(0x465552);
  const helmet = material(0xf4ecda);
  const helmetShape = new three.SphereGeometry(0.28, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  geometries.add(helmetShape);
  box(body, olive, 0, 1.12, 0, 0.57, 0.62, 0.36);
  box(body, oliveLight, 0, 1.24, 0.193, 0.55, 0.08, 0.035);
  box(body, dark, 0, 0.83, 0, 0.55, 0.11, 0.38);
  box(body, metal, 0.19, 1.07, 0.217, 0.15, 0.19, 0.055);
  box(body, skin, 0, 1.63, 0.032, 0.39, 0.39, 0.37);
  box(body, dark, 0, 1.66, 0.224, 0.31, 0.078, 0.04);
  box(body, helmet, 0, 1.82, 0.082, 0.54, 0.063, 0.61);
  mesh(helmetShape, helmet, body, 0, 1.83, 0.02);
  const arms = [];
  const legs = [];
  for (const side of [-1, 1]) {
    const arm = group(body, 0.37 * side, 1.34, 0);
    box(arm, olive, 0, -0.2, 0, 0.16, 0.44, 0.19);
    box(arm, skin, 0, -0.47, 0, 0.14, 0.14, 0.15);
    arms.push(arm);
    const leg = group(body, 0.147 * side, 0.76, 0);
    box(leg, pants, 0, -0.32, 0, 0.22, 0.59, 0.24);
    box(leg, dark, 0, -0.66, 0.076, 0.23, 0.14, 0.36);
    legs.push(leg);
  }

  const positions = [
    { x: -5.17, z: 1.58, yaw: 0.48, cameraX: 0, halfWidth: 8.65 },
    { x: -0.76, z: 0.73, yaw: Math.PI - 0.44, cameraX: -0.63, halfWidth: 7.55 },
    { x: 2.61, z: 1.55, yaw: 2.5, cameraX: 1.35, halfWidth: 7.35 },
  ];
  const mix = (first, last, t) => first + (last - first) * t;
  const clamp = (value) => Math.min(Math.max(value, 0), 1);
  const ease = (value) => value * value * (3 - 2 * value);
  const cameraTarget = new three.Vector3();
  const onLost = (event) => {
    event.preventDefault();
    onContextLost();
  };
  let currentFrame = [0, 0, 1];
  let approachProgress;
  let aspect = 1.48;

  function renderCamera(targetX, halfWidth, offsetX, targetY = 0.55) {
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfWidth / aspect;
    camera.bottom = -halfWidth / aspect;
    camera.position.set(targetX + offsetX, 11.2, 16.8);
    cameraTarget.set(targetX, targetY, -0.05);
    camera.lookAt(cameraTarget);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  function approach(progress) {
    approachProgress = progress;
    const scheduling = positions[2];
    const zoom = ease(progress);
    renderCamera(
      mix(scheduling.cameraX, schedulingTable.position.x, zoom),
      mix(scheduling.halfWidth, 2.75, zoom),
      6.5,
      mix(0.55, 1.04, zoom),
    );
  }

  function draw(from, to, progress) {
    approachProgress = undefined;
    currentFrame = [from, to, progress];
    const start = positions[from];
    const end = positions[to];
    const walking = from !== to && progress < 0.66;
    const walkProgress = from === to ? 1 : clamp(progress / 0.66);
    const walk = ease(walkProgress);
    const swing = walking ? Math.sin(walkProgress * Math.PI * 11) * Math.sin(walkProgress * Math.PI) : 0;
    operator.position.set(mix(start.x, end.x, walk), 0, mix(start.z, end.z, walk));
    operator.rotation.y = walking
      ? mix(Math.atan2(end.x - start.x, end.z - start.z), end.yaw, ease(clamp((walkProgress - 0.72) / 0.28)))
      : end.yaw;
    body.position.y = Math.abs(swing) * 0.085;
    const reach = from !== to && to === 1 ? Math.sin(Math.PI * clamp((progress - 0.65) / 0.35)) : 0;
    arms[0].rotation.x = swing * 0.58 - reach * 1.55;
    arms[1].rotation.x = -swing * 0.58;
    legs[0].rotation.x = -swing * 0.67;
    legs[1].rotation.x = swing * 0.67;

    lights.forEach((led, index) => {
      const active = from >= 1 || (to === 1 && progress >= 0.72 + index * 0.08);
      led.color.setHex(active ? 0xb5d983 : 0x626655);
      led.emissiveIntensity = active ? 0.42 : 0;
    });
    parcels.forEach(({ block, z, slot }) => {
      const release = 0.66 + slot * 0.024;
      block.visible = to === 2 && progress >= release;
      const travel = ease(clamp((progress - release) / 0.2));
      block.position.x = mix(-1.04, 1.13 - slot * 0.31, travel);
      block.position.y = 1.24 + Math.sin(travel * Math.PI) * 0.12;
      block.position.z = z;
    });

    const cameraProgress = ease(progress);
    renderCamera(
      mix(start.cameraX, end.cameraX, cameraProgress),
      mix(start.halfWidth, end.halfWidth, cameraProgress),
      7.4 - cameraProgress * (to === 2 ? 0.9 : 0),
    );
  }

  function resize() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (!width || !height) return;
    aspect = width / height;
    renderer.setSize(width, height, false);
    if (approachProgress === undefined) draw(...currentFrame);
    else approach(approachProgress);
  }

  canvas.addEventListener('webglcontextlost', onLost);
  viewport.prepend(canvas);
  const observer = new ResizeObserver(resize);
  observer.observe(viewport);
  resize();

  return {
    draw,
    approach,
    dispose() {
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      textures.forEach((texture) => texture.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((finish) => finish.dispose());
      sun.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
