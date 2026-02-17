import { Problem, Solve, UserRatings, UserRating, Category } from '../types/types';
import { createPlaceholderRating, initializeRating, updateRating } from './eloRating';
import { saveRatings } from '../storage/ratings';

/**
 * Historical Rating Estimation
 *
 * Initializes ratings from past solve history by treating each historical
 * solve as a "tie" (0.5 outcome) since we don't know the actual solve times.
 * This produces real Glicko-2 parameters (rating, RD, volatility) instead of
 * placeholder estimates.
 */

/**
 * Calculate mean of an array of numbers
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation of an array of numbers
 */
function standardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;

  const avg = mean(values);
  const squaredDiffs = values.map((val) => Math.pow(val - avg, 2));
  const variance = mean(squaredDiffs);
  return Math.sqrt(variance);
}

/**
 * Extract valid problem ratings from accepted solves
 */
function getAcceptedSolveRatings(solves: Solve[], problems: Map<string, Problem>): number[] {
  return solves
    .filter((solve) => {
      // Only count accepted solves with valid ratings
      if (solve.status !== 'Accepted') return false;

      const problem = problems.get(solve.slug);
      return problem && problem.rating && problem.rating > 0;
    })
    .map((solve) => {
      const problem = problems.get(solve.slug);
      return problem!.rating!;
    });
}

/**
 * Group solves by ALL their categories (not just primary)
 */
function groupSolvesByCategory(
  solves: Solve[],
  problems: Map<string, Problem>,
): Map<Category, Solve[]> {
  const categoryMap = new Map<Category, Solve[]>();

  for (const solve of solves) {
    if (solve.status !== 'Accepted') continue;

    const problem = problems.get(solve.slug);
    if (!problem || !problem.rating || problem.rating <= 0) continue;
    if (!problem.tags || problem.tags.length === 0) continue;

    // Add solve to ALL category tags (not just primary)
    for (const tag of problem.tags) {
      if (tag === 'Random') continue; // Skip 'Random' category

      if (!categoryMap.has(tag)) {
        categoryMap.set(tag, []);
      }
      categoryMap.get(tag)!.push(solve);
    }
  }

  return categoryMap;
}

/**
 * Estimate a single rating from a list of problem ratings
 */
function estimateRatingFromRatings(ratings: number[], solveCount: number): UserRating {
  if (ratings.length === 0) {
    return initializeRating();
  }

  const avg = mean(ratings);
  const stdDev = standardDeviation(ratings);

  // Conservative estimate: 0.5 SD below mean
  const estimatedRating = avg - 0.5 * stdDev;

  return createPlaceholderRating(estimatedRating, solveCount);
}

/**
 * Process a list of historical solves as ties to initialize rating
 *
 * Treats each solve as a 0.5 outcome (tie) since we don't know actual solve times.
 * This produces real Glicko-2 parameters through iterative updates.
 *
 * @param initialRating - Starting rating (from conservative estimate)
 * @param solves - Historical solves to process (should be sorted chronologically)
 * @param problems - Map of problem data
 * @returns Final rating after processing all solves
 */
function processHistoricalSolves(
  initialRating: number,
  solves: Solve[],
  problems: Map<string, Problem>,
): UserRating {
  // Initialize with default Glicko-2 parameters but set rating to estimate
  let rating = initializeRating();
  rating.rating = initialRating;

  // Sort solves chronologically by timestamp
  const sortedSolves = [...solves].sort((a, b) => a.timestamp - b.timestamp);

  // Process each solve as a tie (0.5 outcome)
  for (const solve of sortedSolves) {
    if (solve.status !== 'Accepted') continue;

    const problem = problems.get(solve.slug);
    if (!problem || !problem.rating || problem.rating <= 0) continue;

    // Update rating treating this solve as a tie (0.5)
    rating = updateRating(rating, problem.rating, 0.5);
  }

  return rating;
}

/**
 * Initialize user ratings from historical solve data
 *
 * Processes each historical solve as a tie (0.5 outcome) to produce real
 * Glicko-2 parameters instead of placeholder estimates. Saves results to storage.
 *
 * @param username - Username to initialize ratings for
 * @param solves - All user solves
 * @param problems - Map of problem slug to Problem data
 */
export async function initializeRatingsFromHistory(
  username: string,
  solves: Solve[],
  problems: Map<string, Problem>,
): Promise<void> {
  // Get all accepted solve ratings for global estimate
  const allRatings = getAcceptedSolveRatings(solves, problems);
  const acceptedSolves = solves.filter((s) => s.status === 'Accepted');

  // Calculate conservative initial estimate
  const initialEstimate =
    allRatings.length > 0 ? mean(allRatings) - 0.5 * standardDeviation(allRatings) : 1500;

  // Process all solves to get real global rating
  const globalRating = processHistoricalSolves(initialEstimate, acceptedSolves, problems);

  // Group by category for per-category ratings
  const categoryGroups = groupSolvesByCategory(solves, problems);
  const categoryRatings: Partial<Record<Category, UserRating>> = {};

  for (const [category, categorySolves] of categoryGroups.entries()) {
    const categoryRatingValues = categorySolves
      .map((solve) => {
        const problem = problems.get(solve.slug);
        return problem?.rating ?? 0;
      })
      .filter((r) => r > 0);

    if (categoryRatingValues.length >= 3) {
      // Enough data for category-specific estimate
      const categoryInitialEstimate =
        mean(categoryRatingValues) - 0.5 * standardDeviation(categoryRatingValues);
      categoryRatings[category] = processHistoricalSolves(
        categoryInitialEstimate,
        categorySolves,
        problems,
      );
    } else if (categoryRatingValues.length > 0) {
      // Some data but not enough - use global with jitter and process solves
      const jitter = (Math.random() - 0.5) * 100; // -50 to +50
      const categoryInitialEstimate = Math.max(800, Math.min(3000, initialEstimate + jitter));
      categoryRatings[category] = processHistoricalSolves(
        categoryInitialEstimate,
        categorySolves,
        problems,
      );
    }
    // If 0 solves in category, don't create an entry (will use global on-demand)
  }

  const ratings: UserRatings = {
    global: globalRating,
    categories: categoryRatings,
  };

  // Save to storage
  await saveRatings(username, ratings);
}

/**
 * Estimate user ratings from historical solve data (legacy)
 *
 * @deprecated Use initializeRatingsFromHistory instead which produces real ratings
 * @param solves - All user solves
 * @param problems - Map of problem slug to Problem data
 * @returns Estimated UserRatings with isEstimated flag set
 */
export function estimateRatingFromHistory(
  solves: Solve[],
  problems: Map<string, Problem>,
): UserRatings {
  // Get all accepted solve ratings for global estimate
  const allRatings = getAcceptedSolveRatings(solves, problems);

  // Estimate global rating
  const globalRating = estimateRatingFromRatings(allRatings, allRatings.length);

  // Group by category for per-category estimates
  const categoryGroups = groupSolvesByCategory(solves, problems);
  const categoryRatings: Partial<Record<Category, UserRating>> = {};

  for (const [category, categorySolves] of categoryGroups.entries()) {
    const categoryRatingValues = categorySolves
      .map((solve) => {
        const problem = problems.get(solve.slug);
        return problem?.rating ?? 0;
      })
      .filter((r) => r > 0);

    if (categoryRatingValues.length >= 3) {
      // Enough data for category-specific estimate
      categoryRatings[category] = estimateRatingFromRatings(
        categoryRatingValues,
        categoryRatingValues.length,
      );
    } else if (categoryRatingValues.length > 0) {
      // Some data but not enough - use global with high uncertainty and slight jitter
      const jitter = (Math.random() - 0.5) * 100; // -50 to +50
      const rating = Math.max(800, Math.min(3000, globalRating.rating + jitter));

      categoryRatings[category] = {
        ...globalRating,
        rating: Math.round(rating),
        rd: 250, // High uncertainty
        solveCount: categoryRatingValues.length,
      };
    }
    // If 0 solves in category, don't create an entry (will use global on-demand)
  }

  return {
    global: globalRating,
    categories: categoryRatings,
  };
}

/**
 * Get metadata about the estimation for UI display
 */
export interface EstimationMetadata {
  totalSolves: number;
  categoriesWithData: Category[];
  confidence: 'low' | 'moderate' | 'high';
}

export function getEstimationMetadata(ratings: UserRatings, solves: Solve[]): EstimationMetadata {
  const acceptedSolves = solves.filter((s) => s.status === 'Accepted').length;
  const categoriesWithData = Object.keys(ratings.categories) as Category[];

  let confidence: 'low' | 'moderate' | 'high';
  if (acceptedSolves < 10) {
    confidence = 'low';
  } else if (acceptedSolves < 30) {
    confidence = 'moderate';
  } else {
    confidence = 'high';
  }

  return {
    totalSolves: acceptedSolves,
    categoriesWithData,
    confidence,
  };
}
