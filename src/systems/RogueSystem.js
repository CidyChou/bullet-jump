import { CARDS } from '../data/cards.js?v=4.0.0';

export class RogueSystem {
  constructor(ui, upgrades, audio, milestones) {
    Object.assign(this, { ui, u: upgrades, audio, m: [...milestones], selectedCount: 0, open: false });
  }
  get maxSelections() { return this.m.length; }
  get nextHeight() { return this.m[this.selectedCount] ?? Infinity; }
  update(game) {
    if (!this.open && this.selectedCount < this.maxSelections && game.heightMeters >= this.nextHeight) this.show(game);
  }
  show(game) {
    this.open = true; game.paused = true; game.input.clear();
    document.querySelector('#playUI').inert = true; game.canvas.inert = true; this.audio.play('rogueOpen');
    const cards = ['mobility', 'weapon', 'defense'].map(category => {
      const pool = CARDS.filter(card => card.category === category && this.u.getStack(card.id) < card.max);
      return pool[Math.floor(Math.random() * pool.length)];
    }).filter(Boolean).sort(() => Math.random() - 0.5);
    this.ui.show(cards, game, this.selectedCount + 1, this.maxSelections, card => {
      card.apply(game, this.u.getStack(card.id) + 1); this.u.addStack(card.id); this.selectedCount++;
      game.ui.updateUpgradeList(); game.ui.toast(`获得：${card.name}`);
      this.open = false; game.paused = game.state !== 'playing'; game.input.clear();
      document.querySelector('#playUI').inert = game.paused; game.canvas.inert = game.paused;
      if (!game.paused) game.canvas.focus({ preventScroll: true });
    });
  }
}
