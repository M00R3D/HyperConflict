// core/loader.js
// LRU cache for loaded piskel frames to avoid re-decoding base64 images
const _piskelCacheMap = new Map(); // key -> Promise resolving to layers
let _PISKEL_CACHE_MAX = 200; // max entries — must hold all character+UI sprites (~120)

function loadPiskel(jsonPath) {
  if (!jsonPath) return Promise.resolve([]);
  // Return cached promise if available (and move to newest for LRU)
  if (_piskelCacheMap.has(jsonPath)) {
    const existing = _piskelCacheMap.get(jsonPath);
    // refresh LRU position
    _piskelCacheMap.delete(jsonPath);
    _piskelCacheMap.set(jsonPath, existing);
    return existing;
  }

  const p = new Promise((resolve) => {
    loadJSON(jsonPath, async (data) => {
      if (!data?.piskel?.layers) {
        console.error("Archivo .piskel inválido:", data);
        resolve([]);
        return;
      }
      try { console.log('[loadPiskel] loading', jsonPath, 'piskel.layers.length =', data.piskel.layers.length); } catch (e) {}
      const layerPromises = data.piskel.layers.map(async (layerStr) => {
        let layer = JSON.parse(layerStr);
        if (!layer?.chunks?.length) return [];
        const frames = [];
        const imgPromises = [];
        for (const chunk of layer.chunks) {
          const base64 = chunk.base64PNG;
          chunk.layout.forEach((frameRow) => {
            frameRow.forEach((frameIndex) => {
              const pimg = new Promise((res) => {
                loadImage(base64, (img) => {
                  frames[frameIndex] = img;
                  res();
                }, (err) => {console.error('loadImage error:', err);frames[frameIndex] = null;res();});
              });
              imgPromises.push(pimg);
            });
          });
        }

        await Promise.all(imgPromises);
        return frames;
      });

      const layers = await Promise.all(layerPromises);
      try {
        const counts = layers.map(l => (Array.isArray(l) ? l.length : 0));
        // console.log('[loadPiskel] loaded', jsonPath, 'layer counts =', counts);
      } catch (e) {}
      resolve(layers);
    });
  });

  // store promise in cache so subsequent calls reuse decoded images
  _piskelCacheMap.set(jsonPath, p);
  // enforce LRU max size
  try {
    while (_piskelCacheMap.size > _PISKEL_CACHE_MAX) {
      // delete the oldest entry (first key)
      const it = _piskelCacheMap.keys();
      const oldest = it.next().value;
      if (oldest) _piskelCacheMap.delete(oldest);
      else break;
    }
  } catch (e) {}
  return p;
}

// Expose minimal cache inspection / clearing helpers for debugging
if (typeof window !== 'undefined') {
  window.Loader = window.Loader || {};
  window.Loader._piskelCacheKeys = function() { try { return Array.from(_piskelCacheMap.keys()); } catch (e) { return []; } };
  window.Loader.getPiskelCacheCount = function() { try { return _piskelCacheMap.size; } catch (e) { return 0; } };
  window.Loader.clearPiskelCache = function() { try { _piskelCacheMap.clear(); return true; } catch (e) { return false; } };
  window.Loader.setPiskelCacheMax = function(n) { try { const v = Number(n) || 0; if (v > 0) _PISKEL_CACHE_MAX = v; return _PISKEL_CACHE_MAX; } catch (e) { return _PISKEL_CACHE_MAX; } };
}

export { loadPiskel };