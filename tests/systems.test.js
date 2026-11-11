import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { LEVELS, difficultyAt, earnedStars } from '../src/data/levels.js';
import { SaveSystem, SAVE_KEY } from '../src/systems/SaveSystem.js';
import { Player } from '../src/entities/Player.js';
import { Camera } from '../src/game/Camera.js';
import { EffectSystem } from '../src/systems/EffectSystem.js';
import { UpgradeSystem } from '../src/systems/UpgradeSystem.js';
import { BossEnemy } from '../src/entities/BossEnemy.js';
import { Game } from '../src/game/Game.js';

const memoryStorage = initial => ({ value: initial ?? null, getItem() { return this.value; }, setItem(key, value) { assert.equal(key, SAVE_KEY); this.value = value; } });

test('save defaults, corrupt/unsupported/hostile storage never crash', () => {
  for (const raw of [null, '{broken', 'null', '[]', '{"version":9}', '{"version":1,"unlocked":-9,"levels":[{"stars":99,"bestHeight":-100,"bestTime":"bad"}]}']) {
    const save = new SaveSystem(memoryStorage(raw));
    assert.equal(save.data.levels.length, 5);
    assert.ok(save.data.unlocked >= 1 && save.data.unlocked <= 5);
    assert.ok(save.data.levels.every(item => item.stars <= 3 && item.bestHeight >= 0));
  }
  const denied = new SaveSystem({ getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } });
  denied.record(LEVELS[0], { win: true, time: 90, height: 1400, stars: 3, score: 10000 });
  assert.equal(denied.data.unlocked, 2); assert.equal(denied.available, false);
});

test('progress, stars, scores and clear times improve monotonically and persist', () => {
  const storage = memoryStorage(), save = new SaveSystem(storage);
  save.record(LEVELS[0], { win: true, time: 95, height: 1400, stars: 3, score: 25000 });
  save.record(LEVELS[0], { win: false, time: 30, height: 90, stars: 0, score: 1000 });
  save.record(LEVELS[0], { win: true, time: 140, height: 1400, stars: 1, score: 20000 });
  const reloaded = new SaveSystem(storage);
  assert.equal(reloaded.data.unlocked, 2);
  assert.deepEqual(reloaded.data.levels[0], { stars: 3, bestHeight: 1400, bestTime: 95, bestScore: 25000 });
});

test('star boundaries use the same time + remaining HP rule in all five levels', () => {
  for (const level of LEVELS) {
    const base = { win: true, time: level.par, hp: 3, maxHp: 5 };
    assert.equal(earnedStars(level, base), 3);
    assert.equal(earnedStars(level, { ...base, time: level.par + 0.01 }), 2);
    assert.equal(earnedStars(level, { ...base, hp: 2 }), 2);
    assert.equal(earnedStars(level, { ...base, hp: 2, time: level.par + 1 }), 1);
    assert.equal(earnedStars(level, { ...base, win: false }), 0);
  }
});

test('each level has a gentle start, a sharp late ramp, reachable gaps, useful milestones and a distinct boss', () => {
  assert.equal(new Set(LEVELS.map(level => level.boss.id)).size, 5);
  for (const level of LEVELS) {
    const start = difficultyAt(level, 0), early = difficultyAt(level, level.rampStart * level.goal);
    const middle = difficultyAt(level, level.goal * 0.6), late = difficultyAt(level, level.goal);
    assert.ok(early.density < start.density + 0.3);
    assert.ok(late.density > middle.density * 1.7);
    assert.ok(late.width < early.width - 45);
    assert.ok(late.gap + 12 < 960 ** 2 / (2 * 1850) - 30);
    assert.ok(level.milestones.every((height, i) => height < level.goal && (!i || height > level.milestones[i - 1])));
  }
  assert.ok(difficultyAt(LEVELS[4], LEVELS[4].goal).toughness > difficultyAt(LEVELS[0], LEVELS[0].goal).toughness * 4);
});

test('coyote and buffered rescue jumps work for 100/110ms; shields grant immunity', () => {
  const player = new Player(100, 100, { horizontalAxis: 0 }, new UpgradeSystem());
  const game = { skills: { isTimeJumpAnimating: false, isBulletTimeActive: false }, audio: { play() {} }, effects: { burst() {} }, ui: { toast() {} }, onPlayerHit() {}, finishRun() {} };
  player.vy = 200; player.bufferJump(); player.offerCoyote(); player.update(0.016, game);
  assert.ok(player.vy < -800); assert.equal(player.coyoteTime, 0); assert.equal(player.jumpBuffer, 0);
  player.vy = 200; player.bufferJump(); player.update(0.12, game); player.offerCoyote(); player.update(0.016, game);
  assert.ok(player.vy > 0);
  player.shield = 1; player.damage(game, { x: 0 }); player.damage(game, { x: 0 });
  assert.equal(player.hp, 4); assert.equal(player.shield, 0); assert.ok(player.invulnerable > 0);
});

test('camera never follows a fall; hit stop is real-time and trauma is capped', () => {
  const camera = new Camera(1342); camera.update({ y: 200 }); const y = camera.y;
  camera.update({ y: 2000 }); assert.equal(camera.y, y);
  const fx = new EffectSystem(); fx.impact(5, 0.075); assert.ok(fx.shake <= 13);
  for (let i = 0; i < 6; i++) fx.tick(0.016, 0.19);
  assert.equal(fx.freeze, 0);
});

test('all bosses follow the visible arena and telegraph before their first attack', () => {
  for (const level of LEVELS) {
    const game = { level, camera: { y: -1000 }, player: { x: 377, y: -200, radius: 28, damage() {} }, skills: { enemyTimeScale: 1 }, upgrades: new UpgradeSystem(), enemyBullets: [], effects: { impact() {}, ring() {} }, audio: { play() {} } };
    const boss = new BossEnemy('final', game);
    for (let i = 0; i < 80; i++) boss.update(1 / 60, game);
    assert.equal(game.enemyBullets.length, 0);
    let warned = false;
    for (let i = 0; i < 300 && !game.enemyBullets.length; i++) { boss.update(1 / 60, game); warned ||= boss.warned; }
    assert.ok(warned); assert.ok(game.enemyBullets.length > 0);
    game.camera.y -= 600; boss.update(1 / 60, game);
    assert.ok(boss.y - game.camera.y > 480 && boss.y - game.camera.y < 650);
  }
});

test('HTML entry, static imports and every module resolve without a bundler', async () => {
  const walk = dir => readdirSync(dir).flatMap(name => { const path = resolve(dir, name); return statSync(path).isDirectory() ? walk(path) : [path]; });
  assert.match(readFileSync('index.html', 'utf8'), /src="\.\/src\/main.js\?v=4\.0\.0"/);
  for (const file of walk('src').filter(file => file.endsWith('.js'))) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) assert.ok(statSync(resolve(dirname(file), match[1].split('?')[0])).isFile(), `${file}: ${match[1]}`);
    if (!file.endsWith('/main.js')) await import(file);
  }
});

// No DOM package required: these small stand-ins exercise actual Game methods,
// not browser layout. A real-browser script is provided separately.
function fakeElement() {
  const classes = new Set(), children = new Map();
  return { hidden: false, inert: false, dataset: {}, style: {}, width: 755, height: 1342, offsetWidth: 160, offsetHeight: 50,
    classList: { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), contains: name => classes.has(name), toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } },
    setAttribute() {}, addEventListener() {}, removeEventListener() {}, focus() {}, appendChild() {}, scrollIntoView() {}, hasPointerCapture: () => false,
    getBoundingClientRect: () => ({ width: 755, height: 1342, left: 0, top: 0 }),
    querySelector(selector) { if (!children.has(selector)) children.set(selector, fakeElement()); return children.get(selector); },
  };
}

function gameHarness() {
  const elements = new Map();
  globalThis.document = { querySelector(selector) { if (!elements.has(selector)) elements.set(selector, fakeElement()); return elements.get(selector); }, getElementById(id) { return this.querySelector(`#${id}`); }, addEventListener() {}, createElement: fakeElement };
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  globalThis.window = { localStorage: memoryStorage() };
  const canvas = fakeElement(); canvas.parentElement = fakeElement();
  const calls = [];
  const gradient = { addColorStop() {} };
  canvas.getContext = () => new Proxy({}, { get(target, key) { if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient; return (...args) => { for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `non-finite ${key}`); calls.push(key); }; } });
  const game = new Game(canvas);
  game.audio.unlock = () => {}; game.audio.play = () => {};
  const renderFlow = game.flow.render.bind(game.flow);
  game.flow.render = () => {}; // Browser owns the actual DOM and focus behavior.
  return { game, calls, renderFlow };
}

test('actual run lifecycle: locked starts, pause, restart, falling loss, victory, unlock and next run', () => {
  const { game, calls } = gameHarness();
  game.startLevel(5); assert.equal(game.level.id, 1); assert.equal(game.state, 'boot');
  game.startLevel(1); game.update(1 / 60); const time = game.elapsed;
  game.pause(); assert.equal(game.paused, true); assert.equal(game.state, 'paused');
  game.input.left = true; game.resume(); assert.equal(game.input.left, false);
  game.player.hp = 1; game.upgrades.stats.damage = 10; game.skills.timeJumpCooldown = 3; game.startLevel(1);
  assert.equal(game.player.hp, 6); assert.equal(game.upgrades.stats.damage, 1); assert.equal(game.skills.timeJumpCooldown, 0); assert.equal(game.elapsed, 0);
  game.player.y = game.camera.y + game.height + 60; game.update(1 / 60);
  assert.equal(game.state, 'result'); assert.equal(game.result.cause, 'fell'); assert.equal(game.save.data.unlocked, 1);
  game.startLevel(1); game.heightMeters = game.level.goal; game.spawnBoss('final');
  const boss = game.activeBoss; boss.spawnTimer = 0; boss.damage(1000, game, { vx: 1 });
  game.finishRun(true);
  assert.equal(game.save.data.unlocked, 2); assert.equal(game.result.stars, 3);
  game.startLevel(2); assert.equal(game.level.id, 2); assert.equal(game.enemies.length, 0); assert.equal(game.heightMeters, 0);
  game.render(); assert.ok(calls.includes('arc') && calls.includes('fillRect'));
  assert.ok(time > 0);
});

test('seeded climbs traverse all five platform rhythms and enter every boss encounter', () => {
  const originalRandom = Math.random;
  try {
    for (const level of LEVELS) {
      let seed = 713 + level.id;
      Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
      const { game } = gameHarness();
      game.save.data.unlocked = 5; game.startLevel(level.id);
      // Route/physics simulation, not a claim about human combat difficulty:
      // disable incoming damage, choose weapon upgrades; actual bullets kill bosses.
      game.player.damage = () => {};
      game.cardUI.show = (cards, g, n, total, cb) => cb(cards.find(c => c.id === 'damage') || cards.find(c => c.category === 'weapon') || cards[0]);
      let steps = 0; const encounters = new Set();
      while (!game.finished && steps++ < 60000) {
        const player = game.player;
        // Pick the highest platform that the current jump can actually reach.
        const apexY = player.vy < 0 ? player.y - player.vy ** 2 / (2 * 1850) : player.y;
        const candidates = game.platforms.filter(p => !p.dead && p.y > apexY + player.radius + 8 && p.y < player.y + 180 && p !== game.lastLandedPlatform);
        candidates.sort((a, b) => a.y - b.y);
        const target = candidates[0];
        if (target) {
          const dx = target.x + target.width / 2 - player.x;
          game.input.left = dx < -12; game.input.right = dx > 12;
        } else { game.input.left = game.input.right = false; }
        game.update(1 / 60);
        if (game.activeBoss) encounters.add(game.activeBoss);
      }
      assert.equal(game.result?.win, true, `level ${level.id}: ${game.heightMeters}m after ${steps} frames (${game.result?.cause})`);
      assert.equal(encounters.size, level.mid ? 2 : 1);
      assert.equal(game.rogue.selectedCount, level.milestones.length);
      console.log(`Route L${level.id}: ${game.elapsed.toFixed(1)}s, ${steps} frames, ${encounters.size} bosses, ${game.rogue.selectedCount} cards`);
    }
  } finally { Math.random = originalRandom; }
});


test('settings/result/menu templates render, cards suspend safely, and skill taps buffer across cooldown', () => {
  const { game, renderFlow } = gameHarness();
  for (const state of ['title', 'level-select', 'settings']) {
    renderFlow(state);
    assert.ok(game.flow.screen.innerHTML.length > 300);
    assert.doesNotMatch(game.flow.screen.innerHTML, /undefined|NaN/);
  }
  game.startLevel(1);
  game.skills.timeJumpCooldown = 0.08;
  assert.equal(game.skills.activateTimeJump(game), false);
  for (let i = 0; i < 6; i++) game.skills.update(0.016, game);
  assert.equal(game.skills.jumpPhase, 'charging');
  game.rogue.show(game);
  assert.equal(game.paused, true); assert.equal(game.cardUI.buttons.length, 3);
  game.pause(); assert.equal(game.state, 'paused'); assert.equal(game.cardUI.suspended, true);
  renderFlow('paused'); assert.match(game.flow.screen.innerHTML, /data-action="resume"/);
  game.resume(); assert.equal(game.state, 'playing'); assert.equal(game.paused, true); assert.equal(game.cardUI.suspended, false);
  const apply = game.cardUI.cb, card = game.cardUI.buttons[0].card;
  game.cardUI.hide(); apply(card);
  assert.equal(game.paused, false); assert.equal(game.rogue.selectedCount, 1);
  game.finishRun(false); renderFlow('result');
  assert.match(game.flow.screen.innerHTML, /data-action="retry"/);
  assert.doesNotMatch(game.flow.screen.innerHTML, /undefined|NaN/);
});
