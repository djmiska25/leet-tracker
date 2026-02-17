import { UserRatings, CalibrationState } from '../types/types';
import { initializeRating } from '../domain/eloRating';

/**
 * Storage layer for user ratings and calibration state
 */

// Import db promise getter
async function getDb() {
  const { openDB } = await import('idb');
  return openDB('leet-tracker-db', 6);
}

/**
 * Get user ratings from storage
 * Returns null if no ratings exist for this user
 */
export async function getRatings(username: string): Promise<UserRatings | null> {
  const key = `${username}|ratings`;
  const idb = await getDb();
  const ratings = await idb.get('user-ratings', key);
  return ratings ?? null;
}

/**
 * Save user ratings to storage
 */
export async function saveRatings(username: string, ratings: UserRatings): Promise<void> {
  const key = `${username}|ratings`;
  const idb = await getDb();
  await idb.put('user-ratings', ratings, key);
}

/**
 * Initialize default ratings for a new user
 * Creates both global and empty per-category ratings
 */
export async function initializeRatings(username: string): Promise<UserRatings> {
  const ratings: UserRatings = {
    global: initializeRating(),
    categories: {},
  };

  await saveRatings(username, ratings);
  return ratings;
}

/**
 * Get calibration state for a user
 * Returns null if no calibration is in progress
 */
export async function getCalibrationState(username: string): Promise<CalibrationState | null> {
  const key = `${username}|calibration`;
  const idb = await getDb();
  const state = await idb.get('calibration-state', key);
  return state ?? null;
}

/**
 * Save calibration state
 */
export async function saveCalibrationState(
  username: string,
  state: CalibrationState,
): Promise<void> {
  const key = `${username}|calibration`;
  const idb = await getDb();
  await idb.put('calibration-state', state, key);
}

/**
 * Clear calibration state (called after calibration completes)
 */
export async function clearCalibrationState(username: string): Promise<void> {
  const key = `${username}|calibration`;
  const idb = await getDb();
  await idb.delete('calibration-state', key);
}

/**
 * Check if user has any ratings
 */
export async function hasRatings(username: string): Promise<boolean> {
  const ratings = await getRatings(username);
  return ratings !== null;
}
