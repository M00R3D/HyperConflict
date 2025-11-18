// Editor de escenarios: place/remove static items from a piskel (one frame = one static item)

import { loadPiskel } from '../core/loader.js';

let active = false;
let frames = [];            // array of p5.Image frames (layer 0)
let currentFrame = 0;
let items = [];             // placed items: { x, y, frameIndex }
let loaded = false;
let previewAlpha = 200;

const PISKEL_PATH = 'src/stages/static_items/static_items_biome_plains.piskel';

async function initStageEditor() {
  // load piskel frames (layers -> frames[])
  try {
    const layers = await loadPiskel(PISKEL_PATH);
    if (Array.isArray(layers) && layers.length > 0 && Array.isArray(layers[0])) {
      frames = layers[0].filter(Boolean);
    } else {
      frames = [];
    }
  } catch (e) {
    console.error('[StageEditor] failed load', e);
    frames = [];
  }
  loaded = true;
  // expose quick helpers
  if (typeof window !== 'undefined') {
    window.loadStageItems = loadStageItems;
    window.getStageItems = () => JSON.parse(JSON.stringify(items));
  }
}

function toggleStageEditor() { active = !active; return active; }
function isStageEditorActive() { return !!active; }

function worldToScreen(wx, wy, cam) {
  const camYOffset = map(cam.zoom || 1, 0.6, 1.5, 80, 20);
  const sx = ((wx - (cam.x || 0)) * (cam.zoom || 1)) + width / 2;
  const sy = ((wy - (cam.y || 0)) * (cam.zoom || 1)) + height / 2 + camYOffset;
  return { sx, sy };
}
function screenToWorld(sx, sy, cam) {
  const camYOffset = map(cam.zoom || 1, 0.6, 1.5, 80, 20);
  const wx = ( (sx - width/2) / (cam.zoom || 1) ) + (cam.x || 0);
  const wy = ( (sy - (height/2 + camYOffset)) / (cam.zoom || 1) ) + (cam.y || 0);
  return { wx, wy };
}

function placeItemAtWorld(wx, wy, frameIdx = currentFrame) {
  items.push({ x: Math.round(wx), y: Math.round(wy), frameIndex: Math.max(0, Math.min((frames.length-1)||0, frameIdx)) });
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

function handleMousePressed(e, cam) {
  if (!active) return;
  // use global mouseX/mouseY (p5) for accurate pos
  const btn = (typeof e.button === 'number') ? e.button : 0;
  const { wx, wy } = screenToWorld(mouseX, mouseY, cam);
  if (btn === 0) {
    // left click -> place
    placeItemAtWorld(wx, wy, currentFrame);
  } else if (btn === 2) {
    // right click -> remove nearest
    removeNearest(wx, wy, 32);
  }
}

function handleWheel(deltaY, cam) {
  if (!active) return;
  // deltaY > 0 -> wheel down -> previous frame
  if (deltaY > 0) currentFrame = (currentFrame - 1 + Math.max(1, frames.length)) % Math.max(1, frames.length);
  else currentFrame = (currentFrame + 1) % Math.max(1, frames.length);
}

function drawStageEditor(cam = { x:0,y:0,zoom:1 }) {
  if (!active) return;
  push();
  // dark overlay for editor mode
  noStroke();
  fill(8, 12, 18, 140);
  rect(0, 0, width, height);

  // draw grid hint
  stroke(30, 40);
  strokeWeight(1);
  const grid = 32;
  for (let gx = 0; gx < width; gx += grid) line(gx, 0, gx, height);
  for (let gy = 0; gy < height; gy += grid) line(0, gy, width, gy);
  noStroke();

  // draw placed items in world -> projected
  for (let it of items) {
    const frm = frames[it.frameIndex];
    const { sx, sy } = worldToScreen(it.x + (frm?.width ? 0 : 0), it.y, cam);
    push();
    translate(sx, sy);
    // pixelated, scaled small and translucent
    noSmooth();
    tint(255, 220);
    const drawW = Math.round(28);
    const drawH = Math.round(28 * (frm ? (frm.height / (frm.width / (frm.height || 1)) ) : 1));
    try {
      // if spritesheet detect frames horizontally -> draw first subframe (heuristic)
      if (frm && frm.width && frm.height) {
        const frameCount = Math.max(1, Math.round(frm.width / frm.height));
        const srcW = Math.round(frm.width / frameCount);
        image(frm, 0, 0, drawW, drawH, 0, 0, srcW, frm.height);
      } else if (frm) {
        image(frm, 0, 0, drawW, drawH);
      }
    } catch (e) {
      // fallback rectangle
      fill(180, 140);
      rect(0, 0, drawW, drawH);
    }
    noTint();
    smooth();
    pop();
  }

  // draw preview following mouse (world snapped)
  const { wx: mWx, wy: mWy } = screenToWorld(mouseX, mouseY, cam);
  const { sx: pmx, sy: pmy } = worldToScreen(Math.round(mWx), Math.round(mWy), cam);
  push();
  translate(pmx, pmy);
  noSmooth();
  if (frames.length > 0) {
    const pf = frames[currentFrame];
    tint(255, previewAlpha);
    try {
      const drawW = 28, drawH = 28;
      const frameCount = Math.max(1, Math.round(pf.width / pf.height));
      const srcW = Math.round(pf.width / frameCount);
      image(pf, 0, 0, drawW, drawH, 0, 0, srcW, pf.height);
    } catch (e) {
      fill(255, 170); rect(0, 0, 28, 28);
    }
    noTint();
    smooth();
  } else {
    fill(200, 80); rect(0, 0, 28, 28);
  }
  // simple crosshair
  stroke(255, 200); strokeWeight(1);
  line(-12, 0, 12, 0); line(0, -12, 0, 12);
  pop();

  // UI panel top-right: export button + frame index preview
  push();
  const panelW = 220, panelH = 86;
  const px = width - panelW - 12, py = 12;
  fill(18, 22, 28, 240);
  stroke(255, 16);
  rect(px, py, panelW, panelH, 8);
  noStroke();
  fill(220);
  textAlign(LEFT, TOP);
  textSize(12);
  text(`Stage editor: ${frames.length} item frames`, px + 10, py + 8);
  text(`Selected frame: ${currentFrame}`, px + 10, py + 26);
  text('LMB: place  ·  RMB: remove  ·  Wheel: cycle frames', px + 10, py + 44);

  // Export button
  const bx = px + panelW - 92, by = py + 10, bw = 78, bh = 28;
  fill(70, 120, 200);
  rect(bx, by, bw, bh, 6);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(13);
  text('EXPORT', bx + bw/2, by + bh/2);
  // detect click on EXPORT (use mouseIsPressed/position)
  if (mouseIsPressed && mouseButton === LEFT) {
    // click detection: only trigger if mouse press happened inside button this frame
    if (mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh) {
      // print JSON to console
      console.log('[StageEditor] export', JSON.stringify(items, null, 2));
      // small visual feedback (simple)
      // Note: avoid spamming; user will see console output
    }
  }
  pop();

  pop();
}

function exportItems() {
  console.log('[StageEditor] items ->', JSON.stringify(items, null, 2));
  return JSON.stringify(items);
}

function loadStageItems(jsonOrArray) {
  try {
    const arr = (typeof jsonOrArray === 'string') ? JSON.parse(jsonOrArray) : jsonOrArray;
    if (!Array.isArray(arr)) throw new Error('expected array');
    // basic validation
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