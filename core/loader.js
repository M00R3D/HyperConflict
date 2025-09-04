// core\loader.js

function loadPiskel(jsonPath) {
  return new Promise((resolve) => {
    loadJSON(jsonPath, (data) => {
      if (!data?.piskel?.layers) {
        console.error("Archivo .piskel inválido:", data);
        resolve([]);
        return;
      }
      let layers = data.piskel.layers.map(layerStr => {
        let layer = JSON.parse(layerStr);
        if (!layer?.chunks?.length) return [];
        let frames = [];
        layer.chunks.forEach(chunk => {
          chunk.layout.forEach(frameRow => {
            frameRow.forEach(frameIndex => {
              loadImage(chunk.base64PNG, img => {
                frames[frameIndex] = img;
              });
            });
          });
        });
        return frames;
      });
      resolve(layers);
    });
  });
}

export { loadPiskel };
