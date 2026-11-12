/* js/3d/stage.js — 3D: สภาพแวดล้อม, renderer, แสง, glow, ป้ายเลขจุดตรวจ */
function makeEnvScene() {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(40, 32, 16), pos = geo.attributes.position, col = [];
  const top = new THREE.Color(0xeaf2fa), mid = new THREE.Color(0xb7c3cf), bot = new THREE.Color(0x4a545e), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 40;
    if (t > 0) c.copy(mid).lerp(top, Math.pow(t, 0.6)); else c.copy(mid).lerp(bot, Math.min(1, -t * 1.6));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const lamp = (w, h, x, y, z, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  lamp(18, 8, 14, 22, 10, 5); lamp(10, 10, -22, 12, -6, 2.5); lamp(24, 4, 0, 10, -24, 2);
  return s;
}

function makeStage(canvas, shadowR) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  let hasEnv = false;
  try {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(makeEnvScene(), 0.02).texture;
    pm.dispose();
    hasEnv = true;
  } catch (e) { console.warn('env map skipped', e); }
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8c98a4, hasEnv ? 0.28 : 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, hasEnv ? 0.75 : 0.85);
  sun.position.set(6, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -shadowR; sc.right = shadowR; sc.top = shadowR; sc.bottom = -shadowR; sc.near = 1; sc.far = 40;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  const fill = new THREE.DirectionalLight(0xdbeafe, hasEnv ? 0.3 : 0.4);
  fill.position.set(-8, 5, -5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xfef3c7, hasEnv ? 0.35 : 0.5);
  rim.position.set(0, 8, -9);
  scene.add(rim);
  scene.add(sun);
  return { renderer, scene, camera, sun };
}

function fitStage(st, canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return false;
  const pr = st.renderer.getPixelRatio();
  if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) {
    st.renderer.setSize(w, h, false);
    st.camera.aspect = w / h;
    st.camera.updateProjectionMatrix();
  }
  return true;
}

function shadowize(root) {
  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = !(o.material && o.material.transparent);
      o.receiveShadow = true;
    }
  });
}

function setGlow(group, on) {
  group.traverse(o => {
    if (o.isMesh && o.material && o.material.emissive) {
      const m = o.material;
      if (on) { m.emissive.setHex(0xf08a1c); m.emissiveIntensity = 0.5; }
      else { m.emissive.setHex(m.userData.e0 || 0); m.emissiveIntensity = m.userData.i0 == null ? 1 : m.userData.i0; }
    }
  });
}

function pulseGlow(group, k) {
  group.traverse(o => {
    if (o.isMesh && o.material && o.material.emissive) {
      o.material.emissive.setHex(0xff9a1f);
      o.material.emissiveIntensity = 0.1 + k * 1.3;
    }
  });
}

const badgeCache = {};
function numberBadgeTexture(num, isSelected) {
  const key = num + (isSelected ? 's' : 'n');
  if (badgeCache[key]) return badgeCache[key];
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fillStyle = isSelected ? '#f59e0b' : '#1e3a8a';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = isSelected ? '#0f2438' : '#ffffff';
  ctx.font = 'bold 32px Kanit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(num, 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  badgeCache[key] = tex;
  return tex;
}
