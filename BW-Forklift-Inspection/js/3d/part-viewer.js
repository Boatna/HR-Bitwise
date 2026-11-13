/* js/3d/part-viewer.js — กล่องแสดงชิ้นส่วน: รูปจริง/3D, lightbox, แมปไฟล์รูป */
function getForkliftModelType() {
  const m = CUR.forklift;
  if (!m) return CUR.elec ? 'electric' : 'diesel';
  const ki = typeInfo(m);
  if (ki.subtype === 'walkie_stacker' || ki.subtype === 'reach_truck') return ki.subtype;
  if (ki.group === 'electric') return 'electric';
  const raw = (String(m.model || '') + ' ' + ki.subtype).toLowerCase();
  return /petrol|gasoline|lpg|cng|gas|แก๊ส|แก๊ซ/.test(raw) ? 'petrol+LPG' : 'diesel';
}

const PART_IMAGES = {
  walkie_stacker: {
    batteryElec:   'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Distilled-water-level-battery.jpg',
    terminals:     'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Battery-terminal.jpg',
    chargePlug:    'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Charging-plug.jpg',
    bellyButton:   'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Anti-collision-button.jpg',
    emergencyStop: 'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Anti-collision-button.jpg',
    tiller:        'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Forward–reverse-control-button.jpg',
    tillerBrake:   'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Brake-system.jpg',
    mast:          'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Forks.jpg',
    chain:         'Electric-Walkie-stacker/Electric-Walkie-stacker-v.2/chain.jpg',
    wheel:         'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Wheels+Tires.jpg',
    hydTank:       'Electric-Walkie-stacker/Electric-Walkie-stacker-v.2/hydraulic-oil.jpg',
    hoses:         'Electric-Walkie-stacker/Electric-Walkie-stacker-v.2/hydraulic-hose.jpg',
    lights:        'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Signal lights+horn.jpg',
    brake:         'Electric-Walkie-stacker/Electric-Walkie-stacker-v.1/Brake-system.jpg'
  },
  reach_truck: {
    batteryElec: 'Electric-Reach-Truck/electric-battery-water.jpg',
    terminals:   'Electric-Reach-Truck/electric-battery-terminal.jpg',
    chargePlug:  'Electric-Reach-Truck/electric-charge-plug.jpg',
    mast:        'Electric-Reach-Truck/electric-mast-forks.jpg',
    chain:       'Electric-Reach-Truck/electric-chain.jpg',
    wheel:       'Electric-Reach-Truck/electric-wheel-tire.jpg',
    hydTank:     'Electric-Reach-Truck/electric-hydraulic-oil.jpg',
    hoses:       'Electric-Reach-Truck/electric-hydraulic-hose.jpg',
    lights:      'Electric-Reach-Truck/electric-lights-horn.jpg',
    brake:       'Electric-Reach-Truck/electric-brake.jpg'
  },
  electric: {
    batteryElec: 'Electric-Reach-Truck/electric-battery-water.jpg',
    terminals:   'Electric-Reach-Truck/electric-battery-terminal.jpg',
    chargePlug:  'Electric-Reach-Truck/electric-charge-plug.jpg',
    mast:        'Electric-Reach-Truck/electric-mast-forks.jpg',
    chain:       'Electric-Reach-Truck/electric-chain.jpg',
    wheel:       'Electric-Reach-Truck/electric-wheel-tire.jpg',
    hydTank:     'Electric-Reach-Truck/electric-hydraulic-oil.jpg',
    hoses:       'Electric-Reach-Truck/electric-hydraulic-hose.jpg',
    lights:      'Electric-Reach-Truck/electric-lights-horn.jpg',
    brake:       'Electric-Reach-Truck/electric-brake.jpg'
  },
  diesel: {
    engine:      'Forklift-diesel/Forklift-diesel-Engine-oil-level.jpg',
    coolant:     'Forklift-diesel/Forklift-diesel-Coolant-reservoir-level.jpg',
    battery:     'Forklift-diesel/Forklift-diesel-battery.jpg',
    hydTank:     'Forklift-diesel/Forklift-diesel-Hydraulic-oil-level.jpg',
    hoses:       'Forklift-diesel/Forklift-diesel-Condition-of-the-hydraulic-hose.jpg',
    mast:        'Forklift-diesel/Forklift-diesel-Mast-and-forks.jpg',
    chain:       'Forklift-diesel/Forklift-diesel-Chain-condition.jpg',
    brakeFluid:  'Forklift-diesel/Forklift-diesel-Brake-and-clutch-fluid-level.jpg',
    brake:       'Forklift-diesel/Forklift-diesel-Brake-system.jpg',
    wheel:       'Forklift-diesel/Forklift-diesel-Condition-of-wheels-and-tires.jpg',
    steering:    'Forklift-diesel/Forklift-diesel-steering-wheel.jpg',
    lights:      'Forklift-diesel/Forklift-diesel-Signal-lights-and-horn.jpg',
    mirror:      'Forklift-diesel/Forklift-diesel-Side-view-mirror.jpg',
    seatbelt:    'Forklift-diesel/Forklift-diesel-Seat-belt.jpg'
  },
  'petrol+LPG': {
    engine:      'Forklift-petrol+LPG/Forklift-petrol+LPG-Engine-oil-level.jpg',
    coolant:     'Forklift-petrol+LPG/Forklift-petrol+LPG-Coolant-reservoir-level.jpg',
    battery:     'Forklift-petrol+LPG/Forklift-petrol+LPG-battery.jpg',
    hydTank:     'Forklift-petrol+LPG/Forklift-petrol+LPG-Hydraulic-oil-level.jpg',
    hoses:       'Forklift-petrol+LPG/Forklift-petrol+LPG-Condition-of-the-hydraulic-hose.jpg',
    mast:        'Forklift-petrol+LPG/Forklift-petrol+LPG-Mast-and-forks.jpg',
    chain:       'Forklift-petrol+LPG/Forklift-petrol+LPG-Chain-condition.jpg',
    brakeFluid:  'Forklift-petrol+LPG/Forklift-petrol+LPG-Brake-and-clutch-fluid-level.jpg',
    brake:       'Forklift-petrol+LPG/Forklift-petrol+LPG-Brake-system.jpg',
    wheel:       'Forklift-petrol+LPG/Forklift-petrol+LPG-Wheels-and-tires.jpg',
    steering:    'Forklift-petrol+LPG/Forklift-petrol+LPG-steering-wheel.jpg',
    lights:      'Forklift-petrol+LPG/Forklift-petrol+LPG-Signal-and-horn.jpg',
    mirror:      'Forklift-petrol+LPG/Forklift-petrol+LPG-Side-view-mirror.jpg',
    seatbelt:    'Forklift-petrol+LPG/Forklift-petrol+LPG-Seat-belt.jpg',
    gasTank:     'Forklift-petrol+LPG/Forklift-petrol+LPG-Gas.jpg',
    gasSecuring: 'Forklift-petrol+LPG/Forklift-petrol+LPG-Securing-gas.jpg',
    gasPipeline: 'Forklift-petrol+LPG/Forklift-petrol+LPG-Gas-pipeline.jpg',
    gasFittings: 'Forklift-petrol+LPG/Gas-fittings-and-connection.jpg',
    gasLeak:     'Forklift-petrol+LPG/Forklift-petrol+LPG-Gas-leakage.jpg',
    gasGauge:    'Forklift-petrol+LPG/Forklift-petrol+LPG-Gas-level-gauge.jpg'
  }
};

const imageFolderFor = t => {
  if (t === 'walkie_stacker') return 'Electric-Walkie-stacker';
  if (t === 'reach_truck' || t === 'electric') return 'Electric-Reach-Truck';
  if (t === 'petrol+LPG') return 'Forklift-petrol+LPG';
  return 'Forklift-diesel';
};

function partImageCandidates(it, key) {
  const modelType = getForkliftModelType();
  const folder = imageFolderFor(modelType);
  const typeMap = PART_IMAGES[modelType] || PART_IMAGES.electric;
  const out = [];
  const add = p => {
    if (!p) return;
    const u = (/^(https?:|data:)/i.test(p)) ? p : (p.startsWith(ASSET_DIR) ? p : ASSET_DIR + p);
    if (!out.includes(u)) out.push(u);
  };

  if (typeMap && typeMap[key]) {
    add(typeMap[key]);
  }

  if (it && it.img) {
    const raw = String(it.img).trim();
    if (raw) {
      if (/^(https?:|data:)/i.test(raw)) add(raw);
      else {
        const rel = raw.startsWith(ASSET_DIR) ? raw.slice(ASSET_DIR.length) : raw;
        add(rel);
        if (rel.includes('/')) {
          const parts = rel.split('/'), name = parts.slice(1).join('/');
          add(folder + '/' + name);
          if (folder === 'electric' && !name.startsWith('electric-')) add('electric/electric-' + name);
        } else {
          add(folder + '/' + rel);
          if (folder === 'electric' && !rel.startsWith('electric-')) add('electric/electric-' + rel);
        }
      }
    }
  }

  return out;
}

function showPartViewer(idx) {
  const nameEl = $('partName');
  if (!nameEl) return;
  const it = getCurItems()[idx];
  if (!it) return;
  nameEl.textContent = (idx + 1) + '. ' + _tr(it.point);
  if ($('partCat')) $('partCat').textContent = _tr(it.cat || '');
  PV.item = it;
  applyPartMode();
}

function applyPartMode() {
  const it = PV.item;
  const img = $('partImg'), ph = $('partPlaceholder'), cv = $('cvPart');
  if (!it || !img || !ph) return;
  const is3d = PV.mode === '3d';

  if ($('btnPartMode')) $('btnPartMode').textContent = _t(is3d ? 'btnPhoto' : 'btn3d');
  if ($('partModeLabel')) $('partModeLabel').textContent = _t(is3d ? 'mode3d' : 'modePhoto');
  if ($('partHint')) $('partHint').textContent = is3d
    ? _t('hint3d')
    : _t('hintTap');

  if (is3d) {
    img.classList.add('hide');
    ph.classList.add('hide');
    PV.tok++;
    if (cv && initPV()) {
      cv.classList.remove('hide');
      build3DPart(it);
    } else {
      if (cv) cv.classList.add('hide');
      $('partPhText').textContent = _t('ph3dFail');
      ph.classList.remove('hide');
    }
    return;
  }

  if (cv) cv.classList.add('hide');
  const typeFolder = imageFolderFor(getForkliftModelType());
  const cands = partImageCandidates(it, partKeyFor(it, CUR.elec));
  PV.src = '';

  const showPh = msg => {
    img.classList.add('hide');
    ph.classList.remove('hide');
    $('partPhText').textContent = msg;
    PV.src = '';
  };

  if (!cands.length) {
    img.removeAttribute('src');
    showPh(_t('phHint', { folder: typeFolder }));
    return;
  }

  const tok = PV.tok = PV.tok + 1;
  const tryLoad = i => {
    const url = cands[i];
    const pre = new Image();
    pre.onload = () => {
      if (tok !== PV.tok) return;
      img.src = url;
      img.alt = it.point;
      ph.classList.add('hide');
      img.classList.remove('hide');
      PV.src = url;
    };
    pre.onerror = () => {
      if (tok !== PV.tok) return;
      if (i + 1 < cands.length) tryLoad(i + 1);
      else showPh(_t('phNoFile') + (cands[0].length > 80 ? cands[0].slice(0, 60) + '…' : cands[0]));
    };
    pre.src = url;
  };
  tryLoad(0);
}

function togglePartMode() {
  PV.mode = PV.mode === '3d' ? 'photo' : '3d';
  try { localStorage.setItem('fl_part_mode', PV.mode); } catch (e) {}
  if (PV.hidden) togglePartBox();
  applyPartMode();
}

function initPV() {
  if (PV.inited) return true;
  try {
    if (!window.THREE) return false;
    const cv = $('cvPart');
    if (!cv) return false;
    PV.st = makeStage(cv, 3);
    PV.st.sun.position.set(3, 6, 4);
    PV.st.camera.fov = 34;
    PV.st.camera.updateProjectionMatrix();

    cv.addEventListener('pointerdown', e => {
      PV.drag = { x: e.clientX, y: e.clientY };
      PV.auto = false;
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      if (!PV.drag) return;
      PV.rotY -= (e.clientX - PV.drag.x) * 0.012;
      PV.rotX = Math.max(-0.15, Math.min(1.25, PV.rotX + (e.clientY - PV.drag.y) * 0.01));
      PV.drag.x = e.clientX;
      PV.drag.y = e.clientY;
    });
    const end = () => { PV.drag = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('dblclick', () => { PV.auto = true; PV.zoom = 5.2; PV.rotX = 0.35; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      PV.zoom = Math.max(3, Math.min(8, PV.zoom + (e.deltaY > 0 ? 0.4 : -0.4)));
    }, { passive: false });

    PV.inited = true;
    return true;
  } catch (err) {
    console.warn('Part viewer skipped:', err);
    return false;
  }
}

function build3DPart(it) {
  const isElec = isCurElectric();
  BODY_C = isElec ? 0xd23f0a : 0xf28200;
  const key = partKeyFor(it, isElec);
  const def = PART_DEFS[key] || PART_DEFS.generic;

  if (PV.pivot) { PV.st.scene.remove(PV.pivot); disposeObj(PV.pivot); }
  const part = def.build(true, { elec: isElec, subtype: CUR.forklift ? model3dOf(CUR.forklift) : '' });
  const box = new THREE.Box3().setFromObject(part);
  const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const s = 2.0 / Math.max(size.x, size.y, size.z, 0.001);
  part.scale.setScalar(s);
  part.position.set(-ctr.x * s, -ctr.y * s, -ctr.z * s);

  const pivot = new THREE.Group();
  pivot.add(part);
  const floorY = -(size.y * s) / 2 - 0.04;
  put(pivot, new THREE.CylinderGeometry(1.68, 1.76, 0.07, 64), M(0x94a3b8, { roughness: 0.25, metalness: 0.85 }), 0, floorY - 0.05, 0);
  put(pivot, new THREE.CylinderGeometry(1.58, 1.62, 0.04, 64), M(0x1e293b, { roughness: 0.7, metalness: 0.3 }), 0, floorY - 0.01, 0);
  put(pivot, new THREE.TorusGeometry(1.56, 0.016, 12, 72), warningYellow(), 0, floorY + 0.005, 0, PI / 2);
  put(pivot, new THREE.TorusGeometry(1.0, 0.008, 8, 64), M(0x475569, { roughness: 0.5 }), 0, floorY + 0.004, 0, PI / 2);
  put(pivot, new THREE.TorusGeometry(0.5, 0.008, 8, 48), M(0x475569, { roughness: 0.5 }), 0, floorY + 0.004, 0, PI / 2);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * PI * 2;
    const isMajor = k % 3 === 0;
    const tickLen = isMajor ? 0.22 : 0.12;
    const rMid = 1.44 - tickLen / 2;
    BX(pivot, 0.014, 0.004, tickLen, isMajor ? warningYellow() : M(0x64748b), Math.sin(a) * rMid, floorY + 0.006, Math.cos(a) * rMid, 0, a, 0);
  }
  shadowize(pivot);
  PV.st.scene.add(pivot);
  PV.pivot = pivot;
  PV.auto = true;
  PV.st.sun.target = pivot;
}

function renderPartStage() {
  if (PV.mode !== '3d' || !PV.inited || !PV.pivot) return;
  const cv = $('cvPart');
  if (!cv || !cv.offsetParent || !fitStage(PV.st, cv)) return;
  if (PV.auto) PV.rotY += 0.009;
  const cam = PV.st.camera;
  const Z = PV.zoom * Math.min(1.6, Math.max(1, 1.25 / cam.aspect));
  cam.position.set(Math.sin(PV.rotY) * Math.cos(PV.rotX) * Z, Math.sin(PV.rotX) * Z, Math.cos(PV.rotY) * Math.cos(PV.rotX) * Z);
  cam.lookAt(0, 0, 0);
  PV.st.renderer.render(PV.st.scene, cam);
}

function openPartImage() {
  if (!PV.src) return;
  $('imgModalPic').src = PV.src;
  $('imgModalCap').textContent = $('partName').textContent;
  $('imgModal').classList.remove('hide');
}

function closePartImage() {
  $('imgModal').classList.add('hide');
}

function togglePartBox() {
  PV.hidden = !PV.hidden;
  $('partStage').classList.toggle('hide', PV.hidden);
  $('btnPartToggle').textContent = _t(PV.hidden ? 'show' : 'hide');
}
