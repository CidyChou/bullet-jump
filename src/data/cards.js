export const CARDS=[
{id:'jump',category:'mobility',name:'跃迁弹簧',icon:'↟',max:5,desc:(g,n)=>`跳跃高度累计提高 ${12*n}%。`,apply:g=>g.upgrades.stats.jump*=1.12},
{id:'move',category:'mobility',name:'侧向推进',icon:'⇆',max:5,desc:(g,n)=>`左右移动速度累计提高 ${12*n}%。`,apply:g=>g.upgrades.stats.move*=1.12},
{id:'gravity',category:'mobility',name:'轻盈核心',icon:'≈',max:4,desc:(g,n)=>`重力累计降低约 ${8*n}%。`,apply:g=>g.upgrades.stats.gravity*=.92},
{id:'timejump',category:'mobility',name:'远距跳跃',icon:'↑',max:4,desc:(g,n)=>`时间跳跃距离累计提高 ${25*n}%。`,apply:g=>g.upgrades.stats.timeJump*=1.25},
{id:'damage',category:'weapon',name:'高压弹芯',icon:'●',max:6,desc:g=>`每颗子弹伤害增加 1。`,apply:g=>g.upgrades.stats.damage++},
{id:'firerate',category:'weapon',name:'高速扳机',icon:'≋',max:5,desc:(g,n)=>`攻击间隔累计缩短约 ${12*n}%。`,apply:g=>g.upgrades.stats.fireRate*=.88},
{id:'multi',category:'weapon',name:'多重枪管',icon:'••',max:4,desc:g=>`每次攻击额外发射 1 颗子弹。`,apply:g=>g.upgrades.stats.projectiles=Math.min(5,g.upgrades.stats.projectiles+1)},
{id:'pierce',category:'weapon',name:'穿透弹',icon:'⇢',max:3,desc:(g,n)=>`子弹可额外穿透 ${n} 个敌人。`,apply:g=>g.upgrades.stats.penetration++},
{id:'shield',category:'defense',name:'再生护盾',icon:'◇',max:4,desc:(g,n)=>n===1?'解锁1层可再生护盾，破碎后自动恢复。':'护盾上限+1，并缩短恢复时间。',apply:(g,n)=>{g.upgrades.stats.shieldMax++;if(n>1)g.upgrades.stats.shieldCooldown*=.88;g.player.shield=Math.max(1,g.player.shield)}},
{id:'hp',category:'defense',name:'钢铁核心',icon:'♥',max:5,desc:g=>'最大生命值和当前生命值增加 1。',apply:g=>{g.player.maxHp++;g.player.hp++}},
{id:'time',category:'defense',name:'超级子弹时间',icon:'◷',max:4,desc:(g,n)=>`子弹时间持续时间累计提高 ${35*n}%。`,apply:g=>g.upgrades.stats.timeDuration*=1.35},
{id:'cooldown',category:'defense',name:'时间回路',icon:'⌛',max:4,desc:(g,n)=>`两个主动技能冷却累计减少约 ${10*n}%。`,apply:g=>g.upgrades.stats.cooldown*=.9}
];export const CARDS_BY_ID=new Map(CARDS.map(c=>[c.id,c]));
