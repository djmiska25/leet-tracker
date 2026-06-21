import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProblemDetails } from './useProblemDetails';
import { db } from '@/storage/db';
import type { Solve, Problem } from '@/types/types';
import { Difficulty } from '@/types/types';

vi.mock('@/storage/db');

const mockSolve = (overrides: Partial<Solve> = {}): Solve => ({
  slug: 'two-sum',
  title: 'Two Sum',
  timestamp: Date.now() / 1000,
  status: 'Accepted',
  lang: 'python3',
  ...overrides,
});

const mockProblem = (overrides: Partial<Problem> = {}): Problem => ({
  slug: 'two-sum',
  title: 'Two Sum',
  tags: ['Array', 'Hash Table'],
  description: 'Find two numbers',
  difficulty: Difficulty.Easy,
  popularity: 0.9,
  isPaid: false,
  isFundamental: true,
  createdAt: Date.now() / 1000,
  ...overrides,
});

describe('useProblemDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads problems on mount', async () => {
    const solves = [
      mockSolve({ slug: 'two-sum', timestamp: 3000 }),
      mockSolve({ slug: 'three-sum', timestamp: 2000 }),
    ];
    const problems = [mockProblem({ slug: 'two-sum' }), mockProblem({ slug: 'three-sum' })];

    vi.mocked(db.getAllSolvesSorted).mockResolvedValue(solves);
    vi.mocked(db.getAllProblems).mockResolvedValue(problems);

    const { result } = renderHook(() => useProblemDetails());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.problems).toHaveLength(2);
    expect(result.current.problems[0].slug).toBe('two-sum'); // Most recent
  });

  it('applies filters to problems', async () => {
    const solves = [
      mockSolve({ slug: 'easy-problem', difficulty: Difficulty.Easy, timestamp: 3000 }),
      mockSolve({ slug: 'hard-problem', difficulty: Difficulty.Hard, timestamp: 2000 }),
    ];

    vi.mocked(db.getAllSolvesSorted).mockResolvedValue(solves);
    vi.mocked(db.getAllProblems).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useProblemDetails({ difficulty: Difficulty.Easy, category: 'All' }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.problems).toHaveLength(1);
    expect(result.current.problems[0].difficulty).toBe(Difficulty.Easy);
  });

  it('handles empty solve list', async () => {
    vi.mocked(db.getAllSolvesSorted).mockResolvedValue([]);
    vi.mocked(db.getAllProblems).mockResolvedValue([]);

    const { result } = renderHook(() => useProblemDetails());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.problems).toHaveLength(0);
  });

  it('provides refresh function', async () => {
    const initialSolves = [mockSolve({ timestamp: 1000 })];
    const updatedSolves = [mockSolve({ timestamp: 2000 }), ...initialSolves];

    vi.mocked(db.getAllSolvesSorted).mockResolvedValueOnce(initialSolves);
    vi.mocked(db.getAllProblems).mockResolvedValue([]);

    const { result } = renderHook(() => useProblemDetails());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.problems).toHaveLength(1);

    // Simulate new solve added
    vi.mocked(db.getAllSolvesSorted).mockResolvedValueOnce(updatedSolves);

    await result.current.refresh();

    await waitFor(() => {
      expect(result.current.problems).toHaveLength(1); // Still grouped by same problem
    });
  });
});
