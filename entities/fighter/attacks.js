// entities/fighter/attacks.js
export function attack(self, key) {
  const now = millis();
  const chain = self.comboChainsByKey[key];
  if (!chain || chain.length === 0) return;
  if (self.inputLockedByKey[key]) return;

  const last = self.lastAttackTimeByKey[key] || 0;
  let step = self.comboStepByKey[key] || 0;
  if (now - last > self.comboWindow) step = 0;

  const attackName = chain[step] || chain[0];
  const action = self.actions[attackName];
  if (!action) { console.warn('Acción no definida en actions:', attackName); return; }

  self.attackType = attackName;
  self.setState(attackName);
  self.attacking = true;
  self.attackStartTime = now;
  self.attackDuration = action.duration || 400;
  self.lastAttackTimeByKey[key] = now;
  self.inputLockedByKey[key] = true;
  self.comboStepByKey[key] = (step + 1);
  if (self.comboStepByKey[key] >= chain.length) self.comboStepByKey[key] = 0;
}

export function attackHits(self, opponent) {
  if (!self.attacking) return false;
  const atkHB = self.getAttackHitbox();
  if (!atkHB) return false;
  const oppHB = opponent.getCurrentHitbox();
  return (
    atkHB.x < oppHB.x + oppHB.w &&
    atkHB.x + atkHB.w > oppHB.x &&
    atkHB.y < oppHB.y + oppHB.h &&
    atkHB.y + atkHB.h > oppHB.y
  );
}

export function shoot(self) {
  const dir = self.keys.right ? 1 : (self.keys.left ? -1 : (self.id === 'p1' ? 1 : -1));
  const Projectile = require('../../entities/projectile.js').Projectile;
  // en módulos ESM usar import; para simplicidad (evitar ciclos) puedes usar la clase que ya pasaste en constructor
  const p = new (require('../../entities/projectile.js').Projectile)(self.x + self.w / 2, self.y + self.h / 2, dir, 0, self.id);
  // push via projectiles global (preservando tu patrón original)
  const proj = require('../../core/main.js').projectiles;
  proj.push(p);
}

export function hit(self, attacker = null) {
  if (self.isHit) return;
  self.hp -= 1;
  self.isHit = true;
  self.hitStartTime = millis();
  self.setState("hit");
  // si tenemos atacante, empujar en la dirección opuesta al atacante.facing
  const fromFacing = attacker ? attacker.facing : self.facing;
  self.vx = -fromFacing * 5;
  self.vy = -3;
}

export function updateAttackState(self) {
  const now = millis();
  if (self.attacking && (now - self.attackStartTime > self.attackDuration)) {
    self.attacking = false; self.attackType = null;
  }
}
