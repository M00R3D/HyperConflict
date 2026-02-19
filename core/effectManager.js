export function computeFramesPerHitFor(player) {//esta funcion brevemente otorga mas hitstop cuanto menos hp tenga el jugador, para hacer que los comeback sean mas probables y emocionantes
  const base = 3;
  const perQuarterBonus = 2;
  const maxQ = (typeof window !== 'undefined' && typeof window.MAX_HP_QUARTERS === 'number') ? window.MAX_HP_QUARTERS : 24;
  const hpNow = (player && typeof player.hp === 'number') ? player.hp : maxQ;
  const missing = Math.max(0, maxQ - hpNow);
  return base + (missing * perQuarterBonus);
}
export function startDamageEffect(player, quartersRemoved) {// esta función inicia un efecto visual de impacto que se intensifica cuanto menos HP tenga el jugador, para aumentar la sensación de peligro y urgencia en los momentos críticos del combate el efecto consiste en un zoom rápido y breve de la cámara hacia el jugador afectado, con una magnitud que aumenta a medida que el HP del jugador disminuye, y una duración que también se ajusta según la cantidad de HP perdido en el golpe. Esto ayuda a enfatizar la importancia de cada golpe y a hacer que los momentos de baja salud sean más emocionantes y tensos para ambos jugadores. El efecto se calcula en base a los cuartos de HP perdidos, con un máximo definido por MAX_HP_QUARTERS, y se aplica solo al jugador objetivo para crear una sensación de impacto directo.  if (!player) return;
  const now = millis();
  const maxQ2 = (typeof window !== 'undefined' && typeof window.MAX_HP_QUARTERS === 'number') ? window.MAX_HP_QUARTERS : 24;
  const remaining = Math.max(0, Math.min(maxQ2, player.hp));
  const lowFactor = 1 - (remaining / maxQ2);
  const duration = Math.min(500, 220 + 160 * Math.max(1, quartersRemoved));
  const baseMag = Math.min(100, 6 * Math.max(1, quartersRemoved) * (1 + lowFactor * 3));
  const mag = baseMag * 0.065;
  const zoomAdd = Math.min(0.3, 0.035 * Math.max(1, quartersRemoved) * (1 + lowFactor * 4));
  const effect = { active: true, start: now, end: now + duration, duration, mag, zoom: zoomAdd, targetPlayerId: player.id };
  if (typeof window !== 'undefined') {
    window._hitEffect = effect;
  }
  return effect;
}

