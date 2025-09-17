// core/input.js
// Encapsula todo lo relacionado con input y exporta helpers

let playerRefs = { p1: null, p2: null };
let playersReady = false;
const p1ControlKeys = new Set(['w','a','s','d','i','o',' ', 'u']); // <-- agregar 'u' para grab
const p2ControlKeys = new Set(['arrowup','arrowleft','arrowdown','arrowright','b','n','backspace', 'v']); // <-- agregar 'v' para grab

// estado de teclas (exportado)
let keysDown = {};
let keysUp = {};
let keysPressed = {};
let keysDownTime = {};
let keysUpTime = {};

let _inited = false;

function initInput({ p1 = null, p2 = null, ready = false } = {}) {
  playerRefs.p1 = p1;
  playerRefs.p2 = p2;
  playersReady = ready;

  if (_inited) return;
  _inited = true;

  window.addEventListener("keydown", (e) => {
    const key = (e.key || "").toLowerCase();
    if (!key) return;

    // one-frame pressed detection
    if (!keysDown[key]) {
      keysPressed[key] = true;
      keysDownTime[key] = millis();
    }
    keysDown[key] = true;
    keysUp[key] = false;

    // enviar al buffer del fighter correspondiente (si ya cargados)
    if (playersReady) {
      if (playerRefs.p1 && p1ControlKeys.has(key)) playerRefs.p1.addInputFromKey(key);
      if (playerRefs.p2 && p2ControlKeys.has(key)) playerRefs.p2.addInputFromKey(key);
    }

    // DEBUG: opcional
    // console.log('keydown', key);
  });

  window.addEventListener("keyup", (e) => {
    const key = (e.key || "").toLowerCase();
    if (!key) return;
    keysDown[key] = false;
    keysUp[key] = true;
    keysUpTime[key] = millis();
    // opcional: borrar keysDownTime si no lo necesitas
    delete keysDownTime[key];
    // DEBUG: opcional
    // console.log('keyup', key);
  });
}

function setPlayersReady(flag = true) {
  playersReady = !!flag;
}

function clearFrameFlags() {
  // Debe llamarse al final de cada frame para resetear flags de un solo frame
  for (let k in keysPressed) keysPressed[k] = false;
  for (let k in keysUp) keysUp[k] = false;
}

export {
  initInput,
  setPlayersReady,
  clearFrameFlags,
  // estado exportado
  keysDown, keysUp, keysPressed, keysDownTime, keysUpTime
};
