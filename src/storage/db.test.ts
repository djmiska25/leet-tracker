import { describe, it, expect, afterEach } from 'vitest';
import { openDB } from 'idb';
import {
  db,
  markAiFeedbackUsed,
  getAiFeedbackUsed,
  AI_FEEDBACK_USED_KEY,
  markOnboardingComplete,
  getOnboardingComplete,
} from './db';
import { Problem, Solve, GoalProfile, Difficulty } from '../types/types';

const exampleProblem: Problem = {
  slug: 'two-sum',
  title: 'Two Sum',
  tags: ['Array'],
  description: 'desc',
  difficulty: Difficulty.Easy,
  popularity: 0.9,
  isPaid: false,
  isFundamental: true,
  createdAt: 1746308137,
};

const exampleSolve: Solve = {
  slug: 'two-sum',
  title: 'Two Sum',
  timestamp: 1234567890,
  status: 'Accepted',
  lang: 'python3',
};

const exampleProfile: GoalProfile = {
  id: 'default',
  name: 'Default Goals',
  description: 'Default goal profile',
  goals: {
    Array: 0.6,
    String: 0.6,
    'Hash Table': 0.6,
    'Two Pointers': 0.6,
    'Sliding Window': 0.6,
    Stack: 0.6,
    Queue: 0.6,
    'Linked List': 0.6,
    Tree: 0.6,
    Graph: 0.6,
    'Dynamic Programming': 0.6,
    Greedy: 0.6,
    'Binary Search': 0.6,
    Math: 0.6,
    Backtracking: 0.6,
    'Heap (Priority Queue)': 0.6,
  },
  createdAt: new Date().toISOString(),
  isEditable: true,
};

describe('db storage module', () => {
  afterEach(async () => {
    // Reset the username cache
    db._usernameCache = null;
    // Clear localStorage to ensure test isolation
    localStorage.clear();

    // Close any open connections before deleting
    if (db._dbPromise) {
      const database = await db._dbPromise;
      database.close();
      db._dbPromise = null;
    }

    // IndexedDB persists across tests — clearing it ensures isolation
    await new Promise<void>((resolve) => {
      const deleteReq = indexedDB.deleteDatabase('leet-tracker-db');
      deleteReq.onsuccess = () => resolve();
      deleteReq.onerror = () => resolve(); // Still resolve even on error
      deleteReq.onblocked = () => resolve(); // Still resolve even if blocked
    });
  });

  it('stores and retrieves the username', async () => {
    await db.setUsername('dmiska');
    const username = await db.getUsername();
    expect(username).toBe('dmiska');
  });

  it('stores and retrieves a problem', async () => {
    await db.addOrUpdateProblem(exampleProblem);
    const problems = await db.getAllProblems();
    expect(problems).toHaveLength(1);
    expect(problems[0].slug).toBe('two-sum');
  });

  it('stores and retrieves a solve', async () => {
    await db.setUsername('testuser');
    await db.saveSolve(exampleSolve);
    const solves = await db.getAllSolves();
    expect(solves).toHaveLength(1);
    expect(solves[0].slug).toBe('two-sum');
  });

  it('clears solves', async () => {
    await db.setUsername('testuser');
    await db.saveSolve(exampleSolve);
    const solvesBeforeClear = await db.getAllSolves();
    expect(solvesBeforeClear).toHaveLength(1);
    await db.clearSolves();
    const solves = await db.getAllSolves();
    expect(solves).toHaveLength(0);
  });

  it('stores and retrieves a goal profile', async () => {
    await db.setUsername('testuser');
    await db.saveGoalProfile(exampleProfile);
    const result = await db.getGoalProfile('default');
    expect(result?.id).toBe('default');
    expect(result?.goals.Array).toBe(0.6);
  });

  it('sets and retrieves the active goal profile ID', async () => {
    await db.setUsername('testuser');
    await db.setActiveGoalProfile('default');
    const active = await db.getActiveGoalProfileId();
    expect(active).toBe('default');
  });

  it('sets and retrieves the problem list last update timestamp', async () => {
    await db.setProblemListLastUpdated(1746308137);
    const timestamp = await db.getProblemListLastUpdated();
    expect(timestamp).toBe(1746308137);
  });

  it('migrates difficulty casing from v4 to v5', async () => {
    const username = 'testuser';

    const legacyDb = await openDB('leet-tracker-db', 4, {
      upgrade(dbInstance) {
        dbInstance.createObjectStore('leetcode-username');
        dbInstance.createObjectStore('problem-list');
        dbInstance.createObjectStore('problem-metadata');
        const solvesStore = dbInstance.createObjectStore('solves');
        if (!solvesStore.indexNames.contains('username')) {
          solvesStore.createIndex('username', 'username');
        }
        dbInstance.createObjectStore('solves-metadata');
        const goalProfilesStore = dbInstance.createObjectStore('goal-profiles');
        if (!goalProfilesStore.indexNames.contains('username')) {
          goalProfilesStore.createIndex('username', 'username');
        }
        dbInstance.createObjectStore('active-goal-profile');
        dbInstance.createObjectStore('extension-sync');
        dbInstance.createObjectStore('app-prefs');
      },
    });

    await legacyDb.put('leetcode-username', username, 'username');
    const legacyProblem = {
      ...exampleProblem,
      difficulty: 'Easy',
    } as unknown as Problem;
    const legacySolve = {
      ...exampleSolve,
      username,
      difficulty: 'Medium',
    } as unknown as Solve;

    await legacyDb.put('problem-list', legacyProblem, 'p1');
    await legacyDb.put(
      'solves',
      legacySolve,
      `${username}|${exampleSolve.slug}|${exampleSolve.timestamp}`,
    );
    legacyDb.close();

    await db.setUsername(username);
    const problems = await db.getAllProblems();
    const solves = await db.getAllSolves();

    expect(problems[0]?.difficulty).toBe(Difficulty.Easy);
    expect(solves[0]?.difficulty).toBe(Difficulty.Medium);
  });

  describe('username caching', () => {
    afterEach(() => {
      // Reset cache after each test to avoid conflicts
      db._usernameCache = null;
    });

    it('caches username after first retrieval', async () => {
      // Set username
      await db.setUsername('testuser');

      // First call should load from database and cache
      const username1 = await db.getUsername();
      expect(username1).toBe('testuser');
      expect(db._usernameCache).toBe('testuser');

      // Second call should use cache (we can't directly test this without mocking,
      // but we can verify the cache is populated)
      const username2 = await db.getUsername();
      expect(username2).toBe('testuser');
    });

    it('updates cache when setting new username', async () => {
      // Set initial username
      await db.setUsername('user1');
      await db.getUsername(); // Load into cache
      expect(db._usernameCache).toBe('user1');

      // Set new username
      await db.setUsername('user2');
      expect(db._usernameCache).toBe('user2');

      // Verify new username is returned
      const username = await db.getUsername();
      expect(username).toBe('user2');
    });

    it('cache can be cleared using helper method', async () => {
      // Set and cache a username
      await db.setUsername('testuser');
      await db.getUsername(); // Load into cache
      expect(db._usernameCache).toBe('testuser');

      // Clear cache
      db._usernameCache = null;
      expect(db._usernameCache).toBe(null);

      // Next call should reload from database
      const username = await db.getUsername();
      expect(username).toBe('testuser');
      expect(db._usernameCache).toBe('testuser');
    });
  });

  describe('namespaced key generation', () => {
    beforeEach(async () => {
      await db.setUsername('testuser');
    });

    afterEach(() => {
      db._usernameCache = null;
    });

    it('generates correct solve keys', async () => {
      const key = await db.nsSolveKey('two-sum', 1234567890);
      expect(key).toBe('testuser|two-sum|1234567890');
    });

    it('generates correct profile keys', async () => {
      const key = await db.nsProfileKey('my-profile');
      expect(key).toBe('testuser|my-profile');
    });

    it('generates correct active profile key', async () => {
      const key = await db.nsActiveProfileKey();
      expect(key).toBe('testuser|active');
    });

    it('generates correct extension timestamp key', async () => {
      const key = await db.nsExtensionLastTsKey();
      expect(key).toBe('testuser|lastTimestamp');
    });

    it('throws error when username is undefined', async () => {
      // Test the getUserPrefix logic directly by setting cache to undefined
      db._usernameCache = undefined;

      await expect(db.getUserPrefixOrThrow()).rejects.toThrow(
        'Username is not set, cannot build namespaced keys',
      );

      await expect(db.nsSolveKey('two-sum', 1234567890)).rejects.toThrow(
        'Username is not set, cannot build namespaced keys',
      );
    });
  });

  describe('per-user data isolation', () => {
    const user1Solve: Solve = {
      slug: 'problem-a',
      title: 'Problem A',
      timestamp: 1111111111,
      status: 'Accepted',
      lang: 'python3',
    };

    const user2Solve: Solve = {
      slug: 'problem-b',
      title: 'Problem B',
      timestamp: 2222222222,
      status: 'Accepted',
      lang: 'javascript',
    };

    const user1Profile: GoalProfile = {
      ...exampleProfile,
      id: 'user1-profile',
      name: 'User 1 Profile',
    };

    const user2Profile: GoalProfile = {
      ...exampleProfile,
      id: 'user2-profile',
      name: 'User 2 Profile',
    };

    it('isolates solves between users', async () => {
      // User 1 saves a solve
      await db.setUsername('user1');
      await db.saveSolve(user1Solve);

      const user1Solves = await db.getAllSolves();
      expect(user1Solves).toHaveLength(1);
      expect(user1Solves[0].slug).toBe('problem-a');

      // User 2 saves a different solve
      await db.setUsername('user2');
      await db.saveSolve(user2Solve);

      const user2Solves = await db.getAllSolves();
      expect(user2Solves).toHaveLength(1);
      expect(user2Solves[0].slug).toBe('problem-b');

      // Verify user 1 still only sees their solve
      await db.setUsername('user1');
      const user1SolvesAgain = await db.getAllSolves();
      expect(user1SolvesAgain).toHaveLength(1);
      expect(user1SolvesAgain[0].slug).toBe('problem-a');
    });

    it('isolates goal profiles between users', async () => {
      // User 1 saves a profile
      await db.setUsername('user1');
      await db.saveGoalProfile(user1Profile);

      const user1Profiles = await db.getAllGoalProfiles();
      expect(user1Profiles).toHaveLength(1);
      expect(user1Profiles[0].name).toBe('User 1 Profile');

      // User 2 saves a different profile
      await db.setUsername('user2');
      await db.saveGoalProfile(user2Profile);

      const user2Profiles = await db.getAllGoalProfiles();
      expect(user2Profiles).toHaveLength(1);
      expect(user2Profiles[0].name).toBe('User 2 Profile');

      // Verify user 1 still only sees their profile
      await db.setUsername('user1');
      const user1ProfilesAgain = await db.getAllGoalProfiles();
      expect(user1ProfilesAgain).toHaveLength(1);
      expect(user1ProfilesAgain[0].name).toBe('User 1 Profile');
    });

    it('isolates active goal profile between users', async () => {
      // User 1 sets active profile
      await db.setUsername('user1');
      await db.setActiveGoalProfile('profile-1');

      let activeProfile = await db.getActiveGoalProfileId();
      expect(activeProfile).toBe('profile-1');

      // User 2 sets different active profile
      await db.setUsername('user2');
      await db.setActiveGoalProfile('profile-2');

      activeProfile = await db.getActiveGoalProfileId();
      expect(activeProfile).toBe('profile-2');

      // Verify user 1 still has their active profile
      await db.setUsername('user1');
      activeProfile = await db.getActiveGoalProfileId();
      expect(activeProfile).toBe('profile-1');
    });

    it('clears only current users data', async () => {
      // Setup data for both users
      await db.setUsername('user1');
      await db.saveSolve(user1Solve);

      await db.setUsername('user2');
      await db.saveSolve(user2Solve);

      // Clear user 2's solves
      await db.clearSolves();
      const user2Solves = await db.getAllSolves();
      expect(user2Solves).toHaveLength(0);

      // Verify user 1's solves are still there
      await db.setUsername('user1');
      const user1Solves = await db.getAllSolves();
      expect(user1Solves).toHaveLength(1);
      expect(user1Solves[0].slug).toBe('problem-a');
    });
  });

  describe('operations without username', () => {
    it('returns empty arrays for user-specific operations when cache shows no username', async () => {
      // Simulate no username by setting cache to undefined
      db._usernameCache = undefined;

      const solves = await db.getAllSolves();
      expect(solves).toHaveLength(0);

      const profiles = await db.getAllGoalProfiles();
      expect(profiles).toHaveLength(0);
    });

    it('clearSolves does nothing when cache shows no username', async () => {
      // Simulate no username by setting cache to undefined
      db._usernameCache = undefined;

      // This should not throw an error
      await expect(db.clearSolves()).resolves.toBeUndefined();
    });

    it('clearGoalProfiles does nothing when cache shows no username', async () => {
      // Simulate no username by setting cache to undefined
      db._usernameCache = undefined;

      // This should not throw an error
      await expect(db.clearGoalProfiles()).resolves.toBeUndefined();
    });
  });

  describe('AI Feedback Usage Status', () => {
    it('should handle AI feedback used flag operations', () => {
      // Test getting false when not set
      let result = getAiFeedbackUsed();
      expect(result).toBe(false); // Should default to false

      // Mark as used
      markAiFeedbackUsed();

      // Test getting true value (localStorage was actually set)
      result = getAiFeedbackUsed();
      expect(result).toBe(true);

      // Verify localStorage has the correct value
      expect(localStorage.getItem(AI_FEEDBACK_USED_KEY)).toBe('true');
    });

    it('should persist across calls', () => {
      // Initially false
      expect(getAiFeedbackUsed()).toBe(false);

      // Mark as used
      markAiFeedbackUsed();
      expect(getAiFeedbackUsed()).toBe(true);

      // Should remain true on subsequent calls
      expect(getAiFeedbackUsed()).toBe(true);
    });
  });

  describe('Onboarding Completion Tracking', () => {
    it('marks onboarding as complete for a specific user', async () => {
      await markOnboardingComplete('testuser');

      const isComplete = await getOnboardingComplete('testuser');
      expect(isComplete).toBe(true);
    });

    it('returns false when onboarding not completed', async () => {
      const isComplete = await getOnboardingComplete('newuser');
      expect(isComplete).toBe(false);
    });

    it('isolates onboarding status between users', async () => {
      // Mark complete for user1
      await markOnboardingComplete('user1');

      // Check user1 - should be true
      const user1Complete = await getOnboardingComplete('user1');
      expect(user1Complete).toBe(true);

      // Check user2 - should be false (not marked yet)
      const user2Complete = await getOnboardingComplete('user2');
      expect(user2Complete).toBe(false);

      // Mark complete for user2
      await markOnboardingComplete('user2');

      // Now both should be true
      const user1AfterUser2 = await getOnboardingComplete('user1');
      const user2AfterMark = await getOnboardingComplete('user2');

      expect(user1AfterUser2).toBe(true);
      expect(user2AfterMark).toBe(true);
    });

    it('can mark multiple users complete independently', async () => {
      // Mark alice and charlie complete, not bob
      await markOnboardingComplete('alice');
      await markOnboardingComplete('charlie');

      expect(await getOnboardingComplete('alice')).toBe(true);
      expect(await getOnboardingComplete('bob')).toBe(false);
      expect(await getOnboardingComplete('charlie')).toBe(true);
    });

    it('handles special characters in usernames', async () => {
      const specialUsername = 'user-with.special_chars@test';

      await markOnboardingComplete(specialUsername);

      const isComplete = await getOnboardingComplete(specialUsername);
      expect(isComplete).toBe(true);
    });

    it('returns false for undefined or empty usernames', async () => {
      const emptyComplete = await getOnboardingComplete('');
      expect(emptyComplete).toBe(false);
    });
  });
});
