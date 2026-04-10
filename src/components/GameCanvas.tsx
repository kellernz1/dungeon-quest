import { useRef, useEffect, useCallback, useState } from 'react';
import { initGameState, updateGame, renderGame } from '@/game/engine';
import { GameState, HeroClass } from '@/game/types';

interface GameCanvasProps {
  heroClass: HeroClass;
  onStateChange?: (state: GameState) => void;
}

const CANVAS_W = 800;
const CANVAS_H = 600;

export default function GameCanvas({ heroClass, onStateChange }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(initGameState(heroClass));
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [restartKey, setRestartKey] = useState(0);

  const restart = useCallback(() => {
    stateRef.current = initGameState(heroClass);
    setRestartKey(k => k + 1);
  }, [heroClass]);

  useEffect(() => {
    stateRef.current = initGameState(heroClass);
    setRestartKey(k => k + 1);
  }, [heroClass]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const state = stateRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      state.keys.add(e.key.toLowerCase());
      if (e.key === ' ') e.preventDefault();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      state.keys.delete(e.key.toLowerCase());
    };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      state.mouse.x = (e.clientX - rect.left) * scaleX;
      state.mouse.y = (e.clientY - rect.top) * scaleY;
    };
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        if (state.gameOver) {
          restart();
          return;
        }
        state.mouseDown = true;
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) state.mouseDown = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);

    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;

      updateGame(stateRef.current, dt);

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      renderGame(ctx, stateRef.current, now / 1000);

      onStateChange?.(stateRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [restartKey, onStateChange, restart]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      className="w-full max-w-[800px] rounded-lg border-2 border-border cursor-crosshair"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
