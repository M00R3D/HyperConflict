// ui/hud.js
// Exporta drawHealthBars y drawInputQueues que reciben explicitamente player1/player2

// State to track per-player heart frames + shake timings
const _heartStateByPlayer = new Map();

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
  const centerX = width / 2;
  const y = 40;
  const spacing = 22;
  textSize(14);
  textAlign(CENTER, CENTER);

  const drawBuffer = (buf, x, bufferDuration = 1400) => {
    for (let i = 0; i < buf.length; i++) {
      const entry = buf[i];
      const age = millis() - entry.time;
      const alpha = map(age, 0, bufferDuration, 255, 0);
      fill(255, alpha);
      noStroke();
      text(entry.symbol, x + i * spacing - (buf.length - 1) * spacing / 2, y);
    }
  };

  drawBuffer(p1.inputBuffer || [], centerX - 140, p1.inputBufferDuration);
  drawBuffer(p2.inputBuffer || [], centerX + 140, p2.inputBufferDuration);
}

function drawHealthBars(p1, p2, heartFrames) {
  const heartsCount = 6;
  const quartersPerHeart = 4;
  const totalQuartersMax = heartsCount * quartersPerHeart; // 24

  // pick first non-empty layer (some .piskel exports put frames in layer 1)
  const layer = (Array.isArray(heartFrames) ? heartFrames.find(l => Array.isArray(l) && l.length > 0) : null);
  if (!layer) {
    push();
    fill(255);
    textSize(14);
    textAlign(LEFT, TOP);
    text(`HP P1: ${Math.max(0, p1?.hp ?? 0)}/${totalQuartersMax}`, 12, 8);
    textAlign(RIGHT, TOP);
    text(`HP P2: ${Math.max(0, p2?.hp ?? 0)}/${totalQuartersMax}`, width - 12, 8);
    pop();
    return;
  }

  // sanity checks
  const anyValidImg = layer.some(img => img && img.width && img.height);
  if (!anyValidImg) {
    console.warn('drawHealthBars: heart layer found but no valid images in frames — comprobar .piskel / loader output', layer);
  }

  // sizing and positions
  const heartW = 32;
  const heartH = 32;
  const padding = 6;
  const groupWidth = heartsCount * (heartW + padding) - padding;
  const y = 8;

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

  // draw P1 on left, P2 on right
  const leftX = 12;
  // For P2 we start from the right edge: place the rightmost heart at rightStart and
  // draw each next heart to the left (mirrored layout).
  const rightStart = width - 12 - heartW; // x coordinate of the rightmost heart
  drawPlayerHearts(p1, leftX, false);
  drawPlayerHearts(p2, rightStart, true);

  // DEBUG: mostrar hp numérico debajo de cada grupo de corazones solo si SHOW_DEBUG_OVERLAYS está activo
  if (window.SHOW_DEBUG_OVERLAYS) {
    push();
    noStroke();
    fill(255);
    textSize(12);
    textAlign(LEFT, TOP);
    text(`P1 HP (quarters): ${typeof p1?.hp === 'number' ? p1.hp : 'n/a'}`, leftX, y + heartH + 6);
    // compute rightmost / group extents for P2 debug text
    const p2GroupRight = rightStart + heartW;
    textAlign(RIGHT, TOP);
    text(`P2 HP (quarters): ${typeof p2?.hp === 'number' ? p2.hp : 'n/a'}`, p2GroupRight, y + heartH + 6);
    pop();
  }
}

export { drawInputQueues, drawHealthBars };
