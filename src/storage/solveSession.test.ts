import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  startSolveSession,
  getActiveSolveSession,
  endSolveSession,
  markSessionInactive,
} from './solveSession';
import type { Problem, SolveSession } from '../types/types';

// Mock the IDB module
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();
const mockOpenDB = vi.fn();

vi.mock('idb', () => ({
  openDB: mockOpenDB,
}));

describe('solveSession storage', () => {
  const testUsername = 'testuser';
  const testProblem: Problem = {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    rating: 1200,
    tags: ['Array', 'Hash Table'],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock return value
    mockOpenDB.mockResolvedValue({
      get: mockGet,
      put: mockPut,
      delete: mockDelete,
    });
  });

  describe('startSolveSession', () => {
    it('should create a new solve session with correct structure', async () => {
      mockPut.mockResolvedValue(undefined);

      const result = await startSolveSession(testUsername, testProblem);

      expect(result).toMatchObject({
        problem: testProblem,
        timeLimit: 1200, // 20 minutes = 1200 seconds
        username: testUsername,
        isActive: true,
        startedAt: expect.any(Number),
      });
    });

    it('should use fixed 20-minute time limit regardless of rating', async () => {
      mockPut.mockResolvedValue(undefined);

      const hardProblem: Problem = {
        ...testProblem,
        rating: 2000,
        difficulty: 'Hard',
      };

      const result = await startSolveSession(testUsername, hardProblem);

      expect(result.timeLimit).toBe(1200);
    });

    it('should default to 1500 rating for problems without rating', async () => {
      mockPut.mockResolvedValue(undefined);

      const problemWithoutRating: Problem = {
        ...testProblem,
        rating: undefined,
      };

      const result = await startSolveSession(testUsername, problemWithoutRating);

      expect(result.timeLimit).toBe(1200);
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Failed to save session');
      mockPut.mockRejectedValue(dbError);

      await expect(startSolveSession(testUsername, testProblem)).rejects.toThrow(
        'Failed to save session',
      );
    });
  });

  describe('getActiveSolveSession', () => {
    it('should return active session when it exists', async () => {
      const mockSession: SolveSession = {
        problem: testProblem,
        timeLimit: 1200,
        startedAt: Date.now(),
        username: testUsername,
        isActive: true,
      };

      mockGet.mockResolvedValue(mockSession);

      const result = await getActiveSolveSession(testUsername);

      expect(result).toEqual(mockSession);
    });

    it('should return null when no active session exists', async () => {
      mockGet.mockResolvedValue(undefined);

      const result = await getActiveSolveSession(testUsername);

      expect(result).toBeNull();
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Database read failed');
      mockGet.mockRejectedValue(dbError);

      await expect(getActiveSolveSession(testUsername)).rejects.toThrow('Database read failed');
    });
  });

  describe('endSolveSession', () => {
    it('should propagate delete errors', async () => {
      const dbError = new Error('Failed to delete session');
      mockDelete.mockRejectedValue(dbError);

      await expect(endSolveSession(testUsername)).rejects.toThrow('Failed to delete session');
    });
  });

  describe('markSessionInactive', () => {
    it('should update session to inactive when session exists', async () => {
      const mockSession: SolveSession = {
        problem: testProblem,
        timeLimit: 1200,
        startedAt: Date.now(),
        username: testUsername,
        isActive: true,
      };

      mockGet.mockResolvedValue(mockSession);
      mockPut.mockResolvedValue(undefined);

      await markSessionInactive(testUsername);

      expect(mockPut).toHaveBeenCalledWith(
        'active-solve-session',
        { ...mockSession, isActive: false },
        `${testUsername}|session`,
      );
    });

    it('should not call put when no session exists', async () => {
      mockGet.mockResolvedValue(undefined);

      await markSessionInactive(testUsername);

      expect(mockPut).not.toHaveBeenCalled();
    });
  });
});
