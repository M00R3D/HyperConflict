// entities/projectile.js

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

    // resources may include string frames for bun
    this._resources = resources || {};
    this.stringFramesByLayer = this._resources.string || null;

    // Si framesByLayer es Promise
    this._framesPromise = null;
    if (framesByLayer && typeof framesByLayer.then === 'function') {
      this._framesPromise = framesByLayer;
      this.framesByLayer = [];
      this._framesPromise.then(res => { this.framesByLayer = res; })
                         .catch(err => { console.error('Error framesByLayer:', err); });
    } else {
      this.framesByLayer = framesByLayer ?? null;
    }

    // Config por ID
    switch (this.typeId) {
      case 1: // parabólico hadouken
        this.framesByLayer = this.framesByLayer ?? resources.projectile ?? null;
        this.x = this.x-33;
        this.y = this.y+10;
        this.w = 48;
        this.h = 32;
        this.speed = 3;
        this.vy = -5;      // impulso inicial hacia arriba
        this.gravity = 0.3; // gravedad
        this.rotation = 0;  // ángulo de rotación
        this.rotationSpeed = 15; // grados por frame
        break;

      case 2: // fireball
        this.framesByLayer = this.framesByLayer ?? resources.fireball ?? null;
        this.w = 32;
        this.h = 32;
        this.speed = 10;
        break;

      case 3: // shuriken
        this.framesByLayer = this.framesByLayer ?? resources.shuriken ?? null;
        this.w = 24;
        this.h = 24;
        this.speed = 12;
        break;

      case 4: // "tats" special: crece hacia arriba y se desvanece (no se desplaza horizontal fuerte)
        this.framesByLayer = this.framesByLayer ?? resources.tats ?? framesByLayer ?? null;
        this.w = opts.w ?? 20;
        this.h = opts.h ?? 28;
        this.duration = opts.duration ?? 1200; // ms (más largo por defecto)
        this.age = 0;
        this.alpha = 255;
        // upSpeed interpretado originalmente como px por "frame"; lo reusamos pero ahora escalado por dt
        this.upSpeed = (typeof opts.upSpeed === 'number') ? opts.upSpeed : 0.9;
        // scale target final (por defecto crecer ~1.8x -> 2.4x para efecto fuego)
        this.targetScale = opts.targetScale ?? 2.4;
        // delay antes de aparecer (ms)
        this.spawnDelay = opts.spawnDelay ?? 0;
        this._spawnTimer = 0;
        this._visible = (this.spawnDelay <= 0);
        // mantener posición x relativa (no velocidad horizontal), pero respetar dir para spawn
        this.speed = 0;
        break;

      case 5: // BUN: va hacia fuera, al chocar o alcanzar rango regresa al owner; tiene string
        this.framesByLayer = this.framesByLayer ?? this._resources.bun ?? this.framesByLayer ?? null;
        // logical bun size (collision/position)
        this.w = opts.w ?? 7;
        this.h = opts.h ?? 4;
        this.speed = opts.speed ?? 8;
        this.duration = opts.duration ?? 2000;
        this.spawnDelay = opts.spawnDelay ?? 0;
        this._spawnTimer = 0;
        this._visible = (this.spawnDelay <= 0);
        this.maxRange = opts.maxRange ?? 320;
        this._startX = this.x;
        this.returning = false;
        this.toRemove = false;
        this.persistent = !!opts.persistent;
        // visual scaling for the bun sprite (separate from logical w/h)
        this.spriteScale = (typeof opts.spriteScale === 'number') ? opts.spriteScale : 1;
        // string visual params: allow explicit width/height and frame timing
        this.stringW = (typeof opts.stringW === 'number') ? opts.stringW : (6 * (this.stringScale || 1));
        this.stringH = (typeof opts.stringH === 'number') ? opts.stringH : (8 * (this.stringScale || 1));
        this.stringFrameDelay = (typeof opts.stringFrameDelay === 'number') ? opts.stringFrameDelay : (opts.frameDelay ?? 6);
        // animation state for string (independent index/timer)
        this._stringFrameIndex = 0;
        this._stringFrameTimer = 0;
        // owner anchor offsets (si opts proporciona offsetX/offsetY se usan para calcular el punto de origen de la cuerda)
        this.ownerOffsetX = (typeof opts.offsetX === 'number') ? opts.offsetX : null;
        this.ownerOffsetY = (typeof opts.offsetY === 'number') ? opts.offsetY : null;
        break;

      default:
        this.framesByLayer = this.framesByLayer ?? null;
        this.w = 16;
        this.h = 16;
        this.speed = 6;
    }

    // overrides
    this.w = opts.w ?? this.w;
    this.h = opts.h ?? this.h;
    this.speed = opts.speed ?? this.speed;
    this.frameDelay = opts.frameDelay ?? this.frameDelay;

    // persistencia: si true, no se elimina al golpear a un rival
    this.persistent = !!opts.persistent || this.persistent;
    // evitar golpear repetidamente al mismo objetivo
    this._hitTargets = new Set();

    // animación
    this.frameIndex = 0;
    this._frameTimer = 0;
    this._finishedAnimation = false;
  }

  update() {
    // movimiento
    const now = millis();
    const dt = Math.max(0, (this._lastUpdate ? (now - this._lastUpdate) : 16));
    this._lastUpdate = now;

    // hadouken parabólico
    if (this.typeId === 1) {
      // parabólico
      this.x += this.speed * this.dir;
      this.y += this.vy;
      this.vy += this.gravity;

      // rotación
      this.rotation += this.rotationSpeed;

      // animación que se detiene en último frame
      if (this.framesByLayer && this.framesByLayer[0]?.length > 0 && !this._finishedAnimation) {
        this._frameTimer++;
        if (this._frameTimer >= this.frameDelay) {
          this._frameTimer = 0;
          this.frameIndex++;
          if (this.frameIndex >= this.framesByLayer[0].length - 1) {
            this.frameIndex = this.framesByLayer[0].length - 1; // último frame fijo
            this._finishedAnimation = true;
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

  display() {
    const framesByLayer = this.framesByLayer;
    if (framesByLayer && framesByLayer[0]?.length > 0) {
      push();

      // compute visual draw size (allow bun-specific scaling)
      const isBun = (this.typeId === 5);
      const drawW = isBun ? (this.w * (this.spriteScale || 1)) : this.w;
      const drawH = isBun ? (this.h * (this.spriteScale || 1)) : this.h;

      // draw string for bun (between owner and projectile)
      if (this.typeId === 5 && this._ownerRef && this.stringFramesByLayer && this.stringFramesByLayer.length > 0) {
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

      // rotación/scale cases (existing)
      if (this.typeId === 1) {
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
        if (this.typeId === 4) {
          tint(255, this.alpha || 255);
        }

        image(
          img,
          this.x, this.y,
          drawW, drawH,
          frameWidth * this.frameIndex, 0,
          frameWidth, img.height
        );
      }
      pop();
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
    const def = PROJECTILE_HITBOXES[this.typeId] || PROJECTILE_HITBOXES.default;
    return {
      x: this.x + def.offsetX,
      y: this.y + def.offsetY,
      w: def.w,
      h: def.h
    };
  }

  hits(fighter) {
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

// Hitboxes por tipo de proyectil (puedes modificar aquí)
const PROJECTILE_HITBOXES = {
  1: { offsetX: 2, offsetY: -6, w: 34, h: 32 },   // hadouken parabólico
  2: { offsetX: -16, offsetY: -16, w: 32, h: 32 },   // fireball
  3: { offsetX: -12, offsetY: -12, w: 24, h: 24 },   // shuriken
  4: { offsetX: -10, offsetY: -18, w: 20, h: 36 },   // tats barrera
  5: { offsetX: 1, offsetY: 0,  w: 18, h: 6  },    // bun
  // default para otros tipos
  default: { offsetX: -8, offsetY: -8, w: 16, h: 16 }
};

export { Projectile, PROJECTILE_HITBOXES };
