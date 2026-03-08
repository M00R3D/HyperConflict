// core/particleSystem.js
// Sistema simple de partículas tipo "pixeles" con registro de tipos y API de emisión.
const _types = Object.create(null);
const _patterns = Object.create(null);
const _particles = [];

export function registerParticleType(name, def = {}) {
  if (!name) return;
  const copy = Object.assign({
    count: 1,
    size: 1,
    spread: 0,
    // additional spacing (px) between pattern grid cells when using `pattern`
    patternSpacing: 0,
    speed: 0,
    life: 800, // ms
    gravity: 0.00,
    color: [255, 100, 120],
    alpha: 1,
    shape: 'pixel',
    pattern: null // can be Array or pattern name string
  }, def);
  // resolve pattern by name
  if (typeof copy.pattern === 'string' && _patterns[copy.pattern]) copy.pattern = _patterns[copy.pattern];
  _types[name] = copy;
}

export function registerParticlePattern(name, patternArray) {
  if (!name || !Array.isArray(patternArray)) return;
  _patterns[name] = patternArray.map(r => String(r));
}

export function spawnParticle(typeName, x, y, opts = {}) {
  const def = _types[typeName];
  if (!def) return;
  const cx = (typeof x === 'number') ? x : 0;
  const cy = (typeof y === 'number') ? y : 0;

  // If pattern present, spawn per-pixel particles arranged by pattern
  if (Array.isArray(def.pattern) && def.pattern.length > 0) {
    const pattern = def.pattern;
    const rows = pattern.length;
    const cols = Math.max(...pattern.map(r => r.length));
    const size = (typeof opts.size === 'number') ? opts.size : def.size;
    const patternSpacing = (typeof opts.patternSpacing === 'number') ? opts.patternSpacing : (typeof def.patternSpacing === 'number' ? def.patternSpacing : 0);
    // allow negative spacing so pixels can be tighter than `size`
    // clamp to a small positive minimum to avoid zero/negative grid step
    const step = Math.max(0.5, size + patternSpacing);
    const lifeBase = (typeof opts.life === 'number') ? opts.life : def.life;
    const color = Array.isArray(opts.color) ? opts.color.slice(0,3) : def.color.slice(0,3);
    const spread = (typeof opts.spread === 'number') ? opts.spread : def.spread;
    const speed = (typeof opts.speed === 'number') ? opts.speed : def.speed;
    const count = (typeof opts.count === 'number') ? Math.max(1, Math.floor(opts.count)) : (typeof def.count === 'number' ? Math.max(1, Math.floor(def.count)) : 1);
    // center pattern (use logical pixel `size` for layout)
    const offsetX = -Math.floor(cols / 2) * step;
    const offsetY = -Math.floor(rows / 2) * step;
    // allow repeating the whole pattern `count` times (useful to intensify effect)
    // allow per-character overrides via patternMeta (char -> { w,h,color,alpha })
    const patternMeta = (opts.patternMeta && typeof opts.patternMeta === 'object') ? opts.patternMeta : (def.patternMeta && typeof def.patternMeta === 'object' ? def.patternMeta : null);
    for (let rep = 0; rep < count; rep++) {
      // repOffset gives coarse displacement per repetition so duplicates don't perfectly overlap
      const repOffsetX = (Math.random() - 0.5) * spread * 0.8;
      const repOffsetY = (Math.random() - 0.5) * spread * 0.6;
      for (let r = 0; r < rows; r++) {
      const row = pattern[r] || '';
      for (let c = 0; c < cols; c++) {
        const ch = row[c] || ' ';
        if (ch === ' ' || ch === '.' ) continue;
        // particle per pixel
        // allow per-pixel size variation for a more natural look
        const baseSize = size * (0.7 + Math.random() * 0.6);
        // allow per-character overrides for width/height
        const chMeta = patternMeta && patternMeta[ch] ? patternMeta[ch] : null;
        const pixelW = (chMeta && typeof chMeta.w === 'number') ? chMeta.w : baseSize;
        const pixelH = (chMeta && typeof chMeta.h === 'number') ? chMeta.h : baseSize;
        // position each pixel according to grid, plus jitter based on spread
        const px = cx + offsetX + c * step + repOffsetX + (Math.random() - 0.5) * spread;
        const py = cy + offsetY + r * step + repOffsetY + (Math.random() - 0.5) * spread;
        const ang = (Math.random() * Math.PI) - (Math.PI / 2);
        // initial speed influenced by configured speed and spread; if speed==0, keep particles static initially
        let sp = (Math.random() * 0.6 + 0.8) * (speed || 1) * (1 + (spread / 12));
        if (speed === 0) sp = 0;
        const vx = Math.cos(ang) * sp * (1 + (Math.random() - 0.5) * 0.4);
        const vy = Math.sin(ang) * sp * (1 + (Math.random() - 0.5) * 0.4) - Math.abs((speed || 1) * 0.2);
        const life = lifeBase * (0.9 + Math.random() * 0.3);
        // allow per-character color/alpha override
        const pixelColor = (chMeta && Array.isArray(chMeta.color)) ? chMeta.color.slice(0,3) : color;
        const pixelAlpha = (typeof (chMeta && chMeta.alpha) === 'number') ? chMeta.alpha : ((typeof opts.alpha === 'number') ? opts.alpha : def.alpha);
        _particles.push({ x: px, y: py, vx, vy, ax: 0, ay: 0, gravity: (typeof opts.gravity === 'number') ? opts.gravity : def.gravity, w: pixelW, h: pixelH, size: baseSize, life, maxLife: life, color: pixelColor, alpha: pixelAlpha, shape: 'pixel', _screen: !!opts.screenSpace });
      }
    }
    }
    return;
  }

  const count = (typeof opts.count === 'number') ? opts.count : def.count;
  for (let i = 0; i < count; i++) {
    const ang = (Math.random() * Math.PI) - (Math.PI / 2); // upward bias
    const sp = (Math.random() * 0.6 + 0.6) * def.speed;
    const vx = Math.cos(ang) * sp * (1 + (Math.random() - 0.5) * 0.6) * (def.spread / 12);
    const vy = Math.sin(ang) * sp * (1 + (Math.random() - 0.5) * 0.4) * (def.spread / 12);
    const size = (typeof opts.size === 'number') ? opts.size : def.size * (0.7 + Math.random() * 0.6);
    const life = (typeof opts.life === 'number') ? opts.life : def.life * (0.8 + Math.random() * 0.6);
    const col = Array.isArray(opts.color) ? opts.color.slice(0,3) : (Array.isArray(def.color) ? def.color.slice(0,3) : [255,255,255]);
    _particles.push({
      x: cx,
      y: cy,
      vx: vx,
      vy: vy,
      ax: 0,
      ay: 0,
      gravity: (typeof opts.gravity === 'number') ? opts.gravity : def.gravity,
      size: size,
      life: life,
      maxLife: life,
      color: col,
      alpha: (typeof opts.alpha === 'number') ? opts.alpha : def.alpha,
      shape: opts.shape || def.shape,
      _screen: !!opts.screenSpace
    });
  }
}

export function updateParticles() {
  const dt = (typeof deltaTime === 'number') ? deltaTime : 16.67; // ms
  for (let i = _particles.length - 1; i >= 0; i--) {
    const p = _particles[i];
    // simple physics
    p.vy += p.gravity * dt;
    p.x += p.vx * (dt / 16.67);
    p.y += p.vy * (dt / 16.67);
    p.life -= dt;
    if (p.life <= 0) _particles.splice(i, 1);
  }
}

export function drawParticles(screenSpace = false) {
  if (typeof push !== 'function') return; // not in p5
  push();
  noStroke();
  for (let i = 0; i < _particles.length; i++) {
    const p = _particles[i];
    if (!!p._screen !== !!screenSpace) continue;
    const t = Math.max(0, Math.min(1, p.life / p.maxLife));
    const alpha = Math.round((p.alpha || 1) * 255 * t);
    const c = p.color || [255,255,255];
    fill(c[0], c[1], c[2], alpha);
    if (p.shape === 'pixel') {
      if (typeof p.w === 'number' && typeof p.h === 'number') {
        rect(Math.round(p.x - p.w/2), Math.round(p.y - p.h/2), Math.max(1, Math.round(p.w)), Math.max(1, Math.round(p.h)));
      } else {
        rect(Math.round(p.x - p.size/2), Math.round(p.y - p.size/2), Math.max(1, Math.round(p.size)), Math.max(1, Math.round(p.size)));
      }
    } else if (p.shape === 'small') {
      rect(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(p.size)), Math.max(1, Math.round(p.size)));
    } else {
      ellipse(p.x, p.y, p.size, p.size);
    }
  }
  pop();
}

// Register a default 'heart' particle type
registerParticleType('heart', {
  // Use an ASCII pattern to form a heart shape; pattern characters other than space are pixels
  spread: 2,
  patternSpacing: -8,
  speed: 0.006,
  life: 400,
  gravity: -0.0038,
  color: [220,40,80],
  alpha: 1,
  shape: 'pixel',
  patternMeta: { 'X': { w:2, h:2, color:[255,0,0] } },
  pattern: [
    "  XX   XX  ",
    " XXXX XXXX ",
    " XXXXXXXXX ",
    "  XXXXXXX  ",
    "   XXXXX   ",
    "    XXX    ",
    "     X     "
  ]
});

export function clearParticles() { _particles.length = 0; }

export default {
  registerParticleType, spawnParticle, updateParticles, drawParticles, clearParticles
};

// Expose minimal debug API to window for quick testing
if (typeof window !== 'undefined') {
  window.ParticleSystem = window.ParticleSystem || {};
  window.ParticleSystem.spawnParticle = spawnParticle;
  window.ParticleSystem.registerParticleType = registerParticleType;
  window.ParticleSystem.registerParticlePattern = registerParticlePattern;
  window.ParticleSystem.clearParticles = clearParticles;
  window.spawnParticleForDebug = function(type, x, y, opts) { try { spawnParticle(type, x, y, opts); } catch (e) {} };
}

// Debug hotkey: F8 spawns a big heart at mouse or center; Shift+F8 spawns at both players
if (typeof window !== 'undefined') {
  if (!window._particleSystemHotkeyAttached) {
    window._particleSystemHotkeyAttached = true;
    window.addEventListener('keydown', function _ps_key(e) {
      try {
        if (e.key === 'F8') {
          // prefer mouse pos if available
          const mx = (typeof window.mouseX === 'number') ? window.mouseX : (typeof mouseX === 'number' ? mouseX : Math.round((window.innerWidth || 800)/2));
          const my = (typeof window.mouseY === 'number') ? window.mouseY : (typeof mouseY === 'number' ? mouseY : Math.round((window.innerHeight || 400)/2));
          if (e.shiftKey) {
            try { if (window.player1) spawnParticle('heart', Math.round(window.player1.x + (window.player1.w||0)/2), Math.round(window.player1.y + (window.player1.h||0)/2), { size: 10, screenSpace: false }); } catch (ee) {}
            try { if (window.player2) spawnParticle('heart', Math.round(window.player2.x + (window.player2.w||0)/2), Math.round(window.player2.y + (window.player2.h||0)/2), { size: 10, screenSpace: false }); } catch (ee) {}
          } else {
            spawnParticle('heart', mx, my, { size: 14, screenSpace: true });
          }
        }
      } catch (err) {}
    });
  }
}
