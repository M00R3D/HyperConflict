let _end = 0;

export function applyHitstop(ms = 80) {
  _end = millis() + Math.max(0, ms);
}

export function isHitstopActive() {
  return millis() < _end;
}

export function remainingHitstop() {
  return Math.max(0, _end - millis());
}