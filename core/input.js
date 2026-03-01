// core/input.js
let playerRefs = { p1: null, p2: null };let playersReady = false;
const p1ControlKeys = new Set(['w','a','s','d','i','o',' ', 'u','p']);
const p2ControlKeys = new Set(['arrowup','arrowleft','arrowdown','arrowright','b','n','backspace', 'v','m']);

let keysDown = {};let keysUp = {};let keysPressed = {};let keysDownTime = {};let keysUpTime = {};
let _inited = false;
// separate state for keyboard vs gamepad so both can drive movement simultaneously
const kbDown = {}; // physical keyboard down state
const gpDown = {}; // gamepad-contributed down state
const prevMergedDown = {}; // previous merged state (kb || gp)
const _prevGPButtons = [];
const GP_DEADZONE = 0.35;

function initInput({ p1 = null, p2 = null, ready = false } = {}) {
  playerRefs.p1 = p1;playerRefs.p2 = p2;playersReady = ready;
  if (_inited) return;
  _inited = true;
  window.addEventListener("keydown", (e) => {
    const key = (e.key || "").toLowerCase();
    if (!key) return;
    if (!kbDown[key]) {
      kbDown[key] = true;
      const wasMerged = !!prevMergedDown[key];
      const nowMerged = true || !!gpDown[key];
      if (!wasMerged) {
        keysPressed[key] = true; keysDownTime[key] = millis();
        if (playersReady) { if (playerRefs.p1 && p1ControlKeys.has(key)) try { playerRefs.p1.addInputFromKey(key); } catch (e) {} if (playerRefs.p2 && p2ControlKeys.has(key)) try { playerRefs.p2.addInputFromKey(key); } catch (e) {} }
      }
      keysDown[key] = true; keysUp[key] = false; prevMergedDown[key] = true;
    }
  });
  window.addEventListener("keyup", (e) => {
    const key = (e.key || "").toLowerCase();
    if (!key) return;
    kbDown[key] = false;
    const nowMerged = !!gpDown[key] || !!kbDown[key];
    if (!nowMerged && prevMergedDown[key]) {
      keysDown[key] = false; keysUp[key] = true; keysUpTime[key] = millis(); delete keysDownTime[key]; prevMergedDown[key] = false;
    } else {
      // still held by other source (gamepad) — keep merged true
    }
  });
}
function setPlayersReady(flag = true) {  playersReady = !!flag;}
function clearFrameFlags() {for (let k in keysPressed) keysPressed[k] = false;for (let k in keysUp) keysUp[k] = false;}

// Poll the first connected gamepad and synthesize keyboard-like events for P1
function pollGamepads() {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
  const gps = navigator.getGamepads();
  const gp = gps && gps[0];
  if (!gp) {
    // clear prev state
    _prevGPButtons.length = 0;
    for (const k of Object.keys(gpDown)) gpDown[k] = false;
    // recompute merged keys and release ones no longer held
    for (const k in prevMergedDown) {
      const nowMerged = !!kbDown[k] || !!gpDown[k];
      if (!nowMerged && prevMergedDown[k]) {
        keysDown[k] = false; keysUp[k] = true; keysUpTime[k] = millis(); delete keysDownTime[k]; prevMergedDown[k] = false;
      }
    }
    return;
  }

  // determine directional booleans from axes + dpad buttons
  const ax0 = (gp.axes && gp.axes[0]) || 0;
  const ax1 = (gp.axes && gp.axes[1]) || 0;
  const dpadUp = !!(gp.buttons && gp.buttons[12] && gp.buttons[12].pressed);
  const dpadDown = !!(gp.buttons && gp.buttons[13] && gp.buttons[13].pressed);
  const dpadLeft = !!(gp.buttons && gp.buttons[14] && gp.buttons[14].pressed);
  const dpadRight = !!(gp.buttons && gp.buttons[15] && gp.buttons[15].pressed);

  const dirUp = dpadUp || ax1 < -GP_DEADZONE;
  const dirDown = dpadDown || ax1 > GP_DEADZONE;
  const dirLeft = dpadLeft || ax0 < -GP_DEADZONE;
  const dirRight = dpadRight || ax0 > GP_DEADZONE;

  const dirMap = { 'w': dirUp, 's': dirDown, 'a': dirLeft, 'd': dirRight };

  // handle directional transitions for P1 only, merge with keyboard state
  for (const k of Object.keys(dirMap)) {
    const gpPressed = !!dirMap[k];
    const wasMerged = !!prevMergedDown[k];
    gpDown[k] = gpPressed;
    const nowMerged = !!kbDown[k] || !!gpDown[k];
    if (nowMerged && !wasMerged) {
      keysPressed[k] = true; keysDownTime[k] = millis();
      keysDown[k] = true; keysUp[k] = false; prevMergedDown[k] = true;
      if (playersReady && playerRefs.p1 && p1ControlKeys.has(k)) try { playerRefs.p1.addInputFromKey(k); } catch (e) {}
    } else if (!nowMerged && wasMerged) {
      keysDown[k] = false; keysUp[k] = true; keysUpTime[k] = millis(); delete keysDownTime[k]; prevMergedDown[k] = false;
    } else {
      // no change
    }
  }

  // map face buttons to P1 actions (defaults)
  const buttonMap = {
    0: 'i', // A -> punch
    1: 'o', // B -> kick
    2: 'u', // X -> taunt / misc
    3: ' '  // Y -> jump (space)
  };

  for (const idxStr of Object.keys(buttonMap)) {
    const idx = Number(idxStr);
    const key = buttonMap[idx];
    const pressed = !!(gp.buttons && gp.buttons[idx] && gp.buttons[idx].pressed);
    const wasMerged = !!prevMergedDown[key];
    gpDown[key] = pressed;
    const nowMerged = !!kbDown[key] || !!gpDown[key];
    if (nowMerged && !wasMerged) {
      keysPressed[key] = true; keysDownTime[key] = millis(); keysDown[key] = true; keysUp[key] = false; prevMergedDown[key] = true;
      if (playersReady && playerRefs.p1 && p1ControlKeys.has(key)) try { playerRefs.p1.addInputFromKey(key); } catch (e) {}
    } else if (!nowMerged && wasMerged) {
      keysDown[key] = false; keysUp[key] = true; keysUpTime[key] = millis(); delete keysDownTime[key]; prevMergedDown[key] = false;
    }
    _prevGPButtons[idx] = pressed;
  }
}
export {initInput,setPlayersReady,clearFrameFlags,pollGamepads,  keysDown, keysUp, keysPressed, keysDownTime, keysUpTime};
