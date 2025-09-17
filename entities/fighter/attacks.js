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
  // inicializar set de objetivos golpeados por esta activación (evita multi-hit repetido)
  self._hitTargets = new Set();
  self.lastAttackTimeByKey[key] = now;
  self.inputLockedByKey[key] = true;
  self.comboStepByKey[key] = (step + 1);
  if (self.comboStepByKey[key] >= chain.length) self.comboStepByKey[key] = 0;
}

export function attackHits(self, opponent) {
  if (!self.attacking) return false;
  // asegurar estructura _hitTargets
  if (!self._hitTargets) self._hitTargets = new Set();

  // si ya fue golpeado por esta activación, no volver a reportar hit
  if (opponent && opponent.id && self._hitTargets.has(opponent.id)) return false;

  const atkHB = self.getAttackHitbox();
  if (!atkHB) return false;
  const oppHB = opponent.getCurrentHitbox();
  const collided = (
    atkHB.x < oppHB.x + oppHB.w &&
    atkHB.x + atkHB.w > oppHB.x &&
    atkHB.y < oppHB.y + oppHB.h &&
    atkHB.y + atkHB.h > oppHB.y
  );

  if (collided) {
    // marcar como golpeado por esta activación para evitar múltiples hits
    if (opponent && opponent.id) self._hitTargets.add(opponent.id);
    return true;
  }
  return false;
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
  // si ya está en hit y no es un upgrade de nivel, no re-aplicamos
  const atkName = attacker && attacker.attackType ? attacker.attackType : null;

  // mapear ataque -> nivel deseado
  const levelMap = {
    punch: 1, punch2: 2, punch3: 3,
    kick: 1, kick2: 2, kick3: 3,
    hadouken: 1
  };
  const newLevel = levelMap[atkName] || 1;

  // si ya está en hit y su nivel actual es >= newLevel, no hacemos nada
  if (self.isHit && (self.hitLevel || 0) >= newLevel) {
    return;
  }

  // ahora sí aplicamos/upgrade del hit
  self.hp -= 1;
  self.isHit = true;
  self.hitStartTime = millis();

  let kbX = 0;
  let kbY = -2;
  // default hitstun map (fallbacks)
  const defaultHitstun = {
    punch: 200, punch2: 720, punch3: 700,
    kick: 220, kick2: 320, kick3: 520,
    hadouken: 260, default: 220
  };

  // Si el atacante y su acción definen hitstun, úsalo; si no, usa el default map.
  let hitStun = (attacker && attacker.actions && attacker.actions[atkName] && attacker.actions[atkName].hitstun)
    || defaultHitstun[atkName] || defaultHitstun.default;

  self.hitLevel = newLevel; // setear al nuevo nivel

  // empujar hacia la "espalda" del golpeado: -facing
  const pushDir = -(self.facing || 1);

  switch (atkName) {
    case 'punch':
      kbX = pushDir * 1.0; kbY = -2.2; break;
    case 'punch2':
      kbX = pushDir * 1.0; kbY = -4.0; break;
    case 'punch3':
      kbX = pushDir * 10.0; kbY = -5.2; break;
    case 'kick':
      kbX = pushDir * 2.6; kbY = -1.8; break;
    case 'kick2':
      kbX = 0; kbY = -4.2; break;
    case 'kick3':
      kbX = pushDir * 5.5; kbY = -5.0; break;
    case 'hadouken':
      kbX = pushDir * 3.5; kbY = -2.0; break;
    default:
      kbX = pushDir * 2.0; kbY = -2.0; break;
  }

  // aplicar knockback (reemplaza valores anteriores si es upgrade)
  self.vx = kbX;
  self.vy = kbY;

  if (kbY < -1.5) self.onGround = false;

  self.hitDuration = hitStun;
  // setear estado específico por nivel: hit1/hit2/hit3 (pero con misma animación)
  const stateName = 'hit' + (self.hitLevel || 1);
  self.setState(stateName);

  // Empujón ligero del atacante hacia adelante para facilitar encadenes
  // if (attacker && attacker !== self) {
  //   const followPushMap = { punch2: 1.6, punch3: 2.6, kick2: 1.2, kick3: 2.0 };
  //   const boost = followPushMap[attacker.attackType] || 0;
  //   if (boost > 0) {
  //     attacker.vx = (attacker.vx || 0) + boost * (attacker.facing || 1);
  //     const cap = (attacker.runActive ? attacker.runMaxSpeed : attacker.maxSpeed) * 2;
  //     attacker.vx = constrain(attacker.vx, -cap, cap);
  //   }
  // }
}

export function updateAttackState(self) {
  const now = millis();
  if (self.attacking && (now - self.attackStartTime > self.attackDuration)) {
    self.attacking = false; self.attackType = null;
    // limpiar lista de objetivos al terminar la activación
    if (self._hitTargets) { self._hitTargets.clear(); self._hitTargets = null; }
  }
}
