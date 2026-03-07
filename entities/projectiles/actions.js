// entities/projectiles/actions.js
import { PROJECTILE_TYPES, loadProjectileFramesKey, findTypeId, getProjectileType } from './types.js';

// Apply per-type initialization to a Projectile instance. Mutates `self`.
export function applyProjectileTypeInit(self, opts = {}, resources = {}, framesByLayer = null) {
  switch (self.typeId) {
    case 1: // parabólico hadouken
      {
        const _fk = (opts && (opts.framesKey || opts.framesKey === null)) ? opts.framesKey : 'projectile';
        if (!self._framesPromise) self.framesByLayer = self.framesByLayer ?? ((resources && resources[_fk]) || resources.projectile) ?? null;
        self._hitboxId = (typeof opts.hitboxId !== 'undefined' && opts.hitboxId !== null) ? opts.hitboxId : self.typeId;
        self.x = self.x-33;
        self.y = self.y+10;
        self.w = 48;
        self.h = 32;
        self.speed = (typeof opts.speed === 'number') ? opts.speed : 3;
        self.vy = (typeof opts.initVy === 'number') ? opts.initVy : ((typeof opts.vy === 'number') ? opts.vy : -5);
        self.gravity = (typeof opts.gravity === 'number') ? opts.gravity : 0.3;
        self.rotation = (typeof opts.rotation === 'number') ? opts.rotation : 0;
        self.rotationSpeed = (typeof opts.rotationSpeed === 'number') ? opts.rotationSpeed : 15;
      }
      break;

    case 2: // fireball
      if (!self._framesPromise) self.framesByLayer = self.framesByLayer ?? resources.fireball ?? null;
      self.w = 32;
      self.h = 32;
      self.speed = 10;
      break;

    case 3: // shuriken
      if (!self._framesPromise) self.framesByLayer = self.framesByLayer ?? resources.shuriken ?? null;
      self.w = 24;
      self.h = 24;
      self.speed = 12;
      break;

    case 4: // tats
      if (!self._framesPromise) self.framesByLayer = self.framesByLayer ?? resources.tats ?? framesByLayer ?? null;
      self.w = opts.w ?? 20;
      self.h = opts.h ?? 28;
      self.duration = opts.duration ?? 1200;
      self.age = 0;
      self.alpha = 255;
      self.upSpeed = (typeof opts.upSpeed === 'number') ? opts.upSpeed : 0.9;
      self.targetScale = opts.targetScale ?? 2.4;
      self.spawnDelay = opts.spawnDelay ?? 0;
      self._spawnTimer = 0;
      self._visible = (self.spawnDelay <= 0);
      self.speed = 0;
      break;

    case 5: // bun
      if (!self._framesPromise) self.framesByLayer = self.framesByLayer ?? self._resources.bun ?? self.framesByLayer ?? null;
      self.w = opts.w ?? 7;
      self.h = opts.h ?? 4;
      self.speed = opts.speed ?? 8;
      self.duration = opts.duration ?? 2000;
      self.spawnDelay = opts.spawnDelay ?? 0;
      self._spawnTimer = 0;
      self._visible = (self.spawnDelay <= 0);
      self.maxRange = opts.maxRange ?? 320;
      self._startX = self.x;
      self.returning = false;
      self.toRemove = false;
      self.persistent = !!opts.persistent;
      self.spriteScale = (typeof opts.spriteScale === 'number') ? opts.spriteScale : 1;
      self.stringW = (typeof opts.stringW === 'number') ? opts.stringW : (6 * (self.stringScale || 1));
      self.stringH = (typeof opts.stringH === 'number') ? opts.stringH : (8 * (self.stringScale || 1));
      self.stringFrameDelay = (typeof opts.stringFrameDelay === 'number') ? opts.stringFrameDelay : (opts.frameDelay ?? 6);
      self._stringFrameIndex = 0;
      self._stringFrameTimer = 0;
      self.ownerOffsetX = (typeof opts.offsetX === 'number') ? opts.offsetX : null;
      self.ownerOffsetY = (typeof opts.offsetY === 'number') ? opts.offsetY : null;
      break;

    case 7: // spit_proj
      if (!self._framesPromise) self.framesByLayer = self.framesByLayer ?? resources.spit_proj ?? null;
      self.w = opts.w ?? 6;
      self.h = opts.h ?? 6;
      self.speed = (typeof opts.speed === 'number') ? opts.speed : 4;
      self.vy = (typeof opts.initVy === 'number') ? opts.initVy : -3;
      self.gravity = (typeof opts.gravity === 'number') ? opts.gravity : 0.15;
      self.rotationSpeed = (typeof opts.rotationSpeed === 'number') ? opts.rotationSpeed : 15;
      self.lifespan = (typeof opts.lifespan === 'number') ? opts.lifespan : 10000;
      self._rollSpeed = (typeof opts.rollSpeed === 'number') ? opts.rollSpeed : 1.6;
      self._rolling = false;
      self._spitGroundY = (typeof height === 'number') ? (height - 72 + 32) : null;
      self._scale = (typeof opts._scale === 'number') ? opts._scale : 1.0;
      self._scaleTarget = 1.0;
      self._scaleAnimSpeed = (typeof opts.scaleAnimSpeed === 'number') ? opts.scaleAnimSpeed : 0.12;
      self._animatingRemoval = false;
      self._readyToRemove = false;
      self._floorBrake = (typeof opts.floorBrake === 'number') ? opts.floorBrake : ((typeof opts.floorBrake === 'number') ? opts.floorBrake : 0.03);
      self._hitboxScale = 1;
      self._touched = false;
      self._stackCount = 1;
      self._touchScale = (typeof opts.touchScale === 'number') ? opts.touchScale : (opts.touchScale ?? 1.6);
      self._touchHitboxScale = (typeof opts.touchHitboxScale === 'number') ? opts.touchHitboxScale : (opts.touchHitboxScale ?? self._touchScale);
      self._touchSlowFactor = (typeof opts.touchSlowFactor === 'number') ? opts.touchSlowFactor : (opts.touchSlowFactor ?? 0.5);
      try {
        const pool = (typeof window !== 'undefined' && Array.isArray(window.projectiles)) ? window.projectiles : [];
        let existingCount = 0;
        if (self.ownerId !== null) {
          for (const pp of pool) {
            try {
              if (pp && pp.typeId === 7 && pp.ownerId === self.ownerId) {
                existingCount += (typeof pp._stackCount === 'number' ? pp._stackCount : 1);
              }
            } catch (e) {}
          }
        }
        self._spawnIndex = existingCount + 1;
        const factors = (Array.isArray(opts.spawnSpeedFactors) ? opts.spawnSpeedFactors : (Array.isArray((PROJECTILE_TYPES && PROJECTILE_TYPES[7] && PROJECTILE_TYPES[7].spawnSpeedFactors) ? PROJECTILE_TYPES[7].spawnSpeedFactors : null) ? PROJECTILE_TYPES[7].spawnSpeedFactors : [1,0.9,0.8]));
        const idx = Math.max(0, Math.min(factors.length - 1, self._spawnIndex - 1));
        const factor = (typeof factors[idx] === 'number') ? Number(factors[idx]) : 1;
        self._rollSpeed = (typeof self._rollSpeed === 'number' ? self._rollSpeed : 1.6) * factor;
      } catch (e) { self._spawnIndex = 1; }
      break;
    

    case 8: // thin_laser_proj
      if (!self._framesPromise) self.framesByLayer = self.framesByLayer ?? resources.thinLaserProj ?? null;
      // self.w = opts.w ?? 6;
      self.h = opts.h ?? 2;
      self.speed = opts.speed ?? 24;
      self.gravity = opts.gravity ?? 0;
      self.frameDelay = opts.frameDelay ?? 4;
      self.framesKey = opts.framesKey ?? 'thin_laser_proj';
      self.hitboxId = opts.hitboxId ?? 7;
      self.lifespan = opts.lifespan ?? 4000;
      self.damageQuarters = opts.damageQuarters ?? 4;
      self._originX = (typeof self._originX === 'number') ? self._originX : self.x;
      self._originY = (typeof self._originY === 'number') ? self._originY : self.y;
      // expansion: gradual growth until _maxLength is reached. Initialize defaults.
      self.w = opts.w ?? self.w ?? 6;
      self._expandSpeed = (typeof opts.expandSpeed === 'number') ? opts.expandSpeed : (PROJECTILE_TYPES && PROJECTILE_TYPES[8] ? PROJECTILE_TYPES[8].expandSpeed : 12);
      self._maxLength = (typeof opts.maxLength === 'number') ? opts.maxLength : (PROJECTILE_TYPES && PROJECTILE_TYPES[8] ? PROJECTILE_TYPES[8].maxLength : 120);
      break;
    default:
      self.framesByLayer = self.framesByLayer ?? null;
      self.w = 16;
      self.h = 16;
      self.speed = 6;
  }
}

export default applyProjectileTypeInit;
