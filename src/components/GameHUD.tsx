import { useState } from 'react';
import { GameState, HERO_CONFIGS, RARITY_COLORS, EFFECT_COLORS } from '@/game/types';
import { audio } from '@/game/audio';
import { Heart, Zap, Coins, Shield, Star, Skull, Swords, Volume2, VolumeX } from 'lucide-react';

interface GameHUDProps {
  state: GameState | null;
}

export default function GameHUD({ state }: GameHUDProps) {
  if (!state) return null;
  const { player: p, dungeon } = state;
  const cfg = HERO_CONFIGS[p.heroClass];
  const room = state.room;

  const rarityColor = RARITY_COLORS[p.weapon.rarity];

  return (
    <div className="w-full max-w-[800px] space-y-2">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 rounded-lg bg-card border border-border p-2.5">
        {/* Hero info */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center border-2"
            style={{ backgroundColor: cfg.color, borderColor: cfg.color }}
          >
            <Swords className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-display text-xs font-bold text-foreground">{cfg.name} Lv.{p.level}</p>
            <p className="text-[10px] text-muted-foreground">{p.killCount} kills</p>
          </div>
        </div>

        {/* Bars */}
        <div className="flex-1 space-y-1 max-w-[240px]">
          <div className="flex items-center gap-1.5">
            <Heart className="w-3 h-3 text-health shrink-0" />
            <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-health transition-all duration-200" style={{ width: `${(p.hp / p.maxHp) * 100}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground w-12 text-right">{p.hp}/{p.maxHp}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-mana shrink-0" />
            <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-mana transition-all duration-200" style={{ width: `${(p.mana / p.maxMana) * 100}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground w-12 text-right">{Math.floor(p.mana)}/{p.maxMana}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="w-3 h-3 text-xp shrink-0" />
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-xp transition-all duration-200" style={{ width: `${(p.xp / p.xpToNext) * 100}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground w-12 text-right">{p.xp}/{p.xpToNext}</span>
          </div>
        </div>

        {/* Weapon */}
        <div className="shrink-0 rounded-md border px-2 py-1.5 text-center" style={{ borderColor: rarityColor + '66' }}>
          <p className="text-[10px] font-bold" style={{ color: rarityColor }}>{p.weapon.name}</p>
          <p className="text-[9px] text-muted-foreground">
            DMG {p.weapon.damage} · {p.weapon.isRanged ? 'Ranged' : 'Melee'}
            {p.weapon.effect && <span style={{ color: EFFECT_COLORS[p.weapon.effect] }}> ✦ {p.weapon.effect}</span>}
          </p>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-1 text-[11px] shrink-0">
          <div className="flex items-center gap-1">
            <Coins className="w-3 h-3 text-xp" />
            <span className="text-foreground font-medium">{p.gold}</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-muted-foreground" />
            <span className="text-foreground font-medium">T{dungeon.tier}</span>
          </div>
          <div className="flex items-center gap-1">
            <Skull className="w-3 h-3 text-muted-foreground" />
            <span className="text-foreground font-medium">{state.enemies.length}</span>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
        <div className="flex items-center gap-3">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-secondary border border-border font-mono text-foreground text-[9px]">WASD</kbd> Move
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-secondary border border-border font-mono text-foreground text-[9px]">CLICK</kbd> Attack
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-secondary border border-border font-mono text-foreground text-[9px]">SPACE</kbd>
            {' '}Ability {p.abilityTimer > 0 ? `(${p.abilityTimer.toFixed(1)}s)` : '✓'}
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-secondary border border-border font-mono text-foreground text-[9px]">SHIFT</kbd> Dodge
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-secondary border border-border font-mono text-foreground text-[9px]">E</kbd> Interact
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-secondary border border-border font-mono text-foreground text-[9px]">TAB</kbd> Inv ({p.inventory.length}/8)
          </span>
        </div>
        <span className="capitalize">{room.theme} · {room.type} room</span>
      </div>
    </div>
  );
}
