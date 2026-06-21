import type { Solve, Problem, Category, Difficulty, HintType } from '@/types/types';
import { groupSolvesBySession } from '@/utils/solveGrouping';

/**
 * Represents a problem with aggregated submission data
 */
export interface ProblemWithSubmissions {
  slug: string;
  title: string;
  difficulty?: Difficulty;
  tags?: Category[];
  lastSolved: number; // timestamp of most recent solve
  submissionGroups: Solve[][]; // grouped by session, sorted newest first
  latestScore: number | null; // most recent feedback score (or null if no feedback)
  latestScoreIsEstimated: boolean;
  totalSubmissions: number;
  problem?: Problem; // metadata from catalog
}

/**
 * Filters for the problem list
 */
export interface ProblemFilters {
  category?: string; // "All" or specific category
  difficulty?: Difficulty | 'all';
  hintsUsed?: HintType | 'all';
  scoreComparison?: 'greater' | 'less';
  scoreThreshold?: number;
  includeNoFeedback?: boolean;
}

/**
 * Groups all solves by problem slug and calculates aggregate metadata
 */
export function groupSolvesByProblem(
  solves: Solve[],
  problemCatalog: Map<string, Problem>,
): ProblemWithSubmissions[] {
  if (solves.length === 0) return [];

  // Group by slug
  const bySlug = new Map<string, Solve[]>();
  for (const solve of solves) {
    if (!bySlug.has(solve.slug)) {
      bySlug.set(solve.slug, []);
    }
    bySlug.get(solve.slug)!.push(solve);
  }

  const problems: ProblemWithSubmissions[] = [];

  for (const [slug, slugSolves] of bySlug.entries()) {
    // Group into sessions using existing logic
    const sessions = groupSolvesBySession(slugSolves);

    // Most recent solve (head of first session)
    const mostRecent = sessions[0]?.[0];
    if (!mostRecent) continue;

    // Get latest score from most recent solve
    const latestScore = mostRecent.feedback?.summary?.final_score ?? null;
    const latestScoreIsEstimated = latestScore === null;

    // Get problem metadata
    const problemMeta = problemCatalog.get(slug);

    problems.push({
      slug,
      title: mostRecent.title || slug,
      difficulty: mostRecent.difficulty || problemMeta?.difficulty,
      tags: mostRecent.tags || problemMeta?.tags,
      lastSolved: mostRecent.timestamp,
      submissionGroups: sessions,
      latestScore: latestScore,
      latestScoreIsEstimated,
      totalSubmissions: slugSolves.length,
      problem: problemMeta,
    });
  }

  // Sort by most recently solved
  problems.sort((a, b) => b.lastSolved - a.lastSolved);

  return problems;
}

/**
 * Applies filters to a list of problems
 */
export function filterProblems(
  problems: ProblemWithSubmissions[],
  filters: ProblemFilters,
): ProblemWithSubmissions[] {
  let filtered = [...problems];

  // Category filter
  if (filters.category && filters.category !== 'All') {
    filtered = filtered.filter((p) => p.tags?.includes(filters.category as Category));
  }

  // Difficulty filter
  if (filters.difficulty && filters.difficulty !== 'all') {
    filtered = filtered.filter((p) => p.difficulty === filters.difficulty);
  }

  // Hints filter
  if (filters.hintsUsed && filters.hintsUsed !== 'all') {
    filtered = filtered.filter((p) =>
      p.submissionGroups.some((group) =>
        group.some((solve) => solve.usedHints === filters.hintsUsed),
      ),
    );
  }

  // Score filter
  if (
    filters.scoreThreshold !== undefined &&
    !isNaN(filters.scoreThreshold) &&
    filters.scoreThreshold >= 0
  ) {
    filtered = filtered.filter((p) => {
      if (p.latestScore === null) return filters.includeNoFeedback ?? true;

      return filters.scoreComparison === 'greater'
        ? p.latestScore >= filters.scoreThreshold!
        : p.latestScore <= filters.scoreThreshold!;
    });
  }

  // Include no feedback filter
  if (filters.includeNoFeedback === false) {
    filtered = filtered.filter((p) => p.latestScore !== null);
  }

  return filtered;
}

/**
 * Gets the estimated score for a solve without feedback
 * Following the pattern from the codebase where estimated scores are 80
 */
export function getDisplayScore(solve: Solve): { score: number; isEstimated: boolean } {
  const feedbackScore = solve.feedback?.summary?.final_score;
  if (feedbackScore !== undefined) {
    return { score: feedbackScore, isEstimated: false };
  }
  return { score: 80, isEstimated: true };
}

/**
 * Formats a hint type for display
 */
export function formatHintLabel(hint?: HintType): string {
  if (!hint || hint === 'none') return 'No hints';
  if (hint === 'leetcode_hint') return 'LeetCode Hint';
  if (hint === 'solution_peek') return 'Solution Peek';
  if (hint === 'gpt_help') return 'GPT Help';
  return hint;
}
