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
  } catch (e) {
    console.warn('[StageEditor] init failed, fallback to simple loadPiskel', e);
    const layers = await loadPiskel(PISKEL_PATH).catch(()=>[]);
    const layer0 = Array.isArray(layers) && layers.length > 0 ? layers[0] : [];
    frames = (Array.isArray(layer0) ? layer0.map((img)=> img ? { img, srcX:0, srcY:0, srcW: Math.max(1,img.width), srcH: Math.max(1,img.height) } : null).filter(Boolean) : []);
  }

  loaded = true;
  if (typeof window !== 'undefined') {
    window.loadStageItems = loadStageItems;
    window.getStageItems = () => JSON.parse(JSON.stringify(items));
  }
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
  if (!active) return;
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

  // draw placed items using CENTER mode and cropping using stored srcX/srcY/srcW/srcH
  for (let it of items) {
    const desc = frames[it.frameIndex];
    const { sx, sy } = worldToScreen(it.x, it.y, cam);
    push();
    translate(sx, sy);
    // draw centered
    imageMode(CENTER);
    noSmooth();
    tint(255, 220);
    const drawW = 28;
    const drawH = 28;
    try {
      if (desc && desc.img) {
        const sX = desc.srcX || 0;
        const sY = desc.srcY || 0;
        const sW = desc.srcW || desc.img.width;
        const sH = desc.srcH || desc.img.height;
        // draw cropped region centered at 0,0
        image(desc.img, 0, 0, drawW, drawH, sX, sY, sW, sH);
      }
    } catch (e) {
      fill(180, 140);
      rect(0, 0, drawW, drawH);
    }
    noTint();
    smooth();
    pop();
  }

  // preview at mouse (snap to integer world coords)
  const mouseSX = typeof mouseX === 'number' ? mouseX : width/2;
  const mouseSY = typeof mouseY === 'number' ? mouseY : height/2;
  const { wx: mWx, wy: mWy } = screenToWorld(mouseSX, mouseSY, cam);
  const snapWx = Math.round(mWx), snapWy = Math.round(mWy);
  const { sx: pmx, sy: pmy } = worldToScreen(snapWx, snapWy, cam);

  push();
  translate(pmx, pmy);
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
      fill(255, 170); rect(0, 0, 28, 28);
    }
    noTint();
    smooth();
  } else {
    fill(200, 80); rect(0, 0, 28, 28);
  }
  stroke(255, 200); strokeWeight(1);
  line(-12, 0, 12, 0); line(0, -12, 0, 12);
  pop();

  // UI panel top-right: export button + frame index preview
  push();
  const panelW = 260, panelH = 96;
  const px = width - panelW - 12, py = 12;
  fill(18, 22, 28, 240);
  stroke(255, 16);
  rect(px, py, panelW, panelH, 8);
  noStroke();
  fill(220);
  textAlign(LEFT, TOP);
  textSize(12);
  text(`Stage editor: ${frames.length} item frames`, px + 10, py + 8);
  text(`Selected frame: ${currentFrame} / ${Math.max(0, frames.length - 1)}`, px + 10, py + 26);
  text('LMB: place  ·  RMB: remove  ·  Wheel: cycle frames', px + 10, py + 46);

  // Export button
  const bx = px + panelW - 96, by = py + 10, bw = 84, bh = 30;
  // button background
  fill(70, 120, 200);
  rect(bx, by, bw, bh, 6);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(13);
  text('EXPORT', bx + bw/2, by + bh/2);

  // Export click handling with simple debounce (prevents multi-logs)
  if (mouseIsPressed && mouseButton === LEFT) {
    if (mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh) {
      const now = millis();
      if (!window._stageEditorLastExportAt || (now - window._stageEditorLastExportAt) > 400) {
        window._stageEditorLastExportAt = now;
        console.log('[StageEditor] export', JSON.stringify(items, null, 2));
      }
    }
  }

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

  pop(); // panel
  pop(); // outer
}

// helper: export / import placed items (JSON)
function exportItems() {
  try {
    const json = JSON.stringify(items, null, 2);
    console.log('[StageEditor] export', json);
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
    console.log('[StageEditor] loaded', items.length, 'items');
    return true;
  } catch (e) {
    console.warn('[StageEditor] load failed', e);
    return false;
  }
}

// export functions (unchanged)
export {
  initStageEditor,
  toggleStageEditor,
  isStageEditorActive,
  drawStageEditor,
  handleMousePressed,
  handleWheel,
  exportItems,
  loadStageItems
};