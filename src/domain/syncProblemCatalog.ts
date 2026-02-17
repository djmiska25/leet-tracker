import { db } from '@/storage/db';
import { fetchProblemCatalog } from '@/api/leetcode';
import { loadRatings } from './problemRatings';

const PROBLEM_CATALOG_URL = import.meta.env.VITE_PROBLEM_CATALOG_URL;

// Singleton promise for catalog loading
let catalogPromise: Promise<void> | null = null;

/**
 * Test helper to reset the singleton state.
 * Should only be used in tests to ensure test isolation.
 */
export function __resetCatalogPromiseForTests(): void {
  catalogPromise = null;
}

function isStale(epoch: number | undefined, maxAgeMinutes: number): boolean {
  if (!epoch) return true;
  const now = new Date().getTime();
  const lastUpdated = new Date(epoch).getTime();
  const diff = now - lastUpdated;
  const diffInMinutes = diff / (1000 * 60);
  return diffInMinutes > maxAgeMinutes;
}

/**
 * Sync the problem catalog from remote source.
 * Uses singleton pattern to prevent concurrent loads.
 * Can be called multiple times safely - will reuse in-progress load.
 *
 * Called by:
 * - initApp() on app startup (async, non-blocking)
 * - extensionSync when problem not found (on-demand, blocks until catalog ready)
 *
 * @returns Promise that resolves when catalog is synced/updated
 */
export async function syncProblemCatalog(): Promise<void> {
  // If already loading, return the existing promise (join the wait)
  if (catalogPromise) {
    console.log('[syncProblemCatalog] Catalog sync already in progress, waiting...');
    return catalogPromise;
  }

  // Start new sync and cache the promise
  catalogPromise = (async () => {
    try {
      console.log('[syncProblemCatalog] Checking problem catalog...');
      const lastUpdated = await db.getProblemListLastUpdated();

      if (isStale(lastUpdated, 24 * 60)) {
        // Ensure ratings are loaded before fetching catalog (they annotate problems)
        await loadRatings();
        console.log('[syncProblemCatalog] Fetching latest problem catalog...');
        const remoteProblems = await fetchProblemCatalog(PROBLEM_CATALOG_URL);
        const newProblems = remoteProblems.filter(
          (problem) => !lastUpdated || problem.createdAt * 1000 > lastUpdated,
        );

        await db.withTransaction(['problem-list', 'problem-metadata'], async (tx) => {
          for (const problem of newProblems) {
            await tx.objectStore('problem-list').put!(problem, problem.slug);
          }
          await tx.objectStore('problem-metadata').put!(Date.now(), 'lastUpdated');
          console.log(
            `[syncProblemCatalog] Catalog updated — ${newProblems.length} new problems added`,
          );
        });
      } else {
        console.log('[syncProblemCatalog] Catalog is fresh, no update needed');
      }
    } catch (err) {
      console.error('[syncProblemCatalog] Failed to fetch problem catalog:', err);
      console.error('[syncProblemCatalog] New problems are temporarily unavailable');
    } finally {
      // Clear the promise after completion (success or failure)
      catalogPromise = null;
    }
  })();

  return catalogPromise;
}
