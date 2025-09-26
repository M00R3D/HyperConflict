let _end = 0;
let _frameFreezeRemaining = 0;
let _frozenImg = null;

// NEW: pending request state to capture the NEXT rendered frame
let _pendingFrames = 0;
let _pendingRequest = false;

// extra frames to ensure the paused frame holds a bit longer visually
const EXTRA_FREEZE_FRAMES = 5;

// Expose global helper flags so other modules can treat hitstop like a "pause"
if (typeof window !== 'undefined') {
  window.HITSTOP_ACTIVE = window.HITSTOP_ACTIVE || false;
  window.HITSTOP_PENDING = window.HITSTOP_PENDING || false;
}

export function applyHitstop(ms = 80) {
  _end = millis() + Math.max(0, ms);
}

// Request a frame-based hitstop but DEFER the actual canvas capture to the next full render.
// This ensures the frozen image exactly matches the frame that was just drawn.
export function applyHitstopFrames(frames = 3) {
  if (!frames || frames <= 0) return;
  // store requested frames; actual freeze will add EXTRA_FREEZE_FRAMES when snapshot is taken
  _pendingFrames = Math.max(_pendingFrames, Math.floor(frames));
  _pendingRequest = true;
  // mark pending globally so other systems can optionally freeze visuals immediately
  if (typeof window !== 'undefined') window.HITSTOP_PENDING = true;
  // keep a small time-window to mark "active" for compatibility checks if needed
  _end = millis() + 200; // short TTL until capture occurs
}

// Called after a normal frame has been rendered to capture the canvas for frame-based hitstop.
// Should be invoked from main.draw at the end of the normal render pass.
export function capturePendingHitstopSnapshot() {
  if (!_pendingRequest) return;
  try {
    _frozenImg = get(); // snapshot of whole canvas after the frame has been drawn
  } catch (e) {
    _frozenImg = null;
  }
  // include EXTRA_FREEZE_FRAMES so the frozen frame holds visibly longer
  const totalFrames = Math.max(_frameFreezeRemaining, (_pendingFrames || 0)) + EXTRA_FREEZE_FRAMES;
  _frameFreezeRemaining = Math.max(_frameFreezeRemaining, Math.floor(totalFrames));
  // establish a time-based end so isHitstopActive() remains true even if frames are consumed slowly
  _end = millis() + Math.max(0, Math.round((_frameFreezeRemaining / (frameRate ? Math.max(30, Math.round(frameRate())) : 60)) * 1000));
  // clear pending request
  _pendingFrames = 0;
  _pendingRequest = false;
  if (typeof window !== 'undefined') {
    window.HITSTOP_PENDING = false;
    // mark active: now that we captured the snapshot, consider hitstop "active"
    window.HITSTOP_ACTIVE = (_frameFreezeRemaining > 0);
  }
}

// Called from the main draw loop: if a frame-freeze is active, this draws the frozen snapshot
// and consumes one frame. Returns true if it drew the frozen frame (so caller should return early).
export function drawFrozenHitstop() {
  if (!(_frameFreezeRemaining > 0)) {
    // ensure global flag cleared if no frames left
    if (typeof window !== 'undefined') window.HITSTOP_ACTIVE = false;
    return false;
  }

  // mark active globally (defensive)
  if (typeof window !== 'undefined') window.HITSTOP_ACTIVE = true;

  push();
  // Draw frozen snapshot if available; else draw a subtle pause overlay
  if (_frozenImg) {
    imageMode(CORNER);
    image(_frozenImg, 0, 0, width, height);
  } else {
    fill(0, 60);
    rect(0, 0, width, height);
  }
  pop();

  // consume one frame
  _frameFreezeRemaining = Math.max(0, _frameFreezeRemaining - 1);

  // if finished, release the frozen image to free memory and clear global flags
  if (_frameFreezeRemaining === 0) {
    _frozenImg = null;
    _end = 0;
    if (typeof window !== 'undefined') window.HITSTOP_ACTIVE = false;
  }
  return true;
}

export function isHitstopActive() {
  return millis() < _end || _frameFreezeRemaining > 0 || _pendingRequest;
}

export function remainingHitstop() {
  return Math.max(0, _end - millis());
}