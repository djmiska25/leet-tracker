import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../storage/db';
import { Difficulty, Solve } from '../types/types';
import { initApp } from './initApp';
import { syncSolveData } from './syncSolveData';
import { syncProblemCatalog } from './syncProblemCatalog';

vi.mock('../storage/db');
vi.mock('./syncSolveData');
vi.mock('./syncProblemCatalog');

const now = Math.floor(Date.now() / 1000);
const mockSolves: Solve[] = [
  {
    slug: 'p',
    title: 'P',
    timestamp: now,
    status: 'Accepted',
    lang: 'ts',
    difficulty: Difficulty.Easy,
    tags: ['Array'],
  },
];

describe('initApp', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    /* db mocks */
    vi.mocked(db.getUsername).mockResolvedValue('user');
    vi.mocked(db.getAllSolves).mockResolvedValue(mockSolves);
    vi.mocked(db.getCatalogCategories).mockResolvedValue(['Array']);

    /* syncSolveData mock */
    vi.mocked(syncSolveData).mockResolvedValue(0);

    /* syncProblemCatalog mock */
    vi.mocked(syncProblemCatalog).mockResolvedValue();
  });

  afterEach(() => {
    // Always clean up env vars even if test fails
    vi.unstubAllEnvs();
  });

  it('handles missing username path', async () => {
    vi.mocked(db.getUsername).mockResolvedValue(undefined);
    const res = await initApp();
    expect(res).toEqual({
      username: undefined,
      errors: [],
    });
  });

  it('successfully initializes for valid user', async () => {
    const res = await initApp();
    expect(res.username).toBe('user');
    expect(res.errors).toEqual([]);
    expect(syncSolveData).toHaveBeenCalledWith('user');
  });

  it('handles extension unavailable gracefully', async () => {
    const err: any = new Error('Extension unavailable');
    err.code = 'EXTENSION_UNAVAILABLE';
    vi.mocked(syncSolveData).mockRejectedValue(err);

    // Should NOT throw - just return username with no errors
    const res = await initApp();
    expect(res.username).toBe('user');
    expect(res.errors).toEqual([]);
  });

  it('handles unexpected sync errors', async () => {
    vi.mocked(syncSolveData).mockRejectedValue(new Error('Unexpected error'));
    const res = await initApp();
    expect(res.errors).toContain('An unexpected error occurred while loading solve data.');
  });

  it('loads demo data for demo user', async () => {
    vi.stubEnv('VITE_DEMO_USERNAME', 'test-demo-user');
    vi.mocked(db.getUsername).mockResolvedValue('test-demo-user');
    vi.mocked(syncSolveData).mockResolvedValue(5);

    const res = await initApp();
    expect(res.username).toBe('test-demo-user');
    expect(res.errors).toEqual([]);
    expect(syncSolveData).toHaveBeenCalledWith('test-demo-user');
  });

  it('does not block on catalog sync when categories exist', async () => {
    let resolveCatalog: () => void = () => {};
    let catalogResolved = false;
    const catalogPromise = new Promise<void>((resolve) => {
      resolveCatalog = () => {
        catalogResolved = true;
        resolve();
      };
    });
    vi.mocked(syncProblemCatalog).mockReturnValue(catalogPromise);
    vi.mocked(db.getCatalogCategories).mockResolvedValue(['Array']);

    const res = await initApp();

    expect(res.errors).toEqual([]);
    expect(syncProblemCatalog).toHaveBeenCalledTimes(1);
    expect(syncSolveData).toHaveBeenCalledWith('user');
    expect(catalogResolved).toBe(false);

    resolveCatalog();
    await catalogPromise;
  });

  it('blocks on catalog sync when categories are empty', async () => {
    vi.useFakeTimers();
    let categories: string[] = [];
    try {
      vi.mocked(db.getCatalogCategories).mockImplementation(async () => categories);

      const catalogPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          categories = ['Array'];
          resolve();
        }, 200);
      });
      vi.mocked(syncProblemCatalog).mockReturnValue(catalogPromise);

      let initResolved = false;
      const initPromise = initApp().then(() => {
        initResolved = true;
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(initResolved).toBe(false);
      expect(categories).toEqual([]);

      await vi.advanceTimersByTimeAsync(200);
      await initPromise;
      expect(initResolved).toBe(true);

      expect(categories.length).toBeGreaterThan(0);
      expect(syncSolveData).toHaveBeenCalledWith('user');
    } finally {
      vi.useRealTimers();
    }
  });
});
