// entities/projectiles/types.js
import { loadPiskel } from '../../core/loader.js';

// Map from short framesKey -> .piskel path. Call `registerProjectileFrameKey`
// to override or add entries at runtime. Loader caches promises.
export const FRAMEKEY_MAP = {
  projectile: 'src/tyeman/tyeman_projectile.piskel',
  fireball: 'src/tyeman/tyeman_projectile.piskel',
  shuriken: 'src/sbluer/sbluer_projectile.piskel',
  tats: 'src/tyeman/tyeman_tats_proj.piskel',
  bun: 'src/tyeman/tyeman_bun.piskel',
  staple: 'src/tyeman/tyeman_staple.piskel',
  spit_proj: 'src/sbluer/sbluer_spit_proj.piskel'
};

const _frameKeyPromises = Object.create(null);

export function registerProjectileFrameKey(key, piskelPath) {
  if (!key || typeof key !== 'string') return;
  FRAMEKEY_MAP[key] = piskelPath;
  if (_frameKeyPromises[key]) delete _frameKeyPromises[key];
}

export async function loadProjectileFramesKey(key) {
  if (!key || typeof key !== 'string') return null;
  if (_frameKeyPromises[key]) return _frameKeyPromises[key];
  const path = FRAMEKEY_MAP[key];
  if (!path) return null;
  const p = loadPiskel(path).catch((err) => {
    console.warn('[loadProjectileFramesKey] failed to load', key, path, err);
    return null;
  });
  _frameKeyPromises[key] = p;
  return p;
}

// Central place to register reusable projectile parameter presets.
export const PROJECTILE_TYPES = {
  1: {
    id: 1,
    name: 'hadouken',
    parabolic: true,
    speed: 3,
    initVy: -5,
    gravity: 0.2,
    rotationSpeed: 25,
    w: 48,
    h: 32,
    frameDelay: 6,
    framesKey: 'projectile',
    hitboxId: 1,
    damageQuarters: 10,
    lifespan: 930
  },
  2: {
    id: 2,
    name: 'fireball',
    linear: true,
    speed: 10,
    gravity: 0,
    w: 32,
    h: 32,
    frameDelay: 6,
    framesKey: 'fireball',
    hitboxId: 2,
    lifespan: 5000
  },
  3: {
    id: 3,
    name: 'shuriken',
    linear: true,
    speed: 12,
    gravity: 0,
    w: 24,
    h: 24,
    frameDelay: 4,
    framesKey: 'shuriken',
    hitboxId: 3,
    lifespan: 3000
  },
  4: {
    id: 4,
    name: 'tats',
    upward: true,
    speed: 0,
    gravity: 0,
    w: 20,
    h: 28,
    duration: 1200,
    upSpeed: 20.9,
    targetScale: 2.4,
    spawnDelay: 0,
    framesKey: 'tats',
    hitboxId: 4
  },
  5: {
    id: 5,
    name: 'bun',
    hook: true,
    speed: 10,
    gravity: 0.0,
    w: 7,
    h: 4,
    duration: 12000,
    maxRange: 120,
    spriteScale: 1.5,
    stringOptions: { stringW: 4, stringH: 2, stringFrameDelay: 6 },
    framesKey: 'bun',
    hitboxId: 5,
    damageQuarters: 1
  },
  6: {
    id: 6,
    name: 'staple',
    linear: true,
    speed: 24,
    gravity: 0,
    w: 18,
    h: 6,
    frameDelay: 4,
    framesKey: 'staple',
    hitboxId: 6,
    lifespan: 4000,
    damageQuarters: 2
  },
  7: {
    id: 7,
    name: 'spit_proj',
    parabolic: true,
    speed: 1.4,
    initVy: -3,
    gravity: 0.45,
    rotationSpeed: 15,
    rollSpeed: 2.6,
    spawnSpeedFactors: [0.1, 0.5, 0.9],
    floorBrake: 0,
    w: 6,
    h: 6,
    frameDelay: 6,
    framesKey: 'spit_proj',
    hitboxId: 3,
    damageQuarters: 3,
    lifespan: 5000,
    maxRange: 3,
    collisionWithSelf: true,
    touchScale: 1.6,
    touchHitboxScale: 1.6,
    touchSlowFactor: 0.5
  },
  default: {
    id: 'default',
    name: 'default',
    speed: 6,
    gravity: 0,
    w: 16,
    h: 16,
    frameDelay: 6,
    framesKey: null,
    hitboxId: 'default',
    lifespan: 5000
  }
};

export function registerProjectileType(id, def = {}) {
  if (typeof id === 'undefined' || id === null) return;
  PROJECTILE_TYPES[id] = Object.assign({}, PROJECTILE_TYPES[id] || {}, def);
}

function _findTypeId(typeIdOrName) {
  if (typeof typeIdOrName === 'number') return typeIdOrName;
  if (typeof typeIdOrName === 'string') {
    const asNum = Number(typeIdOrName);
    if (!Number.isNaN(asNum) && PROJECTILE_TYPES[asNum]) return asNum;
    for (const k in PROJECTILE_TYPES) {
      if (!Object.prototype.hasOwnProperty.call(PROJECTILE_TYPES, k)) continue;
      const v = PROJECTILE_TYPES[k];
      if (v && v.name === typeIdOrName) return v.id || (Number(k) || k);
    }
  }
  return null;
}

export function findTypeId(typeIdOrName) {
  return _findTypeId(typeIdOrName);
}

export function getProjectileType(idOrName) {
  if (typeof idOrName === 'undefined' || idOrName === null) return Object.assign({}, PROJECTILE_TYPES.default);
  const id = _findTypeId(idOrName) ?? idOrName;
  const v = PROJECTILE_TYPES[id] || PROJECTILE_TYPES[String(id)] || PROJECTILE_TYPES.default;
  return Object.assign({}, v);
}
