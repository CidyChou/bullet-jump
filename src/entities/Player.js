import { CONFIG } from "../config.js?v=3.8.0";

export class Player {
  constructor(x, y, input, upgrades) {
    Object.assign(this, {
      x,
      y,
      prevY: y,
      vx: 0,
      vy: CONFIG.baseJumpVelocity,
      radius: 28,
      input,
      upgrades,
      maxHp: 4,
      hp: 4,
      shield: 0,
      shieldTimer: 0,
      invulnerable: 0,
      alive: true,
      hitReaction: 0,
      hitDirection: 1,
    });
  }

  get jumpVelocity() {
    return CONFIG.baseJumpVelocity * this.upgrades.stats.jump;
  }

  get maxShield() {
    return this.upgrades.stats.shieldMax;
  }

  update(dt, game) {
    this.hitReaction = Math.max(0, this.hitReaction - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.prevY = this.y;

    if (this.maxShield > 0 && this.shield < this.maxShield) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shield += 1;
        this.shieldTimer = this.upgrades.stats.shieldCooldown;
        game.ui.toast("护盾恢复 +1");
      }
    }

    if (game.skills.isTimeJumpAnimating) {
      this.vx *= 0.84;
      return;
    }

    const axis = this.input.horizontalAxis;
    const movementScale = game.skills.isBulletTimeActive
      ? CONFIG.bulletTimeMoveScale
      : 1;

    this.vx += axis * 1450 * dt;
    this.vx *= Math.pow(0.018, dt);

    const maxSpeed =
      CONFIG.baseMoveSpeed * this.upgrades.stats.move * movementScale;

    this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));
    this.x += this.vx * dt;

    if (game.skills.isBulletTimeActive) {
      this.vy += CONFIG.gravity * this.upgrades.stats.gravity * dt * 0.1;
      this.y += this.vy * dt * 0.16;
      if (this.input.joystickActive) {
        this.y += this.input.verticalAxis * 165 * dt;
      }
    } else {
      this.vy += CONFIG.gravity * this.upgrades.stats.gravity * dt;
      this.y += this.vy * dt;
    }

    if (this.x < -this.radius) this.x = CONFIG.worldWidth + this.radius;
    if (this.x > CONFIG.worldWidth + this.radius) this.x = -this.radius;
  }

  bounce() {
    this.vy = this.jumpVelocity;
  }

  damage(game, source = null) {
    if (this.invulnerable > 0) return;

    const direction = source
      ? Math.sign(this.x - source.x) || 1
      : Math.random() < 0.5
        ? -1
        : 1;

    this.hitDirection = direction;
    this.hitReaction = 0.28;

    if (this.shield > 0) {
      this.shield -= 1;
      this.shieldTimer = this.upgrades.stats.shieldCooldown;
      game.audio.play("shield");
      game.ui.toast("护盾抵挡");
      game.onPlayerHit(true, source);
      return;
    }

    this.hp -= 1;
    this.invulnerable = 1.1;

    // A small physical kick makes the hit readable without stealing control.
    this.vx += direction * 155;
    this.vy = Math.min(this.vy, -135);

    game.audio.play("hurt");
    game.onPlayerHit(false, source);

    if (this.hp <= 0) {
      this.alive = false;
      game.finishRun(false);
    }
  }

  draw(ctx, game) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.hitReaction > 0) {
      const hit = this.hitReaction / 0.28;
      ctx.translate(this.hitDirection * 8 * hit, 0);
      ctx.rotate(this.hitDirection * 0.14 * hit);
      ctx.scale(1 + 0.13 * hit, 1 - 0.11 * hit);
    }

    const charge = game.skills.timeJumpChargeProgress;
    const launch = game.skills.timeJumpLaunchProgress;

    if (charge > 0) {
      const squash = 1 - charge * 0.18;
      ctx.scale(1 + charge * 0.16, squash);
    }

    if (launch > 0) {
      for (let i = 1; i < 4; i += 1) {
        ctx.globalAlpha = 0.16 * (1 - i / 4);
        ctx.fillStyle = "#f39c12";
        ctx.beginPath();
        ctx.arc(0, i * 24, 28 - i * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (game.skills.isBulletTimeActive) {
      ctx.strokeStyle = "rgba(142,68,173,.72)";
      ctx.lineWidth = 2;
      for (let i = 1; i <= 3; i += 1) {
        ctx.globalAlpha = 0.72 - i * 0.14;
        ctx.beginPath();
        ctx.arc(
          -this.vx * 0.012 * i,
          -this.vy * 0.003 * i,
          this.radius + i * 6,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    for (let i = 0; i < this.shield; i += 1) {
      ctx.strokeStyle = i
        ? "rgba(22,160,133,.6)"
        : "rgba(52,152,219,.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 9 + i * 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    const flashWhite =
      this.hitReaction > 0 && Math.floor(game.elapsed * 32) % 2 === 0;

    ctx.fillStyle = flashWhite ? "#ffffff" : "#f1c40f";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    if (this.hitReaction > 0) {
      ctx.strokeStyle = "rgba(211,84,0,.92)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "#f39c12";
    ctx.beginPath();
    ctx.arc(0, 7, 12, 9, 0, Math.PI);
    ctx.fill();

    ctx.fillStyle = "#2c3e50";
    ctx.beginPath();
    ctx.arc(-6, -4, 2.5, 0, Math.PI * 2);
    ctx.arc(6, -4, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ecf0f1";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, -12);
    ctx.quadraticCurveTo(0, -21, 10, -12);
    ctx.stroke();

    ctx.restore();
  }
}
