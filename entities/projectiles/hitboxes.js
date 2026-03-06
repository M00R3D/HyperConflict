// entities/projectiles/hitboxes.js
// Centraliza la configuración de hitboxes para proyectiles y provee API de acceso.

export const PROJECTILE_HITBOXES = {
  1: { offsetX: 2, offsetY: -6, w: 34, h: 32 },   // hadouken parabólico
  2: { offsetX: -16, offsetY: -16, w: 32, h: 32 },   // fireball
  3: { offsetX: -12, offsetY: -12, w: 6, h: 3 },   // shuriken
  4: { offsetX: -10, offsetY: -18, w: 20, h: 36 },   // tats barrera
  5: { offsetX: 1, offsetY: 0,  w: 18, h: 6  },    // bun
  6: { offsetX: 2, offsetY: 0,  w: 18, h: 6  },    // staple
  7: { offsetX: 3, offsetY: 3, w: 6, h: 6 },    // spit_proj
  default: { offsetX: -8, offsetY: -8, w: 16, h: 16 }
};

export function getProjectileHitboxConfig(id) {
  if (typeof id === 'undefined' || id === null) return Object.assign({}, PROJECTILE_HITBOXES.default);
  const v = PROJECTILE_HITBOXES[id] || PROJECTILE_HITBOXES.default;
  return Object.assign({}, v);
}

export function setProjectileHitboxConfig(id, def = {}) {
  if (typeof id === 'undefined' || id === null) return;
  PROJECTILE_HITBOXES[id] = Object.assign({}, PROJECTILE_HITBOXES[id] || {}, def);
}

export function registerProjectileHitboxes(map = {}) {
  if (!map || typeof map !== 'object') return;
  for (const k in map) {
    if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
    PROJECTILE_HITBOXES[k] = Object.assign({}, PROJECTILE_HITBOXES[k] || {}, map[k]);
  }
}
