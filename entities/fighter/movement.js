// entities/fighter/movement.js
import * as Hitbox from './hitbox.js';

export function updateMovement(self) {
  // Si existe knockback persistente, aplicarlo primero y protegerlo contra sobrescrituras
  if (self._knockback) {
    try {
      // aplicar la velocidad del knockback (vx se gestiona por kb, vy por gravedad salvo el impulso inicial)
      // ensure we have an initial snapshot for time-based decay
      if (typeof self._knockback._initialVx === 'undefined') {
        self._knockback._initialVx = (typeof self._knockback.vx === 'number') ? self._knockback.vx : (self.vx || 0);
        self._knockback._startedAt = (typeof millis === 'function') ? millis() : Date.now();
      }

      if (typeof self._knockback.vy === 'number' && !self.onGround) {
        // aplicar vy sólo como impulso inicial; evitar reaplicarlo cada frame
        if (!self._knockback._vyApplied) {
          self.vy = self._knockback.vy;
          self._knockback._vyApplied = true;
          // try { 
            // console.log('[KNOCKBACK-VY-APPLIED]', { char: self.charId || self.id, vy: self.vy, startedAt: self._knockback._startedAt }); 
          // } catch (e) {}
        }
      }

      // decay horizontal: preferimos un modo basado en tiempo para throws (hitLevel 4)
      let appliedVx = self._knockback._initialVx;
      try {
        if (typeof window !== 'undefined' && typeof window.getThrowDecayForChar === 'function' && self.hitLevel === 4 && typeof self._launched === 'string') {
          const tdTable = window.getThrowDecayForChar(self.charId || 'default');
          const kind = (self._launched === 'flyback') ? 'flyback' : (self._launched === 'flyup' ? 'flyup' : 'normal');
          const cfg = (tdTable && typeof tdTable[kind] !== 'undefined') ? tdTable[kind] : null;

          // If cfg is an object with durationMs, perform a time-based lerp from initial->0
          if (cfg && typeof cfg === 'object' && typeof cfg.durationMs === 'number') {
            const now = (typeof millis === 'function') ? millis() : Date.now();
            const elapsed = Math.max(0, now - (self._knockback._startedAt || now));
            const prog = Math.min(1, elapsed / cfg.durationMs);
            appliedVx = lerp(self._knockback._initialVx, 0, prog);
          } else if (typeof cfg === 'number') {
            // numeric multiplier fallback (per-frame)
            appliedVx = (typeof self._knockback.vx === 'number') ? (self._knockback.vx * cfg) : (appliedVx * cfg);
          } else {
            // global default multiplier
            appliedVx = (typeof self._knockback.vx === 'number') ? (self._knockback.vx * 0.92) : (appliedVx * 0.92);
          }
        } else {
          // non-throw knockback: keep numeric decay or frames-based behavior
          const decay = (typeof self._knockback.decay === 'number') ? self._knockback.decay : 0.92;
          appliedVx = (typeof self._knockback.vx === 'number') ? (self._knockback.vx * decay) : (appliedVx * decay);
        }
      } catch (e) {
        appliedVx = (typeof self._knockback.vx === 'number') ? self._knockback.vx : appliedVx;
      }

      // Small extra brake specifically for flyback launches (tasteful, not brutal)
      try {
        if (self._launched === 'flyback') {
          appliedVx = lerp(appliedVx, 0, 0.015);
        }
      } catch (e) {}

      // commit applied vx back into knockback record and to fighter vx
      self._knockback.vx = appliedVx;
      self.vx = appliedVx;

      // frames bookkeeping (legacy support)
      self._knockback.frames = (typeof self._knockback.frames === 'number') ? (self._knockback.frames - 1) : Infinity;

      // limpiar cuando ya casi no tiene velocidad o se acabaron frames
      if (Math.abs(self._knockback.vx) < 0.06 || (typeof self._knockback.frames === 'number' && self._knockback.frames <= 0)) {
        delete self._knockback;
      }
    } catch (e) {
      // no romper movimiento por errores pequeños
      delete self._knockback;
    }
  }

  // Si estás agarrado por otro, no ejecutar arreglo de movimiento (quedarte inmóvil)
  if (self._grabLock) {
    // no sobrescribir knockback si existe
    if (!self._knockback) { self.vx = 0; this.vy = 0; }
    return;
  }

  // Si estamos en block sobre el suelo, aplicar fricción fuerte / detener movimiento.
  if ((self.blocking || self.state?.current === 'block' || self.state?.current === 'crouchBlock') && self.onGround) {
    // frenar vx de forma agresiva, pero respetar knockback si hay
    if (!self._knockback) {
      const stopFactor = 0.6;
      self.vx = lerp(self.vx || 0, 0, stopFactor);
      if (Math.abs(self.vx) < 0.05) self.vx = 0;
    }
    self.runActive = false;
    // no devolvemos early: mantener otras lógicas como collision/grav etc.
  }

  // NEW: respetar cooldown después de salir de grab — bloquear física/movimiento durante ese periodo
  const grabExitStart = self._grabExitCooldownStart || 0;
  const grabExitDur = self._grabExitCooldownDuration || 220;
  if (grabExitStart && (millis() - grabExitStart) < grabExitDur) {
    self.vx = 0;
    self.vy = 0;
    // Reset directional flags to avoid residual run/jump
    self.keys = self.keys || { left: false, right: false, up: false };
    self.keys.left = false; self.keys.right = false; self.keys.up = false;
    self.runActive = false;
    return;
  }

  // Si somos quienes estamos SOSTENIENDO un grab, bloquear TODO movimiento hasta soltar
  if (self.state && self.state.current === 'grab' && self._grabHolding) {
    self.vx = 0;
    self.vy = 0;
    // asegurarse de que no quede run activo ni flags de dirección
    self.keys = self.keys || { left: false, right: false, up: false };
    self.keys.left = false; self.keys.right = false; self.keys.up = false;
    self.runActive = false;
    return;
  }

  // DASH: movimiento especial
  if (self.state.current === "dash") {
    // target smooth velocity (usa los valores de configuración del fighter)
    const target = (self.dashSpeed || 12) * (self.dashDirection || self.facing || 1);
    const ease = (self.dashEase !== undefined) ? self.dashEase : 0.45;
    // interpola la velocidad actual hacia la target para sensación "juice"
    self.vx = lerp(self.vx, target, ease);
    self.x += self.vx;

    // gravedad y salto siguen igual (para no romper plataformas/jumps)
    self.vy += self.gravity;
    self.y += self.vy;
    if (self.y >= height - 72) { self.y = height - 72; self.vy = 0; self.onGround = true; }
    else self.onGround = false;

    // no empujar al oponente durante dash (ya lo omite por la condición)
    self.x = constrain(self.x, 0, width - self.w);
    return; // omite el resto del movimiento normal
  }

  // --- FORZAR QUIETO EN TODOS LOS ATAQUES ---
  // mantener la restricción solo si NO hay knockback activo
  if ((self.state.current === "grab" || self.state.current === "grabbed") && !self._knockback) {
    self.vx = 0;
  }
  if (
    self.state.current === "punch" ||
    self.state.current === "punch2" ||
    self.state.current === "punch3" ||
     self.state.current === "crouchpunch" ||
     self.state.current === "crouchPunch" ||
     self.state.current === "crouchkick" ||
     self.state.current === "crouchKick" ||
    self.state.current === "kick" ||
    self.state.current === "kick2" ||
    self.state.current === "kick3"
  ) {
    // si hay knockback dejamos que eius vx persista (no aplicar decrementos que cancelen el empuje)
    if (!self._knockback) {
      // For regular standing attacks we slightly reduce horizontal velocity to settle.
      if (
        self.state.current === 'crouchpunch' || self.state.current === 'crouchPunch' ||
        self.state.current === 'crouchkick' || self.state.current === 'crouchKick'
      ) {
        // lock movement for crouch attacks: stop horizontal movement on ground
        self.vx = 0;
        // only zero vertical velocity if grounded; if in air, allow gravity to act normally
        if (self.onGround) self.vy = 0;
        self.keys.left = false; self.keys.right = false; self.keys.up = false;
        self.runActive = false;
      } else {
        if(self.vx>0 && self.vy==0) self.vx -= 0.04;
        else if(self.vx<0 && self.vy==0) self.vx += 0.04;
      }
    }
  }

  // --- CORTAR DASH SI ENTRA EN ATAQUE ---
  if (
    self.state.current === "punch" ||
    self.state.current === "punch2" ||
    self.state.current === "punch3" ||
    self.state.current === "kick" ||
    self.state.current === "kick2" ||
    self.state.current === "kick3" ||
    self.state.current === "crouchkick" ||
    self.state.current === "crouchKick" ||
    self.state.current === "crouchpunch" ||
    self.state.current === "crouchPunch"
  ) {
    if (self._wasInDash) {
      // Si venía de dash, lo cortamos
      self.state.current = self.attackType || self.state.current;
      self.dashDirection = 0;
      self.dashStartTime = 0;
      self.runActive = false;
    }
    if(self.vx>0 && self.vy==0) self.vx -= 0.1;
    else if(self.vx<0 && self.vy==0) self.vx += 0.1;
  }
  self._wasInDash = (self.state.current === "dash");

  const acc = self.runActive ? self.runAcceleration : self.acceleration;
  const maxSpd = self.runActive ? self.runMaxSpeed : self.maxSpeed;
  // Stamina removed: no mobility penalty
  const effectiveAcc = acc;
  const effectiveMaxSpd = maxSpd;
  // base friction según si corre o no
  const baseFriction = self.runActive ? self.runFriction : self.friction;

  // Si el fighter está ejecutando un ataque "grounded" largo (hadouken o tats),
  // aumentamos la fricción para que se quede más quieto en el suelo.
  const isGroundedAttack = !self.isHit && (
    (self.state && (self.state.current === 'hadouken' || self.state.current === 'tats')) ||
    (self.attacking && (self.attackType === 'hadouken' || self.attackType === 'tats'))
  );
  const groundedMult = (typeof self.groundedAttackFrictionMultiplier === 'number') ? self.groundedAttackFrictionMultiplier : 6;
  const friction = baseFriction * (isGroundedAttack ? groundedMult : 1);

  // si estamos en hit3, queremos menos fricción horizontal para que el launch dure más
  const effectiveFriction = (self.isHit && self.hitLevel === 3) ? (friction * 0.15) : friction;

  // Si estás en estado 'hit', NO permitimos controlar vx ni girar con las teclas
  if (!self.isHit) {
    // NO permitir modificar vx durante ataques (incluye variantes crouch)
    const isAttackingState = (
      self.state.current === "punch" ||
      self.state.current === "punch2" ||
      self.state.current === "punch3" ||
      self.state.current === "kick" ||
      self.state.current === "kick2" ||
      self.state.current === "kick3" ||
      self.state.current === "crouchpunch" ||
      self.state.current === "crouchPunch" ||
      self.state.current === "crouchkick" ||
      self.state.current === "crouchKick"
    );
    if (!isAttackingState) {
      if (self.keys.left && self.state.current !== "fall" && self.state.current !== "jump") self.vx -= effectiveAcc;
      if (self.keys.right && self.state.current !== "fall" && self.state.current !== "jump") self.vx += effectiveAcc;
    }
    if (!self.keys.left && !self.keys.right && self.state.current !== "fall" && self.state.current !== "jump") {
      if (self.vx > 0) self.vx = Math.max(0, self.vx - effectiveFriction);
      if (self.vx < 0) self.vx = Math.min(0, self.vx + effectiveFriction);
    }
    // no reasignar facing continuamente aquí (segestiona en key-press y autoFace)
    // if (self.keys.left) self.facing = -1;
    // if (self.keys.right) self.facing = 1;
  } else {
    // Si estás en hit: aplicar sólo fricción para que no quede drift infinito
    
      // Si estás en hit: si hay knockback, reducir fricción mucho menos para permitir desplazamiento
      if (!self._knockback) {
        if (!self.keys.left && !self.keys.right) {
          if (self.vx > 0) self.vx = Math.max(0, self.vx - effectiveFriction);
          if (self.vx < 0) self.vx = Math.min(0, self.vx + effectiveFriction);
        }
      } else {
        // durante knockback dejar que la velocidad persista (aplicar una fricción muy baja)
        const kbFric = (effectiveFriction * 0.03);
        if (self.vx > 0) self.vx = Math.max(0, self.vx - kbFric);
        if (self.vx < 0) self.vx = Math.min(0, self.vx + kbFric);
      }
    
  }

  self.vx = constrain(self.vx, -effectiveMaxSpd, effectiveMaxSpd);
  self.x += self.vx;
  
  // allow larger horizontal speeds while launched / heavily launched (do not clamp the initial knockback)
  // Si estamos en lanzamiento explícito (_launched) o en hitLevel 3, ampliar el tope horizontal
  if (self._launched || (self.isHit && self.hitLevel === 3)) {
    // cap más generoso para conservar picos altos de knockback
    const launchCap = Math.max(Math.abs(self.vx), (self.runMaxSpeed || 6) * 5, 36);
    // si la velocidad actual excede el maxSpd, permitir que persista hasta launchCap
    self.vx = constrain(self.vx, -launchCap, launchCap);
    // reducir la fricción horizontal durante el vuelo para que no "frene" tan rápido
    // si estamos lanzados dejamos que la velocidad persista más tiempo
    if (!self.keys.left && !self.keys.right) {
      // aplicar muy poca fricción mientras _launched
      if (self._launched) {
        if (self.vx > 0) self.vx = Math.max(0, self.vx - ((self.friction || 0.1) * 0.02));
        else if (self.vx < 0) self.vx = Math.min(0, self.vx + ((self.friction || 0.1) * 0.02));
      }
    }
    // aplicar posición base (no sumamos extra para evitar teleporte)
  }
  
  // push para evitar superposición con oponente
  if (self.opponent) {
    const selfDashing = (self.state && self.state.current) === "dash";
    const oppDashing = (self.opponent.state && self.opponent.state.current) === "dash";
    // aplicar push sólo si ambos están en dash o ninguno está en dash.
    // Si sólo uno está en dash, permitir atravesar (no empujar).
    const applyPush = (!selfDashing && !oppDashing) || (selfDashing && oppDashing);
    if (applyPush) {
      const myHB = Hitbox.getCurrentHitbox(self);
      const oppHB = Hitbox.getCurrentHitbox(self.opponent);
      if (
        myHB.x < oppHB.x + oppHB.w &&
        myHB.x + myHB.w > oppHB.x &&
        myHB.y < oppHB.y + oppHB.h &&
        myHB.y + myHB.h > oppHB.y
      ) {
        const myCenter = myHB.x + myHB.w / 2;
        const oppCenter = oppHB.x + oppHB.w / 2;
        const halfSum = myHB.w / 2 + oppHB.w / 2;
        const dist = Math.abs(myCenter - oppCenter);
        const overlap = Math.max(0, halfSum - dist);
        if (overlap > 0.0001) {
          const pushAmount = overlap / 2 + 0.5;
          if (myCenter < oppCenter) {
            self.x = constrain(self.x - pushAmount, 0, width - self.w);
            self.opponent.x = constrain(self.opponent.x + pushAmount, 0, width - self.opponent.w);
          } else {
            self.x = constrain(self.x + pushAmount, 0, width - self.w);
            self.opponent.x = constrain(self.opponent.x - pushAmount, 0, width - self.opponent.w);
          }
        }
      }
    }
  }

  // gravedad y salto
  const isLaunchState = (self.state.current === "flyback" || self.state.current === "flyup" || self._launched === 'flyback' || self._launched === 'flyup');
  const gravityMult = isLaunchState ? 2.5 : 1; // aumento de gravedad en lanzamientos (ajustado)
  self.vy += self.gravity * gravityMult;
  self.y += self.vy;

  // Ground handling: support a small "bounce" when landing from flyup/flyback (pelota)
  const groundY = height - 72;
  if (self.y >= groundY) {
    const landingVy = self.vy;
    if (isLaunchState && landingVy > 2) {
      // perform a controlled bounce
      self._launchedBounceCount = (self._launchedBounceCount || 0) + 1;
      const bounceFactor = 0.45; // how bouncy the launch feels (tuneable)
      self.vy = -landingVy * bounceFactor;
      // damp horizontal velocity on bounce
      self.vx *= 0.2;

      if (self._launchedBounceCount >= 2) {
        // settle after a couple of bounces
        self.y = groundY;
        self.vy = 0;
        self.onGround = true;
        delete self._launched;
        // reduce knockback so movement doesn't continue too long
        if (self._knockback) self._knockback.vx *= 0.4;
        self._launchedBounceCount = 0;
      } else {
        // keep slightly above ground so the bounce is visible
        self.y = groundY - 1;
        self.onGround = false;
      }
    } else {
      // normal landing
      self.y = groundY;
      self.vy = 0;
      self.onGround = true;
      self._launchedBounceCount = 0;
    }
  } else {
    self.onGround = false;
  }

  // DEBUG: log coordinates/velocity while in flyup/flyback so we can tune decay/forces
  try {
    const stateIsFly = (self.state && (self.state.current === 'flyup' || self.state.current === 'flyback'));
    const launchedIsFly = (typeof self._launched === 'string' && (self._launched === 'flyup' || self._launched === 'flyback'));
    if (stateIsFly || launchedIsFly) {
      const opp = self.opponent || (typeof window !== 'undefined' ? ((window.player1 && window.player1.id === self.id) ? window.player2 : window.player1) : null);
      const snap = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : n);
      // console.log('[LAUNCH-TRACE]', {
      //   t: millis(),
      //   char: self.charId || self.id,
      //   state: self.state?.current || null,
      //   launched: self._launched || null,
      //   x: snap(self.x), y: snap(self.y), vx: snap(self.vx), vy: snap(self.vy), onGround: !!self.onGround,
      //   opponent: opp ? { char: opp.charId || opp.id, x: snap(opp.x), y: snap(opp.y), vx: snap(opp.vx), vy: snap(opp.vy) } : null
      // });
    }
  } catch (e) {}

  self.x = constrain(self.x, 0, width - self.w);

  // Stamina removed: no regeneration logic.
}

export function autoFace(self, opponent) {
  if (!opponent) return;
  const towardOpponent = (opponent.x > self.x) ? 1 : -1;
  const runningBackwards =
    self.runActive &&
    ((self.keys.right && towardOpponent === -1) || (self.keys.left && towardOpponent === 1));
  if (!runningBackwards) self.facing = towardOpponent;
}
