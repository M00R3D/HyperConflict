// core\camera.js

function updateCamera(p1, p2, cam) {
  let centerX = (p1.x + p2.x) / 2;
  let distX = abs(p1.x - p2.x);
  const minZoom = 0.6, maxZoom = 1.5;
  let zoom = constrain(map(distX, 0, width * 0.8, maxZoom, minZoom), minZoom, maxZoom);
  const smoothing = 0.1;
  cam.x += (centerX - cam.x) * smoothing;
  cam.y += ((height - 72) - cam.y) * smoothing;
  cam.zoom = zoom;
  return cam;
}

function applyCamera(cam) {
  translate(width / 2, height / 2 + map(cam.zoom, 0.6, 1.5, 80, 20));
  scale(cam.zoom);
  translate(-cam.x, -cam.y);
}

export { updateCamera, applyCamera };
