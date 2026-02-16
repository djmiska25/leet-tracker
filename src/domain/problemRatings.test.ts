import { describe, it, expect, beforeEach } from 'vitest';
import { Difficulty } from '../types/types';
import {
  getRating,
  getRatingOrEstimate,
  ratingToColor,
  formatRating,
  ESTIMATED_RATINGS,
  __resetRatingsForTests,
  __setRatingsForTests,
} from './problemRatings';

describe('problemRatings', () => {
  beforeEach(() => {
    __resetRatingsForTests();
    __setRatingsForTests({
      'two-sum': 1150,
      'merge-intervals': 1650,
      'median-of-two-sorted-arrays': 2400,
    });
  });

  describe('getRating', () => {
    it('returns the rating for a known slug', () => {
      expect(getRating('two-sum')).toBe(1150);
      expect(getRating('merge-intervals')).toBe(1650);
    });

    it('returns undefined for an unknown slug', () => {
      expect(getRating('unknown-problem')).toBeUndefined();
    });
  });

  describe('getRatingOrEstimate', () => {
    it('returns the exact rating when available', () => {
      expect(getRatingOrEstimate('two-sum', Difficulty.Easy)).toBe(1150);
    });

    it('falls back to difficulty estimate when no rating exists', () => {
      expect(getRatingOrEstimate('unknown', Difficulty.Easy)).toBe(
        ESTIMATED_RATINGS[Difficulty.Easy],
      );
      expect(getRatingOrEstimate('unknown', Difficulty.Medium)).toBe(
        ESTIMATED_RATINGS[Difficulty.Medium],
      );
      expect(getRatingOrEstimate('unknown', Difficulty.Hard)).toBe(
        ESTIMATED_RATINGS[Difficulty.Hard],
      );
    });
  });

  describe('ratingToColor', () => {
    it('returns easy for ratings < 1400', () => {
      expect(ratingToColor(1150)).toBe('easy');
      expect(ratingToColor(1399)).toBe('easy');
    });

    it('returns medium for ratings 1400–1899', () => {
      expect(ratingToColor(1400)).toBe('medium');
      expect(ratingToColor(1650)).toBe('medium');
      expect(ratingToColor(1899)).toBe('medium');
    });

    it('returns hard for ratings >= 1900', () => {
      expect(ratingToColor(1900)).toBe('hard');
      expect(ratingToColor(2400)).toBe('hard');
    });
  });

  describe('formatRating', () => {
    it('returns the exact rating string for known problems', () => {
      expect(formatRating('two-sum', Difficulty.Easy)).toBe('1150');
    });

    it('returns the difficulty label for unknown problems', () => {
      expect(formatRating('unknown', Difficulty.Easy)).toBe('Easy');
      expect(formatRating('unknown', Difficulty.Medium)).toBe('Medium');
      expect(formatRating('unknown', Difficulty.Hard)).toBe('Hard');
    });
  });
});
