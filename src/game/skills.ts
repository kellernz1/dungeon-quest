/**
 * Class skill trees. Each level-up grants the player 1 skill point.
 * Skills are passive — bonuses are applied to the player's derived stats
 * by `applySkillBonuses()`, called whenever a skill is unlocked or the
 * player is created.
 */

import { HeroClass } from './types';

export type SkillId = string;

export interface SkillNode {
  id: SkillId;
  name: string;
  description: string;
  tier: 1 | 2 | 3;
  /** Optional prerequisite skill in the same tree. */
  requires?: SkillId;
  /** Bonuses applied when unlocked. */
  bonuses: SkillBonus;
}

/**
 * Bonuses are summed across unlocked skills and re-applied whenever
 * the set of unlocked skills changes.
 */
export interface SkillBonus {
  /** Flat bonus to max HP. */
  maxHp?: number;
  /** Flat bonus to max mana. */
  maxMana?: number;
  /** Flat bonus to attackDamage. */
  attackDamage?: number;
  /** Flat bonus to baseSpeed (and current speed). */
  speed?: number;
  /** Multiplier on attack speed (lower attackCooldown). 0.1 = 10% faster. */
  attackSpeedMul?: number;
  /** Bonus mana regen per second. */
  manaRegen?: number;
  /** Bonus HP regen per second. */
  hpRegen?: number;
  /** Multiplier on dodge cooldown reduction. 0.25 = 25% shorter. */
  dodgeCooldownMul?: number;
  /** Multiplier on iFrames duration. 0.5 = 50% longer. */
  iFrameMul?: number;
  /** Bonus crit chance (0..1). */
  critChance?: number;
  /** Bonus crit multiplier. 0.5 = +50% crit damage. */
  critDamage?: number;
  /** Multiplier on gold pickups. */
  goldMul?: number;
  /** Multiplier on XP gained. */
  xpMul?: number;
  /** Multiplier on weapon-effect proc chance. */
  effectChanceMul?: number;
  /** Flat life steal — % of melee damage returned as HP (0..1). */
  lifeSteal?: number;
}

/** Aggregated bonuses derived from a set of unlocked skills. */
export type AggregatedBonuses = Required<SkillBonus>;

export const SKILL_TREES: Record<HeroClass, SkillNode[]> = {
  warrior: [
    { id: 'w_iron',     name: 'Iron Body',      tier: 1, description: '+30 max HP',                       bonuses: { maxHp: 30 } },
    { id: 'w_brutal',   name: 'Brutal Strikes', tier: 1, description: '+5 attack damage',                 bonuses: { attackDamage: 5 } },
    { id: 'w_juggernaut',name: 'Juggernaut',    tier: 2, description: '+50 max HP, +1 HP/s regen', requires: 'w_iron',    bonuses: { maxHp: 50, hpRegen: 1 } },
    { id: 'w_executioner',name: 'Executioner',  tier: 2, description: '+15% crit chance, +50% crit dmg', requires: 'w_brutal',bonuses: { critChance: 0.15, critDamage: 0.5 } },
    { id: 'w_bloodthirst',name: 'Bloodthirst',  tier: 3, description: '15% melee life steal',     requires: 'w_juggernaut', bonuses: { lifeSteal: 0.15 } },
    { id: 'w_titan',    name: 'Titan',          tier: 3, description: '+10 dmg, +20% atk speed',  requires: 'w_executioner',bonuses: { attackDamage: 10, attackSpeedMul: 0.2 } },
  ],
  archer: [
    { id: 'a_swift',    name: 'Swift Feet',     tier: 1, description: '+30 movement speed',               bonuses: { speed: 30 } },
    { id: 'a_keen',     name: 'Keen Eye',       tier: 1, description: '+10% crit chance',                 bonuses: { critChance: 0.1 } },
    { id: 'a_marksman', name: 'Marksman',       tier: 2, description: '+15% atk speed, +4 dmg', requires: 'a_swift',   bonuses: { attackSpeedMul: 0.15, attackDamage: 4 } },
    { id: 'a_hunter',   name: 'Hunter\'s Mark', tier: 2, description: '+25% crit dmg, +25% XP',  requires: 'a_keen',    bonuses: { critDamage: 0.25, xpMul: 0.25 } },
    { id: 'a_phantom',  name: 'Phantom',        tier: 3, description: '−40% dodge CD, +50% iFrames', requires: 'a_marksman',bonuses: { dodgeCooldownMul: 0.4, iFrameMul: 0.5 } },
    { id: 'a_deadeye',  name: 'Deadeye',        tier: 3, description: '+20% crit chance, +50% effect proc', requires: 'a_hunter',bonuses: { critChance: 0.2, effectChanceMul: 0.5 } },
  ],
  mage: [
    { id: 'm_focus',    name: 'Arcane Focus',   tier: 1, description: '+30 max mana, +2 mana/s',          bonuses: { maxMana: 30, manaRegen: 2 } },
    { id: 'm_power',    name: 'Spell Power',    tier: 1, description: '+6 attack damage',                 bonuses: { attackDamage: 6 } },
    { id: 'm_channel',  name: 'Channeling',     tier: 2, description: '+50 max mana, +20% atk speed', requires: 'm_focus',  bonuses: { maxMana: 50, attackSpeedMul: 0.2 } },
    { id: 'm_elementalist',name:'Elementalist', tier: 2, description: '+50% effect proc chance',  requires: 'm_power',   bonuses: { effectChanceMul: 0.5 } },
    { id: 'm_archmage', name: 'Archmage',       tier: 3, description: '+12 dmg, +25% crit dmg', requires: 'm_channel', bonuses: { attackDamage: 12, critDamage: 0.25 } },
    { id: 'm_void',     name: 'Void Mastery',   tier: 3, description: '+100% effect proc, +25% XP', requires: 'm_elementalist',bonuses: { effectChanceMul: 1.0, xpMul: 0.25 } },
  ],
  rogue: [
    { id: 'r_shadow',   name: 'Shadowstep',     tier: 1, description: '−25% dodge cooldown',              bonuses: { dodgeCooldownMul: 0.25 } },
    { id: 'r_lethal',   name: 'Lethal Edge',    tier: 1, description: '+15% crit chance',                 bonuses: { critChance: 0.15 } },
    { id: 'r_swift',    name: 'Swift Strike',   tier: 2, description: '+25% atk speed, +20 speed', requires: 'r_shadow',  bonuses: { attackSpeedMul: 0.25, speed: 20 } },
    { id: 'r_assassin', name: 'Assassin',       tier: 2, description: '+50% crit dmg, +6 dmg', requires: 'r_lethal',   bonuses: { critDamage: 0.5, attackDamage: 6 } },
    { id: 'r_phantom',  name: 'Phantom Strike', tier: 3, description: '+50% iFrames, +25% gold', requires: 'r_swift',   bonuses: { iFrameMul: 0.5, goldMul: 0.25 } },
    { id: 'r_deathmark',name: 'Death Mark',     tier: 3, description: '10% life steal, +20% crit dmg', requires: 'r_assassin',bonuses: { lifeSteal: 0.10, critDamage: 0.2 } },
  ],
};

export function emptyAggregatedBonuses(): AggregatedBonuses {
  return {
    maxHp: 0, maxMana: 0, attackDamage: 0, speed: 0,
    attackSpeedMul: 0, manaRegen: 0, hpRegen: 0,
    dodgeCooldownMul: 0, iFrameMul: 0,
    critChance: 0, critDamage: 0,
    goldMul: 0, xpMul: 0, effectChanceMul: 0, lifeSteal: 0,
  };
}

export function aggregateBonuses(heroClass: HeroClass, unlocked: Set<SkillId>): AggregatedBonuses {
  const agg = emptyAggregatedBonuses();
  const tree = SKILL_TREES[heroClass];
  for (const node of tree) {
    if (!unlocked.has(node.id)) continue;
    const b = node.bonuses;
    for (const k of Object.keys(b) as (keyof SkillBonus)[]) {
      agg[k] += b[k] ?? 0;
    }
  }
  return agg;
}

export function canUnlockSkill(
  heroClass: HeroClass,
  skillId: SkillId,
  unlocked: Set<SkillId>,
  skillPoints: number,
): { ok: boolean; reason?: string } {
  if (skillPoints <= 0) return { ok: false, reason: 'No skill points' };
  if (unlocked.has(skillId)) return { ok: false, reason: 'Already unlocked' };
  const node = SKILL_TREES[heroClass].find(n => n.id === skillId);
  if (!node) return { ok: false, reason: 'Unknown skill' };
  if (node.requires && !unlocked.has(node.requires)) {
    return { ok: false, reason: 'Requires prerequisite' };
  }
  return { ok: true };
}
