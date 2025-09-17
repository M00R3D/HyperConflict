// entities/fighter/animation.js
export function setState(self, newState) {
  // NO cambiar de estado si está en pausa
  if (window.PAUSED) return;
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
    case 'bun':       self.currentFramesByLayer = self.shorFramesByLayer; break;
    // hit1/hit2/hit3 usan sus frames específicos si existen
    case 'hit1':      self.currentFramesByLayer = self.hit1FramesByLayer || self.hitFramesByLayer; break;
    case 'hit2':      self.currentFramesByLayer = self.hit2FramesByLayer || self.hitFramesByLayer; break;
    case 'hit3':      self.currentFramesByLayer = self.hit3FramesByLayer || self.hitFramesByLayer; break;
    case 'hadouken':  self.currentFramesByLayer = self.shootFramesByLayer; break;
    case 'dash':      self.currentFramesByLayer = self.dashFramesByLayer; break;
    case 'taunt':      self.currentFramesByLayer = self.tauntFramesByLayer; break;
    case 'block':      self.currentFramesByLayer = self.blockFramesByLayer; break;
    case 'crouchBlock':      self.currentFramesByLayer = self.crouchBlockFramesByLayer; break;
    case 'blockStun': self.currentFramesByLayer = self.blockStunFramesByLayer || self.blockFramesByLayer; break;
    case 'crouchBlockStun': self.currentFramesByLayer = self.crouchBlockStunFramesByLayer || self.crouchBlockFramesByLayer; break;
    case 'grab':      self.currentFramesByLayer = self.grabFramesByLayer; break;
    case 'grabbed':    self.currentFramesByLayer = self.grabbedFramesByLayer; break;
    default:          self.currentFramesByLayer = self.idleFramesByLayer; break;
  }

  // inicializa índices/timers de animación
  self.frameIndex = 0;
  self.frameTimer = 0;
}

export function updateAnimation(self) {
  // NO avanzar animación si está en pausa
  if (window.PAUSED) return;
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
  if (window.PAUSED) return; // <--- agrega esto
  if (self.isHit && millis() - self.hitStartTime >= self.hitDuration) {
    self.isHit = false; self.setState("idle");
  }

  // manejar expiración de blockStun / crouchBlockStun
  try {
    if (self.state && (self.state.current === 'blockStun' || self.state.current === 'crouchBlockStun')) {
      const start = self.blockStunStartTime || 0;
      const elapsed = millis() - start;
      const defaultDur = (self.state.current === 'crouchBlockStun') ? (self.crouchBlockStunDuration || 540) : (self.blockStunDuration || 540);
      const actionDur = (self.actions && self.actions[self.state.current] && self.actions[self.state.current].duration) || defaultDur;
      const dur = actionDur;

      if (start > 0 && elapsed >= dur) {
        // Al salir del block-stun volvemos a 'block'/'crouchBlock' si el jugador sigue manteniendo bloqueo en suelo,
        // si no, volvemos a estado base ('idle' / reevaluación en update()).
        const stillBlocking = !!(self.blocking && self.onGround);
        if (self.state.current === 'crouchBlockStun') {
          if (self.crouching && stillBlocking) self.setState('crouchBlock');
          else self.setState('idle');
        } else {
          if (!self.crouching && stillBlocking) self.setState('block');
          else self.setState('idle');
        }
        // limpiar timer
        self.blockStunStartTime = 0;
      }
    }
  } catch (e) {
    // no romper si hay error
  }
}
