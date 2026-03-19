import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadDemoSolves, syncDemoSolves } from './demo';
import { Solve, Problem, Difficulty } from '@/types/types';

const exampleSolves = [
  { slug: 'one', title: 'One', timestamp: 1_600_000_000, status: 'Accepted', lang: 'ts' },
  { slug: 'two', title: 'Two', timestamp: 1_600_000_100, status: 'Accepted', lang: 'ts' },
];

describe('loadDemoSolves', () => {
  beforeEach(() => {
    //   Tue 4 Feb 2025 12:00:00 UTC  →  last Saturday = 1 Feb 2025
    vi.setSystemTime(new Date('2025-02-04T12:00:00Z'));
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => exampleSolves } as Response);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('scales timestamps to the two-week window ending last Saturday', async () => {
    const scaled = await loadDemoSolves();

    expect(scaled).toHaveLength(exampleSolves.length);

    // compute expected range (same algorithm as in loadDemoSolves)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const endDate = new Date(now);
    endDate.setDate(now.getDate() - dayOfWeek - 1); // last Saturday
    endDate.setHours(0, 0, 0, 0); // Set to midnight for consistency

    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 13);

    const newStart = Math.floor(startDate.getTime() / 1000);
    const newEnd = Math.floor(endDate.getTime() / 1000);

    const timestamps = scaled.map((s) => s.timestamp);
    expect(Math.min(...timestamps)).toBeGreaterThanOrEqual(newStart);
    expect(Math.max(...timestamps)).toBeLessThanOrEqual(newEnd);

    // order should be preserved
    const sorted = [...timestamps].sort((a, b) => a - b);
    expect(timestamps).toEqual(sorted);
  });

  it('scales timeline timestamps (snapshots and runs) to match solve timestamps', async () => {
    // Mock data with realistic timeline information (timestamps in ms, solve timestamp in seconds)
    const solveWithTimeline = {
      slug: 'test-timeline',
      title: 'Test Timeline',
      timestamp: 1746696660, // Unix timestamp in seconds
      status: 'Accepted',
      lang: 'python3',
      timeUsed: 300,
      codingJourney: {
        snapshots: [
          { timestamp: 1746696360000, fullCode: 'initial', isCheckpoint: true }, // 5 min before solve (ms)
          { timestamp: 1746696660000, fullCode: 'final', isCheckpoint: true }, // at solve time (ms)
        ],
        snapshotCount: 2,
        totalCodingTime: 300000,
        firstSnapshot: 1746696360000,
        lastSnapshot: 1746696660000,
        hasDetailedJourney: true,
      },
      runEvents: {
        runs: [
          { id: 'run1', startedAt: 1746696510000, statusMsg: 'Wrong Answer', code: 'test' }, // 2.5 min before solve (ms)
          { id: 'run2', startedAt: 1746696630000, statusMsg: 'Accepted', code: 'final' }, // 0.5 min before solve (ms)
        ],
        count: 2,
        firstRun: 1746696510000,
        lastRun: 1746696630000,
        hasDetailedRuns: true,
        _window: { startMs: 1746696360000, endMs: 1746696660000 },
      },
    };

    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [solveWithTimeline] } as Response);

    const scaled = await loadDemoSolves();
    const solve = scaled[0];

    // Verify solve timestamp was scaled
    expect(solve.timestamp).not.toBe(solveWithTimeline.timestamp);

    // Verify timeline timestamps were also scaled
    if (solve.codingJourney && 'snapshots' in solve.codingJourney) {
      const snapshots = solve.codingJourney.snapshots;
      expect(snapshots[0].timestamp).not.toBe(
        solveWithTimeline.codingJourney.snapshots[0].timestamp,
      );
      expect(snapshots[1].timestamp).not.toBe(
        solveWithTimeline.codingJourney.snapshots[1].timestamp,
      );

      // Verify timeline timestamps are reasonable numbers (not NaN or Infinity)
      expect(snapshots[0].timestamp).toBeGreaterThan(0);
      expect(snapshots[1].timestamp).toBeGreaterThan(0);
      expect(Number.isFinite(snapshots[0].timestamp)).toBe(true);
      expect(Number.isFinite(snapshots[1].timestamp)).toBe(true);

      // Verify chronological order is preserved
      expect(snapshots[0].timestamp).toBeLessThanOrEqual(snapshots[1].timestamp);
    }

    if (solve.runEvents && solve.runEvents.runs) {
      const runs = solve.runEvents.runs;
      expect(runs[0].startedAt).not.toBe(solveWithTimeline.runEvents.runs[0].startedAt);
      expect(runs[1].startedAt).not.toBe(solveWithTimeline.runEvents.runs[1].startedAt);

      // Verify run timestamps are reasonable numbers
      expect(runs[0].startedAt).toBeGreaterThan(0);
      expect(runs[1].startedAt).toBeGreaterThan(0);
      expect(Number.isFinite(runs[0].startedAt)).toBe(true);
      expect(Number.isFinite(runs[1].startedAt)).toBe(true);

      // Verify chronological order is preserved (handle null case)
      if (runs[0].startedAt && runs[1].startedAt) {
        expect(runs[0].startedAt).toBeLessThanOrEqual(runs[1].startedAt);
      }
    }
  });

  it('handles single solve without division by zero error', async () => {
    // Mock data with single solve (originalRange would be 0)
    const singleSolve = {
      slug: 'single-test',
      title: 'Single Test',
      timestamp: 1746696660, // Single timestamp
      status: 'Accepted',
      lang: 'python3',
      timeUsed: 300,
    };

    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [singleSolve] } as Response);

    const scaled = await loadDemoSolves();
    const solve = scaled[0];

    // Should not be NaN or Infinity despite originalRange being 0
    expect(Number.isFinite(solve.timestamp)).toBe(true);
    expect(solve.timestamp).toBeGreaterThan(0);
  });
});

describe('syncDemoSolves', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2025-02-04T12:00:00Z'));
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => exampleSolves } as Response);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads demo data when no existing solves', async () => {
    const mockDb = {
      getAllSolves: vi.fn().mockResolvedValue([]),
      getProblem: vi.fn().mockResolvedValue({
        slug: 'test',
        tags: ['Array', 'Hash Table'],
        difficulty: Difficulty.Medium,
      }),
      saveSolve: vi.fn().mockResolvedValue('key'),
      clearSolves: vi.fn().mockResolvedValue(undefined),
    };

    const count = await syncDemoSolves(mockDb);

    expect(count).toBe(2);
    expect(mockDb.getAllSolves).toHaveBeenCalledOnce();
    expect(mockDb.clearSolves).not.toHaveBeenCalled();
    expect(mockDb.saveSolve).toHaveBeenCalledTimes(2);
  });

  it('skips refresh when existing data is fresh (< 30 days)', async () => {
    // Use the mocked date (Feb 4, 2025) minus 10 days
    const mockedNow = new Date('2025-02-04T12:00:00Z');
    const recentTimestamp = mockedNow.getTime() / 1000 - 60 * 60 * 24 * 10; // 10 days ago from mocked time
    const mockDb = {
      getAllSolves: vi.fn().mockResolvedValue([{ slug: 'existing', timestamp: recentTimestamp }]),
      getProblem: vi.fn(),
      saveSolve: vi.fn(),
      clearSolves: vi.fn(),
    };

    const count = await syncDemoSolves(mockDb);

    expect(count).toBe(0);
    expect(mockDb.getAllSolves).toHaveBeenCalledOnce();
    expect(mockDb.clearSolves).not.toHaveBeenCalled();
    expect(mockDb.saveSolve).not.toHaveBeenCalled();
    expect(mockDb.getProblem).not.toHaveBeenCalled();
  });

  it('deletes stale data and reloads when existing data is old (> 30 days)', async () => {
    // Use the mocked date (Feb 4, 2025) minus 35 days
    const mockedNow = new Date('2025-02-04T12:00:00Z');
    const staleTimestamp = mockedNow.getTime() / 1000 - 60 * 60 * 24 * 35; // 35 days ago from mocked time
    const existingSolves: Solve[] = [
      { slug: 'old-one', timestamp: staleTimestamp, status: 'Accepted' } as Solve,
      { slug: 'old-two', timestamp: staleTimestamp + 100, status: 'Accepted' } as Solve,
    ];

    const mockDb = {
      getAllSolves: vi.fn().mockResolvedValue(existingSolves),
      getProblem: vi.fn().mockResolvedValue({
        slug: 'test',
        tags: ['Array'],
        difficulty: Difficulty.Easy,
      }),
      saveSolve: vi.fn().mockResolvedValue('key'),
      clearSolves: vi.fn().mockResolvedValue(undefined),
    };

    const count = await syncDemoSolves(mockDb);

    // Should clear all old solves
    expect(mockDb.clearSolves).toHaveBeenCalledOnce();

    // Should save new demo solves
    expect(count).toBe(2);
    expect(mockDb.saveSolve).toHaveBeenCalledTimes(2);
  });

  it('enriches solves with problem metadata', async () => {
    const mockProblem: Problem = {
      slug: 'one',
      title: 'Problem One',
      tags: ['Array', 'Dynamic Programming'],
      difficulty: Difficulty.Hard,
      description: 'Test problem',
      popularity: 0.8,
      isPaid: false,
      isFundamental: true,
      createdAt: Date.now() / 1000,
    };

    const mockDb = {
      getAllSolves: vi.fn().mockResolvedValue([]),
      getProblem: vi.fn().mockResolvedValue(mockProblem),
      saveSolve: vi.fn().mockResolvedValue('key'),
      clearSolves: vi.fn().mockResolvedValue(undefined),
    };

    await syncDemoSolves(mockDb);

    // Check that saveSolve was called with enriched data
    expect(mockDb.saveSolve).toHaveBeenCalled();
    const firstCallArg = mockDb.saveSolve.mock.calls[0][0];
    expect(firstCallArg).toHaveProperty('tags', mockProblem.tags);
    expect(firstCallArg).toHaveProperty('difficulty', mockProblem.difficulty);
  });

  it('skips solves when problem metadata is not found', async () => {
    const mockDb = {
      getAllSolves: vi.fn().mockResolvedValue([]),
      getProblem: vi.fn().mockResolvedValue(undefined), // Problem not found
      saveSolve: vi.fn().mockResolvedValue('key'),
      clearSolves: vi.fn().mockResolvedValue(undefined),
    };

    const count = await syncDemoSolves(mockDb);

    expect(count).toBe(0);
    expect(mockDb.getProblem).toHaveBeenCalledTimes(2);
    expect(mockDb.saveSolve).not.toHaveBeenCalled();
  });
});
