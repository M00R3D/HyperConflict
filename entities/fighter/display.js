// entities/fighter/display.js
export function display(self) {
  // freeze state text during pause so the UI label doesn't change while paused
  let stateText = (self.state && self.state.current) || 'idle';
  // treat hitstop as a pause for display freezing as well
  const isPausedTop = !!window.PAUSED || !!window.HITSTOP_ACTIVE;
  if (isPausedTop) {
    if (self._stateTextFrozen == null) self._stateTextFrozen = stateText;
    stateText = self._stateTextFrozen;
  } else {
    if (self._stateTextFrozen != null) self._stateTextFrozen = null;
  }

  // Si el fighter está marcado como "isHit", elegir hit1/hit2/hit3 según hitLevel (más robusto que flags independientes)
  let framesByLayer;
  if (self.isHit) {
    const hl = Math.max(1, Math.min(3, Number(self.hitLevel || 1)));
    if (hl >= 3) {
      framesByLayer = self.hit3FramesByLayer || self.hitFramesByLayer || self.currentFramesByLayer || self.idleFramesByLayer;
    } else if (hl === 2) {
      framesByLayer = self.hit2FramesByLayer || self.hitFramesByLayer || self.currentFramesByLayer || self.idleFramesByLayer;
    } else {
      framesByLayer = self.hit1FramesByLayer || self.hitFramesByLayer || self.currentFramesByLayer || self.idleFramesByLayer;
    }
  } else {
    framesByLayer = self.currentFramesByLayer || self.idleFramesByLayer;
  }
  // ensure per-fighter alpha state for dashLight visuals
  self._dashLightAlpha = (typeof self._dashLightAlpha === 'number') ? self._dashLightAlpha : 1.0;

  // render Y offset for specific characters (visual only, doesn't affect hitboxes/physics)
  const renderYOffset = (self.charId === 'fernando') ? -6 : 0;
  // extra height (px) to add to rendered sprites for specific characters
  const renderExtraH = (self.charId === 'fernando') ? 5 : 0;
  // extra width (px) to add to rendered sprites (negative => narrower)
  const renderExtraW = (self.charId === 'fernando') ? -2 : 0;

    // si hay frames por capa y la capa 0 tiene frames, dibuja la animación
    if (stateText !== 'idle') {
      try {
        console.log('[display] render attempt', { id: self.id, char: self.charId, state: stateText, currentFrames0: (self.currentFramesByLayer && self.currentFramesByLayer[0] ? self.currentFramesByLayer[0].length : 0), idleFrames0: (self.idleFramesByLayer && self.idleFramesByLayer[0] ? self.idleFramesByLayer[0].length : 0) });
      } catch (e) {}
    }
    if (framesByLayer && framesByLayer.length > 0 && (framesByLayer[0] || []).length > 0) {
    // --- Dibuja el sprite normal (con flip) dentro de su propia transform ---
    push();
    if (self.facing === -1) {
      translate(self.x + self.w / 2, 0);
      scale(-1, 1);
      translate(-(self.x + self.w / 2), 0);
    }

    const fi = Math.max(0, self.frameIndex || 0);
    const frameCount = (framesByLayer[0]?.length) || 1;
    const startLayer = (framesByLayer.length > 1) ? 1 : 0;

    for (let layer = startLayer; layer < framesByLayer.length; layer++) {
      const layerFrames = framesByLayer[layer] || [];
      const imgCandidate = layerFrames[fi] || layerFrames[0];
      if (!imgCandidate) continue;

      if (imgCandidate.width && imgCandidate.height) {
        // Determine if the image itself is a horizontal/vertical sheet
        const imgW = imgCandidate.width;
        const imgH = imgCandidate.height;

        // guesses based on aspect ratio
        const imgHorizGuess = Math.round(imgW / imgH) || 1;
        const imgVertGuess = Math.round(imgH / imgW) || 1;

        // Decide local slicing count from the image (if it looks like a sheet)
        const imgInferredHoriz = (imgW >= imgH * 2 && imgHorizGuess >= 2) ? imgHorizGuess : 1;
        const imgInferredVert = (imgH >= imgW * 2 && imgVertGuess >= 2) ? imgVertGuess : 1;

        // prefer explicit frameCount (array length), but if the image itself contains multiple frames
        // we must slice using the image's inferred count and a local frame index
        let effectiveCount = Math.max(1, frameCount || 1);
        let localIndex = fi;
        let sliceMode = 'none';

        if (imgInferredHoriz >= 2) {
          sliceMode = 'h';
          effectiveCount = Math.max(effectiveCount, imgInferredHoriz);
          localIndex = fi % imgInferredHoriz;
        } else if (imgInferredVert >= 2) {
          sliceMode = 'v';
          effectiveCount = Math.max(effectiveCount, imgInferredVert);
          localIndex = fi % imgInferredVert;
        }

        if (sliceMode === 'h') {
          const frameWidth = Math.round(imgW / effectiveCount);
          const dstX = Math.round(self.x - (renderExtraW / 2));
          const dstY = Math.round(self.y + renderYOffset - renderExtraH);
          const dstW = Math.round(self.w + renderExtraW);
          const dstH = Math.round(self.h + renderExtraH);
          const srcX = Math.round(frameWidth * (localIndex % effectiveCount));
          image(imgCandidate, dstX, dstY, dstW, dstH, srcX, 0, frameWidth, imgH);
        } else if (sliceMode === 'v') {
          const frameHeight = Math.round(imgH / effectiveCount);
          const dstX = Math.round(self.x - (renderExtraW / 2));
          const dstY = Math.round(self.y + renderYOffset - renderExtraH);
          const dstW = Math.round(self.w + renderExtraW);
          const dstH = Math.round(self.h + renderExtraH);
          const srcY = Math.round(frameHeight * (localIndex % effectiveCount));
          image(imgCandidate, dstX, dstY, dstW, dstH, 0, srcY, imgW, frameHeight);
        } else {
          image(imgCandidate, Math.round(self.x - (renderExtraW / 2)), Math.round(self.y + renderYOffset - renderExtraH), Math.round(self.w + renderExtraW), Math.round(self.h + renderExtraH));
        }
      } else {
        image(imgCandidate, Math.round(self.x), Math.round(self.y + renderYOffset - renderExtraH), Math.round(self.w), Math.round(self.h + renderExtraH));
      }
    }
    pop();
  }

  
  // --- DRAW FERNANDO WEAPON OVERLAY (global coords, not flipped by main sprite transform) ---
  try {
    if (self.charId === 'fernando') {
      const weaponFramesByLayer = self.weaponFramesByLayer;
      // if frames missing, try to detect global asset and warn once
      if (!weaponFramesByLayer && typeof window !== 'undefined' && window._fernandoAssets && window._fernandoAssets.weapon && !self._weaponDebugLogged) {
        console.warn('[display] fernando weapon frames available globally but not on instance; check lifecycle/assets assignment');
        self._weaponDebugLogged = true;
      }
      if (weaponFramesByLayer && weaponFramesByLayer.length > 0 && (weaponFramesByLayer[0] || []).length > 0) {
        const layerFrames = weaponFramesByLayer[0] || [];
        const fiW = Math.max(0, (self.frameIndex || 0));
        const img = layerFrames[fiW] || layerFrames[0];
        if (img) {
          // anchor near center but offset to side depending on facing
          const baseAnchorX = Math.round(self.x + self.w / 2);
          const sideOffset = Math.round(self.w * 0.2) * (self.facing === 1 ? -1 : 1);
          const renderYOffset = 6; // align to main sprite's Y offset
          const anchorX = baseAnchorX + sideOffset;
          const anchorY = Math.round(self.y + renderYOffset + self.h / 2 - 6);

          // walking bounce + small idle sway (defensive: coerce id/facing to numbers to avoid NaN)
          const isWalking = (self.state && (self.state.current === 'walk' || self.state.current === 'run'));
          const time = millis();
          const walkFactor = isWalking ? 1 : 0.18;
          const idNum = Number(self.id) || 0;
          const faceNum = (typeof self.facing === 'number') ? self.facing : (Number(self.facing) || 1);
          const bounce = Math.sin(time / 110 + idNum * 0.1) * 3 * walkFactor;
          const rot = Math.sin(time / 160 + idNum * 0.08) * 0.16 * walkFactor * faceNum;

          push();
          translate(anchorX, anchorY + bounce);
          rotate(rot);
          // make it smaller than main sprite
          const scaleDown = 0.64;
          scale(scaleDown, scaleDown);

          // draw centering the image on anchor
          if (img.width && img.height) {
            // try simple single-frame draw; if it's a sheet we slice horizontally if needed
            const imgW = img.width; const imgH = img.height;
            const horizGuess = Math.round(imgW / imgH) || 1;
            let effectiveCount = 1; let localIdx = fiW; let sliceMode = 'none';
            if (imgW >= imgH * 2 && horizGuess >= 2) { sliceMode = 'h'; effectiveCount = horizGuess; localIdx = fiW % effectiveCount; }
            if (sliceMode === 'h') {
              const fw = Math.round(imgW / effectiveCount);
              image(img, -Math.round(self.w/2), -Math.round(self.h/2), Math.round(self.w), Math.round(self.h), fw * localIdx, 0, fw, imgH);
            } else {
              image(img, -Math.round(self.w/2), -Math.round(self.h/2), Math.round(self.w), Math.round(self.h));
            }
          } else {
            image(img, -Math.round(self.w/2), -Math.round(self.h/2), Math.round(self.w), Math.round(self.h));
          }
          pop();
        }
      } else {
        // debug fallback: draw a small magenta anchor so we can see where the weapon would be
        if (!weaponFramesByLayer) {
          const baseAnchorX = Math.round(self.x + self.w / 2);
          const sideOffset = Math.round(self.w * 0.4) * (self.facing === 1 ? -1 : 1);
          const anchorX = baseAnchorX + sideOffset;
          const anchorY = Math.round(self.y + renderYOffset + self.h / 2 - 6);
          push();
          noStroke();
          fill(255, 0, 255, 180);
          rect(anchorX - 4, anchorY - 4, 8, 8);
          pop();
        }
      }
    }
  } catch (e) {
    // don't break rendering on any error
  }
  // --- Dibujar overlay del dash LUEGO, en coordenadas globales (no afectadas por el flip) ---
  const dashFrames = self.dashLightFramesByLayer || [];
  const hasDashLight = dashFrames.length > 0;
  const lightStart = self.dashLightStart || 0;
  const lightDur = Math.max(1, self.dashLightDuration || 0);
  const lightElapsed = millis() - lightStart;
  const lightActive = hasDashLight && lightStart > 0 && lightElapsed < lightDur;

  // ---------- FREEZE dashLight COMPLETELY while PAUSED ----------
  // use the top-level pause value (avoid redeclaring). `isPausedTop` set near the top.
  const isPaused = !!window.PAUSED || !!window.HITSTOP_ACTIVE;

  // mantener la luz visible si está activa; no hacemos fade por pausa (se congela visible)
  const targetVisual = lightActive ? 1 : 0;

  // Solo interpolar alpha cuando NO está pausado (congelar completamente cuando está pausado)
  if (!isPaused) {
    self._dashLightAlpha = lerp(self._dashLightAlpha || 1, targetVisual, 0.12);
  }

  // decide si debemos renderizar la luz (visible) aunque esté pausada
  if (self._dashLightAlpha > 0.01 && hasDashLight) {
    // manejar congelado de progreso (frames + tiempo) mientras PAUSED
    if (isPaused) {
      if (self._dashLightFrozen == null) {
        // primera frame de pausa: almacenar estado congelado (fotografía completa)
        const lightElapsedFrozen = Math.min(lightElapsed, lightDur);
        const tLightFrozen = constrain(lightElapsedFrozen / lightDur, 0, 1);
        const easeInFrozen = (Math.sin((Math.min(tLightFrozen, 0.5) / 0.5) * Math.PI / 2));
        const easeOutFrozen = 1 - Math.pow(1 - tLightFrozen, 3);

        const scaleX_base = 1.6;
        const scaleX_peak = 3.0;
        const scaleX_frozen = lerp(scaleX_base, scaleX_peak, easeInFrozen);

        const scaleY_start = 1.3;
        const scaleY_end = 0.30;
        const scaleY_frozen = lerp(scaleY_start, scaleY_end, easeOutFrozen);

        const lightFacingFrozen = (self.dashLightFacing !== undefined && self.dashLightFacing !== 0) ? self.dashLightFacing
                        : ((self.dashDirection !== undefined && self.dashDirection !== 0) ? self.dashDirection : (self.facing || 1));
        const shearAmountFrozen = lightFacingFrozen * 0.28 * Math.sin(tLightFrozen * Math.PI);

        const timeBaseFrozen = (lightStart || millis()) + Math.min(lightElapsed, lightDur);
        const hueFrozen = 200;
        const satBaseFrozen = 52;
        const satOscFrozen = 18 * Math.sin(timeBaseFrozen / 110);
        const satFrozen = constrain(satBaseFrozen + satOscFrozen + 36 * (1 - tLightFrozen), 0, 100);
        const briFrozen = 88;
        const baseAlphaFrozen = constrain(190 + 60 * Math.sin(timeBaseFrozen / 95) * (1 - tLightFrozen * 0.8), 80, 255);

        const forwardBaseFrozen = 12;
        const forwardPeakFrozen = 18;
        const anchorXFrozen = (typeof self.dashLightAnchorX === 'number')
          ? self.dashLightAnchorX
          : (self.x + self.w / 2 + lerp(forwardBaseFrozen, forwardPeakFrozen, easeInFrozen) * lightFacingFrozen);
        const anchorYFrozen = (typeof self.dashLightAnchorY === 'number')
          ? self.dashLightAnchorY
          : (self.y + renderYOffset + self.h / 2 - 6 - (renderExtraH / 2));

        self._dashLightFrozen = {
          elapsed: Math.min(lightElapsed, lightDur),
          frameIndex: Math.max(0, (self.frameIndex || 0)),
          timeBase: timeBaseFrozen,
          pauseAt: millis(),
          tLight: tLightFrozen,
          easeIn: easeInFrozen,
          easeOut: easeOutFrozen,
          scaleX: scaleX_frozen,
          scaleY: scaleY_frozen,
          lightFacing: lightFacingFrozen,
          shearAmount: shearAmountFrozen,
          hue: hueFrozen,
          sat: satFrozen,
          bri: briFrozen,
          baseAlpha: baseAlphaFrozen,
          anchorX: anchorXFrozen,
          anchorY: anchorYFrozen
        };
      }
    } else {
      // si venimos de pausa, ajustar dashLightStart para compensar tiempo pausado
      if (self._dashLightFrozen) {
        const pausedFor = millis() - (self._dashLightFrozen.pauseAt || millis());
        if (typeof self.dashLightStart === 'number') self.dashLightStart += pausedFor;
        self._dashLightFrozen = null;
        self._dashLightPaused = false;
      }
    }

    // USAR VALORES PRECONGELADOS O CALCULAR NUEVOS (NADA INTERMEDIO)
    let fi2, tLight, easeIn, easeOut, scaleX, scaleY, lightFacing,
        shearAmount, timeRef, hue, sat, bri, baseAlpha, anchorX, anchorY;

    if (isPaused && self._dashLightFrozen) {
      fi2 = self._dashLightFrozen.frameIndex;
      tLight = self._dashLightFrozen.tLight;
      easeIn = self._dashLightFrozen.easeIn;
      easeOut = self._dashLightFrozen.easeOut;
      scaleX = self._dashLightFrozen.scaleX;
      scaleY = self._dashLightFrozen.scaleY;
      lightFacing = self._dashLightFrozen.lightFacing;
      shearAmount = self._dashLightFrozen.shearAmount;
      timeRef = self._dashLightFrozen.timeBase;
      hue = self._dashLightFrozen.hue;
      sat = self._dashLightFrozen.sat;
      bri = self._dashLightFrozen.bri;
      baseAlpha = self._dashLightFrozen.baseAlpha;
      anchorX = self._dashLightFrozen.anchorX;
      anchorY = self._dashLightFrozen.anchorY;
    } else {
      fi2 = Math.max(0, (self.frameIndex || 0));
      tLight = constrain(lightElapsed / lightDur, 0, 1);
      easeIn = (Math.sin((Math.min(tLight, 0.5) / 0.5) * Math.PI / 2));
      easeOut = 1 - Math.pow(1 - tLight, 3);

      const scaleX_base = 1.6;
      const scaleX_peak = 3.0;
      scaleX = lerp(scaleX_base, scaleX_peak, easeIn);

      const scaleY_start = 1.3;
      const scaleY_end = 0.30;
      scaleY = lerp(scaleY_start, scaleY_end, easeOut);

      lightFacing = (self.dashLightFacing !== undefined && self.dashLightFacing !== 0) ? self.dashLightFacing
                    : ((self.dashDirection !== undefined && self.dashDirection !== 0) ? self.dashDirection : (self.facing || 1));
      shearAmount = lightFacing * 0.28 * Math.sin(tLight * Math.PI);

      timeRef = millis();
      hue = 200;
      const satBase = 52;
      const satOsc = 18 * Math.sin(timeRef / 110);
      sat = constrain(satBase + satOsc + 36 * (1 - tLight), 0, 100);
      bri = 88;
      baseAlpha = constrain(190 + 60 * Math.sin(timeRef / 95) * (1 - tLight * 0.8), 80, 255);

      const forwardBase = 12;
      const forwardPeak = 18;
      anchorX = (typeof self.dashLightAnchorX === 'number')
        ? self.dashLightAnchorX
        : (self.x + self.w / 2 + lerp(forwardBase, forwardPeak, easeIn) * lightFacing);
      anchorY = (typeof self.dashLightAnchorY === 'number')
        ? self.dashLightAnchorY
        : (self.y + renderYOffset + self.h / 2 - 6 - (renderExtraH / 2));
    }

    // Alpha final (multiplicador para la opacidad)
    const alpha = Math.round(baseAlpha * (self._dashLightAlpha || 1));

    push();
    blendMode(ADD);
    translate(anchorX, anchorY);
    shearX(shearAmount);
    scale((lightFacing === -1) ? -scaleX : scaleX, scaleY);

    colorMode(HSB, 360, 100, 100, 255);
    const c = color(hue, sat, bri, alpha);
    tint(c);

    // dibujamos centrado en el anchor
    for (let layer = 0; layer < dashFrames.length; layer++) {
      const layerFrames = dashFrames[layer] || [];
      const img = layerFrames[fi2] || layerFrames[0];
      if (!img) continue;
      const frameCount2 = (dashFrames[0]?.length) || 1;
      if (img.width && img.height) {
        const imgW2 = img.width;
        const imgH2 = img.height;
        const imgHorizGuess2 = Math.round(imgW2 / imgH2) || 1;
        const imgVertGuess2 = Math.round(imgH2 / imgW2) || 1;
        const imgInferredHoriz2 = (imgW2 >= imgH2 * 2 && imgHorizGuess2 >= 2) ? imgHorizGuess2 : 1;
        const imgInferredVert2 = (imgH2 >= imgW2 * 2 && imgVertGuess2 >= 2) ? imgVertGuess2 : 1;

        let effectiveCount2 = Math.max(1, frameCount2 || 1);
        let localIdx2 = fi2;
        let sliceMode2 = 'none';
        if (imgInferredHoriz2 >= 2) {
          sliceMode2 = 'h';
          effectiveCount2 = Math.max(effectiveCount2, imgInferredHoriz2);
          localIdx2 = fi2 % imgInferredHoriz2;
        } else if (imgInferredVert2 >= 2) {
          sliceMode2 = 'v';
          effectiveCount2 = Math.max(effectiveCount2, imgInferredVert2);
          localIdx2 = fi2 % imgInferredVert2;
        }

        if (sliceMode2 === 'h') {
          const frameWidth = Math.round(imgW2 / effectiveCount2);
          const dstX = Math.round(- (self.w + renderExtraW) / 2);
          const dstY = Math.round(-self.h / 2);
          const dstW = Math.round(self.w + renderExtraW);
          const dstH = Math.round(self.h);
          const srcX = Math.round(frameWidth * (localIdx2 % effectiveCount2));
          image(img, dstX, dstY, dstW, dstH, srcX, 0, frameWidth, imgH2);
        } else if (sliceMode2 === 'v') {
          const frameHeight = Math.round(imgH2 / effectiveCount2);
          const dstX = Math.round(- (self.w + renderExtraW) / 2);
          const dstY = Math.round(-self.h / 2);
          const dstW = Math.round(self.w + renderExtraW);
          const dstH = Math.round(self.h);
          const srcY = Math.round(frameHeight * (localIdx2 % effectiveCount2));
          image(img, dstX, dstY, dstW, dstH, 0, srcY, imgW2, frameHeight);
        } else {
          image(img, Math.round(- (self.w + renderExtraW) / 2), Math.round(-self.h / 2), Math.round(self.w + renderExtraW), Math.round(self.h));
        }
      } else {
        image(img, Math.round(-self.w / 2), Math.round(-self.h / 2), Math.round(self.w), Math.round(self.h));
      }
    }

    noTint();
    colorMode(RGB, 255, 255, 255, 255);
    blendMode(BLEND);
    pop();
  }

  // fallback simple rect if no frames at all (keeps legacy)
    if (!framesByLayer || framesByLayer.length === 0) {
    push();
    fill(self.col || 255);
    rect(Math.round(self.x - (renderExtraW / 2)), Math.round(self.y + renderYOffset - renderExtraH), Math.round(self.w + renderExtraW), Math.round(self.h + renderExtraH));
    pop();
  }

  // Debug: dibujar hitboxes si está activado el overlay (toggle con '1')
  if (window.SHOW_DEBUG_OVERLAYS) {
    try {
      // hitbox principal
      const hb = (typeof self.getCurrentHitbox === 'function') ? self.getCurrentHitbox() : null;
      // hitbox de ataque (si existe)
      const ahb = (typeof self.getAttackHitbox === 'function') ? self.getAttackHitbox() : null;

      push();
      // dibujar hitboxes
      noFill();
      strokeWeight(1.5);
      if (hb) {
        stroke(255, 0, 0, 200);
        rect(hb.x, hb.y, hb.w, hb.h);
      }
      if (ahb) {
        stroke(0, 255, 0, 200);
        rect(ahb.x, ahb.y, ahb.w, ahb.h);
      }

      // dibujar texto de estado sobre la cabeza del fighter (centered)
      try {
        textAlign(CENTER, BOTTOM);
        textSize(12);
        noStroke();
        fill(255);
        const labelX = Math.round(self.x + self.w / 2);
        const labelY = Math.round(self.y + renderYOffset - 6);
        // usar texto congelado si existe (stateText definido al inicio de display)
        const label = (typeof stateText === 'string') ? stateText : ((self.state && self.state.current) || 'idle');
        text(label, labelX, labelY);
      } catch (e) {
        /* ignore text draw errors */
      }

      pop();
    } catch (e) {
      // safe: no romper render si hay error
      // console.warn('debug draw failed', e);
    }
  }  
}