import { useState, useCallback } from 'react';
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
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
      <div className="flex items-center justify-between w-full max-w-[800px]">
        <h1 className="font-display text-xl font-bold text-primary tracking-wide">
          DUNGEON RAMPAGE
        </h1>
        <button
          onClick={() => setHeroClass(null)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Change Hero
        </button>
      </div>

      <GameHUD state={gameState} />
      <GameCanvas heroClass={heroClass} onStateChange={handleStateChange} />
    </div>
  );
}
