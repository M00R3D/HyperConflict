// core/hitstop.js
let _end = 0; // tiempo en ms cuando el hitstop debería terminar (basado en millis())
let _frameFreezeRemaining = 0; // contador de fotogramas que deben permanecer congelados
let _frozenImg = null; // imagen capturada para mostrar durante el freeze de frames
let _pendingFrames = 0; // solicitudes pendientes de congelar N fotogramas
let _pendingRequest = false; // indica que hay una solicitud pendiente de freeze










// --- NEW: controlar duración del hitstop con una sola variable (ms por "frame" de freeze) ---
// Si HITSTOP_MS_PER_FRAME === 0 => hitstop queda desactivado (siempre 0ms)
export let HITSTOP_MS_PER_FRAME = 0; // ajustar a 0 para desactivar totalmente el hitstop
















export function setHitstopMsPerFrame(ms) {
  HITSTOP_MS_PER_FRAME = Math.max(0, Number(ms) || 0);
  if (typeof window !== 'undefined') window.HITSTOP_MS_PER_FRAME = HITSTOP_MS_PER_FRAME;
}

const EXTRA_FREEZE_FRAMES = 0; // frames extra añadidos al cálculo para seguridad
if (typeof window !== 'undefined') {
  window.HITSTOP_ACTIVE = window.HITSTOP_ACTIVE || false;
  window.HITSTOP_PENDING = window.HITSTOP_PENDING || false;
  window.HITSTOP_REMAINING_MS = window.HITSTOP_REMAINING_MS || 0;
  window.HITSTOP_MS_PER_FRAME = window.HITSTOP_MS_PER_FRAME || HITSTOP_MS_PER_FRAME;
}
// si estamos en navegador, inicializa dos flags globales en window para depuración/estado

export function applyHitstop(ms = 0) {
  // Si el sistema está desactivado mediante HITSTOP_MS_PER_FRAME = 0, no permitir hitstop por tiempo
  if (HITSTOP_MS_PER_FRAME === 0) {
    _end = millis(); // garantizar que no quede tiempo pendiente
    if (typeof window !== 'undefined') window.HITSTOP_REMAINING_MS = 0;
    return;
  }
  _end = millis() + Math.max(0, ms);
}
// activa hitstop basado en tiempo: fija _end a millis()+ms (80ms por defecto)

export function applyHitstopFrames(frames = 0) {
  // Si el sistema está desactivado mediante HITSTOP_MS_PER_FRAME = 0, ignorar solicitudes por frames
  if (HITSTOP_MS_PER_FRAME === 0) {
    _pendingFrames = 0;
    _pendingRequest = false;
    if (typeof window !== 'undefined') window.HITSTOP_PENDING = false;
    return;
  }

  if (!frames || frames <= 0) return; // si no hay frames válidos, salir
  _pendingFrames = Math.max(_pendingFrames, Math.floor(frames)); // mantiene la mayor petición pendiente
  _pendingRequest = true; // marca que hay una petición pendiente
  if (typeof window !== 'undefined') window.HITSTOP_PENDING = true; // flag global para UI/depuración
  _end = millis() + 0; // coloca un temporizador de respaldo corto (200ms) para evitar que expire immediately
}
// solicita un hitstop por cantidad de frames (se captura después con capturePendingHitstopSnapshot)

export function capturePendingHitstopSnapshot() {
  // Si hitstop desactivado, limpiar cualquier pendiente y salir
  if (HITSTOP_MS_PER_FRAME === 0) {
    _pendingFrames = 0;
    _pendingRequest = false;
    if (typeof window !== 'undefined') window.HITSTOP_PENDING = false;
    return;
  }

  if (!_pendingRequest) return; // si no hay petición pendiente, no hace nada
  try {_frozenImg = get();
  } catch (e) {_frozenImg = null;} // intenta capturar la pantalla actual; si falla, deja null
  const totalFrames = Math.max(_frameFreezeRemaining, (_pendingFrames || 0)) + EXTRA_FREEZE_FRAMES; 
  // calcula total de frames a congelar: el mayor entre los ya programados y los pendientes, más extras
  _frameFreezeRemaining = Math.max(_frameFreezeRemaining, Math.floor(totalFrames)); // actualiza el contador de frames restantes

  // --- USAR la variable única HITSTOP_MS_PER_FRAME para calcular el tiempo total ---
  _end = millis() + Math.max(0, Math.round(_frameFreezeRemaining * HITSTOP_MS_PER_FRAME));

  _pendingFrames = 0; // limpia las solicitudes pendientes
  _pendingRequest = false; // marca que ya no hay petición pendiente
  if (typeof window !== 'undefined') {window.HITSTOP_PENDING = false;window.HITSTOP_ACTIVE = (_frameFreezeRemaining > 0);} 
  // actualiza flags globales: pending false, active true si hay frames por congelar
}

export function drawFrozenHitstop() {
  // Si hitstop desactivado globalmente, asegurar limpieza y no dibujar freeze
  if (HITSTOP_MS_PER_FRAME === 0) {
    _frameFreezeRemaining = 0;
    _frozenImg = null;
    _end = 0;
    if (typeof window !== 'undefined') {
      window.HITSTOP_ACTIVE = false;
      window.HITSTOP_REMAINING_MS = 0;
    }
    return false;
  }

  if (!(_frameFreezeRemaining > 0)) {
    if (typeof window !== 'undefined') window.HITSTOP_ACTIVE = false;
    // ensure remaining ms cleared when not active
    if (typeof window !== 'undefined') window.HITSTOP_REMAINING_MS = 0;
    return false;
  }
  // si estamos congelando por frames, marcar activo
  if (typeof window !== 'undefined') window.HITSTOP_ACTIVE = true;

  push(); // guarda estado de dibujo (p5.js)
  if (_frozenImg) {
    imageMode(CORNER);
    image(_frozenImg, 0, 0, width, height);
  } else {
    fill(0, 60);
    rect(0, 0, width, height);
  }
  pop(); // restaura estado de dibujo

  // decrementa el contador de frames congelados
  _frameFreezeRemaining = Math.max(0, _frameFreezeRemaining - 1);

  // calcular y exponer ms restantes basado en frames restantes (usar HITSTOP_MS_PER_FRAME)
  try {
    let msLeft = 0;
    // si hay un temporizador por tiempo activo, preferirlo
    const byTime = Math.max(0, _end - millis());
    if (byTime > 0) {
      msLeft = byTime;
    } else if (_frameFreezeRemaining > 0) {
      msLeft = Math.round(_frameFreezeRemaining * HITSTOP_MS_PER_FRAME);
    } else {
      msLeft = 0;
    }
    if (typeof window !== 'undefined') window.HITSTOP_REMAINING_MS = msLeft;
  } catch (e) {
    if (typeof window !== 'undefined') window.HITSTOP_REMAINING_MS = 0;
  }

  if (_frameFreezeRemaining === 0) {
    _frozenImg = null; // limpia la imagen cuando termina el freeze
    _end = 0; // resetea el tiempo final
    if (typeof window !== 'undefined') {
      window.HITSTOP_ACTIVE = false; // flag global a false
      window.HITSTOP_REMAINING_MS = 0;
    }
  }
  return true; // indica que se dibujó el freeze
}

export function isHitstopActive() {
  // Si hitstop global desactivado, forzar false
  if (HITSTOP_MS_PER_FRAME === 0) {
    if (typeof window !== 'undefined') window.HITSTOP_REMAINING_MS = 0;
    return false;
  }

  // estado activo según tiempo/frames/pendiente
  const active = (millis() < _end) || _frameFreezeRemaining > 0 || _pendingRequest;

  // actualizar exposición global del ms restante aquí (asegura que UI lo lea aunque drawFrozenHitstop
  // no se haya ejecutado en este frame)
  try {
    let msLeft = Math.max(0, _end - millis());
    if (msLeft <= 0 && _frameFreezeRemaining > 0) {
      msLeft = Math.round(_frameFreezeRemaining * HITSTOP_MS_PER_FRAME);
    }
    if (typeof window !== 'undefined') window.HITSTOP_REMAINING_MS = msLeft;
  } catch (e) {
    if (typeof window !== 'undefined') window.HITSTOP_REMAINING_MS = 0;
  }

  return active;
}

export function remainingHitstop() {  
  // Si hitstop global desactivado, forzar 0
  if (HITSTOP_MS_PER_FRAME === 0) return 0;
  return Math.max(0, _end - millis());
} 
// devuelve ms restantes hasta _end (0 si ya pasó)

// Nuevo: devuelve ms restantes considerando tanto _end (tiempo) como conteo de frames
export function remainingHitstopMs() {
  // Si hitstop global desactivado, forzar 0
  if (HITSTOP_MS_PER_FRAME === 0) {
    if (typeof window !== 'undefined') window.HITSTOP_REMAINING_MS = 0;
    return 0;
  }

  // primero preferir el valor temporal ya existente
  const byTime = Math.max(0, _end - millis());
  if (byTime > 0) {
    if (typeof window !== 'undefined') window.HITSTOP_REMAINING_MS = byTime;
    return byTime;
  }

  // si no hay tiempo pero hay congelado por frames, estimar ms usando HITSTOP_MS_PER_FRAME
  if (_frameFreezeRemaining > 0) {
    const ms = Math.round(_frameFreezeRemaining * HITSTOP_MS_PER_FRAME);
    if (typeof window !== 'undefined') window.HITSTOP_REMAINING_MS = ms;
    return ms;
  }
  // si no hay nada, 0
  if (typeof window !== 'undefined') window.HITSTOP_REMAINING_MS = 0;
  return 0;
}