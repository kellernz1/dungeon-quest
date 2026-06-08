import type { ReactNode } from 'react';
import { HeroClass, HERO_CONFIGS } from '@/game/types';
import { getHighScore } from '@/game/highscore';
import {
  Axe,
  Castle,
  Crosshair,
  Flame,
  Gem,
  Map,
  Skull,
  Sparkles,
  Swords,
  Trophy,
  Wand2,
} from 'lucide-react';

interface HeroSelectProps {
  onSelect: (hero: HeroClass) => void;
}

const ICONS: Record<HeroClass, ReactNode> = {
  warrior: <Axe className="h-7 w-7" />,
  archer: <Crosshair className="h-7 w-7" />,
  mage: <Wand2 className="h-7 w-7" />,
  rogue: <Swords className="h-7 w-7" />,
};

const CLASS_TAGS: Record<HeroClass, string[]> = {
  warrior: ['Frontline', 'Knockback', 'Durable'],
  archer: ['Ranged', 'Fast', 'Burst'],
  mage: ['Control', 'AoE', 'Mana'],
  rogue: ['Dash', 'Crits', 'Close range'],
};

const ROADMAP = [
  { icon: <Castle className="h-4 w-4" />, label: 'Dungeon loop', state: 'Playable' },
  { icon: <Skull className="h-4 w-4" />, label: 'Boss tiers', state: 'Playable' },
  { icon: <Gem className="h-4 w-4" />, label: 'Power-ups', state: 'Playable' },
  { icon: <Map className="h-4 w-4" />, label: 'Co-op backend', state: 'Planned' },
];

export default function HeroSelect({ onSelect }: HeroSelectProps) {
  const hs = getHighScore();

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 text-foreground">
      <div className="dungeon-backdrop" aria-hidden="true" />
      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl grid-cols-1 items-center gap-5 lg:grid-cols-[1fr_380px]">
        <section className="space-y-5">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 border border-primary/35 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              <Flame className="h-3.5 w-3.5" />
              Dungeon crawler prototype
            </div>
            <div>
              <h1 className="font-display text-5xl font-black leading-none text-primary sm:text-6xl lg:text-7xl">
                Dungeon Quest
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Choose a hero and enter a fast combat run with connected rooms, tier bosses,
                rare drops, shops, and persistent score progression.
              </p>
            </div>
          </div>

          <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
            {(Object.keys(HERO_CONFIGS) as HeroClass[]).map((key) => {
              const cfg = HERO_CONFIGS[key];
              return (
                <button
                  key={key}
                  onClick={() => onSelect(key)}
                  className="group relative overflow-hidden border border-border bg-card/88 p-4 text-left shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-primary/70 hover:bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: cfg.color }} />
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center border"
                      style={{ backgroundColor: `${cfg.color}22`, borderColor: `${cfg.color}77`, color: cfg.color }}
                    >
                      {ICONS[key]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="font-display text-lg font-bold text-foreground">{cfg.name}</h2>
                        <span className="text-xs font-semibold text-primary">Start</span>
                      </div>
                      <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{cfg.description}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
                    <Stat label="HP" value={cfg.hp} />
                    <Stat label="DMG" value={cfg.damage} />
                    <Stat label="SPD" value={cfg.speed} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {CLASS_TAGS[key].map((tag) => (
                      <span key={tag} className="border border-border bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="space-y-3">
          {hs.best && (
            <section className="border border-xp/35 bg-card/90 p-4 shadow-xl shadow-black/20">
              <div className="flex items-center gap-2 text-xp">
                <Trophy className="h-5 w-5" />
                <h2 className="font-display text-base font-bold">Best run</h2>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Score" value={hs.best.score} highlight />
                <Stat label="Hero" value={HERO_CONFIGS[hs.best.heroClass].name} />
                <Stat label="Tier" value={`T${hs.best.tier}`} />
              </div>
            </section>
          )}

          <section className="border border-border bg-card/90 p-4 shadow-xl shadow-black/20">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <h2 className="font-display text-base font-bold">Game status</h2>
            </div>
            <div className="mt-3 space-y-2">
              {ROADMAP.map((item) => (
                <div key={item.label} className="flex items-center justify-between border border-border bg-secondary/60 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <span className="text-primary">{item.icon}</span>
                    {item.label}
                  </div>
                  <span className={item.state === 'Playable' ? 'text-xs font-semibold text-health' : 'text-xs text-muted-foreground'}>
                    {item.state}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {hs.recent.length > 0 && (
            <section className="border border-border bg-card/90 p-4 shadow-xl shadow-black/20">
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Recent runs
              </h2>
              <div className="mt-3 divide-y divide-border border border-border">
                {hs.recent.slice(0, 5).map((r, i) => {
                  const mm = String(Math.floor(r.timeSec / 60)).padStart(2, '0');
                  const ss = String(Math.floor(r.timeSec % 60)).padStart(2, '0');
                  const isBest = hs.best && r.date === hs.best.date && r.score === hs.best.score;
                  return (
                    <div key={`${r.date}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground">{HERO_CONFIGS[r.heroClass].name}</span>
                        <span className="text-muted-foreground"> Lv.{r.level} · T{r.tier}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 font-mono text-muted-foreground">
                        <span>{mm}:{ss}</span>
                        <span className={isBest ? 'font-bold text-xp' : 'text-foreground'}>{r.score}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="border border-border bg-background/55 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={highlight ? 'truncate font-display text-base font-bold text-xp' : 'truncate text-sm font-semibold text-foreground'}>
        {value}
      </div>
    </div>
  );
}
