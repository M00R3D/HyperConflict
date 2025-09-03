// entities/projectile.js
class Projectile {
  /**
   * @param {number} x - posición inicial
   * @param {number} y - posición inicial
   * @param {number} dir - 1 = derecha, -1 = izquierda
   * @param {string} ownerId - id del que dispara (opcional)
   * @param {Array} framesByLayer - capas de frames exportadas por loadPiskel (opcional)
   * @param {Object} opts - opciones { w, h, speed, frameDelay }
   */
  constructor(x, y, dir, ownerId = null, framesByLayer = null, opts = {}) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.ownerId = ownerId;

    // físicas / tamaño
    this.speed = opts.speed ?? 6;
    this.w = opts.w ?? 16; // ancho de dibujado
    this.h = opts.h ?? 16; // alto de dibujado (ajusta según tu sprite)
    this.size = Math.max(this.w, this.h);

    // animación (si se le pasan frames)
    this.framesByLayer = framesByLayer; // mismo formato que usa Fighter
    this.frameIndex = 0;
    this.frameDelay = opts.frameDelay ?? 6;
    this._frameTimer = 0;
  }

  update() {
    // movimiento
    this.x += this.speed * this.dir;

    // animación simple por frames
    if (this.framesByLayer && this.framesByLayer.length > 0 && this.framesByLayer[0]?.length > 0) {
      this._frameTimer++;
      if (this._frameTimer >= this.frameDelay) {
        this._frameTimer = 0;
        // cantidad de frames según layer 0
        const n = this.framesByLayer[0].length;
        this.frameIndex = (this.frameIndex + 1) % n;
      }
    }
  }

  display() {
    // si tiene sprites, dibujarlos con la misma lógica que Fighter
    const framesByLayer = this.framesByLayer;
    if (framesByLayer && framesByLayer.length > 0 && framesByLayer[0]?.length > 0) {
      push();
      // voltear si va hacia la izquierda
      if (this.dir === -1) {
        translate(this.x + this.w / 2, 0);
        scale(-1, 1);
        translate(-(this.x + this.w / 2), 0);
      }

      // muchas de tus animaciones usan layer[0] para contar frames,
      // y luego dibujas las capas desde 1..n (mimic Fighter)
      for (let i = 1; i < framesByLayer.length; i++) {
        const layerFrames = framesByLayer[i];
        if (!layerFrames) continue;
        const img = layerFrames[this.frameIndex];
        if (!img) continue;

        const frameCount = framesByLayer[0].length || 1;
        const frameWidth = img.width / frameCount;

        // image(img, dx, dy, dWidth, dHeight, sx, sy, sWidth, sHeight)
        image(
          img,
          this.x,
          this.y,
          this.w,
          this.h,
          frameWidth * this.frameIndex, 0,
          frameWidth, img.height
        );
      }
      pop();
    } else {
      // fallback: círculo/rectángulo simple
      push();
      noStroke();
      fill(255, 200, 0);
      ellipse(this.x, this.y - 8, this.size);
      pop();
    }

    // debug hitbox (opcional)
    // noFill(); stroke(0,255,0); strokeWeight(1);
    // const hb = this.getHitbox(); rect(hb.x, hb.y, hb.w, hb.h);
  }

  // hitbox para colisiones (ajusta offsets si tu sprite necesita)
  getHitbox() {
    return {
      x: this.x - this.w / 2,
      y: this.y - this.h / 2,
      w: this.w,
      h: this.h
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
    return (this.x + this.w < 0) || (this.x - this.w > width);
  }
}

export { Projectile };
