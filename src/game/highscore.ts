import { HeroClass } from './types';

const KEY = 'dr_highscore_v1';

export interface HighScoreEntry {
  heroClass: HeroClass;
  level: number;
  tier: number;
  roomsCleared: number;
  kills: number;
  gold: number;
  timeSec: number;
  score: number;
  date: number;
}

export interface HighScoreData {
  best: HighScoreEntry | null;
  recent: HighScoreEntry[];
}

function load(): HighScoreData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { best: null, recent: [] };
    const data = JSON.parse(raw) as HighScoreData;
    return { best: data.best ?? null, recent: data.recent ?? [] };
  } catch {
    return { best: null, recent: [] };
  }
}

function save(data: HighScoreData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore quota / privacy errors
  }
}

export function computeScore(e: Omit<HighScoreEntry, 'score' | 'date'>): number {
  return (
    e.kills * 10 +
    e.roomsCleared * 50 +
    e.tier * 200 +
    e.level * 30 +
    Math.floor(e.gold / 2)
  );
}

/** Records a finished run and returns the previous best (if any) and whether it's a new record. */
export function recordRun(
  partial: Omit<HighScoreEntry, 'score' | 'date'>,
): { entry: HighScoreEntry; isNewBest: boolean; previousBest: HighScoreEntry | null } {
  const data = load();
  const score = computeScore(partial);
  const entry: HighScoreEntry = { ...partial, score, date: Date.now() };

  const previousBest = data.best;
  const isNewBest = !previousBest || score > previousBest.score;
  if (isNewBest) data.best = entry;

  data.recent.unshift(entry);
  if (data.recent.length > 5) data.recent.length = 5;

  save(data);
  return { entry, isNewBest, previousBest };
}

export function getHighScore(): HighScoreData {
  return load();
}
