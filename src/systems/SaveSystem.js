import { LEVELS } from '../data/levels.js?v=4.0.0';

export const SAVE_KEY = 'bullet-jump-save-v1';
const emptyRecord = () => ({ stars: 0, bestHeight: 0, bestScore: 0, bestTime: null });
const defaults = () => ({ version: 1, unlocked: 1, levels: LEVELS.map(emptyRecord), settings: { sound: true }, seenTutorial: false });
const bounded = (value, max = 1e9) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(max, value) : 0;

export class SaveSystem {
  constructor(storage) {
    this.storage = storage;
    this.available = true;
    this.data = defaults();
    try {
      this.storage ??= window.localStorage;
      const raw = JSON.parse(this.storage.getItem(SAVE_KEY));
      if (raw?.version !== 1) return;
      this.data.unlocked = Math.max(1, Math.floor(bounded(raw.unlocked, LEVELS.length)));
      this.data.levels = LEVELS.map((level, i) => {
        const item = raw.levels?.[i] || {};
        return { stars: Math.floor(bounded(item.stars, 3)), bestHeight: bounded(item.bestHeight, level.goal), bestScore: bounded(item.bestScore), bestTime: typeof item.bestTime === 'number' && item.bestTime > 0 && Number.isFinite(item.bestTime) ? item.bestTime : null };
      });
      // Reconcile unlocks from completed levels if a partially written save is read.
      this.data.levels.forEach((item, i) => { if (item.stars) this.data.unlocked = Math.max(this.data.unlocked, Math.min(5, i + 2)); });
      this.data.settings.sound = raw.settings?.sound !== false;
      this.data.seenTutorial = raw.seenTutorial === true;
    } catch { /* Corrupt/private storage gets a fresh in-memory save. */ }
  }

  persist() {
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(this.data)); }
    catch { this.available = false; }
  }

  record(level, result) {
    const best = this.data.levels[level.id - 1];
    best.stars = Math.max(best.stars, result.stars);
    best.bestHeight = Math.max(best.bestHeight, Math.min(level.goal, result.height));
    best.bestScore = Math.max(best.bestScore, result.score);
    if (result.win) {
      best.bestTime = Math.min(best.bestTime ?? Infinity, result.time);
      this.data.unlocked = Math.max(this.data.unlocked, Math.min(LEVELS.length, level.id + 1));
    }
    this.persist();
  }
}
