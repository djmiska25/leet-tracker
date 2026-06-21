import { describe, it, expect } from 'vitest';
import type { Solve, Problem, Category } from '@/types/types';
import { Difficulty } from '@/types/types';
import {
  groupSolvesByProblem,
  filterProblems,
  getDisplayScore,
  formatHintLabel,
  type ProblemFilters,
  type ProblemWithSubmissions,
} from './problemDetails';

const createSolve = (overrides: Partial<Solve> = {}): Solve => ({
  slug: 'two-sum',
  title: 'Two Sum',
  timestamp: Date.now() / 1000,
  status: 'Accepted',
  lang: 'python3',
  difficulty: 'Easy' as Difficulty,
  tags: ['Array', 'Hash Table'],
  ...overrides,
});

const createProblem = (overrides: Partial<Problem> = {}): Problem => ({
  slug: 'two-sum',
  title: 'Two Sum',
  tags: ['Array', 'Hash Table'],
  description: 'Find two numbers that add up to target',
  difficulty: 'Easy' as Difficulty,
  popularity: 0.9,
  isPaid: false,
  isFundamental: true,
  createdAt: Date.now() / 1000,
  ...overrides,
});

describe('groupSolvesByProblem', () => {
  it('groups solves by problem slug', () => {
    const solves: Solve[] = [
      createSolve({ slug: 'two-sum', timestamp: 1000 }),
      createSolve({ slug: 'three-sum', title: 'Three Sum', timestamp: 2000 }),
      createSolve({ slug: 'two-sum', timestamp: 3000 }),
    ];

    const catalog = new Map<string, Problem>([
      ['two-sum', createProblem({ slug: 'two-sum' })],
      ['three-sum', createProblem({ slug: 'three-sum', title: 'Three Sum' })],
    ]);

    const result = groupSolvesByProblem(solves, catalog);

    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe('two-sum'); // Most recent
    expect(result[0].totalSubmissions).toBe(2);
    expect(result[1].slug).toBe('three-sum');
    expect(result[1].totalSubmissions).toBe(1);
  });

  it('orders problems by last solved timestamp', () => {
    const solves: Solve[] = [
      createSolve({ slug: 'older', timestamp: 1000 }),
      createSolve({ slug: 'newer', timestamp: 5000 }),
      createSolve({ slug: 'middle', timestamp: 3000 }),
    ];

    const result = groupSolvesByProblem(solves, new Map());

    expect(result[0].slug).toBe('newer');
    expect(result[1].slug).toBe('middle');
    expect(result[2].slug).toBe('older');
  });

  it('groups submissions into sessions', () => {
    const now = Date.now() / 1000;
    const solves: Solve[] = [
      createSolve({ timestamp: now }),
      createSolve({ timestamp: now - 1800 }), // 30 min earlier - same session
      createSolve({ timestamp: now - 20000 }), // 5.5 hours earlier - different session
    ];

    const result = groupSolvesByProblem(solves, new Map());

    expect(result).toHaveLength(1);
    expect(result[0].submissionGroups).toHaveLength(2); // 2 sessions
    expect(result[0].submissionGroups[0]).toHaveLength(2); // Most recent session has 2 solves
    expect(result[0].submissionGroups[1]).toHaveLength(1); // Older session has 1 solve
  });

  it('extracts latest score correctly', () => {
    const solves: Solve[] = [
      createSolve({
        timestamp: 3000,
        feedback: {
          performance: {
            time_to_solve: 3,
            time_complexity: 'O(n)',
            space_complexity: 'O(1)',
            comments: '',
          },
          code_quality: { readability: 4, correctness: 5, maintainability: 4, comments: '' },
          summary: { final_score: 85, comments: '' },
        },
      }),
      createSolve({
        timestamp: 1000,
        feedback: {
          performance: {
            time_to_solve: 2,
            time_complexity: 'O(n)',
            space_complexity: 'O(1)',
            comments: '',
          },
          code_quality: { readability: 3, correctness: 4, maintainability: 3, comments: '' },
          summary: { final_score: 70, comments: '' },
        },
      }),
    ];

    const result = groupSolvesByProblem(solves, new Map());

    expect(result[0].latestScore).toBe(85);
    expect(result[0].latestScoreIsEstimated).toBe(false);
  });

  it('marks score as estimated when no feedback', () => {
    const solves: Solve[] = [createSolve({ timestamp: 1000 })];

    const result = groupSolvesByProblem(solves, new Map());

    expect(result[0].latestScore).toBe(null);
    expect(result[0].latestScoreIsEstimated).toBe(true);
  });
});

describe('filterProblems', () => {
  const problems: ProblemWithSubmissions[] = [
    {
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: Difficulty.Easy,
      tags: ['Array' as Category, 'Hash Table' as Category],
      lastSolved: 3000,
      submissionGroups: [[createSolve({ usedHints: 'none' })]],
      latestScore: 85,
      latestScoreIsEstimated: false,
      totalSubmissions: 1,
    },
    {
      slug: 'three-sum',
      title: 'Three Sum',
      difficulty: Difficulty.Medium,
      tags: ['Array' as Category, 'Two Pointers' as Category],
      lastSolved: 2000,
      submissionGroups: [[createSolve({ usedHints: 'leetcode_hint' })]],
      latestScore: 50,
      latestScoreIsEstimated: false,
      totalSubmissions: 1,
    },
    {
      slug: 'hard-problem',
      title: 'Hard Problem',
      difficulty: Difficulty.Hard,
      tags: ['Dynamic Programming' as Category],
      lastSolved: 1000,
      submissionGroups: [[createSolve()]],
      latestScore: null,
      latestScoreIsEstimated: true,
      totalSubmissions: 1,
    },
  ];

  it('filters by category', () => {
    const filters: ProblemFilters = { category: 'Array' };
    const result = filterProblems(problems, filters);

    expect(result).toHaveLength(2);
    expect(result.every((p) => p.tags?.includes('Array'))).toBe(true);
  });

  it('filters by difficulty', () => {
    const filters: ProblemFilters = { difficulty: Difficulty.Easy };
    const result = filterProblems(problems, filters);

    expect(result).toHaveLength(1);
    expect(result[0].difficulty).toBe(Difficulty.Easy);
  });

  it('filters by hints used', () => {
    const filters: ProblemFilters = { hintsUsed: 'leetcode_hint' };
    const result = filterProblems(problems, filters);

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('three-sum');
  });

  it('filters by score threshold (greater than)', () => {
    const filters: ProblemFilters = {
      scoreComparison: 'greater',
      scoreThreshold: 80,
      includeNoFeedback: false,
    };
    const result = filterProblems(problems, filters);

    expect(result).toHaveLength(1);
    expect(result[0].latestScore).toBeGreaterThanOrEqual(80);
  });

  it('filters by score threshold (less than)', () => {
    const filters: ProblemFilters = {
      scoreComparison: 'less',
      scoreThreshold: 60,
      includeNoFeedback: false,
    };
    const result = filterProblems(problems, filters);

    expect(result).toHaveLength(1);
    expect(result[0].latestScore).toBeLessThanOrEqual(60);
  });

  it('excludes problems without feedback when includeNoFeedback is false', () => {
    const filters: ProblemFilters = { includeNoFeedback: false };
    const result = filterProblems(problems, filters);

    expect(result).toHaveLength(2);
    expect(result.every((p) => p.latestScore !== null)).toBe(true);
  });

  it('includes all problems when includeNoFeedback is true', () => {
    const filters: ProblemFilters = { includeNoFeedback: true };
    const result = filterProblems(problems, filters);

    expect(result).toHaveLength(3);
  });
});

describe('getDisplayScore', () => {
  it('returns actual score when feedback exists', () => {
    const solve = createSolve({
      feedback: {
        performance: {
          time_to_solve: 3,
          time_complexity: 'O(n)',
          space_complexity: 'O(1)',
          comments: '',
        },
        code_quality: { readability: 4, correctness: 5, maintainability: 4, comments: '' },
        summary: { final_score: 92, comments: '' },
      },
    });

    const result = getDisplayScore(solve);

    expect(result.score).toBe(92);
    expect(result.isEstimated).toBe(false);
  });

  it('returns estimated score when no feedback', () => {
    const solve = createSolve();

    const result = getDisplayScore(solve);

    expect(result.score).toBe(80);
    expect(result.isEstimated).toBe(true);
  });
});

describe('formatHintLabel', () => {
  it('formats hint types correctly', () => {
    expect(formatHintLabel('none')).toBe('No hints');
    expect(formatHintLabel('leetcode_hint')).toBe('LeetCode Hint');
    expect(formatHintLabel('solution_peek')).toBe('Solution Peek');
    expect(formatHintLabel('gpt_help')).toBe('GPT Help');
    expect(formatHintLabel(undefined)).toBe('No hints');
  });
});
