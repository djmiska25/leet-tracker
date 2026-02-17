import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRatings,
  saveRatings,
  initializeRatings,
  getCalibrationState,
  clearCalibrationState,
  hasRatings,
} from './ratings';
import type { UserRatings, CalibrationState } from '../types/types';

// Mock the IDB module
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();
const mockOpenDB = vi.fn();

vi.mock('idb', () => ({
  openDB: mockOpenDB,
}));

describe('ratings storage', () => {
  const testUsername = 'testuser';

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock return value
    mockOpenDB.mockResolvedValue({
      get: mockGet,
      put: mockPut,
      delete: mockDelete,
    });
  });

  describe('getRatings', () => {
    it('should return ratings when they exist', async () => {
      const mockRatings: UserRatings = {
        global: {
          rating: 1500,
          rd: 350,
          volatility: 0.06,
          lastUpdated: Date.now(),
          solveCount: 0,
        },
        categories: {},
      };

      mockGet.mockResolvedValue(mockRatings);

      const result = await getRatings(testUsername);

      expect(result).toEqual(mockRatings);
    });

    it('should return null when ratings do not exist', async () => {
      mockGet.mockResolvedValue(undefined);

      const result = await getRatings(testUsername);

      expect(result).toBeNull();
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockGet.mockRejectedValue(dbError);

      await expect(getRatings(testUsername)).rejects.toThrow('Database connection failed');
    });
  });

  describe('saveRatings', () => {
    it('should propagate save errors', async () => {
      const mockRatings: UserRatings = {
        global: {
          rating: 1500,
          rd: 350,
          volatility: 0.06,
          lastUpdated: Date.now(),
          solveCount: 0,
        },
        categories: {},
      };

      const dbError = new Error('Failed to write to database');
      mockPut.mockRejectedValue(dbError);

      await expect(saveRatings(testUsername, mockRatings)).rejects.toThrow(
        'Failed to write to database',
      );
    });
  });

  describe('initializeRatings', () => {
    it('should create default ratings with correct initial values', async () => {
      mockPut.mockResolvedValue(undefined);

      const result = await initializeRatings(testUsername);

      expect(result).toEqual({
        global: {
          rating: 1500,
          rd: 350,
          volatility: 0.06,
          lastUpdated: expect.any(Number),
          solveCount: 0,
        },
        categories: {},
      });
    });
  });

  describe('getCalibrationState', () => {
    it('should return calibration state when it exists', async () => {
      const mockState: CalibrationState = {
        username: testUsername,
        attempts: [],
        currentRating: {
          rating: 1500,
          rd: 350,
          volatility: 0.06,
          lastUpdated: Date.now(),
          solveCount: 0,
        },
        isComplete: false,
        startedAt: Date.now(),
      };

      mockGet.mockResolvedValue(mockState);

      const result = await getCalibrationState(testUsername);

      expect(result).toEqual(mockState);
    });

    it('should return null when no calibration is in progress', async () => {
      mockGet.mockResolvedValue(undefined);

      const result = await getCalibrationState(testUsername);

      expect(result).toBeNull();
    });
  });

  describe('clearCalibrationState', () => {
    it('should propagate delete errors', async () => {
      const dbError = new Error('Failed to delete');
      mockDelete.mockRejectedValue(dbError);

      await expect(clearCalibrationState(testUsername)).rejects.toThrow('Failed to delete');
    });
  });

  describe('hasRatings', () => {
    it('should return true when ratings exist', async () => {
      const mockRatings: UserRatings = {
        global: {
          rating: 1500,
          rd: 350,
          volatility: 0.06,
          lastUpdated: Date.now(),
          solveCount: 0,
        },
        categories: {},
      };

      mockGet.mockResolvedValue(mockRatings);

      const result = await hasRatings(testUsername);

      expect(result).toBe(true);
    });

    it('should return false when ratings do not exist', async () => {
      mockGet.mockResolvedValue(undefined);

      const result = await hasRatings(testUsername);

      expect(result).toBe(false);
    });
  });
});
