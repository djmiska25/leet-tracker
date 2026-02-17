import { SolveSession, Problem } from '../types/types';
import { determineTimeLimit } from '../domain/eloRating';

/**
 * Storage layer for active solve sessions
 */

// Import db promise getter
async function getDb() {
  const { openDB } = await import('idb');
  return openDB('leet-tracker-db', 6);
}

/**
 * Start a new solve session
 */
export async function startSolveSession(username: string, problem: Problem): Promise<SolveSession> {
  const timeLimit = determineTimeLimit(problem.rating || 1500);

  const session: SolveSession = {
    problem,
    timeLimit,
    startedAt: Date.now(),
    username,
    isActive: true,
  };

  const key = `${username}|session`;
  const idb = await getDb();
  await idb.put('active-solve-session', session, key);

  return session;
}

/**
 * Get the active solve session for a user
 * Returns null if no active session
 */
export async function getActiveSolveSession(username: string): Promise<SolveSession | null> {
  const key = `${username}|session`;
  const idb = await getDb();
  const session = await idb.get('active-solve-session', key);
  return session ?? null;
}

/**
 * End the active solve session
 */
export async function endSolveSession(username: string): Promise<void> {
  const key = `${username}|session`;
  const idb = await getDb();
  await idb.delete('active-solve-session', key);
}

/**
 * Update session to mark as inactive (for aborted sessions)
 */
export async function markSessionInactive(username: string): Promise<void> {
  const session = await getActiveSolveSession(username);
  if (session) {
    session.isActive = false;
    const key = `${username}|session`;
    const idb = await getDb();
    await idb.put('active-solve-session', session, key);
  }
}

/**
 * Check if there's an active solve session
 */
export async function hasActiveSolveSession(username: string): Promise<boolean> {
  const session = await getActiveSolveSession(username);
  return session !== null && session.isActive;
}

/**
 * Event dispatched when a solve session is started
 */
export const SOLVE_SESSION_STARTED_EVENT = 'solve-session-started';

/**
 * Event dispatched when a solve session ends
 */
export const SOLVE_SESSION_ENDED_EVENT = 'solve-session-ended';
