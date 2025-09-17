// core\camera.js

function updateCamera(p1, p2, cam) {
  let centerX = (p1.x + p2.x) / 2;
  let distX = abs(p1.x - p2.x);
  const minZoom = 1, maxZoom = 2.5;
  let zoom = constrain(map(distX, 0, width * 0.8, maxZoom, minZoom), minZoom, maxZoom);

  // --- NUEVO: calcular centro Y según ambos jugadores ---
  // El valor base es el suelo (height - 100), pero si alguno salta, la cámara sube.
  const groundY = height - 100;
  const p1Feet = p1.y + p1.h;
  const p2Feet = p2.y + p2.h;
  // El centroY será el menor de los dos (el más alto), pero nunca más bajo que groundY
  let centerY = Math.min(p1Feet, p2Feet, groundY);

  const smoothing = 0.1;
  cam.x += (centerX - cam.x) * smoothing;
  cam.y += (centerY - cam.y) * smoothing;
  cam.zoom = zoom;
  return cam;
}

function applyCamera(cam) {
  translate(width / 2, height / 2 + map(cam.zoom, 0.6, 1.5, 80, 20));
  scale(cam.zoom);
  translate(-cam.x, -cam.y);
}

export { updateCamera, applyCamera };
