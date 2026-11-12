/* js/3d/viewer-main.js — 3D: ตัวแสดงโมเดลหลัก (หมุน/ซูม/คลิกเลือกจุด) */
function init3D() {
  if (V3.inited) return true;
  try {
    if (!window.THREE) return false;
    const canvas = $('cv');
    if (!canvas) return false;
    V3.st = makeStage(canvas, 9);
    const scene = V3.st.scene;

    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ color: 0xe3ecf7, roughness: 0.92, metalness: 0 }));
    floor.rotation.x = -PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(8.4, 8.6, 64), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    ring.rotation.x = -PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);
    const grid = new THREE.GridHelper(16, 16, 0xb5c1cc, 0xcdd6de);
    grid.position.y = 0.012;
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    scene.add(grid);

    V3.target = new THREE.Vector3(0, 1.8, 0);
    V3.tgoal = V3.target.clone();

    canvas.addEventListener('pointerdown', e => {
      V3.drag = { x: e.clientX, y: e.clientY, moved: 0 };
      V3.autoRotate = false;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (!V3.drag) return;
      const dx = e.clientX - V3.drag.x, dy = e.clientY - V3.drag.y;
      V3.drag.x = e.clientX; V3.drag.y = e.clientY;
      V3.drag.moved += Math.abs(dx) + Math.abs(dy);
      V3.theta -= dx * 0.01;
      V3.phi = Math.max(0.2, Math.min(1.5, V3.phi - dy * 0.01));
    });
    canvas.addEventListener('pointerup', e => {
      if (V3.drag && V3.drag.moved < 6) pick3DPart(e);
      V3.drag = null;
    });
    canvas.addEventListener('pointercancel', () => { V3.drag = null; });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      v3zoom(e.deltaY > 0 ? 1.2 : -1.2);
    }, { passive: false });

    V3.inited = true;
    requestAnimationFrame(loop3D);
    return true;
  } catch (err) {
    console.warn('3D initialization skipped:', err);
    return false;
  }
}

function loop3D() {
  requestAnimationFrame(loop3D);
  if (document.hidden) return;
  renderMain();
  renderPartStage();
}

function renderMain() {
  if (!V3.inited) return;
  const canvas = $('cv');
  if (!canvas || !canvas.offsetParent || !fitStage(V3.st, canvas)) return;
  if (V3.autoRotate) V3.theta += 0.004;
  V3.target.lerp(V3.tgoal, 0.08);
  const t = V3.target, cam = V3.st.camera;
  const D = V3.dist * Math.min(1.7, Math.max(1, 1.5 / cam.aspect));
  cam.position.set(
    t.x + D * Math.sin(V3.phi) * Math.sin(V3.theta),
    t.y + D * Math.cos(V3.phi),
    t.z + D * Math.sin(V3.phi) * Math.cos(V3.theta)
  );
  cam.lookAt(t);
  const sp = V3.parts[V3.selectedPart];
  if (sp) {
    const k = 0.5 + 0.5 * Math.sin(performance.now() / 120);
    if (sp.group) pulseGlow(sp.group, k);
    if (sp.sprite) { const s = 0.38 + 0.14 * k; sp.sprite.scale.set(s, s, s); }
  }
  V3.st.renderer.render(V3.st.scene, cam);
}

function toggleV3Labels() {
  V3.showLabels = !V3.showLabels;
  V3.parts.forEach(p => { if (p.sprite) p.sprite.visible = V3.showLabels; });
  const b = $('btnLabels');
  if (b) b.textContent = _t(V3.showLabels ? 'hideNum' : 'showNum');
}

function v3zoom(d) {
  V3.dist = Math.max(5, Math.min(22, V3.dist + d));
}

function v3reset() {
  V3.theta = 0.72;
  V3.phi = 1.12;
  V3.dist = 11.2;
  V3.autoRotate = true;
  sel3DPart(-1);
}

function pick3DPart(e) {
  if (!V3.inited || !V3.root) return;
  const rect = $('cv').getBoundingClientRect();
  const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(mouse, V3.st.camera);
  const hits = ray.intersectObjects(V3.root.children, true).filter(x => x.object.userData && x.object.userData.partIdx != null && x.object.visible);
  const hit = hits.find(x => x.object.isSprite) || hits[0];
  if (hit) selectInspectionPoint(hit.object.userData.partIdx);
}

function sel3DPart(idx) {
  V3.selectedPart = idx;
  const cp = V3.parts[idx];
  const hideCover = !!(cp && V3.internal && V3.internal.has(cp.key));
  (V3.covers || []).forEach(c => { c.visible = !hideCover; });
  V3.parts.forEach((p, k) => {
    const on = k === idx;
    if (p.group) setGlow(p.group, on);
    if (p.sprite) {
      if (!on) p.sprite.scale.set(0.38, 0.38, 0.38);
      p.sprite.material.map = numberBadgeTexture(k + 1, on);
      p.sprite.material.needsUpdate = true;
    }
  });
  if (V3.tgoal) {
    if (idx >= 0 && V3.parts[idx]) { V3.tgoal.copy(V3.parts[idx].center); V3.autoRotate = false; }
    else V3.tgoal.set(0, 1.8, 0);
  }
}

function renderForklift3D(m, isElec) {
  if (!init3D()) return;
  if (V3.root) { V3.st.scene.remove(V3.root); disposeObj(V3.root); }
  V3.root = new THREE.Group();
  V3.st.scene.add(V3.root);
  V3.parts = [];
  const sub = m ? model3dOf(m) : 'diesel';
  const modelMeta = forklift3DMeta(m);
  BODY_C = modelMeta.color;

  const modelInfo = $('v3ModelInfo');
  if (modelInfo) {
    modelInfo.innerHTML =
      `<div class="v3-model-family">${esc(modelMeta.family)}</div>` +
      `<strong>${esc(modelMeta.title)}</strong>` +
      `<span>${esc(modelMeta.thai)}</span>` +
      `<small>${esc(modelMeta.detail)}</small>`;
    modelInfo.dataset.model = sub;
  }
  const items = getCurItems();
  const keys = items.map(it => partKeyFor(it, isElec));
  const has = new Set(keys);

  const base = new THREE.Group();
  buildBase(base, isElec, false, sub, has);
  V3.root.add(base);
  V3.covers = [];
  base.traverse(o => { if (o.userData && o.userData.cover) V3.covers.push(o); });
  V3.internal = internalKeys(isElec, sub);

  const placed = {};
  items.forEach((it, idx) => {
    const key = keys[idx];
    let g = placed[key];
    if (!g) {
      g = placePart(V3.root, key, isElec, sub);
      placed[key] = g;
    }
    V3.parts.push({ group: g, key, sprite: null, center: new THREE.Vector3(), idx });
  });

  shadowize(V3.root);
  V3.root.updateMatrixWorld(true);
  V3.root.traverse(o => { if (o.isMesh) o.userData.partIdx = null; });
  V3.parts.forEach((p, idx) => {
    p.group.traverse(o => { if (o.isMesh && o.userData.partIdx == null) o.userData.partIdx = idx; });
    const box = new THREE.Box3().setFromObject(p.group);
    box.getCenter(p.center);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: numberBadgeTexture(idx + 1, idx === curFocusIdx), depthTest: false, toneMapped: false }));
    sprite.position.set(p.center.x, Math.min(box.max.y, p.center.y + 0.6) + 0.1, p.center.z);
    sprite.scale.set(0.38, 0.38, 0.38);
    sprite.visible = V3.showLabels;
    sprite.renderOrder = 99;
    sprite.userData.partIdx = idx;
    V3.root.add(sprite);
    p.sprite = sprite;
  });

  sel3DPart(curFocusIdx);
  showPartViewer(curFocusIdx);
}
