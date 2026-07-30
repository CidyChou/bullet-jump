import { CONFIG } from '../config.js?v=3.8.0';

export class Enemy {
  constructor(x, y, progress = 0, platform = null) {
    this.kind = 'ranged';
    this.isBoss = false;
    this.x = x;
    this.y = y;
    this.progress = progress;
    this.platform = platform;
    this.platformOffset = platform ? x - platform.x : 0;
    this.radius = 23;
    this.maxHp = 2 + Math.floor(progress * 7);
    this.hp = this.maxHp;
    this.fireTimer = 0.07 + Math.random() * 0.14;
    this.dead = false;
    this.phase = Math.random() * Math.PI * 2;
  }

  update(dt, game) {
    if (this.dead) return;
    if (this.platform) {
      if (this.platform.dead) {
        this.dead = true;
        return;
      }
      this.x = this.platform.x + this.platformOffset;
      this.y = this.platform.y - 35;
    }

    const scale = game.skills.enemyTimeScale;
    this.fireTimer -= dt * scale;
    if (this.fireTimer > 0) return;

    this.fireTimer = Math.max(0.62, 2.55 - this.progress * 1.45) + Math.random() * 0.6;
    const baseAngle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
    const count = 1 + Number(this.progress > 0.3) + Number(this.progress > 0.65);
    const speed = CONFIG.enemyBulletSpeed + this.progress * 155;

    for (let i = 0; i < count; i += 1) {
      const angle = baseAngle + (i - (count - 1) / 2) * 0.15;
      game.enemyBullets.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 7,
        life: 6,
        color: '#f39c12',
      });
    }
    game.audio.play('enemyShot');
  }

  damage(amount, game) {
    if (this.dead) return;
    this.hp -= amount;
    game.effects.burst(this.x, this.y, 4, '#ecf0f1');
    if (this.hp > 0) return;
    this.dead = true;
    game.kills += 1;
    game.audio.play('enemyDown');
    game.effects.burst(this.x, this.y, 14, '#8e44ad');
  }

  draw(ctx, game) {
    ctx.save();
    ctx.translate(this.x, this.y + Math.sin(game.elapsed * 3 + this.phase) * 4);

    const gradient = ctx.createRadialGradient(-7, -8, 2, 0, 0, this.radius + 4);
    gradient.addColorStop(0, '#b76ad3');
    gradient.addColorStop(0.48, '#8e44ad');
    gradient.addColorStop(1, '#4a245a');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath();
    ctx.arc(-8, -3, 4, 0, Math.PI * 2);
    ctx.arc(8, -3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-7, -3, 2, 0, Math.PI * 2);
    ctx.arc(7, -3, 2, 0, Math.PI * 2);
    ctx.fill();

    this.drawHealth(ctx);
    ctx.restore();
  }

  drawHealth(ctx) {
    const ratio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,.58)';
    ctx.fillRect(-23, 31, 46, 6);
    ctx.fillStyle = ratio > 0.45 ? '#2ecc71' : ratio > 0.2 ? '#f1c40f' : '#d35400';
    ctx.fillRect(-22, 32, 44 * ratio, 4);
  }
}
