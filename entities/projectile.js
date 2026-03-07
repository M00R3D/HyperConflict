// entities/projectile.js

import { loadPiskel } from '../core/loader.js';
import { FRAMEKEY_MAP, registerProjectileFrameKey, loadProjectileFramesKey, PROJECTILE_TYPES, registerProjectileType, findTypeId, getProjectileType } from './projectiles/types.js';
import { PROJECTILE_HITBOXES, getProjectileHitboxConfig, setProjectileHitboxConfig, registerProjectileHitboxes } from './projectiles/hitboxes.js';
import applyProjectileTypeInit from './projectiles/actions.js';

class Projectile {
  constructor(x, y, dir, typeId = 0, ownerId = null, resources = {}, opts = {}, framesByLayer = null) {
    this.x = x;
    this.y = y;
    this.dir = dir === -1 ? -1 : 1;
    this.ownerId = ownerId ?? null;
    this.typeId = typeId;

    // defaults
    this.speed = 6;
    this.w = 16;
    this.h = 16;
    this.frameDelay = 6;
    // bun/hook defaults
    this.hook = true;
    this.maxRange = 320;
    this.spriteScale = 1;

    // lifetime / age (ms)
    this.age = 0;
    this.lifespan = (typeof opts?.lifespan === 'number') ? opts.lifespan : ((typeof opts?.duration === 'number') ? opts.duration : null);

    // resources may include string frames for bun
    this._resources = resources || {};
    this.stringFramesByLayer = this._resources.string || null;
    this.lifespan = (typeof opts?.lifespan === 'number') ? opts.lifespan : ((typeof opts?.duration === 'number') ? opts.duration : null);
    // Si framesByLayer es Promise
    this._framesPromise = null;
    this._loadingFrames = false;
    if (framesByLayer && typeof framesByLayer.then === 'function') {
      this._framesPromise = framesByLayer;
      this._loadingFrames = true;
      this.framesByLayer = null;
      this._framesPromise.then(res => { this.framesByLayer = res; this._loadingFrames = false; })
                         .catch(err => { console.error('Error framesByLayer:', err); this._loadingFrames = false; });
    } else {
      this.framesByLayer = framesByLayer ?? null;
    }

    // If frames not provided and we don't already have an async frames Promise,
    // allow framesKey in opts/preset to resolve frames from provided resources
    if (!this.framesByLayer && !this._framesPromise && opts && typeof opts.framesKey === 'string') {
      const fk = opts.framesKey;
      // prefer explicit resources first
      let candidate = (resources && resources[fk]) || null;
      // fallback to common global asset holders if available on window
      if (!candidate && typeof window !== 'undefined') {
        candidate = (window._tyemanAssets && window._tyemanAssets[fk]) || (window._sbluerAssets && window._sbluerAssets[fk]) || (window._fernandoAssets && window._fernandoAssets[fk]) || null;
      }
      if (candidate) this.framesByLayer = candidate;
    }

    // Apply per-type defaults (moved to actions module)
    applyProjectileTypeInit(this, opts, resources, framesByLayer);

    // overrides
    this.w = opts.w ?? this.w;
    this.h = opts.h ?? this.h;
    this.speed = opts.speed ?? this.speed;
    this.frameDelay = opts.frameDelay ?? this.frameDelay;

    // Apply common configurable fields from opts (merged presets) so callers
    // can declare behavior in PROJECTILE_TYPES or via spawn opts.
    const _opt = opts || {};
    const _tryNum = (v) => { const n = Number(v); return (!Number.isNaN(n)) ? n : null; };
    const g = _tryNum(_opt.gravity); if (g !== null) this.gravity = g;
    // allow initVy for parabolic projectiles
    const iv = _tryNum(_opt.initVy); if (iv !== null) this.vy = iv;
    // allow rotationSpeed override
    const rs = _tryNum(_opt.rotationSpeed); if (rs !== null) this.rotationSpeed = rs;
    // support a generic parabolic flag so types other than 1 can be parabolic
    this._parabolic = !!(_opt.parabolic);
    const d = _tryNum(_opt.duration); if (d !== null) { this.duration = d; this.lifespan = d; }
    const ls = _tryNum(_opt.lifespan); if (ls !== null) this.lifespan = ls;
    const mr = _tryNum(_opt.maxRange); if (mr !== null) this.maxRange = mr;
    const ss = _tryNum(_opt.spriteScale); if (ss !== null) this.spriteScale = ss;
    const us = _tryNum(_opt.upSpeed); if (us !== null) this.upSpeed = us;
    const ts = _tryNum(_opt.targetScale); if (ts !== null) this.targetScale = ts;
    const sd = _tryNum(_opt.spawnDelay); if (sd !== null) this.spawnDelay = sd;
    if (typeof _opt.persistent === 'boolean') this.persistent = _opt.persistent;
    // hook (bool) — e.g. bun/hook behaviour
    if (typeof _opt.hook === 'boolean') this.hook = _opt.hook;

    // string options: allow nesting under `stringOptions` or top-level keys for compatibility
    const so = (_opt.stringOptions && typeof _opt.stringOptions === 'object') ? _opt.stringOptions : _opt;
    const sW = _tryNum(so.stringW); if (sW !== null) this.stringW = sW;
    const sH = _tryNum(so.stringH); if (sH !== null) this.stringH = sH;
    const sFD = _tryNum(so.stringFrameDelay); if (sFD !== null) this.stringFrameDelay = sFD;

    // hitbox id override (useful to change the hitbox shape used by this projectile)
    if (typeof _opt.hitboxId !== 'undefined' && _opt.hitboxId !== null) this._hitboxId = _opt.hitboxId;

    // owner anchor offsets
    if (typeof _opt.offsetX === 'number') this.ownerOffsetX = _opt.offsetX;
    if (typeof _opt.offsetY === 'number') this.ownerOffsetY = _opt.offsetY;

    // expose attack/damage metadata from opts so main collision logic can apply damage
    this.attackType = (opts && typeof opts.attackType === 'string') ? opts.attackType : ((opts && opts.name && typeof opts.name === 'string') ? opts.name : null);
    this.damageQuarters = (opts && typeof opts.damageQuarters === 'number') ? opts.damageQuarters : ((opts && typeof opts.damage === 'number') ? opts.damage : null);
    // optionally carry charId for knockback/lookup tables
    this.charId = opts && opts.charId ? opts.charId : (this.charId || null);

    // allow per-projectile hitbox override via opts.hitbox = { offsetX, offsetY, w, h }
    this._hitboxOverride = (opts && typeof opts.hitbox === 'object') ? Object.assign({}, opts.hitbox) : null;

    // persistencia: si true, no se elimina al golpear a un rival
    this.persistent = !!opts.persistent || this.persistent;
    // evitar golpear repetidamente al mismo objetivo
    this._hitTargets = new Set();

    // animación
    // Ensure some numeric fields are concrete numbers and keep legacy behavior compatible
    const _num = (v, fallback) => (typeof v === 'number' && !Number.isNaN(v)) ? Number(v) : fallback;

    // map duration -> lifespan (legacy code checks `lifespan`) and prefer explicit lifespan
    if (typeof _opt.duration === 'number') {
      this.duration = Number(_opt.duration);
      this.lifespan = Number(_opt.duration);
    }
    if (typeof _opt.lifespan === 'number') this.lifespan = Number(_opt.lifespan);

    // numeric enforced overrides
    if (typeof _opt.maxRange === 'number') this.maxRange = Number(_opt.maxRange);
    if (typeof _opt.spriteScale === 'number') this.spriteScale = Number(_opt.spriteScale);

    // ensure w/h/speed are numeric (some callers may pass strings)
    this.w = _num(this.w, 0);
    this.h = _num(this.h, 0);
    this.speed = _num(this.speed, 0);

    // If caller passed w/h explicitly but didn't provide a hitbox object, create a hitbox override
    if (!this._hitboxOverride && ((opts && typeof opts.w !== 'undefined') || (opts && typeof opts.h !== 'undefined'))) {
      const def = PROJECTILE_HITBOXES[this.typeId] || PROJECTILE_HITBOXES.default;
      this._hitboxOverride = {
        offsetX: (typeof def.offsetX === 'number') ? def.offsetX : 0,
        offsetY: (typeof def.offsetY === 'number') ? def.offsetY : 0,
        w: this.w,
        h: this.h
      };
    }

    // optional lightweight debug when enabled globally
    if (typeof window !== 'undefined' && window.DEBUG_PROJECTILES) {
      try { console.log('[Projectile ctor]', { typeId: this.typeId, w: this.w, h: this.h, speed: this.speed, duration: this.duration, lifespan: this.lifespan, maxRange: this.maxRange, spriteScale: this.spriteScale }); } catch (e) {}
    }

    // extra debug for bun specifically (unconditional logging helpful while debugging)
    if (this.typeId === 5) {
      try {
        console.log('[Projectile ctor BUN]', {
          opts: opts,
          merged_w: this.w,
          merged_h: this.h,
          speed: this.speed,
          gravity: this.gravity,
          duration: this.duration,
          lifespan: this.lifespan,
          maxRange: this.maxRange,
          spriteScale: this.spriteScale,
          hitboxOverride: this._hitboxOverride
        });
      } catch (e) {}
    }

    this.frameIndex = 0;
    this._frameTimer = 0;
    this._finishedAnimation = false;
    // repel state (when hit by punch/kick)
    this._repelled = false;
    this.rotation = this.rotation || 0;
    this.rotationSpeed = this.rotationSpeed || 0;
    this.vy = this.vy || 0;
    this.gravity = this.gravity || 0;
  }

  update() {
    // movimiento
    const now = millis();
    const dt = Math.max(0, (this._lastUpdate ? (now - this._lastUpdate) : 16));
    this._lastUpdate = now;

    // advance age only when visible (respect spawnDelay semantics)
    if (this._visible !== false) {
      this.age = (this.age || 0) + dt;
    }

    // Scale animation: grow on spawn, shrink when animating removal
    if (typeof this._scale === 'number') {
      const sSpeed = (typeof this._scaleAnimSpeed === 'number') ? this._scaleAnimSpeed : 0.12;
      const step = sSpeed * (dt / 16);
      if (this._animatingRemoval) {
        this._scale = Math.max(0, this._scale - step);
        if (this._scale <= 0 && !this._readyToRemove) {
          this._readyToRemove = true;
        }
      } else {
        this._scale = Math.min((typeof this._scaleTarget === 'number' ? this._scaleTarget : 1), this._scale + step);
      }
    }

    // If we're in removal animation mode for spit_proj, force-play all sprite frames
    // once and freeze movement/rolling until the sequence finishes. This ensures the
    // projectile visibly animates through the full piskel when it dies by lifespan.
    if (this._animatingRemoval && this.typeId === 7 && this.framesByLayer && this.framesByLayer[0]?.length > 0) {
      if (!this._removalStarted) {
        this._removalStarted = true;
        this.frameIndex = 0;
        this._frameTimer = 0;
      }
      this._frameTimer++;
      if (this._frameTimer >= this.frameDelay) {
        this._frameTimer = 0;
        const n = this.framesByLayer[0].length;
        if (this.frameIndex < n - 1) {
          this.frameIndex++;
        } else {
          // reached last frame of death animation; mark ready for removal
          this._readyToRemove = true;
        }
      }
      // while animating removal, ensure it doesn't move/roll
      this._currentRollSpeed = 0;
      this._rolling = false;
      // allow scale shrink processing above to continue, but skip further movement/physics
      return;
    }

    // repelled behaviour: spin and fall to ground
    if (this._repelled) {
      const moveAmount = (this.speed || 6) * (dt / 16);
      this.x += moveAmount * this.dir;
      this.vy = (this.vy || 0) + (this.gravity || 0.45) * (dt / 16);
      this.y += this.vy;
      this.rotation = (this.rotation || 0) + (this.rotationSpeed || 0) * (dt / 16);
      // ground contact: compute opacity as approaches ground and remove on touch
      const groundY = (typeof height === 'number') ? (height - (this.h || 16)) : 0;
      const startY = (typeof this._repelStartY === 'number') ? this._repelStartY : (this.y - 1);
      const totalFall = Math.max(1, groundY - startY);
      const distFromGround = Math.max(0, groundY - this.y);
      const ratio = Math.max(0, Math.min(1, distFromGround / totalFall));
      // alpha goes from ~60 (near ground) up to 255 (high above)
      this.alpha = Math.round(60 + (195 * ratio));
      if (this.y >= groundY) {
        this.y = groundY;
        this.toRemove = true;
      }
      // anim loop if frames exist
      if (this.framesByLayer && this.framesByLayer[0]?.length > 0) {
        this._frameTimer++;
        if (this._frameTimer >= this.frameDelay) {
          this._frameTimer = 0;
          const n = this.framesByLayer[0].length;
          this.frameIndex = (this.frameIndex + 1) % n;
        }
      }
      return;
    }

    // parabólico (hadouken and any projectile with _parabolic flag)
    if (this._parabolic) {
      // parabólico
      this.x += this.speed * this.dir;
      this.y += this.vy;
      this.vy += this.gravity;

      // rotación
      this.rotation += this.rotationSpeed;

      // special handling for spit_proj: land at fighter-feet level and start rolling
      if (this.typeId === 7 && !this._rolling) {
        const groundY = (this._spitGroundY !== null && typeof this._spitGroundY !== 'undefined') ? this._spitGroundY : ((typeof height === 'number') ? (height - (this.h || 6)) : (height - (this.h || 6)));
        if ((this.y + this.h) >= groundY) {
          this.y = groundY - this.h;
          this._rolling = true;
          this.vy = 0;
          this.gravity = 0;
          this._currentRollSpeed = (typeof this._rollSpeed === 'number') ? this._rollSpeed : Math.max(1, (this.speed || 4) * 0.4);
          // reduce rotation to rolling speed
          this.rotationSpeed = Math.max(4, Math.abs(this.rotationSpeed || 8));
        }
      }
      // Advance animation frames for parabolic projectiles.
      // For spit_proj (typeId 7) we want a looping animation so each projectile
      // shows all frames; for other parabolic types (e.g., hadouken) preserve
      // the previous behaviour of stopping on the last frame.
      if (this.framesByLayer && this.framesByLayer[0]?.length > 0) {
        this._frameTimer++;
        if (this._frameTimer >= this.frameDelay) {
          this._frameTimer = 0;
          const n = this.framesByLayer[0].length;
          if (this.typeId === 7) {
            this.frameIndex = (this.frameIndex + 1) % n;
          } else if (!this._finishedAnimation) {
            this.frameIndex++;
            if (this.frameIndex >= n - 1) {
              this.frameIndex = n - 1; // último frame fijo
              this._finishedAnimation = true;
            }
          }
        }
      }
    } else {
      // spawn delay handling para proyectiles que esperan antes de aparecer
      if (this.spawnDelay && !this._visible) {
        this._spawnTimer += dt;
        if (this._spawnTimer >= this.spawnDelay) {
          this._visible = true;
          this.age = 0;
        } else {
          // aún en delay: no avanzar nada
          return;
        }
      }

      if (this.typeId === 4) {
        // efecto: crecer y subir lentamente, desvanecerse, usando dt real
        this.age = (this.age || 0) + dt;
        const t = Math.min(1, this.age / (this.duration || 1200));
        // easing out para growth
        const ease = 1 - Math.pow(1 - t, 2);
        this.scaleY = lerp(1, this.targetScale || 1.8, ease);
        this.alpha = Math.round(255 * (1 - t));
        // mover hacia arriba proporcional a dt (upSpeed es px per frame baseline)
        this.y -= (this.upSpeed || 0.9) * (dt / 16);
        // pequeño jitter horizontal para efecto 'llama' (opcional, suave)
        this.x += Math.sin(this.age / 120) * 0.18;
        if (t >= 1) this.toRemove = true;

        // --- AVANZAR ANIMACIÓN DE FRAMES ---
        if (this.framesByLayer && this.framesByLayer[0]?.length > 0) {
          this._frameTimer++;
          // Avanza lentamente: usa toda la duración del proyectil para recorrer todos los frames
          const n = this.framesByLayer[0].length;
          // Frame actual según el progreso de vida (t)
          this.frameIndex = Math.floor(t * (n - 1));
          // Si quieres que la animación sea un loop, usa esto en vez de la línea anterior:
          // this.frameIndex = Math.floor((this.age / this.frameDelay) % n);
        }
      } else if (this.typeId === 5) {
        // BUN behaviour: move outwards until maxRange or collision sets returning
        const moveAmount = (this.speed || 6) * (dt / 16);
        if (!this.returning) {
            this.x += moveAmount * this.dir;
            // si excede maxRange, comenzar retorno
            if (Math.abs(this.x - (this._startX || 0)) >= this.maxRange) {
              this.returning = true;
              this.dir = -this.dir;
            } else {
              // si alcanza el borde del escenario sin haber golpeado, iniciar retorno
              const margin = 4;
              const leftEdge = 0 + margin;
              const rightEdge = (typeof width === 'number') ? (width - margin) : 800;
              if ((this.dir === 1 && this.x >= rightEdge) || (this.dir === -1 && this.x <= leftEdge)) {
                this.returning = true;
                this.dir = -this.dir;
              }
            }
            // apply vertical physics if configured
            if (typeof this.gravity === 'number' && this.gravity !== 0) {
              this.vy = (this.vy || 0) + (this.gravity) * (dt / 16);
              this.y += this.vy * (dt / 16);
            }
        } else {
          // regreso hacia ownerRef si existe
          if (this._ownerRef && !this._ownerRef.toRemove) {
            const ownerCenter = this._ownerRef.x + this._ownerRef.w / 2;
            // mover hacia ownerCenter con smoothing
            const dx = ownerCenter - this.x;
            const step = Math.sign(dx) * Math.min(Math.abs(dx), moveAmount * 1.6);
            this.x += step;
            // si está lo bastante cerca, marcar para remover
            if (Math.abs(dx) <= 8) this.toRemove = true;
          } else {
            // fallback: mover por dir como antes y eliminar si offscreen
            this.x += moveAmount * this.dir;
          }
          // apply vertical physics during return as well
          if (typeof this.gravity === 'number' && this.gravity !== 0) {
            this.vy = (this.vy || 0) + (this.gravity) * (dt / 16);
            this.y += this.vy * (dt / 16);
          }
        }

        // animación loop normal si hay frames
        if (this.framesByLayer && this.framesByLayer[0]?.length > 0) {
          this._frameTimer++;
          if (this._frameTimer >= this.frameDelay) {
            this._frameTimer = 0;
            const n = this.framesByLayer[0].length;
            this.frameIndex = (this.frameIndex + 1) % n;
          }
        }

        // actualizar animación de la cuerda de forma independiente (si tiene frames)
        if (this.stringFramesByLayer && this.stringFramesByLayer[0]?.length > 0) {
          this._stringFrameTimer++;
          if (this._stringFrameTimer >= (this.stringFrameDelay || 6)) {
            this._stringFrameTimer = 0;
            const n2 = this.stringFramesByLayer[0].length;
            this._stringFrameIndex = (this._stringFrameIndex + 1) % n2;
          }
        }
      } else {
        // special linear-stretch projectile (thin laser)
        if (this.typeId === 8) {
          // ensure origin persists
          this._originX = (typeof this._originX === 'number') ? this._originX : this.x;
          this._originY = (typeof this._originY === 'number') ? this._originY : this.y;
          // initialize beam length if missing
          if (typeof this._beamLength !== 'number') this._beamLength = Math.max(1, this.w || 6);
          // growth per frame (respect dt)
          const growSpeed = (typeof this._expandSpeed === 'number') ? this._expandSpeed : 12;
          const inc = growSpeed * (dt / 16);
          this._beamLength = Math.min((typeof this._maxLength === 'number' ? this._maxLength : 120), this._beamLength + inc);
          // sync public width so display() uses it
          this.w = Math.max(1, Math.round(this._beamLength));

          // anchor drawing at origin; for left-facing beams shift x so image grows left
          this.x = this._originX + (this.dir === -1 ? -this.w : 0);
          this.y = this._originY;

          // NOTE: do not force a permanent _hitboxOverride here.
          // The base hitbox for type 8 is defined in entities/projectiles/hitboxes.js
          // and `getHitbox()` will expand that base hitbox dynamically according
          // to `this.w` so we avoid clobbering _hitboxOverride here.

          // advance animation frames if frames available
          if (this.framesByLayer && this.framesByLayer[0]?.length > 0) {
            this._frameTimer++;
            if (this._frameTimer >= this.frameDelay) {
              this._frameTimer = 0;
              const n = this.framesByLayer[0].length;
              this.frameIndex = (this.frameIndex + 1) % n;
            }
          }
          // don't perform normal linear movement for this type
        } else {
          // normal lineal
          this.x += this.speed * this.dir;
          // anim loop...
          if (this.framesByLayer && this.framesByLayer[0]?.length > 0) {
            this._frameTimer++;
            if (this._frameTimer >= this.frameDelay) {
              this._frameTimer = 0;
              const n = this.framesByLayer[0].length;
              this.frameIndex = (this.frameIndex + 1) % n;
            }
          }
        }
      }
    }
    // Rolling behaviour for spit_proj (grounded small ball)
    if (this._rolling) {
      // While rolling, animate frames (loop) so spit_proj appears animated while rolling.
      if (this.framesByLayer && this.framesByLayer[0]?.length > 0) {
        this._frameTimer++;
        if (this._frameTimer >= this.frameDelay) {
          this._frameTimer = 0;
          const n = this.framesByLayer[0].length;
          this.frameIndex = (this.frameIndex + 1) % n;
        }
      }
      const curRollSpeed = (typeof this._currentRollSpeed === 'number') ? this._currentRollSpeed : ((typeof this._rollSpeed === 'number') ? this._rollSpeed : (this.speed || 1));
      const moveAmount = curRollSpeed * (dt / 16);
      if (curRollSpeed > 0) {
        this.x += moveAmount * this.dir;
        this.rotation += this.rotationSpeed * (dt / 16);
      }
      // bounce at screen edges
      const margin = 4;
      const leftEdge = 0 + margin;
      const rightEdge = (typeof width === 'number') ? (width - margin) : 800 - margin;
      if ((this.dir === 1 && this.x >= rightEdge) || (this.dir === -1 && this.x <= leftEdge)) {
        this.dir = -this.dir;
      }
      // apply floor brake (deceleration) to current roll speed
      if (typeof this._floorBrake === 'number' && this._floorBrake > 0) {
        const dec = this._floorBrake * (dt / 16);
        const prev = (typeof this._currentRollSpeed === 'number') ? this._currentRollSpeed : curRollSpeed;
        this._currentRollSpeed = Math.max(0, prev - dec);
      }
      // touch/merge detection: when two spit_proj overlap they fuse into one
      if (this.typeId === 7 && !this._touched) {
        try {
          const pool = (typeof window !== 'undefined' && Array.isArray(window.projectiles)) ? window.projectiles : [];
          const a = this.getHitbox();
          for (const o of pool) {
            if (!o || o === this) continue;
            // only fuse spit_proj with same owner
            if (o.typeId !== 7 || o.ownerId !== this.ownerId) continue;
            if (o._animatingRemoval || o.toRemove) continue;
            const b = (typeof o.getHitbox === 'function') ? o.getHitbox() : null;
            if (!b) continue;
            if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
              // choose survivor: prefer older projectile (larger age). If equal, prefer this.
              const survivor = ((this.age || 0) >= (o.age || 0)) ? this : o;
              const victim = (survivor === this) ? o : this;
              try {
                // mark victim for removal (will trigger animating removal via main loop)
                // transfer stack count to survivor so it represents merged projectiles
                const victimCount = (typeof victim._stackCount === 'number') ? victim._stackCount : 1;
                survivor._stackCount = (typeof survivor._stackCount === 'number') ? survivor._stackCount : 1;
                survivor._stackCount += victimCount;
                victim.toRemove = true;
                victim._currentRollSpeed = 0;
                victim._rolling = false;
                // enhance survivor: grow visually and enlarge hitbox
                const touchScale = survivor._touchScale || 1.6;
                const hitboxScale = survivor._touchHitboxScale || survivor._touchScale || 1.6;
                const slowFactor = survivor._touchSlowFactor || 0.5;
                survivor._scaleTarget = (survivor._scaleTarget || 1) * touchScale;
                survivor._hitboxScale = (survivor._hitboxScale || 1) * hitboxScale;
                // slow survivor's rolling speed
                if (typeof survivor._currentRollSpeed === 'number') survivor._currentRollSpeed = survivor._currentRollSpeed * slowFactor;
                if (typeof survivor._rollSpeed === 'number') survivor._rollSpeed = survivor._rollSpeed * slowFactor;
                survivor._touched = true;
              } catch (e) {}
              break; // only handle one fusion per update for this projectile
            }
          }
        } catch (e) {}
      }
      // ensure that when speed is zero the projectile no longer moves or rotates
      if (typeof this._currentRollSpeed === 'number' && this._currentRollSpeed <= 0) {
        this._currentRollSpeed = 0;
      }
    }
    // lifespan-based removal (unless persistent)
    if (this.lifespan && (this.age >= this.lifespan) && !this.persistent) {
      this.toRemove = true;
    }
  }

  display() {
    const framesByLayer = this.framesByLayer;
    if (framesByLayer && framesByLayer[0]?.length > 0) {
      push();

      // compute visual draw size (allow bun-specific scaling)
      const isBun = (this.typeId === 5);
      const drawW = isBun ? (this.w * (this.spriteScale || 1)) : this.w;
      const drawH = isBun ? (this.h * (this.spriteScale || 1)) : this.h;
      const _visualScale = (typeof this._scale === 'number') ? this._scale : 1;
      const drawWScaled = Math.max(0.5, drawW * _visualScale);
      const drawHScaled = Math.max(0.5, drawH * _visualScale);

      // draw string for bun (between owner and projectile) — skip if repelido
      if (this.typeId === 5 && !this._repelled && this._ownerRef && this.stringFramesByLayer && this.stringFramesByLayer.length > 0) {
        try {
          // select an image frame for the string (its own index)
          const img = (this.stringFramesByLayer[0] && this.stringFramesByLayer[0][this._stringFrameIndex]) || this.stringFramesByLayer[0][0];
           if (img) {
             // draw repeated/tiled or scaled segment between points
             // si se configuró ownerOffsetX/Y, usar esos offsets relativos a owner.x/owner.y
             const ox = (typeof this.ownerOffsetX === 'number')
               ? (this._ownerRef.x + this.ownerOffsetX)
               : (this._ownerRef.x + this._ownerRef.w / 2);
             const oy = (typeof this.ownerOffsetY === 'number')
               ? (this._ownerRef.y + this.ownerOffsetY)
               : (this._ownerRef.y + this._ownerRef.h / 2 - 6);
             // Apuntar al centro visual del bun (usar drawW/drawH evita que la cuerda quede corta)
             const tx = this.x + drawW / 2;
             const ty = this.y + drawH / 2;
             const dx = tx - ox;
             const dy = ty - oy;
             const dist = Math.max(4, Math.sqrt(dx*dx + dy*dy));
             // rotate so the string follows the exact inclination
             const ang = Math.atan2(dy, dx);
            push();
            translate(ox, oy);
            rotate(ang);
            // use configured tile size (stringW/stringH) and tile along distance
            const sFrameCount = (this.stringFramesByLayer[0]?.length) || 1;
            const sFrameW = Math.max(1, Math.floor(img.width / sFrameCount));
            // desired tile size in world pixels (from opts) or fallback to source frame size
            const tileW = (typeof this.stringW === 'number' && this.stringW > 0) ? this.stringW : sFrameW;
            const tileH = (typeof this.stringH === 'number' && this.stringH > 0) ? this.stringH : img.height;
            // choose an overlap factor <1 so tiles slightly overlap and avoid gaps; adjust if needed
            const overlapFactor = 0.92;
            const tiles = Math.max(1, Math.ceil(dist / (tileW * overlapFactor)));
            // recompute step so tiles exactly span the distance (ensures no tiny gap at the end)
            const step = dist / tiles;
            // draw tiles from owner (0) to target (dist)
            for (let i = 0; i < tiles; i++) {
              const tX = i * step - (tileW / 2);
              image(img, tX, -tileH / 2, tileW, tileH, 0, 0, sFrameW, img.height);
            }
            // dibujar un "cap" final alineado al extremo para eliminar posible gap residual
            const lastTileRightEdge = ((tiles - 1) * step) + (tileW / 2);
            if (lastTileRightEdge < dist - 0.5) {
              const capX = dist - (tileW / 2);
              image(img, capX, -tileH / 2, tileW, tileH, 0, 0, sFrameW, img.height);
            }
            pop();
           }
         } catch (e) { /* silent */ }
       }

      // aplicar flip horizontal si dir=-1 (solo para la sprite del bun)
      if (isBun && this.dir === -1) {
        // use drawW as anchor so flipped visual centers correctly when scaled
        translate(this.x + drawW / 2, this.y);
        scale(-1, 1);
        translate(-(this.x + drawW / 2), -this.y);
      }

      // apply rotation when repelido or existing rotation cases
      if (this._repelled) {
        translate(this.x + (this.w||drawW) / 2, this.y + (this.h||drawH) / 2);
        rotate(radians(this.rotation || 0));
        translate(-(this.x + (this.w||drawW) / 2), -(this.y + (this.h||drawH) / 2));
      } else if (this.typeId === 1) {
        translate(this.x + this.w / 2, this.y + this.h / 2);
        rotate(radians(this.rotation));
        translate(-(this.x + this.w / 2), -(this.y + this.h / 2));
      } else if (this.typeId === 4) {
        // escalar verticalmente desde la base (mantener anclaje en la base del sprite)
        const sy = this.scaleY || 1;
        // trasladar a la esquina superior para escalar desde arriba -> queremos crecer hacia arriba,
        // así que mover el origen a (x, y + h) y escalar en Y hacia arriba (flip Y)
        translate(this.x, this.y + this.h);
        scale(1, -sy);
        translate(-this.x, -(this.y + this.h));
      }

      for (let i = 1; i < framesByLayer.length; i++) {
        const layerFrames = framesByLayer[i];
        if (!layerFrames) continue;
        const img = layerFrames[this.frameIndex];
        if (!img) continue;
        const frameCount = framesByLayer[0].length || 1;
        const frameWidth = img.width / frameCount;
        // aplicar alpha para typeId 4
        if (this._repelled) {
          tint(255, (typeof this.alpha === 'number') ? this.alpha : 255);
        } else if (this.typeId === 4) {
          tint(255, this.alpha || 255);
        }

        image(
          img,
          this.x, this.y,
          drawWScaled, drawHScaled,
          frameWidth * this.frameIndex, 0,
          frameWidth, img.height
        );
      }
      pop();
    } else if (this._loadingFrames) {
      // frames are loading asynchronously: draw nothing (avoid default placeholder)
      return;
    } else {
      // fallback círculo
      push();
      noStroke();
      fill(255, 200, 0);
      ellipse(this.x, this.y - 8, this.w);
      pop();
    }
  }

  getHitbox() {
    const hitboxIdToUse = (typeof this._hitboxId !== 'undefined' && this._hitboxId !== null) ? this._hitboxId : this.typeId;
    // Special-case thin laser (id 8): anchor at the stored origin and expand
    // its width to match the visual `this.w`. Use origin so the emitter doesn't
    // move the hitbox as the owner moves.
    if (this.typeId === 8) {
      const base = PROJECTILE_HITBOXES[8] || PROJECTILE_HITBOXES[hitboxIdToUse] || PROJECTILE_HITBOXES.default;
      const anchorX = (typeof this._originX === 'number') ? this._originX : this.x;
      const anchorY = (typeof this._originY === 'number') ? this._originY : this.y;
      const desiredW = Math.max(0, Math.round(this.w || base.w || 0));
      const w = Math.max(base.w || 0, desiredW);
      const h = base.h || 0;
      const ox = (typeof base.offsetX === 'number') ? base.offsetX : 0;
      const oy = (typeof base.offsetY === 'number') ? base.offsetY : 0;
      // For right-facing beams, origin is the left edge; for left-facing, shift so the
      // hitbox extends leftwards from the origin.
      const x = (this.dir === 1) ? (anchorX + ox) : (anchorX + ox - w);
      const y = anchorY + oy;
      return { x, y, w, h };
    }

    const def = this._hitboxOverride || PROJECTILE_HITBOXES[hitboxIdToUse] || PROJECTILE_HITBOXES[this.typeId] || PROJECTILE_HITBOXES.default;
    // allow per-instance hitbox scaling (used when spit_proj touch each other)
    const scale = (typeof this._hitboxScale === 'number') ? this._hitboxScale : 1;
    const baseW = (def.w || 0);
    const baseH = (def.h || 0);
    const scaledW = Math.max(0, Math.round(baseW * scale));
    const scaledH = Math.max(0, Math.round(baseH * scale));
    // keep hitbox roughly centered by adjusting offsets for the increased size
    const extraW = scaledW - baseW;
    const extraH = scaledH - baseH;
    const offsetX = (def.offsetX || 0) - Math.round(extraW / 2);
    const offsetY = (def.offsetY || 0) - Math.round(extraH / 2);
    return {
      x: this.x + offsetX,
      y: this.y + offsetY,
      w: scaledW,
      h: scaledH
    };
  }

  hits(fighter) {
    // special-case: if this is a stapler projectile and the fighter
    // just dashed recently, treat as non-colliding (allow pass-through)
    try {
      const DASH_GRACE_MS = 230;
      if (this.attackType === 'stapler' && fighter && typeof fighter.lastDashTime === 'number') {
        if ((millis() - fighter.lastDashTime) <= DASH_GRACE_MS) return false;
      }
    } catch (e) { /* ignore timing errors and continue to hit test */ }

    const hb = this.getHitbox();
    const f = fighter.getCurrentHitbox();
    return (
      hb.x < f.x + f.w &&
      hb.x + hb.w > f.x &&
      hb.y < f.y + f.h &&
      hb.y + hb.h > f.y
    );
  }

  offscreen() {
    return (this.x + this.w < 0) || (this.x - this.w > width) || (this.y > height);
  }
}

// Projectile hitboxes and runtime API moved to ./projectiles/hitboxes.js

// --- NEW: easy-to-use projectile type registry ---
// Central place to register reusable projectile parameter presets. Each preset
// should include both visual/size defaults and behavior flags so the factory
// can produce coherent projectiles without scattering hardcoded values.


// Projectile type registry moved to ./projectiles/types.js

// Convenience factory: create a Projectile using a registered type (id or name)
export function spawnProjectileFromType(typeIdOrName, x, y, dir, ownerId = null, resources = {}, opts = {}, framesByLayer = null) {
  const typeId = findTypeId(typeIdOrName) || typeIdOrName;
  const type = getProjectileType(typeId);
  // merge type defaults with opts (opts wins)
  const mergedOpts = Object.assign({}, type, opts);
  // pass numeric id to constructor when possible to preserve existing per-type switch behaviour
  const numericTypeId = (typeof typeId === 'number') ? typeId : (type.id || type.name || 0);
  // Resolve frames source for the projectile. Priority rules:
  // 1) If mergedOpts.framesKey maps to a registered FRAMEKEY_MAP entry, use that (overrides character assets)
  // 2) Otherwise, prefer explicit framesByLayer argument
  // 3) Otherwise, try resources[framesKey]
  // 4) Fallback: null
  let fb = null;
  const fk = (mergedOpts && typeof mergedOpts.framesKey === 'string') ? mergedOpts.framesKey : null;
  if (fk && FRAMEKEY_MAP[fk]) {
    // explicit mapping exists: load that piskel (returns Promise)
    try { fb = loadProjectileFramesKey(fk); } catch (e) { fb = null; }
  }
  // if no explicit mapping chosen, prefer provided framesByLayer (call-site assets)
  if (!fb) fb = framesByLayer || null;
  // if still no frames and a framesKey exists, try resources lookup
  if (!fb && fk) fb = (resources && resources[fk]) || null;

  const p = new Projectile(x, y, dir, numericTypeId, ownerId, resources, mergedOpts, fb);
  return p;
}

export { PROJECTILE_TYPES };

export { Projectile, PROJECTILE_HITBOXES };
