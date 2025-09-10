// entities/fighter/specials.js
import { Projectile } from '../../entities/projectile.js';
import { projectiles } from '../../core/main.js';
import * as Hitbox from './hitbox.js';
import * as Buffer from './buffer.js';

export const specialMoves = {
  hadouken: ['↓','↘','→','P'],
  shoryuken: ['→','↓','↘','P'],
  // supersalto: agacharse y saltar rápido (down, up)
  supersalto: ['↓','↑'],
  // ty_tats declarado como BACKWARD (↓,↙,←,K) — lo dejamos con input de "hacia atrás"
  ty_tats: ['↓','↙','←','K']
};

export function checkSpecialMoves(self) {
  const bufSymbols = (self.inputBuffer || []).map(i => i.symbol || '');
  console.log('checkSpecialMoves [' + (self.id||'?') + ']: facing=', self.facing, 'x=', Math.round(self.x), 'buffer=', bufSymbols);

  // Para hadouken, verificar la secuencia exacta según facing
  if (self.facing === 1) {
    // Mirando a la derecha: requerir secuencia exacta ↓,↘,→,P
    const hadoukenSeq = ['↓','↘','→','P'];
    
    // Verificación estricta: debe terminar exactamente con ↓,↘,→,P
    let hadoukenMatch = false;
    if (bufSymbols.length >= hadoukenSeq.length) {
      const endSlice = bufSymbols.slice(-hadoukenSeq.length);
      hadoukenMatch = endSlice.every((sym, i) => sym === hadoukenSeq[i]);
      
      if (hadoukenMatch) {
        doSpecial(self, 'hadouken');
        Buffer.bufferConsumeLast(self, hadoukenSeq.length);
        return;
      }
    }
  } else if (self.facing === -1) {
    // Mirando a la izquierda: requerir secuencia exacta ↓,↙,←,P
    const hadoukenSeq = ['↓','↙','←','P']; 
    
    // Verificación estricta: debe terminar exactamente con ↓,↙,←,P
    let hadoukenMatch = false;
    if (bufSymbols.length >= hadoukenSeq.length) {
      const endSlice = bufSymbols.slice(-hadoukenSeq.length);
      hadoukenMatch = endSlice.every((sym, i) => sym === hadoukenSeq[i]);
      
      if (hadoukenMatch) {
        doSpecial(self, 'hadouken');
        Buffer.bufferConsumeLast(self, hadoukenSeq.length);
        return;
      }
    }
  }

  // Procesar otros movimientos especiales (incluyendo ty_tats)
  const directionalSet = new Set(['←','→','↑','↓','↖','↗','↘','↙']);
  const isForwardSymbol = (sym, facing) => {
    if (!sym) return false;
    if (facing === 1) return sym === '→' || sym === '↘' || sym === '↗';
    return sym === '←' || sym === '↙' || sym === '↖';
  };
  
  const isBackwardSymbol = (sym, facing) => {
    if (!sym) return false;
    if (facing === 1) return sym === '←' || sym === '↙' || sym === '↖';
    return sym === '→' || sym === '↘' || sym === '↗';
  };

  // último símbolo direccional en el buffer (si existe)
  let lastDirInBuffer = null;
  for (let i = bufSymbols.length - 1; i >= 0; i--) {
    if (directionalSet.has(bufSymbols[i])) { lastDirInBuffer = bufSymbols[i]; break; }
  }

  // Procesar todos los movimientos excepto hadouken (ya procesado arriba)
  for (const moveName in specialMoves) {
    if (moveName === 'hadouken') continue; // Saltamos hadouken porque ya lo procesamos
    
    const baseSeq = [...specialMoves[moveName]];

    if (moveName === 'ty_tats') {
      // ty_tats requiere que la última dirección sea hacia atrás
      if (lastDirInBuffer && !isBackwardSymbol(lastDirInBuffer, self.facing)) {
        continue; // No permitir ty_tats si no termina apuntando hacia atrás
      }
    }

    // crear secuencia efectiva según facing (espejar si mira a la izquierda)
    let seq = baseSeq.map(s => s);
    if (self.facing === -1) seq = seq.map(s => Hitbox.mirrorSymbol(s));

    // intentar match flexible o estricto
    let matched = false;
    if (Buffer.flexibleEndsWith(self, bufSymbols, seq)) matched = true;
    else if (Buffer.bufferEndsWith(self, seq)) matched = true;

    if (!matched) continue;

    // Verificación adicional para ty_tats (ya verificamos hadouken arriba)
    if (moveName === 'ty_tats') {
      // Verificar que el último input direccional de la secuencia sea backward
      const dirSymbolsInSeq = seq.filter(s => directionalSet.has(s));
      const lastDirInSeq = dirSymbolsInSeq.length ? dirSymbolsInSeq[dirSymbolsInSeq.length - 1] : null;
      if (!isBackwardSymbol(lastDirInSeq, self.facing)) {
        continue; // No permitir ty_tats si la secuencia no termina en backward
      }
    }

    // ejecutar y consumir buffer
    doSpecial(self, moveName);
    Buffer.bufferConsumeLast(self, seq.length);
    return;
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
