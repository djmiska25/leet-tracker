import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mapTagsToCategories, fetchProblemCatalog, verifyUser } from './leetcode';
import { Difficulty } from '@/types/types';

/* ------------------------------------------------------------------ */
/*  mapTagsToCategories                                                */
/* ------------------------------------------------------------------ */
describe('mapTagsToCategories', () => {
  it('preserves order of tags', () => {
    const input = ['Array', 'Tree', 'Graph'];
    expect(mapTagsToCategories(input)).toEqual(['Array', 'Tree', 'Graph']);
  });

  it('removes duplicates and empty values', () => {
    const input = ['Array', ' ', 'Array', 'Dynamic Programming', ''];
    expect(mapTagsToCategories(input)).toEqual(['Array', 'Dynamic Programming']);
  });

  it('handles an empty input array', () => {
    expect(mapTagsToCategories([])).toEqual([]);
  });

  it('normalizes tags to title case', () => {
    const input = [
      'array',
      '  sliding   window ',
      'HEAP (PRIORITY QUEUE)',
      'depth-first search',
      'breadth-first search',
    ];

    expect(mapTagsToCategories(input)).toEqual([
      'Array',
      'Sliding Window',
      'Heap (Priority Queue)',
      'Depth-First Search',
      'Breadth-First Search',
    ]);
  });
});

/* ------------------------------------------------------------------ */
/*  fetchProblemCatalog                                                */
/* ------------------------------------------------------------------ */
describe('fetchProblemCatalog', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('parses and maps valid problem data', async () => {
    const mockData = [
      {
        slug: 'two-sum',
        title: 'Two Sum',
        isPaidOnly: false,
        isFundamental: true,
        popularity: 0.9,
        difficulty: Difficulty.Easy,
        topicTags: ['Array', 'Hash Table'],
        likes: 54_000,
        dislikes: 2000,
        description: '<p>desc</p>',
        createdAt: 1746308137,
        updatedAt: 1746309999,
      },
    ];

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const result = await fetchProblemCatalog('https://example.com/data.json');

    expect(result).toEqual([
      {
        slug: 'two-sum',
        title: 'Two Sum',
        isFundamental: true,
        isPaid: false,
        popularity: 0.9,
        difficulty: Difficulty.Easy,
        description: '<p>desc</p>',
        tags: ['Array', 'Hash Table'],
        createdAt: 1746308137,
        updatedAt: 1746309999,
      },
    ]);
  });

  it('throws when HTTP status is not ok', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(fetchProblemCatalog('https://example.com/missing.json')).rejects.toThrow(
      'HTTP 404',
    );
  });
});

/* ------------------------------------------------------------------ */
/*  verifyUser                                                         */
/* ------------------------------------------------------------------ */
describe('verifyUser', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns exists:true with canonical username when API responds with matchedUser', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          matchedUser: {
            username: 'foo',
          },
        },
      }),
    });

    expect(await verifyUser('foo')).toEqual({ exists: true, username: 'foo' });
  });

  it('returns {exists:false} when API returns matchedUser null', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { matchedUser: null } }),
    });

    expect(await verifyUser('bar')).toEqual({ exists: false });
  });

  it('returns {exists:false} when GraphQL error says "That user does not exist."', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        errors: [
          {
            message: 'That user does not exist.',
            locations: [{ line: 3, column: 3 }],
            path: ['matchedUser'],
            extensions: { handled: true },
          },
        ],
        data: { matchedUser: null },
      }),
    });

    expect(await verifyUser('nonexistent')).toEqual({ exists: false });
  });

  it('throws when HTTP status is not ok', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(verifyUser('err')).rejects.toThrow('HTTP 500');
  });

  it('throws other GraphQL errors normally', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        errors: [
          {
            message: 'Some other GraphQL error',
            locations: [{ line: 1, column: 1 }],
            path: ['matchedUser'],
          },
        ],
        data: { matchedUser: null },
      }),
    });

    await expect(verifyUser('erroruser')).rejects.toThrow('Some other GraphQL error');
  });
});
