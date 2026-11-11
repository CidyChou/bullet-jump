import { LEVELS } from '../data/levels.js?v=4.0.0';

export function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
const stars = count => `${'★'.repeat(count)}${'☆'.repeat(3 - count)}`;

export class FlowUI {
  constructor(game) {
    this.game = game;
    this.root = document.querySelector('#flowRoot');
    this.screen = document.querySelector('#flowScreen');
    this.app = document.querySelector('#app');
    this.hints = document.querySelector('#tutorialHint');
    this.hintIndex = 0;
    this.hints.querySelector('button').onclick = () => this.advanceHint();
    this.root.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (!button || button.disabled) return;
      game.audio.unlock(); game.audio.play('ui');
      const action = button.dataset.action;
      if (action === 'play' || action === 'select') game.showSelect();
      else if (action === 'title') game.setState('title');
      else if (action === 'level') game.startLevel(Number(button.dataset.level));
      else if (action === 'resume') game.resume();
      else if (action === 'retry') game.startLevel(game.level.id);
      else if (action === 'next') game.startLevel(game.level.id + 1);
      else if (action === 'settings') { this.settingsReturn = game.state; game.setState('settings'); }
      else if (action === 'settings-back') game.setState(this.settingsReturn || 'title');
      else if (action === 'sound') {
        game.save.data.settings.sound = !game.save.data.settings.sound;
        game.audio.setEnabled(game.save.data.settings.sound); game.save.persist(); this.render(game.state);
      } else if (action === 'help') { game.resume(); this.showHints(true); }
    });
  }
  button(label, action, secondary = false, extra = '') {
    return `<button class="flow-button ${secondary ? 'secondary' : 'primary'}" data-action="${action}" ${extra}>${label}</button>`;
  }
  render(state) {
    const g = this.game;
    this.app.dataset.state = state;
    const active = ['playing', 'paused', 'result', 'settings'].includes(state) && g.running;
    document.querySelector('#playUI').hidden = !active;
    document.querySelector('#playUI').inert = state !== 'playing' || g.paused;
    g.canvas.inert = state !== 'playing' || g.paused;
    const menu = state !== 'playing' && state !== 'boot';
    this.root.hidden = !menu;
    this.root.inert = !menu;
    if (!menu) return;
    let html = '';
    if (state === 'title') {
      html = `<div class="title-art" aria-hidden="true"><i class="orbit one"></i><i class="orbit two"></i><i class="hero-mark"><b></b></i><span class="art-platform p1"></span><span class="art-platform p2"></span><span class="art-shot"></span><span class="art-coordinate">TIME IS YOUR WEAPON</span></div>
        <div class="eyebrow">THE FIVE SUMMITS · 五座高峰</div><h1>BULLET<br><span>JUMP</span><sup>4.0</sup></h1><p class="title-tagline">向上跃迁。让时间，为你停留。</p>
        <div class="flow-actions">${this.button('开始攀登 <span>↗</span>', 'play')}${this.button('设置', 'settings', true)}</div>
        <footer class="flow-footer">自动跳跃 · 自动射击 · 五关战役<span>v4.0.0</span></footer>`;
    } else if (state === 'level-select') {
      const total = g.save.data.levels.reduce((sum, level) => sum + level.stars, 0);
      html = `<div class="screen-top">${this.button('‹ 返回', 'title', true)}<span>${total} / 15 ★</span></div><div class="eyebrow">CHOOSE YOUR SUMMIT</div><h2>下一座高峰</h2><p class="screen-copy">抵达目标高度，击败守卫，解锁下一关。</p><div class="level-list">${LEVELS.map(level => {
        const locked = level.id > g.save.data.unlocked;
        const record = g.save.data.levels[level.id - 1];
        return `<button class="level-slot ${locked ? 'locked' : ''}" style="--accent:${level.color}" data-action="level" data-level="${level.id}" ${locked ? 'disabled' : ''} aria-label="第${level.id}关 ${level.name}，${locked ? '锁定，通关前一关解锁' : `已获${record.stars}星`} ${level.goal}米">
          <span class="level-number">0${level.id}</span><span class="level-info"><span class="level-name">${level.name} <small>${level.english}</small></span><span class="level-detail">${locked ? '锁定 · 通关前一关解锁' : `${level.goal.toLocaleString()}m · ${level.boss.name}`}</span><span class="level-record">${record.bestTime ? `最佳 ${formatTime(record.bestTime)} · ` : ''}${record.bestHeight ? `最高 ${Math.floor(record.bestHeight)}m` : level.description}</span></span><span class="level-rating"><span>${locked ? '⌑' : stars(record.stars)}</span><small>${locked ? 'LOCKED' : '挑战 ↗'}</small></span></button>`;
      }).join('')}</div><p class="save-note" role="status">${g.save.available ? '进度自动保存在此浏览器' : '浏览器无法写入存档，本次进度暂存于内存'}</p>`;
    } else if (state === 'paused') {
      html = `<div class="pause-symbol" aria-hidden="true">Ⅱ</div><div class="eyebrow">TAKE A BREATH</div><h2>时间已暂停</h2><p class="screen-copy">第 ${g.level.id} 关 · ${g.level.name}　${g.heightMeters}m / ${g.level.goal}m</p><div class="flow-actions">${this.button('继续攀登', 'resume')}${this.button('重新挑战', 'retry', true)}${this.button('声音与设置', 'settings', true)}${this.button('操作提示', 'help', true)}${this.button('结束本局 · 返回选关', 'select', true)}</div><p class="muted">Esc / P 继续 · R 重试</p>`;
    } else if (state === 'settings') {
      html = `<div class="screen-top">${this.button('‹ 返回', 'settings-back', true)}</div><div class="eyebrow">PREFERENCES</div><h2>按你的节奏</h2><p class="screen-copy">声音设置会自动保存。</p><button class="setting-row" data-action="sound" aria-pressed="${g.save.data.settings.sound}"><span>合成音效<small>射击、命中与时间技能</small></span><b>${g.save.data.settings.sound ? '开启 ●' : '关闭 ○'}</b></button><div class="control-guide"><p><b>电脑</b>　← → / A D 移动<br>空格 子弹时间 · ↑ / W 时间跳跃<br>Esc / P 暂停 · X 边缘补跳</p><p><b>手机</b>　按住画面，左右拖动<br>底部技能按钮可同时操作<br>自动跳跃与射击，落在平台即可继续</p><p>蓝台移动 · 橙台触碰后碎裂<br>左右边界相通；坠出镜头即失败。</p></div>`;
    } else if (state === 'result') {
      const r = g.result;
      html = `<div class="result-emblem ${r.win ? 'win' : ''}" aria-hidden="true">${r.win ? '↗' : '↻'}</div><div class="eyebrow">${r.win ? (g.level.id === 5 ? 'CAMPAIGN COMPLETE' : 'SUMMIT SECURED') : 'ONE MORE ASCENT'}</div><h2>${r.win ? (g.level.id === 5 ? '时间，属于你' : '高峰已征服') : '再跃一步'}</h2><p class="screen-copy">${r.win ? `第 ${g.level.id} 关 · ${g.level.boss.name} 已击破` : `${r.cause === 'fell' ? '坠出了攀登区域' : '生命耗尽'} · 已完成 ${Math.floor(r.height / g.level.goal * 100)}%`}</p><div class="result-stars" aria-label="本局${r.stars}星">${stars(r.stars)}</div><div class="result-stats"><div><small>攀登高度</small><strong>${r.height}<em>m</em></strong></div><div><small>战斗用时</small><strong>${formatTime(r.time)}</strong></div><div><small>击破 / 受伤</small><strong>${r.kills}<em> / ${r.hits}</em></strong></div><div><small>本局得分</small><strong>${r.score.toLocaleString()}</strong></div></div><p class="star-rule">★ 通关　★★ ≤${formatTime(g.level.par)} 或剩余生命≥60%<br>★★★ 同时达成时间与生命目标</p><div class="flow-actions">${r.win && g.level.id < 5 ? this.button(`下一关 · ${LEVELS[g.level.id].name} ↗`, 'next') : this.button(r.win ? '回到五座高峰' : '再次挑战 ↻', r.win ? 'select' : 'retry')}${r.win ? this.button('重试 · 挑战三星', 'retry', true) : ''}${!(r.win && g.level.id === 5) ? this.button('返回选关', 'select', true) : ''}</div><p class="save-note">${g.save.available ? '最佳成绩与星级已保存' : '存档不可用，成绩暂存于本次会话'}</p>`;
    }
    this.screen.innerHTML = html;
    this.screen.className = `flow-screen screen-${state}`;
    this.screen.scrollTop = 0;
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.screen.getAnimations?.().forEach(animation => animation.cancel());
    this.screen.animate?.([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: reducedMotion ? 1 : 240, easing: 'ease-out' });
    // Move keyboard focus out of hidden screens without scrolling the game.
    this.screen.querySelector(state === 'level-select' ? `[data-level="${g.save.data.unlocked}"]` : 'button:not(:disabled)')?.focus({ preventScroll: true });
  }
  showHints(replay = false) {
    if (this.game.save.data.seenTutorial && !replay) return;
    this.hintIndex = 0; this.updateHint();
    this.hints.hidden = false;
  }
  updateHint() {
    const hints = [
      ['01 / 移动', '按住画面左右拖动，或用 ← → / A D。角色自动弹跳，靠近敌人自动射击。'],
      ['02 / 掌控时间', '空格 / 左下按钮：子弹时间。↑ / W / 右下按钮：时间跳跃，救险或冲高。'],
      ['03 / 征服高峰', '蓝台会移动，橙台会碎裂。左右边界相通。抵达目标并击败 Boss 即通关。'],
    ];
    const [title, text] = hints[this.hintIndex];
    this.hints.querySelector('strong').textContent = title;
    this.hints.querySelector('p').textContent = text;
    this.hints.querySelector('button').textContent = this.hintIndex === 2 ? '开始攀登' : '知道了 · 下一条';
  }
  advanceHint() {
    this.game.audio.unlock(); this.game.audio.play('ui');
    if (++this.hintIndex < 3) this.updateHint();
    else this.dismissHints();
  }
  dismissHints() {
    this.hints.hidden = true;
    this.game.save.data.seenTutorial = true; this.game.save.persist();
    if (this.game.state === 'playing') this.game.canvas.focus({ preventScroll: true });
  }
}
