// entities/fighter/specials.js
import { Projectile } from '../../entities/projectile.js';
import { projectiles } from '../../core/main.js';
import * as Hitbox from './hitbox.js';
import * as Buffer from './buffer.js';

// Se definen las secuencias base asumiendo facing = 1 (mirando a la derecha).
// Cada movimiento puede declarar direction: 'forward'|'backward'|'any' para reglas futuras.
export const specialDefs = {
  hadouken: { seq: ['↓','↘','→','P'], direction: 'forward' },
  shoryuken: { seq: ['→','↓','↘','P'], direction: 'forward' },
  supersalto: { seq: ['↓','↑'], direction: 'any' },
  ty_tats: { seq: ['↓','↙','←','K'], direction: 'backward' }
};

export function checkSpecialMoves(self) {
  const bufSymbols = (self.inputBuffer || []).map(i => i.symbol || '');
  // identificar el último símbolo direccional (si existe)
  const directionalSet = new Set(['←','→','↑','↓','↖','↗','↘','↙']);
  let lastDirInBuffer = null;
  for (let i = bufSymbols.length - 1; i >= 0; i--) {
    if (directionalSet.has(bufSymbols[i])) { lastDirInBuffer = bufSymbols[i]; break; }
  }

  for (const moveName in specialDefs) {
    const def = specialDefs[moveName];
    if (!def || !Array.isArray(def.seq)) continue;

    // construir secuencia efectiva según facing (si facing === -1, espejar)
    let seq = def.seq.slice();
    if (self.facing === -1) seq = seq.map(s => Hitbox.mirrorSymbol(s));

    // opción: exigir direction (forward/backward) — pero al espejar la secuencia ya queda correcta
    if (def.direction === 'forward') {
      // si hay un símbolo direccional en el buffer y no coincide con forward relativo al facing, skip
      if (lastDirInBuffer) {
        const forwardSet = (self.facing === 1) ? new Set(['→','↘','↗']) : new Set(['←','↙','↖']);
        if (!forwardSet.has(lastDirInBuffer)) continue;
      }
    } else if (def.direction === 'backward') {
      if (lastDirInBuffer) {
        const backSet = (self.facing === 1) ? new Set(['←','↙','↖']) : new Set(['→','↘','↗']);
        if (!backSet.has(lastDirInBuffer)) continue;
      }
    }

    // match estricto: la cola del buffer debe coincidir exactamente con la secuencia
    if (Buffer.bufferEndsWith(self, seq)) {
      doSpecial(self, moveName);
      Buffer.bufferConsumeLast(self, seq.length);
      return;
    }

    // si quieres permitir entradas con símbolos intermedios en algunos specials,
    // usa Buffer.flexibleEndsWith(bufSymbols, seq) en lugar de bufferEndsWith.
  }
}

export function doSpecial(self, moveName) {
  if (moveName === 'hadouken') {
    self.setState('hadouken');
    self.attackType = 'hadouken';
    self.attacking = true;
    self.attackStartTime = millis();
    self.attackDuration = self.actions?.hadouken?.duration || 600;

    const dir = self.facing === 1 ? 1 : -1;
    const px = Math.round(self.x + (dir === 1 ? self.w + 4 : -4));
    const py = Math.round(self.y + self.h / 2 - 6);
    const p = new Projectile(px, py, dir, 1, self.id, null, {}, self.projectileFramesByLayer);
    projectiles.push(p);
  } else if (moveName === 'shoryuken') {
    self.setState('punch3'); self.attackType = 'punch3'; self.attacking = true;
    self.attackStartTime = millis(); self.attackDuration = self.actions.punch3.duration || 800;
  } else if (moveName === 'tatsumaki') {
    self.setState('kick3'); self.attackType = 'kick3'; self.attacking = true;
    self.attackStartTime = millis(); self.attackDuration = self.actions.kick3.duration || 600;
  } else if (moveName === 'supersalto') {
    // Supersalto: impulso vertical más fuerte y "float" temporal (menor gravedad).
    // Activar solo cuando estaba en suelo justo antes del input (evita doble activación en aire)
    const wasOnGround = (typeof self._prevOnGround === 'boolean') ? self._prevOnGround : !!self.onGround;
    if (!wasOnGround) return;

    // Estado visual: salto
    self.setState('jump');
    self.onGround = false;

    // Velocidad vertical aumentada (jumpStrength es negativo)
    const boostFactor = 1.5;
    self.vy = (self.jumpStrength || -5.67) * boostFactor;

    // Efecto de "float": bajar gravedad temporalmente para más hang-time
    if (typeof self.gravity === 'number') {
      self._supersaltoOriginalGravity = self.gravity;
      self.gravity = Math.max(0.08, (self.gravity || 0.3) * 0.55); // reducir gravedad
      self._supersaltoStart = millis();
      self._supersaltoDuration = 520; // ms de reducción de gravedad (ajustable)
      self._supersaltoActive = true;
    }
    // opcional: reproducir sonido / particle spawn si tienes sistema
    return;
  } else if (moveName === 'ty_tats') {
    // ty_tats: reproducir la animación 'tats' en el personaje y crear una BARRERA de 4 proyectiles
    try {
      if (self.tatsFramesByLayer && self.tatsFramesByLayer.length) {
        self.setState('tats');
      } else {
        self.setState('punch3');
      }
    } catch (e) {}

    // marcar como ataque (usa 'tats' para anim/hitbox)
    self.attacking = true;
    self.attackType = 'tats';
    self.attackStartTime = millis();
    self.attackDuration = (self.actions && self.actions.tats && self.actions.tats.duration) || 420;

    // parámetros base del proyectil barrier
    const baseOpts = {
      duration: 3000,    // duración visible más larga
      upSpeed: 2.1,
      targetScale: 2.6,
      w: 20, h: 36,
      frameDelay: 6,
      persistent: true   // IMPORTANT: no se destruyen al golpear
    };

    // Crear 4 proyectiles con spawnDelay secuencial y pequeños offsets
    const gap = 110; // ms entre apariciones
    const initialOffset = Math.round(self.w / 2); // offset base desde el centro
    const step = 18; // px entre piezas
    const centerX = Math.round(self.x + self.w / 2);
    for (let k = 0; k < 4; k++) {
      const dir = self.facing === 1 ? 1 : -1;
      // offset relativo al centro del fighter; para facing=-1 offset será negativo
      const offsetX = (dir === 1)
        ? (initialOffset + 6 + k * step)
        : -(initialOffset + 6 + k * step);
      const px = Math.round(centerX + offsetX);
      const py = Math.round(self.y + self.h / 2 - 6);
      const opts = Object.assign({}, baseOpts, { spawnDelay: k * gap });
      const tatsProj = (self.tatsProjFramesByLayer && self.tatsProjFramesByLayer.length) ? self.tatsProjFramesByLayer : null;
      const p = new Projectile(px, py, dir, 4, self.id, {}, opts, tatsProj);
      p._barrierIndex = k;
      projectiles.push(p);
    }

    return;
  }
}
