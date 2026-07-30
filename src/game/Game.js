import { CONFIG } from '../config.js?v=3.8.0';
import { Camera } from './Camera.js?v=3.8.0';
import { Player } from '../entities/Player.js?v=3.8.0';
import { Platform } from '../entities/Platform.js?v=3.8.0';
import { Enemy } from '../entities/Enemy.js?v=3.8.0';
import { MeleeEnemy } from '../entities/MeleeEnemy.js?v=3.8.0';
import { BossEnemy } from '../entities/BossEnemy.js?v=3.8.0';
import { Input } from '../systems/Input.js?v=3.8.0';
import { AudioSystem } from '../systems/AudioSystem.js?v=3.8.0';
import { EffectSystem } from '../systems/EffectSystem.js?v=3.8.0';
import { SkillSystem } from '../systems/SkillSystem.js?v=3.8.0';
import { UpgradeSystem } from '../systems/UpgradeSystem.js?v=3.8.0';
import { RogueSystem } from '../systems/RogueSystem.js?v=3.8.0';
import { CardUI } from '../ui/CardUI.js?v=3.8.0';
import { HUD } from '../ui/HUD.js?v=3.8.0';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.width = CONFIG.designWidth;
    this.height = CONFIG.designHeight;
    this.elapsed = 0;
    this.running = false;
    this.paused = true;
    this.finished = false;
    this.last = performance.now();
    this.loopStarted = false;

    this.kills = 0;
    this.heightMeters = 0;
    this.highestY = 1070;
    this.platforms = [];
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.fireTimer = 0;
    this.enemySpawnTimer = 0;
    this.enemySpawnLock = 0;
    this.lastLandedPlatform = null;

    this.activeBoss = null;
    this.bossState = {
      mid: { spawned: false, defeated: false },
      final: { spawned: false, defeated: false },
    };

    this.hitStop = 0;
    this.damageFlash = 0;
    this.damageFlashType = 'hurt';
    this.shake = 0;
    this.damageNumbers = [];
    this.impactRings = [];

    this.stars = Array.from({ length: 150 }, () => ({
      x: Math.random() * CONFIG.worldWidth,
      y: Math.random() * 1500,
      r: 0.5 + Math.random() * 1.5,
      a: 0.25 + Math.random() * 0.65,
    }));

    this.audio = new AudioSystem();
    this.effects = new EffectSystem();
    this.upgrades = new UpgradeSystem();

    const joystick = document.querySelector('#joystick');
    const knob = document.querySelector('#joystickKnob');
    this.input = new Input(
      canvas,
      joystick,
      knob,
      () => this.skills?.isBulletTimeActive ? 'radial' : 'horizontal',
    );

    this.camera = new Camera(this.height);
    this.player = new Player(377, 1070, this.input, this.upgrades);
    this.ui = new HUD(this);
    this.skills = new SkillSystem(this.upgrades, this.audio, this.ui);
    const cardUI = new CardUI(
      document.querySelector('#rogueOverlay'),
      document.querySelector('#cardContainer'),
      this.audio,
    );
    this.rogue = new RogueSystem(cardUI, this.upgrades, this.audio);

    this.bind();
    this.resize();
    this.resetWorld();
  }

  bind() {
    this.beginRun = () => {
      if (this.running) return;
      this.audio.unlock();
      document.querySelector('#startOverlay')?.classList.add('hidden');
      this.running = true;
      this.paused = false;
      this.last = performance.now();
    };

    document.querySelector('#startButton').onclick = this.beginRun;
    document.querySelector('#bulletTimeButton').onpointerdown = (event) => {
      event.preventDefault();
      this.audio.unlock();
      this.skills.activateBulletTime(this);
    };
    document.querySelector('#timeJumpButton').onpointerdown = (event) => {
      event.preventDefault();
      this.audio.unlock();
      this.skills.activateTimeJump(this);
    };
    document.querySelector('#restartButton').onclick = () => location.reload();

    addEventListener('keydown', (event) => {
      const startVisible = !document.querySelector('#startOverlay')?.classList.contains('hidden');
      const resultVisible = document.querySelector('#resultOverlay')?.classList.contains('show');

      if (startVisible && (event.key === 'Enter' || event.code === 'Space')) {
        event.preventDefault();
        this.beginRun();
        return;
      }
      if (resultVisible && (event.key === 'Enter' || event.code === 'Space' || event.key.toLowerCase() === 'r')) {
        event.preventDefault();
        location.reload();
        return;
      }
      if (this.rogue.open) return;
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        this.skills.activateBulletTime(this);
      }
      if (['ArrowUp', 'w', 'W'].includes(event.key) && !event.repeat) {
        event.preventDefault();
        this.skills.activateTimeJump(this);
      }
    });
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.floor(rect.width * ratio);
    this.canvas.height = Math.floor(rect.height * ratio);
    this.camera.resize(this.height);
  }

  resetWorld() {
    this.platforms = [
      new Platform(0, 1220, CONFIG.worldWidth, 'ground'),
      new Platform(267, 1075, 220),
    ];
    let y = 950;
    for (let i = 0; i < 36; i += 1) {
      this.createPlatform(y, i);
      y -= CONFIG.platformMinGap + Math.random() * 34;
    }
  }

  metersForWorldY(y) {
    return Math.max(0, (1070 - y) / CONFIG.heightWorldUnitsPerMeter);
  }

  getPlatformWidth(y) {
    const meters = this.metersForWorldY(y);
    const narrowProgress = Math.max(
      0,
      Math.min(1, (meters - CONFIG.platformNarrowStartMeters) / (CONFIG.stageGoalMeters - CONFIG.platformNarrowStartMeters)),
    );
    const minWidth = CONFIG.platformMinWidthBeforeNarrowing +
      (CONFIG.platformAbsoluteMinWidth - CONFIG.platformMinWidthBeforeNarrowing) * narrowProgress;
    const maxWidth = CONFIG.platformMaxWidthBeforeNarrowing +
      (CONFIG.platformMaxWidthAtGoal - CONFIG.platformMaxWidthBeforeNarrowing) * narrowProgress;
    return Math.max(
      CONFIG.platformAbsoluteMinWidth,
      minWidth + Math.random() * Math.max(1, maxWidth - minWidth),
    );
  }

  createPlatform(y, index = 0) {
    const progress = Math.max(0, Math.min(1, this.metersForWorldY(y) / CONFIG.stageGoalMeters));
    const width = this.getPlatformWidth(y);
    const x = 20 + Math.random() * (CONFIG.worldWidth - width - 40);
    const roll = Math.random();
    const type = roll < 0.08 + progress * 0.12
      ? 'moving'
      : roll < 0.12 + progress * 0.23
        ? 'break'
        : 'normal';
    const platform = new Platform(x, y, width, type);
    this.platforms.push(platform);

    if (index > 3 && Math.random() < 0.14 + progress * 0.55) {
      this.spawnEnemy(platform, progress);
    }
  }

  getEnemySpawnSafety(progress = Math.min(1, this.heightMeters / CONFIG.stageGoalMeters)) {
    return {
      minAhead: 360 - progress * 105,
      maxAhead: 900 + progress * 100,
      minDistance: 390 - progress * 110,
    };
  }

  isSafeEnemySpawnPlatform(platform, progress = Math.min(1, this.heightMeters / CONFIG.stageGoalMeters)) {
    if (!platform || platform.enemyUsed || platform.type === 'ground' || platform === this.lastLandedPlatform) return false;
    const safety = this.getEnemySpawnSafety(progress);
    const x = platform.x + platform.width * 0.5;
    const ahead = this.player.y - platform.y;
    const distance = Math.hypot(x - this.player.x, ahead);
    if (ahead < safety.minAhead || ahead > safety.maxAhead || distance < safety.minDistance) return false;
    return !this.enemies.some((enemy) => !enemy.dead && (enemy.x - x) ** 2 + (enemy.y - (platform.y - 35)) ** 2 < 210 ** 2);
  }

  spawnEnemy(platform, progress, forcedKind = null) {
    if (this.activeBoss || !this.isSafeEnemySpawnPlatform(platform, progress)) return false;
    platform.enemyUsed = true;
    const x = platform.x + platform.width * 0.5;
    const y = platform.y - 35;
    const meleeChance = 0.18 + progress * 0.24;
    const kind = forcedKind || (Math.random() < meleeChance ? 'melee' : 'ranged');
    const enemy = kind === 'melee'
      ? new MeleeEnemy(x, y, progress, platform)
      : new Enemy(x, y, progress, platform);
    this.enemies.push(enemy);
    this.effects.burst(x, y, kind === 'melee' ? 10 : 7, kind === 'melee' ? '#d35400' : '#8e44ad');
    return true;
  }

  start() {
    if (this.loopStarted) return;
    this.loopStarted = true;
    this.last = performance.now();
    requestAnimationFrame((time) => this.loop(time));
  }

  loop(time) {
    const dt = Math.min(0.033, (time - this.last) / 1000 || 0);
    this.last = time;
    if (this.running) this.update(dt);
    this.render();
    requestAnimationFrame((next) => this.loop(next));
  }

  update(dt) {
    this.elapsed += dt;
    this.enemySpawnLock = Math.max(0, this.enemySpawnLock - dt);
    this.updateHitFeedback(dt);
    this.input.syncMode();

    if (this.paused) {
      this.ui.update();
      return;
    }
    if (this.hitStop > 0) {
      this.effects.update(dt * 0.15);
      this.ui.update();
      return;
    }

    this.skills.update(dt, this);
    this.player.update(dt, this);
    for (const platform of this.platforms) platform.update(dt);
    this.collisions();
    this.camera.update(this.player);
    this.generate();

    this.highestY = Math.min(this.highestY, this.player.y);
    this.heightMeters = Math.max(0, Math.floor((1070 - this.highestY) / CONFIG.heightWorldUnitsPerMeter));
    this.checkBossEvents();

    if (!this.activeBoss) this.maintainEnemies(dt);
    for (const enemy of this.enemies) enemy.update(dt, this);
    this.updateBullets(dt);
    this.autoFire(dt);
    this.effects.update(dt);

    this.platforms = this.platforms.filter((platform) =>
      platform.type === 'ground' || (!platform.dead && platform.y > this.camera.y - 1900 && platform.y < this.camera.y + 2200),
    );
    this.enemies = this.enemies.filter((enemy) =>
      !enemy.dead && (enemy.isBoss || (enemy.y > this.camera.y - 900 && enemy.y < this.camera.y + 1800)),
    );

    if (!this.activeBoss) this.rogue.update(this);
    if (this.heightMeters >= CONFIG.stageGoalMeters && this.bossState.final.defeated) this.finishRun(true);
    this.ui.update();
  }

  checkBossEvents() {
    if (!this.bossState.mid.spawned && this.heightMeters >= CONFIG.midBossMeters) {
      this.spawnBoss('mid');
      return;
    }
    if (
      this.bossState.mid.defeated &&
      !this.bossState.final.spawned &&
      this.heightMeters >= CONFIG.finalBossMeters
    ) {
      this.spawnBoss('final');
    }
  }

  spawnBoss(tier) {
    const state = this.bossState[tier];
    if (state.spawned) return;
    state.spawned = true;

    for (const enemy of this.enemies) {
      if (!enemy.isBoss) enemy.dead = true;
    }
    this.enemyBullets.length = 0;
    this.enemySpawnLock = 2;

    const boss = new BossEnemy(tier, this);
    this.activeBoss = boss;
    this.enemies.push(boss);
    this.audio.play('bossWarning');
    this.effects.burst(boss.x, boss.y, tier === 'final' ? 40 : 28, tier === 'final' ? '#d64541' : '#8e44ad');
    this.ui.toast(tier === 'final' ? '大 Boss 出现！击败它才能获胜' : '5000m 中 Boss 出现！');
  }

  onBossDefeated(boss) {
    const tier = boss.tier;
    this.bossState[tier].defeated = true;
    this.activeBoss = null;
    this.enemyBullets.length = 0;
    this.enemySpawnLock = 1.8;
    this.kills += 1;
    this.ui.toast(tier === 'final' ? '大 Boss 已击破！' : '中 Boss 已击破！继续攀登');
    if (tier === 'final' && this.heightMeters >= CONFIG.stageGoalMeters) {
      setTimeout(() => this.finishRun(true), 650);
    }
  }

  updateHitFeedback(dt) {
    this.hitStop = Math.max(0, this.hitStop - dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 4.6);
    this.shake = Math.max(0, this.shake - dt * 42);
    for (const number of this.damageNumbers) number.life -= dt;
    this.damageNumbers = this.damageNumbers.filter((number) => number.life > 0);
    for (const ring of this.impactRings) ring.life -= dt;
    this.impactRings = this.impactRings.filter((ring) => ring.life > 0);
  }

  onPlayerHit(shielded = false) {
    this.hitStop = Math.max(this.hitStop, shielded ? 0.035 : 0.075);
    this.damageFlash = 1;
    this.damageFlashType = shielded ? 'shield' : 'hurt';
    this.shake = Math.max(this.shake, shielded ? 7 : 18);
    const color = shielded ? '#3498db' : '#d35400';
    const text = shielded ? 'BLOCK' : '-1';
    this.effects.burst(this.player.x, this.player.y, shielded ? 12 : 24, color);
    this.impactRings.push({
      x: this.player.x,
      y: this.player.y,
      life: shielded ? 0.3 : 0.42,
      max: shielded ? 0.3 : 0.42,
      color: shielded ? 'rgba(52,152,219,.78)' : 'rgba(211,84,0,.88)',
    });
    this.damageNumbers.push({
      x: this.player.x,
      y: this.player.y - 36,
      life: 0.62,
      max: 0.62,
      text,
      color: shielded ? '#9dd6fb' : '#ffb09c',
    });
    this.ui.flashDamage?.(shielded);
    if (navigator.vibrate) navigator.vibrate(shielded ? 22 : [28, 18, 38]);
  }

  collisions() {
    if (this.player.vy <= 0 || this.skills.isTimeJumpAnimating) return;
    for (const platform of this.platforms) {
      if (
        this.player.prevY + this.player.radius <= platform.y &&
        this.player.y + this.player.radius >= platform.y &&
        this.player.x > platform.x - 12 &&
        this.player.x < platform.x + platform.width + 12
      ) {
        this.player.y = platform.y - this.player.radius;
        this.player.bounce();
        this.lastLandedPlatform = platform;
        this.enemySpawnLock = Math.max(this.enemySpawnLock, 0.72);
        platform.triggerBreak();
        this.audio.play('jump');
        break;
      }
    }
  }

  maintainEnemies(dt) {
    this.enemySpawnTimer -= dt;
    if (this.enemySpawnTimer > 0 || this.enemySpawnLock > 0) return;

    const progress = Math.min(1, this.heightMeters / CONFIG.stageGoalMeters);
    const target = Math.min(10, this.heightMeters < 180 ? 1 : this.heightMeters < 700 ? 2 : 2 + Math.floor(progress * 8));
    const visible = this.enemies.filter((enemy) =>
      !enemy.dead && !enemy.isBoss && enemy.y > this.camera.y + 100 && enemy.y < this.camera.y + this.height * 0.78,
    );

    if (visible.length < target) {
      const safety = this.getEnemySpawnSafety(progress);
      const idealAhead = 500 - progress * 115;
      const candidates = this.platforms.filter((platform) =>
        this.isSafeEnemySpawnPlatform(platform, progress) &&
        platform.y > this.camera.y + 150 &&
        platform.y < this.player.y - safety.minAhead &&
        platform.y < this.camera.y + this.height * 0.62,
      );
      candidates.sort((a, b) =>
        Math.abs((this.player.y - a.y) - idealAhead) - Math.abs((this.player.y - b.y) - idealAhead),
      );
      if (candidates.length) {
        const pool = candidates.slice(0, Math.min(3, candidates.length));
        this.spawnEnemy(pool[Math.floor(Math.random() * pool.length)], progress);
      }
    }
    this.enemySpawnTimer = 1.9 - progress * 1.15;
  }

  autoFire(dt) {
    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;

    let target = null;
    let best = Infinity;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const distance = (enemy.x - this.player.x) ** 2 + (enemy.y - this.player.y) ** 2;
      if (distance < best && distance < 980 ** 2) {
        best = distance;
        target = enemy;
      }
    }
    if (!target) return;

    this.fireTimer = Math.max(0.27, CONFIG.playerFireInterval * this.upgrades.stats.fireRate);
    const baseAngle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    const count = this.upgrades.stats.projectiles;
    const speed = CONFIG.playerBulletSpeed * this.upgrades.stats.bulletSpeed;

    for (let i = 0; i < count; i += 1) {
      const angle = baseAngle + (i - (count - 1) / 2) * 0.085;
      this.playerBullets.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 6,
        damage: this.upgrades.stats.damage,
        pierce: this.upgrades.stats.penetration,
        life: 2.2,
        hit: new Set(),
      });
    }
    this.audio.play('shot');
  }

  updateBullets(dt) {
    const enemyScale = this.skills.enemyTimeScale;
    for (const bullet of this.enemyBullets) {
      bullet.x += bullet.vx * dt * enemyScale;
      bullet.y += bullet.vy * dt * enemyScale;
      bullet.life -= dt * enemyScale;
      if ((bullet.x - this.player.x) ** 2 + (bullet.y - this.player.y) ** 2 < (bullet.radius + this.player.radius - 5) ** 2) {
        bullet.life = 0;
        this.player.damage(this, bullet);
      }
    }

    for (const bullet of this.playerBullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      for (const enemy of this.enemies) {
        if (enemy.dead || bullet.hit.has(enemy)) continue;
        if ((bullet.x - enemy.x) ** 2 + (bullet.y - enemy.y) ** 2 < (bullet.radius + enemy.radius) ** 2) {
          bullet.hit.add(enemy);
          enemy.damage(bullet.damage, this);
          this.audio.play('hit');
          if (bullet.pierce > 0) bullet.pierce -= 1;
          else bullet.life = 0;
          break;
        }
      }
    }

    this.enemyBullets = this.enemyBullets.filter((bullet) => bullet.life > 0);
    this.playerBullets = this.playerBullets.filter((bullet) => bullet.life > 0);
  }

  generate() {
    let top = Math.min(...this.platforms.map((platform) => platform.y));
    while (top > this.camera.y - 1600) {
      top -= CONFIG.platformMinGap + Math.random() * 50;
      this.createPlatform(top, 20);
    }
  }

  finishRun(win) {
    if (this.finished) return;
    this.finished = true;
    this.paused = true;
    document.querySelector('#resultEyebrow').textContent = win ? 'STAGE CLEAR · 10,000M' : 'RUN ENDED';
    document.querySelector('#resultTitle').textContent = win ? '抵达终点' : '挑战结束';
    document.querySelector('#resultSubtitle').textContent = win
      ? '你击败了终焉时间巨兽，完成了这一局的十次构筑。'
      : '调整流派后再次挑战。';
    document.querySelector('#resultHeight').textContent = `${Math.min(this.heightMeters, 10000)}m`;
    document.querySelector('#resultKills').textContent = this.kills;
    document.querySelector('#resultBuild').textContent = `${this.rogue.selectedCount}/10`;
    document.querySelector('#resultOverlay').classList.add('show');
  }

  render() {
    const ctx = this.ctx;
    const scaleX = this.canvas.width / CONFIG.designWidth;
    const scaleY = this.canvas.height / CONFIG.designHeight;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    ctx.setTransform(scaleX, 0, 0, scaleY, shakeX * scaleX, shakeY * scaleY);

    const background = ctx.createLinearGradient(0, 0, 0, CONFIG.designHeight);
    background.addColorStop(0, '#040608');
    background.addColorStop(1, '#111820');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, CONFIG.designWidth, CONFIG.designHeight);

    for (const star of this.stars) {
      ctx.globalAlpha = star.a;
      ctx.fillStyle = '#ecf0f1';
      ctx.beginPath();
      ctx.arc(star.x, (star.y - this.camera.y * 0.03) % 1450, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    this.camera.apply(ctx);
    for (const platform of this.platforms) platform.draw(ctx);
    for (const enemy of this.enemies) enemy.draw(ctx, this);

    for (const bullet of this.enemyBullets) {
      ctx.strokeStyle = this.skills.isBulletTimeActive ? 'rgba(243,156,18,.28)' : `${bullet.color || 'rgba(243,156,18,.70)'}`;
      ctx.lineWidth = bullet.boss ? 5 : 4;
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * 0.045, bullet.y - bullet.vy * 0.045);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
      ctx.fillStyle = bullet.color || '#f39c12';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const bullet of this.playerBullets) {
      ctx.strokeStyle = 'rgba(22,160,133,.78)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * 0.025, bullet.y - bullet.vy * 0.025);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
      ctx.fillStyle = '#ecf0f1';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    this.player.draw(ctx, this);
    this.effects.draw(ctx);
    ctx.restore();

    if (this.skills.isBulletTimeActive) this.drawBulletTimeOverlay(ctx);
    if (this.skills.timeJumpChargeProgress > 0) {
      const progress = this.skills.timeJumpChargeProgress;
      ctx.strokeStyle = `rgba(243,156,18,${0.25 + progress * 0.55})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.player.x, this.camera.worldToScreenY(this.player.y), 45 + progress * 35, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.drawImpactFeedback(ctx);
  }

  drawImpactFeedback(ctx) {
    for (const ring of this.impactRings) {
      const progress = 1 - ring.life / ring.max;
      ctx.globalAlpha = Math.max(0, ring.life / ring.max);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 4 * (1 - progress) + 1;
      ctx.beginPath();
      ctx.arc(ring.x, this.camera.worldToScreenY(ring.y), 30 + progress * 92, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const number of this.damageNumbers) {
      const progress = 1 - number.life / number.max;
      ctx.globalAlpha = Math.max(0, number.life / number.max);
      ctx.fillStyle = number.color;
      ctx.font = '900 28px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(number.text, number.x, this.camera.worldToScreenY(number.y) - progress * 38);
    }
    ctx.globalAlpha = 1;

    if (this.damageFlash <= 0) return;
    const alpha = this.damageFlash;
    const shielded = this.damageFlashType === 'shield';
    const gradient = ctx.createRadialGradient(
      CONFIG.designWidth * 0.5,
      CONFIG.designHeight * 0.54,
      CONFIG.designWidth * 0.22,
      CONFIG.designWidth * 0.5,
      CONFIG.designHeight * 0.54,
      CONFIG.designHeight * 0.68,
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.62, shielded ? `rgba(52,152,219,${alpha * 0.035})` : `rgba(211,84,0,${alpha * 0.05})`);
    gradient.addColorStop(1, shielded ? `rgba(52,152,219,${alpha * 0.28})` : `rgba(180,28,35,${alpha * 0.44})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONFIG.designWidth, CONFIG.designHeight);
    if (!shielded && alpha > 0.55) {
      ctx.fillStyle = `rgba(255,255,255,${(alpha - 0.55) * 0.1})`;
      ctx.fillRect(0, 0, CONFIG.designWidth, CONFIG.designHeight);
    }
  }

  drawBulletTimeOverlay(ctx) {
    ctx.fillStyle = 'rgba(142,68,173,.15)';
    ctx.fillRect(0, 0, CONFIG.designWidth, CONFIG.designHeight);
    const playerY = this.camera.worldToScreenY(this.player.y);
    const field = ctx.createRadialGradient(this.player.x, playerY, 28, this.player.x, playerY, 680);
    field.addColorStop(0, 'rgba(22,160,133,.06)');
    field.addColorStop(0.5, 'rgba(142,68,173,.07)');
    field.addColorStop(1, 'rgba(5,7,10,.46)');
    ctx.fillStyle = field;
    ctx.fillRect(0, 0, CONFIG.designWidth, CONFIG.designHeight);
    ctx.strokeStyle = 'rgba(52,152,219,.28)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 18; i += 1) {
      const y = (i * 74 + this.elapsed * 44) % CONFIG.designHeight;
      const length = i % 3 === 0 ? 28 : 14;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(length, y);
      ctx.moveTo(CONFIG.designWidth - length, y);
      ctx.lineTo(CONFIG.designWidth, y);
      ctx.stroke();
    }
  }
}
