import { CONFIG } from '../config.js?v=4.0.0';

export class BossEnemy {
  constructor(tier, game) {
    const spec = tier === 'mid' ? game.level.mid : game.level.boss;
    Object.assign(this, { spec, tier, kind: 'boss', isBoss: true, bossName: spec.name, radius: spec.radius, x: CONFIG.worldWidth / 2, y: game.camera.y + 570, anchorY: 570, phase: 0, pattern: 0, fireTimer: spec.interval, contactCooldown: 0, spawnTimer: 1.4, dead: false, hitFlash: 0, knockback: 0, warned: false, aim: Math.PI / 2 });
    // A small, sublinear scaling keeps upgrades powerful without trivializing a boss.
    const power = game.upgrades.stats.damage * game.upgrades.stats.projectiles / game.upgrades.stats.fireRate;
    this.maxHp = spec.hp + Math.round((Math.sqrt(power) - 1) * 8); this.hp = this.maxHp;
  }
  update(dt, game) {
    if (this.dead) return;
    const scaled = dt * game.skills.enemyTimeScale;
    this.phase += scaled; this.hitFlash = Math.max(0, this.hitFlash - scaled);
    this.spawnTimer = Math.max(0, this.spawnTimer - scaled);
    this.contactCooldown = Math.max(0, this.contactCooldown - scaled);
    const range = this.spec.id === 'sentinel' ? 125 : this.spec.id === 'apex' ? 245 : 195;
    const targetX = CONFIG.worldWidth / 2 + Math.sin(this.phase * (this.spec.id === 'apex' ? 0.9 : 0.6)) * range;
    this.x += (targetX - this.x) * Math.min(1, scaled * 2.8);
    // Lock the boss visibly beneath the HUD, even during a time jump.
    this.y = game.camera.y + this.anchorY + Math.sin(this.phase) * 20;
    if (Math.hypot(game.player.x - this.x, game.player.y - this.y) < game.player.radius + this.radius - 12 && this.contactCooldown <= 0 && this.spawnTimer <= 0) {
      this.contactCooldown = 1; game.player.damage(game, this);
    }
    if (this.spawnTimer > 0) return;
    this.fireTimer -= scaled;
    if (this.fireTimer <= this.spec.telegraph && !this.warned) {
      this.warned = true;
      this.aim = Math.atan2(game.player.y - this.y, game.player.x - this.x);
      game.audio.play('telegraph');
    }
    if (this.fireTimer <= 0) { this.attack(game); this.fireTimer = this.spec.interval; this.warned = false; }
  }
  attack(game) {
    this.pattern++;
    const s = this.spec, p = this.pattern;
    if (s.id === 'sentinel') this.fan(game, s.count, 0.3);
    else if (s.id === 'fork') {
      this.fan(game, s.count, 0.2, -55); this.fan(game, 3, 0.27, 55, 0.12);
    } else if (s.id === 'spiral') {
      if (p % 2) this.radial(game, 11, 0.75); else this.fan(game, s.count, 0.19);
    } else if (s.id === 'pincer') {
      this.fan(game, 5, 0.21, -100, -0.15); this.fan(game, 5, 0.21, 100, 0.15);
      if (p % 3 === 0) this.radial(game, 10, 0.7);
    } else {
      const enraged = this.hp / this.maxHp < 0.4;
      if (p % 3 === 0) { this.radial(game, enraged ? 16 : 13, 0.78); this.fan(game, 3, 0.21); }
      else if (p % 3 === 1) this.fan(game, enraged ? 11 : 9, 0.16);
      else { this.fan(game, 5, 0.2, -100, -0.12); this.fan(game, 5, 0.2, 100, 0.12); }
    }
    game.effects.impact(s.id === 'apex' ? 0.2 : 0.09);
    game.effects.ring(this.x, this.y, game.level.color); game.audio.play('bossShot');
  }
  bullet(game, x, angle, speed) {
    game.enemyBullets.push({ x, y: this.y + 12, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: this.spec.id === 'apex' ? 8 : 7, life: 5, color: game.level.color, boss: true });
  }
  fan(game, count, spread, offset = 0, bias = 0) {
    for (let i = 0; i < count; i++) this.bullet(game, this.x + offset, this.aim + bias + (i - (count - 1) / 2) * spread, this.spec.speed);
  }
  radial(game, count, speedScale = 1) {
    for (let i = 0; i < count; i++) this.bullet(game, this.x, this.phase * 0.5 + i / count * Math.PI * 2, this.spec.speed * speedScale);
  }
  damage(amount, game, source) {
    if (this.dead || this.spawnTimer > 0) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.dead = true; game.audio.play('bossDown');
      game.effects.burst(this.x, this.y, 55, '#fff3bc', 1.8); game.onBossDefeated(this);
    }
    game.onEnemyHit(this, amount, source);
  }
  draw(ctx, game) {
    ctx.save(); ctx.translate(this.x, this.y);
    const color = game.level.color;
    if (this.spawnTimer > 0 || this.warned) {
      const charge = this.spawnTimer > 0 ? 1 - this.spawnTimer / 1.4 : 1 - Math.max(0, this.fireTimer) / this.spec.telegraph;
      ctx.strokeStyle = color; ctx.lineWidth = 3 + charge * 3; ctx.globalAlpha = 0.4 + charge * 0.5;
      ctx.beginPath(); ctx.arc(0, 0, this.radius + 22 + (1 - charge) * 25, 0, Math.PI * 2); ctx.stroke();
      if (this.warned) {
        ctx.setLineDash([12, 12]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(this.aim) * 1000, Math.sin(this.aim) * 1000); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    }
    const pulse = 1 + Math.sin(this.phase * 3) * 0.025; ctx.scale(pulse, pulse);
    ctx.save(); ctx.rotate(this.phase * 0.3);
    ctx.strokeStyle = color; ctx.lineWidth = 5;
    const sides = { sentinel: 4, fork: 6, spiral: 8, pincer: 4, apex: 10 }[this.spec.id];
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2, r = this.radius + 12;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.stroke(); ctx.restore();
    const body = ctx.createRadialGradient(-20, -25, 4, 0, 0, this.radius);
    body.addColorStop(0, color); body.addColorStop(1, '#192331');
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : body;
    ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#07121b'; ctx.beginPath(); ctx.roundRect(-this.radius * 0.7, -20, this.radius * 1.4, 31, 10); ctx.fill();
    const eyes = this.spec.id === 'apex' ? 3 : 2;
    for (let i = 0; i < eyes; i++) { ctx.fillStyle = this.warned ? '#ffffff' : color; ctx.fillRect((i - (eyes - 1) / 2) * 25 - 6, -11, 12, 12); }
    if (this.spec.id === 'apex' && this.hp / this.maxHp < 0.4) { ctx.strokeStyle = '#ffead4'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-25, 30); ctx.lineTo(0, 40); ctx.lineTo(25, 30); ctx.stroke(); }
    ctx.restore();
  }
}
