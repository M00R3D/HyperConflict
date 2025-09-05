// entities/fighter/movement.js
import * as Hitbox from './hitbox.js';

export function updateMovement(self) {
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

  const acc = self.runActive ? self.runAcceleration : self.acceleration;
  const maxSpd = self.runActive ? self.runMaxSpeed : self.maxSpeed;
  const friction = self.runActive ? self.runFriction : self.friction;

  if (self.keys.left && self.state.current !== "fall" && self.state.current !== "jump") self.vx -= acc;
  if (self.keys.right && self.state.current !== "fall" && self.state.current !== "jump") self.vx += acc;

  if (!self.keys.left && !self.keys.right && self.state.current !== "fall" && self.state.current !== "jump") {
    if (self.vx > 0) self.vx = Math.max(0, self.vx - friction);
    if (self.vx < 0) self.vx = Math.min(0, self.vx + friction);
  }

  if (self.keys.left) self.facing = -1;
  if (self.keys.right) self.facing = 1;

  self.vx = constrain(self.vx, -maxSpd, maxSpd);
  self.x += self.vx;

  // push para evitar superposición con oponente
  if (self.opponent && self.state.current !== "dash") {
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

  // gravedad y salto
  self.vy += self.gravity;
  self.y += self.vy;
  if (self.y >= height - 72) { self.y = height - 72; self.vy = 0; self.onGround = true; }
  else self.onGround = false;

  self.x = constrain(self.x, 0, width - self.w);
}

export function autoFace(self, opponent) {
  if (!opponent) return;
  const towardOpponent = (opponent.x > self.x) ? 1 : -1;
  const runningBackwards =
    self.runActive &&
    ((self.keys.right && towardOpponent === -1) || (self.keys.left && towardOpponent === 1));
  if (!runningBackwards) self.facing = towardOpponent;
}
