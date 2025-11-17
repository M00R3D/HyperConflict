// core\camera.js
function updateCamera(p1,p2,cam){
  // Protección: si no hay jugadores, usar cámara centrada por defecto para selection/menus
  if (!p1 || !p2) {
    // mantener valores previos si existen, o centrado por defecto
    const centerX = (typeof cam === 'object' && typeof cam.x === 'number') ? cam.x : width/2;
    const centerY = (typeof cam === 'object' && typeof cam.y === 'number') ? cam.y : height/2;
    const zoom = (typeof cam === 'object' && typeof cam.zoom === 'number') ? cam.zoom : 1;
    // intentar reajustar suavemente hacia defaults si cam estaba en otro sitio
    if (cam && typeof cam === 'object') {
      cam.x = lerp(cam.x || centerX, centerX, 0.12);
      cam.y = lerp(cam.y || centerY, centerY, 0.12);
      cam.zoom = lerp(cam.zoom || zoom, zoom, 0.08);
    }
    return cam;
  }

  let centerX=(p1.x+p2.x)/2,distX=abs(p1.x-p2.x),minZoom=1,maxZoom=2.5,zoom=constrain(map(distX,0,width*0.8,maxZoom,minZoom),minZoom,maxZoom);
  const groundY=height-100,p1Feet=p1.y+p1.h,p2Feet=p2.y+p2.h,centerY=Math.min(p1Feet,p2Feet,groundY);
  const smoothing=0.1;
  cam.x+=(centerX-cam.x)*smoothing;
  cam.y+=(centerY-cam.y)*smoothing;
  cam.zoom=zoom;
  return cam
}
function applyCamera(cam){translate(width/2,height/2+map(cam.zoom,0.6,1.5,80,20));scale(cam.zoom);translate(-cam.x,-cam.y)}
export{updateCamera,applyCamera};
