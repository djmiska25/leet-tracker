import { openDB, DBSchema, IDBPTransaction } from 'idb';
import {
  Problem,
  Solve,
  GoalProfile,
  UserRatings,
  CalibrationState,
  SolveSession,
} from '../types/types';

export interface LeetTrackerDB extends DBSchema {
  'leetcode-username': {
    key: 'username';
    value: string;
  };
  'problem-list': {
    key: string; // problem.slug
    value: Problem;
  };
  'problem-metadata': {
    key: 'lastUpdated';
    value: number; // Epoch timestamp (ms)
  };
  solves: {
    key: string; // ${username}|${slug}|${timestamp}
    value: Solve;
  };
  'solves-metadata': {
    key: string; // ${username}|recentSolvesLastUpdated
    value: number; // Epoch timestamp (ms)
  };
  'goal-profiles': {
    key: string; // ${username}|${profileId}
    value: GoalProfile;
  };
  'active-goal-profile': {
    key: string; // ${username}|active
    value: string; // profileId (not namespaced)
  };
  'extension-sync': {
    key: string; // ${username}|lastTimestamp
    value: number; // epoch seconds of most-recent extension solve
  };
  'app-prefs': {
    key: string; // preference key
    value: any; // preference value
  };
  'user-ratings': {
    key: string; // ${username}|ratings
    value: UserRatings;
  };
  'calibration-state': {
    key: string; // ${username}|calibration
    value: CalibrationState;
  };
  'active-solve-session': {
    key: string; // ${username}|session
    value: SolveSession;
  };
}

// Create a union type of all valid store names
type ValidStoreName = keyof LeetTrackerDB;

/* ----------------------------------------------------------------------------
   DB init (version 6) + one-time migration from legacy global keys
---------------------------------------------------------------------------- */
const initDb = () =>
  openDB<LeetTrackerDB>('leet-tracker-db', 6, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        // v1 schema
        db.createObjectStore('leetcode-username');
        db.createObjectStore('problem-list');
        db.createObjectStore('problem-metadata');
        db.createObjectStore('solves');
        db.createObjectStore('goal-profiles');
        db.createObjectStore('active-goal-profile');
      }
      if (oldVersion < 2) {
        // v2 – extension support
        db.createObjectStore('extension-sync');
      }

      if (oldVersion < 3) {
        // v3 – migrate existing global data to per-user namespaced keys AND add username indexes

        db.createObjectStore('solves-metadata');

        // Add indexes for username-based queries
        const solvesStore = tx.objectStore('solves') as any;
        if (!solvesStore.indexNames.contains('username')) {
          solvesStore.createIndex('username', 'username');
        }

        const goalProfilesStore = tx.objectStore('goal-profiles') as any;
        if (!goalProfilesStore.indexNames.contains('username')) {
          goalProfilesStore.createIndex('username', 'username');
        }

        // If no username exists, we assume signed-out state ⇒ no data to migrate.
        const username = await (tx.objectStore('leetcode-username') as any).get('username');
        if (!username) {
          // Skip the v3 migration logic but continue with other version upgrades
          // Don't return here - we still need to process v4+ upgrades
        } else {
          const prefix = `${username}|`;

          // ---- solves: `${slug}|${timestamp}` → `${username}|${slug}|${timestamp}`
          const solveKeys = (await solvesStore.getAllKeys()) as string[];
          for (const k of solveKeys) {
            if (typeof k !== 'string') continue;
            // legacy solve key has exactly one pipe
            if (k.split('|').length === 2) {
              const val = await solvesStore.get(k as any);
              const target = `${prefix}${k}`;
              const existing = await solvesStore.get(target as any);
              if (val !== undefined && existing === undefined) {
                // Add username field when migrating
                const solveWithUsername = { ...val, username };
                await solvesStore.put(solveWithUsername, target as any);
              }
              await solvesStore.delete(k as any);
            }
          }

          // ---- goal-profiles: `${profileId}` → `${username}|${profileId}`
          const profStore = goalProfilesStore;
          const profKeys = (await profStore.getAllKeys()) as string[];
          for (const k of profKeys) {
            if (typeof k !== 'string') continue;
            // namespaced keys already start with `${username}|`
            if (!k.startsWith(prefix)) {
              const val = await profStore.get(k as any);
              const target = `${prefix}${k}`;
              const existing = await profStore.get(target as any);
              if (val !== undefined && existing === undefined) {
                // Add username field when migrating
                const profileWithUsername = { ...val, username };
                await profStore.put(profileWithUsername, target as any);
              }
              await profStore.delete(k as any);
            }
          }

          // ---- active-goal-profile: 'active' → `${username}|active`
          const activeStore = tx.objectStore('active-goal-profile');
          const legacyActiveVal = await activeStore.get('active');
          if (legacyActiveVal !== undefined) {
            const nsActiveKey = `${prefix}active`;
            const existing = await activeStore.get(nsActiveKey as any);
            if (existing === undefined) {
              await activeStore.put(legacyActiveVal, nsActiveKey as any);
            }
            await activeStore.delete('active' as any);
          }

          // ---- extension-sync: 'lastTimestamp' → `${username}|lastTimestamp`
          const extStore = tx.objectStore('extension-sync');
          const legacyTs = await extStore.get('lastTimestamp');
          if (legacyTs !== undefined) {
            const nsTsKey = `${prefix}lastTimestamp`;
            const existing = await extStore.get(nsTsKey as any);
            if (existing === undefined) {
              await extStore.put(legacyTs, nsTsKey as any);
            }
            await extStore.delete('lastTimestamp' as any);
          }

          // ---- problem-metadata: 'recentSolvesLastUpdated' → solves-metadata: `${username}|recentSolvesLastUpdated`
          // Keep 'lastUpdated' global in problem-metadata.
          const metaStore = tx.objectStore('problem-metadata');
          const solvesMetaStore = tx.objectStore('solves-metadata');
          const legacyRecent = await metaStore.get('recentSolvesLastUpdated' as any);
          if (legacyRecent !== undefined) {
            const nsRecentKey = `${prefix}recentSolvesLastUpdated`;
            const existing = await solvesMetaStore.get(nsRecentKey as any);
            if (existing === undefined) {
              await solvesMetaStore.put(legacyRecent, nsRecentKey as any);
            }
            await metaStore.delete('recentSolvesLastUpdated' as any);
          }
        } // End of else block for username-based v3 migration
      }

      if (oldVersion < 4) {
        // v4 – add app-prefs store for tutorial and other preferences
        db.createObjectStore('app-prefs');
      }

      if (oldVersion < 5) {
        // v5 – add user-ratings and calibration-state stores for Elo rating system
        db.createObjectStore('user-ratings');
        db.createObjectStore('calibration-state');
      }

      if (oldVersion < 6) {
        // v6 – add active-solve-session store for real-time solve tracking
        db.createObjectStore('active-solve-session');
      }
    },
  });

let dbPromise: Promise<import('idb').IDBPDatabase<LeetTrackerDB>> | null = initDb();

const getDbPromise = () => {
  if (!dbPromise) {
    dbPromise = initDb();
  }
  return dbPromise;
};

/* ----------------------------------------------------------------------------
   Public DB API (namespaced; no runtime legacy fallbacks)
---------------------------------------------------------------------------- */

export const db = {
  /* ----------------------------------------------------------------------------
     Private properties for testing
  ---------------------------------------------------------------------------- */
  _usernameCache: null as string | undefined | null, // null = not loaded, undefined = no username
  get _dbPromise() {
    return getDbPromise();
  },
  set _dbPromise(p: typeof dbPromise) {
    dbPromise = p;
  },

  /* ----------------------------------------------------------------------------
     Private helpers for namespacing
  ---------------------------------------------------------------------------- */

  async getUserPrefixOrThrow(): Promise<string> {
    const u = await this.getUsername();
    // In practice, operations occur post sign-in; prefix with username.
    // We _should_ never hit this in practice, but handle it gracefully.
    if (u === undefined) {
      throw new Error('Username is not set, cannot build namespaced keys');
    }
    return u + '|';
  },

  /** Build namespaced solve key. */
  async nsSolveKey(slug: string, timestamp: number): Promise<string> {
    const prefix = await this.getUserPrefixOrThrow();
    return `${prefix}${slug}|${timestamp}`;
  },

  /** Build namespaced extension last-timestamp key. */
  async nsExtensionLastTsKey(): Promise<string> {
    const prefix = await this.getUserPrefixOrThrow();
    return `${prefix}lastTimestamp`;
  },

  /** Build namespaced profile key. */
  async nsProfileKey(profileId: string): Promise<string> {
    const prefix = await this.getUserPrefixOrThrow();
    return `${prefix}${profileId}`;
  },

  /** Build namespaced active-profile key. */
  async nsActiveProfileKey(): Promise<string> {
    const prefix = await this.getUserPrefixOrThrow();
    return `${prefix}active`;
  },

  /* ----------------------------------------------------------------------------
      Public API methods
  ---------------------------------------------------------------------------- */

  // User identity
  async getUsername(): Promise<string | undefined> {
    // Return cached value if available
    if (this._usernameCache !== null) {
      return this._usernameCache;
    }

    // Load from database and cache
    const username = await (await getDbPromise()).get('leetcode-username', 'username');
    this._usernameCache = username;
    return username;
  },
  async setUsername(username: string): Promise<string> {
    // Update cache when setting new username
    this._usernameCache = username;
    return (await getDbPromise()).put('leetcode-username', username, 'username');
  },
  async clearUsername(): Promise<void> {
    this._usernameCache = null; // Clear cache
    return (await getDbPromise()).delete('leetcode-username', 'username');
  },

  // Problem catalog
  async getAllProblems(): Promise<Problem[]> {
    return (await getDbPromise()).getAll('problem-list');
  },
  async getProblem(slug: string): Promise<Problem | undefined> {
    return (await getDbPromise()).get('problem-list', slug);
  },
  async addOrUpdateProblem(problem: Problem): Promise<string> {
    return (await getDbPromise()).put('problem-list', problem, problem.slug);
  },
  async setProblemListLastUpdated(epochMs: number): Promise<string> {
    return (await getDbPromise()).put('problem-metadata', epochMs, 'lastUpdated');
  },
  async getProblemListLastUpdated(): Promise<number | undefined> {
    return (await getDbPromise()).get('problem-metadata', 'lastUpdated');
  },

  // Solves (per user)
  async getAllSolves(): Promise<Solve[]> {
    const username = await this.getUsername();
    if (!username) return [];

    return this.withTransaction(
      'solves',
      async (tx) => {
        const store = tx.objectStore('solves') as any;
        const index = store.index('username');
        const results = await index.getAll(username);
        return results;
      },
      'readonly',
    );
  },

  async getAllSolvesSorted(): Promise<Solve[]> {
    const solves = await this.getAllSolves();
    return solves.sort((a, b) => b.timestamp - a.timestamp);
  },

  async getSolve(slug: string, timestamp: number): Promise<Solve | undefined> {
    const nsKey = await this.nsSolveKey(slug, timestamp);
    return (await getDbPromise()).get('solves', nsKey);
  },

  async saveSolve(solve: Solve): Promise<string> {
    const key = await this.nsSolveKey(solve.slug, solve.timestamp);
    const username = await this.getUsername();

    // Ensure username is set for indexing
    const solveWithUsername = { ...solve, username };

    return this.withTransaction('solves', async (tx) => {
      const store = tx.objectStore('solves');
      const res = await store.put!(solveWithUsername, key);
      return res as string;
    });
  },

  async clearSolves(): Promise<void> {
    const username = await this.getUsername();
    if (!username) return;

    return this.withTransaction('solves', async (tx) => {
      const store = tx.objectStore('solves') as any;
      const index = store.index('username');
      const keys = await index.getAllKeys(username);
      for (const key of keys) {
        await store.delete!(key);
      }
    });
  },

  // Goal profiles (per user)
  async getGoalProfile(id: string): Promise<GoalProfile | undefined> {
    const ns = await this.nsProfileKey(id);
    return (await getDbPromise()).get('goal-profiles', ns);
  },

  async saveGoalProfile(profile: GoalProfile): Promise<string> {
    const key = await this.nsProfileKey(profile.id);
    const username = await this.getUsername();

    // Ensure username is set for indexing
    const profileWithUsername = { ...profile, username };

    return (await getDbPromise()).put('goal-profiles', profileWithUsername, key);
  },

  async deleteGoalProfile(id: string): Promise<void> {
    const key = await this.nsProfileKey(id);
    await (await getDbPromise()).delete('goal-profiles', key);
  },

  async clearGoalProfiles(): Promise<void> {
    const username = await this.getUsername();
    if (!username) return;

    return this.withTransaction('goal-profiles', async (tx) => {
      const store = tx.objectStore('goal-profiles') as any;
      const index = store.index('username');
      const keys = await index.getAllKeys(username);
      for (const key of keys) {
        await store.delete!(key);
      }
    });
  },

  async setActiveGoalProfile(id: string): Promise<string> {
    const key = await this.nsActiveProfileKey();
    return (await getDbPromise()).put('active-goal-profile', id, key);
  },

  async getActiveGoalProfileId(): Promise<string | undefined> {
    const key = await this.nsActiveProfileKey();
    return (await getDbPromise()).get('active-goal-profile', key);
  },

  async getAllGoalProfiles(): Promise<GoalProfile[]> {
    const username = await this.getUsername();
    if (!username) return [];

    return this.withTransaction(
      'goal-profiles',
      async (tx) => {
        const store = tx.objectStore('goal-profiles') as any;
        const index = store.index('username');
        const results = await index.getAll(username);
        return results;
      },
      'readonly',
    );
  },

  // Extension sync (per user)
  async getExtensionLastTimestamp(): Promise<number> {
    const key = await this.nsExtensionLastTsKey();
    const v = await (await getDbPromise()).get('extension-sync', key);
    return v !== undefined ? v : 0;
  },

  async setExtensionLastTimestamp(ts: number): Promise<string> {
    const key = await this.nsExtensionLastTsKey();
    return (await getDbPromise()).put('extension-sync', ts, key);
  },

  // Transaction support
  async transaction(
    storeNames: ValidStoreName | ValidStoreName[],
    mode: IDBTransactionMode = 'readonly',
  ): Promise<IDBPTransaction<LeetTrackerDB, any, typeof mode>> {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const idb = await getDbPromise();
    // cast to any so TS will pick the overload that accepts string[]:
    return idb.transaction(names as any, mode);
  },

  async withTransaction<T>(
    storeNames: ValidStoreName | ValidStoreName[],
    // eslint-disable-next-line no-unused-vars
    callback: (tx: IDBPTransaction<LeetTrackerDB, any, any>) => Promise<T>,
    mode: IDBTransactionMode = 'readwrite',
  ): Promise<T> {
    const tx = await this.transaction(storeNames, mode);
    return await callback(tx as any);
  },

  /* ----------------------------------------------------------------------------
     App preferences for tutorial and other settings
  ---------------------------------------------------------------------------- */
  async getAppPref<T>(key: string): Promise<T | undefined> {
    const idb = await getDbPromise();
    return await idb.get('app-prefs', key);
  },

  async setAppPref<T>(key: string, val: T): Promise<void> {
    const idb = await getDbPromise();
    await idb.put('app-prefs', val, key);
  },

  async deleteAppPref(key: string): Promise<void> {
    const idb = await getDbPromise();
    await idb.delete('app-prefs', key);
  },
};

/* ----------------------------------------------------------------------------
   Tutorial preference functions
---------------------------------------------------------------------------- */
export async function markTutorialSeen() {
  await db.setAppPref('tutorial.seen', true);
}

export async function clearTutorialSeen() {
  await db.deleteAppPref('tutorial.seen');
}

export async function getTutorialSeen(): Promise<boolean> {
  return (await db.getAppPref<boolean>('tutorial.seen')) === true;
}

export async function setTutorialActive(active: boolean) {
  await db.setAppPref('tutorial.active', active);
}

export async function getTutorialActive(): Promise<boolean> {
  return (await db.getAppPref<boolean>('tutorial.active')) === true;
}

export async function setTutorialStep(step: number) {
  await db.setAppPref('tutorial.step', step);
}

export async function getTutorialStep(): Promise<number> {
  return (await db.getAppPref<number>('tutorial.step')) ?? 0;
}

export async function setTutorialStartedWithUser(kind: 'demo' | 'normal') {
  await db.setAppPref('tutorial.startedWithUser', kind);
}

export async function getTutorialStartedWithUser(): Promise<'demo' | 'normal' | undefined> {
  return await db.getAppPref<'demo' | 'normal'>('tutorial.startedWithUser');
}

export async function setPrevUser(username: string) {
  await db.setAppPref('tutorial.prevUser', username);
}

export async function getPrevUser(): Promise<string | undefined> {
  return db.getAppPref<string>('tutorial.prevUser');
}

export async function clearPrevUser() {
  await db.deleteAppPref('tutorial.prevUser');
}

/* ----------------------------------------------------------------------------
   Onboarding preference functions (per-user)
---------------------------------------------------------------------------- */

/**
 * Mark onboarding as complete for a specific user.
 * Uses per-user key to track onboarding separately for each account.
 */
export async function markOnboardingComplete(username: string) {
  await db.setAppPref(`onboarding.${username}.complete`, true);
}

/**
 * Check if onboarding has been completed for a specific user.
 */
export async function getOnboardingComplete(username: string): Promise<boolean> {
  return (await db.getAppPref<boolean>(`onboarding.${username}.complete`)) === true;
}

/**
 * Clear the onboarding completion state for a specific user.
 * Used when forcing a user to re-complete onboarding (e.g., when extension is missing).
 */
export async function clearOnboardingComplete(username: string): Promise<void> {
  await db.deleteAppPref(`onboarding.${username}.complete`);
}

/* ----------------------------------------------------------------------------
   AI Feedback workflow preference functions
---------------------------------------------------------------------------- */

export const AI_FEEDBACK_USED_KEY = 'leettracker-ai-feedback-used';

export function markAiFeedbackUsed() {
  localStorage.setItem(AI_FEEDBACK_USED_KEY, 'true');
}

export function getAiFeedbackUsed(): boolean {
  return localStorage.getItem(AI_FEEDBACK_USED_KEY) === 'true';
}
