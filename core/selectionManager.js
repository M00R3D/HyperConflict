import { keysPressed, keysDown, keysUp } from './input.js';

// Local selection state (protegemos contra ReferenceError si main no exporta estas)
let choices = ['tyeman','sbluer','fernando'];
let p1Confirmed = false;
let p2Confirmed = false;
let p1Choice = 0;
let p2Choice = 1;
let p1SelIndex = 0;
let p2SelIndex = 1;
let _fernandoAssets = null;
export function drawCharacterSelect() {
  // If main cleared selection state (via window) prefer that authoritative value
  try {
    if (typeof window !== 'undefined') {
      // read authoritative values if present on window (allow main.resetToSelection to take effect)
      if (typeof window.choices !== 'undefined' && Array.isArray(window.choices)) choices = window.choices;
      if (typeof window.p1Confirmed !== 'undefined') p1Confirmed = !!window.p1Confirmed;
      if (typeof window.p2Confirmed !== 'undefined') p2Confirmed = !!window.p2Confirmed;
      if (typeof window.p1Choice !== 'undefined') p1Choice = Number(window.p1Choice) || 0;
      if (typeof window.p2Choice !== 'undefined') p2Choice = Number(window.p2Choice) || 0;
      if (typeof window.p1SelIndex !== 'undefined') p1SelIndex = Number(window.p1SelIndex) || 0;
      if (typeof window.p2SelIndex !== 'undefined') p2SelIndex = Number(window.p2SelIndex) || 0;
      // then mirror local values back to window to keep a single sync point
      window.choices = choices;
      window.p1Confirmed = p1Confirmed;
      window.p2Confirmed = p2Confirmed;
      window.p1Choice = p1Choice;
      window.p2Choice = p2Choice;
      window.p1SelIndex = p1SelIndex;
      window.p2SelIndex = p2SelIndex;
    }
  } catch (e) {}
  background(12, 18, 28);
  fill(255);textAlign(CENTER, CENTER);textSize(28);
  text("Selecciona tu personaje", width/2, 48);
  // obtener assets globales (defensivo): main.js expone window._tyemanAssets, etc.
  const globals = (typeof window !== 'undefined') ? {
    _tyemanAssets: window._tyemanAssets || null,
    _sbluerAssets: window._sbluerAssets || null,
    _fernandoAssets: window._fernandoAssets || null,
    _slotAssets: window._slotAssets || null,
    _heartFrames: window._heartFrames || null,
    _bootFrames: window._bootFrames || null
  } : { _tyemanAssets: null, _sbluerAssets: null, _fernandoAssets: null, _slotAssets: null, _heartFrames: null, _bootFrames: null };
  const _tyemanAssets = globals._tyemanAssets;
  const _sbluerAssets = globals._sbluerAssets;
  _fernandoAssets = globals._fernandoAssets;
  const _slotAssets = globals._slotAssets;
  const _heartFrames = globals._heartFrames;
  const _bootFrames = globals._bootFrames;
  const cols = 3;const rows = 2;
  const cellSize = 72;const cellGap = 12;const gridW = cols * cellSize + (cols - 1) * cellGap;
  const gridH = rows * cellSize + (rows - 1) * cellGap;const gridX = Math.round((width - gridW) / 2);const gridY = Math.round((height - gridH) / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const ix = gridX + c * (cellSize + cellGap);const iy = gridY + r * (cellSize + cellGap);
      push();noStroke();
      let slotImg = null;
      try {
        if (_slotAssets && _slotAssets.empty) {
          const res = _slotAssets.empty;
          if (Array.isArray(res)) {const layer = res.find(l => Array.isArray(l) && l.length > 0);
            if (layer && layer.length > 0) slotImg = layer[0];}
        }
      } catch (e) { slotImg = null; }
      if (slotImg && slotImg.width && slotImg.height) {
        push();imageMode(CORNER);
        const dx = Math.round(ix);const dy = Math.round(iy);
        const dw = Math.round(cellSize);const dh = Math.round(cellSize);
        image(slotImg, dx, dy, dw, dh, 0, 0, slotImg.width, slotImg.height);pop();
      } else {fill(18, 22, 30);rect(ix, iy, cellSize, cellSize, 6);}
      if (idx < choices.length) {
        const charId = choices[idx];
        const assets = (charId === 'tyeman') ? _tyemanAssets : (charId === 'sbluer') ? _sbluerAssets : (charId === 'fernando') ? _fernandoAssets : null;
        const idleLayer = (assets?.idle && assets.idle[1]) ? assets.idle[1] : (assets?.idle && assets.idle[0]) ? assets.idle[0] : null;
        const frameImg = (idleLayer && idleLayer.length) ? idleLayer[0] : null; 
        if (frameImg) {
          imageMode(CENTER);
          const frameCount = (idleLayer && idleLayer.length) ? idleLayer.length : 1;const srcFrameW = Math.max(1, Math.floor(frameImg.width / frameCount));
          const srcFrameH = frameImg.height;const maxW = cellSize - 12;const maxH = cellSize - 12;
          const ratio = Math.min(maxW / srcFrameW, maxH / srcFrameH, 1);const dw = Math.round(srcFrameW * ratio);const dh = Math.round(srcFrameH * ratio);
          image(frameImg,ix + cellSize/2, iy + cellSize/2,dw, dh,0, 0,srcFrameW, srcFrameH);
        } else {fill(120);noStroke();ellipse(ix + cellSize/2, iy + cellSize/2, cellSize * 0.45);}
      } else {push();noFill();stroke(80);strokeWeight(1);rect(ix + 6, iy + 6, cellSize - 12, cellSize - 12, 4);pop();}
      pop();
    }
  }

  const baseTauntW = 56, baseTauntH = 56;
  const p1SelectedIdx = p1Confirmed ? (p1Choice < choices.length ? p1Choice : null)
                                    : (p1SelIndex < choices.length ? p1SelIndex : null);
  if (p1SelectedIdx !== null) {
    const charId = choices[p1SelectedIdx];
    const assets = (charId === 'tyeman') ? _tyemanAssets : (charId === 'sbluer') ? _sbluerAssets : (charId === 'fernando') ? _fernandoAssets : null;
    const tauntLayer = (assets?.taunt && assets.taunt[1]) ? assets.taunt[1] : (assets?.taunt && assets.taunt[0]) ? assets.taunt[0] : null;
    const tauntImg = (tauntLayer && tauntLayer.length) ? tauntLayer[0] : null;
    if (tauntImg) {
      push();
      imageMode(CORNER);
      tint(255, 240);
      const tCount = (tauntLayer && tauntLayer.length) ? tauntLayer.length : 1;
      const tSrcW = Math.max(1, Math.floor(tauntImg.width / tCount));
      const tSrcH = tauntImg.height;const tRatio = Math.min(baseTauntW / tSrcW, baseTauntH / tSrcH, 1);
      const tDrawW = Math.round(tSrcW * tRatio);const tDrawH = Math.round(tSrcH * tRatio);
      const leftSlotX = gridX - baseTauntW - 18;const leftSlotY = gridY + Math.round((gridH - baseTauntH) / 2);
      const tauntDestX = leftSlotX + Math.round((baseTauntW - tDrawW) / 2);const tauntDestY = leftSlotY + Math.round((baseTauntH - tDrawH) / 2);
      image(tauntImg, tauntDestX, tauntDestY, tDrawW, tDrawH, 0, 0, tSrcW, tSrcH);
      noTint();fill(220);textSize(12);textAlign(CENTER, TOP);text(charId.toUpperCase(), tauntDestX + tDrawW/2, tauntDestY + tDrawH + 6);pop();
    } else {push();noFill();stroke(120);
      rect(gridX - baseTauntW - 18, gridY + Math.round((gridH - baseTauntH) / 2), baseTauntW, baseTauntH, 6);fill(220);textSize(12);textAlign(CENTER, TOP);
      text(choices[p1SelectedIdx].toUpperCase(), gridX - baseTauntW - 18 + baseTauntW/2, gridY + Math.round((gridH - baseTauntH) / 2) + baseTauntH + 6);pop();
    }
  }
  const p2SelectedIdx = p2Confirmed ? (p2Choice < choices.length ? p2Choice : null)
                                    : (p2SelIndex < choices.length ? p2SelIndex : null);
  if (p2SelectedIdx !== null) {
    const charId = choices[p2SelectedIdx];
    const assets = (charId === 'tyeman') ? _tyemanAssets : (charId === 'sbluer') ? _sbluerAssets : (charId === 'fernando') ? _fernandoAssets : null;
    const tauntLayer = (assets?.taunt && assets.taunt[1]) ? assets.taunt[1] : (assets?.taunt && assets.taunt[0]) ? assets.taunt[0] : null;
    const tauntImg = (tauntLayer && tauntLayer.length) ? tauntLayer[0] : null;
    if (tauntImg) {
      push();
      imageMode(CORNER);
      tint(255, 240);

      const tCount2 = (tauntLayer && tauntLayer.length) ? tauntLayer.length : 1;
      const tSrcW2 = Math.max(1, Math.floor(tauntImg.width / tCount2));
      const tSrcH2 = tauntImg.height;
      const tRatio2 = Math.min(baseTauntW / tSrcW2, baseTauntH / tSrcH2, 1);
      const tDrawW2 = Math.round(tSrcW2 * tRatio2);
      const tDrawH2 = Math.round(tSrcH2 * tRatio2);

      const rightSlotX = gridX + gridW + 18;
      const rightSlotY = gridY + Math.round((gridH - baseTauntH) / 2);

      const tauntDestX2 = rightSlotX + Math.round((baseTauntW - tDrawW2) / 2);
      const tauntDestY2 = rightSlotY + Math.round((baseTauntH - tDrawH2) / 2);

      image(tauntImg, tauntDestX2, tauntDestY2, tDrawW2, tDrawH2, 0, 0, tSrcW2, tSrcH2);

      noTint();
      fill(220);
      textSize(12);
      textAlign(CENTER, TOP);
      text(charId.toUpperCase(), tauntDestX2 + tDrawW2/2, tauntDestY2 + tDrawH2 + 6);

      pop();
    } else {
      push();
      noFill();
      stroke(120);
      rect(gridX + gridW + 18, gridY + Math.round((gridH - baseTauntH) / 2), baseTauntW, baseTauntH, 6);
      fill(220);
      textSize(12);
      textAlign(CENTER, TOP);
      text(choices[p2SelectedIdx].toUpperCase(), gridX + gridW + 18 + baseTauntW/2, gridY + Math.round((gridH - baseTauntH) / 2) + baseTauntH + 6);
      pop();
    }
  }

  // draw selection cursors (replaced: now use slot_rounder_p1 / slot_rounder_p2 animated sprites)
  function drawCursorAt(index, playerId, forcedFi = null, baseFrameCountOverride = null) {
     const r = Math.floor(index / cols);
     const c = index % cols;
     const ix = gridX + c * (cellSize + cellGap);
     const iy = gridY + r * (cellSize + cellGap);
 
     push();
     noTint();
     imageMode(CORNER);
 
     // choose the rounder asset based on playerId ('p1' or 'p2')
     let framesArr = null;
     try {
       if (_slotAssets) {
         const res = (playerId === 'p1') ? _slotAssets.rounderP1
                   : (playerId === 'p2') ? _slotAssets.rounderP2
                   : null;
         if (res && Array.isArray(res)) {
           // pick first non-empty layer (the loader returns layers[] = frames[])
           const layer = res.find(l => Array.isArray(l) && l.length > 0);
           if (layer && layer.length > 0) framesArr = layer;
         }
       }
     } catch (e) { framesArr = null; }
 
     if (framesArr && framesArr.length > 0) {
      // animate at high speed (allow forcedFi / override when caller wants precise sync)
      const frameMs = 36; // normal cursor FPS (can be overridden by caller)
 
      // Determine logical frame count:
      let baseFrameCount = baseFrameCountOverride || Math.max(1, framesArr.length);
      const sheetCandidate = framesArr[0];
      if (baseFrameCount === 1 && sheetCandidate && sheetCandidate.width && sheetCandidate.height) {
        const internal = Math.max(1, Math.round(sheetCandidate.width / sheetCandidate.height));
        baseFrameCount = internal;
      }
 
      // compute frame index (allow caller to force it)
      let fi = (typeof forcedFi === 'number') ? (forcedFi % baseFrameCount) : (Math.floor(millis() / frameMs) % baseFrameCount);
      // if P2 and we don't have a forced index, offset start by half to desync visual when drawn alone
      if (playerId === 'p2' && forcedFi === null) {
        const halfOffset = Math.floor(baseFrameCount / 2);
        fi = (fi + halfOffset) % baseFrameCount;
      }
 
      const candidate = (framesArr[fi]) ? framesArr[fi] : framesArr[0];
 
       // compute drawing rect (slightly larger than the slot to act like a border/ring)
       const pad = 6;
       const dx = Math.round(ix - pad);
       const dy = Math.round(iy - pad);
       const dw = Math.round(cellSize + pad * 2);
       const dh = Math.round(cellSize + pad * 2);
 
       if (candidate && candidate.width && candidate.height) {
         // If candidate itself is a spritesheet (width >= height * N), slice subframe.
         // Determine internal frame count inside this image.
         const internalFrames = Math.max(1, Math.round(candidate.width / candidate.height));
         if (internalFrames > 1) {
           // If framesArr had multiple entries, internalFrames may still be >1 (handle robustly)
           // Use fi modulo internalFrames to pick subframe.
           const subIndex = fi % internalFrames;
           const srcW = Math.round(candidate.width / internalFrames);
           const srcX = Math.round(subIndex * srcW);
           image(candidate, dx, dy, dw, dh, srcX, 0, srcW, candidate.height);
         } else {
           // simple single-frame image
           image(candidate, dx, dy, dw, dh, 0, 0, candidate.width, candidate.height);
         }
       } else {
         // fallback border
         noFill();
         stroke(playerId === 'p1' ? color(80,150,255) : color(255,80,80));
         strokeWeight(4);
         rect(ix - 4, iy - 4, cellSize + 8, cellSize + 8, 8);
       }
     } else {
       // fallback: legacy rect border using player colour
       noFill();
       stroke(playerId === 'p1' ? color(80,150,255) : color(255,80,80));
       strokeWeight(4);
       rect(ix - 4, iy - 4, cellSize + 8, cellSize + 8, 8);
     }
 
     pop();
   }
 
  // Si ambos cursores están sobre la misma celda y NINGUNO confirmó, dibujar alternancia rápida entre P1/P2
  if (!p1Confirmed && !p2Confirmed && p1SelIndex === p2SelIndex) {
    // Joint-slot fast alternation: much faster and frame-synced so visuals don't "cut".
    const jointFrameMs = 18;      // much faster frame step for joint mode
    const alternationMs = 90;     // alternate which player is shown every 90ms

    // load both frame arrays to compute a common baseFrameCount
    const p1Frames = (_slotAssets?.rounderP1 || []).find(l => Array.isArray(l) && l.length > 0) || [];
    const p2Frames = (_slotAssets?.rounderP2 || []).find(l => Array.isArray(l) && l.length > 0) || [];
    let baseCount = Math.max(1, p1Frames.length || 0, p2Frames.length || 0);
    // if only a single sheet exists, detect internal frames by width/height
    if (baseCount === 1) {
      const cand = p1Frames[0] || p2Frames[0];
      if (cand && cand.width && cand.height) baseCount = Math.max(1, Math.round(cand.width / cand.height));
    }

    const jointFi = Math.floor(millis() / jointFrameMs) % baseCount;
    const showP1 = Math.floor(millis() / alternationMs) % 2 === 0;
    drawCursorAt(p1SelIndex, showP1 ? 'p1' : 'p2', jointFi, baseCount);
  } else {
    // dibujar únicamente los cursores de los jugadores que NO han confirmado aún (modo normal)
    if (!p1Confirmed) drawCursorAt(p1SelIndex, 'p1');
    if (!p2Confirmed) drawCursorAt(p2SelIndex, 'p2');
  }

  // confirmations overlay
  if (p1Confirmed) {
    push();
    fill(80,150,255,40);
    rect(gridX, gridY + gridH + 12, gridW, 28, 6);
    fill(220);
    textSize(12);
    textAlign(LEFT, CENTER);
    text("Jugador 1: CONFIRMADO", gridX + 8, gridY + gridH + 26);
    pop();
  }
  if (p2Confirmed) {
    push();
    fill(255,80,80,40);
    rect(gridX, gridY + gridH + 44, gridW, 28, 6);
    fill(220);
    textSize(12);
    textAlign(LEFT, CENTER);
    text("Jugador 2: CONFIRMADO", gridX + 8, gridY + gridH + 58);
    pop();
  }

  // footer hint
  push();
  fill(180);
  textSize(12);
  textAlign(CENTER, TOP);
  text("P1: A/D/W/S mover, I confirmar.  P2: ←/→/↑/↓ mover, B confirmar.", width/2, gridY + gridH + 96);
  pop();
}

export function handleSelectionInput() {
  // snapshot previous state to detect changes
  const _prev = { p1Confirmed, p2Confirmed, p1Choice, p2Choice, p1SelIndex, p2SelIndex };
  // --- P1 movement (A/D/W/S) ---
  if (keysPressed['a'] || keysPressed['a']) {
    // left
    if ((keysPressed['a'])) {
      const cols = 3;
      const c = p1SelIndex % cols;
      const r = Math.floor(p1SelIndex / cols);
      if (c > 0) p1SelIndex = r * cols + (c - 1);
      keysPressed['a'] = false;
    }
  }
  if (keysPressed['d'] || keysPressed['d']) {
    if ((keysPressed['d'])) {
      const cols = 3;
      const c = p1SelIndex % cols;
      const r = Math.floor(p1SelIndex / cols);
      if (c < cols - 1) p1SelIndex = r * cols + (c + 1);
      keysPressed['d'] = false;
    }
  }
  if (keysPressed['w']) {
    const cols = 3;
    const c = p1SelIndex % cols;
    const r = Math.floor(p1SelIndex / cols);
    if (r > 0) p1SelIndex = (r - 1) * cols + c;
    keysPressed['w'] = false;
  }
  if (keysPressed['s']) {
    const cols = 3, rows = 2;
    const c = p1SelIndex % cols;
    const r = Math.floor(p1SelIndex / cols);
    if (r < rows - 1) p1SelIndex = (r + 1) * cols + c;
    keysPressed['s'] = false;
  }

  // P1 confirm (only if pointing to a valid character slot)
  if (!p1Confirmed && (keysPressed['i'] || keysPressed[' '])) {
    if (p1SelIndex < choices.length) {
      p1Choice = p1SelIndex;
      p1Confirmed = true;
    }
    keysPressed['i'] = false; keysPressed[' '] = false;
  }

  // --- P2 movement (arrow keys) ---
  if (keysPressed['arrowleft']) {
    const cols = 3;
    const c = p2SelIndex % cols;
    const r = Math.floor(p2SelIndex / cols);
    if (c > 0) p2SelIndex = r * cols + (c - 1);
    keysPressed['arrowleft'] = false;
  }
  if (keysPressed['arrowright']) {
    const cols = 3;
    const c = p2SelIndex % cols;
    const r = Math.floor(p2SelIndex / cols);
    if (c < cols - 1) p2SelIndex = r * cols + (c + 1);
    keysPressed['arrowright'] = false;
  }
  if (keysPressed['arrowup']) {
    const cols = 3;
    const c = p2SelIndex % cols;
    const r = Math.floor(p2SelIndex / cols);
    if (r > 0) p2SelIndex = (r - 1) * cols + c;
    keysPressed['arrowup'] = false;
  }
  if (keysPressed['arrowdown']) {
    const cols = 3, rows = 2;
    const c = p2SelIndex % cols;
    const r = Math.floor(p2SelIndex / cols);
    if (r < rows - 1) p2SelIndex = (r + 1) * cols + c;
    keysPressed['arrowdown'] = false;
  }

  // P2 confirm (only if pointing to a valid character slot)
  if (!p2Confirmed && (keysPressed['b'] || keysPressed['backspace'])) {
    if (p2SelIndex < choices.length) {
      p2Choice = p2SelIndex;
      p2Confirmed = true;
    }
    keysPressed['b'] = false; keysPressed['backspace'] = false;
  }

  // sync to window if anything changed so main.tryCreatePlayers can proceed
  try {
    if (typeof window !== 'undefined') {
      if (_prev.p1Confirmed !== p1Confirmed) window.p1Confirmed = p1Confirmed;
      if (_prev.p2Confirmed !== p2Confirmed) window.p2Confirmed = p2Confirmed;
      if (_prev.p1Choice !== p1Choice) window.p1Choice = p1Choice;
      if (_prev.p2Choice !== p2Choice) window.p2Choice = p2Choice;
      if (_prev.p1SelIndex !== p1SelIndex) window.p1SelIndex = p1SelIndex;
      if (_prev.p2SelIndex !== p2SelIndex) window.p2SelIndex = p2SelIndex;
      // always ensure choices array is available on window
      window.choices = choices;
    }
  } catch (e) {}
}