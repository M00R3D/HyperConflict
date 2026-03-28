// core/memoryManager.js
// Periodic memory refresh helpers: clear caches and trim arrays to reduce
// sustained memory growth in long-running sessions.

const DEFAULT_INTERVAL_MS = 25000; // 25s
const SOFT_MAX_PROJECTILES = 800;
const SOFT_TRIM_PROJECTILES_TO = 600;

let _intervalId = null;
import cleanup from './cleanup.js';

function _safeCall(fn) {
  try { if (typeof fn === 'function') fn(); } catch (e) { try { console.warn('[MemoryManager] cleanup error', e); } catch (ee) {} }
}

function doCleanup() {
  try {
    if (typeof window !== 'undefined' && window.DEBUG_MEMORY) console.warn('[MemoryManager] running cleanup');

    // 1) piskel/image cache: do NOT clear — re-decoding base64 sprites is expensive
    //    The LRU cache in loader.js handles eviction when needed.

    // 2) trim particle system only when count is very high (avoid clearing all particles)
    try {
      if (typeof window !== 'undefined' && window.ParticleSystem && typeof window.ParticleSystem.getCounts === 'function') {
        const pc = window.ParticleSystem.getCounts();
        if (pc && pc.particles > 2000) {
          window.ParticleSystem.clearParticles();
        }
      }
    } catch (e) {}

    // 3) trim global projectiles array to soft target
    try {
      if (typeof window !== 'undefined' && Array.isArray(window.projectiles)) {
        const len = window.projectiles.length;
        if (len > SOFT_MAX_PROJECTILES) {
          window.projectiles.splice(SOFT_TRIM_PROJECTILES_TO, len - SOFT_TRIM_PROJECTILES_TO);
          if (window.DEBUG_MEMORY) console.warn('[MemoryManager] trimmed projectiles', len, '->', window.projectiles.length);
        }
      }
    } catch (e) {}

    // 4) attempt to drop other global caches if present
    try { if (typeof window !== 'undefined' && window._slotCache && typeof window._slotCache.clear === 'function') window._slotCache.clear(); } catch (e) {}

  } catch (e) { try { console.warn('[MemoryManager] unexpected cleanup error', e); } catch (ee) {} }
}

export function startMemoryRefresh(intervalMs = DEFAULT_INTERVAL_MS) {
  try {
    stopMemoryRefresh();
    doCleanup(); // run once immediately
    _intervalId = setInterval(doCleanup, Number(intervalMs) || DEFAULT_INTERVAL_MS);
    try { if (cleanup && typeof cleanup.registerInterval === 'function') cleanup.registerInterval(_intervalId); } catch (e) {}
    return true;
  } catch (e) { return false; }
}

export function stopMemoryRefresh() {
  try { if (_intervalId) { clearInterval(_intervalId); _intervalId = null; } return true; } catch (e) { return false; }
}

export default { startMemoryRefresh, stopMemoryRefresh };
