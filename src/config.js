export const CONFIG = Object.freeze({
  designWidth: 755,
  designHeight: 1342,
  worldWidth: 755,

  gravity: 1850,
  baseJumpVelocity: -960,
  baseMoveSpeed: 400,

  playerFireInterval: 0.46,
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

  // Meters are display units; level curves and encounter data live in data/levels.js.
  heightWorldUnitsPerMeter: 5.45,
});
