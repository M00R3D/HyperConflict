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
// debug: log asset shapes once to diagnose selection/hud issues
let _selectionAssetsLogged = false;

function _resolveFrames(container) {
  if (!container) return null;
  // layers-by-layer: [ layer0Frames[], layer1Frames[], ... ]
  if (Array.isArray(container)) {
    if (container.length === 0) return null;
    // if first element is an array, assume layers-by-layer
    if (Array.isArray(container[0])) {
      // prefer middle layer (index 1) for 3-layer chars, else prefer 1 -> 2 -> 0
      if (container[1] && Array.isArray(container[1]) && container[1].length > 0) return container[1];
      if (container[2] && Array.isArray(container[2]) && container[2].length > 0) return container[2];
      if (container[0] && Array.isArray(container[0]) && container[0].length > 0) return container[0];
      // fallback: find any non-empty layer
      const layer = container.find(l => Array.isArray(l) && l.length > 0);
      return layer || null;
    }
    // otherwise it's a flat frames array (images)
    return container.length > 0 ? container : null;
  }
  // single image (unlikely), wrap as array
  if (container && container.width && container.height) return [container];
  return null;
}
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

  // Diagnostic log once per session to inspect shapes coming from loader/asset pipeline
  if (!_selectionAssetsLogged) {
    try {
      console.log('[selectionManager] assets snapshot:', {
        tyeman: {
          keys: _tyemanAssets ? Object.keys(_tyemanAssets) : null,
          idleShape: _tyemanAssets && _tyemanAssets.idle ? (Array.isArray(_tyemanAssets.idle) ? (_tyemanAssets.idle.length + ' items') : 'single') : null
        },
        sbluer: {
          keys: _sbluerAssets ? Object.keys(_sbluerAssets) : null,
          idleShape: _sbluerAssets && _sbluerAssets.idle ? (Array.isArray(_sbluerAssets.idle) ? (_sbluerAssets.idle.length + ' items') : 'single') : null
        },
        fernando: {
          keys: _fernandoAssets ? Object.keys(_fernandoAssets) : null,
          idleShape: _fernandoAssets && _fernandoAssets.idle ? (Array.isArray(_fernandoAssets.idle) ? (_fernandoAssets.idle.length + ' items') : 'single') : null
        },
        slotAssets: _slotAssets ? Object.keys(_slotAssets) : null,
        bootFrames: _bootFrames ? (Array.isArray(_bootFrames) ? _bootFrames.length : 'present') : null
      });
    } catch (e) {}
    _selectionAssetsLogged = true;
  }
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
        // Prefer a punch preview for certain characters to show a clearer pose
        let previewLayer = null;
        let frameImg = null;
        try {
          if (charId === 'tyeman' || charId === 'sbluer') {
            previewLayer = _resolveFrames(assets?.punch) || _resolveFrames(assets?.punch1) || _resolveFrames(assets?.punch_1) || _resolveFrames(assets?.idle);
            frameImg = (previewLayer && previewLayer.length) ? previewLayer[0] : null;
          } else if (charId === 'fernando') {
            // force a single static frame for Fernando: pick first available frame from preferred layers
            const candidates = [assets?.punch, assets?.punch1, assets?.punch_1, assets?.idle, assets?.taunt, assets?.current];
            for (const cand of candidates) {
              if (!cand) continue;
              // layers-by-layer
              if (Array.isArray(cand) && Array.isArray(cand[0])) {
                // prefer middle layer then first
                const layer = (cand[1] && Array.isArray(cand[1]) && cand[1].length > 0) ? cand[1] : (cand[0] && Array.isArray(cand[0]) ? cand[0] : null);
                if (layer && layer.length > 0) { frameImg = layer[0]; break; }
              } else if (Array.isArray(cand) && cand.length > 0) {
                // flat frames array: take first image
                frameImg = cand[0]; break;
              } else if (cand && cand.width && cand.height) {
                // single image
                frameImg = cand; break;
              }
            }
            // ensure previewLayer remains null for fernando (we already selected explicit frameImg)
            previewLayer = null;
          } else {
            previewLayer = _resolveFrames(assets?.idle) || _resolveFrames(assets?.taunt) || _resolveFrames(assets?.current);
            frameImg = (previewLayer && previewLayer.length) ? previewLayer[0] : null;
          }
        } catch (e) { previewLayer = _resolveFrames(assets?.idle); frameImg = (previewLayer && previewLayer.length) ? previewLayer[0] : null; }
        // debug: if frameImg exists and is a spritesheet, log its dimensions (helps diagnose tiny-frames issue)
        if (frameImg && !_selectionAssetsLogged) {
          try { console.log('[selectionManager] preview frame', charId, { frameImgW: frameImg.width, frameImgH: frameImg.height, previewLayerLen: previewLayer ? previewLayer.length : 0 }); } catch (e) {}
        }
        const isFernando = (charId === 'fernando');
        if (frameImg) {
          imageMode(CENTER);
          // Determine logical number of frames and source frame width/height.
          // Cases:
          // - previewLayer is an array of separate frame images -> use each image as one frame
          // - previewLayer is a single spritesheet image -> detect internal frames by width/height
          let frameCount = 1;
          let srcFrameW = frameImg.width || 1;
          let srcFrameH = frameImg.height || srcFrameW;

          if (previewLayer && Array.isArray(previewLayer) && previewLayer.length > 1) {
            // multiple separate frame images provided
            // For Fernando, force a single-frame preview (do not cycle through all frames)
            frameCount = isFernando ? 1 : previewLayer.length;
            // each frameImg is already a single-frame image, so srcFrameW is the image width
            srcFrameW = frameImg.width || 1;
            srcFrameH = frameImg.height || srcFrameW;
          } else if (frameImg.width && frameImg.height) {
            // single entry; maybe a spritesheet packed horizontally
            const internal = Math.max(1, Math.round(frameImg.width / frameImg.height));
            if (internal > 1) {
              if (isFernando) {
                // pick a single logical subframe for Fernando (first subframe)
                frameCount = 1;
                srcFrameW = Math.max(1, Math.floor(frameImg.width / internal));
                srcFrameH = frameImg.height || srcFrameW;
              } else {
                frameCount = internal;
                srcFrameW = Math.max(1, Math.floor(frameImg.width / frameCount));
                srcFrameH = frameImg.height || srcFrameW;
              }
            } else {
              frameCount = 1;
              srcFrameW = frameImg.width || 1;
              srcFrameH = frameImg.height || srcFrameW;
            }
          }
          const maxW = cellSize - 12;const maxH = cellSize - 12;
          const ratio = Math.min(maxW / srcFrameW, maxH / srcFrameH, 1);const dw = Math.round(srcFrameW * ratio);const dh = Math.round(srcFrameH * ratio);
          // always draw only the FIRST logical subframe for preview (avoid tiling all frames into the cell)
          const srcX = 0;
          try {
            image(frameImg, ix + cellSize/2, iy + cellSize/2, dw, dh, srcX, 0, srcFrameW, srcFrameH);
          } catch (e) {
            image(frameImg, ix + cellSize/2, iy + cellSize/2, dw, dh);
          }
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
    const tauntLayer = (assets?.taunt) ? assets.taunt : null;
    // tauntLayer may be either: a) layers->frames array (layers[]) or b) a flat frames array
    let tauntImg = null;
    let tCount = 1;
    if (tauntLayer) {
      // prefer layer 1 then 0 if layers-by-layer format
      if (Array.isArray(tauntLayer) && tauntLayer.length > 0 && Array.isArray(tauntLayer[0])) {
        const layer = (tauntLayer[1] && Array.isArray(tauntLayer[1])) ? tauntLayer[1] : tauntLayer[0];
        if (layer && layer.length > 0) { tauntImg = layer[0]; tCount = layer.length; }
      } else if (Array.isArray(tauntLayer) && tauntLayer.length > 0) {
        // flat frames array
        tauntImg = tauntLayer[0]; tCount = 1;
      }
    }
    if (tauntImg) {
      push();
      imageMode(CORNER);
      tint(255, 240);
      // detect if tauntImg is a spritesheet containing tCount frames horizontally
      let tSrcW = tauntImg.width || 1;
      const tSrcH = tauntImg.height || 1;
      // detect internal frames in the taunt image (packed horizontally)
      const tInternal = Math.max(1, Math.round(tauntImg.width / tauntImg.height));
      if (tInternal > 1) {
        // if Fernando, show only the first logical subframe; otherwise try to respect tCount
        if (charId === 'fernando') {
          tCount = 1;
          tSrcW = Math.max(1, Math.floor(tauntImg.width / tInternal));
        } else if (tCount > 1) {
          tSrcW = Math.max(1, Math.floor(tauntImg.width / tCount));
        } else {
          // unknown count: divide by detected internal frames
          tSrcW = Math.max(1, Math.floor(tauntImg.width / tInternal));
        }
      } else {
        // treat as single-frame image
        tCount = 1;
        tSrcW = tauntImg.width;
      }
      // shave 3px from right edge for Fernando taunt subframe
      if (charId === 'fernando') {
        tSrcW = Math.max(1, tSrcW - 3);
      }
      const tRatio = Math.min(baseTauntW / tSrcW, baseTauntH / tSrcH, 1);
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
    const tauntLayer = (assets?.taunt) ? assets.taunt : null;
    let tauntImg = null;
    let tCount2 = 1;
    if (tauntLayer) {
      if (Array.isArray(tauntLayer) && tauntLayer.length > 0 && Array.isArray(tauntLayer[0])) {
        const layer = (tauntLayer[1] && Array.isArray(tauntLayer[1])) ? tauntLayer[1] : tauntLayer[0];
        if (layer && layer.length > 0) { tauntImg = layer[0]; tCount2 = layer.length; }
      } else if (Array.isArray(tauntLayer) && tauntLayer.length > 0) {
        tauntImg = tauntLayer[0]; tCount2 = 1;
      }
    }
    if (tauntImg) {
      push();
      imageMode(CORNER);
      tint(255, 240);
      let tSrcW2 = tauntImg.width || 1;
      const tSrcH2 = tauntImg.height || 1;
      const tInternal2 = Math.max(1, Math.round(tauntImg.width / tauntImg.height));
      if (tInternal2 > 1) {
        if (charId === 'fernando') {
          tCount2 = 1; tSrcW2 = Math.max(1, Math.floor(tauntImg.width / tInternal2));
        } else if (tCount2 > 1) {
          tSrcW2 = Math.max(1, Math.floor(tauntImg.width / tCount2));
        } else {
          tSrcW2 = Math.max(1, Math.floor(tauntImg.width / tInternal2));
        }
      } else {
        tCount2 = 1; tSrcW2 = tauntImg.width;
      }
      // shave 3px from right edge for Fernando taunt subframe (right preview)
      if (charId === 'fernando') {
        tSrcW2 = Math.max(1, tSrcW2 - 3);
      }
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