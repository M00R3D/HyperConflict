// ui/hud.js
// Exporta drawHealthBars y drawInputQueues que reciben explicitamente player1/player2

// State to track per-player heart frames + shake timings
const _heartStateByPlayer = new Map();

// NEW: state para boots (escala por-bota)
const _bootStateByPlayer = new Map();
function _getBootState(player, bootsCount) {
  if (!player) return null;
  let st = _bootStateByPlayer.get(player.id);
  if (!st) {
    st = {
      scales: new Array(bootsCount).fill(1), // current visual scale per boot
      lastFrame: new Array(bootsCount).fill(0), // last seen frame index
      pulseStart: new Array(bootsCount).fill(0), // optional pulse timing
      offsetY: new Array(bootsCount).fill(0), // current vertical offset per boot (wavy)
      offsetX: new Array(bootsCount).fill(0)  // small horizontal wobble per boot
    };
    _bootStateByPlayer.set(player.id, st);
  }
  return st;
}

function _getHeartState(player, heartsCount) {
  if (!player) return null;
  let st = _heartStateByPlayer.get(player.id);
  if (!st) {
    st = {
      frames: new Array(heartsCount).fill(0), // last seen frame index per heart
      shakeStart: new Array(heartsCount).fill(0), // millis() when shook
      shakeDur: new Array(heartsCount).fill(0) // duration per-heart
    };
    _heartStateByPlayer.set(player.id, st);
  }
  return st;
}

function drawInputQueues(p1, p2) {
  // proteger contra players null durante selección/escenas
  const p1Buf = (p1 && Array.isArray(p1.inputBuffer)) ? p1.inputBuffer : [];
  const p2Buf = (p2 && Array.isArray(p2.inputBuffer)) ? p2.inputBuffer : [];
  const p1BufDur = (p1 && typeof p1.inputBufferDuration === 'number') ? p1.inputBufferDuration : 1400;
  const p2BufDur = (p2 && typeof p2.inputBufferDuration === 'number') ? p2.inputBufferDuration : 1400;

  const centerX = width / 2;
  const y = 40;
  const spacing = 22;
  textSize(14);
  textAlign(CENTER, CENTER);

  const drawBuffer = (buf, x, bufferDuration = 1400) => {
    for (let i = 0; i < buf.length; i++) {
      const entry = buf[i];
      const age = millis() - (entry.time || 0);
      const alpha = map(age, 0, bufferDuration, 255, 0);
      fill(255, alpha);
      noStroke();
      text(entry.symbol, x + i * spacing - (buf.length - 1) * spacing / 2, y);
    }
  };

  drawBuffer(p1Buf, centerX - 140, p1BufDur);
  drawBuffer(p2Buf, centerX + 140, p2BufDur);
}

function drawHealthBars(p1, p2, heartFrames, bootFrames) {
   const heartsCount = 6;
   const quartersPerHeart = 4;
   const totalQuartersMax = heartsCount * quartersPerHeart; // 24
  // boots/stamina visual constants (defined to avoid ReferenceError)
  const quartersPerBoot = 4;
  const bootW = 20;
  const bootH = 20;
  // Stamina/boots removed: we no longer draw boots or stamina UI.

  // draw small life portraits (2 lives) above hearts
  const drawLifePortraits = (player, xBase, alignRight = false) => {
    if (!player) return;
    const portraits = player.livesMax || 2;
    const gap = 38;
    const size = 36;
    const slotY = 2;

    // helper: obtain the image object that represents LAYER 2 FRAME 0 (only)
    const getLayer2Frame0 = (layerContainer) => {
      if (!layerContainer) return null;
      // Case A: frames-by-layer array: layers -> frames[]
      if (Array.isArray(layerContainer) && layerContainer.length > 2 && Array.isArray(layerContainer[2])) {
        return layerContainer[1][0] || null;
      }
      // Case B: maybe the provided container is already the layer array (frames list)
      if (Array.isArray(layerContainer) && layerContainer.length > 0) {
        // if this appears to be a layer array where each item is an image/frame, return its first item
        if (layerContainer[0] && layerContainer[0].width) return layerContainer[0];
        // if it has >=3 entries, prefer the third as layer2[0]
        if (layerContainer.length > 2 && layerContainer[2] && layerContainer[2].width) return layerContainer[2];
      }
      return null;
    };

    for (let i = 0; i < portraits; i++) {
      // position (mirror for right side)
      const slotX = alignRight ? (xBase - i * (size + 6)) : (xBase + i * (size + 6));
      const active = (i < (player.lives || 0));

      // choose the single-frame image for layer 2
      let img = null;
      if (active) {
        img = getLayer2Frame0(player.idleFramesByLayer) || getLayer2Frame0(player.currentFramesByLayer) || null;
      } else {
        img = getLayer2Frame0(player.knockedFramesByLayer) || getLayer2Frame0(player.hitFramesByLayer) || null;
      }

      // hover effect (simple): scale up slightly and draw border if mouse over slot
      let scaleFactor = 1.0;
      let hovered = false;
      try {
        if (typeof mouseX === 'number' && typeof mouseY === 'number') {
          hovered = (mouseX >= slotX && mouseX <= slotX + size && mouseY >= slotY && mouseY <= slotY + size);
          if (hovered) scaleFactor = 1.08;
        }
      } catch (e) { hovered = false; }

      if (img && img.width && img.height) {
        push();
        imageMode(CORNER);
        // compute draw size and position with hover scale centered on slot
        const drawW = Math.round(size * scaleFactor);
        const drawH = Math.round(size * scaleFactor);
        const drawX = Math.round(slotX - (drawW - size) / 2);
        const drawY = Math.round(slotY - (drawH - size) / 2);

        // If the source is a spritesheet packed horizontally, crop the FIRST frame only.
        // Heuristic: if width >= height * 2 then assume horizontal frames.
        const frameCount = Math.max(1, Math.round(img.width / img.height));
        const srcW = Math.round(img.width / frameCount);
        const srcX = 0; // first frame

        if (!active) tint(160, 160); // slight desaturate for defeated portrait
        // draw only the first subframe
        try {
          image(img, drawX, drawY, drawW, drawH, srcX, 0, srcW, img.height);
        } catch (e) {
          // fallback to drawing whole image if cropping fails
          image(img, drawX, drawY, drawW, drawH);
        }
        noTint();

        if (hovered) {
          noFill();
          strokeWeight(2);
          stroke(255, 220, 120);
          rect(slotX - 2, slotY - 2, size + 4, size + 4, 6);
        }
        pop();
        continue;
      }

      // fallback: simple rectangle with color indicating active/defeated
      push();
      noStroke();
      fill(active ? 200 : 80);
      rect(slotX, slotY, size, size, 6);
      pop();
    }
  };

  // compute left/right base for portraits (above heart groups)
  const leftPortraitX = 12;
  const rightPortraitX = Math.round(width - 12 - (32)); // start for right-most icon
  drawLifePortraits(p1, leftPortraitX, false);
  drawLifePortraits(p2, rightPortraitX, true);

  // pick first non-empty layer (some .piskel exports put frames in layer 1)
  const layer = (Array.isArray(heartFrames) ? heartFrames.find(l => Array.isArray(l) && l.length > 0) : null);
  if (!layer) {
    push();
    fill(255);
    textSize(14);
    textAlign(LEFT, TOP);
    text(`HP P1: ${Math.max(0, p1?.hp ?? 0)}/${totalQuartersMax}`, 12, 8 + 44); // shift down because portraits occupy top area
    textAlign(RIGHT, TOP);
    text(`HP P2: ${Math.max(0, p2?.hp ?? 0)}/${totalQuartersMax}`, width - 12, 8 + 44);
    pop();
    return;
  }

  // adjust hearts drawing Y to be below portraits
  const heartYOffset = 44;
  const heartW = 32;
  const heartH = 32;
  const padding = 6;
  const groupWidth = heartsCount * (heartW + padding) - padding;
  const y = heartYOffset;
  // no boots UI

  // WAVE motion config (smooth up/down motion)
  const waveAmp = 2;            // pixels of vertical amplitude
  const waveFreqHz = 0.9;       // cycles per second
  const timeSec = millis() / 1000;
  // phase offset between hearts so they form a wave
  const phaseStep = 0.5;
  // slight phase difference between left/right groups for visual variety
  const rightPhaseOffset = Math.PI * 0.25;

  // SHAKE config
  const shakeMaxAmp = 6; // px max shake
  const shakeDurDefault = 260; // ms

  // Helper: draw a single heart state using either individual frame image
  // or a spritesheet in layer[0] (horizontal frames).
  const drawHeartAt = (frameIndex, dx, dy, flip = false, shakeOffset = {x:0,y:0}) => {
    // Prefer explicit indexed frame if available
    let img = (layer && layer[frameIndex]) ? layer[frameIndex] : null;

    // expected number of subframes per heart (full, 3/4, 1/2, 1/4, empty)
    const expectedVariants = quartersPerHeart + 1; // 5

    // wrapper to draw an image (with optional src cropping) respecting flip & shake
    const blit = (srcImg, sx, sy, sW, sH, dxLocal, dyLocal, dW, dH) => {
      // round everything to integers for crisp nearest-neighbor sampling
      const finalX = Math.round(dxLocal + (shakeOffset.x || 0));
      const finalY = Math.round(dyLocal + (shakeOffset.y || 0));
      const dstW = Math.round(dW);
      const dstH = Math.round(dH);
      const srcX = Math.round(sx);
      const srcY = Math.round(sy);
      const srcW = Math.max(1, Math.round(sW));
      const srcH = Math.max(1, Math.round(sH));
      if (flip) {
        push();
        // flip horizontally around the heart rect
        translate(finalX + dstW, finalY);
        scale(-1, 1);
        image(srcImg, 0, 0, dstW, dstH, srcX, srcY, srcW, srcH);
        pop();
      } else {
        image(srcImg, finalX, finalY, dstW, dstH, srcX, srcY, srcW, srcH);
      }
    };

    if (img && img.width && img.height) {
      const internalFrames = Math.max(1, Math.round(img.width / img.height));
      const srcW = Math.round(img.width / internalFrames);
      const subIndex = Math.min(internalFrames - 1, frameIndex);
      const srcX = subIndex * srcW;
      if (internalFrames > 1) {
        blit(img, srcX, 0, srcW, img.height, dx, dy, heartW, heartH);
      } else {
        blit(img, 0, 0, img.width, img.height, dx, dy, heartW, heartH);
      }
      return;
    }

    // Fallback: maybe the piskel exported a single spritesheet in layer[0] only.
    const sheet = layer[0];
    if (!sheet || !sheet.width || !sheet.height) {
      // final fallback draw rect
      push(); noStroke(); fill(200); rect(dx, dy, heartW, heartH, 6); pop();
      return;
    }

    // detect how many frames are packed horizontally in the sheet
    const sheetFrames = Math.max(1, Math.round(sheet.width / sheet.height));
    const clampedIndex = Math.max(0, Math.min(sheetFrames - 1, frameIndex));
    const srcW = Math.round(sheet.width / sheetFrames);
    const srcX = clampedIndex * srcW;
    blit(sheet, srcX, 0, srcW, sheet.height, dx, dy, heartW, heartH);
  };

  // helper to draw a player's hearts (with shake detection)
  const drawPlayerHearts = (player, xStart, alignRight = false) => {
    const hp = Math.max(0, Math.min(totalQuartersMax, player?.hp ?? 0));
    const state = _getHeartState(player, heartsCount);

    for (let i = 0; i < heartsCount; i++) {
      // choose logical heart index so hearts always decrement from the rightmost heart
      // For P1 (alignRight=false) logicalIndex = i (left->right).
      // For P2 (alignRight=true) logicalIndex = heartsCount-1-i so we map the rightmost drawn
      // heart to the highest logical index and ensure quarters are removed from the right.
      const logicalIndex = alignRight ? (heartsCount - 1 - i) : i;
      // remaining quarters for this logical heart (0..4)
      const remaining = Math.max(0, Math.min(quartersPerHeart, hp - logicalIndex * quartersPerHeart));

      // desired frame index: 0 = full (4 quarters), last = empty (0 quarters)
      const frameIndex = Math.max(0, Math.min(quartersPerHeart, (quartersPerHeart - remaining)));

      // compute dx
      const dx = alignRight
        ? (xStart - i * (heartW + padding))
        : (xStart + i * (heartW + padding));

      // compute smooth vertical wave offset per-heart
      const basePhase = i * phaseStep;
      const phase = basePhase + (alignRight ? rightPhaseOffset : 0);
      const wobble = Math.sin((timeSec * waveFreqHz * (Math.PI * 2)) + phase) * waveAmp;
      const dy = y + wobble;

      // detect change and start shake
      if (state && typeof state.frames[i] === 'number' && state.frames[i] !== frameIndex) {
        state.frames[i] = frameIndex;
        state.shakeStart[i] = millis();
        state.shakeDur[i] = shakeDurDefault;
      } else if (state && typeof state.frames[i] !== 'number') {
        state.frames[i] = frameIndex;
        state.shakeStart[i] = 0;
        state.shakeDur[i] = 0;
      }

      // compute shake offset if within duration
      let shakeOffset = { x: 0, y: 0 };
      if (state && state.shakeStart[i] && (millis() - state.shakeStart[i] < (state.shakeDur[i] || 0))) {
        const elapsed = millis() - state.shakeStart[i];
        const t = elapsed / (state.shakeDur[i] || 1);
        const fall = 1 - Math.pow(Math.min(1, t), 2); // ease out
        // use sin + random phase per-heart for natural shake
        const phaseSeed = (i * 37) % 100 / 100;
        const shakeX = Math.sin((elapsed / 30) + phaseSeed * Math.PI * 2) * shakeMaxAmp * fall;
        const shakeY = Math.cos((elapsed / 24) + phaseSeed * 1.3) * (shakeMaxAmp * 0.45) * fall;
        shakeOffset = { x: shakeX, y: shakeY };
      }

      // flip sprite horizontally for P2 (alignRight) so the heart visuals are mirrored
      drawHeartAt(frameIndex, dx, dy, !!alignRight, shakeOffset);
    }
  };
 
  // draw P1 hearts/boots on left, P2 on right
  const leftX = 12;
  const rightStart = width - 12 - heartW; // rightmost heart x for P2
  drawPlayerHearts(p1, leftX, false);
  drawPlayerHearts(p2, rightStart, true);
 
  // --- DRAW BOOTS (below hearts) ---
  const bootLayer = (Array.isArray(bootFrames) ? bootFrames.find(l => Array.isArray(l) && l.length > 0) : null);

  if (!bootLayer) {
    console.warn('drawHealthBars: no boot frames found (bootFrames)', bootFrames);
  } else {
    if (typeof console !== 'undefined' && bootLayer.length !== undefined) {
      // console.log('drawHealthBars: bootLayer frames', bootLayer.length);
    }
  }

  // Preferir usar un único sheet (si existe) con 5 variantes horizontales.
  const bootSheet = (bootLayer && bootLayer.length > 0) ? bootLayer[0] : null;
  const expectedVariants = quartersPerBoot + 1; // 5

  const drawBootAt = (frameIndex, dx, dy, flip = false, scl = 1) => {
    imageMode(CORNER);
    noTint();

    // compute destination size from scale
    const dstW = Math.round(bootW * (scl || 1));
    const dstH = Math.round(bootH * (scl || 1));
    // adjust dx/dy to keep boot visually centered within its slot
    const adjX = Math.round(dx + (bootW - dstW) / 2);
    const adjY = Math.round(dy + (bootH - dstH) / 2);

    // Caso preferido: usamos bootSheet (una imagen con N subframes horizontales)
    if (bootSheet && bootSheet.width && bootSheet.height) {
      const sheetFrames = Math.max(1, Math.round(bootSheet.width / bootSheet.height));
      // usar expectedVariants si el sheet tiene al menos esa cantidad, si no usar sheetFrames reales
      const useFrames = (sheetFrames >= expectedVariants) ? expectedVariants : sheetFrames;
      const subIndex = Math.max(0, Math.min(useFrames - 1, frameIndex));
      const srcW = Math.round(bootSheet.width / useFrames);
      const srcX = Math.round(subIndex * srcW);

      push();
      if (flip) {
        translate(adjX + dstW, adjY);
        scale(-1, 1);
        image(bootSheet, 0, 0, dstW, dstH, srcX, 0, srcW, bootSheet.height);
      } else {
        image(bootSheet, adjX, adjY, dstW, dstH, srcX, 0, srcW, bootSheet.height);
      }
      pop();
      return;
    }

    // Fallback: si no hay sheet pero la capa contiene varios frames por separado:
    const layerImg = bootLayer;
    if (!layerImg || layerImg.length === 0) {
      push(); noStroke(); fill(180, 200, 100); rect(adjX, adjY, dstW, dstH, 4); pop();
      return;
    }

    // Si hay múltiples imágenes (una por variante), usar la que corresponda
    if (layerImg.length > 1) {
      const idx = Math.max(0, Math.min(layerImg.length - 1, frameIndex));
      const frameImg = layerImg[idx];
      if (!frameImg || !frameImg.width || !frameImg.height) {
        push(); noStroke(); fill(180, 200, 100); rect(adjX, adjY, dstW, dstH, 4); pop(); return;
      }
      push();
      if (flip) { translate(adjX + dstW, adjY); scale(-1, 1); image(frameImg, 0, 0, dstW, dstH); }
      else { image(frameImg, adjX, adjY, dstW, dstH); }
      pop();
      return;
    }

    // último recurso: dibujar rect fallback
    push(); noStroke(); fill(180, 200, 100); rect(adjX, adjY, dstW, dstH, 4); pop();
  };

  // Boots/stamina UI removed.

 } // end drawHealthBars

function drawOffscreenIndicators(cam, players = []) {
  if (!cam || !Array.isArray(players) || players.length === 0) return;
  const pad = 18;
  const indicatorSize = 46;
  const spriteDrawSize = 36;
  const cx = width / 2;
  const cy = height / 2;
  const halfw = width / 2 - pad;
  const halfh = height / 2 - pad;
  const camYOffset = map(cam.zoom || 1, 0.6, 1.5, 80, 20);

  const worldToScreen = (wx, wy) => {
    const sx = ((wx - (cam.x || 0)) * (cam.zoom || 1)) + width / 2;
    const sy = ((wy - (cam.y || 0)) * (cam.zoom || 1)) + height / 2 + camYOffset;
    return { sx, sy };
  };

  // helper: pick a single-frame image from a given layer container (array-of-frames or spritesheet)
  const pickFromLayer = (layer, frameIndex = 0) => {
    if (!layer) return null;
    if (Array.isArray(layer) && layer.length > 0 && layer[0] && layer[0].width) {
      return layer[Math.min(frameIndex, layer.length - 1)] || layer[0];
    }
    if (layer && layer.width && layer.height) return layer;
    return null;
  };

  push();
  imageMode(CENTER);
  // do NOT change global smoothing state — use per-buffer noSmooth() below
  for (const p of players) {
    if (!p) continue;

    const wx = (p.x || 0) + ((p.w || 0) / 2);
    const wy = (p.y || 0) + ((p.h || 0) / 2);
    const { sx, sy } = worldToScreen(wx, wy);

    // on-screen (with small margin) -> skip
    if (sx >= -pad && sx <= width + pad && sy >= -pad && sy <= height + pad) continue;

    // direction vector from screen center to projected point
    const dx = sx - cx;
    const dy = sy - cy;
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) continue;

    // compute intersection scale with screen rect (cx +/- halfw, cy +/- halfh)
    const tx = dx !== 0 ? halfw / Math.abs(dx) : Infinity;
    const ty = dy !== 0 ? halfh / Math.abs(dy) : Infinity;
    const t = Math.min(tx, ty);
    const ix = Math.round(cx + dx * t);
    const iy = Math.round(cy + dy * t);

    push();
    translate(ix, iy);

    // background circle
    noStroke();
    fill(12, 18, 28, 220);
    ellipse(0, 0, indicatorSize + 10, indicatorSize + 10);

    // choose current frame image preferring LAYER 1, fallback to other layers
    let img = null;
    let frameIndex = Math.max(0, Math.floor(p.frameIndex || 0));
    const framesByLayer = p.currentFramesByLayer || p.idleFramesByLayer || [];
    const preferredIdx = 1; // prefer layer 1

    const tryLayers = [];
    if (Array.isArray(framesByLayer)) {
      if (framesByLayer.length > preferredIdx) tryLayers.push(framesByLayer[preferredIdx]);
      if (framesByLayer.length > 0) tryLayers.push(framesByLayer[0]);
      for (let li = 0; li < framesByLayer.length; li++) if (li !== 0 && li !== preferredIdx) tryLayers.push(framesByLayer[li]);
    } else {
      tryLayers.push(framesByLayer);
    }
    if (p.idleFramesByLayer && !tryLayers.includes(p.idleFramesByLayer)) tryLayers.push(p.idleFramesByLayer);

    for (const layer of tryLayers) {
      img = pickFromLayer(layer, frameIndex);
      if (img) break;
    }

    // If we have an image, render it into a tiny offscreen buffer (pixel buffer) and scale up
    if (img && img.width && img.height) {
      // low resolution target for pixelation (smaller -> blockier)
      const lowResSize = 8; // tweak: 6..16. Lower = more blocky
      const g = createGraphics(lowResSize, lowResSize);
      g.pixelDensity(1);
      g.noSmooth(); // ensure buffer is rendered with nearest-neighbor inside
      g.clear();
      g.push();
      g.imageMode(CORNER);

      // detect spritesheet packed horizontally and crop the desired frame into the tiny buffer
      const frameCount = Math.max(1, Math.round(img.width / img.height));
      const srcW = Math.round(img.width / frameCount);
      const srcX = Math.round(Math.min(frameCount - 1, frameIndex) * srcW);
      try {
        g.image(img, 0, 0, lowResSize, lowResSize, srcX, 0, srcW, img.height);
      } catch (e) {
        // fallback draw full image scaled down
        g.image(img, 0, 0, lowResSize, lowResSize);
      }
      g.pop();

      // Optionally apply a small blur on the tiny buffer BEFORE scaling to soften pixel edges (uncomment to use)
      // g.filter(BLUR, 1);

      // draw the tiny buffer scaled up onto main canvas; main canvas keeps smooth state unchanged
      // we want a pixelated look so draw the tiny buffer scaled up but with no smoothing:
      // temporarily switch global noSmooth() then restore to avoid affecting other draws:
      noSmooth();
      image(g, 0, 0, spriteDrawSize, spriteDrawSize);
      // restore smoothing (use smooth() to return to previous behaviour)
      smooth();

      // dispose reference (p5 will handle memory, but clear var to avoid accidental reuse)
      // (no explicit removeGraphics API in p5; leaving g for GC)
    } else {
      // fallback: small colored rect with char initial
      noStroke();
      fill(140, 140, 140, 200);
      rectMode(CENTER);
      rect(0, 0, spriteDrawSize * 0.86, spriteDrawSize * 0.86, 6);
      fill(255, 220);
      textAlign(CENTER, CENTER);
      textSize(12);
      text((p.charId || p.id || '?').toString().charAt(0).toUpperCase(), 0, 0);
    }

    // border
    noFill();
    stroke(220, 200);
    strokeWeight(2);
    ellipse(0, 0, indicatorSize + 10, indicatorSize + 10);

    // small arrow pointing inward
    const ang = Math.atan2(dy, dx);
    const arrowDist = (indicatorSize / 2) + 6;
    const ax = Math.round(Math.cos(ang) * arrowDist);
    const ay = Math.round(Math.sin(ang) * arrowDist);
    push();
    translate(ax, ay);
    rotate(ang);
    noStroke();
    fill(220, 200);
    triangle(0, -6, 0, 6, 10, 0);
    pop();

    pop();
  }
  pop();
}

// expose to window for compatibility if not imported
if (typeof window !== 'undefined') window.drawOffscreenIndicators = drawOffscreenIndicators;

// export API (ensure function still exported at file bottom)
export { drawInputQueues, drawHealthBars, drawOffscreenIndicators };
