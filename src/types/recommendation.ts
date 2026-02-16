import { Category, Difficulty } from './types';

export interface ProblemLite {
  slug: string;
  title: string;
  difficulty: Difficulty;
  rating?: number; // contest-based Elo rating
  popularity: number; // 0‑1 normalised
  isFundamental: boolean;
  /** Unix timestamp (seconds) of most recent accepted solve – present only for "refresh” bucket */
  lastSolved?: number;
  tags?: Category[];
}

export interface CategoryRecommendation {
  tag: Category;
  fundamentals: ProblemLite[];
  refresh: ProblemLite[];
  new: ProblemLite[];
}
