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
}

export type HeroClass = 'warrior' | 'archer' | 'mage' | 'rogue';

export interface Enemy extends Entity {
  speed: number;
  damage: number;
  attackCooldown: number;
  attackTimer: number;
  state: 'idle' | 'chase' | 'attack' | 'hurt';
  type: EnemyType;
  knockbackTimer: number;
  flashTimer: number;
  xpValue: number;
  goldValue: number;
}

export type EnemyType = 'goblin' | 'skeleton' | 'orc' | 'boss';

export interface Projectile {
  pos: Vector2;
  vel: Vector2;
  damage: number;
  radius: number;
  lifetime: number;
  fromPlayer: boolean;
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
  type: 'gold' | 'health' | 'weapon';
  value: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  lifetime: number;
  bobOffset: number;
}

export interface DamageNumber {
  pos: Vector2;
  value: number;
  lifetime: number;
  color: string;
  isCrit: boolean;
}

export interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
  walls: { x: number; y: number; w: number; h: number }[];
  enemies: Enemy[];
  cleared: boolean;
  doors: { x: number; y: number; direction: 'n' | 's' | 'e' | 'w'; locked: boolean }[];
}

export interface GameState {
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: Particle[];
  loot: LootDrop[];
  damageNumbers: DamageNumber[];
  room: Room;
  keys: Set<string>;
  mouse: Vector2;
  mouseDown: boolean;
  screenShake: number;
  roomsCleared: number;
  wave: number;
  waveTimer: number;
  gameOver: boolean;
  paused: boolean;
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
}

export const HERO_CONFIGS: Record<HeroClass, HeroConfig> = {
  warrior: {
    name: 'Warrior',
    hp: 150,
    mana: 50,
    speed: 180,
    damage: 25,
    attackSpeed: 0.5,
    attackRange: 40,
    color: '#c0392b',
    description: 'High HP, melee focus, devastating close-range attacks',
  },
  archer: {
    name: 'Archer',
    hp: 80,
    mana: 80,
    speed: 220,
    damage: 18,
    attackSpeed: 0.3,
    attackRange: 200,
    color: '#27ae60',
    description: 'Fast and ranged, rains arrows from a distance',
  },
  mage: {
    name: 'Mage',
    hp: 60,
    mana: 150,
    speed: 160,
    damage: 30,
    attackSpeed: 0.6,
    attackRange: 180,
    color: '#2980b9',
    description: 'Low HP but devastating magic projectiles',
  },
  rogue: {
    name: 'Rogue',
    hp: 90,
    mana: 70,
    speed: 250,
    damage: 22,
    attackSpeed: 0.25,
    attackRange: 35,
    color: '#8e44ad',
    description: 'Lightning fast with deadly backstab damage',
  },
};
