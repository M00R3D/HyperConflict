// core/loader.js
function loadPiskel(jsonPath) {
  return new Promise((resolve) => {
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
              const p = new Promise((res) => {
                loadImage(base64, (img) => {
                  frames[frameIndex] = img;
                  res();
                }, (err) => {console.error('loadImage error:', err);frames[frameIndex] = null;res();});
              });
              imgPromises.push(p);
            });
          });
        }

        await Promise.all(imgPromises);
        return frames;
      });

      const layers = await Promise.all(layerPromises);
      try {
        const counts = layers.map(l => (Array.isArray(l) ? l.length : 0));
        console.log('[loadPiskel] loaded', jsonPath, 'layer counts =', counts);
      } catch (e) {}
      resolve(layers);
    });
  });
}
export { loadPiskel };