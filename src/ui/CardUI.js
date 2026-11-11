export class CardUI {
  constructor(overlay, container, audio) {
    Object.assign(this, { overlay, container, audio, buttons: [], index: 0, cb: null });
    this.handler = event => this.onKey(event);
  }
  hide() {
    clearTimeout(this.timer); this.cb = null;
    this.suspend(); this.suspended = false;
    document.querySelector('#cardSelectionFlash')?.classList.remove('show');
  }
  suspend() {
    this.suspended = true;
    removeEventListener('keydown', this.handler, true);
    this.overlay.classList.remove('show'); this.overlay.setAttribute('aria-hidden', 'true'); this.overlay.inert = true;
  }
  resume() {
    if (!this.cb) return;
    this.suspended = false;
    this.overlay.inert = false; this.overlay.classList.add('show'); this.overlay.setAttribute('aria-hidden', 'false');
    addEventListener('keydown', this.handler, true);
    this.buttons[this.index]?.button.focus({ preventScroll: true });
  }
  show(cards, game, level, total, cb) {
    this.hide(); this.cb = cb; this.container.innerHTML = '';
    document.querySelector('#rogueLevelText').textContent = `BUILD ${level} / ${total}`;
    this.buttons = cards.map(card => {
      const stack = game.upgrades.getStack(card.id) + 1, button = document.createElement('button');
      button.type = 'button'; button.className = `rogue-card ${card.category}`;
      button.innerHTML = `<div class="card-top-row"><span class="card-icon">${card.icon}</span></div><div class="card-content"><h3>${card.name}</h3><p>${card.desc(game, stack)}</p></div><div class="card-stack-row"><span class="card-stack">升级后层数 ${stack}/${card.max}</span></div><div class="card-button-row"><span class="card-pick">选择</span></div>`;
      button.addEventListener('click', () => this.select(card, button)); this.container.appendChild(button);
      return { button, card };
    });
    this.index = 0; this.updateSelection(); this.resume();
  }
  onKey(event) {
    if (!this.cb || !this.overlay.classList.contains('show')) return;
    if (['ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D'].includes(event.key)) {
      event.preventDefault(); event.stopImmediatePropagation();
      this.index = (this.index + (['ArrowLeft', 'a', 'A'].includes(event.key) ? -1 : 1) + this.buttons.length) % this.buttons.length;
      this.audio.play('rogueMove'); this.updateSelection();
    } else if (event.key === 'Enter' || event.code === 'Space') {
      event.preventDefault(); event.stopImmediatePropagation();
      const item = this.buttons[this.index]; if (item) this.select(item.card, item.button);
    }
  }
  updateSelection() {
    this.buttons.forEach((item, index) => item.button.classList.toggle('keyboard-selected', index === this.index));
  }
  select(card, button) {
    if (!this.cb || this.suspended) return;
    const cb = this.cb; this.cb = null;
    removeEventListener('keydown', this.handler, true); button.classList.add('selected-duang');
    this.buttons.forEach(item => { item.button.disabled = true; if (item.button !== button) item.button.classList.add('dismissed'); });
    const flash = document.querySelector('#cardSelectionFlash');
    flash.classList.remove('show'); void flash.offsetWidth; flash.classList.add('show');
    this.audio.play('roguePick');
    this.timer = setTimeout(() => { this.suspend(); this.suspended = false; flash.classList.remove('show'); cb(card); }, 300);
  }
}
