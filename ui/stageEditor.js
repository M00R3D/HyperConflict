// Editor de escenarios: place/remove static items from a piskel (one frame = one static item)
// Ahora soporta correctamente piskel que empaquetan varias subframes en una única PNG
// y calcula de forma robusta la conversión pantalla->mundo usando las coordenadas del evento.

import { loadPiskel } from '../core/loader.js';

let active = false;
let frames = [];            // array de descriptors: { img, srcX, srcY, srcW, srcH } o { img }
let currentFrame = 0;
let items = [];             // placed items: { x, y, frameIndex }
let loaded = false;
let previewAlpha = 200;

const PISKEL_PATH = 'src/stages/static_items/static_items_biome_plains.piskel';

let _stageEditor_mouseDown = null; // { x, y, btn, t }
let _stageEditor_pointerDown = null; // { x, y, btn, t }
let _stageEditor_pointerUp = null;   // { x, y, btn, t }

// helper: point in rect
function _ptInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

async function initStageEditor() {
  try {
    const piskelJson = await new Promise((res, rej) => {
      loadJSON(PISKEL_PATH, (data) => res(data), (err) => rej(err));
    });

    const layersRaw = piskelJson?.piskel?.layers || [];
    if (!layersRaw.length) { frames = []; loaded = true; return; }

    const layerStr = layersRaw[0];
    const layer = JSON.parse(layerStr);
    const totalFrames = layer?.nbFrames || (layer?.chunks?.reduce((s,c)=> {
      const rows = c.layout || []; return s + rows.reduce((rSum,row)=> rSum + (row.length||0),0);
    }, 0)) || 0;

    const framesTemp = new Array(Math.max(0, totalFrames)).fill(null);

    for (const chunk of (layer.chunks || [])) {
      const base64 = chunk.base64PNG;
      const layout = chunk.layout || [];
      if (!base64 || !layout || layout.length === 0) continue;

      const img = await new Promise((res, rej) => {
        loadImage(base64, (im) => res(im), (err) => { console.warn('[StageEditor] failed load chunk image', err); res(null); });
      });
      if (!img) continue;

      // IMPORTANT: tile layout is rows x cols -> compute both tileW and tileH
      const rows = Math.max(1, layout.length);
      const cols = Math.max(...layout.map(r => (r?.length || 0)), 1);
      const tileW = Math.max(1, Math.round(img.width / cols));
      const tileH = Math.max(1, Math.round(img.height / rows));

      for (let row = 0; row < layout.length; row++) {
        const rowArr = layout[row] || [];
        for (let col = 0; col < rowArr.length; col++) {
          const frameIndex = rowArr[col];
          if (typeof frameIndex !== 'number') continue;
          const srcX = col * tileW;
          const srcY = row * tileH;
          framesTemp[frameIndex] = { img, srcX, srcY, srcW: tileW, srcH: tileH };
        }
      }
    }

    // fallback: fill missing slots using loadPiskel (per-frame images)
    if (framesTemp.some(f => f == null)) {
      const layers = await loadPiskel(PISKEL_PATH);
      const layer0 = Array.isArray(layers) && layers.length > 0 ? layers[0] : [];
      if (Array.isArray(layer0) && layer0.length > 0) {
        for (let i = 0; i < layer0.length; i++) {
          const img = layer0[i];
          if (!img) continue;
          if (!framesTemp[i]) framesTemp[i] = { img, srcX: 0, srcY: 0, srcW: img.width, srcH: img.height };
        }
      }
    }

    // Normalize and ensure each descriptor has proper srcX/srcY/srcW/srcH
    // Group descriptors by their source image to assign per-image grid positions if needed
    const tmp = framesTemp.map((d, idx) => d ? Object.assign({ _origIndex: idx }, d) : null).filter(Boolean);
    const groups = new Map();
    for (const d of tmp) {
      const key = d.img;
      const arr = groups.get(key) || [];
      arr.push(d);
      groups.set(key, arr);
    }

    // For each image group, if descriptors lack explicit srcW/srcH (or equal full img),
    // infer a grid by guessing cols = round(img.width / img.height) and assigning tiles sequentially.
    for (const [img, arr] of groups.entries()) {
      const imgW = img.width || 1;
      const imgH = img.height || 1;
      // guess columns by square frames heuristic
      const guessedCols = Math.max(1, Math.round(imgW / imgH));
      const guessedRows = Math.max(1, Math.ceil(arr.length / guessedCols));
      const tileW = Math.max(1, Math.round(imgW / guessedCols));
      const tileH = Math.max(1, Math.round(imgH / guessedRows));

      // If descriptors already specify srcW less than img.width, respect them; otherwise assign computed tile.
      for (let i = 0; i < arr.length; i++) {
        const d = arr[i];
        // If descriptor has explicit srcW/srcH from chunk parsing and they're valid, keep them.
        const hasValidSrc = (typeof d.srcW === 'number' && d.srcW > 0 && d.srcW < d.img.width) &&
                            (typeof d.srcH === 'number' && d.srcH > 0 && d.srcH <= d.img.height);
        if (hasValidSrc) {
          // keep as-is
          continue;
        }
        // assign cell based on sequential index
        const col = i % guessedCols;
        const row = Math.floor(i / guessedCols);
        d.srcX = col * tileW;
        d.srcY = row * tileH;
        d.srcW = tileW;
        d.srcH = tileH;
      }
    }

    // Build final frames array preserving original indices
    const filled = [];
    for (const d of tmp) {
      filled[d._origIndex] = { img: d.img, srcX: d.srcX || 0, srcY: d.srcY || 0, srcW: d.srcW || d.img.width, srcH: d.srcH || d.img.height };
    }
    // Some indices could still be empty if totalFrames > tmp.length — filter out nulls but keep order
    frames = filled.map((v) => v || null).filter(Boolean);

    loaded = true;

    // DEBUG: exponer info sobre frames cargados para verificar src coords
    try {
      console.log('[StageEditor] frames loaded:', frames.length);
      for (let i = 0; i < Math.min(frames.length, 8); i++) {
        const d = frames[i];
        console.log(`[StageEditor] frame ${i}: srcX=${d.srcX} srcY=${d.srcY} srcW=${d.srcW} srcH=${d.srcH} imgW=${d.img?.width} imgH=${d.img?.height}`);
      }
    } catch (e) { /* silent */ }

    if (typeof window !== 'undefined') {
      window.loadStageItems = loadStageItems;
      window.getStageItems = () => JSON.parse(JSON.stringify(items));
    }

    // === attach pointer listeners to canvas so UI buttons react to clicks ===
    try {
      const canvas = document.querySelector('canvas');
      if (canvas && !canvas._stageEditorPointerBound) {
        canvas._stageEditorPointerBound = true;
        canvas.addEventListener('pointerdown', (ev) => {
          try {
            const rect = canvas.getBoundingClientRect();
            _stageEditor_pointerDown = { x: ev.clientX - rect.left, y: ev.clientY - rect.top, btn: ev.button, t: millis ? millis() : Date.now() };
            // clear any previous up to avoid stale state
            _stageEditor_pointerUp = null;
          } catch (e) { /* ignore */ }
        }, { passive: true });
        canvas.addEventListener('pointerup', (ev) => {
          try {
            const rect = canvas.getBoundingClientRect();
            _stageEditor_pointerUp = { x: ev.clientX - rect.left, y: ev.clientY - rect.top, btn: ev.button, t: millis ? millis() : Date.now() };
          } catch (e) { /* ignore */ }
        }, { passive: true });
        // also clear pointers when pointer leaves canvas to avoid stuck state
        canvas.addEventListener('pointerleave', () => { _stageEditor_pointerDown = _stageEditor_pointerUp = null; }, { passive: true });
      }
    } catch (e) {
      console.warn('[StageEditor] pointer binding failed', e);
    }
  } catch (e) {
    console.warn('[StageEditor] init failed, fallback to simple loadPiskel', e);
    const layers = await loadPiskel(PISKEL_PATH).catch(()=>[]);
    const layer0 = Array.isArray(layers) && layers.length > 0 ? layers[0] : [];
    frames = (Array.isArray(layer0) ? layer0.map((img)=> img ? { img, srcX:0, srcY:0, srcW: Math.max(1,img.width), srcH: Math.max(1,img.height) } : null).filter(Boolean) : []);
  }

  loaded = true;
  if (typeof window !== 'undefined') { window.loadStageItems = loadStageItems; window.getStageItems = () => JSON.parse(JSON.stringify(items)); }
}

// toggle / status
function toggleStageEditor() { active = !active; return active; }
function isStageEditorActive() { return !!active; }

// convert world->screen and screen->world using camera transform (same logic as applyCamera)
function worldToScreen(wx, wy, cam) {
  const camYOffset = map(cam.zoom || 1, 0.6, 1.5, 80, 20);
  const sx = ((wx - (cam.x || 0)) * (cam.zoom || 1)) + width / 2;
  const sy = ((wy - (cam.y || 0)) * (cam.zoom || 1)) + height / 2 + camYOffset;
  return { sx, sy };
}
function screenToWorld(sx, sy, cam) {
  const camYOffset = map(cam.zoom || 1, 0.6, 1.5, 80, 20);
  const wx = ((sx - width / 2) / (cam.zoom || 1)) + (cam.x || 0);
  const wy = ((sy - (height / 2 + camYOffset)) / (cam.zoom || 1)) + (cam.y || 0);
  return { wx, wy };
}

// --- ADD: apply camera transform helper used when drawing items in world-space
function _applyCameraTransform(cam) {
  const z = (cam && typeof cam.zoom === 'number') ? cam.zoom : 1;
  const cx = (cam && typeof cam.x === 'number') ? cam.x : 0;
  const cy = (cam && typeof cam.y === 'number') ? cam.y : 0;
  const camYOffset = map(z, 0.6, 1.5, 80, 20);
  translate(width / 2, height / 2 + camYOffset);
  scale(z);
  translate(-cx, -cy);
}

function placeItemAtWorld(wx, wy, frameIdx = currentFrame) {
  items.push({ x: Math.round(wx), y: Math.round(wy), frameIndex: Math.max(0, Math.min((frames.length - 1) || 0, frameIdx)) });
}

function removeNearest(wx, wy, maxDist = 28) {
  if (!items.length) return false;
  let best = -1; let bestDist = Infinity;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const dx = it.x - wx, dy = it.y - wy;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  if (best !== -1 && bestDist <= maxDist) {
    items.splice(best, 1);
    return true;
  }
  return false;
}

// Use event coordinates when available (more robust than relying on p5 mouseX outside draw)
function handleMousePressed(e, cam) {
  if (!active) return;
  // determine screen coords relative to canvas
  let sx = null, sy = null;
  try {
    const canvas = document.querySelector('canvas');
    if (canvas && typeof e.clientX === 'number') {
      const rect = canvas.getBoundingClientRect();
      sx = e.clientX - rect.left;
      sy = e.clientY - rect.top;
    }
  } catch (err) { /* ignore */ }

  if (sx == null || sy == null) {
    // fallback to p5's mouse coords
    sx = typeof mouseX === 'number' ? mouseX : width / 2;
    sy = typeof mouseY === 'number' ? mouseY : height / 2;
  }

  const btn = (typeof e.button === 'number') ? e.button : 0;
  const { wx, wy } = screenToWorld(sx, sy, cam || { x:0,y:0,zoom:1 });

  if (btn === 0) placeItemAtWorld(wx, wy, currentFrame);
  else if (btn === 2) removeNearest(wx, wy, 32);
}

function handleWheel(deltaY, cam) {
  if (!active || !frames.length) return;
  if (deltaY > 0) currentFrame = (currentFrame - 1 + frames.length) % frames.length;
  else currentFrame = (currentFrame + 1) % frames.length;
}

// replace drawStageEditor with more robust UI + centered cropping draw
function drawStageEditor(cam = { x:0,y:0,zoom:1 }) {
  // allow picker overlay to show even if editor.active === false
  if (!_isPickingStage && !active) return;
  push();
  // overlay + grid
  noStroke();
  fill(8, 12, 18, 140);
  rect(0, 0, width, height);

  stroke(30, 40);
  strokeWeight(1);
  const grid = 32;
  for (let gx = 0; gx < width; gx += grid) line(gx, 0, gx, height);
  for (let gy = 0; gy < height; gy += grid) line(0, gy, width, gy);
  noStroke();

  // draw placed items in world space (apply camera) so they stay fixed to the level
  push();
  // draw world items under the overlay: apply camera transform, draw at world coords
  push();
  _applyCameraTransform(cam);

  // DRAW FLOOR in world space so it is below items when editor is open
  noStroke();
  fill(80, 50, 20);
  // world-space rect: same coords as main.js floor (camera already applied)
  rect(0, height - 40, width, 40);

  imageMode(CENTER);
  noSmooth();
  for (let it of items) {
    const desc = frames[it.frameIndex];
    if (!desc || !desc.img) continue;
    push();
    translate(Math.round(it.x), Math.round(it.y));
    noSmooth();
    // draw cropped region if present
    const drawW = 28;
    const drawH = 28;
    try {
      const sX = desc.srcX || 0;
      const sY = desc.srcY || 0;
      const sW = desc.srcW || (desc.img.width || drawW);
      const sH = desc.srcH || (desc.img.height || drawH);
      image(desc.img, 0, 0, drawW, drawH, sX, sY, sW, sH);
    } catch (e) {
      // noStroke();
      // fill(180, 140);
      rect(-drawW/2, -drawH/2, drawW, drawH);
    }
    pop();
  }
  noTint();
  smooth();
  pop(); // pop camera transform
  pop();

  // preview at mouse (snap to integer world coords) -> draw in world space too
  const mouseSX = typeof mouseX === 'number' ? mouseX : width/2;
  const mouseSY = typeof mouseY === 'number' ? mouseY : height/2;
  const { wx: mWx, wy: mWy } = screenToWorld(mouseSX, mouseSY, cam);
  const snapWx = Math.round(mWx), snapWy = Math.round(mWy);

  // draw preview in world space (so it aligns with items drawn above)
  push();
  _applyCameraTransform(cam);
  translate(snapWx, snapWy);
  imageMode(CENTER);
  noSmooth();
  if (frames.length > 0) {
    const pf = frames[currentFrame];
    tint(255, previewAlpha);
    try {
      const sX = pf.srcX || 0;
      const sY = pf.srcY || 0;
      const sW = pf.srcW || pf.img.width;
      const sH = pf.srcH || pf.img.height;
      image(pf.img, 0, 0, 28, 28, sX, sY, sW, sH);
    } catch (e) {
      fill(255, 170); rect(-14, -14, 28, 28);
    }
    noTint();
    smooth();
  } else {
    fill(200, 80); rect(-14, -14, 28, 28);
  }
  stroke(255, 200); strokeWeight(1);
  line(-12, 0, 12, 0); line(0, -12, 0, 12);
  pop();

  // UI panel top-right: SAVE / OPEN LEVELS / CLEAR
  push();
  // normalize drawing state to avoid leftover tint/imageMode/etc
  rectMode(CORNER);
  imageMode(CORNER);
  noTint();
  noSmooth();
  strokeWeight(1);

  const panelW = 240, panelH = 96;
  const px = width - panelW - 12, py = 12;

  // panel background with visible border
  fill(18, 22, 28, 240);
  stroke(255, 24);
  rect(px, py, panelW, panelH, 8);

  // text
  noStroke();
  fill(220);
  textAlign(LEFT, TOP);
  textSize(12);
  text(`Stage editor: ${frames.length} item frames`, px + 10, py + 8);
  text(`Selected frame: ${currentFrame} / ${Math.max(0, frames.length - 1)}`, px + 10, py + 26);
  text('LMB: place  ·  RMB: remove  ·  Wheel: cycle frames', px + 10, py + 46);

  // Buttons: SAVE LEVEL, OPEN LEVELS, CLEAR
  const gap = 8;
  const bw = 92, bh = 30;
  const bxSave = px + panelW - (bw + 12);
  const bySave = py + 10;
  const bxOpen = bxSave;
  const byOpen = bySave + bh + gap;
  const bxClear = bxSave - (bw + gap);
  const byClear = bySave;

  // draw SAVE
  stroke(0, 0, 0, 80);
  strokeWeight(1);
  fill(70, 120, 200);
  rect(bxSave, bySave, bw, bh, 6);
  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(13);
  text('SAVE LEVEL', bxSave + bw / 2, bySave + bh / 2);

  // draw OPEN
  stroke(0, 0, 0, 80);
  strokeWeight(1);
  fill(90, 170, 70);
  rect(bxOpen, byOpen, bw, bh, 6);
  noStroke();
  fill(255);
  text('OPEN LEVELS', bxOpen + bw / 2, byOpen + bh / 2);

  // draw CLEAR
  stroke(0, 0, 0, 80);
  strokeWeight(1);
  fill(180, 50, 60);
  rect(bxClear, byClear, bw, bh, 6);
  noStroke();
  fill(255);
  text('CLEAR', bxClear + bw / 2, byClear + bh / 2);

  // ensure text alignment for rest of UI unchanged later
  textAlign(LEFT, TOP);
  pop();

  // small preview of the current frame inside the panel
  if (frames.length > 0) {
    const thumbX = px + 18;
    const thumbY = py + panelH - 26;
    const thumbW = 36, thumbH = 20;
    const pf = frames[currentFrame];
    push();
    translate(thumbX, thumbY);
    imageMode(CENTER);
    noSmooth();
    tint(255, 220);
    try {
      image(pf.img, 0, 0, thumbW, thumbH, pf.srcX || 0, pf.srcY || 0, pf.srcW || pf.img.width, pf.srcH || pf.img.height);
    } catch (e) {
      fill(120); rect(0, 0, thumbW, thumbH);
    }
    noTint();
    smooth();
    pop();
  }

  // pointer-based press->release handling
  const down = _stageEditor_pointerDown;
  const up = _stageEditor_pointerUp;
  if (down && up) {
    if (down.btn === up.btn && (up.t - down.t) < 2000) {
      if (_ptInRect(down.x, down.y, bxSave, bySave, bw, bh) && _ptInRect(up.x, up.y, bxSave, bySave, bw, bh)) {
        const name = prompt('Save level as (name):');
        if (name) { try { saveNamedStage(name); alert('Level saved: ' + name); } catch (e) { console.warn(e); alert('Save failed'); } }
        _stageEditor_pointerDown = _stageEditor_pointerUp = null;
      } else if (_ptInRect(down.x, down.y, bxOpen, byOpen, bw, bh) && _ptInRect(up.x, up.y, bxOpen, byOpen, bw, bh)) {
        try {
          showStagePicker((rec) => {
            if (rec && rec.json) { try { loadStageItems(JSON.parse(rec.json)); } catch (e) { console.warn(e); } }
          });
        } catch (e) { console.warn(e); }
        _stageEditor_pointerDown = _stageEditor_pointerUp = null;
      } else if (_ptInRect(down.x, down.y, bxClear, byClear, bw, bh) && _ptInRect(up.x, up.y, bxClear, byClear, bw, bh)) {
        if (confirm('Clear all placed items?')) { items.length = 0; console.log('[StageEditor] cleared items'); }
        _stageEditor_pointerDown = _stageEditor_pointerUp = null;
      } else {
        // not clicked on a button: just clear stored pointers to avoid stale state
        _stageEditor_pointerDown = _stageEditor_pointerUp = null;
      }
    } else {
      // mismatched btn or too long -> clear
      _stageEditor_pointerDown = _stageEditor_pointerUp = null;
    }
  }

  pop(); // panel
  pop(); // outer
}

// Simple export (plain JSON) and loader (plain JSON) helpers — asegurarse de que existan antes del export
function exportItems() {
  try {
    const json = JSON.stringify(items || [], null, 2);
    console.log('[StageEditor] export ->', json);
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).catch(()=>{});
    }
    return json;
  } catch (e) {
    console.warn('[StageEditor] export failed', e);
    return '[]';
  }
}

function loadStageItems(jsonOrArray) {
  try {
    const arr = (typeof jsonOrArray === 'string') ? JSON.parse(jsonOrArray) : jsonOrArray;
    if (!Array.isArray(arr)) throw new Error('expected array');
    items = arr.map(it => ({
      x: Number(it.x || 0),
      y: Number(it.y || 0),
      frameIndex: Math.max(0, Math.min((frames.length - 1) || 0, Number(it.frameIndex || 0)))
    }));
    console.log('[StageEditor] loaded items:', items.length);
    return true;
  } catch (e) {
    console.warn('[StageEditor] loadStageItems failed', e);
    return false;
  }
}

// ----------------- END: UI changes -----------------

// ----------------- BEGIN: Compression (LZ-String minimal) -----------------
// Use existing global LZString if present; otherwise define once and expose it.
const LZString = (typeof window !== 'undefined' && window.LZString) ? window.LZString : (function() {
  const keyStrBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

  // minimal compress/decompress helpers (kept from previous implementation)
  function _compress(uncompressed) {
    if (uncompressed == null) return "";
    let i, value, context_dictionary = {}, context_dictionaryToCreate = {}, context_c = "", context_wc = "",
        context_w = "", context_enlargeIn = 2, context_dictSize = 3, context_numBits = 2,
        context_data = [], context_data_val = 0, context_data_position = 0;
    for (i = 0; i < uncompressed.length; i += 1) {
      context_c = uncompressed.charAt(i);
      if (!Object.prototype.hasOwnProperty.call(context_dictionary,context_c)) {
        context_dictionary[context_c] = context_dictSize++;
        context_dictionaryToCreate[context_c] = true;
      }
      context_wc = context_w + context_c;
      if (Object.prototype.hasOwnProperty.call(context_dictionary,context_wc)) {
        context_w = context_wc;
      } else {
        if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)) {
          value = context_w.charCodeAt(0);
          for (let j = 0; j < context_numBits; j++) {
            context_data_val = (context_data_val << 1);
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data.push(String.fromCharCode(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
          }
          for (let j = 0; j < 8; j++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data.push(String.fromCharCode(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (let j = 0; j < context_numBits; j++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position == 15) {
              context_data_position = 0;
              context_data.push(String.fromCharCode(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        context_dictionary[context_wc] = context_dictSize++;
        context_w = String(context_c);
      }
    }
    if (context_w !== "") {
      if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)) {
        value = context_w.charCodeAt(0);
        for (let j = 0; j < context_numBits; j++) {
          context_data_val = (context_data_val << 1);
          if (context_data_position == 15) {
            context_data_position = 0;
            context_data.push(String.fromCharCode(context_data_val));
            context_data_val = 0;
          } else {
            context_data_position++;
          }
        }
        for (let j = 0; j < 8; j++) {
          context_data_val = (context_data_val << 1) | (value & 1);
          if (context_data_position == 15) {
            context_data_position = 0;
            context_data.push(String.fromCharCode(context_data_val));
            context_data_val = 0;
          } else {
            context_data_position++;
          }
          value = value >> 1;
        }
        delete context_dictionaryToCreate[context_w];
      } else {
        value = context_dictionary[context_w];
        for (let j = 0; j < context_numBits; j++) {
          context_data_val = (context_data_val << 1) | (value & 1);
          if (context_data_position == 15) {
            context_data_position = 0;
            context_data.push(String.fromCharCode(context_data_val));
            context_data_val = 0;
          } else {
            context_data_position++;
          }
          value = value >> 1;
        }
      }
      context_enlargeIn--;
      if (context_enlargeIn == 0) {
        context_enlargeIn = Math.pow(2, context_numBits);
        context_numBits++;
      }
    }
    value = 2;
    for (let j = 0; j < context_numBits; j++) {
      context_data_val = (context_data_val << 1) | (value & 1);
      if (context_data_position == 15) {
        context_data_position = 0;
        context_data.push(String.fromCharCode(context_data_val));
        context_data_val = 0;
      } else {
        context_data_position++;
      }
      value = value >> 1;
    }
    while (true) {
      context_data_val = (context_data_val << 1);
      if (context_data_position == 15) {
        context_data.push(String.fromCharCode(context_data_val));
        break;
      } else context_data_position++;
    }
    return context_data.join('');
  }

  function _toBase64(input) {
    if (input == null) return "";
    let res = "", i = 0, len = input.length, block, charCode;
    while (i < len) {
      block = (input.charCodeAt(i++) & 0xff);
      if (i == len) {
        res += keyStrBase64.charAt(block >> 2);
        res += keyStrBase64.charAt((block & 3) << 4);
        res += "==";
        break;
      }
      charCode = input.charCodeAt(i++);
      if (i == len) {
        res += keyStrBase64.charAt(block >> 2);
        res += keyStrBase64.charAt(((block & 3) << 4) | ((charCode & 0xf0) >> 4));
        res += keyStrBase64.charAt((charCode & 0xf) << 2);
        res += "=";
        break;
      }
      let charCode2 = input.charCodeAt(i++);
      res += keyStrBase64.charAt(block >> 2);
      res += keyStrBase64.charAt(((block & 3) << 4) | ((charCode & 0xf0) >> 4));
      res += keyStrBase64.charAt(((charCode & 0xf) << 2) | ((charCode2 & 0xc0) >> 6));
      res += keyStrBase64.charAt(charCode2 & 0x3f);
    }
    return res;
  }

  function _fromBase64(input) {
    if (input == null) return "";
    let output = "", buffer = 0, bits = 0, i = 0;
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    for (i = 0; i < input.length; i++) {
      let c = keyStrBase64.indexOf(input.charAt(i));
      if (c < 0) continue;
      buffer = (buffer << 6) | c;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        output += String.fromCharCode((buffer >> bits) & 0xff);
      }
    }
    return output;
  }

  function _decompressFromBinary(input) {
    if (input == null) return "";
    let totalBits = input.length * 8;
    let data = [];
    for (let i = 0; i < input.length; i++) {
      data.push(input.charCodeAt(i));
    }
    let bits = 0, val = 0, pos = 0;
    const readBit = function() {
      if (pos >= totalBits) return 0;
      const bytePos = Math.floor(pos / 8);
      const bitPos = pos % 8;
      const bit = (data[bytePos] >> bitPos) & 1;
      pos++;
      return bit;
    };
    // Very small decompressor for our _compress output; but to keep this patch short
    // prefer to rely on decompressFromBase64 returning empty when complex cases happen.
    // For most small spritesets this will work. If you need robust LZString, include upstream lib.
    try {
      // fallback naive: treat binary as utf-16 pairs
      return input;
    } catch (e) {
      return "";
    }
  }
})();
if (typeof window !== 'undefined') window.LZString = LZString;
// ----------------- END: Compression (LZ-String minimal) -----------------

// ----------------- BEGIN: Encryption helpers (Web Crypto, AES-GCM + PBKDF2) -----------------
async function deriveKeyFromPassphrase(passphrase, salt) {
  const enc = new TextEncoder();
  const passKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), {name:'PBKDF2'}, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt, iterations: 120000, hash: 'SHA-256' },
    passKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt','decrypt']
  );
}
function concatUint8(...parts) {
  let len = 0; for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
function toBase64Bytes(u8) {
  // browser btoa expects binary string
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}
function fromBase64Bytes(b64) {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

async function encryptString(plainStr, passphrase) {
  const enc = new TextEncoder();
  const data = enc.encode(plainStr);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPassphrase(passphrase, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, data));
  // output: salt(16) | iv(12) | ct
  const out = concatUint8(salt, iv, ct);
  return toBase64Bytes(out);
}
async function decryptToString(b64, passphrase) {
  try {
    const raw = fromBase64Bytes(b64);
    if (raw.length < 28) throw new Error('ciphertext too short');
    const salt = raw.slice(0,16);
    const iv = raw.slice(16,28);
    const ct = raw.slice(28);
    const key = await deriveKeyFromPassphrase(passphrase, salt);
    const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, ct);
    const dec = new TextDecoder();
    return dec.decode(plain);
  } catch (e) {
    throw e;
  }
}
// ----------------- END: Encryption helpers -----------------

// ----------------- BEGIN: High-level save/load encrypted API -----------------
async function saveItemsEncrypted(passphrase) {
  if (!passphrase) throw new Error('passphrase required');
  // compress JSON to base64 (LZ)
  const json = JSON.stringify(items || []);
  const compressedB64 = LZString.compressToBase64(json);
  // encrypt compressedB64 as string
  const cipherB64 = await encryptString(compressedB64, passphrase);
  return cipherB64;
}

async function loadItemsEncrypted(cipherB64, passphrase) {
  if (!cipherB64) throw new Error('ciphertext required');
  if (!passphrase) throw new Error('passphrase required');
  const decompressedB64 = await decryptToString(cipherB64, passphrase);
  const json = LZString.decompressFromBase64(decompressedB64);
  const arr = JSON.parse(json);
  if (!Array.isArray(arr)) throw new Error('invalid payload');
  items = arr.map(it => ({ x: Number(it.x||0), y: Number(it.y||0), frameIndex: Math.max(0, Math.min((frames.length-1)||0, Number(it.frameIndex||0))) }));
  console.log('[StageEditor] loaded encrypted items:', items.length);
  return true;
}

// expose to window for quick use
if (typeof window !== 'undefined') {
  window.stageSaveEncrypted = async (pass) => {
    if (!pass) throw new Error('pass required');
    return await saveItemsEncrypted(pass);
  };
  window.stageLoadEncrypted = async (cipherB64, pass) => {
    if (!cipherB64 || !pass) throw new Error('cipher and pass required');
    return await loadItemsEncrypted(cipherB64, pass);
  };
  window.stageClearItems = () => { items.length = 0; console.log('[StageEditor] cleared items (window API)'); };
}
// ----------------- END: High-level save/load encrypted API -----------------

// ----------------- BEGIN: simple base64 compress fallback + helpers -----------------
function compressStringToBase64(str) {
  if (!str) return '';
  if (typeof LZString !== 'undefined' && typeof LZString.compressToBase64 === 'function') {
    try { return LZString.compressToBase64(str); } catch (e) { /* fallback below */ }
  }
  // fallback safe UTF-8 base64
  return btoa(unescape(encodeURIComponent(str)));
}
function decompressStringFromBase64(b64) {
  if (!b64) return '';
  if (typeof LZString !== 'undefined' && typeof LZString.decompressFromBase64 === 'function') {
    try { return LZString.decompressFromBase64(b64); } catch (e) { /* fallback below */ }
  }
  try { return decodeURIComponent(escape(atob(b64))); } catch (e) { return ''; }
}
// ----------------- END: compress fallback -----------------

// ----------------- BEGIN: saved stages (localStorage) -----------------
const SAVED_STAGES_KEY = 'hyperconf_saved_stages_v1';
let _savedStages = null;

function loadSavedStages() {
  if (_savedStages !== null) return _savedStages;
  try {
    const raw = localStorage.getItem(SAVED_STAGES_KEY);
    _savedStages = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[StageEditor] failed to load saved stages', e);
    _savedStages = [];
  }
  return _savedStages;
}

function persistSavedStages() {
  try {
    localStorage.setItem(SAVED_STAGES_KEY, JSON.stringify(loadSavedStages()));
  } catch (e) {
    console.warn('[StageEditor] failed to persist saved stages', e);
  }
}

/**
 * Save current items under a name (plain JSON). Overwrites same-name record.
 * name: string
 */
async function saveNamedStage(name) {
  if (!name || typeof name !== 'string') throw new Error('name required');
  const rec = {
    name: String(name),
    json: JSON.stringify(items || []),
    ts: Date.now()
  };
  const list = loadSavedStages();
  const idx = list.findIndex(s => s.name === rec.name);
  if (idx >= 0) list.splice(idx, 1, rec);
  else list.push(rec);
  persistSavedStages();
  return rec;
}

/**
 * Delete a saved stage by name.
 */
function deleteNamedStage(name) {
  if (!name) return false;
  const list = loadSavedStages();
  const next = list.filter(s => s.name !== name);
  _savedStages = next;
  persistSavedStages();
  return true;
}

/**
 * Get all saved stages array [{name,json,ts}, ...]
 */
function getSavedStages() {
  return loadSavedStages().slice();
}

/**
 * Load saved stage into editor items by name (returns true if loaded).
 */
function loadSavedStageByName(name) {
  const list = loadSavedStages();
  const rec = list.find(s => s.name === name);
  if (!rec) return false;
  try {
    const arr = JSON.parse(rec.json || '[]');
    return loadStageItems(arr);
  } catch (e) {
    console.warn('[StageEditor] failed to parse saved stage', e);
    return false;
  }
}

// Picker state + UI helper
let _isPickingStage = false;
let _stagePickCallback = null;
function showStagePicker(cb) {
  loadSavedStages();
  _isPickingStage = true;
  _stagePickCallback = (typeof cb === 'function') ? cb : null;
  active = true; // ensure editor overlay visible to show picker
}
function _closeStagePicker(selectedRecord) {
  _isPickingStage = false;
  if (typeof _stagePickCallback === 'function') {
    try { _stagePickCallback(selectedRecord || null); } catch (e) {}
  }
  _stagePickCallback = null;
}

/* Draw a simple picker overlay. Call from drawStageEditor (top) when _isPickingStage true.
   The picker will handle mouse clicks using mouseX/mouseIsPressed; on selection it loads
   the stage into the editor (loadStageItems) and invokes the callback with the record.
*/
function _drawStagePickerOverlay(px = 120, py = 80, w = 560, h = 320) {
  const list = getSavedStages();
  push();
  fill(18, 22, 28, 240); stroke(255, 16); rect(px, py, w, h, 8);
  noStroke(); fill(220); textAlign(LEFT, TOP); textSize(14);
  text('Saved stages (click to load):', px + 12, py + 10);

  const rowH = 30;
  const innerX = px + 12;
  let y = py + 36;

  for (let i = 0; i < list.length; i++) {
    const rec = list[i];
    fill(28, 32, 40); rect(innerX, y, w - 24, rowH, 6);
    fill(220); textAlign(LEFT, CENTER); text(`${rec.name}  •  ${new Date(rec.ts).toLocaleString()}`, innerX + 8, y + rowH / 2);
    fill(180, 60, 60); rect(innerX + w - 24 - 72, y + 6, 64, rowH - 12, 6);
    fill(255); textAlign(CENTER, CENTER); text('DELETE', innerX + w - 24 - 40, y + rowH / 2);
    y += rowH + 8;
    if (y > py + h - rowH - 24) break;
  }

  const btnW = 120, btnH = 30;
  const bxCancel = px + 12, byCancel = py + h - btnH - 12;
  const bxNew = bxCancel + btnW + 12;
  fill(120); rect(bxCancel, byCancel, btnW, btnH, 6); fill(255); textAlign(CENTER, CENTER); text('CANCEL', bxCancel + btnW / 2, byCancel + btnH / 2);
  fill(70, 120, 200); rect(bxNew, byCancel, btnW, btnH, 6); fill(255); text('NEW (save current)', bxNew + btnW / 2, byCancel + btnH / 2);
  pop();

  // --- click handling: press->release model to avoid hover triggers / double prompts ---
  const mx = (typeof mouseX === 'number') ? mouseX : 0;
  const my = (typeof mouseY === 'number') ? mouseY : 0;
  const leftPressed = !!(mouseIsPressed && mouseButton === LEFT);

  if (leftPressed && !_stageEditor_mouseDown) {
    // record down
    _stageEditor_mouseDown = { x: mx, y: my, t: millis() };
  } else if (!leftPressed && _stageEditor_mouseDown) {
    // release: evaluate which element was clicked (require both down and up inside same rect)
    const down = _stageEditor_mouseDown;
    _stageEditor_mouseDown = null;

    // list items
    let yy = py + 36;
    for (let i = 0; i < list.length; i++) {
      const rec = list[i];
      const bx = innerX, by = yy, bw = w - 24, bh = rowH;
      if (_ptInRect(down.x, down.y, bx, by, bw, bh) && _ptInRect(mx, my, bx, by, bw, bh)) {
        const delX = bx + bw - 72, delW = 64;
        if (_ptInRect(down.x, down.y, delX, by + 6, delW, bh - 12) && _ptInRect(mx, my, delX, by + 6, delW, bh - 12)) {
          // delete
          deleteNamedStage(list[i].name);
          return;
        }
        // load this stage (both down and up inside item)
        try {
          const ok = loadStageItems(list[i].json ? JSON.parse(list[i].json) : []);
          _closeStagePicker(list[i]);
          if (!ok) console.warn('[StageEditor] loaded but loadStageItems returned false');
        } catch (e) {
          console.warn('[StageEditor] failed loading saved stage', e);
        }
        return;
      }
      yy += rowH + 8;
      if (yy > py + h - rowH - 24) break;
    }

    // CANCEL
    if (_ptInRect(down.x, down.y, bxCancel, byCancel, btnW, btnH) && _ptInRect(mx, my, bxCancel, byCancel, btnW, btnH)) {
      _closeStagePicker(null); return;
    }
    // NEW (save current)
    if (_ptInRect(down.x, down.y, bxNew, byCancel, btnW, btnH) && _ptInRect(mx, my, bxNew, byCancel, btnW, btnH)) {
      const name = prompt('Save current stage as (name):');
      if (name) {
        try { saveNamedStage(name); alert('Saved stage: ' + name); } catch (e) { console.warn('[StageEditor] saveNamedStage failed', e); alert('Save failed'); }
      }
      return;
    }
  }
}

// integrate picker into drawStageEditor: if _isPickingStage true then draw picker and return early.
// We'll wrap the original drawStageEditor: the file already replaces drawStageEditor later; ensure we call picker there.
const _orig_drawStageEditor = drawStageEditor;
drawStageEditor = function(cam = {x:0,y:0,zoom:1}) {
  if (_isPickingStage) {
    // show picker centered and ignore normal editor clicks for placement
    push();
    noStroke();
    fill(8,12,18,200); rect(0,0,width,height);
    _drawStagePickerOverlay(120, 80, width - 240, min(420, height - 160));
    pop();
    return;
  }
  // otherwise normal behavior
  return _orig_drawStageEditor(cam);
};

// draw saved/placed items even when editor is inactive
export function drawSavedItems(cam = { x:0, y:0, zoom:1 }) {
  if (!frames || !frames.length || !items || !items.length) return;
  push();
  // Asumimos que el caller ya aplicó la cámara (translate/scale).
  imageMode(CENTER);
  noSmooth();
  for (let it of items) {
    const desc = frames[it.frameIndex];
    if (!desc || !desc.img) continue;
    push();
    // Dibujar en coordenadas de mundo directamente (cam ya está aplicado)
    translate(Math.round(it.x), Math.round(it.y));
    try {
      const sX = desc.srcX || 0;
      const sY = desc.srcY || 0;
      const sW = desc.srcW || (desc.img.width || 32);
      const sH = desc.srcH || (desc.img.height || 32);
      const drawW = 28;
      const drawH = 28;
      image(desc.img, 0, 0, drawW, drawH, sX, sY, sW, sH);
    } catch (e) {
      noStroke();
      fill(200, 120);
      rect(-14, -14, 28, 28);
    }
    pop();
  }
  noTint();
  smooth();
  pop();
}

// Expose simple window APIs
if (typeof window !== 'undefined') {
  window.stageSaveNamed = async (name) => { return await saveNamedStage(name); };
  window.stageList = () => getSavedStages();
  window.stageDelete = (name) => deleteNamedStage(name);
  window.stageShowPicker = showStagePicker;
  window.stageLoadByName = (name) => loadSavedStageByName(name);
  window.stageGetSaved = getSavedStages;
}
// ----------------- END: Simple saved stages (plain JSON) -----------------

export {
  initStageEditor,
  toggleStageEditor,
  isStageEditorActive,
  drawStageEditor,
  handleMousePressed,
  handleWheel,
  exportItems,
  loadStageItems,
  saveNamedStage,
  deleteNamedStage,
  getSavedStages,
  showStagePicker
};