import { Difficulty } from '@/types/types';

const DIFFICULTY_MAP: Record<string, Difficulty> = {
  EASY: Difficulty.Easy,
  MEDIUM: Difficulty.Medium,
  HARD: Difficulty.Hard,
};

export function normalizeDifficulty(raw: unknown): Difficulty | undefined {
  if (typeof raw !== 'string') return undefined;
  const upper = raw.toUpperCase();
  return DIFFICULTY_MAP[upper];
}

export function formatDifficultyLabel(difficulty?: Difficulty): string {
  if (!difficulty) return 'Unknown';
  const lower = difficulty.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}
