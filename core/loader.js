// core/loader.js
function loadPiskel(jsonPath) {
  return new Promise((resolve) => {
    loadJSON(jsonPath, async (data) => {
      if (!data?.piskel?.layers) {
        console.error("Archivo .piskel inválido:", data);
        resolve([]);
        return;
      }

      // procesar cada layer y esperar a las imágenes
      const layerPromises = data.piskel.layers.map(async (layerStr) => {
        let layer = JSON.parse(layerStr);
        if (!layer?.chunks?.length) return [];

        // frames por esta capa (sparse array hasta indices concretos)
        const frames = [];

        // crear promises por cada image load
        const imgPromises = [];

        for (const chunk of layer.chunks) {
          const base64 = chunk.base64PNG;
          // layout: array de filas con índices de frame
          chunk.layout.forEach((frameRow) => {
            frameRow.forEach((frameIndex) => {
              // crear promesa que resuelve cuando loadImage carga la imagen
              const p = new Promise((res) => {
                loadImage(base64, (img) => {
                  frames[frameIndex] = img;
                  res();
                }, (err) => {
                  console.error('loadImage error:', err);
                  // dejar undefined o colocar fallback
                  frames[frameIndex] = null;
                  res();
                });
              });
              imgPromises.push(p);
            });
          });
        }

        // esperar todas las imágenes de este layer
        await Promise.all(imgPromises);
        return frames;
      });

      // esperar todas las capas
      const layers = await Promise.all(layerPromises);
      resolve(layers);
    });
  });
}

export { loadPiskel };
