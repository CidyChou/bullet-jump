// A single bounded feedback layer. World effects use simulation time; hit stop
// uses real time so bullet-time never stretches a freeze into a long stall.
export class EffectSystem {
  constructor() {
    this.p = [];
    this.numbers = [];
    this.rings = [];
    this.trauma = 0;
    this.freeze = 0;
    this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  }
  impact(strength = 0.2, stop = 0) {
    this.trauma = Math.min(1, this.trauma + strength);
    this.freeze = Math.max(this.freeze, stop);
  }
  tick(dt, scale = 1) {
    const frozen = this.freeze > 0;
    this.freeze = Math.max(0, this.freeze - dt);
    this.trauma = Math.max(0, this.trauma - dt * 2.8);
    this.update(dt * scale * (frozen ? 0.12 : 1));
    return frozen;
  }
  get shake() { return this.reducedMotion ? 0 : Math.min(13, this.trauma * this.trauma * 15); }
  burst(x, y, count, color, speed = 1) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = (70 + Math.random() * 170) * speed;
      const life = 0.22 + Math.random() * 0.3;
      this.p.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life, max: life, r: 2 + Math.random() * 3, color });
    }
    if (this.p.length > 260) this.p.splice(0, this.p.length - 260);
  }
  muzzle(x, y, angle, color = '#fff3a6') {
    for (let i = 0; i < 5; i++) {
      const direction = angle + (Math.random() - 0.5) * 0.7;
      this.p.push({ x: x + Math.cos(angle) * 29, y: y + Math.sin(angle) * 29, vx: Math.cos(direction) * 230, vy: Math.sin(direction) * 230, life: 0.09, max: 0.09, r: 3 + Math.random() * 4, color });
    }
  }
  number(x, y, text, color = '#fff5c9', big = false) {
    this.numbers.push({ x, y: y - 28, text, color, big, life: 0.65, max: 0.65 });
    if (this.numbers.length > 22) this.numbers.shift();
  }
  ring(x, y, color = '#75e8bc') { this.rings.push({ x, y, color, life: 0.4 }); }
  update(dt) {
    for (const q of this.p) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 200 * dt; q.life -= dt; }
    this.p = this.p.filter(q => q.life > 0);
    for (const q of this.numbers) q.life -= dt;
    this.numbers = this.numbers.filter(q => q.life > 0);
    for (const q of this.rings) q.life -= dt;
    this.rings = this.rings.filter(q => q.life > 0);
  }
  draw(ctx) {
    for (const q of this.p) {
      ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.color;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r * Math.min(1, q.life * 12), 0, Math.PI * 2); ctx.fill();
    }
    for (const q of this.rings) {
      ctx.globalAlpha = q.life / 0.4; ctx.strokeStyle = q.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(q.x, q.y, 28 + (0.4 - q.life) * 200, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const q of this.numbers) {
      const t = 1 - q.life / q.max;
      ctx.globalAlpha = Math.min(1, q.life * 4);
      ctx.font = `900 ${q.big ? 35 : 26}px system-ui`;
      ctx.lineWidth = 5; ctx.strokeStyle = '#0b1620'; ctx.fillStyle = q.color;
      ctx.strokeText(q.text, q.x, q.y - t * 55); ctx.fillText(q.text, q.x, q.y - t * 55);
    }
    ctx.globalAlpha = 1;
  }
}
