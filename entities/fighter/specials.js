// entities/fighter/specials.js
import { Projectile } from '../../entities/projectile.js';
import { projectiles } from '../../core/main.js';
import * as Hitbox from './hitbox.js';
import * as Buffer from './buffer.js';

// Se definen las secuencias base asumiendo facing = 1 (mirando a la derecha).
// Cada movimiento puede declarar direction: 'forward'|'backward'|'any' para reglas futuras
const defaultSpecialDefs = {
  hadouken: { seq: ['↓','↘','→','P'], direction: 'forward' },
  shoryuken: { seq: ['→','↓','↘','P'], direction: 'forward' },
  bun: { seq: ['→','↓','↘','P'], direction: 'forward' },
  supersalto: { seq: ['↓','↑'], direction: 'any' },
  ty_tats: { seq: ['↓','↙','←','K'], direction: 'backward' },
  taunt: { seq: ['T'], direction: 'any' }
};

// mapa opcional por personaje (charId -> defs)
const specialDefsByChar = Object.create(null);

// función helper para registrar specials por personaje desde main.js u otro módulo
export function registerSpecialsForChar(charId, defs) {
  if (!charId || typeof defs !== 'object') return;
  specialDefsByChar[charId] = Object.assign({}, specialDefsByChar[charId] || {}, defs);
}

// obtiene el conjunto efectivo de specials para un fighter (instancia override > charId > default)
function getEffectiveSpecialDefs(self) {
  if (self && self.specialDefs && typeof self.specialDefs === 'object') return self.specialDefs;
  if (self && self.charId && specialDefsByChar[self.charId]) return specialDefsByChar[self.charId];
  return defaultSpecialDefs;
}

export function checkSpecialMoves(self) {
  const defsMap = getEffectiveSpecialDefs(self);
  const bufSymbols = (self.inputBuffer || []).map(i => i.symbol || '');
  // identificar el último símbolo direccional (si existe)
  const directionalSet = new Set(['←','→','↑','↓','↖','↗','↘','↙']);
  let lastDirInBuffer = null;
  for (let i = bufSymbols.length - 1; i >= 0; i--) {
    if (directionalSet.has(bufSymbols[i])) { lastDirInBuffer = bufSymbols[i]; break; }
  }

  for (const moveName in defsMap) {
    const def = defsMap[moveName];
    if (!def || !Array.isArray(def.seq)) continue;

    // construir secuencia efectiva según facing (si facing === -1, espejar)
    let seq = def.seq.slice();
    if (self.facing === -1) seq = seq.map(s => Hitbox.mirrorSymbol(s));

    // opción: exigir direction (forward/backward) — pero al espejar la secuencia ya queda correcta
    if (def.direction === 'forward') {
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

    if (Buffer.bufferEndsWith(self, seq)) {
      doSpecial(self, moveName);
      Buffer.bufferConsumeLast(self, seq.length);
      return;
    }
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
  } else if (moveName === 'taunt') {
    self.setState('taunt');
    // mantener la animación durante ~1.7s usando la mecánica de "attacking"
    self.attacking = true;
    self.attackType = 'taunt';
    self.attackStartTime = millis();
    self.attackDuration = 1700; // 1700 ms = 1.7s
  } else if (moveName === 'bun') {
    // visual: usar anim 'bun' (shor-like) si existe
    try { if (self.shorFramesByLayer && self.shorFramesByLayer.length) self.setState('bun'); else self.setState('punch3'); } catch(e){}

    self.attacking = true;
    self.attackType = 'bun';
    self.attackStartTime = millis();
    self.attackDuration = (self.actions && self.actions.bun && self.actions.bun.duration) || 700;

    const dir = self.facing === 1 ? 1 : -1;

    // valores por defecto del origen relativos al fighter (puedes cambiar en opts)
    const defaultOffsetX = dir === 1 ? (self.w + 6) : -6;
    const defaultOffsetY = Math.round(self.h / 2 - 6);

    // opts: alcance maximo antes de dar vuelta, velocidad, etc.
    const opts = {
      speed: 8,
      maxRange: 380,
      persistent: false,
      // dimensiones lógicas deseadas para dibujar el bun pequeño (ajustadas a 7x3)
      w: 18, h: 6,
      frameDelay: 6,
      // escala visual del sprite (separada de w/h lógicas). Dejar 1 para que respete w/h.
      spriteScale: 1.0,
      // parámetros de la cuerda (opcional)
      stringW: 6,
      stringH: 2,
      stringFrameDelay: 6,
      // ORIGEN configurable (relativo a self.x / self.y)
      offsetX: defaultOffsetX +(-14*self.facing), // por defecto, delante del fighter
      offsetY: defaultOffsetY+6
    };

    // calcular origen usando opts (permite sobrescribir offsetX/offsetY desde fuera)
    const px = Math.round(self.x + (opts.offsetX || 0));
    const py = Math.round(self.y + (opts.offsetY || 0));

    // pasar frames del proyectil y string via resources
    const bunFrames = (self.bunProjFramesByLayer && self.bunProjFramesByLayer.length) ? self.bunProjFramesByLayer : null;
    const stringFrames = (self.bunStringFramesByLayer && self.bunStringFramesByLayer.length) ? self.bunStringFramesByLayer : null;
    const p = new Projectile(px, py, dir, 5, self.id, { string: stringFrames }, opts, bunFrames);
    // guardar referencia del owner para dibujo de cuerda y cálculos
    p._ownerRef = self;
    projectiles.push(p);
    return;
  }
}
