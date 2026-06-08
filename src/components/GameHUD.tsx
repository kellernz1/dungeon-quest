import { useState } from 'react';
import type { ReactNode } from 'react';
import { GameState, HERO_CONFIGS, RARITY_COLORS, EFFECT_COLORS } from '@/game/types';
import { audio } from '@/game/audio';
import {
  BadgeInfo,
  Coins,
  Heart,
  ListChecks,
  Shield,
  Skull,
  Sparkles,
  Star,
  Swords,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

interface GameHUDProps {
  state: GameState | null;
}

export default function GameHUD({ state }: GameHUDProps) {
  const [muted, setMuted] = useState(audio.isMuted());
  if (!state) return null;

  const { player: p, dungeon, room } = state;
  const cfg = HERO_CONFIGS[p.heroClass];
  const rarityColor = RARITY_COLORS[p.weapon.rarity];

  const handleToggleMute = () => {
    audio.unlock();
    setMuted(audio.toggle());
  };

  return (
    <section className="w-full max-w-[800px] space-y-2">
      <div className="grid grid-cols-1 gap-2 border border-border bg-card/92 p-2 shadow-xl shadow-black/20 lg:grid-cols-[180px_1fr_190px_auto]">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center border"
            style={{ backgroundColor: `${cfg.color}30`, borderColor: `${cfg.color}88`, color: cfg.color }}
          >
            <Swords className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-foreground">
              {cfg.name} Lv.{p.level}
            </p>
            <p className="text-[10px] text-muted-foreground">{p.killCount} defeats</p>
          </div>
        </div>

        <div className="grid min-w-0 gap-1.5">
          <Meter icon={<Heart className="h-3.5 w-3.5 text-health" />} value={p.hp} max={p.maxHp} color="bg-health" />
          <Meter icon={<Zap className="h-3.5 w-3.5 text-mana" />} value={p.mana} max={p.maxMana} color="bg-mana" />
          <Meter icon={<Star className="h-3.5 w-3.5 text-xp" />} value={p.xp} max={p.xpToNext} color="bg-xp" compact />
        </div>

        <div className="min-w-0 border border-border bg-background/50 px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: rarityColor }} />
            <p className="truncate text-xs font-bold" style={{ color: rarityColor }}>
              {p.weapon.name}
            </p>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            DMG {p.weapon.damage} · {p.weapon.isRanged ? 'Ranged' : 'Melee'}
            {p.weapon.effect && (
              <span style={{ color: EFFECT_COLORS[p.weapon.effect] }}>
                {' '}· {p.weapon.effect}
              </span>
            )}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            R swap: {p.secondaryWeapon ? p.secondaryWeapon.name : 'empty'}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 lg:justify-end">
          <Stat icon={<Coins className="h-3.5 w-3.5 text-xp" />} value={p.gold} label="gold" />
          <Stat icon={<Shield className="h-3.5 w-3.5 text-muted-foreground" />} value={`T${dungeon.tier}`} label="tier" />
          <Stat icon={<Skull className="h-3.5 w-3.5 text-muted-foreground" />} value={state.enemies.length} label="foes" />
          <button
            onClick={handleToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            title={muted ? 'Unmute audio' : 'Mute audio'}
            className="flex h-8 w-8 items-center justify-center border border-border bg-secondary text-foreground transition hover:border-primary/60"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-background/70 px-2 py-1.5 text-[10px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <Chip label="Q" value={p.healthPotions} tone="health" />
          <Chip label="F" value={p.manaPotions} tone="mana" />
          {state.combo.count > 1 && <span className="font-semibold text-primary">Combo x{state.combo.count}</span>}
          {state.activePowerUps.map((powerUp) => (
            <span key={powerUp.type} className="border border-primary/35 bg-primary/10 px-2 py-0.5 font-semibold text-primary">
              {powerUp.type} {Math.ceil(powerUp.timer)}s
            </span>
          ))}
          <span className={p.skillPoints > 0 ? 'font-semibold text-xp' : ''}>Skills {p.skillPoints}</span>
          <span>R Swap</span>
          <span>Inventory {p.inventory.length}/8</span>
          <span className="capitalize">{room.theme} · {room.type}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BadgeInfo className="h-3.5 w-3.5 text-primary" />
          <span>H opens the command sheet</span>
        </div>
      </div>

      <div className="grid gap-1.5 border border-border bg-card/80 p-2 text-[10px] shadow-xl shadow-black/10 sm:grid-cols-3">
        {state.objectives.map((objective) => (
          <div key={objective.id} className="flex min-w-0 items-center gap-2 border border-border bg-background/55 px-2 py-1.5">
            <ListChecks className={objective.completed ? 'h-3.5 w-3.5 shrink-0 text-health' : 'h-3.5 w-3.5 shrink-0 text-primary'} />
            <div className="min-w-0 flex-1">
              <p className={objective.completed ? 'truncate font-semibold text-health' : 'truncate text-foreground'}>
                {objective.label}
              </p>
              <div className="mt-1 h-1 overflow-hidden bg-secondary">
                <div
                  className={objective.completed ? 'h-full bg-health' : 'h-full bg-primary'}
                  style={{ width: `${(objective.progress / objective.target) * 100}%` }}
                />
              </div>
            </div>
            <span className="font-mono text-muted-foreground">
              {objective.progress}/{objective.target}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Meter({
  icon,
  value,
  max,
  color,
  compact = false,
}: {
  icon: ReactNode;
  value: number;
  max: number;
  color: string;
  compact?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <div className={compact ? 'h-1.5 flex-1 overflow-hidden bg-secondary' : 'h-2.5 flex-1 overflow-hidden bg-secondary'}>
        <div className={`h-full ${color} transition-all duration-200`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right font-mono text-[10px] text-muted-foreground">
        {Math.floor(value)}/{max}
      </span>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string | number; label: string }) {
  return (
    <div className="grid min-w-10 place-items-center border border-border bg-secondary px-2 py-1">
      <div className="flex items-center gap-1">
        {icon}
        <span className="font-mono text-xs font-semibold text-foreground">{value}</span>
      </div>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

function Chip({ label, value, tone }: { label: string; value: number; tone: 'health' | 'mana' }) {
  return (
    <span className="inline-flex items-center gap-1 border border-border bg-secondary px-2 py-0.5">
      <span className={tone === 'health' ? 'h-2 w-2 bg-health' : 'h-2 w-2 bg-mana'} />
      <span className="font-mono text-foreground">{label}</span>
      <span>{value}</span>
    </span>
  );
}
