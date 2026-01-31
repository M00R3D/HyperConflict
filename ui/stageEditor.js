// ui/stageEditor.js
// Minimal stage editor: load frames from a .piskel, place/remove items, export/load lists.
// Exports a small API expected by core/main.js.

import { loadPiskel } from '../core/loader.js';

let active = false;
let frames = [];           // array of p5.Image frames (one per static item)
let currentFrame = 0;
let items = [];            // placed items: { x, y, frameIndex }
let loaded = false;
const DEFAULT_PISKEL = 'src/stages/static_items/static_items_biome_plains.piskel';

// helper: defensive copy
function clone(v) { return JSON.parse(JSON.stringify(v)); }

// Load frames from a .piskel (path optional)
export async function initStageEditor(piskelPath = DEFAULT_PISKEL) {
  try {
    const layers = await loadPiskel(piskelPath).catch(()=>[]);
    const layer0 = Array.isArray(layers) && layers.length > 0 ? layers[0] : [];
    // Normalize: ensure each entry in frames is a single p5.Image (not an array)
    frames = Array.isArray(layer0)
      ? layer0.filter(Boolean).map(f => Array.isArray(f) ? (f[0] || null) : f)
      : [];
    currentFrame = 0;
    loaded = true;
    console.log('[StageEditor] frames loaded:', frames.length);
  } catch (e) {
    console.warn('[StageEditor] init failed', e);
    frames = [];
    loaded = true;
  }

  return true;
}

export function toggleStageEditor() { active = !active; return active; }
export function isStageEditorActive() { return !!active; }
export function setStageEditorActive(bool) { active = !!bool; }

// Convert screen <-> world using the same camera math used elsewhere
function _camYOffset(zoom) { return map(zoom||1, 0.6, 1.5, 80, 20); }
export function worldToScreen(wx, wy, cam = { x:0, y:0, zoom:1 }) {
  const z = cam.zoom || 1;
  const camYOffset = _camYOffset(z);
  const sx = ((wx - (cam.x || 0)) * z) + width/2;
  const sy = ((wy - (cam.y || 0)) * z) + height/2 + camYOffset;
  return { sx, sy };
}
export function screenToWorld(sx, sy, cam = { x:0, y:0, zoom:1 }) {
  const z = cam.zoom || 1;
  const camYOffset = _camYOffset(z);
  const wx = ((sx - width/2) / z) + (cam.x || 0);
  const wy = ((sy - (height/2 + camYOffset)) / z) + (cam.y || 0);
  return { wx, wy };
}

// Place / remove
export function placeItemAtWorld(wx, wy, frameIdx = currentFrame) {
  items.push({ x: Math.round(wx), y: Math.round(wy), frameIndex: Math.max(0, Math.min((frames.length-1)||0, Math.floor(Number(frameIdx||0)))) });
}
export function removeNearest(wx, wy, maxDist = 28) {
  if (!items.length) return false;
  let best = -1, bestDist = Infinity;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const dx = it.x - wx, dy = it.y - wy;
    const d = Math.hypot(dx, dy);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  if (best !== -1 && bestDist <= maxDist) {
    items.splice(best, 1);
    return true;
  }
  return false;
}

// Input handlers (call from main's pointer events or use window.canvas binding)
export function handleMousePressed(e, cam = { x:0, y:0, zoom:1 }) {
  if (!active) return;
  // determine canvas-relative coords
  let sx = null, sy = null;
  try {
    const canvas = document.querySelector('canvas');
    if (canvas && typeof e.clientX === 'number') {
      const rect = canvas.getBoundingClientRect();
      sx = e.clientX - rect.left;
      sy = e.clientY - rect.top;
    }
  } catch (err) { /* fallback */ }
  if (sx == null || sy == null) { sx = typeof mouseX === 'number' ? mouseX : width/2; sy = typeof mouseY === 'number' ? mouseY : height/2; }

  const btn = (typeof e.button === 'number') ? e.button : 0;
  const { wx, wy } = screenToWorld(sx, sy, cam || { x:0,y:0,zoom:1 });

  if (btn === 0) placeItemAtWorld(wx, wy, currentFrame);
  else if (btn === 2) removeNearest(wx, wy, 32);
}

export function handleWheel(deltaY, cam = { x:0, y:0, zoom:1 }) {
  if (!active || !frames.length) return;
  if (deltaY > 0) currentFrame = (currentFrame - 1 + frames.length) % frames.length;
  else currentFrame = (currentFrame + 1) % frames.length;
}

// Drawing: editor overlay (call from main draw when in scene)
// Balanced push()/pop() and minimal p5 state changes
export function drawStageEditor(cam = { x:0, y:0, zoom:1 }) {
  if (!active) return;
  push();
  // dim background
  noStroke();
  fill(0, 0, 0, 140);
  rect(0, 0, width, height);

  // grid
  stroke(40, 30);
  strokeWeight(1);
  const grid = 32;
  for (let gx = 0; gx < width; gx += grid) line(gx, 0, gx, height);
  for (let gy = 0; gy < height; gy += grid) line(0, gy, width, gy);
  noStroke();

  // apply camera transform to draw world items
  push();
  const z = cam.zoom || 1;
  const camYOffset = _camYOffset(z);
  translate(width/2, height/2 + camYOffset);
  scale(z);
  translate(-(cam.x||0), -(cam.y||0));

  // draw placed items
  imageMode(CENTER);
  noSmooth();
  for (const it of items) {
    let desc = frames[it.frameIndex];
    if (Array.isArray(desc)) desc = desc[0];
    if (!desc) continue;
    push();
    translate(Math.round(it.x), Math.round(it.y));
    try {
      const img = desc;
      const cols = Math.max(1, Math.round(img.width / img.height));
      const sw = Math.floor(img.width / cols);
      const idx = it.frameIndex % cols;
      const srcX = idx * sw;
      image(img, 0, 0, 28, 28, srcX, 0, sw, img.height);
    } catch (e) {
      noStroke(); fill(200,120); rect(-14,-14,28,28);
    }
    pop();
  }

  // preview at mouse (world coords)
  const sx = typeof mouseX === 'number' ? mouseX : width/2;
  const sy = typeof mouseY === 'number' ? mouseY : height/2;
  const { wx: mWx, wy: mWy } = screenToWorld(sx, sy, cam);
  push();
  translate(Math.round(mWx), Math.round(mWy));
  imageMode(CENTER);
  noSmooth();
  if (frames.length > 0) {
    let previewDesc = frames[currentFrame];
    if (Array.isArray(previewDesc)) previewDesc = previewDesc[0];
    tint(255, 200);
    try {
      if (previewDesc) {
        const cols = Math.max(1, Math.round(previewDesc.width / previewDesc.height));
        const sw = Math.floor(previewDesc.width / cols);
        const idx = currentFrame % cols;
        const srcX = idx * sw;
        image(previewDesc, 0, 0, 28, 28, srcX, 0, sw, previewDesc.height);
      }
      else fill(255,140), rect(-14,-14,28,28);
    } catch (e) {
      fill(255,140); rect(-14,-14,28,28);
    }
    noTint();
  } else {
    fill(255, 120); rect(-14,-14,28,28);
  }
  stroke(255, 160); strokeWeight(1);
  line(-12, 0, 12, 0); line(0, -12, 0, 12);
  pop();

  pop(); // pop camera transform

  // small top-right panel info
  push();
  rectMode(CORNER);
  imageMode(CORNER);
  fill(20, 28, 36, 220); stroke(255, 18);
  const pw = 240, ph = 80, px = width - pw - 12, py = 12;
  rect(px, py, pw, ph, 8);
  noStroke();
  fill(230);
  textSize(12);
  textAlign(LEFT, TOP);
  text(`Stage editor — frames: ${frames.length}`, px + 12, py + 8);
  text(`Frame: ${currentFrame}`, px + 12, py + 26);
  text(`LMB: place  ·  RMB: remove  ·  Wheel: change`, px + 12, py + 44);
  pop();

  pop(); // outer
}

// drawSavedItems: used by main to draw items during gameplay (cam already applied by caller)
export function drawSavedItems(cam = { x:0, y:0, zoom:1 }) {
  if (!frames.length || !items.length) return;
  push();
  imageMode(CENTER);
  noSmooth();
  for (const it of items) {
    let desc = frames[it.frameIndex];
    if (Array.isArray(desc)) desc = desc[0];
    if (!desc) continue;
    push();
    translate(Math.round(it.x), Math.round(it.y));
    try {
      const img = desc;
      const cols = Math.max(1, Math.round(img.width / img.height));
      const sw = Math.floor(img.width / cols);
      const idx = (it.frameIndex || 0) % cols;
      const srcX = idx * sw;
      image(img, 0, 0, 28, 28, srcX, 0, sw, img.height);
    } catch (e) {
      noStroke(); fill(200,120); rect(-14,-14,28,28);
    }
    pop();
  }
  noTint();
  smooth();
  pop();
}

// Export / import helpers
export function exportItems() {
  try { return items.map(it => ({ x: Number(it.x||0), y: Number(it.y||0), frameIndex: Number(it.frameIndex||0) })); }
  catch (e) { return []; }
}
export function getExportJS(name = 'STAGE_ITEMS', format = 'esm') {
  const arr = exportItems();
  const json = JSON.stringify(arr, null, 2);
  if (format === 'cjs') return `module.exports.${name} = ${json};`;
  if (format === 'raw') return json;
  return `export const ${name} = ${json};`;
}
export function openExportWindow(format = 'esm', name = 'STAGE_ITEMS') {
  if (typeof window === 'undefined') return null;
  const text = getExportJS(name, format);
  const w = window.open('', '_blank');
  if (!w) return null;
  w.document.title = 'Stage Export';
  const pre = `<pre style="white-space:pre-wrap;word-break:break-all;">${text.replace(/</g,'&lt;')}</pre>`;
  w.document.body.innerHTML = pre;
  return w;
}

export function loadStageItems(jsonOrArray) {
  try {
    const arr = (typeof jsonOrArray === 'string') ? JSON.parse(jsonOrArray) : jsonOrArray;
    if (!Array.isArray(arr)) throw new Error('expected array');
    items = arr.map(it => ({ x: Number(it.x||0), y: Number(it.y||0), frameIndex: Math.max(0, Math.min((frames.length-1)||0, Number(it.frameIndex||0))) }));
    console.log('[StageEditor] loaded items:', items.length);
    return true;
  } catch (e) {
    console.warn('[StageEditor] loadStageItems failed', e);
    return false;
  }
}

// Lightweight saved stages API (plain localStorage)
const SAVED_KEY = 'hyperconf_stages_v1';
export function getSavedStages() {
  try { const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(SAVED_KEY) : null; return raw ? JSON.parse(raw) : []; }
  catch (e) { return []; }
}
export function saveNamedStage(name) {
  if (!name) throw new Error('name required');
  const rec = { name: String(name), json: JSON.stringify(items || []), ts: Date.now() };
  const list = getSavedStages();
  const idx = list.findIndex(r => r.name === rec.name);
  if (idx >= 0) list.splice(idx, 1, rec); else list.push(rec);
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(SAVED_KEY, JSON.stringify(list)); } catch(e) {}
  return rec;
}
export function deleteNamedStage(name) {
  try {
    const next = getSavedStages().filter(r => r.name !== name);
    if (typeof localStorage !== 'undefined') localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    return true;
  } catch (e) { return false; }
}

// StageCode helpers (compact base64 wrapper)
export function generateStageCode() {
  try {
    const arr = exportItems();
    const json = JSON.stringify(arr);
    const payload = btoa(unescape(encodeURIComponent(json)));
    return `STAGECODE:${payload}`;
  } catch (e) {
    console.warn('[StageEditor] generateStageCode failed', e);
    return null;
  }
}

export function loadStageCode(code) {
  try {
    if (!code) return false;
    if (code.startsWith('STAGECODE:')) code = code.slice('STAGECODE:'.length);
    const json = decodeURIComponent(escape(atob(code)));
    const arr = JSON.parse(json);
    return loadStageItems(arr);
  } catch (e) {
    console.warn('[StageEditor] loadStageCode failed', e);
    return false;
  }
}

// bind key '5' to print+copy the generated stage code
window.addEventListener('keydown', (ev) => {
  const k = (ev.key || '').toString();
  if (k === '5') {
    const code = generateStageCode();
    if (code) {
      console.log('[StageEditor] StageCode:', code);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).catch(()=>{/* ignore */});
      }
    } else {
      console.warn('[StageEditor] no code generated');
    }
  }
}, { passive: true });

// --- Levels API: almacenar niveles (name + stageCode) y picker UI ---
const LEVELS_KEY = 'hyperconf_levels_v1';

function _loadLevels() {
  try { const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(LEVELS_KEY) : null; return raw ? JSON.parse(raw) : []; }
  catch (e) { return []; }
}
function _saveLevels(list) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(LEVELS_KEY, JSON.stringify(list)); }
  catch (e) {}
}

export function getLevels() { return _loadLevels(); }

export function addLevel(name, code) {
  if (!name || !code) return false;
  const list = _loadLevels();
  const rec = { name: String(name), code: String(code), ts: Date.now() };
  const idx = list.findIndex(r => r.name === rec.name);
  if (idx >= 0) list.splice(idx, 1, rec); else list.push(rec);
  _saveLevels(list);
  return rec;
}

export function deleteLevel(name) {
  try { const next = _loadLevels().filter(r => r.name !== name); _saveLevels(next); return true; } catch (e) { return false; }
}

export function saveCurrentAsLevel(name) {
  try {
    const code = generateStageCode();
    if (!code) throw new Error('no code');
    return addLevel(name, code);
  } catch (e) { console.warn('[StageEditor] saveCurrentAsLevel failed', e); return null; }
}

// Visual picker: lista overlay con botones para elegir nivel
export function showStagePicker(cb) {
  const levels = _loadLevels();
  if (!levels || levels.length === 0) { if (typeof cb === 'function') cb(null); return; }

  // remove existing overlay if any
  const existing = document.getElementById('hc-stage-picker');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'hc-stage-picker';
  Object.assign(overlay.style, {
    position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
    background: 'rgba(0,0,0,0.8)', color: '#fff', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 9999, fontFamily: 'monospace'
  });

  const box = document.createElement('div');
  Object.assign(box.style, { width: '520px', maxHeight: '70vh', overflowY: 'auto', background: '#222', padding: '12px', borderRadius: '8px' });
  const title = document.createElement('div'); title.textContent = 'Choose Stage'; title.style.marginBottom = '8px';
  box.appendChild(title);

  levels.forEach((lvl, i) => {
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' });
    const lbl = document.createElement('div'); lbl.textContent = `${i}. ${lvl.name}`; lbl.style.flex = '1';
    const btnLoad = document.createElement('button'); btnLoad.textContent = 'Load & Play';
    btnLoad.onclick = () => {
      try { loadStageCode(lvl.code); } catch (e) { console.warn(e); }
      overlay.remove();
      if (typeof cb === 'function') cb(lvl);
    };
    const btnPreview = document.createElement('button'); btnPreview.textContent = 'Preview';
    btnPreview.onclick = () => { try { loadStageCode(lvl.code); } catch (e) { console.warn(e); } };
    const btnDel = document.createElement('button'); btnDel.textContent = 'Delete';
    btnDel.onclick = () => {
      if (!confirm(`Delete stage "${lvl.name}"?`)) return;
      deleteLevel(lvl.name);
      overlay.remove();
      showStagePicker(cb);
    };
    [btnLoad, btnPreview, btnDel].forEach(b => { b.style.marginLeft = '6px'; });
    row.appendChild(lbl);
    const controls = document.createElement('div');
    controls.appendChild(btnPreview); controls.appendChild(btnLoad); controls.appendChild(btnDel);
    row.appendChild(controls);
    box.appendChild(row);
  });

  const cancelRow = document.createElement('div'); Object.assign(cancelRow.style, { textAlign: 'right', marginTop: '8px' });
  const btnCancel = document.createElement('button'); btnCancel.textContent = 'Cancel';
  btnCancel.onclick = () => { overlay.remove(); if (typeof cb === 'function') cb(null); };
  cancelRow.appendChild(btnCancel);
  box.appendChild(cancelRow);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}
 
// expose for console convenience
if (typeof window !== 'undefined') {
  window.getLevels = getLevels;
  window.saveCurrentAsLevel = saveCurrentAsLevel;
  window.deleteLevel = deleteLevel;
  window.showStagePicker = showStagePicker;
  window.generateStageCode = generateStageCode;
  window.loadStageCode = loadStageCode;
}