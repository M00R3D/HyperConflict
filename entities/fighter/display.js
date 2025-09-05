// entities/fighter/display.js
export function display(self) {
  const stateText = (self.state && self.state.current) || 'idle';
  const framesByLayer = self.currentFramesByLayer || self.idleFramesByLayer;

  // si hay frames por capa y la capa 0 tiene frames, dibuja la animación
  if (framesByLayer && framesByLayer.length > 0 && (framesByLayer[0] || []).length > 0) {
    push();
    // voltear según facing si tu pipeline lo necesita
    if (self.facing === -1) {
      translate(self.x + self.w / 2, 0);
      scale(-1, 1);
      translate(-(self.x + self.w / 2), 0);
    }

    const fi = Math.max(0, self.frameIndex || 0);
    const frameCount = (framesByLayer[0]?.length) || 1;

    // si hay más de una capa, saltamos la capa 0 (la capa "de abajo")
    const startLayer = (framesByLayer.length > 1) ? 1 : 0;

    for (let layer = /*start*/ startLayer; layer < framesByLayer.length; layer++) {
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
  } else {
    // fallback: cuadro simple
    fill(self.col || 255);
    rect(self.x, self.y, self.w, self.h);
  }

  // texto estado (debug)
  fill(255);
  textSize(12);
  textAlign(CENTER);
  text(stateText, self.x + self.w / 2, self.y - 10);

  // Dibuja la hitbox (debug)
  if (typeof self.getCurrentHitbox === 'function') {
    const hitbox = self.getCurrentHitbox();
    if (hitbox) {
      push();
      noFill();
      stroke(0, 255, 0, 180); // Verde semitransparente
      strokeWeight(2);
      rect(hitbox.x, hitbox.y, hitbox.w, hitbox.h);
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
      rect(attackHitbox.x, attackHitbox.y, attackHitbox.w, attackHitbox.h);
      pop();
    }
  }
}