import { useRef, useEffect, useCallback, useState } from 'react';
import { initGameState, updateGame, applyLevelUpChoice, unlockSkill, syncPlayerWeaponStats } from '@/game/engine';
import { renderGame } from '@/game/renderer';
import { audio } from '@/game/audio';
import { CoopClient } from '@/game/network';
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
  const networkRef = useRef<CoopClient>(new CoopClient());
  const [restartKey, setRestartKey] = useState(0);
  const [, setUiTick] = useState(0);

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
          state.showMap = false;
        }
        return;
      }

      // Toggle pause (P or Escape)
      if (key === 'p' || e.key === 'Escape') {
        if (!state.gameOver && !state.levelUpChoices) {
          state.paused = !state.paused;
        }
        return;
      }

      // Toggle dungeon map (M)
      if (key === 'm') {
        state.showMap = !state.showMap;
        if (state.showMap) {
          state.showInventory = false;
          state.showShop = false;
          state.showSkillTree = false;
          state.showHelp = false;
        }
        return;
      }

      // Toggle help (H or ?)
      if (key === 'h' || key === '?') {
        state.showHelp = !state.showHelp;
        if (state.showHelp) {
          state.showInventory = false;
          state.showShop = false;
          state.showSkillTree = false;
          state.showMap = false;
        }
        return;
      }

      // Quaff potions
      if (key === 'q' && state.player.healthPotions > 0 && state.player.alive) {
        state.player.healthPotions -= 1;
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + Math.floor(state.player.maxHp * 0.5));
        audio.play('pickup_health');
      }
      if (key === 'f' && state.player.manaPotions > 0 && state.player.alive) {
        state.player.manaPotions -= 1;
        state.player.mana = Math.min(state.player.maxMana, state.player.mana + Math.floor(state.player.maxMana * 0.6));
        audio.play('pickup_health');
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
            if (state.coop.connected && state.coop.role === 'guest') {
              state.coop.outgoingEvents.push({ type: 'buyShopItem', itemIndex: idx });
            }
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
          syncPlayerWeaponStats(state.player);
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
      const aimDx = state.mouse.x - state.player.pos.x;
      const aimDy = state.mouse.y - state.player.pos.y;
      const aimLen = Math.hypot(aimDx, aimDy);
      if (aimLen > 0.001) {
        state.player.facing = { x: aimDx / aimLen, y: aimDy / aimLen };
      }
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

      // Don't shoot while map overlay is open
      if (state.showMap) return;

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
      networkRef.current.tick(stateRef.current, now);

      // Draw inventory overlay on canvas
      if (stateRef.current.showInventory) {
        renderInventoryOverlay(ctx, stateRef.current);
      }

      // Draw shop overlay
      if (stateRef.current.showShop) {
        renderShopOverlay(ctx, stateRef.current);
      }

      // Draw skill tree overlay
      if (stateRef.current.showSkillTree) {
        renderSkillTreeOverlay(ctx, stateRef.current);
      }

      // Full dungeon map overlay
      if (stateRef.current.showMap) {
        renderMapOverlay(ctx, stateRef.current);
      }

      // Help overlay
      if (stateRef.current.showHelp) {
        renderHelpOverlay(ctx);
      }

      // Pause overlay (drawn last so it sits on top)
      if (stateRef.current.paused && !stateRef.current.gameOver && !stateRef.current.levelUpChoices) {
        renderPauseOverlay(ctx);
      }

      // Throttle React state updates
      if (frameCount % 6 === 0) {
        onStateChange?.({ ...stateRef.current, player: { ...stateRef.current.player } });
        setUiTick(tick => (tick + 1) % 100000);
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
    <div className="w-full max-w-[800px] space-y-2">
      <CoopPanel
        state={stateRef.current}
        onHost={() => networkRef.current.connect(stateRef.current)}
        onJoin={(code) => networkRef.current.connect(stateRef.current, code)}
        onDisconnect={() => networkRef.current.disconnect(stateRef.current)}
      />
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full border-2 border-primary/35 bg-black shadow-2xl shadow-black/45 cursor-crosshair"
        style={{ imageRendering: 'pixelated' }}
        tabIndex={0}
      />
    </div>
  );
}

function CoopPanel({
  state,
  onHost,
  onJoin,
  onDisconnect,
}: {
  state: GameState;
  onHost: () => void;
  onJoin: (code: string) => void;
  onDisconnect: () => void;
}) {
  const [code, setCode] = useState('');
  const coop = state.coop;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card/90 px-2 py-1.5 text-[11px] shadow-xl shadow-black/20">
      <div className="flex items-center gap-2">
        <span className={coop.connected ? 'font-semibold text-health' : coop.connecting ? 'font-semibold text-primary' : 'text-muted-foreground'}>
          Co-op {coop.connected ? `online · ${coop.roomCode}` : coop.connecting ? 'connecting' : 'offline'}
        </span>
        {coop.connected && coop.role && (
          <span className="text-muted-foreground">{coop.role === 'host' ? 'Host' : 'Guest'}</span>
        )}
        {coop.remotePlayers.length > 0 && (
          <span className="text-muted-foreground">{coop.remotePlayers.length} ally online</span>
        )}
        {coop.error && <span className="text-destructive">{coop.error}</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="ROOM"
          maxLength={6}
          className="h-7 w-20 border border-border bg-background px-2 font-mono text-xs text-foreground outline-none"
        />
        <button type="button" onClick={onHost} className="h-7 border border-border bg-secondary px-2 text-foreground hover:border-primary">
          Host
        </button>
        <button type="button" onClick={() => onJoin(code)} className="h-7 border border-border bg-secondary px-2 text-foreground hover:border-primary">
          Join
        </button>
        {coop.connected && (
          <button type="button" onClick={onDisconnect} className="h-7 border border-border bg-background px-2 text-muted-foreground hover:text-foreground">
            Leave
          </button>
        )}
      </div>
    </div>
  );
}

function renderPauseOverlay(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.font = 'bold 48px Cinzel';
  ctx.fillStyle = '#f1c40f';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 10);

  ctx.font = '14px Inter';
  ctx.fillStyle = '#ccc';
  ctx.fillText('Press P or ESC to resume', CANVAS_W / 2, CANVAS_H / 2 + 24);
}

function renderHelpOverlay(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const px = 100, py = 60, pw = 600, ph = 480;
  ctx.fillStyle = 'rgba(20,15,30,0.95)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#9b59b6';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);

  ctx.font = 'bold 26px Cinzel';
  ctx.fillStyle = '#f1c40f';
  ctx.textAlign = 'center';
  ctx.fillText('CONTROLS', CANVAS_W / 2, py + 44);

  const sections: { title: string; rows: [string, string][] }[] = [
    {
      title: 'Movement & Combat',
      rows: [
        ['WASD / Arrows', 'Move'],
        ['Mouse', 'Aim'],
        ['Left Click', 'Attack'],
        ['Space', 'Class ability'],
        ['Shift', 'Dodge roll'],
        ['R', 'Swap weapons'],
      ],
    },
    {
      title: 'Items & Menus',
      rows: [
        ['Q', 'Health potion'],
        ['F', 'Mana potion'],
        ['Tab', 'Inventory'],
        ['1-8', 'Equip weapon (in inventory)'],
        ['X', 'Drop last weapon'],
        ['E', 'Open/close shop'],
      ],
    },
    {
      title: 'World & System',
      rows: [
        ['M', 'Dungeon map'],
        ['K', 'Skill tree'],
        ['H / ?', 'This help'],
        ['P / ESC', 'Pause'],
        ['1-4', 'Choose level-up bonus'],
      ],
    },
  ];

  let cy = py + 80;
  ctx.textAlign = 'left';
  for (const s of sections) {
    ctx.font = 'bold 13px Cinzel';
    ctx.fillStyle = '#9b59b6';
    ctx.fillText(s.title.toUpperCase(), px + 30, cy);
    cy += 18;
    ctx.font = '12px Inter';
    for (const [k, v] of s.rows) {
      ctx.fillStyle = '#f1c40f';
      ctx.fillText(k, px + 50, cy);
      ctx.fillStyle = '#ccc';
      ctx.fillText(v, px + 200, cy);
      cy += 16;
    }
    cy += 6;
  }

  ctx.font = '11px Inter';
  ctx.fillStyle = '#888';
  ctx.textAlign = 'center';
  ctx.fillText('Press H to close', CANVAS_W / 2, py + ph - 16);
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
  ctx.fillText('Secondary weapon (press R to swap):', 430, 150);
  if (p.secondaryWeapon) {
    const sw = p.secondaryWeapon;
    ctx.fillStyle = RARITY_COLORS[sw.rarity];
    ctx.font = 'bold 14px Inter';
    ctx.fillText(sw.name, 430, 175);
    ctx.fillStyle = '#999';
    ctx.font = '11px Inter';
    ctx.fillText(`DMG ${sw.damage} · SPD ${sw.attackSpeed} · ${sw.isRanged ? 'Ranged' : 'Melee'}`, 430, 195);
  } else {
    ctx.fillStyle = '#666';
    ctx.font = '12px Inter';
    ctx.fillText('Empty', 430, 175);
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

// ── Skill Tree layout helpers ──

const NODE_R = 32;

/** Computes the (x, y) center of each node for a class. */
function skillNodeLayout(heroClass: HeroClass): { node: SkillNode; x: number; y: number }[] {
  const tree = SKILL_TREES[heroClass];
  // Group by tier, then by position within tier
  const byTier: Record<number, SkillNode[]> = { 1: [], 2: [], 3: [] };
  for (const n of tree) byTier[n.tier].push(n);

  const cols = 2;
  const colSpacing = 160;
  const rowY = [200, 320, 440]; // tier 1, 2, 3
  const startX = 400 - ((cols - 1) * colSpacing) / 2;

  const out: { node: SkillNode; x: number; y: number }[] = [];
  for (const tier of [1, 2, 3] as const) {
    const nodes = byTier[tier];
    nodes.forEach((n, i) => {
      out.push({ node: n, x: startX + i * colSpacing, y: rowY[tier - 1] });
    });
  }
  return out;
}

function pickSkillNode(heroClass: HeroClass, mx: number, my: number): SkillNode | null {
  for (const { node, x, y } of skillNodeLayout(heroClass)) {
    if ((mx - x) ** 2 + (my - y) ** 2 <= NODE_R * NODE_R) return node;
  }
  return null;
}

function renderSkillTreeOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  const p = state.player;
  const cfg = HERO_CONFIGS[p.heroClass];
  const layout = skillNodeLayout(p.heroClass);
  const unlocked = new Set(p.unlockedSkills);

  // Backdrop
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(40, 40, 720, 520);
  ctx.strokeStyle = '#9b59b6';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, 720, 520);

  // Title
  ctx.font = 'bold 24px Cinzel';
  ctx.fillStyle = '#9b59b6';
  ctx.textAlign = 'center';
  ctx.fillText(`${cfg.name.toUpperCase()} — SKILL TREE`, 400, 80);

  ctx.font = '13px Inter';
  ctx.fillStyle = '#f1c40f';
  ctx.fillText(`Skill Points: ${p.skillPoints}`, 400, 105);

  ctx.fillStyle = '#888';
  ctx.font = '11px Inter';
  ctx.fillText('Click a node to unlock · Skills are permanent passive bonuses', 400, 125);

  // Draw connection lines (prereqs)
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  for (const { node, x, y } of layout) {
    if (!node.requires) continue;
    const parent = layout.find(l => l.node.id === node.requires);
    if (!parent) continue;
    const isLineUnlocked = unlocked.has(parent.node.id) && unlocked.has(node.id);
    ctx.strokeStyle = isLineUnlocked ? '#9b59b6' : '#3a3a3a';
    ctx.beginPath();
    ctx.moveTo(parent.x, parent.y + NODE_R);
    ctx.lineTo(x, y - NODE_R);
    ctx.stroke();
  }

  // Hover detection
  const hover = pickSkillNode(p.heroClass, state.mouse.x, state.mouse.y);

  // Draw nodes
  for (const { node, x, y } of layout) {
    const isUnlocked = unlocked.has(node.id);
    const prereqMet = !node.requires || unlocked.has(node.requires);
    const canBuy = !isUnlocked && prereqMet && p.skillPoints > 0;
    const isHover = hover?.id === node.id;

    // Node background
    ctx.beginPath();
    ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
    if (isUnlocked) ctx.fillStyle = '#9b59b6';
    else if (canBuy) ctx.fillStyle = isHover ? '#5a3a6e' : '#3a2a4e';
    else ctx.fillStyle = '#2a2a2a';
    ctx.fill();

    ctx.lineWidth = isHover && canBuy ? 3 : 2;
    ctx.strokeStyle = isUnlocked ? '#f1c40f' : canBuy ? '#9b59b6' : '#444';
    ctx.stroke();

    // Tier indicator
    ctx.fillStyle = isUnlocked || canBuy ? '#f5f5f5' : '#666';
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(`T${node.tier}`, x, y - 4);

    // Skill name
    ctx.font = 'bold 10px Inter';
    ctx.fillText(node.name, x, y + 10);
  }

  // Tooltip box for hovered node
  if (hover) {
    const tipX = 60;
    const tipY = 480;
    const tipW = 680;
    const tipH = 60;
    ctx.fillStyle = 'rgba(20,20,30,0.95)';
    ctx.fillRect(tipX, tipY, tipW, tipH);
    ctx.strokeStyle = '#9b59b6';
    ctx.lineWidth = 1;
    ctx.strokeRect(tipX, tipY, tipW, tipH);

    ctx.textAlign = 'left';
    ctx.font = 'bold 14px Inter';
    ctx.fillStyle = unlocked.has(hover.id) ? '#f1c40f' : '#e0d4ff';
    ctx.fillText(hover.name, tipX + 12, tipY + 22);

    ctx.font = '12px Inter';
    ctx.fillStyle = '#bbb';
    ctx.fillText(hover.description, tipX + 12, tipY + 42);

    ctx.textAlign = 'right';
    ctx.font = '11px Inter';
    if (unlocked.has(hover.id)) {
      ctx.fillStyle = '#2ecc71';
      ctx.fillText('UNLOCKED', tipX + tipW - 12, tipY + 22);
    } else if (hover.requires && !unlocked.has(hover.requires)) {
      ctx.fillStyle = '#e74c3c';
      ctx.fillText('Locked: requires prereq', tipX + tipW - 12, tipY + 22);
    } else if (p.skillPoints <= 0) {
      ctx.fillStyle = '#e74c3c';
      ctx.fillText('Need skill points', tipX + tipW - 12, tipY + 22);
    } else {
      ctx.fillStyle = '#9b59b6';
      ctx.fillText('Click to unlock (1 pt)', tipX + tipW - 12, tipY + 22);
    }
  }

  ctx.font = '11px Inter';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'center';
  ctx.fillText('Press K to close', 400, 555);
}

// ── Minimap & Dungeon Map ──

const ROOM_TYPE_COLORS: Record<string, string> = {
  start: '#7f8c8d',
  combat: '#c0392b',
  treasure: '#f1c40f',
  shop: '#27ae60',
  boss: '#9b59b6',
};

const ROOM_TYPE_GLYPHS: Record<string, string> = {
  start: '◉',
  combat: '⚔',
  treasure: '$',
  shop: '🛒',
  boss: '☠',
};

interface MapBounds {
  minX: number; minY: number; maxX: number; maxY: number;
}

function computeBounds(state: GameState): MapBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of state.dungeon.rooms) {
    if (r.gridX < minX) minX = r.gridX;
    if (r.gridY < minY) minY = r.gridY;
    if (r.gridX > maxX) maxX = r.gridX;
    if (r.gridY > maxY) maxY = r.gridY;
  }
  return { minX, minY, maxX, maxY };
}

function renderMapOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, CANVAS_W, 600);

  ctx.font = 'bold 24px Cinzel';
  ctx.fillStyle = '#f1c40f';
  ctx.textAlign = 'center';
  ctx.fillText(`DUNGEON MAP — TIER ${state.dungeon.tier}`, 400, 60);

  const b = computeBounds(state);
  const cellSize = 64;
  const cols = b.maxX - b.minX + 1;
  const rows = b.maxY - b.minY + 1;
  const totalW = cols * cellSize;
  const totalH = rows * cellSize;
  const startX = (CANVAS_W - totalW) / 2;
  const startY = 100 + (380 - totalH) / 2;

  drawMapCells(ctx, state, b, startX, startY, cellSize, true);

  // Legend
  const legendY = 510;
  ctx.font = '11px Inter';
  ctx.textAlign = 'left';
  const entries: [string, string][] = [
    ['start', 'Start'], ['combat', 'Combat'], ['treasure', 'Treasure'], ['shop', 'Shop'], ['boss', 'Boss'],
  ];
  let lx = 80;
  for (const [type, label] of entries) {
    ctx.fillStyle = ROOM_TYPE_COLORS[type];
    ctx.fillRect(lx, legendY, 12, 12);
    ctx.fillStyle = '#ccc';
    ctx.fillText(label, lx + 18, legendY + 10);
    lx += 90;
  }

  ctx.font = '11px Inter';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'center';
  ctx.fillText('Press M to close · Unexplored rooms shown as ?', 400, 555);
}

function drawMapCells(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  b: MapBounds,
  ox: number,
  oy: number,
  cellSize: number,
  large: boolean,
) {
  const rooms = state.dungeon.rooms;
  const currentId = state.dungeon.currentRoomId;
  const gap = Math.max(2, Math.floor(cellSize * 0.08));

  // Connections (doors) — draw under cells
  ctx.strokeStyle = '#666';
  ctx.lineWidth = Math.max(1, cellSize * 0.06);
  for (const r of rooms) {
    if (!r.visited) continue;
    for (const door of r.doors) {
      const target = rooms[door.targetRoom];
      if (!target.visited) continue;
      const x1 = ox + (r.gridX - b.minX) * cellSize + cellSize / 2;
      const y1 = oy + (r.gridY - b.minY) * cellSize + cellSize / 2;
      const x2 = ox + (target.gridX - b.minX) * cellSize + cellSize / 2;
      const y2 = oy + (target.gridY - b.minY) * cellSize + cellSize / 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  // Rooms
  for (const r of rooms) {
    const cx = ox + (r.gridX - b.minX) * cellSize + gap;
    const cy = oy + (r.gridY - b.minY) * cellSize + gap;
    const sz = cellSize - gap * 2;
    const isCurrent = r.id === currentId;

    // Adjacency to a visited room reveals existence (but not contents)
    const adjacentToVisited = !r.visited && rooms.some(
      o => o.visited && Math.abs(o.gridX - r.gridX) + Math.abs(o.gridY - r.gridY) === 1,
    );
    const knownExists = r.visited || adjacentToVisited;
    if (!knownExists) continue;

    if (r.visited) {
      ctx.fillStyle = ROOM_TYPE_COLORS[r.type] + (r.cleared ? 'cc' : 'aa');
    } else {
      ctx.fillStyle = '#333';
    }
    ctx.fillRect(cx, cy, sz, sz);

    ctx.strokeStyle = isCurrent ? '#fff' : '#222';
    ctx.lineWidth = isCurrent ? Math.max(2, cellSize * 0.06) : 1;
    ctx.strokeRect(cx, cy, sz, sz);

    if (large) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (r.visited) {
        ctx.font = `bold ${Math.floor(sz * 0.4)}px Inter`;
        ctx.fillStyle = '#fff';
        ctx.fillText(ROOM_TYPE_GLYPHS[r.type] || '?', cx + sz / 2, cy + sz / 2);
      } else {
        ctx.font = `bold ${Math.floor(sz * 0.5)}px Inter`;
        ctx.fillStyle = '#888';
        ctx.fillText('?', cx + sz / 2, cy + sz / 2);
      }
      ctx.textBaseline = 'alphabetic';
    } else if (isCurrent) {
      // Pulse dot for current on minimap
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx + sz / 2, cy + sz / 2, Math.max(2, sz * 0.18), 0, Math.PI * 2);
      ctx.fill();
    } else if (!r.visited) {
      ctx.fillStyle = '#888';
      ctx.font = `bold ${Math.floor(sz * 0.7)}px Inter`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', cx + sz / 2, cy + sz / 2);
      ctx.textBaseline = 'alphabetic';
    }
  }
}
