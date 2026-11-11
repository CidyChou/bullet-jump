export class Input {
  constructor(canvas, joystick, knob, modeProvider, enabled = () => true) {
    Object.assign(this, { canvas, root: canvas.parentElement, joystick, knob, modeProvider, enabled, mode: 'horizontal' });
    this.clear();
    const direction = (event, down) => {
      const keys = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
      const key = keys[event.key] || keys[event.key.toLowerCase()];
      if (key && (!down || this.enabled())) { this[key] = down; if (this.enabled()) event.preventDefault(); }
    };
    addEventListener('keydown', event => direction(event, true));
    addEventListener('keyup', event => direction(event, false));
    addEventListener('blur', () => this.clear());
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('pointerdown', event => {
      if (!this.enabled() || this.pointerId !== null) return;
      event.preventDefault(); this.syncMode(); this.pointerId = event.pointerId;
      this.joystickActive = true; this.centerX = event.clientX; this.centerY = event.clientY;
      this.joystick.classList.add('show'); this.position(event.clientX, event.clientY);
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => { if (event.pointerId === this.pointerId) this.update(event.clientX, event.clientY); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, event => { if (event.pointerId === this.pointerId) this.clear(); });
  }
  clear() {
    if (this.pointerId !== null && this.canvas.hasPointerCapture?.(this.pointerId)) this.canvas.releasePointerCapture(this.pointerId);
    this.left = this.right = this.up = this.down = this.joystickActive = false;
    this.joyX = this.joyY = 0; this.pointerId = null;
    this.knob.style.transform = 'translate(-50%,-50%)'; this.joystick.classList.remove('show');
  }
  get horizontalAxis() { return this.joystickActive ? this.joyX : Number(this.right) - Number(this.left); }
  get verticalAxis() { return this.joystickActive && this.mode === 'radial' ? this.joyY : Number(this.down) - Number(this.up); }
  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode === 'radial' ? 'radial' : 'horizontal';
    this.joystick.classList.toggle('radial', this.mode === 'radial'); this.joystick.classList.toggle('horizontal', this.mode === 'horizontal');
    if (this.mode === 'horizontal') this.joyY = 0;
  }
  syncMode() { this.setMode(this.modeProvider()); }
  position(x, y) {
    const rect = this.root.getBoundingClientRect(), w = this.joystick.offsetWidth || 160, h = this.joystick.offsetHeight || 50;
    this.joystick.style.left = `${Math.max(8, Math.min(rect.width - w - 8, x - rect.left - w / 2))}px`;
    this.joystick.style.top = `${Math.max(8, Math.min(rect.height - h - 8, y - rect.top - h / 2))}px`;
  }
  update(x, y) {
    const dx = x - this.centerX, dy = y - this.centerY;
    const max = (this.joystick.offsetWidth || 160) * 0.25;
    this.joyX = Math.abs(dx) < 4 ? 0 : Math.max(-1, Math.min(1, dx / 45));
    this.joyY = this.mode === 'radial' ? Math.max(-1, Math.min(1, dy / 48)) : 0;
    this.knob.style.transform = `translate(calc(-50% + ${this.joyX * max}px),calc(-50% + ${this.joyY * max}px))`;
  }
}
