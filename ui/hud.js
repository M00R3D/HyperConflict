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

function drawHealthBars(p1, p2, heartFrames, bootFrames) {
   const heartsCount = 6;
   const quartersPerHeart = 4;
   const totalQuartersMax = heartsCount * quartersPerHeart; // 24
  // ahora 8 botas (doble stamina), dibujadas en 2 filas x 4 columnas, tamaño reducido
  const bootsCount = 8;
  const quartersPerBoot = 4;
  const totalBootQuartersMax = bootsCount * quartersPerBoot; // 32

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
  // boots drawing area (below hearts) - display más pequeño y en grid 2x4
  const bootW = 18; // más pequeño
  const bootH = 18;
  const bootPadding = 6;
  const cols = 4; // columns per row
  const rows = Math.ceil(bootsCount / cols); // 2
  const bootGroupWidth = cols * (bootW + bootPadding) - bootPadding;
  const bootsY = y + heartH + 10; // vertical offset under hearts

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

   // draw boots for a player (mirrored layout for P2)
   const drawPlayerBoots = (player, xStart, alignRight = false) => {
     const rawSt = (typeof player?.stamina === 'number') ? player.stamina : 0;
     const pMax = (typeof player?.staminaMax === 'number' && player.staminaMax > 0) ? player.staminaMax : totalBootQuartersMax;
     // map player's actual stamina range to 0..totalBootQuartersMax
     const st = Math.max(0, Math.min(totalBootQuartersMax, Math.round(rawSt * totalBootQuartersMax / pMax)));
 
     // cuantos cuartos se han consumido en total (0..totalBootQuartersMax)
     const consumedTotal = Math.max(0, totalBootQuartersMax - st);
 
     const bs = _getBootState(player, bootsCount);
 
     // Wavy / keyboard pattern config
     const globalTime = millis() / 1000;
     const baseFreq = 0.9; // base cycles per second (tweak for speed)
     const patterns = ['sine','pulse','stair','keyboard']; // cycled per-boot

     for (let i = 0; i < bootsCount; i++) {
       // grid position (rows x cols)
       const col = i % cols;
       const row = Math.floor(i / cols);
       // logical ordering: left-to-right top-to-bottom for P1; mirrored for P2
       const logicalIdx = alignRight ? (bootsCount - 1 - i) : i;
       // consumido en esta bota (0..quartersPerBoot)
       const consumedInBoot = Math.max(0, Math.min(quartersPerBoot, consumedTotal - logicalIdx * quartersPerBoot));
       // frameIndex = cuartos consumidos en esta bota -> 0=full, 4=empty
       const frameIndex = Math.max(0, Math.min(quartersPerBoot, consumedInBoot));

       // compute dx/dy in grid
       const leftBootsStart = 12;
       const rightBootsStart = Math.round(width - 12 - bootGroupWidth); // leftmost x for P2 group
       const baseX = alignRight ? rightBootsStart : leftBootsStart;
       const dx = baseX + col * (bootW + bootPadding);
       const dy = bootsY + row * (bootH + 6);

       // actualizar estado de escala por bota: target cuando empty -> shrink, cuando full -> normal
       const isEmpty = (frameIndex === quartersPerBoot);
       const targetScale = isEmpty ? 0.6 : 1.0;
       // iniciar valor si falta
       bs.scales[i] = (typeof bs.scales[i] === 'number') ? bs.scales[i] : targetScale;
       // interpolación suave (usar lerp de p5)
       bs.scales[i] = lerp(bs.scales[i], targetScale, 0.12);

       // PATTERN: elegir alternancia por índice para "teclado gamer" feel
       const pattern = patterns[i % patterns.length];
       // parámetros por-pattern
       const ampBase = 6; // px max amplitude baseline
       let targetOffsetY = 0;
       let targetOffsetX = 0;
       const freq = baseFreq * (1 + (i % 3) * 0.12); // slight per-boot freq variance
       const phase = i * 0.5;

       if (pattern === 'sine') {
         targetOffsetY = Math.sin((globalTime * freq * Math.PI * 2) + phase) * (ampBase * 0.6);
         targetOffsetX = Math.sin((globalTime * freq * Math.PI * 2) + phase * 0.7) * 1.2;
       } else if (pattern === 'pulse') {
         // soft pulse: abs(sin) shaped bounce
         const v = Math.abs(Math.sin((globalTime * freq * Math.PI) + phase));
         // remap 0..1 to -1..1 and apply easing
         targetOffsetY = (v * 2 - 1) * (ampBase * 0.72);
         targetOffsetX = Math.sin(globalTime * freq * Math.PI * 2 + phase) * 0.9;
       } else if (pattern === 'stair') {
         // stair / keyboard-step: emulate stepped keys using sawtooth then smooth
         const t = (globalTime * freq + i * 0.08) % 1;
         // create 3-step stair [-1,0,1]
         const step = Math.floor(t * 3) / 1 - 1;
         targetOffsetY = step * (ampBase * 0.65);
         targetOffsetX = Math.sin(globalTime * freq * Math.PI * 2 + phase) * 0.6;
       } else { // keyboard
         // keyboard gamer: alternating quick arpeggio: small upward bounce per adjacent boot
         const sign = (i % 2 === 0) ? 1 : -1;
         const ar = Math.sin((globalTime * freq * Math.PI * 2 * 1.6) + (i * 0.33));
         targetOffsetY = (ar * 0.8 + sign * 0.15) * (ampBase * 0.7);
         targetOffsetX = Math.sin(globalTime * freq * Math.PI * 2 + phase * 1.2) * 1.6;
       }

       // INIT offsets if missing
       bs.offsetY[i] = (typeof bs.offsetY[i] === 'number') ? bs.offsetY[i] : 0;
       bs.offsetX[i] = (typeof bs.offsetX[i] === 'number') ? bs.offsetX[i] : 0;
       // smooth interpolation toward target offsets
       bs.offsetY[i] = lerp(bs.offsetY[i], targetOffsetY, 0.12);
       bs.offsetX[i] = lerp(bs.offsetX[i], targetOffsetX, 0.14);

       // tiny pulse when just became empty/full (opcional subtle feedback)
             if (bs.lastFrame[i] !== frameIndex) {
               bs.lastFrame[i] = frameIndex;
               bs.pulseStart[i] = millis();
             }
      
             // small pulse when the frame changed
             const pulseAge = millis() - (bs.pulseStart[i] || 0);
             let pulseScale = 1;
             if (bs.pulseStart[i] && pulseAge > 0 && pulseAge < 220) {
               const t = pulseAge / 220;
               // ease out pulse
               pulseScale = 1 + 0.14 * (1 - Math.pow(1 - t, 2));
             }
      
             // compute final scale and draw (apply offsets and flip if needed)
             const finalScale = Math.max(0.01, bs.scales[i] * pulseScale);
             const drawX = Math.round(dx + (bs.offsetX[i] || 0));
             const drawY = Math.round(dy + (bs.offsetY[i] || 0));
             drawBootAt(frameIndex, drawX, drawY, !!alignRight, finalScale);
           } // end for bootsCount
      
         }; // end drawPlayerBoots
      
         // draw boots groups for both players
         drawPlayerBoots(p1, leftX, false);
         drawPlayerBoots(p2, rightStart, true);

} // end drawHealthBars
// export API
export { drawInputQueues, drawHealthBars };
