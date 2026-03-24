import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncProblemCatalog, __resetCatalogPromiseForTests } from './syncProblemCatalog';
import { db } from '@/storage/db';
import { fetchProblemCatalog } from '@/api/leetcode';
import { Difficulty, Problem } from '@/types/types';

vi.mock('@/storage/db');
vi.mock('@/api/leetcode');

const mockProblems: Problem[] = [
  {
    slug: 'two-sum',
    title: 'Two Sum',
    tags: ['Array', 'Hash Table'],
    description: '',
    difficulty: Difficulty.Easy,
    popularity: 0.9,
    isPaid: false,
    isFundamental: true,
    createdAt: Math.floor(Date.now() / 1000) - 100000, // Recent
    updatedAt: Math.floor(Date.now() / 1000) - 100000,
  },
  {
    slug: 'add-two-numbers',
    title: 'Add Two Numbers',
    tags: ['Linked List', 'Math'],
    description: '',
    difficulty: Difficulty.Medium,
    popularity: 0.8,
    isPaid: false,
    isFundamental: false,
    createdAt: Math.floor(Date.now() / 1000) - 200000, // Older
    updatedAt: Math.floor(Date.now() / 1000) - 200000,
  },
];

describe('syncProblemCatalog', () => {
  let withTransactionSpy: any;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllTimers();

    // Mock db methods
    vi.mocked(db.getProblemListLastUpdated).mockResolvedValue(undefined);
    vi.mocked(db.updateSolveMetadataFromCatalog).mockResolvedValue(0);
    vi.mocked(fetchProblemCatalog).mockResolvedValue(mockProblems);

    // Mock withTransaction
    withTransactionSpy = vi.fn(async (_stores, callback) => {
      const mockTx = {
        objectStore: (_name: string) => ({
          put: vi.fn(),
          get: vi.fn(),
        }),
      };
      await callback(mockTx);
    });
    vi.mocked(db.withTransaction).mockImplementation(withTransactionSpy);
  });

  afterEach(() => {
    // Reset the singleton state for test isolation
    __resetCatalogPromiseForTests();
  });

  it('fetches and stores catalog when never loaded before', async () => {
    vi.mocked(db.getProblemListLastUpdated).mockResolvedValue(undefined);

    await syncProblemCatalog();

    expect(fetchProblemCatalog).toHaveBeenCalledTimes(1);
    expect(db.withTransaction).toHaveBeenCalledWith(
      ['problem-list', 'problem-metadata'],
      expect.any(Function),
    );
    expect(db.updateSolveMetadataFromCatalog).toHaveBeenCalledWith(mockProblems);
  });

  it('fetches catalog when stale (older than 24 hours)', async () => {
    const staleTimestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
    vi.mocked(db.getProblemListLastUpdated).mockResolvedValue(staleTimestamp);

    await syncProblemCatalog();

    expect(fetchProblemCatalog).toHaveBeenCalledTimes(1);
    expect(db.withTransaction).toHaveBeenCalled();
  });

  it('skips fetch when catalog is fresh (less than 24 hours)', async () => {
    const freshTimestamp = Date.now() - 1 * 60 * 60 * 1000; // 1 hour ago
    vi.mocked(db.getProblemListLastUpdated).mockResolvedValue(freshTimestamp);

    await syncProblemCatalog();

    expect(fetchProblemCatalog).not.toHaveBeenCalled();
    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(db.updateSolveMetadataFromCatalog).not.toHaveBeenCalled();
  });

  it('only stores new problems created after last update', async () => {
    const lastUpdated = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago
    vi.mocked(db.getProblemListLastUpdated).mockResolvedValue(lastUpdated);

    const newProblem: Problem = {
      slug: 'new-problem',
      title: 'New Problem',
      tags: ['Array'],
      description: '',
      difficulty: Difficulty.Easy,
      popularity: 0.5,
      isPaid: false,
      isFundamental: false,
      createdAt: Math.floor(Date.now() / 1000) - 60, // Very recent
      updatedAt: Math.floor(Date.now() / 1000) - 60,
    };

    const oldProblem: Problem = {
      slug: 'old-problem',
      title: 'Old Problem',
      tags: ['Array'],
      description: '',
      difficulty: Difficulty.Easy,
      popularity: 0.5,
      isPaid: false,
      isFundamental: false,
      createdAt: Math.floor((lastUpdated - 1000) / 1000), // Before last update
      updatedAt: Math.floor((lastUpdated - 1000) / 1000),
    };

    vi.mocked(fetchProblemCatalog).mockResolvedValue([newProblem, oldProblem]);

    // Spy on the objectStore methods to verify what gets saved
    const problemListPutSpy = vi.fn();
    const problemMetadataPutSpy = vi.fn();

    withTransactionSpy.mockImplementation(async (_stores: any, callback: any) => {
      const mockTx = {
        objectStore: (name: string) => {
          if (name === 'problem-list') {
            return { put: problemListPutSpy };
          }
          if (name === 'problem-metadata') {
            return { put: problemMetadataPutSpy };
          }
          return { put: vi.fn() };
        },
      };
      await callback(mockTx);
    });

    await syncProblemCatalog();

    // Verify only the new problem was saved to problem-list
    expect(problemListPutSpy).toHaveBeenCalledWith(newProblem, 'new-problem');
    expect(problemListPutSpy).not.toHaveBeenCalledWith(oldProblem, 'old-problem');

    // Verify lastUpdated metadata was saved
    expect(problemMetadataPutSpy).toHaveBeenCalledWith(expect.any(Number), 'lastUpdated');
  });

  it('stores problems updated after last update', async () => {
    const lastUpdated = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago
    vi.mocked(db.getProblemListLastUpdated).mockResolvedValue(lastUpdated);

    const updatedProblem: Problem = {
      slug: 'updated-problem',
      title: 'Updated Problem',
      tags: ['Array'],
      description: '',
      difficulty: Difficulty.Easy,
      popularity: 0.5,
      isPaid: false,
      isFundamental: false,
      createdAt: Math.floor((lastUpdated - 1000) / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    };

    const unchangedProblem: Problem = {
      slug: 'unchanged-problem',
      title: 'Unchanged Problem',
      tags: ['Array'],
      description: '',
      difficulty: Difficulty.Easy,
      popularity: 0.5,
      isPaid: false,
      isFundamental: false,
      createdAt: Math.floor((lastUpdated - 1000) / 1000),
      updatedAt: Math.floor((lastUpdated - 1000) / 1000),
    };

    vi.mocked(fetchProblemCatalog).mockResolvedValue([updatedProblem, unchangedProblem]);

    const problemListPutSpy = vi.fn();
    const problemMetadataPutSpy = vi.fn();

    withTransactionSpy.mockImplementation(async (_stores: any, callback: any) => {
      const mockTx = {
        objectStore: (name: string) => {
          if (name === 'problem-list') {
            return { put: problemListPutSpy };
          }
          if (name === 'problem-metadata') {
            return { put: problemMetadataPutSpy };
          }
          return { put: vi.fn() };
        },
      };
      await callback(mockTx);
    });

    await syncProblemCatalog();

    expect(problemListPutSpy).toHaveBeenCalledWith(updatedProblem, 'updated-problem');
    expect(problemListPutSpy).not.toHaveBeenCalledWith(unchangedProblem, 'unchanged-problem');
    expect(problemMetadataPutSpy).toHaveBeenCalledWith(expect.any(Number), 'lastUpdated');
  });

  it('stores problems without updatedAt using createdAt', async () => {
    const lastUpdated = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago
    vi.mocked(db.getProblemListLastUpdated).mockResolvedValue(lastUpdated);

    const newProblem: Problem = {
      slug: 'created-only-new',
      title: 'Created Only New',
      tags: ['Array'],
      description: '',
      difficulty: Difficulty.Easy,
      popularity: 0.5,
      isPaid: false,
      isFundamental: false,
      createdAt: Math.floor(Date.now() / 1000),
    };

    const oldProblem: Problem = {
      slug: 'created-only-old',
      title: 'Created Only Old',
      tags: ['Array'],
      description: '',
      difficulty: Difficulty.Easy,
      popularity: 0.5,
      isPaid: false,
      isFundamental: false,
      createdAt: Math.floor((lastUpdated - 1000) / 1000),
    };

    vi.mocked(fetchProblemCatalog).mockResolvedValue([newProblem, oldProblem]);

    const problemListPutSpy = vi.fn();
    const problemMetadataPutSpy = vi.fn();

    withTransactionSpy.mockImplementation(async (_stores: any, callback: any) => {
      const mockTx = {
        objectStore: (name: string) => {
          if (name === 'problem-list') {
            return { put: problemListPutSpy };
          }
          if (name === 'problem-metadata') {
            return { put: problemMetadataPutSpy };
          }
          return { put: vi.fn() };
        },
      };
      await callback(mockTx);
    });

    await syncProblemCatalog();

    expect(problemListPutSpy).toHaveBeenCalledWith(newProblem, 'created-only-new');
    expect(problemListPutSpy).not.toHaveBeenCalledWith(oldProblem, 'created-only-old');
    expect(problemMetadataPutSpy).toHaveBeenCalledWith(expect.any(Number), 'lastUpdated');
  });

  it('handles fetch errors gracefully (does not throw)', async () => {
    vi.mocked(fetchProblemCatalog).mockRejectedValue(new Error('Network error'));

    // syncProblemCatalog catches errors internally and does not throw
    await expect(syncProblemCatalog()).resolves.toBeUndefined();
  });

  it('uses singleton pattern - concurrent calls wait for same operation', async () => {
    let resolvePromise: () => void;
    const delayedPromise = new Promise<Problem[]>((resolve) => {
      resolvePromise = () => resolve(mockProblems);
    });

    vi.mocked(fetchProblemCatalog).mockReturnValue(delayedPromise);

    // Start multiple syncs concurrently
    const promise1 = syncProblemCatalog();
    const promise2 = syncProblemCatalog();
    const promise3 = syncProblemCatalog();

    // Resolve the fetch
    resolvePromise!();
    await Promise.all([promise1, promise2, promise3]);

    // Should only have called fetch once despite 3 concurrent calls
    expect(fetchProblemCatalog).toHaveBeenCalledTimes(1);
  });

  it('allows new sync after previous sync completes', async () => {
    await syncProblemCatalog();
    expect(fetchProblemCatalog).toHaveBeenCalledTimes(1);

    // Clear the stale check by providing undefined to force refetch
    vi.mocked(db.getProblemListLastUpdated).mockResolvedValue(undefined);

    // Second call should work (new operation)
    await syncProblemCatalog();
    expect(fetchProblemCatalog).toHaveBeenCalledTimes(2);
  });

  it('allows retry after failed sync', async () => {
    vi.mocked(fetchProblemCatalog).mockRejectedValueOnce(new Error('First error'));

    // First sync fails but doesn't throw (catches internally)
    await syncProblemCatalog();
    expect(fetchProblemCatalog).toHaveBeenCalledTimes(1);

    // Second call should retry (singleton cleared after first attempt)
    vi.mocked(fetchProblemCatalog).mockResolvedValueOnce(mockProblems);
    await syncProblemCatalog();
    expect(fetchProblemCatalog).toHaveBeenCalledTimes(2);
  });

  it('updates lastUpdated timestamp in metadata', async () => {
    const putSpy = vi.fn().mockResolvedValue(undefined);

    vi.mocked(db.withTransaction).mockImplementation(async (_stores: any, callback: any) => {
      const mockTx = {
        objectStore: (_name: string) => ({
          put: putSpy,
        }),
      };
      await callback(mockTx);
    });

    await syncProblemCatalog();

    // Verify lastUpdated was set
    const calls = putSpy.mock.calls;
    const metadataCalls = calls.filter((call) => call[1] === 'lastUpdated');
    expect(metadataCalls.length).toBe(1);
    expect(typeof metadataCalls[0][0]).toBe('number');
  });
});
