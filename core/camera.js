// core\camera.js
function updateCamera(p1,p2,cam){let centerX=(p1.x+p2.x)/2,distX=abs(p1.x-p2.x),minZoom=1,maxZoom=2.5,zoom=constrain(map(distX,0,width*0.8,maxZoom,minZoom),minZoom,maxZoom);const groundY=height-100,p1Feet=p1.y+p1.h,p2Feet=p2.y+p2.h,centerY=Math.min(p1Feet,p2Feet,groundY);const smoothing=0.1;cam.x+=(centerX-cam.x)*smoothing;cam.y+=(centerY-cam.y)*smoothing;cam.zoom=zoom;return cam}
function applyCamera(cam){translate(width/2,height/2+map(cam.zoom,0.6,1.5,80,20));scale(cam.zoom);translate(-cam.x,-cam.y)}
export{updateCamera,applyCamera};
