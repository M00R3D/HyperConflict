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
    // allow disabling per-pixel size jitter (true = randomize base pixel size)
    sizeJitter: true,
    // optional light/glow per-particle
    lightIntensity: 1,
    lightColor: [255, 200, 160],
    // optional radial gradient for light: array of stops { offset:0..1, color:[r,g,b], alpha:0..1 }
    lightGradient: [{offset: 1, color: [55,100,160], alpha: 0.8}],
    // rotation controls (0 = random side, -1 left, 1 right)
    rotationSide: 0,
    rotationSpeed: 10,
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
  // only collect debug log copies when debug mode is explicitly enabled
  const _debugActive = (typeof window !== 'undefined' && window.ParticleSystem && window.ParticleSystem.debug);
  const _createdForLog = _debugActive ? [] : null;

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
    const sizeJitter = (typeof opts.sizeJitter === 'boolean') ? opts.sizeJitter : (typeof def.sizeJitter === 'boolean' ? def.sizeJitter : true);
    const rotationSpeed = (typeof opts.rotationSpeed === 'number') ? opts.rotationSpeed : (typeof def.rotationSpeed === 'number' ? def.rotationSpeed : 0);
    const rotationSide = (typeof opts.rotationSide === 'number') ? opts.rotationSide : (typeof def.rotationSide === 'number' ? def.rotationSide : 0);
    const lightIntensity = (typeof opts.lightIntensity === 'number') ? opts.lightIntensity : (typeof def.lightIntensity === 'number' ? def.lightIntensity : 0);
    const lightColor = Array.isArray(opts.lightColor) ? opts.lightColor.slice(0,3) : (Array.isArray(def.lightColor) ? def.lightColor.slice(0,3) : null);
    const lightGradientRaw = (opts.lightGradient && Array.isArray(opts.lightGradient)) ? opts.lightGradient : (def.lightGradient && Array.isArray(def.lightGradient) ? def.lightGradient : null);
    let lightGradient = null;
    if (Array.isArray(lightGradientRaw)) {
      lightGradient = lightGradientRaw.map(st => {
        if (!st || typeof st !== 'object') return null;
        const offset = (typeof st.offset === 'number') ? st.offset : 0;
        const color = Array.isArray(st.color) ? st.color.slice(0,3) : (Array.isArray(st.rgb) ? st.rgb.slice(0,3) : lightColor || [255,255,255]);
        const alpha = (typeof st.alpha === 'number') ? st.alpha : (typeof st.a === 'number' ? st.a : 1);
        return { offset: Math.max(0, Math.min(1, offset)), color: color, alpha: Math.max(0, Math.min(1, alpha)) };
      }).filter(Boolean);
      if (lightGradient.length === 0) lightGradient = null;
    }
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
        // per-pixel size variation (can be disabled via `sizeJitter`)
        const baseSize = sizeJitter ? size * (0.7 + Math.random() * 0.6) : size;
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
        // rotation per-pixel
        const rot = Math.random() * Math.PI * 2;
        const rotDir = (rotationSide === 0) ? (Math.random() < 0.5 ? -1 : 1) : (rotationSide < 0 ? -1 : 1);
        const rotVel = rotationSpeed ? ((Math.random() * 0.6 + 0.4) * rotationSpeed * rotDir) : 0;
        // allow per-character color/alpha override
        const pixelColor = (chMeta && Array.isArray(chMeta.color)) ? chMeta.color.slice(0,3) : color;
        const pixelAlpha = (typeof (chMeta && chMeta.alpha) === 'number') ? chMeta.alpha : ((typeof opts.alpha === 'number') ? opts.alpha : def.alpha);
        const pObj = { x: px, y: py, vx, vy, ax: 0, ay: 0, gravity: (typeof opts.gravity === 'number') ? opts.gravity : def.gravity, w: pixelW, h: pixelH, size: baseSize, life, maxLife: life, color: pixelColor, alpha: pixelAlpha, shape: 'pixel', _screen: !!opts.screenSpace, rot, rotVel, lightIntensity, lightColor, lightGradient };
        _particles.push(pObj);
        if (_createdForLog) { try { _createdForLog.push(Object.assign({}, pObj)); } catch (e) {} }
      }
    }
    }
    if (_createdForLog && _createdForLog.length > 0) {
      try {
        const toLog = (_createdForLog.length > 100) ? _createdForLog.slice(0, 100) : _createdForLog;
        console.log('[PARTICLE_SPAWN]', typeName, toLog, _createdForLog.length, opts);
      } catch (e) {}
    }
    return;
  }

  const count = (typeof opts.count === 'number') ? opts.count : def.count;
  for (let i = 0; i < count; i++) {
    const ang = (Math.random() * Math.PI) - (Math.PI / 2); // upward bias
    const sp = (Math.random() * 0.6 + 0.6) * def.speed;
    const vx = Math.cos(ang) * sp * (1 + (Math.random() - 0.5) * 0.6) * (def.spread / 12);
    const vy = Math.sin(ang) * sp * (1 + (Math.random() - 0.5) * 0.4) * (def.spread / 12);
    const sizeVal = (typeof opts.size === 'number') ? opts.size : def.size;
    const sizeJitter = (typeof opts.sizeJitter === 'boolean') ? opts.sizeJitter : (typeof def.sizeJitter === 'boolean' ? def.sizeJitter : true);
    const particleSize = sizeJitter ? sizeVal * (0.7 + Math.random() * 0.6) : sizeVal;
    const life = (typeof opts.life === 'number') ? opts.life : def.life * (0.8 + Math.random() * 0.6);
    const col = Array.isArray(opts.color) ? opts.color.slice(0,3) : (Array.isArray(def.color) ? def.color.slice(0,3) : [255,255,255]);
    const rotationSpeed = (typeof opts.rotationSpeed === 'number') ? opts.rotationSpeed : (typeof def.rotationSpeed === 'number' ? def.rotationSpeed : 0);
    const rotationSide = (typeof opts.rotationSide === 'number') ? opts.rotationSide : (typeof def.rotationSide === 'number' ? def.rotationSide : 0);
    const rot = Math.random() * Math.PI * 2;
    const rotDir = (rotationSide === 0) ? (Math.random() < 0.5 ? -1 : 1) : (rotationSide < 0 ? -1 : 1);
    const rotVel = rotationSpeed ? ((Math.random() * 0.6 + 0.4) * rotationSpeed * rotDir) : 0;
    const lightIntensity = (typeof opts.lightIntensity === 'number') ? opts.lightIntensity : (typeof def.lightIntensity === 'number' ? def.lightIntensity : 0);
    const lightColor = Array.isArray(opts.lightColor) ? opts.lightColor.slice(0,3) : (Array.isArray(def.lightColor) ? def.lightColor.slice(0,3) : null);
    const lightGradientRaw = (opts.lightGradient && Array.isArray(opts.lightGradient)) ? opts.lightGradient : (def.lightGradient && Array.isArray(def.lightGradient) ? def.lightGradient : null);
    let lightGradient = null;
    if (Array.isArray(lightGradientRaw)) {
      lightGradient = lightGradientRaw.map(st => {
        if (!st || typeof st !== 'object') return null;
        const offset = (typeof st.offset === 'number') ? st.offset : 0;
        const color = Array.isArray(st.color) ? st.color.slice(0,3) : (Array.isArray(st.rgb) ? st.rgb.slice(0,3) : lightColor || [255,255,255]);
        const alpha = (typeof st.alpha === 'number') ? st.alpha : (typeof st.a === 'number' ? st.a : 1);
        return { offset: Math.max(0, Math.min(1, offset)), color: color, alpha: Math.max(0, Math.min(1, alpha)) };
      }).filter(Boolean);
      if (lightGradient.length === 0) lightGradient = null;
    }
    const pObj = {
      x: cx,
      y: cy,
      vx: vx,
      vy: vy,
      ax: 0,
      ay: 0,
      gravity: (typeof opts.gravity === 'number') ? opts.gravity : def.gravity,
      size: particleSize,
      life: life,
      maxLife: life,
      color: col,
      alpha: (typeof opts.alpha === 'number') ? opts.alpha : def.alpha,
      shape: opts.shape || def.shape,
      _screen: !!opts.screenSpace,
      rot, rotVel, lightIntensity, lightColor, lightGradient
    };
    _particles.push(pObj);
    if (_createdForLog) { try { _createdForLog.push(Object.assign({}, pObj)); } catch (e) {} }
  }
  if (_createdForLog && _createdForLog.length > 0) {
    try {
      const toLog2 = (_createdForLog.length > 100) ? _createdForLog.slice(0, 100) : _createdForLog;
      console.log('[PARTICLE_SPAWN]', typeName, toLog2, _createdForLog.length, opts);
    } catch (e) {}
  }
}

export function updateParticles() {
  const dt = (typeof deltaTime === 'number') ? deltaTime : 16.67; // ms
  const dtScale = dt / 16.67;
  let writeIdx = 0;
  for (let i = 0; i < _particles.length; i++) {
    const p = _particles[i];
    p.vy += p.gravity * dt;
    p.x += p.vx * dtScale;
    p.y += p.vy * dtScale;
    if (typeof p.rot === 'number' && typeof p.rotVel === 'number') {
      p.rot += p.rotVel * dtScale;
    }
    p.life -= dt;
    if (p.life > 0) {
      _particles[writeIdx++] = p;
    }
  }
  _particles.length = writeIdx;
  // Safety prune: if particles grow unbounded (bug), trim oldest to avoid OOM/frame collapse
  const MAX_PARTICLES_SOFT = 1200;
  const TRIM_TO = 800;
  if (_particles.length > MAX_PARTICLES_SOFT) {
    _particles.splice(0, _particles.length - TRIM_TO);
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
    // optional light/glow drawn behind pixel
    if (p.lightIntensity > 0) {
      const lw = Math.max(2, (p.w || p.size) * (1 + p.lightIntensity * 1.6));
      const radius = lw / 2;
      // if a gradient is provided and canvas context supports gradients, draw radial gradient
      if (p.lightGradient && typeof drawingContext !== 'undefined' && typeof drawingContext.createRadialGradient === 'function') {
        try {
          const ctx2 = drawingContext;
          const gx = Math.round(p.x);
          const gy = Math.round(p.y);
          const grad = ctx2.createRadialGradient(gx, gy, 0, gx, gy, radius);
          for (let s = 0; s < p.lightGradient.length; s++) {
            const stop = p.lightGradient[s];
            const stopAlpha = (stop.alpha || 1) * (p.alpha || 1) * t;
            const colorStr = `rgba(${stop.color[0]},${stop.color[1]},${stop.color[2]},${stopAlpha})`;
            grad.addColorStop(stop.offset, colorStr);
          }
          ctx2.save();
          ctx2.fillStyle = grad;
          ctx2.beginPath();
          ctx2.arc(gx, gy, radius, 0, Math.PI * 2);
          ctx2.fill();
          ctx2.restore();
        } catch (e) {
          // fallback to simple lightColor ellipse
          if (Array.isArray(p.lightColor)) {
            const lightAlpha = Math.round((p.alpha || 1) * 255 * t * Math.min(1, p.lightIntensity));
            noStroke();
            fill(p.lightColor[0], p.lightColor[1], p.lightColor[2], lightAlpha);
            ellipse(Math.round(p.x), Math.round(p.y), lw, lw);
          }
        }
      } else if (Array.isArray(p.lightColor)) {
        const lightAlpha = Math.round((p.alpha || 1) * 255 * t * Math.min(1, p.lightIntensity));
        noStroke();
        fill(p.lightColor[0], p.lightColor[1], p.lightColor[2], lightAlpha);
        ellipse(Math.round(p.x), Math.round(p.y), lw, lw);
      }
    }
    fill(c[0], c[1], c[2], alpha);
    if (p.shape === 'pixel') {
      const drawW = (typeof p.w === 'number') ? Math.max(1, Math.round(p.w)) : Math.max(1, Math.round(p.size));
      const drawH = (typeof p.h === 'number') ? Math.max(1, Math.round(p.h)) : Math.max(1, Math.round(p.size));
      if (typeof p.rot === 'number' && p.rotVel) {
        push();
        translate(Math.round(p.x), Math.round(p.y));
        rotate(p.rot);
        rect(Math.round(-drawW/2), Math.round(-drawH/2), drawW, drawH);
        pop();
      } else {
        rect(Math.round(p.x - drawW/2), Math.round(p.y - drawH/2), drawW, drawH);
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
  patternSpacing: -9,
  speed: 0.006,
  life: 400,
  gravity: -0.0038,
  color: [220,40,80],
  alpha: 1,
  shape: 'pixel',
    // allow disabling per-pixel size jitter (true = randomize base pixel size)
    sizeJitter: true,
    // optional light/glow per-particle
    lightIntensity: 0.41,
    // lightColor: [255, 200, 160],
    // optional radial gradient for light: array of stops { offset:0..1, color:[r,g,b], alpha:0..1 }
    // lightGradient: [{offset: 0, color: [55,100,160], alpha: 0.2}],
    // rotation controls (0 = random side, -1 left, 1 right)
    rotationSide: 0,
    rotationSpeed: 10,
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

// Debug helpers
if (typeof window !== 'undefined') {
  window.ParticleSystem = window.ParticleSystem || {};
  window.ParticleSystem.getCounts = function() { try { return { particles: _particles.length, projectiles: (Array.isArray(window.projectiles) ? window.projectiles.length : 0) }; } catch (e) { return { particles: _particles.length }; } };
  // debug flag: set to true to enable detailed spawn logging (disabled by default)
  window.ParticleSystem.debug = !!window.ParticleSystem.debug;
}

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
import cleanup from './cleanup.js';
if (typeof window !== 'undefined') {
  if (!window._particleSystemHotkeyAttached) {
    window._particleSystemHotkeyAttached = true;
    const _ps_key = function (e) {
      try {
        if (e.key === 'F8') {
          let mx = (typeof window.mouseX === 'number') ? window.mouseX : (typeof mouseX === 'number' ? mouseX : Math.round((window.innerWidth || 800)/2));
          let my = (typeof window.mouseY === 'number') ? window.mouseY : (typeof mouseY === 'number' ? mouseY : Math.round((window.innerHeight || 400)/2));
          const cam = (typeof window !== 'undefined' && window.state && window.state.cam) ? window.state.cam : (typeof window !== 'undefined' && window.cam ? window.cam : { x: 0, y: 0, zoom: 1 });
          try {
            const offsetY = (typeof map === 'function') ? map(cam.zoom, 0.6, 1.5, 80, 20) : 40;
            const sx = mx - (width / 2);
            const sy = my - (height / 2 + offsetY);
            const wz = (cam && typeof cam.zoom === 'number' && cam.zoom !== 0) ? cam.zoom : 1;
            const worldMx = sx / wz + (cam.x || 0);
            const worldMy = sy / wz + (cam.y || 0);
            if (typeof worldMx === 'number' && typeof worldMy === 'number') {
              mx = Math.round(worldMx);
              my = Math.round(worldMy);
            }
          } catch (ee) { }
          if (e.shiftKey) {
            try { if (window.player1) spawnParticle('heart', Math.round(window.player1.x + (window.player1.w||0)/2), Math.round(window.player1.y + (window.player1.h||0)/2), { size: 8, screenSpace: false }); } catch (ee) {}
            try { if (window.player2) spawnParticle('heart', Math.round(window.player2.x + (window.player2.w||0)/2), Math.round(window.player2.y + (window.player2.h||0)/2), { size: 8, screenSpace: false }); } catch (ee) {}
          } else {
            spawnParticle('heart', mx, my, { size: 8, screenSpace: false });
          }
        }
      } catch (err) {}
    };

    // register via cleanup when available so it can be torn down on match reset
    try {
      if (cleanup && typeof cleanup.registerListener === 'function') {
        cleanup.registerListener(window, 'keydown', _ps_key, false);
      } else {
        window.addEventListener('keydown', _ps_key);
      }
      window._particleSystemHotkeyHandler = _ps_key;
    } catch (e) { try { window.addEventListener('keydown', _ps_key); window._particleSystemHotkeyHandler = _ps_key; } catch (ee) {} }

    // expose detach helper
    window.ParticleSystem = window.ParticleSystem || {};
    window.ParticleSystem.detachHotkey = function() {
      try {
        if (window._particleSystemHotkeyHandler) {
          try { window.removeEventListener('keydown', window._particleSystemHotkeyHandler); } catch (e) {}
          window._particleSystemHotkeyHandler = null;
        }
      } catch (e) {}
      window._particleSystemHotkeyAttached = false;
    };
  }
}
