// entities/fighter/animation.js
export function setState(self, newState) {
  // NO cambiar de estado si está en pausa o durante hitstop
  if (window.PAUSED || window.HITSTOP_ACTIVE) {
    try {
      console.log(`[Anim.setState] blocked by PAUSE/HITSTOP: ${self?.id || '?'} trying -> ${newState}`);
    } catch (e) { /* ignore logging errors */ }
    return;
  }

  // Si estamos en un taunt activo, bloquear cualquier transición que no sea daño/knockdown.
  // Permitimos solo 'hit1'/'hit2'/'hit3' (interrupción por daño) o 'knocked' (knockdown).
  if (self && self.state && self.state.current === 'taunt' && self.attacking) {
    const allowIf = (ns) => {
      if (!ns || typeof ns !== 'string') return false;
      if (ns === 'knocked') return true;
      if (/^hit[123]$/.test(ns)) return true;
      return false;
    };
    if (!allowIf(newState)) {
      try {
        console.log(`[Anim.setState] transition blocked by taunt lock: ${self.id || '?'} ${self.state.current} -> ${newState}`);
      } catch (e) { /* ignore logging errors */ }
      return;
    }
  }

  // Protección: si estamos en bloqueo, NO permitir que el estado pase a un "hit".
  // Esto evita transiciones a 'hit', 'hit1', 'hit2', 'hit3' cuando el personaje está bloqueando.
  if (typeof newState === 'string' && newState.startsWith('hit')) {
    // si está bloqueando en suelo o en crouch, ignorar intentos de poner hit
    if (self && (self.blocking || self.state?.current === 'block' || self.state?.current === 'crouchBlock')) {
      try {
        console.log(`[Anim.setState] hit transition ignored due blocking: ${self.id || '?'} state=${self.state?.current} -> ${newState}`);
      } catch (e) { /* ignore logging errors */ }
      return;
    }
  }

  try {
    console.log('[Anim.setState] request', { id: self?.id, char: self?.charId, prev: self?.state?.current, newState, hasAction: !!(self && self.actions && self.actions[newState]), framesLen: ((self && self.actions && self.actions[newState] && self.actions[newState].anim && self.actions[newState].anim[0]) ? self.actions[newState].anim[0].length : (self && self.currentFramesByLayer && self.currentFramesByLayer[0] ? self.currentFramesByLayer[0].length : 0)) });
  } catch (e) {}

  if (self.state && self.state.current === newState) return;

  // Guardar estado previo para detectar salidas de ataques
  const prevState = self.state?.current;

  self.state = self.state || { current: null, timer: 0 };
  self.state.current = newState;
  self.state.timer = 0;

  // REGISTER timestamps for knocked/recovery so transitions are time-driven
  if (newState === 'knocked') {
    self.knockedStartTime = millis();
    // while knocked, ensure flags that could interfere are cleared
    try { self.attacking = false; self.attackType = null; self._hitTargets = null; } catch (e) {}
    // permitir que la animación de knocked avance y al llegar al último frame se quede ahí
    self._knockedAnimationEnded = false;
  } else {
    // clear knockedStartTime when leaving knocked
    if (prevState === 'knocked') delete self.knockedStartTime;
    if (self._knockedAnimationEnded !== undefined) delete self._knockedAnimationEnded;
  }
  if (newState === 'recovery') {
    self.recoveryStartTime = millis();
    // make recovery non-attacking by default
    try { self.attacking = false; self.attackType = null; } catch (e) {}
  } else {
    if (prevState === 'recovery') delete self.recoveryStartTime;
  }

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
    case 'flyback':  self.currentFramesByLayer = self.flybackFramesByLayer || self.hitFramesByLayer; break;
    case 'flyup':    self.currentFramesByLayer = self.flyupFramesByLayer || self.hitFramesByLayer; break;
    case 'shoot':     self.currentFramesByLayer = self.shootFramesByLayer; break;
    case 'hadouken':  self.currentFramesByLayer = self.shootFramesByLayer; break;
    case 'dash':      self.currentFramesByLayer = self.dashFramesByLayer; break;
    case 'taunt':      self.currentFramesByLayer = self.tauntFramesByLayer; break;
    case 'block':      self.currentFramesByLayer = self.blockFramesByLayer; break;
    case 'crouchBlock':      self.currentFramesByLayer = self.crouchBlockFramesByLayer; break;
    case 'blockStun': self.currentFramesByLayer = self.blockStunFramesByLayer || self.blockFramesByLayer; break;
    case 'crouchBlockStun': self.currentFramesByLayer = self.crouchBlockStunFramesByLayer || self.crouchBlockFramesByLayer; break;
    case 'grab':      self.currentFramesByLayer = self.grabFramesByLayer; break;
    case 'grabbed':    self.currentFramesByLayer = self.grabbedFramesByLayer; break;
    case 'knocking':  self.currentFramesByLayer = self.knockingFramesByLayer || self.hitFramesByLayer; break;
    case 'knocked':   self.currentFramesByLayer = self.knockedFramesByLayer || self.hitFramesByLayer; break;
    case 'recovery':  self.currentFramesByLayer = self.recoveryFramesByLayer || self.hitFramesByLayer; break;
    case 'crouchpunch':
      self.currentFramesByLayer = (self.crouchPunchFramesByLayer && (self.crouchPunchFramesByLayer[0] || []).length > 0)
        ? self.crouchPunchFramesByLayer
        : (self.crouchFramesByLayer && (self.crouchFramesByLayer[0] || []).length > 0 ? self.crouchFramesByLayer : self.idleFramesByLayer);
      break;
    case 'crouchPunch':
      self.currentFramesByLayer = (self.crouchPunchFramesByLayer && (self.crouchPunchFramesByLayer[0] || []).length > 0)
        ? self.crouchPunchFramesByLayer
        : (self.crouchFramesByLayer && (self.crouchFramesByLayer[0] || []).length > 0 ? self.crouchFramesByLayer : self.idleFramesByLayer);
      break;
    default:          self.currentFramesByLayer = self.idleFramesByLayer; break;
  }

  // inicializa índices/timers de animación
  self.frameIndex = 0;
  self.frameTimer = 0;

  // Si SALIMOS de un estado de ataque importante, evitar que la regeneración nos devuelva
  // instantáneamente lo gastado: marcar consumo reciente y resetar acumulador/lastTime.
  try {
    // Añadimos estados de "hit" y launch para evitar picos de regeneración al salir de ellos
    const attackStates = new Set([
      'punch','punch2','punch3','kick','kick2','kick3',
      'hadouken','tats','bun','grab','taunt','shoot',
      // hit-related states
      'hit','hit1','hit2','hit3','flyback','flyup',
      'knocking','knocked','recovery'
    ]);
    const wasInAttack = attackStates.has(prevState);
    const nowInAttack = attackStates.has(newState);
    // Stamina removed: no need to mark recent consumption on state transitions.
  } catch (e) {
    /* silent */
  }
}

export function updateAnimation(self) {
  // NO avanzar animación si está en pausa o durante hitstop
  if (window.PAUSED || window.HITSTOP_ACTIVE) return;
  if (!self.currentFramesByLayer) return;

  // determina delay por acción si existe mapping actions, fallback a 6
  const action = (self.actions && self.actions[self.state.current]) || {};
  // hacer recovery un poco más lento visualmente
  let frameDelay = action.frameDelay ?? 6;
  if (self.state && self.state.current === 'recovery') {
    frameDelay = Math.max(8, Math.round(frameDelay * 1.4));
  }

  self.frameTimer = (self.frameTimer || 0) + 1;
  if (self.frameTimer > frameDelay) {
    self.frameTimer = 0;
    // número de frames en la primera capa (asume capas homogéneas)
    const layer0 = self.currentFramesByLayer[0] || [];
    const frameCount = layer0.length || 1;
    // Si estamos en 'knocked' queremos avanzar la animación pero QUEDARNOS en el último frame
    if (self.state && self.state.current === 'knocked') {
      if (frameCount <= 1) {
        self.frameIndex = 0;
        self._knockedAnimationEnded = true;
      } else if ((self.frameIndex || 0) < frameCount - 1) {
        self.frameIndex = (self.frameIndex || 0) + 1;
      } else {
        // stay on last frame
        self.frameIndex = frameCount - 1;
        self._knockedAnimationEnded = true;
      }
    } else {
      // comportamiento normal (loop)
      self.frameIndex = (self.frameIndex + 1) % frameCount;
    }
  }
}

export function exitHitIfElapsed(self) {
  // NO procesar salidas de hit mientras hay hitstop (mantener freeze consistente)
  if (window.PAUSED || window.HITSTOP_ACTIVE) return;

  // Si el fighter llegó a 0 HP durante cualquier parte del flujo, forzar knockdown inmediato.
  if (typeof self.hp === 'number' && self.hp <= 0) {
    try { self.setState('knocked'); } catch (e) {}
    // limpiar marcas de stun/tiempo
    self.blockStunStartTime = 0;
    self.isHit = false;
    return;
  }

  // -------------------- MODIFIED: decide knocked vs idle al expirar isHit --------------------
  if (self.isHit && millis() - self.hitStartTime >= self.hitDuration) {
    // marcar que ya no estamos en "isHit"
    self.isHit = false;
    // limpiar banderas adicionales de visual hit2/hit3
    if (self.isHit2) delete self.isHit2;
    if (self.isHit3) delete self.isHit3;

    // condición para convertir la salida de hit en knockdown en lugar de idle:
    // - si el nivel de hit fue 3 o más
    // - o si estamos exhaustos (stamina <= 0)
    const hitLevel = (typeof self.hitLevel === 'number') ? self.hitLevel : 0;
    // stamina removed: only use hit level to decide knockdown
    const shouldKnock = (hitLevel >= 3);

    if (shouldKnock) {
      try {
        // preferimos la versión 'forceSetState' para aplicar la visual incluso si hay hitstop/pausa
        if (typeof forceSetState === 'function') {
          forceSetState(self, 'knocked');
        } else {
          self.setState('knocked');
        }
      } catch (e) {
        try { self.setState('knocked'); } catch (e2) {}
      }
    } else {
      try {
        self.setState('idle');
      } catch (e) {}
    }

    // limpiar cualquier marca de lanzamiento al terminar el hit/launch
    if (self._launched) { delete self._launched; delete self._launchedStart; delete self._launchedDuration; }
    // limpiar supresión para que futuros hits se comporten normalmente
    if (self._suppressHitState) delete self._suppressHitState;
  }
  // -------------------- end modified block --------------------

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

  // NEW: knocked -> recovery -> idle transitions basadas en duraciones configurables
  try {
    if (self.state && self.state.current === 'knocked') {
      const start = self.knockedStartTime || 0;
      const dur = (typeof self.knockedDurationMs === 'number') ? self.knockedDurationMs : 1200;
      if (start > 0 && (millis() - start) >= dur) {
        // pasar a recovery y dejar que setState registre recoveryStartTime
        self.setState('recovery');
      }
    } else if (self.state && self.state.current === 'recovery') {
      const start = self.recoveryStartTime || 0;
      const dur = (typeof self.recoveryDurationMs === 'number') ? self.recoveryDurationMs : 800;
      if (start > 0 && (millis() - start) >= dur) {
        // volver a idle (o reevaluar según input cuando corresponda)
        self.setState('idle');
      }
    }
  } catch (e) {
    // ignore transition errors
  }
}

// NEW: fuerza el cambio de estado saltándose bloqueo de pausa/hitstop.
// Actualmente usado para mostrar knocked inmediatamente durante hitstop/pause.
export function forceSetState(self, newState) {
  try {
    const prevState = self.state?.current;
    self.state = self.state || { current: null, timer: 0 };
    self.state.current = newState;
    self.state.timer = 0;

    if (newState === 'knocked') {
      self.knockedStartTime = millis();
      // asegurar limpieza mínima
      try { self.attacking = false; self.attackType = null; self._hitTargets = null; } catch (e) {}
      // asignar frames knocked y dejar en último frame visual
      self.currentFramesByLayer = self.knockedFramesByLayer || self.hitFramesByLayer || self.currentFramesByLayer || [];
      const layer0 = self.currentFramesByLayer[0] || [];
      self.frameIndex = Math.max(0, (layer0.length || 1) - 1);
      self.frameTimer = 0;
      self._knockedAnimationEnded = true;
      try { console.log(`[Anim.forceSetState] forced ${self.id || '?'} -> knocked (visual applied)`); } catch (e) {}
      return;
    }

    if (newState === 'recovery') {
      self.recoveryStartTime = millis();
      self.currentFramesByLayer = self.recoveryFramesByLayer || self.hitFramesByLayer || self.currentFramesByLayer || [];
      self.frameIndex = 0;
      self.frameTimer = 0;
      try { console.log(`[Anim.forceSetState] forced ${self.id || '?'} -> recovery (visual applied)`); } catch (e) {}
      return;
    }

    // fallback: set basic frames for other states using existing mapping where available
    switch (newState) {
      case 'idle': self.currentFramesByLayer = self.idleFramesByLayer; break;
      case 'hit1': self.currentFramesByLayer = self.hit1FramesByLayer || self.hitFramesByLayer; break;
      case 'hit2': self.currentFramesByLayer = self.hit2FramesByLayer || self.hitFramesByLayer; break;
      case 'hit3': self.currentFramesByLayer = self.hit3FramesByLayer || self.hitFramesByLayer; break;
      default: self.currentFramesByLayer = self.idleFramesByLayer || self.currentFramesByLayer; break;
    }
    self.frameIndex = 0;
    self.frameTimer = 0;
  } catch (err) {
    try { console.warn('[Anim.forceSetState] failed', err); } catch (e) {}
  }
}
