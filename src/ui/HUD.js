import { CARDS_BY_ID } from "../data/cards.js?v=4.0.0";

function element(id) {
  return document.getElementById(id);
}

function setText(target, value) {
  if (target) target.textContent = value;
}

function setWidth(target, value) {
  if (target) target.style.width = value;
}

function toggle(target, className, enabled) {
  if (target) target.classList.toggle(className, enabled);
}

export class HUD {
  constructor(game) {
    this.game = game;

    this.heightValue = element("heightValue");
    this.hpValue = element("hpValue");
    this.healthFill = element("healthFill");
    this.hudShell = document.querySelector(".hud-shell");
    this.killValue = element("killValue");
    this.shieldValue = element("shieldValue");
    this.shieldRechargeText = element("shieldRechargeText");
    this.buildLevelText = element("buildLevelText");
    this.nextUpgradeText = element("nextUpgradeText");
    this.stageGoalText = element("stageGoalText");
    this.rogueProgress = element("rogueProgress");
    this.bulletTimeText = element("bulletTimeText");
    this.timeJumpText = element("timeJumpText");

    this.bulletTimeButton = element("bulletTimeButton");
    this.timeJumpButton = element("timeJumpButton");
    this.upgradeList = element("upgradeList");
    this.bossHud = element("bossHud");
    this.bossName = element("bossName");
    this.bossHpText = element("bossHpText");
    this.bossHealthFill = element("bossHealthFill");
    this.toastElement = element("toast");
    this.toastTimer = 0;
  }

  update() {
    const game = this.game;
    const hpRatio = Math.max(0, Math.min(1, game.player.hp / Math.max(1, game.player.maxHp)));
    const stageRatio = Math.max(0, Math.min(1, game.heightMeters / game.level.goal));

    setText(this.heightValue, `${game.heightMeters}m`);
    setText(this.hpValue, `${game.player.hp} / ${game.player.maxHp}`);
    setWidth(this.healthFill, `${hpRatio * 100}%`);
    setText(this.killValue, String(game.kills));

    const maxShield = game.player.maxShield;
    setText(this.shieldValue, maxShield ? `${game.player.shield}/${maxShield}` : "未解锁");
    setText(
      this.shieldRechargeText,
      maxShield && game.player.shield < maxShield
        ? `${Math.max(0, game.player.shieldTimer).toFixed(1)}s`
        : "READY",
    );

    setText(this.buildLevelText, `LV ${game.rogue.selectedCount} / ${game.rogue.maxSelections}`);
    setText(
      this.nextUpgradeText,
      game.rogue.selectedCount >= game.rogue.maxSelections
        ? "MAX"
        : `${Math.max(0, game.rogue.nextHeight - game.heightMeters)}m`,
    );
    setText(this.stageGoalText, `${game.heightMeters} / ${game.level.goal}m`);
    setWidth(this.rogueProgress, `${stageRatio * 100}%`);

    setText(
      this.bulletTimeText,
      game.skills.isBulletTimeActive
        ? `ACTIVE ${game.skills.bulletTimeRemaining.toFixed(1)}s`
        : game.skills.bulletTimeCooldown > 0
          ? `${game.skills.bulletTimeCooldown.toFixed(1)}s`
          : "READY",
    );

    setText(
      this.timeJumpText,
      game.skills.isTimeJumpAnimating
        ? game.skills.jumpPhase === "charging"
          ? "CHARGING"
          : "LAUNCH"
        : game.skills.timeJumpCooldown > 0
          ? `${game.skills.timeJumpCooldown.toFixed(1)}s`
          : "READY",
    );

    toggle(
      this.bulletTimeButton,
      "cooldown",
      game.skills.bulletTimeCooldown > 0 && !game.skills.isBulletTimeActive,
    );
    toggle(this.bulletTimeButton, "active", game.skills.isBulletTimeActive);
    const boss = game.activeBoss && !game.activeBoss.dead ? game.activeBoss : null;
    toggle(this.bossHud, "show", Boolean(boss));
    this.bossHud?.setAttribute("aria-hidden", String(!boss));
    if (boss) {
      setText(this.bossName, boss.bossName);
      setText(this.bossHpText, `${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`);
      setWidth(this.bossHealthFill, `${Math.max(0, boss.hp / boss.maxHp) * 100}%`);
    }

    toggle(
      this.timeJumpButton,
      "cooldown",
      game.skills.timeJumpCooldown > 0 && !game.skills.isTimeJumpAnimating,
    );
    toggle(this.timeJumpButton, "charging", game.skills.isTimeJumpAnimating);
  }

  flashDamage(shielded = false) {
    const target = shielded ? this.shieldValue : this.healthFill;
    const className = shielded ? "shield-impact" : "damage-impact";

    if (target) {
      target.classList.remove(className);
      void target.offsetWidth;
      target.classList.add(className);
      setTimeout(() => target.classList.remove(className), 320);
    }

    if (!shielded && this.hudShell) {
      this.hudShell.classList.remove("hud-damage-impact");
      void this.hudShell.offsetWidth;
      this.hudShell.classList.add("hud-damage-impact");
      setTimeout(() => this.hudShell?.classList.remove("hud-damage-impact"), 330);
    }
  }

  updateUpgradeList() {
    if (!this.upgradeList) return;
    this.upgradeList.innerHTML = this.game.upgrades
      .summary(CARDS_BY_ID)
      .map(
        (item) =>
          `<span class="upgrade-chip ${item.category}">${item.label}${
            item.count > 1 ? ` ×${item.count}` : ""
          }</span>`,
      )
      .join("");
  }

  toast(message) {
    if (!this.toastElement) return;
    clearTimeout(this.toastTimer);
    this.toastElement.textContent = message;
    this.toastElement.classList.add("show");
    this.toastTimer = setTimeout(() => this.toastElement?.classList.remove("show"), 1100);
  }
}
