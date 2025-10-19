// core/hitstop.js
let _end = 0;let _frameFreezeRemaining = 0;let _frozenImg = null;let _pendingFrames = 0;let _pendingRequest = false;

const EXTRA_FREEZE_FRAMES = 5;
if (typeof window !== 'undefined') {window.HITSTOP_ACTIVE = window.HITSTOP_ACTIVE || false;window.HITSTOP_PENDING = window.HITSTOP_PENDING || false;}

export function applyHitstop(ms = 80) {_end = millis() + Math.max(0, ms);}

export function applyHitstopFrames(frames = 3) {
  if (!frames || frames <= 0) return;
  _pendingFrames = Math.max(_pendingFrames, Math.floor(frames));
  _pendingRequest = true;
  if (typeof window !== 'undefined') window.HITSTOP_PENDING = true;
  _end = millis() + 200;
}
export function capturePendingHitstopSnapshot() {
  if (!_pendingRequest) return;
  try {_frozenImg = get();
  } catch (e) {_frozenImg = null;}
  const totalFrames = Math.max(_frameFreezeRemaining, (_pendingFrames || 0)) + EXTRA_FREEZE_FRAMES;
  _frameFreezeRemaining = Math.max(_frameFreezeRemaining, Math.floor(totalFrames));
  _end = millis() + Math.max(0, Math.round((_frameFreezeRemaining / (frameRate ? Math.max(30, Math.round(frameRate())) : 60)) * 1000));
  _pendingFrames = 0;
  _pendingRequest = false;
  if (typeof window !== 'undefined') {window.HITSTOP_PENDING = false;window.HITSTOP_ACTIVE = (_frameFreezeRemaining > 0);}
}
export function drawFrozenHitstop() {
  if (!(_frameFreezeRemaining > 0)) {if (typeof window !== 'undefined') window.HITSTOP_ACTIVE = false;
    return false;}
  if (typeof window !== 'undefined') window.HITSTOP_ACTIVE = true;
  push();
  if (_frozenImg) {imageMode(CORNER);image(_frozenImg, 0, 0, width, height);
  } else {fill(0, 60);rect(0, 0, width, height);}
  pop();
  _frameFreezeRemaining = Math.max(0, _frameFreezeRemaining - 1);
  if (_frameFreezeRemaining === 0) {
    _frozenImg = null;
    _end = 0;
    if (typeof window !== 'undefined') window.HITSTOP_ACTIVE = false;
  }
  return true;
}
export function isHitstopActive() {  return millis() < _end || _frameFreezeRemaining > 0 || _pendingRequest;}
export function remainingHitstop() {  return Math.max(0, _end - millis());}