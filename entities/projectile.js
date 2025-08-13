class Projectile {
  constructor(x, y, dir) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.speed = 6;
    this.size = 8;
  }

  update() {
    this.x += this.speed * this.dir;
  }

  display() {
    fill(255, 200, 0);
    noStroke();
    ellipse(this.x, this.y - 20, this.size);
  }

  hits(fighter) {
    return (
      this.x > fighter.x - 15 &&
      this.x < fighter.x + 15 &&
      this.y > fighter.y - 40 &&
      this.y < fighter.y
    );
  }

  offscreen() {
    return this.x < 0 || this.x > width;
  }
}

export { Projectile };
