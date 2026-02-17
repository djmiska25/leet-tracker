import { Solve } from '../types/types';
import { getRatings, saveRatings, initializeRatings } from '../storage/ratings';
import {
  updateRating,
  calculatePartialCredit,
  determineTimeLimit,
  initializeRating,
  RATINGS_UPDATED_EVENT,
} from './eloRating';

/**
 * Rating Sync Integration
 *
 * Updates user ratings based on new solve data.
 * Called after solves are written to the database during sync.
 */

/**
 * Update user ratings based on a new solve
 *
 * This function:
 * 1. Loads current ratings (or initializes if none exist)
 * 2. Determines solve outcome using partial credit
 * 3. Updates global rating
 * 4. Updates category rating if problem has a primary tag
 * 5. Saves updated ratings
 * 6. Emits RATINGS_UPDATED_EVENT
 *
 * @param username - User whose ratings to update
 * @param solve - New solve to process
 */
export async function updateRatingsFromSolve(username: string, solve: Solve): Promise<void> {
  // Skip if solve doesn't have a rating (can't update without difficulty info)
  if (!solve.rating || solve.rating <= 0) {
    console.log(`[updateRatingsFromSolve] Skipping solve without rating: ${solve.slug}`);
    return;
  }

  // Load current ratings (or initialize default)
  let ratings = await getRatings(username);
  if (!ratings) {
    console.log('[updateRatingsFromSolve] No ratings found, initializing...');
    ratings = await initializeRatings(username);
  }

  // Determine outcome score
  let outcomeScore: number;

  if (solve.timeUsed && solve.timeUsed > 0) {
    // Has timing data - use partial credit
    const timeLimit = determineTimeLimit(solve.rating);
    const completed = solve.status === 'Accepted';
    outcomeScore = calculatePartialCredit(solve.timeUsed, timeLimit, completed);
  } else {
    // No timing data - binary outcome based on status
    outcomeScore = solve.status === 'Accepted' ? 1.0 : 0.1;
  }

  // Update global rating
  ratings.global = updateRating(ratings.global, solve.rating, outcomeScore);

  // Update category ratings for ALL tags (not just primary)
  if (solve.tags && solve.tags.length > 0) {
    for (const tag of solve.tags) {
      // Skip 'Random' category
      if (tag === 'Random') continue;

      // Get or initialize category rating
      let categoryRating = ratings.categories[tag];

      if (!categoryRating) {
        // Initialize category rating based on global rating
        categoryRating = {
          ...initializeRating(),
          rating: ratings.global.rating,
          rd: Math.max(200, ratings.global.rd), // Slightly higher uncertainty
        };
        console.log(
          `[updateRatingsFromSolve] Creating new category rating for ${tag} ` +
            `based on global: ${categoryRating.rating}±${categoryRating.rd}`,
        );
      }

      // Update category rating
      ratings.categories[tag] = updateRating(categoryRating, solve.rating, outcomeScore);
      console.log(
        `[updateRatingsFromSolve] Updated category rating for ${tag}: ` +
          `${ratings.categories[tag].rating}±${ratings.categories[tag].rd}`,
      );
    }
  } else {
    console.warn(
      `[updateRatingsFromSolve] Solve ${solve.slug} has no tags, skipping category rating update`,
    );
  }

  // Save updated ratings
  await saveRatings(username, ratings);

  // Emit event for UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RATINGS_UPDATED_EVENT));
  }

  console.log(
    `[updateRatingsFromSolve] Updated ratings for ${username}: ` +
      `global=${ratings.global.rating}±${ratings.global.rd}, ` +
      `categories=${Object.keys(ratings.categories).length} (${Object.keys(ratings.categories).join(', ')}), ` +
      `outcome=${outcomeScore.toFixed(2)}`,
  );
}

/**
 * Batch update ratings for multiple solves
 * More efficient than calling updateRatingsFromSolve repeatedly
 *
 * @param username - User whose ratings to update
 * @param solves - Array of new solves to process
 */
export async function updateRatingsFromSolves(username: string, solves: Solve[]): Promise<void> {
  if (solves.length === 0) return;

  // Load current ratings (or initialize default)
  let ratings = await getRatings(username);
  if (!ratings) {
    console.log('[updateRatingsFromSolves] No ratings found, initializing...');
    ratings = await initializeRatings(username);
  }

  let updatedCount = 0;

  for (const solve of solves) {
    // Skip solves without ratings
    if (!solve.rating || solve.rating <= 0) continue;

    // Determine outcome score
    let outcomeScore: number;

    if (solve.timeUsed && solve.timeUsed > 0) {
      const timeLimit = determineTimeLimit(solve.rating);
      const completed = solve.status === 'Accepted';
      outcomeScore = calculatePartialCredit(solve.timeUsed, timeLimit, completed);
    } else {
      outcomeScore = solve.status === 'Accepted' ? 1.0 : 0.1;
    }

    // Update global rating
    ratings.global = updateRating(ratings.global, solve.rating, outcomeScore);

    // Update category ratings for ALL tags (not just primary)
    if (solve.tags && solve.tags.length > 0) {
      for (const tag of solve.tags) {
        // Skip 'Random' category
        if (tag === 'Random') continue;

        let categoryRating = ratings.categories[tag];

        if (!categoryRating) {
          categoryRating = {
            ...initializeRating(),
            rating: ratings.global.rating,
            rd: Math.max(200, ratings.global.rd),
          };
          console.log(
            `[updateRatingsFromSolves] Creating new category rating for ${tag} ` +
              `based on global: ${categoryRating.rating}±${categoryRating.rd}`,
          );
        }

        ratings.categories[tag] = updateRating(categoryRating, solve.rating, outcomeScore);
      }
    }

    updatedCount++;
  }

  if (updatedCount > 0) {
    // Save updated ratings
    await saveRatings(username, ratings);

    // Emit event for UI updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(RATINGS_UPDATED_EVENT));
    }

    console.log(
      `[updateRatingsFromSolves] Updated ratings for ${username} with ${updatedCount} solves: ` +
        `global=${ratings.global.rating}±${ratings.global.rd}, ` +
        `categories=${Object.keys(ratings.categories).length} (${Object.keys(ratings.categories).join(', ')})`,
    );
  }
}
