/**
 * Problem rating lookup using contest-based Elo ratings from zerotrac/leetcode_problem_rating.
 *
 * Ratings are more precise than Easy/Medium/Hard and are sourced from
 * weekly/biweekly contest data.  Problems that never appeared in a contest
 * receive an estimated rating based on their official difficulty label.
 */

import { Difficulty } from '../types/types';

/** Estimated ratings when no contest data is available. */
export const ESTIMATED_RATINGS: Record<Difficulty, number> = {
  [Difficulty.Easy]: 1300,
  [Difficulty.Medium]: 1600,
  [Difficulty.Hard]: 2100,
};

let ratingsMap: Record<string, number> | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * Load the ratings JSON from the public directory.
 * Uses a singleton promise so concurrent callers share the same fetch.
 */
export async function loadRatings(): Promise<void> {
  if (ratingsMap) return;
  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = (async () => {
    try {
      const res = await fetch('/problem-ratings.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ratingsMap = (await res.json()) as Record<string, number>;
    } catch (err) {
      console.warn('[problemRatings] Failed to load ratings, falling back to estimates:', err);
      ratingsMap = {};
    } finally {
      loadPromise = null;
    }
  })();

  await loadPromise;
}

/**
 * Look up the contest rating for a problem by slug.
 * Returns `undefined` if no rating data exists for the problem.
 *
 * Must call `loadRatings()` before first use.
 */
export function getRating(slug: string): number | undefined {
  return ratingsMap?.[slug];
}

/**
 * Get the contest rating or a difficulty-based estimate.
 */
export function getRatingOrEstimate(slug: string, difficulty: Difficulty): number {
  return getRating(slug) ?? ESTIMATED_RATINGS[difficulty];
}

/**
 * Return the difficulty color bucket for a given rating.
 * Preserves the green/yellow/red color scheme:
 *   Easy  (green):  rating < 1400
 *   Medium (amber):  1400 ≤ rating < 1900
 *   Hard  (red):     rating ≥ 1900
 */
export function ratingToColor(rating: number): 'easy' | 'medium' | 'hard' {
  if (rating < 1400) return 'easy';
  if (rating < 1900) return 'medium';
  return 'hard';
}

/**
 * Format a rating for display.
 * If a contest rating exists, shows the number. Otherwise shows the difficulty label.
 */
export function formatRating(slug: string, difficulty: Difficulty): string {
  const exact = getRating(slug);
  if (exact !== undefined) return String(exact);
  // Capitalize first letter of difficulty
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

/** Test helper: clear cached ratings for test isolation. */
export function __resetRatingsForTests(): void {
  ratingsMap = null;
  loadPromise = null;
}

/** Test helper: inject ratings without fetching. */
export function __setRatingsForTests(ratings: Record<string, number>): void {
  ratingsMap = ratings;
}
