import { Difficulty } from '@/types/types';
import { trackUnknownDifficulty } from './analytics';

const DIFFICULTY_MAP: Record<string, Difficulty> = {
  EASY: Difficulty.Easy,
  MEDIUM: Difficulty.Medium,
  HARD: Difficulty.Hard,
};

export function normalizeDifficulty(raw: unknown): Difficulty {
  if (typeof raw !== 'string') {
    console.warn('[normalizeDifficulty] Unknown difficulty value:', raw);
    trackUnknownDifficulty(String(raw));
    return Difficulty.Easy;
  }
  const upper = raw.toUpperCase();
  const mapped = DIFFICULTY_MAP[upper];
  if (!mapped) {
    console.warn('[normalizeDifficulty] Unknown difficulty value:', raw);
    trackUnknownDifficulty(raw);
    return Difficulty.Easy;
  }
  return mapped;
}

export function formatDifficultyLabel(difficulty?: Difficulty): string {
  if (!difficulty) return 'Unknown';
  const lower = difficulty.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}
