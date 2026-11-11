export class MeleeEnemy {
  constructor(x, y, progress = 0, platform = null) {
    this.kind = 'melee';
    this.isBoss = false;
    this.x = x;
    this.y = y;
    this.progress = progress;
    this.platform = platform;
    this.radius = 31;
    this.maxHp = 4 + Math.floor(progress * 10);
    this.hp = this.maxHp;
    this.hitFlash = 0;
    this.knockback = 0;
    this.telegraph = 0;
    this.dead = false;
    this.contactCooldown = 0;
    this.chargeTimer = 0;
    this.chargeCooldown = 0.45 + Math.random() * 0.45;
    this.facing = Math.random() < 0.5 ? -1 : 1;
    this.phase = Math.random() * Math.PI * 2;
  }

  update(dt, game) {
    if (this.dead) return;
    if (this.platform?.dead) {
      this.dead = true;
      return;
    }

    const scale = game.skills.enemyTimeScale;
    const scaledDt = dt * scale;
    this.hitFlash = Math.max(0, this.hitFlash - scaledDt);
    this.knockback *= Math.exp(-scaledDt * 12);
    this.contactCooldown = Math.max(0, this.contactCooldown - scaledDt);
    this.chargeCooldown = Math.max(0, this.chargeCooldown - scaledDt);
    this.chargeTimer = Math.max(0, this.chargeTimer - scaledDt);

    const minX = this.platform ? this.platform.x + this.radius : 20;
    const maxX = this.platform ? this.platform.x + this.platform.width - this.radius : 735;
    const baseY = this.platform ? this.platform.y - this.radius : this.y;
    this.y = baseY + Math.sin(game.elapsed * 4 + this.phase) * 2;

    const dx = game.player.x - this.x;
    const dy = game.player.y - this.y;
    const seesPlayer = Math.abs(dy) < 210 && Math.abs(dx) < 410;

    if (seesPlayer) {
      this.facing = Math.sign(dx) || this.facing;
      if (this.chargeCooldown <= 0 && Math.abs(dx) > 75) {
        this.telegraph = 0.35;
        this.chargeCooldown = 1.35 - this.progress * 0.35;
        game.audio.play('meleeCharge');
      }
    }

    if (this.telegraph > 0) {
      this.telegraph -= scaledDt;
      if (this.telegraph <= 0) this.chargeTimer = 0.32;
    }
    const speed = (72 + this.progress * 70) * (this.chargeTimer > 0 ? 2.65 : 1);
    this.x += (this.facing * speed * (this.telegraph > 0 ? 0.12 : 1) + this.knockback) * scaledDt;
    if (this.x <= minX || this.x >= maxX) {
      this.x = Math.max(minX, Math.min(maxX, this.x));
      this.facing *= -1;
    }

    const distance = Math.hypot(game.player.x - this.x, game.player.y - this.y);
    if (distance < game.player.radius + this.radius - 5 && this.contactCooldown <= 0) {
      this.contactCooldown = 0.85;
      game.audio.play('meleeHit');
      game.player.damage(game, this);
    }
  }

  damage(amount, game, source) {
    if (this.dead) return;
    this.hp -= amount;
    if (this.hp <= 0) { this.dead = true; game.kills++; game.audio.play('enemyDown'); }
    game.onEnemyHit(this, amount, source);
  }

  draw(ctx, game) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing, 1);
    if (this.telegraph > 0) {
      ctx.strokeStyle = '#fff3bc'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff3bc'; ctx.font = 'bold 25px system-ui'; ctx.fillText('!', -4, -45);
    }

    if (this.chargeTimer > 0) {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.ellipse(-42, 0, 38, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const body = ctx.createRadialGradient(-10, -12, 3, 0, 0, this.radius + 7);
    body.addColorStop(0, '#f4a742');
    body.addColorStop(0.42, '#d35400');
    body.addColorStop(1, '#6f2814');
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : body;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2c3e50';
    for (const sy of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-5, sy * 21);
      ctx.lineTo(-19, sy * 37);
      ctx.lineTo(7, sy * 26);
      ctx.fill();
    }

    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath();
    ctx.arc(10, -7, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(12, -7, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#30130d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(9, 9);
    ctx.lineTo(22, 5);
    ctx.stroke();

    ctx.scale(this.facing, 1);
    const ratio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,.64)';
    ctx.fillRect(-32, 42, 64, 8);
    ctx.fillStyle = ratio > 0.45 ? '#f39c12' : '#d35400';
    ctx.fillRect(-31, 43, 62 * ratio, 6);
    ctx.restore();
  }
}
