import { Difficulty, Solve } from '../types/types';
import { CategoryProgress } from '../types/progress';
import { groupSolvesBySession } from '../utils/solveGrouping';
import { ESTIMATED_RATINGS } from './problemRatings';

const DEFAULT_QUALITY_SCORE = 0.8;
const SUGGESTED_CATEGORY_SOLVES = 20;

/**
 * Difficulty weight derived from the problem's contest rating.
 * Normalised so that a rating of ~1300 (Easy baseline) maps to 1.0
 * and higher ratings yield proportionally more weight.
 */
function ratingToWeight(rating: number): number {
  return Math.max(0.5, rating / ESTIMATED_RATINGS[Difficulty.Easy]);
}

function recencyDecay(daysAgo: number): number {
  return Math.max(0, 1 - daysAgo / 90);
}

function getAttemptPenalty(attempts: number): number {
  if (attempts === 0) return 1.0;
  if (attempts === 1) return 0.9;
  if (attempts <= 3) return 0.7;
  return 0.5;
}

/**
 * Compute confidence‑weighted progress metrics for a single category.
 */
export function evaluateCategoryProgress(solves: Solve[]): Omit<CategoryProgress, 'tag' | 'goal'> {
  if (solves.length === 0) {
    return { estimatedScore: 0, confidenceLevel: 0, adjustedScore: 0 };
  }

  // Group by session (4h gap) instead of calendar day
  const sessions = groupSolvesBySession(solves.filter((s) => !!s.timestamp));

  let totalScore = 0;
  let totalEvidence = 0;
  let totalEasyEquivalentEvidence = 0;
  const nowMs = Date.now();

  for (const attempts of sessions) {
    const accepted = attempts.filter((s) => s.status === 'Accepted');
    if (accepted.length === 0) continue;

    const latest = accepted.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
    const failedAttempts = attempts.filter((s) => s.status !== 'Accepted').length;

    const daysAgo = Math.floor((nowMs - latest.timestamp * 1000) / 86_400_000);
    const decay = recencyDecay(daysAgo);
    const rating = latest.rating ?? ESTIMATED_RATINGS[latest.difficulty ?? Difficulty.Easy];
    const diffWeight = ratingToWeight(rating);
    const attemptPenalty = getAttemptPenalty(failedAttempts);

    const quality =
      latest.feedback?.summary?.final_score !== undefined
        ? latest.feedback.summary.final_score / 100
        : DEFAULT_QUALITY_SCORE;

    const adjustedQuality = quality * attemptPenalty;

    const weight = decay * diffWeight;
    totalScore += adjustedQuality * weight;
    totalEvidence += weight;
    totalEasyEquivalentEvidence += decay * 1.0;
  }

  const estimated = totalEasyEquivalentEvidence > 0 ? totalScore / totalEasyEquivalentEvidence : 0;
  const confidence = Math.min(1, totalEvidence / SUGGESTED_CATEGORY_SOLVES);
  const adjusted = Math.min(1, estimated * confidence);

  return {
    estimatedScore: Math.round(Math.min(1, estimated) * 100) / 100,
    confidenceLevel: Math.round(confidence * 100) / 100,
    adjustedScore: Math.round(adjusted * 100) / 100,
  };
}
