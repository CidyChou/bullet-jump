// All encounter tuning lives here. Arrays are [opening, finale]; the curve stays
// gentle until rampStart, then rises quadratically toward the summit.
export const LEVELS = Object.freeze([
  {
    id: 1, name: '初升', english: 'ASCENT', color: '#75e8bc', background: '#112b2b',
    description: '宽阔落点，掌握时间的第一步。', goal: 1400, par: 130, healthStar: 0.6,
    rampStart: 0.4, hp: 6, width: [290, 225], gap: [84, 108], stride: [95, 145],
    moving: [0, 0.08], fragile: [0, 0.07], density: [1, 3], spawn: [3.6, 1.9],
    melee: [0, 0.16], sniper: [0, 0], toughness: [0, 0.22],
    milestones: [180, 620, 1100], mid: null,
    boss: { id: 'sentinel', name: '启程守卫', hp: 34, radius: 57, interval: 1.9, speed: 215, count: 3, telegraph: 0.7 },
  },
  {
    id: 2, name: '加速', english: 'CROSSFIRE', color: '#f4c575', background: '#302516',
    description: '错列平台间，冲锋者正在逼近。', goal: 2300, par: 195, healthStar: 0.6,
    rampStart: 0.32, hp: 5, width: [275, 195], gap: [88, 125], stride: [110, 175],
    moving: [0.03, 0.2], fragile: [0, 0.14], density: [1, 4], spawn: [3.4, 1.45],
    melee: [0.04, 0.48], sniper: [0, 0], toughness: [0.05, 0.4],
    milestones: [200, 650, 1200, 1900], mid: null,
    boss: { id: 'fork', name: '双相追猎者', hp: 64, radius: 63, interval: 1.55, speed: 260, count: 5, telegraph: 0.62 },
  },
  {
    id: 3, name: '弹幕', english: 'BARRAGE', color: '#91bdff', background: '#16243c',
    description: '识破狙击预警，穿过旋转火网。', goal: 3200, par: 265, healthStar: 0.6,
    rampStart: 0.3, hp: 5, width: [265, 175], gap: [90, 140], stride: [115, 190],
    moving: [0.03, 0.22], fragile: [0, 0.15], density: [1, 5], spawn: [3.3, 1.2],
    melee: [0.02, 0.16], sniper: [0, 0.42], toughness: [0.08, 0.6],
    milestones: [200, 700, 1350, 2050, 2750], mid: null,
    boss: { id: 'spiral', name: '星环织弹者', hp: 105, radius: 69, interval: 1.3, speed: 285, count: 7, telegraph: 0.58 },
  },
  {
    id: 4, name: '夹击', english: 'NARROWS', color: '#c1a1ff', background: '#2b1c3c',
    description: '窄台与精英交错，别停下脚步。', goal: 4600, par: 360, healthStar: 0.6,
    rampStart: 0.24, hp: 5, width: [250, 150], gap: [94, 150], stride: [120, 200],
    moving: [0.04, 0.29], fragile: [0.02, 0.21], density: [1, 6], spawn: [3.2, 1.05],
    melee: [0.08, 0.5], sniper: [0.02, 0.24], toughness: [0.12, 0.8],
    milestones: [250, 800, 1450, 2200, 3050, 3900, 4350],
    mid: { at: 2500, id: 'fork', name: '隘口巡守', hp: 62, radius: 58, interval: 1.65, speed: 255, count: 5, telegraph: 0.65 },
    boss: { id: 'pincer', name: '裂隙双翼', hp: 150, radius: 75, interval: 1.12, speed: 310, count: 7, telegraph: 0.54 },
  },
  {
    id: 5, name: '终焉', english: 'APEX', color: '#ff918e', background: '#361c2b',
    description: '时间尽头，迎战终焉时间巨兽。', goal: 5800, par: 450, healthStar: 0.6,
    rampStart: 0.3, hp: 5, width: [245, 138], gap: [96, 160], stride: [120, 210],
    moving: [0.05, 0.32], fragile: [0.02, 0.26], density: [1, 7], spawn: [3, 0.9],
    melee: [0.08, 0.43], sniper: [0.03, 0.3], toughness: [0.15, 1],
    milestones: [250, 800, 1450, 2200, 3000, 3800, 4550, 5100, 5500],
    mid: { at: 3100, id: 'spiral', name: '时序核心', hp: 95, radius: 66, interval: 1.35, speed: 280, count: 7, telegraph: 0.6 },
    boss: { id: 'apex', name: '终焉时间巨兽', hp: 225, radius: 82, interval: 0.94, speed: 330, count: 9, telegraph: 0.52 },
  },
]);

export function difficultyAt(level, meters) {
  const progress = Math.max(0, Math.min(1, meters / level.goal));
  const ramp = Math.max(0, (progress - level.rampStart) / (1 - level.rampStart));
  const curve = progress * 0.08 + ramp * ramp * 0.92;
  const mix = key => level[key][0] + (level[key][1] - level[key][0]) * curve;
  return Object.fromEntries(['width', 'gap', 'stride', 'moving', 'fragile', 'density', 'spawn', 'melee', 'sniper', 'toughness'].map(key => [key, mix(key)]));
}

export function earnedStars(level, { win, time, hp, maxHp }) {
  if (!win) return 0;
  const fast = time <= level.par;
  const healthy = hp / maxHp >= level.healthStar;
  return 1 + Number(fast || healthy) + Number(fast && healthy);
}
