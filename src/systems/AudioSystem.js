export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.enabled = true;
    this.ducked = false;
    this.master = null;
  }

  unlock() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.65;
        this.master.connect(this.ctx.destination);
      } catch { return; }
    }
    this.unlocked = true;
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setValueAtTime(enabled ? 0.65 : 0, this.ctx.currentTime);
    }
    if (enabled) this.unlock();
  }

  setDucked(ducked) { this.ducked = ducked; }

  tone(frequency, duration = 0.08, type = "sine", volume = 0.025, delay = 0) {
    if (!this.enabled || !this.unlocked || !this.ctx) return;

    const now = this.ctx.currentTime + delay;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency * (this.ducked ? 0.78 : 1), now);
    gain.gain.setValueAtTime(volume * (this.ducked ? 0.7 : 1), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  play(name) {
    const sounds = {
      ui: [680, 0.045, "sine", 0.018],
      land: [105, 0.08, "triangle", 0.021],
      telegraph: [330, 0.1, "triangle", 0.014],
      shot: [610, 0.035, "square", 0.01],
      enemyShot: [150, 0.09, "sawtooth", 0.016],
      hit: [260, 0.05, "square", 0.015],
      enemyDown: [420, 0.12, "triangle", 0.022],
      jump: [220, 0.06, "sine", 0.014],
      time: [480, 0.2, "sine", 0.025],
      charge: [180, 0.16, "sawtooth", 0.022],
      launch: [760, 0.18, "sine", 0.03],
      shield: [820, 0.16, "sine", 0.025],
      rogueOpen: [380, 0.18, "triangle", 0.025],
      rogueMove: [540, 0.045, "sine", 0.015],
      roguePick: [880, 0.16, "triangle", 0.03],
      meleeCharge: [125, 0.16, "sawtooth", 0.022],
      meleeHit: [74, 0.12, "square", 0.03],
      bossWarning: [92, 0.42, "sawtooth", 0.035],
      bossShot: [185, 0.10, "square", 0.022],
      bossDown: [55, 0.48, "sawtooth", 0.045],
    };

    if (name === "win" || name === "lose") {
      const notes = name === 'win' ? [523, 659, 784, 1046] : [294, 247, 196];
      notes.forEach((note, i) => this.tone(note, 0.28, 'triangle', 0.035, i * 0.13));
      return;
    }
    if (name === "hurt") {
      // Layered low impact: body thump + sharp contact + short tail.
      this.tone(86, 0.18, "sawtooth", 0.042);
      this.tone(46, 0.13, "square", 0.026, 0.012);
      this.tone(185, 0.045, "square", 0.022, 0.006);
      return;
    }

    if (sounds[name]) this.tone(...sounds[name]);

    if (name === "shield") {
      this.tone(460, 0.09, "triangle", 0.018, 0.025);
    }

    if (name === "rogueOpen") {
      this.tone(550, 0.16, "triangle", 0.02, 0.09);
      this.tone(760, 0.16, "triangle", 0.018, 0.18);
    }

    if (name === "roguePick") {
      this.tone(1100, 0.14, "triangle", 0.024, 0.07);
    }

    if (name === "bossWarning") {
      this.tone(138, 0.34, "sawtooth", 0.028, 0.13);
      this.tone(69, 0.48, "square", 0.022, 0.28);
    }

    if (name === "bossDown") {
      this.tone(110, 0.32, "square", 0.032, 0.08);
      this.tone(440, 0.42, "triangle", 0.028, 0.22);
    }
  }
}
