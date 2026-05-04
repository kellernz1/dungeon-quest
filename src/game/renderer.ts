import {
  GameState, HERO_CONFIGS, RARITY_COLORS, EFFECT_COLORS,
  EnemyType, Enemy, Chest, Torch,
} from './types';

const ROOM_W = 800;
const ROOM_H = 600;
const TILE = 32;

function enemyColor(type: EnemyType): string {
  switch (type) {
    case 'goblin': return '#2ecc71';
    case 'skeleton': return '#bdc3c7';
    case 'orc': return '#e67e22';
    case 'necromancer': return '#b197fc';
    case 'boss': return '#e74c3c';
  }
}

const THEME_COLORS: Record<string, { floor1: string; floor2: string; wall: string; wallHighlight: string }> = {
  cave: { floor1: '#2e2924', floor2: '#26221e', wall: '#1a1714', wallHighlight: '#332e28' },
  crypt: { floor1: '#252530', floor2: '#1e1e28', wall: '#141420', wallHighlight: '#2e2e3a' },
  fortress: { floor1: '#302820', floor2: '#28221a', wall: '#1c1610', wallHighlight: '#3a3228' },
  shadow: { floor1: '#1a1a24', floor2: '#14141e', wall: '#0e0e16', wallHighlight: '#222230' },
};

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  const { player: p, room } = state;
  const theme = THEME_COLORS[room.theme] || THEME_COLORS.cave;

  ctx.save();

  // Screen shake
  if (state.screenShake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * state.screenShake * 30,
      (Math.random() - 0.5) * state.screenShake * 30,
    );
  }

  // Transition fade
  if (state.transitionTimer > 0) {
    ctx.globalAlpha = 1 - state.transitionTimer / 0.3;
  }

  // ── Floor ──
  ctx.fillStyle = theme.floor1;
  ctx.fillRect(0, 0, ROOM_W, ROOM_H);
  for (let x = TILE; x < ROOM_W - TILE; x += TILE) {
    for (let y = TILE; y < ROOM_H - TILE; y += TILE) {
      ctx.fillStyle = ((x + y) / TILE) % 2 === 0 ? theme.floor1 : theme.floor2;
      ctx.fillRect(x, y, TILE, TILE);
    }
  }

  // Floor cracks
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 8; i++) {
    const cx = TILE + ((i * 97) % (ROOM_W - TILE * 2));
    const cy = TILE + ((i * 137) % (ROOM_H - TILE * 2));
    ctx.fillStyle = '#000';
    ctx.fillRect(cx, cy, 2 + (i % 3) * 2, 1);
  }
  ctx.globalAlpha = 1;

  // ── Walls ──
  for (const w of room.walls) {
    ctx.fillStyle = theme.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = theme.wallHighlight;
    ctx.fillRect(w.x, w.y, w.w, 3);
    ctx.fillStyle = theme.wallHighlight;
    ctx.fillRect(w.x, w.y, 2, w.h);
  }

  // ── Doors ──
  for (const door of room.doors) {
    ctx.fillStyle = door.locked ? '#8b4513' : '#f1c40f';
    ctx.fillRect(door.x, door.y, door.width, door.height);
    if (door.locked) {
      ctx.fillStyle = '#555';
      ctx.fillRect(door.x + 12, door.y + 8, 8, 10);
      ctx.beginPath();
      ctx.arc(door.x + 16, door.y + 10, 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#333';
      ctx.font = '16px Inter';
      ctx.textAlign = 'center';
      const arrows = { n: '▲', s: '▼', e: '►', w: '◄' };
      ctx.fillText(arrows[door.direction], door.x + 16, door.y + 22);
    }
  }

  // ── Traps ──
  for (const trap of state.traps) {
    ctx.save();
    ctx.translate(trap.pos.x, trap.pos.y);

    if (trap.type === 'spikes') {
      ctx.fillStyle = trap.active ? '#888' : '#555';
      ctx.fillRect(-trap.width / 2, -trap.height / 2, trap.width, trap.height);
      if (trap.active) {
        ctx.fillStyle = '#aaa';
        for (let sx = -10; sx <= 10; sx += 5) {
          for (let sy = -10; sy <= 10; sy += 5) {
            ctx.fillRect(sx - 1, sy - 4, 2, 4);
          }
        }
      }
    } else if (trap.type === 'fire_vent') {
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.arc(0, 0, trap.width / 2, 0, Math.PI * 2);
      ctx.fill();
      if (trap.active) {
        ctx.fillStyle = 'rgba(231,76,60,0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, trap.width, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (trap.type === 'arrow_launcher') {
      ctx.fillStyle = '#666';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#444';
      ctx.fillRect(-4, -4, 8, 8);
    }

    ctx.restore();
  }

  // ── Torches ──
  for (const torch of state.torches) {
    ctx.save();
    ctx.translate(torch.pos.x, torch.pos.y);

    // Bracket
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(-3, -8, 6, 12);

    // Flame
    const flicker = Math.sin(time * 8 + torch.flickerOffset) * 0.3 + 0.7;
    const flameH = 8 + flicker * 4;
    const grad = ctx.createRadialGradient(0, -12, 1, 0, -12, flameH);
    grad.addColorStop(0, '#ffd43b');
    grad.addColorStop(0.5, '#f39c12');
    grad.addColorStop(1, 'rgba(231,76,60,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, -12, 5 + flicker * 2, flameH, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Chests ──
  for (const chest of state.chests) {
    ctx.save();
    ctx.translate(chest.pos.x, chest.pos.y);

    if (chest.opened) {
      // Open chest
      ctx.fillStyle = '#6b4226';
      ctx.fillRect(-12, -6, 24, 14);
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(-12, -10, 24, 6);
      ctx.fillStyle = '#4a2e18';
      ctx.fillRect(-10, -4, 20, 2);
      // Sparkle
      if (chest.openTimer > 0) {
        ctx.globalAlpha = chest.openTimer;
        ctx.fillStyle = '#ffd43b';
        for (let s = 0; s < 4; s++) {
          const sx = Math.cos(time * 5 + s * 1.5) * 12;
          const sy = Math.sin(time * 5 + s * 1.5) * 8 - 10;
          ctx.fillRect(sx - 1, sy - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }
    } else {
      // Closed chest
      const glow = chest.rarity === 'legendary' ? '#ffd43b' : chest.rarity === 'epic' ? '#b197fc' : '#8b5a2b';
      ctx.shadowColor = glow;
      ctx.shadowBlur = chest.rarity === 'common' ? 0 : 8;
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(-12, -8, 24, 16);
      ctx.fillStyle = '#6b4226';
      ctx.fillRect(-12, -8, 24, 4);
      // Lock/clasp
      ctx.fillStyle = RARITY_COLORS[chest.rarity];
      ctx.fillRect(-3, -2, 6, 6);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  // ── Loot ──
  for (const l of state.loot) {
    const bob = Math.sin(time * 3 + l.bobOffset) * 3;
    ctx.save();
    ctx.translate(l.pos.x, l.pos.y + bob);

    if (l.type === 'gold') {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f39c12';
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    } else if (l.type === 'health') {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-4, -2, 8, 4);
      ctx.fillRect(-2, -4, 4, 8);
    } else if (l.type === 'mana') {
      ctx.fillStyle = '#74c0fc';
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(5, 4); ctx.lineTo(-5, 4);
      ctx.closePath(); ctx.fill();
    } else if (l.type === 'weapon') {
      const rc = RARITY_COLORS[l.rarity];
      ctx.shadowColor = rc;
      ctx.shadowBlur = 12;
      ctx.fillStyle = rc;
      ctx.fillRect(-6, -3, 12, 6);
      ctx.fillRect(-3, -6, 6, 12);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  // ── Enemies ──
  for (const e of state.enemies) {
    if (!e.alive) continue;
    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, e.height / 2, e.width / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle idle bob per-enemy
    const bob = Math.sin(time * 4 + (e.pos.x + e.pos.y) * 0.05) * 1.2;
    ctx.translate(0, bob);

    const baseColor = e.flashTimer > 0 ? '#fff' :
      e.statusEffects.some(s => s.type === 'freeze') ? '#74c0fc' :
      e.statusEffects.some(s => s.type === 'burn') ? '#ff7f50' :
      e.statusEffects.some(s => s.type === 'poison') ? '#98fb98' :
      enemyColor(e.type);

    drawEnemySprite(ctx, e, baseColor, time);

    // HP bar
    if (e.hp < e.maxHp) {
      const barW = Math.max(e.width, 30);
      ctx.fillStyle = '#333';
      ctx.fillRect(-barW / 2, -e.height / 2 - 12, barW, 4);
      ctx.fillStyle = e.type === 'boss' ? '#ff4444' : '#e74c3c';
      ctx.fillRect(-barW / 2, -e.height / 2 - 12, barW * (e.hp / e.maxHp), 4);
    }

    ctx.restore();
  }
  // ── Player ──
  if (p.alive) {
    ctx.save();
    ctx.translate(p.pos.x, p.pos.y);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, p.height / 2, p.width / 2 + 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (p.iFrames > 0 && Math.floor(p.iFrames * 20) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Dodge roll visual
    if (p.dodgeTimer > 0) {
      ctx.globalAlpha = 0.5;
      // Trail effect
      ctx.fillStyle = HERO_CONFIGS[p.heroClass].color + '44';
      ctx.beginPath();
      ctx.arc(-p.facing.x * 15, -p.facing.y * 15, p.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-p.facing.x * 30, -p.facing.y * 30, p.width / 2 - 4, 0, Math.PI * 2);
      ctx.fill();
    }

    const cfg = HERO_CONFIGS[p.heroClass];
    ctx.fillStyle = cfg.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(-3, -3, p.width / 4, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 1;
    const ex = p.facing.x * 3;
    const ey = p.facing.y * 3;
    ctx.fillRect(ex - 3, ey - 3, 3, 3);
    ctx.fillRect(ex + 1, ey - 3, 3, 3);

    ctx.globalAlpha = 1;

    // Attack arc
    if (p.attackAnimTimer > 0) {
      const wColor = p.weapon.effect ? EFFECT_COLORS[p.weapon.effect] : 'rgba(255,255,255,0.6)';
      ctx.strokeStyle = wColor;
      ctx.lineWidth = 2;
      const angle = Math.atan2(p.facing.y, p.facing.x);
      ctx.beginPath();
      ctx.arc(0, 0, p.weapon.range, angle - 0.6, angle + 0.6);
      ctx.stroke();
    }

    // Status effect indicators
    if (p.statusEffects.length > 0) {
      let ox = -p.statusEffects.length * 5;
      for (const se of p.statusEffects) {
        ctx.fillStyle = se.type === 'burn' ? '#e74c3c' : se.type === 'freeze' ? '#74c0fc' : '#51cf66';
        ctx.fillRect(ox, -p.height / 2 - 10, 4, 4);
        ox += 10;
      }
    }

    ctx.restore();
  }

  // ── Projectiles ──
  for (const proj of state.projectiles) {
    ctx.save();
    ctx.translate(proj.pos.x, proj.pos.y);
    ctx.fillStyle = proj.color || (proj.fromPlayer ? '#ccc' : '#e74c3c');
    ctx.beginPath(); ctx.arc(0, 0, proj.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = (proj.color || '#e74c3c') + '44';
    ctx.beginPath(); ctx.arc(0, 0, proj.radius * 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ── Particles ──
  for (const part of state.particles) {
    ctx.globalAlpha = part.lifetime / part.maxLifetime;
    ctx.fillStyle = part.color;
    ctx.fillRect(part.pos.x - part.size / 2, part.pos.y - part.size / 2, part.size, part.size);
  }
  ctx.globalAlpha = 1;

  // ── Damage Numbers ──
  for (const dn of state.damageNumbers) {
    ctx.globalAlpha = dn.lifetime / 0.8;
    ctx.font = dn.isCrit ? 'bold 18px Inter' : '14px Inter';
    ctx.fillStyle = dn.color;
    ctx.textAlign = 'center';
    ctx.fillText(dn.text || (dn.value === 0 ? 'LEVEL UP!' : dn.value.toString()), dn.pos.x, dn.pos.y);
  }
  ctx.globalAlpha = 1;

  // ── Ambient lighting overlay ──
  renderLighting(ctx, state, time);

  // ── Notification ──
  if (state.notification) {
    const n = state.notification;
    ctx.globalAlpha = Math.min(1, n.timer);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(ROOM_W / 2 - 150, 50, 300, 36);
    ctx.font = 'bold 16px Cinzel';
    ctx.fillStyle = n.color;
    ctx.textAlign = 'center';
    ctx.fillText(n.text, ROOM_W / 2, 74);
    ctx.globalAlpha = 1;
  }

  // ── Level Up Choice ──
  if (state.levelUpChoices) {
    renderLevelUpOverlay(ctx, state);
  }

  // ── Minimap ──
  renderMinimap(ctx, state);

  // ── Room type label ──
  if (room.type === 'shop') {
    ctx.font = 'bold 20px Cinzel';
    ctx.fillStyle = '#f1c40f';
    ctx.textAlign = 'center';
    ctx.fillText('SHOP', ROOM_W / 2, ROOM_H / 2 - 60);
    ctx.font = '12px Inter';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press E to browse', ROOM_W / 2, ROOM_H / 2 - 40);
  }

  // ── Dodge cooldown indicator ──
  if (p.alive && p.dodgeCooldownTimer > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, ROOM_H - 30, 60, 10);
    const pct = 1 - p.dodgeCooldownTimer / 0.8;
    ctx.fillStyle = '#74c0fc';
    ctx.fillRect(10, ROOM_H - 30, 60 * pct, 10);
    ctx.font = '8px Inter';
    ctx.fillStyle = '#ccc';
    ctx.textAlign = 'left';
    ctx.fillText('DODGE', 12, ROOM_H - 22);
  }

  // ── Game Over ──
  if (state.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);
    ctx.font = 'bold 36px Cinzel';
    ctx.fillStyle = '#e74c3c';
    ctx.textAlign = 'center';
    ctx.fillText('DEFEATED', ROOM_W / 2, ROOM_H / 2 - 40);
    ctx.font = '16px Inter';
    ctx.fillStyle = '#bdc3c7';
    ctx.fillText(`Tier ${state.dungeon.tier} · ${state.roomsCleared} rooms · ${p.killCount} kills · ${p.gold} gold`, ROOM_W / 2, ROOM_H / 2);
    ctx.fillText(`Level ${p.level} ${HERO_CONFIGS[p.heroClass].name}`, ROOM_W / 2, ROOM_H / 2 + 25);
    ctx.fillStyle = '#f1c40f';
    ctx.fillText('Click to restart', ROOM_W / 2, ROOM_H / 2 + 60);
  }

  ctx.restore();
}

function renderLighting(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  // Dark overlay with light cutouts around torches and player
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';

  // Base darkness depends on theme
  const darkness: Record<string, number> = { cave: 0.35, crypt: 0.45, fortress: 0.25, shadow: 0.55 };
  const dk = darkness[state.room.theme] || 0.3;

  ctx.fillStyle = `rgba(10,10,20,${dk})`;
  ctx.fillRect(0, 0, ROOM_W, ROOM_H);

  ctx.globalCompositeOperation = 'destination-out';

  // Player light
  const pGrad = ctx.createRadialGradient(state.player.pos.x, state.player.pos.y, 10, state.player.pos.x, state.player.pos.y, 120);
  pGrad.addColorStop(0, `rgba(0,0,0,${dk * 0.9})`);
  pGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = pGrad;
  ctx.fillRect(state.player.pos.x - 120, state.player.pos.y - 120, 240, 240);

  // Torch lights
  for (const torch of state.torches) {
    const flicker = 0.85 + Math.sin(time * 6 + torch.flickerOffset) * 0.15;
    const r = torch.radius * flicker;
    const tGrad = ctx.createRadialGradient(torch.pos.x, torch.pos.y, 5, torch.pos.x, torch.pos.y, r);
    tGrad.addColorStop(0, `rgba(0,0,0,${dk * 0.8})`);
    tGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tGrad;
    ctx.fillRect(torch.pos.x - r, torch.pos.y - r, r * 2, r * 2);
  }

  ctx.restore();
}

function renderLevelUpOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  if (!state.levelUpChoices) return;

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, ROOM_W, ROOM_H);

  ctx.font = 'bold 24px Cinzel';
  ctx.fillStyle = '#f1c40f';
  ctx.textAlign = 'center';
  ctx.fillText('LEVEL UP!', ROOM_W / 2, 180);

  ctx.font = '14px Inter';
  ctx.fillStyle = '#aaa';
  ctx.fillText('Press 1-4 to choose a stat upgrade', ROOM_W / 2, 210);

  const choices = state.levelUpChoices;
  const icons = ['❤️', '⚔️', '👟', '🔮'];
  const labels = ['Max HP +15', 'Attack +5', 'Speed +20', 'Max Mana +20'];
  const colors = ['#e74c3c', '#f39c12', '#2ecc71', '#74c0fc'];

  for (let i = 0; i < choices.length; i++) {
    const x = 120 + i * 150;
    const y = 250;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x, y, 130, 120);
    ctx.strokeStyle = colors[i];
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 130, 120);

    ctx.font = '28px serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(icons[i], x + 65, y + 45);

    ctx.font = 'bold 12px Inter';
    ctx.fillStyle = colors[i];
    ctx.fillText(choices[i].toUpperCase(), x + 65, y + 72);

    ctx.font = '11px Inter';
    ctx.fillStyle = '#ccc';
    ctx.fillText(labels[i], x + 65, y + 92);

    ctx.fillStyle = '#666';
    ctx.font = '10px Inter';
    ctx.fillText(`[${i + 1}]`, x + 65, y + 110);
  }
}

function renderMinimap(ctx: CanvasRenderingContext2D, state: GameState) {
  const mm = { x: ROOM_W - 140, y: 8, cellW: 18, cellH: 14 };
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(mm.x - 4, mm.y - 4, 138, 80);

  for (const room of state.dungeon.rooms) {
    const rx = mm.x + room.gridX * (mm.cellW + 3);
    const ry = mm.y + room.gridY * (mm.cellH + 3);

    // Adjacency to a visited room reveals existence (but not contents)
    const adjacentToVisited = !room.visited && state.dungeon.rooms.some(
      o => o.visited && Math.abs(o.gridX - room.gridX) + Math.abs(o.gridY - room.gridY) === 1,
    );
    if (!room.visited && !adjacentToVisited) continue;

    const isCurrent = room.id === state.dungeon.currentRoomId;

    if (room.visited) {
      const colors: Record<string, string> = {
        start: '#555', combat: room.cleared ? '#2d5a2d' : '#5a2d2d',
        treasure: '#5a5a2d', boss: '#5a1a1a', shop: '#2d4a5a',
      };
      ctx.fillStyle = colors[room.type] || '#444';
    } else {
      ctx.fillStyle = '#2a2a2a';
    }
    ctx.fillRect(rx, ry, mm.cellW, mm.cellH);

    if (isCurrent) {
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, mm.cellW, mm.cellH);
    }

    ctx.font = 'bold 9px Inter';
    ctx.fillStyle = '#ccc';
    ctx.textAlign = 'center';
    if (room.visited) {
      const labels: Record<string, string> = { boss: '☠', treasure: '♦', shop: '$', start: '•' };
      if (labels[room.type]) ctx.fillText(labels[room.type], rx + mm.cellW / 2, ry + mm.cellH / 2 + 3);
    } else {
      ctx.fillStyle = '#888';
      ctx.fillText('?', rx + mm.cellW / 2, ry + mm.cellH / 2 + 3);
    }

    if (room.visited) {
      for (const door of room.doors) {
        const target = state.dungeon.rooms[door.targetRoom];
        if (!target.visited) continue;
        ctx.strokeStyle = door.locked ? '#5a3a1a' : '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx + mm.cellW / 2, ry + mm.cellH / 2);
        const tx = mm.x + target.gridX * (mm.cellW + 3) + mm.cellW / 2;
        const ty = mm.y + target.gridY * (mm.cellH + 3) + mm.cellH / 2;
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}
