/** Core game type definitions */

export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  pos: Vector2;
  vel: Vector2;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export type HeroClass = 'warrior' | 'archer' | 'mage' | 'rogue';
export type EnemyType = 'goblin' | 'skeleton' | 'orc' | 'necromancer' | 'boss';
export type WeaponRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type TrapType = 'spikes' | 'arrow_launcher' | 'fire_vent';
export type LevelUpStat = 'hp' | 'attack' | 'speed' | 'mana';
export type BossKind = 'cave_brute' | 'crypt_lich' | 'fortress_warlord' | 'shadow_wraith';

export interface BossDef {
  kind: BossKind;
  name: string;
  color: string;
  glow: string;
  hpMul: number;
  speedMul: number;
  damageMul: number;
  pattern: 'charge' | 'summon' | 'volley' | 'teleport';
  description: string;
}

export const BOSS_DEFS: Record<BossKind, BossDef> = {
  cave_brute: {
    kind: 'cave_brute', name: 'CAVE BRUTE', color: '#a14a2a', glow: '#ff7733',
    hpMul: 1.2, speedMul: 1.0, damageMul: 1.2, pattern: 'charge',
    description: 'Charges in straight lines and shakes the ground.',
  },
  crypt_lich: {
    kind: 'crypt_lich', name: 'CRYPT LICH', color: '#7a4a9a', glow: '#b197fc',
    hpMul: 0.9, speedMul: 0.8, damageMul: 1.0, pattern: 'summon',
    description: 'Summons skeletons and casts dark bolts from afar.',
  },
  fortress_warlord: {
    kind: 'fortress_warlord', name: 'FORTRESS WARLORD', color: '#c0392b', glow: '#ff4444',
    hpMul: 1.4, speedMul: 0.9, damageMul: 1.3, pattern: 'volley',
    description: 'Looses spreads of arrows in punishing volleys.',
  },
  shadow_wraith: {
    kind: 'shadow_wraith', name: 'SHADOW WRAITH', color: '#3a2a55', glow: '#9b59b6',
    hpMul: 0.85, speedMul: 1.2, damageMul: 1.15, pattern: 'teleport',
    description: 'Phases through space and ambushes from the dark.',
  },
};

export interface Weapon {
  id: string;
  name: string;
  damage: number;
  attackSpeed: number;
  range: number;
  rarity: WeaponRarity;
  isRanged: boolean;
  effect?: 'fire' | 'ice' | 'poison' | 'lightning';
  effectChance?: number;
}

export interface Player extends Entity {
  speed: number;
  attackCooldown: number;
  attackTimer: number;
  attackDamage: number;
  attackRange: number;
  facing: Vector2;
  isAttacking: boolean;
  attackAnimTimer: number;
  iFrames: number;
  xp: number;
  xpToNext: number;
  level: number;
  gold: number;
  mana: number;
  maxMana: number;
  heroClass: HeroClass;
  abilityTimer: number;
  abilityCooldown: number;
  weapon: Weapon;
  inventory: Weapon[];
  statusEffects: StatusEffect[];
  killCount: number;
  dodgeTimer: number;
  dodgeCooldownTimer: number;
  baseSpeed: number;
  /** Base values before skill bonuses (used to recompute when unlocking). */
  baseMaxHp: number;
  baseMaxMana: number;
  baseAttackDamage: number;
  /** Skill progression. */
  skillPoints: number;
  unlockedSkills: string[];
  healthPotions: number;
  manaPotions: number;
}

export interface StatusEffect {
  type: 'burn' | 'freeze' | 'poison' | 'stun';
  duration: number;
  tickTimer: number;
  damage: number;
}

export interface Enemy extends Entity {
  speed: number;
  baseSpeed: number;
  damage: number;
  attackCooldown: number;
  attackTimer: number;
  state: 'idle' | 'chase' | 'attack' | 'hurt' | 'retreat';
  type: EnemyType;
  knockbackTimer: number;
  flashTimer: number;
  xpValue: number;
  goldValue: number;
  isRanged: boolean;
  shootCooldown: number;
  shootTimer: number;
  phaseHP?: number;
  phase?: number;
  statusEffects: StatusEffect[];
}

export interface Projectile {
  pos: Vector2;
  vel: Vector2;
  damage: number;
  radius: number;
  lifetime: number;
  fromPlayer: boolean;
  color?: string;
  effect?: 'fire' | 'ice' | 'poison' | 'lightning';
}

export interface Particle {
  pos: Vector2;
  vel: Vector2;
  lifetime: number;
  maxLifetime: number;
  color: string;
  size: number;
}

export interface LootDrop {
  pos: Vector2;
  type: 'gold' | 'health' | 'weapon' | 'mana' | 'health_potion' | 'mana_potion';
  value: number;
  rarity: WeaponRarity;
  lifetime: number;
  bobOffset: number;
  weapon?: Weapon;
}

export interface DamageNumber {
  pos: Vector2;
  value: number;
  lifetime: number;
  color: string;
  isCrit: boolean;
  text?: string;
}

export interface Trap {
  pos: Vector2;
  width: number;
  height: number;
  type: TrapType;
  damage: number;
  cooldown: number;
  timer: number;
  active: boolean;
  direction?: Vector2;
}

export interface Chest {
  pos: Vector2;
  rarity: WeaponRarity;
  opened: boolean;
  openTimer: number;
  lootSpawned: boolean;
}

export interface Torch {
  pos: Vector2;
  radius: number;
  flickerOffset: number;
}

export interface Door {
  x: number;
  y: number;
  width: number;
  height: number;
  direction: 'n' | 's' | 'e' | 'w';
  locked: boolean;
  targetRoom: number;
}

export interface DungeonRoom {
  id: number;
  gridX: number;
  gridY: number;
  width: number;
  height: number;
  walls: { x: number; y: number; w: number; h: number }[];
  enemies: Enemy[];
  traps: Trap[];
  chests: Chest[];
  torches: Torch[];
  cleared: boolean;
  doors: Door[];
  visited: boolean;
  type: 'combat' | 'treasure' | 'boss' | 'shop' | 'start';
  theme: 'cave' | 'crypt' | 'fortress' | 'shadow';
}

export interface Dungeon {
  rooms: DungeonRoom[];
  currentRoomId: number;
  tier: number;
}

export interface ShopItem {
  weapon: Weapon;
  price: number;
  sold: boolean;
}

export interface GameState {
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: Particle[];
  loot: LootDrop[];
  damageNumbers: DamageNumber[];
  traps: Trap[];
  chests: Chest[];
  torches: Torch[];
  dungeon: Dungeon;
  keys: Set<string>;
  mouse: Vector2;
  mouseDown: boolean;
  screenShake: number;
  roomsCleared: number;
  wave: number;
  waveTimer: number;
  gameOver: boolean;
  paused: boolean;
  transitionTimer: number;
  transitionDirection: 'n' | 's' | 'e' | 'w' | null;
  showInventory: boolean;
  shopItems: ShopItem[];
  showShop: boolean;
  notification: { text: string; timer: number; color: string } | null;
  time: number;
  levelUpChoices: LevelUpStat[] | null;
  room: DungeonRoom;
  showSkillTree: boolean;
  showMap: boolean;
  showHelp: boolean;
  runResult: {
    score: number;
    isNewBest: boolean;
    previousBest: number | null;
  } | null;
}

export interface HeroConfig {
  name: string;
  hp: number;
  mana: number;
  speed: number;
  damage: number;
  attackSpeed: number;
  attackRange: number;
  color: string;
  description: string;
  startWeapon: Weapon;
}

const WEAPON_NAMES: Record<string, string[]> = {
  common: ['Rusty Sword', 'Cracked Bow', 'Worn Staff', 'Blunt Dagger'],
  rare: ['Iron Blade', 'Oak Longbow', 'Crystal Wand', 'Steel Stiletto'],
  epic: ['Flamebrand', 'Shadow Bow', 'Arcane Scepter', 'Phantom Blade'],
  legendary: ['Excalibur', 'Celestial Bow', 'Staff of Eternity', 'Void Fang'],
};

export function generateWeapon(rarity: WeaponRarity, isRanged?: boolean): Weapon {
  const ranged = isRanged ?? Math.random() < 0.4;
  const multipliers: Record<WeaponRarity, number> = {
    common: 1, rare: 1.5, epic: 2.2, legendary: 3.5,
  };
  const m = multipliers[rarity];
  const names = WEAPON_NAMES[rarity];
  const effects: Array<'fire' | 'ice' | 'poison' | 'lightning'> = ['fire', 'ice', 'poison', 'lightning'];

  const weapon: Weapon = {
    id: Math.random().toString(36).slice(2, 9),
    name: names[Math.floor(Math.random() * names.length)],
    damage: Math.floor((10 + Math.random() * 10) * m),
    attackSpeed: +(0.3 + Math.random() * 0.3).toFixed(2),
    range: ranged ? 180 + Math.floor(Math.random() * 60) : 30 + Math.floor(Math.random() * 20),
    rarity,
    isRanged: ranged,
  };

  if (rarity === 'epic' || rarity === 'legendary' || (rarity === 'rare' && Math.random() < 0.3)) {
    weapon.effect = effects[Math.floor(Math.random() * effects.length)];
    weapon.effectChance = rarity === 'legendary' ? 0.5 : rarity === 'epic' ? 0.3 : 0.15;
  }

  return weapon;
}

export const RARITY_COLORS: Record<WeaponRarity, string> = {
  common: '#9e9e9e',
  rare: '#4dabf7',
  epic: '#b197fc',
  legendary: '#ffd43b',
};

export const EFFECT_COLORS: Record<string, string> = {
  fire: '#e74c3c',
  ice: '#74c0fc',
  poison: '#51cf66',
  lightning: '#ffd43b',
};

export const HERO_CONFIGS: Record<HeroClass, HeroConfig> = {
  warrior: {
    name: 'Warrior',
    hp: 150, mana: 50, speed: 180, damage: 25, attackSpeed: 0.5, attackRange: 40,
    color: '#c0392b',
    description: 'High HP, melee focus, devastating close-range attacks',
    startWeapon: { id: 'w_start', name: 'Iron Sword', damage: 25, attackSpeed: 0.5, range: 40, rarity: 'common', isRanged: false },
  },
  archer: {
    name: 'Archer',
    hp: 80, mana: 80, speed: 220, damage: 18, attackSpeed: 0.3, attackRange: 200,
    color: '#27ae60',
    description: 'Fast and ranged, rains arrows from a distance',
    startWeapon: { id: 'a_start', name: 'Short Bow', damage: 18, attackSpeed: 0.3, range: 200, rarity: 'common', isRanged: true },
  },
  mage: {
    name: 'Mage',
    hp: 60, mana: 150, speed: 160, damage: 30, attackSpeed: 0.6, attackRange: 180,
    color: '#2980b9',
    description: 'Low HP but devastating magic projectiles',
    startWeapon: { id: 'm_start', name: 'Apprentice Staff', damage: 30, attackSpeed: 0.6, range: 180, rarity: 'common', isRanged: true },
  },
  rogue: {
    name: 'Rogue',
    hp: 90, mana: 70, speed: 250, damage: 22, attackSpeed: 0.25, attackRange: 35,
    color: '#8e44ad',
    description: 'Lightning fast with deadly backstab damage',
    startWeapon: { id: 'r_start', name: 'Rusty Dagger', damage: 22, attackSpeed: 0.25, range: 35, rarity: 'common', isRanged: false },
  },
};
