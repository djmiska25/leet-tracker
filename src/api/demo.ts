import { Solve, Problem } from '@/types/types';

/**
 * Adjusts demo solve timestamps to fit within the previous two-week period.
 * Timestamps are consistent per week - they only change when a new week begins.
 */
export async function loadDemoSolves(): Promise<Solve[]> {
  const res = await fetch('/demo-solves.json');
  if (!res.ok) {
    throw new Error(`Failed to load demo solves (HTTP ${res.status})`);
  }

  const solves = (await res.json()) as Solve[];

  // Get the most recent Saturday at midnight (end date) - this stays the same for the entire week
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const endDate = new Date(now);
  endDate.setDate(now.getDate() - dayOfWeek - 1); // Last Saturday
  endDate.setHours(0, 0, 0, 0); // Set to midnight for consistency

  // Start date is two weeks before the end date
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 13); // Two weeks before

  // Scale the timestamps to fit within the new range
  const originalStart = Math.min(...solves.map((s) => s.timestamp));
  const originalEnd = Math.max(...solves.map((s) => s.timestamp));
  const originalRange = Math.max(1, originalEnd - originalStart); // Avoid division by zero

  const newStart = Math.floor(startDate.getTime() / 1000);
  const newEnd = Math.floor(endDate.getTime() / 1000);
  const newRange = newEnd - newStart;

  const scaledSolves = solves.map((solve) => {
    const scaledTimestamp =
      newStart + ((solve.timestamp - originalStart) / originalRange) * newRange;

    // Scale timeline data timestamps the same way
    let scaledCodingJourney = solve.codingJourney;
    if (
      solve.codingJourney &&
      'snapshots' in solve.codingJourney &&
      solve.codingJourney.snapshots
    ) {
      const scaledSnapshots = solve.codingJourney.snapshots.map((snapshot) => ({
        ...snapshot,
        timestamp: snapshot.timestamp
          ? Math.floor(
              newStart + ((snapshot.timestamp / 1000 - originalStart) / originalRange) * newRange,
            ) * 1000
          : snapshot.timestamp,
      }));

      scaledCodingJourney = {
        ...solve.codingJourney,
        snapshots: scaledSnapshots,
        firstSnapshot: scaledSnapshots[0]?.timestamp || solve.codingJourney.firstSnapshot,
        lastSnapshot:
          scaledSnapshots[scaledSnapshots.length - 1]?.timestamp ||
          solve.codingJourney.lastSnapshot,
      };
    }

    // Scale run event timestamps
    let scaledRunEvents = solve.runEvents;
    if (solve.runEvents && solve.runEvents.runs) {
      const scaledRuns = solve.runEvents.runs.map((run) => ({
        ...run,
        startedAt: run.startedAt
          ? Math.floor(
              newStart + ((run.startedAt / 1000 - originalStart) / originalRange) * newRange,
            ) * 1000
          : run.startedAt,
      }));

      scaledRunEvents = {
        ...solve.runEvents,
        runs: scaledRuns,
        firstRun: scaledRuns[0]?.startedAt || solve.runEvents.firstRun,
        lastRun: scaledRuns[scaledRuns.length - 1]?.startedAt || solve.runEvents.lastRun,
        _window: solve.runEvents._window
          ? {
              startMs: Math.floor(scaledTimestamp * 1000 - (solve.timeUsed || 300) * 1000),
              endMs: Math.floor(scaledTimestamp * 1000),
            }
          : solve.runEvents._window,
      };
    }

    return {
      ...solve,
      timestamp: Math.floor(scaledTimestamp),
      codingJourney: scaledCodingJourney,
      runEvents: scaledRunEvents,
    };
  });

  return scaledSolves;
}

/**
 * Loads demo solves, enriches them with problem metadata (tags, difficulty),
 * and saves them to the database. Uses an all-or-nothing approach:
 * - If no existing solves, load all demo data
 * - If existing data is older than 30 days, delete all and reload fresh data
 * - Otherwise, skip (demo data is already up to date)
 *
 * @param db - Database instance with methods for checking and saving solves
 * @returns Promise resolving to the number of demo solves saved
 */
export async function syncDemoSolves(db: {
  getAllSolves: () => Promise<Solve[]>;
  getProblem: (_slug: string) => Promise<Problem | undefined>;
  saveSolve: (_solve: Solve) => Promise<string>;
  clearSolves: () => Promise<void>;
}): Promise<number> {
  console.log('[syncDemoSolves] Checking existing demo data...');

  // Check if we need to refresh demo data
  const existingSolves = await db.getAllSolves();

  if (existingSolves.length > 0) {
    // Find the most recent solve
    const mostRecentTimestamp = Math.max(...existingSolves.map((s) => s.timestamp));
    const mostRecentDate = new Date(mostRecentTimestamp * 1000); // Convert seconds to milliseconds
    const now = new Date();
    const daysSinceLastSolve = (now.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceLastSolve < 30) {
      console.log(
        '[syncDemoSolves] Demo data is fresh (most recent solve is less than 30 days old), skipping refresh',
      );
      return 0;
    }

    // Data is stale, delete all existing solves
    console.log(
      '[syncDemoSolves] Demo data is stale (>30 days old), deleting all existing solves...',
    );
    await db.clearSolves();
  }

  // Load and process fresh demo data
  console.log('[syncDemoSolves] Loading fresh demo solves...');
  const demoSolves = await loadDemoSolves();
  let savedCount = 0;
  const enrichedSolves: Solve[] = []; // Track for rating updates

  // Enrich and save demo solves to database
  for (const solve of demoSolves) {
    // Fetch problem metadata to enrich tags & difficulty (same as extensionSync)
    const problem = await db.getProblem(solve.slug);

    if (!problem) {
      console.warn(
        `[syncDemoSolves] Problem ${solve.slug} not found in local DB for demo solve, skipping`,
      );
      continue;
    }

    // Enrich solve with problem metadata
    const enrichedSolve = {
      ...solve,
      tags: problem.tags,
      difficulty: problem.difficulty,
      rating: problem.rating,
    };

    await db.saveSolve(enrichedSolve);
    enrichedSolves.push(enrichedSolve);
    savedCount++;
  }

  // Update ratings for demo user if we added new solves
  if (enrichedSolves.length > 0) {
    try {
      const DEMO_USERNAME = import.meta.env.VITE_DEMO_USERNAME;
      const { updateRatingsFromSolves } = await import('../domain/ratingSyncIntegration');
      await updateRatingsFromSolves(DEMO_USERNAME, enrichedSolves);
    } catch (error) {
      console.error('[syncDemoSolves] Failed to update ratings:', error);
      // Don't throw - rating updates are non-critical
    }
  }

  console.log(`[syncDemoSolves] Demo solves processed: ${savedCount} new solves saved`);
  return savedCount;
}
