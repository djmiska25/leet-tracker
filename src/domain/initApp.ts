import { db } from '../storage/db';
import { identifyUser } from '@/utils/analytics';
import { syncSolveData } from './syncSolveData';
import { syncProblemCatalog } from './syncProblemCatalog';
import { loadRatings } from './problemRatings';
import { hasRatings } from '../storage/ratings';
import { initializeRatingsFromHistory } from './historicalRatingEstimation';

/**
 * Initialize the app on startup.
 *
 * Responsibilities:
 * - Start async catalog sync in background (non-blocking)
 * - Sync solve data from extension/demo (BLOCKING, but gracefully handles missing extension)
 * - Identify user for analytics
 *
 * Does NOT compute progress - that's the Dashboard's responsibility.
 * Does NOT manage catalog logic - that's in syncProblemCatalog.
 *
 * @returns Username and any errors encountered
 */
export async function initApp(): Promise<{
  username: string | undefined;
  errors: string[];
}> {
  const errors: string[] = [];
  const username = await db.getUsername();

  if (!username) {
    console.log('[initApp] No username — app not initialized');
    return { username: undefined, errors: [] };
  }

  console.log(`[initApp] Username found: ${username}`);

  // Load problem ratings data (needed before catalog sync annotates problems)
  await loadRatings();

  // Start catalog sync in background (non-blocking, async)
  syncProblemCatalog().catch((err) => {
    console.error('[initApp] Background catalog sync failed:', err);
  });

  // BLOCKING: Get latest solve data from extension/demo
  try {
    const addedCount = await syncSolveData(username);
    if (addedCount > 0) {
      console.log(`[initApp] Synced ${addedCount} new solves`);
    }
  } catch (err: any) {
    if (err?.code === 'EXTENSION_UNAVAILABLE') {
      // Extension not available - not a critical error, user may be in onboarding
      // or may have uninstalled extension. App will still load.
      console.log('[initApp] Extension not available - skipping solve data sync');
    } else {
      console.warn('[initApp] Failed to sync solve data', err);
      errors.push('An unexpected error occurred while loading solve data.');
    }
  }

  // Initialize ratings if needed (estimate from history for existing users)
  try {
    const userHasRatings = await hasRatings(username);

    if (!userHasRatings) {
      console.log('[initApp] No ratings found, checking solve history...');

      // Get all solves to check if we should estimate ratings
      const allSolves = await db.getAllSolves();
      const acceptedSolves = allSolves.filter((s) => s.status === 'Accepted');

      if (acceptedSolves.length >= 5) {
        console.log(
          `[initApp] Found ${acceptedSolves.length} accepted solves, initializing ratings from history...`,
        );

        // Get all problems for initialization
        const allProblems = await db.getAllProblems();
        const problemMap = new Map(allProblems.map((p) => [p.slug, p]));

        // Initialize ratings from history (processes each solve as tie, saves internally)
        await initializeRatingsFromHistory(username, allSolves, problemMap);

        console.log('[initApp] Ratings initialized from historical solves');
      } else {
        console.log('[initApp] Not enough solves for rating estimation, will need calibration');
      }
    }
  } catch (err) {
    console.error('[initApp] Failed to initialize ratings:', err);
    // Non-critical error, don't add to errors array
  }

  // Identify user for analytics (no profileId needed)
  await identifyUser(username, {
    lastSync: Date.now(),
  });

  return { username, errors };
}
