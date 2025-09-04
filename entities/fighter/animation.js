// entities/fighter/animation.js
export function setState(self, newState) {
  if (!self.state) self.state = { current: null, timer: 0, canCancel: true };
  if (self.state.current === newState) return;
  self.state.current = newState;
  self.state.timer = 0;
  const action = self.actions?.[newState];
  if (action && action.anim && action.anim.length > 0) {
    self.currentFramesByLayer = action.anim;
    self.frameIndex = 0;
    self.frameDelay = action.frameDelay || 10;
  } else {
    self.currentFramesByLayer = [];
    self.frameIndex = 0;
  }
}

export function updateAnimation(self) {
  const framesByLayer = self.currentFramesByLayer || [];
  if (framesByLayer.length > 0 && framesByLayer[0]?.length > 0) {
    if (frameCount % self.frameDelay === 0) {
      if (self.crouching) {
        if (self.frameIndex < framesByLayer[0].length - 1) self.frameIndex++;
        else if (self.state.current === "crouchwalk") self.frameIndex = (self.frameIndex + 1) % framesByLayer[0].length;
      } else if (self.onGround || self.attacking) {
        self.frameIndex = (self.frameIndex + 1) % framesByLayer[0].length;
      } else if (self.frameIndex < framesByLayer[0].length - 1) self.frameIndex++;
    }
  } else self.frameIndex = 0;
}

export function exitHitIfElapsed(self) {
  if (self.isHit && millis() - self.hitStartTime >= self.hitDuration) {
    self.isHit = false; self.setState("idle");
  }
}
