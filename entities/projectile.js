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
    this.persistent = !!opts.persistent;
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
          // reset age para que la animación/comportamiento empiece al aparecer
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
      } else {
        // normal lineal
        this.x += this.speed * this.dir;
      }

      // animación loop normal
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

  display() {
    const framesByLayer = this.framesByLayer;
    if (framesByLayer && framesByLayer[0]?.length > 0) {
      push();

      // aplicar flip horizontal si dir=-1
      if (this.dir === -1) {
        translate(this.x + this.w / 2, this.y);
        scale(-1, 1);
        translate(-(this.x + this.w / 2), -this.y);
      }

      // rotación solo en typeId=1
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
          this.w, this.h,
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
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
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

export { Projectile };
