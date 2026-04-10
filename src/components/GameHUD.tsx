import { GameState, HERO_CONFIGS } from '@/game/types';
import { Swords, Heart, Zap, Coins, Shield, Star } from 'lucide-react';

interface GameHUDProps {
  state: GameState | null;
}

export default function GameHUD({ state }: GameHUDProps) {
  if (!state) return null;
  const { player: p } = state;
  const cfg = HERO_CONFIGS[p.heroClass];

  return (
    <div className="w-full max-w-[800px] space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 rounded-lg bg-card border border-border p-3">
        {/* Hero info */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center border-2"
            style={{ backgroundColor: cfg.color, borderColor: cfg.color }}
          >
            <Swords className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-display text-sm font-bold text-foreground">{cfg.name}</p>
            <p className="text-xs text-muted-foreground">Lv.{p.level}</p>
          </div>
        </div>

        {/* Bars */}
        <div className="flex-1 space-y-1.5 max-w-xs">
          {/* HP */}
          <div className="flex items-center gap-2">
            <Heart className="w-3.5 h-3.5 text-health shrink-0" />
            <div className="flex-1 h-3 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-health transition-all duration-200"
                style={{ width: `${(p.hp / p.maxHp) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-14 text-right">{p.hp}/{p.maxHp}</span>
          </div>
          {/* Mana */}
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-mana shrink-0" />
            <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-mana transition-all duration-200"
                style={{ width: `${(p.mana / p.maxMana) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-14 text-right">{Math.floor(p.mana)}/{p.maxMana}</span>
          </div>
          {/* XP */}
          <div className="flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-xp shrink-0" />
            <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-xp transition-all duration-200"
                style={{ width: `${(p.xp / p.xpToNext) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-14 text-right">{p.xp}/{p.xpToNext}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-xp" />
            <span className="text-foreground font-medium">{p.gold}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground font-medium">W{state.wave}</span>
          </div>
          <div className="text-muted-foreground text-xs flex items-center">
            {state.enemies.length} enemies
          </div>
        </div>
      </div>

      {/* Ability cooldown */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border font-mono text-foreground">SPACE</kbd>
        <span>Ability {p.abilityTimer > 0 ? `(${p.abilityTimer.toFixed(1)}s)` : '— Ready!'}</span>
        <span className="mx-2">·</span>
        <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border font-mono text-foreground">WASD</kbd>
        <span>Move</span>
        <span className="mx-2">·</span>
        <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border font-mono text-foreground">CLICK</kbd>
        <span>Attack</span>
      </div>
    </div>
  );
}
