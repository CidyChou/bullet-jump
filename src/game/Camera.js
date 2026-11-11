export class Camera {
  constructor(height) { this.y = 0; this.resize(height); }
  resize(height) { this.viewHeight = height; this.followTop = height * 0.56; }
  update(player) {
    const target = Math.min(0, player.y - this.followTop);
    this.y = Math.min(this.y, target);
  }
  worldToScreenY(y) { return y - this.y; }
  apply(ctx) { ctx.translate(0, -this.y); }
}
