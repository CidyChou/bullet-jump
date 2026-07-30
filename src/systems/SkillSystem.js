import { CONFIG } from '../config.js?v=3.7.3';

export class SkillSystem {
  constructor(upgrades, audio, ui) {
    this.u = upgrades;
    this.audio = audio;
    this.ui = ui;
    this.bulletTimeRemaining = 0;
    this.bulletTimeCooldown = 0;
    this.timeJumpCooldown = 0;
    this.jumpPhase = 'idle';
    this.jumpTimer = 0;
    this.jumpStartY = 0;
    this.jumpTargetY = 0;
  }

  get isBulletTimeActive() { return this.bulletTimeRemaining > 0; }
  get isTimeJumpAnimating() { return this.jumpPhase !== 'idle'; }
  get enemyTimeScale() {
    return this.isBulletTimeActive
      ? Math.max(0.07, CONFIG.bulletTimeScale * this.u.stats.timeSlow)
      : 1;
  }
  get timeJumpChargeProgress() {
    return this.jumpPhase === 'charging'
      ? 1 - this.jumpTimer / CONFIG.timeJumpChargeDuration
      : 0;
  }
  get timeJumpLaunchProgress() {
    return this.jumpPhase === 'launching'
      ? 1 - this.jumpTimer / CONFIG.timeJumpLaunchDuration
      : 0;
  }

  update(dt, game) {
    const wasActive = this.isBulletTimeActive;
    if (this.bulletTimeRemaining > 0) {
      this.bulletTimeRemaining = Math.max(0, this.bulletTimeRemaining - dt);
    } else {
      this.bulletTimeCooldown = Math.max(0, this.bulletTimeCooldown - dt);
    }
    if (wasActive && this.bulletTimeRemaining <= 0) {
      game.input.setMode('horizontal');
      game.effects.burst(game.player.x, game.player.y, 10, '#8e44ad');
    }

    this.timeJumpCooldown = Math.max(0, this.timeJumpCooldown - dt);

    if (this.jumpPhase === 'charging') {
      this.jumpTimer -= dt;
      game.player.vy = 0;
      if (this.jumpTimer <= 0) {
        this.jumpPhase = 'launching';
        this.jumpTimer = CONFIG.timeJumpLaunchDuration;
        this.jumpStartY = game.player.y;
        this.jumpTargetY = game.player.y - CONFIG.timeJumpDistance * this.u.stats.timeJump;
        this.audio.play('launch');
        game.effects.burst(game.player.x, game.player.y, 20, '#f39c12');
      }
    } else if (this.jumpPhase === 'launching') {
      this.jumpTimer -= dt;
      const t = Math.min(1, 1 - this.jumpTimer / CONFIG.timeJumpLaunchDuration);
      const ease = 1 - Math.pow(1 - t, 3);
      game.player.y = this.jumpStartY + (this.jumpTargetY - this.jumpStartY) * ease;
      game.player.prevY = game.player.y;
      if (t >= 1) {
        this.jumpPhase = 'idle';
        game.player.vy = game.player.jumpVelocity * 0.72;
        game.ui.toast('时间跳跃！');
      }
    }
  }

  activateBulletTime(game) {
    if (game.paused || this.bulletTimeCooldown > 0 || this.isBulletTimeActive || this.isTimeJumpAnimating) return false;
    this.bulletTimeRemaining = CONFIG.bulletTimeDuration * this.u.stats.timeDuration;
    this.bulletTimeCooldown = CONFIG.bulletTimeCooldown * this.u.stats.cooldown;
    game.input.setMode('radial');
    this.audio.play('time');
    game.effects.burst(game.player.x, game.player.y, 22, '#8e44ad');
    this.ui.toast('子弹时间！');
    return true;
  }

  activateTimeJump(game) {
    if (game.paused || this.timeJumpCooldown > 0 || this.isTimeJumpAnimating) return false;
    this.timeJumpCooldown = CONFIG.timeJumpCooldown * this.u.stats.cooldown;
    this.jumpPhase = 'charging';
    this.jumpTimer = CONFIG.timeJumpChargeDuration;
    game.player.vy = 0;
    this.audio.play('charge');
    game.effects.burst(game.player.x, game.player.y + 20, 12, '#f39c12');
    this.ui.toast('蓄力…');
    return true;
  }

  bulletProgress() {
    if (this.isBulletTimeActive) {
      return this.bulletTimeRemaining / (CONFIG.bulletTimeDuration * this.u.stats.timeDuration);
    }
    return this.bulletTimeCooldown <= 0
      ? 1
      : 1 - this.bulletTimeCooldown / (CONFIG.bulletTimeCooldown * this.u.stats.cooldown);
  }

  jumpProgress() {
    return this.timeJumpCooldown <= 0
      ? 1
      : 1 - this.timeJumpCooldown / (CONFIG.timeJumpCooldown * this.u.stats.cooldown);
  }
}
