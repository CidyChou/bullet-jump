export const CONFIG = Object.freeze({
  designWidth: 755,
  designHeight: 1342,
  worldWidth: 755,

  gravity: 1850,
  baseJumpVelocity: -960,
  baseMoveSpeed: 400,

  playerFireInterval: 0.72,
  playerBulletSpeed: 880,
  enemyBulletSpeed: 275,

  bulletTimeDuration: 1.55,
  bulletTimeCooldown: 3,
  bulletTimeScale: 0.19,
  bulletTimeMoveScale: 0.65,

  timeJumpDistance: 250,
  timeJumpCooldown: 2.5,
  timeJumpChargeDuration: 0.24,
  timeJumpLaunchDuration: 0.24,

  platformMinGap: 82,
  platformMaxGap: 116,
  platformNarrowStartMeters: 3000,
  platformMinWidthBeforeNarrowing: 205,
  platformMaxWidthBeforeNarrowing: 285,
  platformAbsoluteMinWidth: 132,
  platformMaxWidthAtGoal: 190,

  heightWorldUnitsPerMeter: 5.45,
  stageGoalMeters: 10000,
  midBossMeters: 5000,
  finalBossMeters: 10000,

  rogueMilestones: Object.freeze([
    250, 650, 1200, 1900, 2800,
    3900, 5200, 6700, 8300, 9600,
  ]),
});
