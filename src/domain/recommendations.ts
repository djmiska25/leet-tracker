import { db } from '../storage/db';
import { Problem, Solve, Category } from '../types/types';
import { CategoryRecommendation, ProblemLite } from '../types/recommendation';

const DEFAULT_QUALITY_SCORE = 0.8;

let _problems: Problem[] = [];
let _solves: Solve[] = [];

let primeDataPromise: Promise<void> | null = null;

/**
 * Ensures that problem and solve data is loaded into memory.
 * Prevents simultaneous calls by using a shared promise.
 */
export async function primeData(): Promise<void> {
  if (primeDataPromise) {
    // If already running, wait for the existing promise
    await primeDataPromise;
    return;
  }

  // Create a shared promise
  primeDataPromise = (async () => {
    const problemsPromise = db.getAllProblems();
    const solvesPromise = db.getAllSolves();

    if (_problems.length === 0) _problems = await problemsPromise;
    if (_solves.length === 0) _solves = await solvesPromise;

    // Clear the shared promise once complete
    primeDataPromise = null;
  })();

  await primeDataPromise;
}

/**
 * Updates the solve data cache.
 */
export async function setSolves(solves: Solve[]): Promise<void> {
  _solves = solves;
}

/**
 * Clears the cached problems and solves.
 */
export function clearCache(): void {
  _problems = [];
  _solves = [];
}

/**
 * Checks if the data is primed (loaded into memory).
 */
export function isPrimed(): boolean {
  return _problems.length > 0 && _solves.length > 0;
}

// ---------------- helpers ----------------

/**
 * Calculates a boost factor based on how long ago a problem was solved.
 * Older solves receive a higher boost, capped at 1.
 */
function recencyBoost(daysAgo: number): number {
  return Math.min(1, daysAgo / 90);
}

/**
 * Samples up to `k` unique items using weighted random selection.
 *  • Weights ≤ 0 are ignored.
 *  • Falls back to simple slice when all weights are non‑positive.
 */
function weightedSample<T>(items: T[], weights: number[], k: number): T[] {
  if (items.length === 0) return [];

  // Build candidate list with positive weights only
  const pool = items.map((item, i) => ({
    item,
    weight: !weights[i] || weights[i] === 0 ? Number.EPSILON : weights[i],
  }));

  const picked: T[] = [];
  while (picked.length < k && pool.length) {
    const total = pool.reduce((sum, c) => sum + c.weight, 0);
    let r = Math.random() * total;
    const idx = pool.findIndex((c) => {
      r -= c.weight;
      return r <= 0;
    });
    // Defensive guard (should never be -1, but just in case)
    const chosen = pool.splice(idx === -1 ? 0 : idx, 1)[0];
    picked.push(chosen.item);
  }

  return picked;
}

// ---------------- public API ----------------

/**
 * Return weighted‑random problem recommendations for a single category.
 */
export async function getCategorySuggestions(
  tag: Category,
  k = 3,
): Promise<CategoryRecommendation> {
  return getSuggestions([tag], {
    k,
    label: tag,
  });
}

/**
 * Return weighted‑random suggestions across the given categories.
 * Tags remain on the problems and the UI decides whether to display them.
 */
export async function getRandomSuggestions(
  tags: Category[],
  k = 3,
): Promise<CategoryRecommendation> {
  return getSuggestions(tags, {
    k,
    label: 'Random',
  });
}

interface BuildOpts {
  k: number;
  label: Category;
}

async function getSuggestions(
  tags: Category[],
  { k, label }: BuildOpts,
): Promise<CategoryRecommendation> {
  if (!isPrimed()) await primeData();

  const tagSet = new Set(tags);
  const nowMs = Date.now();
  const solveMap = new Map<string, Solve[]>();
  for (const s of _solves) {
    if (!s.tags || !s.tags.some((t) => tagSet.has(t))) continue;
    if (!solveMap.has(s.slug)) solveMap.set(s.slug, []);
    solveMap.get(s.slug)!.push(s);
  }

  const fundamentals: Array<[ProblemLite, number]> = [];
  const refresh: Array<[ProblemLite, number]> = [];
  const fresh: Array<[ProblemLite, number]> = [];

  for (const p of _problems) {
    // Filter out problems that don't match the tag or are paid only
    // TODO: Allow a toggle for paid problems in the future
    if (p.isPaid || !p.tags.some((t) => tagSet.has(t))) continue;

    const lite: ProblemLite = {
      slug: p.slug,
      title: p.title,
      difficulty: p.difficulty,
      rating: p.rating,
      popularity: p.popularity,
      isFundamental: p.isFundamental,
      tags: p.tags,
    } as ProblemLite;

    const solved = solveMap.get(p.slug);
    const popularityScore = p.popularity; // already 0‑1

    if (solved && solved.length) {
      // Candidate for refresh
      const latest = solved.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
      const daysAgo = Math.floor((nowMs - latest.timestamp * 1000) / 86_400_000);
      const boost = recencyBoost(daysAgo);

      const qualityEstimate = latest.status === 'Accepted' ? DEFAULT_QUALITY_SCORE : 0;
      const quality =
        latest.feedback?.summary?.final_score !== undefined
          ? latest.feedback.summary.final_score / 100
          : qualityEstimate;

      const refreshScore = (1 - quality) * boost * (0.7 + 0.3 * popularityScore);

      // add lastSolved so UI can show "Last solved …"
      refresh.push([{ ...lite, lastSolved: latest.timestamp }, refreshScore]);
    } else {
      // unsolved → either fundamental or new
      // TODO: consider changing selection to be equal among difficulty levels
      if (p.isFundamental) {
        fundamentals.push([lite, popularityScore + 0.2]);
      } else {
        fresh.push([lite, popularityScore]);
      }
    }
  }

  const pick = (pool: Array<[ProblemLite, number]>) =>
    weightedSample(
      pool.map((x) => x[0]),
      pool.map((x) => x[1]),
      k,
    );

  return {
    tag: label,
    fundamentals: pick(fundamentals),
    refresh: pick(refresh),
    new: pick(fresh),
  };
}
