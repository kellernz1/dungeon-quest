import { HeroClass, HERO_CONFIGS } from '@/game/types';
import { Swords, Target, Wand2, Dagger } from 'lucide-react';

interface HeroSelectProps {
  onSelect: (hero: HeroClass) => void;
}

const ICONS: Record<HeroClass, React.ReactNode> = {
  warrior: <Swords className="w-8 h-8" />,
  archer: <Target className="w-8 h-8" />,
  mage: <Wand2 className="w-8 h-8" />,
  rogue: <Dagger className="w-8 h-8" />,
};

export default function HeroSelect({ onSelect }: HeroSelectProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-6">
      <div className="text-center space-y-3">
        <h1 className="font-display text-5xl font-bold text-primary tracking-wide">
          DUNGEON RAMPAGE
        </h1>
        <p className="text-muted-foreground text-lg">Choose your champion</p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-lg w-full">
        {(Object.keys(HERO_CONFIGS) as HeroClass[]).map((key) => {
          const cfg = HERO_CONFIGS[key];
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className="group relative rounded-xl border-2 border-border bg-card p-6 text-left transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 active:translate-y-0"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ backgroundColor: cfg.color + '22', color: cfg.color }}
              >
                {ICONS[key]}
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">{cfg.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{cfg.description}</p>
              <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                <span>HP {cfg.hp}</span>
                <span>DMG {cfg.damage}</span>
                <span>SPD {cfg.speed}</span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        Arrow keys or WASD to move · Click to attack · Space for ability
      </p>
    </div>
  );
}
