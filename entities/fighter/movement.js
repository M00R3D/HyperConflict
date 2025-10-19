// entities/fighter/movement.js
import * as Hitbox from './hitbox.js';

export function updateMovement(self) {
  // Si estás agarrado por otro, no ejecutar arreglo de movimiento (quedarte inmóvil)
  if (self._grabLock) {
    self.vx = 0;
    self.vy = 0;
    return;
  }

  // Si estamos en block sobre el suelo, aplicar fricción fuerte / detener movimiento.
  // Esto hace que el block se sienta como una postura estable y evita drift.
  if ((self.blocking || self.state?.current === 'block' || self.state?.current === 'crouchBlock') && self.onGround) {
    // frenar vx de forma agresiva
    const stopFactor = 0.6;
    self.vx = lerp(self.vx || 0, 0, stopFactor);
    if (Math.abs(self.vx) < 0.05) self.vx = 0;
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
  if( self.state.current === "grab" || self.state.current === "grabbed"){self.vx=0;}
  if (
    self.state.current === "punch" ||
    self.state.current === "punch2" ||
    self.state.current === "punch3" ||
    self.state.current === "kick" ||
    self.state.current === "kick2" ||
    self.state.current === "kick3"
  ) {
    if(self.vx>0 && self.vy==0) self.vx -= 0.04;
    else if(self.vx<0 && self.vy==0) self.vx += 0.04;
  }

  // --- CORTAR DASH SI ENTRA EN ATAQUE ---
  if (
    self.state.current === "punch" ||
    self.state.current === "punch2" ||
    self.state.current === "punch3" ||
    self.state.current === "kick" ||
    self.state.current === "kick2" ||
    self.state.current === "kick3"
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
  // Si no hay stamina, penalizar ligeramente movilidad (menos aceleración y velocidad máxima)
  const staFactor = (typeof self.stamina === 'number' && self.stamina <= 0) ? 0.85 : 1.0;
  const effectiveAcc = acc * staFactor;
  const effectiveMaxSpd = maxSpd * staFactor;
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
    // NO permitir modificar vx durante ataques
    const isAttackingState = (
      self.state.current === "punch" ||
      self.state.current === "punch2" ||
      self.state.current === "punch3" ||
      self.state.current === "kick" ||
      self.state.current === "kick2" ||
      self.state.current === "kick3"
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
    if (!self.keys.left && !self.keys.right) {
      if (self.vx > 0) self.vx = Math.max(0, self.vx - effectiveFriction);
      if (self.vx < 0) self.vx = Math.min(0, self.vx + effectiveFriction);
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
  if(self.state.current === "flyback" || self.state.current === "flyup") { self.vy += (self.gravity/4*3); }
  else{ self.vy += self.gravity; }
  self.y += self.vy;
  if (self.y >= height - 72) { self.y = height - 72; self.vy = 0; self.onGround = true; }
  else self.onGround = false;

  self.x = constrain(self.x, 0, width - self.w);

  // Regeneración de stamina: si no estamos atacando, no en hit, y no en dash, regenerar por ticks
  try {
    if (typeof self.stamina === 'number' && !(self.attacking || self.isHit || self.state?.current === 'dash')) {
      const now = millis();
      const pause = self._staminaRegenPauseMs || 600;
      // si se consumió recientemente no regenerar y resetear acumulador
      if (self._staminaConsumedAt && (now - self._staminaConsumedAt) < pause) {
        self._staminaRegenAccum = 0;
        self._staminaRegenLastTime = now;
      } else {
        const tick = self._staminaRegenTickMs || 350;
        // inicializar acumulador/lastTime defensivamente
        self._staminaRegenAccum = self._staminaRegenAccum || 0;
        self._staminaRegenLastTime = self._staminaRegenLastTime || now;
        // sumar tiempo real transcurrido (ms) al acumulador
        const delta = Math.max(0, now - self._staminaRegenLastTime);
        self._staminaRegenAccum += delta;
        self._staminaRegenLastTime = now;
        // cuando el acumulador supera el tick, entregar exactamente 1 cuarto y restar el tick
        if (self._staminaRegenAccum >= tick) {
          self._staminaRegenAccum -= tick;
          self.stamina = Math.min(self.staminaMax || 16, (self.stamina || 0) + 1);
          // actualizar marca de último regen para compatibilidad con otros checks
          self._staminaLastRegen = now;
        }
      }
    }
  } catch (e) {}
}

export function autoFace(self, opponent) {
  if (!opponent) return;
  const towardOpponent = (opponent.x > self.x) ? 1 : -1;
  const runningBackwards =
    self.runActive &&
    ((self.keys.right && towardOpponent === -1) || (self.keys.left && towardOpponent === 1));
  if (!runningBackwards) self.facing = towardOpponent;
}
