// core\camera.js
function updateCamera(p1,p2,cam){
  // Protección: si no hay jugadores, usar cámara centrada por defecto para selection/menus
  if (!p1 || !p2) {
    const centerX = (typeof cam === 'object' && typeof cam.x === 'number') ? cam.x : width/2;
    const centerY = (typeof cam === 'object' && typeof cam.y === 'number') ? cam.y : height/2;
    const zoom = (typeof cam === 'object' && typeof cam.zoom === 'number') ? cam.zoom : 1;
    if (cam && typeof cam === 'object') {
      cam.x = lerp(cam.x || centerX, centerX, 0.12);
      cam.y = lerp(cam.y || centerY, centerY, 0.12);
      cam.zoom = lerp(cam.zoom || zoom, zoom, 0.08);
    }
    return cam;
  }

  // valores base
  const centerX = (p1.x + p2.x) / 2;
  const distX = abs(p1.x - p2.x);
  const minZoom = 1, maxZoom = 2.5;
  const zoom = constrain(map(distX, 0, width*0.8, maxZoom, minZoom), minZoom, maxZoom);

  // calcular pies (y + h). y menor === más arriba en pantalla.
  const p1Feet = p1.y + p1.h;
  const p2Feet = p2.y + p2.h;

  // Umbral: si la diferencia vertical entre pies supera ESTE valor, seguir siempre al que esté más arriba
  const VERTICAL_DIFF_THRESHOLD = 120; // px, ajusta si quieres más/menos sensibilidad

  let targetFeetY;
  const verticalDiff = Math.abs(p1Feet - p2Feet);

  if (verticalDiff > VERTICAL_DIFF_THRESHOLD) {
    // seguir al que esté más arriba (pies con menor Y)
    targetFeetY = Math.min(p1Feet, p2Feet);
  } else {
    // comportamiento por defecto: aproximar a la línea de suelo o centrar entre ambos (evita subir cuando ambos en suelo)
    const groundY = height - 72;
    // preferimos centrar en el promedio de pies pero sin superar el suelo
    const avgFeet = (p1Feet + p2Feet) / 2;
    targetFeetY = Math.min(avgFeet, groundY);
  }

  // pequeño offset para que el objetivo no quede pegado al borde inferior
  const verticalOffset = 40;
  const desiredCenterY = targetFeetY - verticalOffset;

  // ajustar suavizado Y dependiendo de cuánto esté por encima del suelo el objetivo
  const groundY = height - 72;
  const riseAboveGround = Math.max(0, groundY - targetFeetY); // px encima del suelo

  // cuando alguien esté significativamente alto (>200 px), seguirlo mucho más rápido en Y
  let smoothingY = 0.12;
  if (riseAboveGround > 200) {
    // cuanto más alto, más rápido (clamp para evitar jumps excesivos)
    if (riseAboveGround > 420) smoothingY = 0.95;
    else if (riseAboveGround > 300) smoothingY = 0.75;
    else smoothingY = 0.5;
  }

  // suavizado X puede permanecer más lento
  const smoothingX = 0.12;

  cam.x += (centerX - cam.x) * smoothingX;
  cam.y += (desiredCenterY - cam.y) * smoothingY;
  cam.zoom = zoom;
  return cam;
}
function applyCamera(cam){translate(width/2,height/2+map(cam.zoom,0.6,1.5,80,20));scale(cam.zoom);translate(-cam.x,-cam.y)}
export{updateCamera,applyCamera};
