export class Platform {
  constructor(x, y, width, type = 'normal') {
    Object.assign(this, { x, y, width, type, originX: x, height: type === 'ground' ? 54 : 18, dead: false, vx: type === 'moving' ? (Math.random() < 0.5 ? -1 : 1) * (45 + Math.random() * 25) : 0, breakTimer: 0, enemyUsed: false });
  }
  update(dt) {
    if (this.type === 'moving') {
      const min = Math.max(12, this.originX - 42), max = Math.min(743 - this.width, this.originX + 42);
      this.x += this.vx * dt;
      if (this.x < min || this.x > max) { this.x = Math.max(min, Math.min(max, this.x)); this.vx *= -1; }
    }
    if (this.breakTimer > 0) { this.breakTimer -= dt; if (this.breakTimer <= 0) this.dead = true; }
  }
  triggerBreak() { if (this.type === 'break' && this.breakTimer <= 0) this.breakTimer = 0.48; }
  draw(ctx) {
    const color = this.type === 'moving' ? '#74bff0' : this.type === 'break' ? '#f4bc76' : '#75d5b3';
    ctx.fillStyle = this.type === 'moving' ? '#20384d' : this.type === 'break' ? '#463422' : '#1b3c37';
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(this.x, this.y, this.width, this.height, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(this.x + 7, this.y, this.width - 14, 3);
    if (this.type === 'moving') {
      ctx.font = 'bold 17px system-ui'; ctx.textAlign = 'center'; ctx.fillText('↔', this.x + this.width / 2, this.y + 13);
    } else if (this.type === 'break') {
      ctx.beginPath(); ctx.moveTo(this.x + this.width * 0.46, this.y); ctx.lineTo(this.x + this.width * 0.52, this.y + 10); ctx.lineTo(this.x + this.width * 0.47, this.y + 18); ctx.stroke();
    }
  }
}
