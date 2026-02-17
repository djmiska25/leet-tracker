import {
  Problem,
  Category,
  TimedSolveAttempt,
  CalibrationState,
  UserRating,
  UserRatings,
} from '../types/types';
import {
  initializeRating,
  updateRating,
  calculatePartialCredit,
  determineTimeLimit,
} from './eloRating';

/**
 * Calibration Logic
 *
 * Handles the interactive calibration flow where users solve timed problems
 * to establish accurate initial ratings.
 */

/**
 * Target ratings for calibration problem selection
 * Spread across difficulty range to maximize information gain
 */
const CALIBRATION_TARGET_RATINGS = [1200, 1400, 1600, 1800, 2000, 2200];

/**
 * Minimum number of problems per category for category-specific rating
 */
const MIN_CATEGORY_ATTEMPTS = 2;

/**
 * Select diverse problems for calibration
 *
 * Goals:
 * - Cover wide difficulty range (1200-2200)
 * - Include multiple categories
 * - Prefer popular, non-paid problems
 * - Avoid problems user has already solved
 *
 * @param allProblems - All available problems
 * @param count - Number of problems to select (typically 8)
 * @param solvedSlugs - Set of problem slugs user has already solved
 * @returns Array of selected problems
 */
export function selectCalibrationProblems(
  allProblems: Problem[],
  count: number = 8,
  solvedSlugs: Set<string> = new Set(),
): Problem[] {
  // Filter to unsolved, non-paid problems with ratings
  const candidates = allProblems.filter(
    (p) =>
      !solvedSlugs.has(p.slug) && !p.isPaid && p.rating && p.rating >= 1100 && p.rating <= 2300,
  );

  if (candidates.length === 0) {
    return [];
  }

  const selected: Problem[] = [];
  const usedCategories = new Set<Category>();

  // Try to select one problem near each target rating
  for (const targetRating of CALIBRATION_TARGET_RATINGS) {
    if (selected.length >= count) break;

    // Find problems within ±100 of target rating
    const nearbyProblems = candidates.filter((p) => {
      if (!p.rating) return false;
      const diff = Math.abs(p.rating - targetRating);
      return diff <= 100;
    });

    if (nearbyProblems.length === 0) continue;

    // Prefer problems from unused categories for diversity
    const preferredProblems = nearbyProblems.filter((p) => {
      const primaryTag = p.tags[0];
      return primaryTag && !usedCategories.has(primaryTag);
    });

    const pool = preferredProblems.length > 0 ? preferredProblems : nearbyProblems;

    // Sort by popularity (descending) and take top one
    pool.sort((a, b) => b.popularity - a.popularity);
    const chosen = pool[0];

    selected.push(chosen);

    // Track category usage
    if (chosen.tags[0]) {
      usedCategories.add(chosen.tags[0]);
    }
  }

  // If we need more problems, add popular ones from remaining candidates
  if (selected.length < count) {
    const selectedSlugs = new Set(selected.map((p) => p.slug));
    const remaining = candidates
      .filter((p) => !selectedSlugs.has(p.slug))
      .sort((a, b) => b.popularity - a.popularity);

    for (const problem of remaining) {
      if (selected.length >= count) break;
      selected.push(problem);
    }
  }

  // Shuffle to avoid predictable difficulty progression
  return shuffleArray(selected);
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Initialize a new calibration session
 */
export function initializeCalibration(username: string): CalibrationState {
  return {
    username,
    startedAt: Date.now(),
    attempts: [],
    currentRating: initializeRating(),
    isComplete: false,
  };
}

/**
 * Process a single calibration attempt and update temporary rating
 *
 * @param state - Current calibration state
 * @param attempt - New attempt to process
 * @returns Updated calibration state
 */
export function processCalibrationAttempt(
  state: CalibrationState,
  attempt: TimedSolveAttempt,
): CalibrationState {
  const { currentRating } = state;

  // Calculate outcome score using partial credit
  const outcomeScore = calculatePartialCredit(
    attempt.timeUsed,
    attempt.timeLimit,
    attempt.completed,
  );

  // Update rating
  const newRating = updateRating(currentRating, attempt.problemRating, outcomeScore);

  return {
    ...state,
    attempts: [...state.attempts, attempt],
    currentRating: newRating,
  };
}

/**
 * Finalize calibration and compute final ratings (global + per-category)
 *
 * Strategy:
 * - Global rating comes from all attempts
 * - Category ratings computed from category-specific attempts
 * - Categories with < MIN_CATEGORY_ATTEMPTS inherit global with jitter
 *
 * @param state - Completed calibration state
 * @returns Final UserRatings
 */
export function finalizeCalibration(state: CalibrationState): UserRatings {
  if (state.attempts.length === 0) {
    return {
      global: initializeRating(),
      categories: {},
    };
  }

  // Global rating comes from current rating (updated through all attempts)
  const globalRating: UserRating = {
    ...state.currentRating,
    solveCount: state.attempts.length,
  };

  // Group attempts by category
  const categoryAttempts = new Map<Category, TimedSolveAttempt[]>();
  for (const attempt of state.attempts) {
    const category = attempt.category;
    if (category === 'Random') continue;

    if (!categoryAttempts.has(category)) {
      categoryAttempts.set(category, []);
    }
    categoryAttempts.get(category)!.push(attempt);
  }

  // Compute per-category ratings
  const categoryRatings: Partial<Record<Category, UserRating>> = {};

  for (const [category, attempts] of categoryAttempts.entries()) {
    if (attempts.length >= MIN_CATEGORY_ATTEMPTS) {
      // Enough data - compute category-specific rating
      let categoryRating = initializeRating();

      for (const attempt of attempts) {
        const outcomeScore = calculatePartialCredit(
          attempt.timeUsed,
          attempt.timeLimit,
          attempt.completed,
        );

        categoryRating = updateRating(categoryRating, attempt.problemRating, outcomeScore);
      }

      categoryRatings[category] = {
        ...categoryRating,
        solveCount: attempts.length,
      };
    } else if (attempts.length > 0) {
      // Some data but not enough - inherit from global with jitter
      const jitter = (Math.random() - 0.5) * 100; // -50 to +50
      const rating = Math.max(800, Math.min(3000, globalRating.rating + jitter));

      categoryRatings[category] = {
        ...globalRating,
        rating: Math.round(rating),
        rd: Math.max(200, globalRating.rd + 50), // Higher uncertainty
        solveCount: attempts.length,
      };
    }
  }

  return {
    global: globalRating,
    categories: categoryRatings,
  };
}

/**
 * Create a timed solve attempt object
 */
export function createTimedAttempt(
  problem: Problem,
  timeUsed: number,
  completed: boolean,
): TimedSolveAttempt {
  const primaryCategory = problem.tags[0] || 'Array';
  const problemRating = problem.rating || 1500;
  const timeLimit = determineTimeLimit(problemRating);

  return {
    slug: problem.slug,
    title: problem.title,
    problemRating,
    category: primaryCategory,
    timeLimit,
    timeUsed,
    completed,
    timestamp: Date.now(),
  };
}
