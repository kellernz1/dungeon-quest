import { useRef, useEffect, useCallback, useState } from 'react';
import { initGameState, updateGame, applyLevelUpChoice, unlockSkill } from '@/game/engine';
import { renderGame } from '@/game/renderer';
import { audio } from '@/game/audio';
import { GameState, HeroClass, RARITY_COLORS, EFFECT_COLORS, LevelUpStat, HERO_CONFIGS } from '@/game/types';
import { SKILL_TREES, SkillNode } from '@/game/skills';

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
      audio.unlock();
      const key = e.key.toLowerCase();
      state.keys.add(key);
      if (e.key === ' ' || e.key === 'Tab') e.preventDefault();

      // Level up choices (1-4)
      if (state.levelUpChoices && key >= '1' && key <= '4') {
        const idx = parseInt(key) - 1;
        if (idx < state.levelUpChoices.length) {
          applyLevelUpChoice(state, state.levelUpChoices[idx]);
        }
        return;
      }

      // Toggle skill tree (K) — close any other overlays first
      if (key === 'k') {
        state.showSkillTree = !state.showSkillTree;
        if (state.showSkillTree) {
          state.showInventory = false;
          state.showShop = false;
        }
        return;
      }

      // Shop interaction
      if (key === 'e' && state.showShop) {
        state.showShop = false;
      } else if (key === 'e' && state.room.type === 'shop') {
        state.showShop = true;
      }

      // Number keys for shop buying
      if (state.showShop && key >= '1' && key <= '3') {
        const idx = parseInt(key) - 1;
        const item = state.shopItems[idx];
        if (item && !item.sold && state.player.gold >= item.price) {
          if (state.player.inventory.length < 8) {
            state.player.gold -= item.price;
            state.player.inventory.push(item.weapon);
            item.sold = true;
            audio.play('shop_buy');
          }
        }
      }

      // Inventory weapon equip (1-8 while inventory open)
      if (state.showInventory && !state.showShop && key >= '1' && key <= '8') {
        const idx = parseInt(key) - 1;
        if (idx < state.player.inventory.length) {
          const old = state.player.weapon;
          state.player.weapon = state.player.inventory[idx];
          state.player.inventory[idx] = old;
          state.player.attackDamage = state.player.weapon.damage;
          state.player.attackRange = state.player.weapon.range;
          state.player.attackCooldown = state.player.weapon.attackSpeed;
        }
      }

      // Drop weapon from inventory
      if (state.showInventory && key === 'x') {
        if (state.player.inventory.length > 0) {
          state.player.inventory.pop();
        }
      }
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
      audio.unlock();
      if (e.button !== 0) return;
      if (state.gameOver) { restart(); return; }

      // Skill tree click — try unlocking the hovered node
      if (state.showSkillTree) {
        const hit = pickSkillNode(state.player.heroClass, state.mouse.x, state.mouse.y);
        if (hit) unlockSkill(state, hit.id);
        return; // don't trigger attack
      }

      state.mouseDown = true;
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
    let frameCount = 0;

    const loop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;
      frameCount++;

      updateGame(stateRef.current, dt);
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      renderGame(ctx, stateRef.current, now / 1000);

      // Draw inventory overlay on canvas
      if (stateRef.current.showInventory) {
        renderInventoryOverlay(ctx, stateRef.current);
      }

      // Draw shop overlay
      if (stateRef.current.showShop) {
        renderShopOverlay(ctx, stateRef.current);
      }

      // Throttle React state updates
      if (frameCount % 6 === 0) {
        onStateChange?.({ ...stateRef.current, player: { ...stateRef.current.player } });
      }

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
      tabIndex={0}
    />
  );
}

function renderInventoryOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  const p = state.player;

  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(100, 80, 600, 440);

  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.strokeRect(100, 80, 600, 440);

  ctx.font = 'bold 22px Cinzel';
  ctx.fillStyle = '#f1c40f';
  ctx.textAlign = 'center';
  ctx.fillText('INVENTORY', 400, 115);

  ctx.font = '14px Inter';
  ctx.fillStyle = '#aaa';
  ctx.textAlign = 'left';
  ctx.fillText('Equipped:', 130, 150);

  const rc = RARITY_COLORS[p.weapon.rarity];
  ctx.fillStyle = rc;
  ctx.font = 'bold 16px Inter';
  ctx.fillText(p.weapon.name, 130, 175);
  ctx.font = '12px Inter';
  ctx.fillStyle = '#999';
  ctx.fillText(`DMG ${p.weapon.damage} · SPD ${p.weapon.attackSpeed} · ${p.weapon.isRanged ? 'Ranged' : 'Melee'}`, 130, 195);
  if (p.weapon.effect) {
    ctx.fillStyle = EFFECT_COLORS[p.weapon.effect];
    ctx.fillText(`✦ ${p.weapon.effect} (${Math.floor((p.weapon.effectChance || 0) * 100)}%)`, 130, 212);
  }

  ctx.fillStyle = '#aaa';
  ctx.font = '13px Inter';
  ctx.fillText('Inventory (press 1-8 to equip, X to drop last):', 130, 245);

  for (let i = 0; i < 8; i++) {
    const x = 130 + (i % 4) * 140;
    const y = 260 + Math.floor(i / 4) * 90;

    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, 125, 75);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 125, 75);

    ctx.fillStyle = '#555';
    ctx.font = '10px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(`[${i + 1}]`, x + 4, y + 14);

    if (i < p.inventory.length) {
      const w = p.inventory[i];
      ctx.fillStyle = RARITY_COLORS[w.rarity];
      ctx.font = 'bold 11px Inter';
      ctx.fillText(w.name, x + 4, y + 32);
      ctx.fillStyle = '#888';
      ctx.font = '10px Inter';
      ctx.fillText(`DMG ${w.damage} · ${w.isRanged ? 'R' : 'M'}`, x + 4, y + 48);
      if (w.effect) {
        ctx.fillStyle = EFFECT_COLORS[w.effect];
        ctx.fillText(`✦ ${w.effect}`, x + 4, y + 62);
      }
    } else {
      ctx.fillStyle = '#444';
      ctx.font = '11px Inter';
      ctx.fillText('Empty', x + 4, y + 40);
    }
  }

  ctx.font = '11px Inter';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'center';
  ctx.fillText('Press TAB to close', 400, 500);
}

function renderShopOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(150, 120, 500, 360);
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 2;
  ctx.strokeRect(150, 120, 500, 360);

  ctx.font = 'bold 24px Cinzel';
  ctx.fillStyle = '#f1c40f';
  ctx.textAlign = 'center';
  ctx.fillText('DUNGEON SHOP', 400, 160);

  ctx.font = '12px Inter';
  ctx.fillStyle = '#aaa';
  ctx.fillText(`Gold: ${state.player.gold}`, 400, 180);

  for (let i = 0; i < state.shopItems.length; i++) {
    const item = state.shopItems[i];
    const y = 210 + i * 80;

    ctx.fillStyle = item.sold ? '#1a1a1a' : '#222';
    ctx.fillRect(180, y, 440, 65);
    ctx.strokeStyle = item.sold ? '#333' : RARITY_COLORS[item.weapon.rarity] + '88';
    ctx.lineWidth = 1;
    ctx.strokeRect(180, y, 440, 65);

    if (item.sold) {
      ctx.font = 'bold 16px Inter';
      ctx.fillStyle = '#555';
      ctx.textAlign = 'center';
      ctx.fillText('SOLD', 400, y + 38);
    } else {
      ctx.textAlign = 'left';
      ctx.font = '11px Inter';
      ctx.fillStyle = '#888';
      ctx.fillText(`[${i + 1}]`, 190, y + 20);

      ctx.fillStyle = RARITY_COLORS[item.weapon.rarity];
      ctx.font = 'bold 14px Inter';
      ctx.fillText(item.weapon.name, 215, y + 22);

      ctx.fillStyle = '#999';
      ctx.font = '11px Inter';
      ctx.fillText(`DMG ${item.weapon.damage} · SPD ${item.weapon.attackSpeed} · ${item.weapon.isRanged ? 'Ranged' : 'Melee'}`, 215, y + 40);

      if (item.weapon.effect) {
        ctx.fillStyle = EFFECT_COLORS[item.weapon.effect];
        ctx.fillText(`✦ ${item.weapon.effect}`, 215, y + 55);
      }

      ctx.textAlign = 'right';
      ctx.fillStyle = state.player.gold >= item.price ? '#f1c40f' : '#e74c3c';
      ctx.font = 'bold 14px Inter';
      ctx.fillText(`${item.price}g`, 600, y + 38);
    }
  }

  ctx.font = '11px Inter';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'center';
  ctx.fillText('Press E to close · Press 1-3 to buy', 400, 460);
}
