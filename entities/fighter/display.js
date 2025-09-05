// entities/fighter/display.js
export function display(self) {
  const stateText = self.state.current;
  const framesByLayer = self.currentFramesByLayer || self.idleFramesByLayer;

  if (framesByLayer.length > 0 && framesByLayer[0]?.length > 0) {
    push();
    if (self.facing === -1) {
      translate(self.x + self.w / 2, 0);
      scale(-1, 1);
      translate(-(self.x + self.w / 2), 0);
    }
    for (let i = 1; i < framesByLayer.length; i++) {
      const layerFrames = framesByLayer[i];
      const img = layerFrames[self.frameIndex];
      if (!img) continue;
      const frameWidth = img.width / framesByLayer[0].length;
      image(
        img, self.x, self.y, self.w, self.h,
        frameWidth * self.frameIndex, 0,
        frameWidth, img.height
      );
    }
    pop();
  } else {
    fill(self.col);
    rect(self.x, self.y, self.w, self.h);
  }

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