// entities/fighter/animation.js
export function setState(self, newState) {
  if (self.state && self.state.current === newState) return;
  self.state = self.state || { current: null, timer: 0 };
  self.state.current = newState;
  self.state.timer = 0;

  // asignar frames por estado (asegúrate de que las propiedades existen en el fighter)
  switch (newState) {
    case 'walk':      self.currentFramesByLayer = self.walkFramesByLayer; break;
    case 'run':       self.currentFramesByLayer = self.runFramesByLayer; break;
    case 'jump':      self.currentFramesByLayer = self.jumpFramesByLayer; break;
    case 'fall':      self.currentFramesByLayer = self.fallFramesByLayer; break;
    case 'crouch':    self.currentFramesByLayer = self.crouchFramesByLayer; break;
    case 'crouchwalk':self.currentFramesByLayer = self.crouchWalkFramesByLayer; break;
    case 'punch':     self.currentFramesByLayer = self.punchFramesByLayer; break;
    case 'punch2':    self.currentFramesByLayer = self.punch2FramesByLayer; break;
    case 'punch3':    self.currentFramesByLayer = self.punch3FramesByLayer; break;
    case 'kick':      self.currentFramesByLayer = self.kickFramesByLayer; break;
    case 'kick2':     self.currentFramesByLayer = self.kick2FramesByLayer; break;
    case 'kick3':     self.currentFramesByLayer = self.kick3FramesByLayer; break;
    case 'tats':      self.currentFramesByLayer = self.tatsFramesByLayer; break;
    case 'hit':       self.currentFramesByLayer = self.hitFramesByLayer; break;
    // hit1/hit2/hit3 usan sus frames específicos si existen
    case 'hit1':      self.currentFramesByLayer = self.hit1FramesByLayer || self.hitFramesByLayer; break;
    case 'hit2':      self.currentFramesByLayer = self.hit2FramesByLayer || self.hitFramesByLayer; break;
    case 'hit3':      self.currentFramesByLayer = self.hit3FramesByLayer || self.hitFramesByLayer; break;
    case 'hadouken':  self.currentFramesByLayer = self.shootFramesByLayer; break;
    case 'dash':      self.currentFramesByLayer = self.dashFramesByLayer; break;
    case 'taunt':      self.currentFramesByLayer = self.tauntFramesByLayer; break;
    case 'block':      self.currentFramesByLayer = self.blockFramesByLayer; break;
    default:          self.currentFramesByLayer = self.idleFramesByLayer; break;
  }

  // inicializa índices/timers de animación
  self.frameIndex = 0;
  self.frameTimer = 0;
}

export function updateAnimation(self) {
  if (!self.currentFramesByLayer) return;

  // determina delay por acción si existe mapping actions, fallback a 6
  const action = (self.actions && self.actions[self.state.current]) || {};
  const frameDelay = action.frameDelay ?? 6;

  self.frameTimer = (self.frameTimer || 0) + 1;
  if (self.frameTimer > frameDelay) {
    self.frameTimer = 0;
    // número de frames en la primera capa (asume capas homogéneas)
    const layer0 = self.currentFramesByLayer[0] || [];
    const frameCount = layer0.length || 1;
    self.frameIndex = (self.frameIndex + 1) % frameCount;
  }
}

export function exitHitIfElapsed(self) {
  if (self.isHit && millis() - self.hitStartTime >= self.hitDuration) {
    self.isHit = false; self.setState("idle");
  }
}
