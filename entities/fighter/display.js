// entities/fighter/display.js
export function display(self) {
  const stateText = (self.state && self.state.current) || 'idle';
  const framesByLayer = self.currentFramesByLayer || self.idleFramesByLayer;
  // ensure per-fighter alpha state for dashLight visuals
  self._dashLightAlpha = (typeof self._dashLightAlpha === 'number') ? self._dashLightAlpha : 1.0;

  // si hay frames por capa y la capa 0 tiene frames, dibuja la animación
  if (framesByLayer && framesByLayer.length > 0 && (framesByLayer[0] || []).length > 0) {
    // --- Dibuja el sprite normal (con flip) dentro de su propia transform ---
    push();
    // voltear según facing si tu pipeline lo necesita
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
      // cada layerFrames[i] puede ser: a) imagen por frame, b) spritesheet (ancho = frameCount * frameWidth)
      const imgCandidate = layerFrames[fi] || layerFrames[0];
      if (!imgCandidate) continue;

      // si la imagen parece un spritesheet horizontal (ancho mayor que alto y hay multiple frames),
      // dibujamos solo la porción correspondiente al frame actual.
      if (frameCount > 1 && imgCandidate.width && imgCandidate.height && imgCandidate.width >= imgCandidate.height * frameCount) {
        const frameWidth = Math.round(imgCandidate.width / frameCount);
        image(
          imgCandidate,
          self.x, self.y,
          self.w, self.h,
          frameWidth * fi, 0,
          frameWidth, imgCandidate.height
        );
      } else {
        // imagen única por frame: dibuja tal cual, escalando al tamaño del fighter
        image(imgCandidate, self.x, self.y, self.w, self.h);
      }
    }
    pop();

    // --- Dibujar overlay del dash LUEGO, en coordenadas globales (no afectadas por el flip) ---
    const dashFrames = self.dashLightFramesByLayer || [];
    const hasDashLight = dashFrames.length > 0;
    const lightStart = self.dashLightStart || 0;
    const lightDur = Math.max(1, self.dashLightDuration || 0);
    const lightElapsed = millis() - lightStart;
    const lightActive = hasDashLight && lightStart > 0 && lightElapsed < lightDur;

    // decide target visual alpha: cuando el juego está en pausa queremos que la luz se desvanezca
    const isPaused = !!window.PAUSED;
    const targetVisual = (!isPaused && lightActive) ? 1 : 0;
    // suavizar alpha (visual only)
    self._dashLightAlpha = lerp(self._dashLightAlpha, targetVisual, 0.12);
    // si la alpha visual es prácticamente 0, no dibujamos nada
    if (self._dashLightAlpha > 0.01) {
      // usamos lightActive for progress, pero la opacidad final se multiplica por _dashLightAlpha
    } else {
      // skip all dash light drawing early
    }

    if (self._dashLightAlpha > 0.01) {
      const fi2 = Math.max(0, (self.frameIndex || 0));
      // tLight 0..1 across the entire light lifetime (including dash and post-dash shrink)
      let tLight = constrain(lightElapsed / lightDur, 0, 1);
      // use eased progress
      const easeIn = (Math.sin((Math.min(tLight, 0.5) / 0.5) * Math.PI / 2)); // faster in first half
      const easeOut = 1 - Math.pow(1 - tLight, 3); // smooth out for whole timeline

      // aumentar tamaño general y estiramiento más pronunciado
      const scaleX_base = 1.6;    // más grande por defecto
      const scaleX_peak = 3.0;    // peak durante la fase inicial
      const scaleX = lerp(scaleX_base, scaleX_peak, easeIn);

      // scaleY : inicia ligeramente alto y luego se encoge hacia el centro (final pequeño)
      const scaleY_start = 1.3;   // más alto inicialmente
      const scaleY_end = 0.30;    // final muy encogido hacia el centro
      const scaleY = lerp(scaleY_start, scaleY_end, easeOut);

      // shear hacia la dirección del dash (más durante la fase temprana)
      // decidir facing visual de la luz: preferir la facing fija de la light si existe
      const lightFacing = (self.dashLightFacing !== undefined && self.dashLightFacing !== 0) ? self.dashLightFacing
                          : ((self.dashDirection !== undefined && self.dashDirection !== 0) ? self.dashDirection : (self.facing || 1));
      const shearAmount = lightFacing * 0.28 * Math.sin(tLight * Math.PI);

      // saturación HSB: base + oscilación + incremento según tLight (más saturada al inicio)
      const hue = 200;
      const satBase = 52;
      const satOsc = 18 * Math.sin(millis() / 110);
      const sat = constrain(satBase + satOsc + 36 * (1 - tLight), 0, 100);
      const bri = 88;
      // base alpha for the effect (0..255) then modulate by per-fighter dashLight alpha (0..1)
      const baseAlpha = constrain(190 + 60 * Math.sin(millis() / 95) * (1 - tLight * 0.8), 80, 255);
      const alpha = Math.round(baseAlpha * (self._dashLightAlpha || 1));

      // calcular anchorX/anchorY (usar ancla fija guardada en dash() si existe,
      // sino posicionar ligeramente hacia adelante según facing y fase del dash)
      const forwardBase = 12;
      const forwardPeak = 18;
      const anchorX = (typeof self.dashLightAnchorX === 'number')
        ? self.dashLightAnchorX
        : (self.x + self.w / 2 + lerp(forwardBase, forwardPeak, easeIn) * lightFacing);
      const anchorY = (typeof self.dashLightAnchorY === 'number')
        ? self.dashLightAnchorY
        : (self.y + self.h / 2 - 6);

      push();
      blendMode(ADD);
      translate(anchorX, anchorY);
      shearX(shearAmount);
      scale((lightFacing === -1) ? -scaleX : scaleX, scaleY);

      colorMode(HSB, 360, 100, 100, 255);
      const c = color(hue, sat, bri, alpha);
      tint(c);

      // dibujamos centrado en el anchor (no en self.x) para evitar que siga al jugador ni duplique
      for (let layer = 0; layer < dashFrames.length; layer++) {
        const layerFrames = dashFrames[layer] || [];
        const img = layerFrames[fi2] || layerFrames[0];
        if (!img) continue;
        const frameCount2 = (dashFrames[0]?.length) || 1;
        if (frameCount2 > 1 && img.width && img.height && img.width >= img.height * frameCount2) {
          const frameWidth = Math.round(img.width / frameCount2);
          // dibujar centrado: -w/2, -h/2
          image(img, -self.w / 2, -self.h / 2, self.w, self.h, frameWidth * fi2, 0, frameWidth, img.height);
        } else {
          image(img, -self.w / 2, -self.h / 2, self.w, self.h);
        }
      }

      noTint();
      colorMode(RGB, 255, 255, 255, 255);
      blendMode(BLEND);
      pop();
    } // end if _dashLightAlpha > 0.01
   } else {
     // fallback: cuadro simple
     fill(self.col || 255);
     rect(self.x, self.y, self.w, self.h);
   }

  // texto estado (debug)
  fill(255);
  textSize(12);
  textAlign(CENTER);
  if (window.SHOW_DEBUG_OVERLAYS) {
    text(stateText, self.x + self.w / 2, self.y - 10);
  }

  // Dibuja la hitbox (debug)
  if (typeof self.getCurrentHitbox === 'function') {
    const hitbox = self.getCurrentHitbox();
    if (hitbox) {
      push();
      noFill();
      stroke(0, 255, 0, 180); // Verde semitransparente
      strokeWeight(2);
      if (window.SHOW_DEBUG_OVERLAYS) rect(hitbox.x, hitbox.y, hitbox.w, hitbox.h);
      pop();
    }
  }
  if(typeof self.getAttackHitbox === 'function') {
    const attackHitbox = self.getAttackHitbox();
    if (attackHitbox) {
      push();
      noFill();
      stroke(255, 0, 0, 180); // Rojo semitransparente
      strokeWeight(2);
      if (window.SHOW_DEBUG_OVERLAYS) rect(attackHitbox.x, attackHitbox.y, attackHitbox.w, attackHitbox.h);
      pop();
    }
  }
}