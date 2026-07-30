import { CONFIG } from '../config.js?v=3.8.0';

export class BossEnemy {
  constructor(tier, game) {
    this.kind = tier === 'final' ? 'finalBoss' : 'midBoss';
    this.tier = tier;
    this.isBoss = true;
    this.bossName = tier === 'final' ? '终焉时间巨兽' : '时间守门者';
    this.radius = tier === 'final' ? 82 : 62;
    this.x = CONFIG.worldWidth * 0.5;
    this.y = game.camera.y + (tier === 'final' ? 270 : 300);
    this.anchorY = tier === 'final' ? 270 : 300;
    this.phase = 0;
    this.pattern = 0;
    this.fireTimer = tier === 'final' ? 0.48 : 0.68;
    this.contactCooldown = 0;
    this.spawnTimer = 0.85;
    this.dead = false;

    const stats = game.upgrades.stats;
    const combatPower = stats.damage * stats.projectiles / Math.max(0.38, stats.fireRate);
    this.maxHp = Math.round(
      tier === 'final'
        ? 205 + combatPower * 28
        : 82 + combatPower * 17
    );
    this.hp = this.maxHp;
  }

  update(dt, game) {
    if (this.dead) return;
    const scale = game.skills.enemyTimeScale;
    const scaledDt = dt * scale;
    this.phase += scaledDt;
    this.spawnTimer = Math.max(0, this.spawnTimer - dt);
    this.contactCooldown = Math.max(0, this.contactCooldown - scaledDt);

    const targetY = game.camera.y + this.anchorY;
    const center = CONFIG.worldWidth * 0.5;
    const range = this.tier === 'final' ? 245 : 185;
    const targetX = center + Math.sin(this.phase * (this.tier === 'final' ? 1.05 : 0.78)) * range;
    this.x += (targetX - this.x) * Math.min(1, scaledDt * 2.6);
    this.y += (targetY - this.y) * Math.min(1, scaledDt * 3.4);

    const distance = Math.hypot(game.player.x - this.x, game.player.y - this.y);
    if (distance < game.player.radius + this.radius - 8 && this.contactCooldown <= 0) {
      this.contactCooldown = 0.95;
      game.player.damage(game, this);
    }

    if (this.spawnTimer > 0) return;
    this.fireTimer -= scaledDt;
    if (this.fireTimer <= 0) this.attack(game);
  }

  attack(game) {
    this.pattern += 1;
    if (this.tier === 'mid') {
      if (this.pattern % 3 === 0) this.radial(game, 10, 250, '#9b59b6');
      else this.aimedSpread(game, 5, 0.16, 310, '#f39c12');
      this.fireTimer = 1.08;
    } else {
      if (this.pattern % 3 === 0) {
        this.radial(game, 16, 315, '#d64541');
        this.aimedSpread(game, 5, 0.13, 355, '#f1c40f');
      } else if (this.pattern % 2 === 0) {
        this.radial(game, 12, 280, '#8e44ad');
      } else {
        this.aimedSpread(game, 7, 0.13, 370, '#d35400');
      }
      this.fireTimer = 0.78;
    }
    game.audio.play('bossShot');
  }

  aimedSpread(game, count, spread, speed, color) {
    const base = Math.atan2(game.player.y - this.y, game.player.x - this.x);
    for (let i = 0; i < count; i += 1) {
      const angle = base + (i - (count - 1) / 2) * spread;
      game.enemyBullets.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: this.tier === 'final' ? 9 : 8,
        life: 7,
        color,
        boss: true,
      });
    }
  }

  radial(game, count, speed, color) {
    const offset = this.phase * 0.65;
    for (let i = 0; i < count; i += 1) {
      const angle = offset + (i / count) * Math.PI * 2;
      game.enemyBullets.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: this.tier === 'final' ? 9 : 8,
        life: 7,
        color,
        boss: true,
      });
    }
  }

  damage(amount, game) {
    if (this.dead || this.spawnTimer > 0) return;
    this.hp -= amount;
    game.effects.burst(this.x, this.y, 5, this.tier === 'final' ? '#d64541' : '#8e44ad');
    game.shake = Math.max(game.shake, 2.5);
    if (this.hp > 0) return;
    this.dead = true;
    game.audio.play('bossDown');
    game.effects.burst(this.x, this.y, this.tier === 'final' ? 52 : 36, '#f1c40f');
    game.onBossDefeated(this);
  }

  draw(ctx, game) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const pulse = 1 + Math.sin(game.elapsed * 4) * 0.035;
    ctx.scale(pulse, pulse);

    if (this.spawnTimer > 0) {
      ctx.globalAlpha = 0.42 + Math.sin(game.elapsed * 18) * 0.18;
      ctx.strokeStyle = this.tier === 'final' ? '#d64541' : '#8e44ad';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 34 + this.spawnTimer * 45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const colorA = this.tier === 'final' ? '#d64541' : '#8e44ad';
    const colorB = this.tier === 'final' ? '#5b1422' : '#35224a';
    const body = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.35, 4, 0, 0, this.radius + 12);
    body.addColorStop(0, '#ecf0f1');
    body.addColorStop(0.14, colorA);
    body.addColorStop(1, colorB);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(236,240,241,.28)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius - 13, 0, Math.PI * 2);
    ctx.stroke();

    const eyeCount = this.tier === 'final' ? 3 : 2;
    for (let i = 0; i < eyeCount; i += 1) {
      const x = (i - (eyeCount - 1) / 2) * 26;
      ctx.fillStyle = '#ecf0f1';
      ctx.beginPath();
      ctx.arc(x, -8, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111820';
      ctx.beginPath();
      ctx.arc(x + Math.sin(game.elapsed * 2) * 2, -7, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = '#111820';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 18, this.radius * 0.38, 0.05 * Math.PI, 0.95 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }
}
