import { CONFIG } from '../config.js?v=4.0.0';
import { LEVELS, difficultyAt, earnedStars } from '../data/levels.js?v=4.0.0';
import { Camera } from './Camera.js?v=4.0.0';
import { Player } from '../entities/Player.js?v=4.0.0';
import { Platform } from '../entities/Platform.js?v=4.0.0';
import { Enemy } from '../entities/Enemy.js?v=4.0.0';
import { MeleeEnemy } from '../entities/MeleeEnemy.js?v=4.0.0';
import { BossEnemy } from '../entities/BossEnemy.js?v=4.0.0';
import { Input } from '../systems/Input.js?v=4.0.0';
import { AudioSystem } from '../systems/AudioSystem.js?v=4.0.0';
import { EffectSystem } from '../systems/EffectSystem.js?v=4.0.0';
import { SkillSystem } from '../systems/SkillSystem.js?v=4.0.0';
import { UpgradeSystem } from '../systems/UpgradeSystem.js?v=4.0.0';
import { RogueSystem } from '../systems/RogueSystem.js?v=4.0.0';
import { SaveSystem } from '../systems/SaveSystem.js?v=4.0.0';
import { CardUI } from '../ui/CardUI.js?v=4.0.0';
import { HUD } from '../ui/HUD.js?v=4.0.0';
import { FlowUI, formatTime } from '../ui/FlowUI.js?v=4.0.0';

export class Game {
  constructor(canvas) {
    Object.assign(this, { canvas, ctx: canvas.getContext('2d', { alpha: false }), width: CONFIG.designWidth, height: CONFIG.designHeight, state: 'boot', running: false, paused: true, loopStarted: false, backdropTime: 0 });
    this.save = new SaveSystem();
    this.audio = new AudioSystem();
    this.audio.enabled = this.save.data.settings.sound;
    this.input = new Input(canvas, document.querySelector('#joystick'), document.querySelector('#joystickKnob'), () => this.skills?.isBulletTimeActive ? 'radial' : 'horizontal', () => this.state === 'playing' && !this.paused);
    this.ui = new HUD(this);
    this.cardUI = new CardUI(document.querySelector('#rogueOverlay'), document.querySelector('#cardContainer'), this.audio);
    this.flow = new FlowUI(this);
    this.stars = Array.from({ length: 100 }, () => ({ x: Math.random() * this.width, y: Math.random() * 1450, r: 0.5 + Math.random() * 1.5, a: 0.2 + Math.random() * 0.5 }));
    this.prepareRun(LEVELS[0]);
    this.running = false;
    this.bind(); this.resize();
  }

  bind() {
    document.querySelector('#pauseButton').onclick = () => this.pause();
    const skill = (selector, method) => {
      document.querySelector(selector).onpointerdown = event => {
        event.preventDefault();
        if (this.state !== 'playing' || this.paused || this.victoryTimer > 0) return;
        this.audio.unlock(); this.skills[method](this);
      };
      document.querySelector(selector).onclick = event => {
        // Native keyboard button activation (pointerdown already handles touch).
        if (event.detail === 0 && this.state === 'playing' && !this.paused) this.skills[method](this);
      };
    };
    skill('#bulletTimeButton', 'activateBulletTime'); skill('#timeJumpButton', 'activateTimeJump');
    addEventListener('keydown', event => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (event.key === 'Escape' || key === 'p') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
        else if (this.state === 'settings') this.setState(this.flow.settingsReturn || 'title');
        event.preventDefault(); return;
      }
      if (this.rogue.open && this.state === 'playing') return;
      if (key === 'r' && ['paused', 'result'].includes(this.state)) { event.preventDefault(); this.startLevel(this.level.id); return; }
      // Menus use native button focus + Enter/Space. Never steal those events.
      if (this.state !== 'playing' || this.paused || event.target.closest?.('button')) return;
      if (event.code === 'Space') { event.preventDefault(); this.audio.unlock(); this.skills.activateBulletTime(this); }
      if (['ArrowUp', 'w', 'W'].includes(event.key)) { event.preventDefault(); this.audio.unlock(); this.skills.activateTimeJump(this); }
      if (key === 'x') { event.preventDefault(); this.player.bufferJump(); }
    });
    addEventListener('resize', () => this.resize());
    addEventListener('blur', () => this.pause());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); this.last = performance.now(); });
  }

  setState(state) {
    this.state = state; this.paused = state !== 'playing' || this.rogue.open;
    this.input.clear();
    this.audio.setDucked(state === 'playing' && this.skills.isBulletTimeActive);
    this.flow.render(state);
    if (state === 'playing') this.canvas.focus({ preventScroll: true });
  }
  showSelect() {
    if (this.running && !this.finished) {
      // Quitting never unlocks a level, but a useful height/score still survives.
      this.save.record(this.level, this.runResult(false, 'quit'));
    }
    this.running = false; this.cardUI.hide(); this.rogue.open = false;
    this.flow.hints.hidden = true; this.setState('level-select');
  }
  pause() {
    if (this.state !== 'playing' || this.finished || this.victoryTimer > 0) return;
    if (this.rogue.open) this.cardUI.suspend();
    this.setState('paused');
  }
  resume() {
    if (!this.running || this.finished) return;
    this.last = performance.now(); this.setState('playing');
    if (this.rogue.open) this.cardUI.resume();
  }
  startLevel(id) {
    if (id < 1 || id > this.save.data.unlocked || id > LEVELS.length) return;
    if (this.running && !this.finished && this.elapsed > 0) this.save.record(this.level, this.runResult(false, 'quit'));
    this.audio.unlock(); this.prepareRun(LEVELS[id - 1]);
    this.setState('playing'); this.ui.update();
    document.querySelector('#levelLabel').textContent = `0${id} / ${this.level.name}`;
    this.flow.showHints();
    this.ui.toast(`第 ${id} 关 · ${this.level.goal}m + ${this.level.boss.name}`);
    this.last = performance.now();
  }
  prepareRun(level) {
    this.cardUI.hide(); this.flow.hints.hidden = true;
    Object.assign(this, { level, elapsed: 0, kills: 0, hitsTaken: 0, heightMeters: 0, highestY: 1070, finished: false, running: true, fireTimer: 0, enemySpawnTimer: 2, enemySpawnLock: 1.2, lastLandedPlatform: null, activeBoss: null, damageFlash: 0, damageFlashType: 'hurt', result: null, pendingClear: null, victoryTimer: 0, platformSerial: 0 });
    this.platforms = []; this.enemies = []; this.playerBullets = []; this.enemyBullets = [];
    this.bossState = { mid: { spawned: !level.mid, defeated: !level.mid }, final: { spawned: false, defeated: false } };
    this.effects = new EffectSystem(); this.upgrades = new UpgradeSystem();
    this.camera = new Camera(this.height);
    this.player = new Player(377, 1070, this.input, this.upgrades);
    this.player.hp = this.player.maxHp = level.hp;
    this.skills = new SkillSystem(this.upgrades, this.audio, this.ui);
    this.rogue = new RogueSystem(this.cardUI, this.upgrades, this.audio, level.milestones);
    this.input.clear(); this.ui.updateUpgradeList(); this.resetWorld();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect(), ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.floor(rect.width * ratio)); this.canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    this.camera.resize(this.height);
  }
  resetWorld() {
    this.platforms = [new Platform(0, 1220, this.width, 'ground'), new Platform(237, 1075, 280)];
    let y = 1075;
    for (let i = 0; i < 32; i++) { y -= this.platformGap(y); this.createPlatform(y); }
  }
  metersForWorldY(y) { return Math.max(0, (1070 - y) / CONFIG.heightWorldUnitsPerMeter); }
  difficulty(meters = this.heightMeters) { return difficultyAt(this.level, meters); }
  platformGap(y) { return this.difficulty(this.metersForWorldY(y)).gap + Math.random() * 12; }
  getPlatformWidth(y) { return this.difficulty(this.metersForWorldY(y)).width + Math.random() * 36; }
  createPlatform(y) {
    const d = this.difficulty(this.metersForWorldY(y)), width = this.getPlatformWidth(y);
    const previous = this.platforms[this.platforms.length - 1];
    const center = previous.x + previous.width / 2;
    const serial = ++this.platformSerial;
    // Level-specific rhythm, constrained to a reachable lateral displacement.
    let direction = Math.random() < 0.5 ? -1 : 1;
    if (this.level.id === 2) direction = serial % 4 < 2 ? -1 : 1;
    if (this.level.id === 3) direction = serial % 6 < 3 ? -1 : 1;
    if (this.level.id >= 4) direction = serial % 2 ? -1 : 1;
    const x = Math.max(18, Math.min(this.width - width - 18, center + direction * (45 + Math.random() * (d.stride - 45)) - width / 2));
    const roll = Math.random();
    // A fixed landing every fourth platform prevents an all-fragile sequence.
    const type = serial % 4 === 0 ? 'normal' : roll < d.moving ? 'moving' : roll < d.moving + d.fragile ? 'break' : 'normal';
    this.platforms.push(new Platform(x, y, width, type));
  }
  getEnemySpawnSafety() { return { minAhead: 330, maxAhead: 830, minDistance: 355 }; }
  isSafeEnemySpawnPlatform(platform) {
    if (!platform || platform.enemyUsed || platform.type === 'ground' || platform === this.lastLandedPlatform || platform.dead || platform.type === 'break') return false;
    const x = platform.x + platform.width / 2, ahead = this.player.y - platform.y;
    const safety = this.getEnemySpawnSafety();
    if (ahead < safety.minAhead || ahead > safety.maxAhead || Math.hypot(x - this.player.x, ahead) < safety.minDistance) return false;
    if (platform.y < this.camera.y + 330) return false;
    return !this.enemies.some(enemy => !enemy.dead && Math.hypot(enemy.x - x, enemy.y - platform.y) < 190);
  }
  spawnEnemy(platform) {
    if (this.activeBoss || !this.isSafeEnemySpawnPlatform(platform)) return false;
    const d = this.difficulty(), roll = Math.random();
    const kind = roll < d.melee ? 'melee' : roll < d.melee + d.sniper ? 'sniper' : 'ranged';
    platform.enemyUsed = true;
    const enemy = kind === 'melee' ? new MeleeEnemy(platform.x + platform.width / 2, platform.y - 35, d.toughness, platform) : new Enemy(platform.x + platform.width / 2, platform.y - 35, d.toughness, platform, kind);
    this.enemies.push(enemy); this.effects.burst(enemy.x, enemy.y, 8, kind === 'melee' ? '#f4a742' : '#91bdff');
    return true;
  }
  start() {
    if (this.loopStarted) return;
    this.loopStarted = true; this.last = performance.now();
    requestAnimationFrame(time => this.loop(time));
    setTimeout(() => { document.querySelector('#bootSplash').classList.add('done'); this.setState('title'); }, 280);
  }
  loop(time) {
    const dt = Math.min(0.033, Math.max(0, (time - this.last) / 1000)); this.last = time;
    this.backdropTime += dt;
    if (this.state === 'playing' && !this.paused) this.update(dt);
    this.render(); requestAnimationFrame(next => this.loop(next));
  }
  update(dt) {
    if (this.victoryTimer > 0) {
      this.effects.tick(dt); this.ui.update();
      this.victoryTimer = Math.max(0, this.victoryTimer - dt);
      if (this.victoryTimer === 0) this.finishRun(true);
      return;
    }
    this.elapsed += dt;
    this.ui.update();
    document.querySelector('#runClock').textContent = formatTime(this.elapsed);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 4.6);
    if (this.effects.tick(dt, this.skills.isBulletTimeActive ? 0.4 : 1)) return;
    this.enemySpawnLock = Math.max(0, this.enemySpawnLock - dt);
    this.input.syncMode(); this.skills.update(dt, this);
    this.audio.setDucked(this.skills.isBulletTimeActive);
    this.player.update(dt, this);
    for (const platform of this.platforms) platform.update(dt * this.skills.enemyTimeScale);
    this.collisions();
    // The camera only climbs: falling below the viewport is an actual loss.
    if (this.player.y > this.camera.y + this.height + this.player.radius) { this.finishRun(false, 'fell'); return; }
    this.camera.update(this.player); this.generate();
    this.highestY = Math.min(this.highestY, this.player.y);
    this.heightMeters = Math.min(this.level.goal, Math.max(0, Math.floor((1070 - this.highestY) / CONFIG.heightWorldUnitsPerMeter)));
    this.checkBossEvents();
    if (!this.activeBoss) this.maintainEnemies(dt);
    for (const enemy of this.enemies) { enemy.update(dt, this); if (this.finished) return; }
    this.updateBullets(dt);
    if (this.finished || this.victoryTimer > 0) return;
    this.autoFire(dt);
    this.platforms = this.platforms.filter(p => !p.dead && p.y > this.camera.y - 1900 && p.y < this.camera.y + 1800);
    this.enemies = this.enemies.filter(e => !e.dead && (e.isBoss || (e.y > this.camera.y + 170 && e.y < this.camera.y + this.height + 100)));
    if (this.heightMeters >= this.level.goal && this.bossState.final.defeated) { this.finishRun(true); return; }
    if (!this.activeBoss) this.rogue.update(this);
  }
  checkBossEvents() {
    if (this.level.mid && !this.bossState.mid.spawned && this.heightMeters >= this.level.mid.at) this.spawnBoss('mid');
    else if (this.bossState.mid.defeated && !this.bossState.final.spawned && this.heightMeters >= this.level.goal) this.spawnBoss('final');
  }
  spawnBoss(tier) {
    const state = this.bossState[tier]; if (state.spawned) return;
    state.spawned = true;
    this.enemies = this.enemies.filter(e => e.isBoss && !e.dead);
    this.enemyBullets.length = 0; this.enemySpawnLock = 2;
    const boss = new BossEnemy(tier, this); this.activeBoss = boss; this.enemies.push(boss);
    this.audio.play('bossWarning'); this.effects.impact(0.4, 0.05);
    this.effects.ring(boss.x, boss.y, this.level.color);
    this.ui.toast(`${tier === 'final' ? '峰顶守卫' : '中途守卫'} · ${boss.bossName}`);
  }
  onBossDefeated(boss) {
    this.bossState[boss.tier].defeated = true; this.activeBoss = null;
    this.enemyBullets.length = 0; this.enemySpawnLock = 2; this.kills++;
    this.ui.toast(boss.tier === 'final' ? '峰顶已清空！' : '守卫已击破 · 生命恢复 +1');
    if (boss.tier === 'mid') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
    else {
      // Let the death burst breathe; freeze the winning stats before celebration.
      this.victoryTimer = 0.65; this.pendingClear = this.runResult(true);
      this.save.record(this.level, this.pendingClear);
    }
  }
  onEnemyHit(enemy, amount, source) {
    enemy.hitFlash = 0.12;
    const direction = source ? Math.sign(source.vx) : Math.sign(enemy.x - this.player.x);
    enemy.knockback = (enemy.knockback || 0) + direction * (enemy.isBoss ? 10 : enemy.kind === 'melee' ? 70 : 130);
    this.effects.number(enemy.x, enemy.y, `${Math.min(amount, Math.max(0, enemy.hp + amount))}`, enemy.dead ? '#75e8bc' : '#fff5c9', enemy.dead);
    this.effects.burst(enemy.x, enemy.y, enemy.dead ? 18 : 6, enemy.dead ? this.level.color : '#fff3bc');
    this.effects.impact(enemy.dead ? (enemy.isBoss ? 0.8 : 0.25) : 0.08, enemy.dead ? (enemy.isBoss ? 0.075 : 0.05) : enemy.isBoss ? 0.035 : 0.03);
  }
  onPlayerHit(shielded = false) {
    if (!shielded) this.hitsTaken++;
    this.effects.impact(shielded ? 0.4 : 0.8, shielded ? 0.035 : 0.075);
    this.damageFlash = 1; this.damageFlashType = shielded ? 'shield' : 'hurt';
    const color = shielded ? '#91bdff' : '#ff918e';
    this.effects.burst(this.player.x, this.player.y, 24, color);
    this.effects.ring(this.player.x, this.player.y, color);
    this.effects.number(this.player.x, this.player.y, shielded ? '格挡' : '−1', color, true);
    this.ui.flashDamage(shielded);
  }
  collisions() {
    if (this.player.vy <= 0 || this.skills.isTimeJumpAnimating) return;
    for (const platform of this.platforms) {
      if (platform.dead) continue;
      const crosses = this.player.prevY + this.player.radius <= platform.y && this.player.y + this.player.radius >= platform.y;
      if (!crosses) continue;
      const overlaps = this.player.x > platform.x - 12 && this.player.x < platform.x + platform.width + 12;
      if (overlaps) {
        const impact = this.player.vy;
        this.player.y = platform.y - this.player.radius; this.player.bounce();
        this.lastLandedPlatform = platform; this.enemySpawnLock = Math.max(this.enemySpawnLock, 0.6);
        platform.triggerBreak(); this.audio.play('land'); this.audio.play('jump');
        this.effects.burst(this.player.x, platform.y, 7, '#c5e2d8', 0.55);
        if (impact > 850) this.effects.impact(0.28);
        break;
      }
      if (this.player.x > platform.x - 48 && this.player.x < platform.x + platform.width + 48) this.player.offerCoyote();
    }
  }
  maintainEnemies(dt) {
    this.enemySpawnTimer -= dt;
    if (this.enemySpawnTimer > 0 || this.enemySpawnLock > 0 || this.heightMeters < 80) return;
    const d = this.difficulty();
    const visible = this.enemies.filter(e => !e.dead && !e.isBoss && e.y > this.camera.y + 250 && e.y < this.camera.y + this.height);
    if (visible.length < Math.ceil(d.density)) {
      const candidates = this.platforms.filter(p => this.isSafeEnemySpawnPlatform(p));
      candidates.sort((a, b) => Math.abs(this.player.y - a.y - 530) - Math.abs(this.player.y - b.y - 530));
      if (candidates.length) this.spawnEnemy(candidates[Math.floor(Math.random() * Math.min(3, candidates.length))]);
    }
    this.enemySpawnTimer = d.spawn;
  }
  autoFire(dt) {
    this.fireTimer -= dt; if (this.fireTimer > 0) return;
    const targets = this.enemies.filter(e => !e.dead && e.y > this.camera.y + 200 && e.y < this.camera.y + this.height - 100 && Math.hypot(e.x - this.player.x, e.y - this.player.y) < 980);
    targets.sort((a, b) => Math.hypot(a.x - this.player.x, a.y - this.player.y) - Math.hypot(b.x - this.player.x, b.y - this.player.y));
    const target = targets[0]; if (!target) return;
    this.fireTimer = Math.max(0.15, CONFIG.playerFireInterval * this.upgrades.stats.fireRate);
    const baseAngle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    const count = this.upgrades.stats.projectiles, speed = CONFIG.playerBulletSpeed * this.upgrades.stats.bulletSpeed;
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i - (count - 1) / 2) * 0.075;
      this.playerBullets.push({ x: this.player.x, y: this.player.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 6, damage: this.upgrades.stats.damage, pierce: this.upgrades.stats.penetration, life: 2.2, hit: new Set() });
    }
    this.player.muzzleAngle = baseAngle; this.player.muzzleTimer = 0.07;
    this.effects.muzzle(this.player.x, this.player.y, baseAngle); this.audio.play('shot');
  }
  updateBullets(dt) {
    const enemyScale = this.skills.enemyTimeScale;
    for (const bullet of this.enemyBullets) {
      if (bullet.life <= 0) continue;
      bullet.x += bullet.vx * dt * enemyScale; bullet.y += bullet.vy * dt * enemyScale; bullet.life -= dt * enemyScale;
      if (Math.hypot(bullet.x - this.player.x, bullet.y - this.player.y) < bullet.radius + this.player.radius - 7) {
        bullet.life = 0; this.player.damage(this, bullet);
        if (this.finished) break;
      }
    }
    if (this.finished) return;
    for (const bullet of this.playerBullets) {
      bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.life -= dt;
      if (bullet.life <= 0) continue;
      for (const enemy of this.enemies) {
        if (enemy.dead || bullet.hit.has(enemy) || enemy.spawnTimer > 0) continue;
        if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < bullet.radius + enemy.radius) {
          bullet.hit.add(enemy); enemy.damage(bullet.damage, this, bullet); this.audio.play('hit');
          if (bullet.pierce > 0) bullet.pierce--; else bullet.life = 0;
          break;
        }
      }
    }
    this.enemyBullets = this.enemyBullets.filter(b => b.life > 0 && Math.abs(b.x - this.width / 2) < this.width && b.y > this.camera.y - 100 && b.y < this.camera.y + this.height + 100).slice(-220);
    this.playerBullets = this.playerBullets.filter(b => b.life > 0);
  }
  generate() {
    let top = Math.min(...this.platforms.map(p => p.y));
    while (top > this.camera.y - 1600) { top -= this.platformGap(top); this.createPlatform(top); }
  }
  runResult(win, cause = 'damage') {
    const result = { win, cause, height: Math.min(this.level.goal, this.heightMeters), time: this.elapsed, kills: this.kills, hits: this.hitsTaken, hp: this.player.hp, maxHp: this.player.maxHp };
    result.stars = earnedStars(this.level, result);
    result.score = Math.round(result.height * 10 + result.kills * 100 + (win ? 2000 + result.stars * 1000 + Math.max(0, this.level.par - result.time) * 10 : 0));
    return result;
  }
  finishRun(win, cause = 'damage') {
    if (this.finished) return;
    this.finished = true; this.result = win && this.pendingClear ? this.pendingClear : this.runResult(win, cause);
    this.save.record(this.level, this.result); this.cardUI.hide(); this.rogue.open = false;
    this.flow.hints.hidden = true; this.audio.setDucked(false); this.audio.play(win ? 'win' : 'lose');
    this.setState('result');
  }
  render() {
    const ctx = this.ctx;
    const scaleX = this.canvas.width / CONFIG.designWidth;
    const scaleY = this.canvas.height / CONFIG.designHeight;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const shakeX = (Math.random() - 0.5) * this.effects.shake;
    const shakeY = (Math.random() - 0.5) * this.effects.shake;
    ctx.setTransform(scaleX, 0, 0, scaleY, shakeX * scaleX, shakeY * scaleY);

    const background = ctx.createLinearGradient(0, 0, 0, CONFIG.designHeight);
    background.addColorStop(0, '#040608');
    background.addColorStop(1, this.level.background);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, CONFIG.designWidth, CONFIG.designHeight);

    for (const star of this.stars) {
      ctx.globalAlpha = star.a;
      ctx.fillStyle = '#ecf0f1';
      ctx.beginPath();
      ctx.arc(star.x, ((star.y - this.camera.y * 0.03 + this.backdropTime * 7) % 1450 + 1450) % 1450, star.r, 0, Math.PI * 2);
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
