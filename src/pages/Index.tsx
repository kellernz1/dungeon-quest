import { useCallback, useState } from 'react';
import { ArrowLeft, Castle, Flame } from 'lucide-react';
import GameCanvas from '@/components/GameCanvas';
import GameHUD from '@/components/GameHUD';
import HeroSelect from '@/components/HeroSelect';
import { GameState, HeroClass } from '@/game/types';

export default function Index() {
  const [heroClass, setHeroClass] = useState<HeroClass | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  const handleStateChange = useCallback((s: GameState) => {
    setGameState({ ...s, player: { ...s.player } });
  }, []);

  if (!heroClass) {
    return <HeroSelect onSelect={setHeroClass} />;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-3 py-4">
      <div className="dungeon-backdrop" aria-hidden="true" />
      <div className="relative flex w-full max-w-[920px] flex-col items-center justify-center gap-3">
        <header className="flex w-full max-w-[800px] items-center justify-between gap-3 border border-border bg-card/90 px-3 py-2 shadow-xl shadow-black/20">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-primary/50 bg-primary/15 text-primary">
              <Castle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Flame className="h-3.5 w-3.5 shrink-0 text-primary" />
                <h1 className="truncate font-display text-lg font-bold tracking-wide text-primary">
                  Dungeon Quest
                </h1>
              </div>
              <p className="truncate text-[11px] text-muted-foreground">
                Solo dungeon run · heroes, loot, bosses, power-ups
              </p>
            </div>
          </div>
          <button
            onClick={() => setHeroClass(null)}
            className="flex h-8 items-center gap-1.5 border border-border bg-secondary px-2.5 text-xs text-secondary-foreground transition hover:border-primary/60 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Heroes
          </button>
        </header>

        <GameHUD state={gameState} />
        <GameCanvas heroClass={heroClass} onStateChange={handleStateChange} />
      </div>
    </main>
  );
}
