import { CONFIG } from '../config.js?v=4.0.0';

export class Enemy {
  constructor(x, y, progress = 0, platform = null, kind = 'ranged') {
    Object.assign(this, { kind, isBoss: false, x, y, progress, platform, platformOffset: platform ? x - platform.x : 0, radius: kind === 'sniper' ? 26 : 23, fireTimer: 1.4, dead: false, hitFlash: 0, knockback: 0, phase: Math.random() * Math.PI * 2, warned: false });
    this.maxHp = 2 + Math.floor(progress * 6) + Number(kind === 'sniper'); this.hp = this.maxHp;
  }
  update(dt, game) {
    if (this.dead) return;
    const scaled = dt * game.skills.enemyTimeScale;
    this.hitFlash = Math.max(0, this.hitFlash - scaled);
    if (this.platform) {
      if (this.platform.dead) { this.dead = true; return; }
      this.platformOffset = Math.max(this.radius, Math.min(this.platform.width - this.radius, this.platformOffset + this.knockback * scaled));
      this.x = this.platform.x + this.platformOffset; this.y = this.platform.y - 35;
    }
    this.knockback *= Math.exp(-scaled * 13);
    // Off-screen enemies never launch surprise bullets into the play area.
    if (this.y < game.camera.y + 320 || this.y > game.camera.y + game.height - 90) return;
    this.fireTimer -= scaled;
    if (this.fireTimer < 0.45 && !this.warned) { this.warned = true; this.aim = Math.atan2(game.player.y - this.y, game.player.x - this.x); }
    if (this.fireTimer > 0) return;
    this.warned = false;
    this.fireTimer = (this.kind === 'sniper' ? 2.9 : 3.1) - this.progress * 1.2;
    const base = this.aim ?? Math.atan2(game.player.y - this.y, game.player.x - this.x);
    const count = this.kind === 'sniper' ? 1 : 1 + Number(this.progress > 0.45) + Number(this.progress > 0.85);
    const speed = (this.kind === 'sniper' ? 340 : 225) + this.progress * 95;
    for (let i = 0; i < count; i++) {
      const angle = base + (i - (count - 1) / 2) * 0.21;
      game.enemyBullets.push({ x: this.x, y: this.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: this.kind === 'sniper' ? 6 : 7, life: 5, color: this.kind === 'sniper' ? '#91dfff' : '#f4c575' });
    }
    game.effects.muzzle(this.x, this.y, base, '#f4c575'); game.audio.play('enemyShot');
  }
  damage(amount, game, source) {
    if (this.dead) return;
    this.hp -= amount;
    if (this.hp <= 0) { this.dead = true; game.kills++; game.audio.play('enemyDown'); }
    game.onEnemyHit(this, amount, source);
  }
  draw(ctx, game) {
    ctx.save(); ctx.translate(this.x, this.y + Math.sin(game.elapsed * 3 + this.phase) * 3);
    if (this.warned) {
      ctx.strokeStyle = this.kind === 'sniper' ? 'rgba(145,223,255,.45)' : 'rgba(244,197,117,.3)';
      ctx.lineWidth = 2; ctx.setLineDash([9, 10]); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(this.aim) * 850, Math.sin(this.aim) * 850); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : this.kind === 'sniper' ? '#71badc' : '#a478d8';
    ctx.beginPath();
    if (this.kind === 'sniper') { ctx.moveTo(0, -29); ctx.lineTo(27, 0); ctx.lineTo(0, 29); ctx.lineTo(-27, 0); ctx.closePath(); }
    else ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill(); ctx.strokeStyle = '#e4dcf6'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#152332'; ctx.fillRect(-14, -7, 28, 12);
    ctx.fillStyle = '#fff3bc'; ctx.fillRect(-9, -3, 5, 4); ctx.fillRect(4, -3, 5, 4);
    ctx.fillStyle = '#14202d'; ctx.fillRect(-23, 35, 46, 5);
    ctx.fillStyle = '#c1a1ff'; ctx.fillRect(-23, 35, 46 * Math.max(0, this.hp / this.maxHp), 5);
    ctx.restore();
  }
}
