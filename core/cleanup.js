// core/cleanup.js
// Registry for disposable resources created during a match/session so we can
// defensively clean them up when a match ends or players are swapped.

const _listeners = [];
const _intervals = [];
const _timeouts = [];
const _rafs = [];
const _disposables = [];

export function registerListener(target, type, handler, options) {
  try {
    if (!target || !type || !handler) return;
    target.addEventListener(type, handler, options || false);
    _listeners.push({ target, type, handler, options });
  } catch (e) {}
}

export function registerInterval(id) { if (typeof id !== 'undefined' && id !== null) _intervals.push(id); }
export function registerTimeout(id) { if (typeof id !== 'undefined' && id !== null) _timeouts.push(id); }
export function registerRAF(id) { if (typeof id !== 'undefined' && id !== null) _rafs.push(id); }
export function registerDisposable(fn) { if (typeof fn === 'function') _disposables.push(fn); }

export function clearAllMatchResources() {
  try {
    // remove registered listeners
    for (let i = 0; i < _listeners.length; i++) {
      const it = _listeners[i];
      try { it.target.removeEventListener(it.type, it.handler, it.options || false); } catch (e) {}
    }
    _listeners.length = 0;

    // clear intervals
    for (let id of _intervals) try { clearInterval(id); } catch (e) {}
    _intervals.length = 0;

    // clear timeouts
    for (let id of _timeouts) try { clearTimeout(id); } catch (e) {}
    _timeouts.length = 0;

    // cancel rAFs
    for (let id of _rafs) try { cancelAnimationFrame(id); } catch (e) {}
    _rafs.length = 0;

    // call registered disposables
    for (let fn of _disposables) {
      try { fn(); } catch (e) {}
    }
    _disposables.length = 0;

    // best-effort global clears (non-destructive checks)
    try { if (typeof window !== 'undefined') {
      // NOTE: do NOT clear piskel cache here — re-decoding 100+ sprites on every
      // rematch / character-select causes heavy CPU + memory churn.
      if (window.ParticleSystem && typeof window.ParticleSystem.clearParticles === 'function') try { window.ParticleSystem.clearParticles(); } catch (e) {}
      if (Array.isArray(window.projectiles)) try { window.projectiles.length = 0; } catch (e) {}
      if (window.stopMemoryRefresh && typeof window.stopMemoryRefresh === 'function') try { window.stopMemoryRefresh(); } catch (e) {}
      // clear input frame flags if provided
      if (window.clearInputState && typeof window.clearInputState === 'function') try { window.clearInputState(); } catch (e) {}
    }} catch (e) {}
  } catch (e) {}
}

export default {
  registerListener, registerInterval, registerTimeout, registerRAF, registerDisposable, clearAllMatchResources
};
