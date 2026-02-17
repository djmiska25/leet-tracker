import { UserRating } from '../types/types';

/**
 * Glicko-2 Rating System Implementation
 *
 * This module implements the Glicko-2 rating system, an extension of Elo
 * that adds rating deviation (RD) to measure uncertainty and volatility
 * to track rating consistency.
 *
 * References:
 * - Glickman, M. E. (2012). "Example of the Glicko-2 system"
 * - http://www.glicko.net/glicko/glicko2.pdf
 */

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

/** Glicko-2 scale constant (converts between rating scales) */
const GLICKO_SCALE = 173.7178;

/** System volatility constant (constrains volatility changes) */
const TAU = 0.5;

/** Convergence tolerance for iterative calculations */
const EPSILON = 0.000001;

/** Default starting rating (equivalent to Elo 1500) */
const DEFAULT_RATING = 1500;

/** Default starting RD (high uncertainty for new users) */
const DEFAULT_RD = 350;

/** Default starting volatility */
const DEFAULT_VOLATILITY = 0.06;

/** RD for estimated/placeholder ratings */
const ESTIMATED_RD = 200;

/** RD for estimated ratings with very few solves */
const HIGH_ESTIMATED_RD = 250;

/** Base time in minutes for a 1500-rated problem */
const BASE_TIME_MINUTES = 20;

/** Rating period for time decay (in days) */
const RATING_PERIOD_DAYS = 365;

/** Glicko c-parameter for RD increase per rating period */
const C_PARAMETER = 50;

/* -------------------------------------------------------------------------- */
/*                              Helper Functions                              */
/* -------------------------------------------------------------------------- */

/**
 * Convert rating from normal scale to Glicko-2 scale
 */
function toGlickoScale(rating: number): number {
  return (rating - DEFAULT_RATING) / GLICKO_SCALE;
}

/**
 * Convert rating from Glicko-2 scale to normal scale
 */
function fromGlickoScale(glickoRating: number): number {
  return glickoRating * GLICKO_SCALE + DEFAULT_RATING;
}

/**
 * Convert RD from normal scale to Glicko-2 scale
 */
function rdToGlickoScale(rd: number): number {
  return rd / GLICKO_SCALE;
}

/**
 * Convert RD from Glicko-2 scale to normal scale
 */
function rdFromGlickoScale(glickoRd: number): number {
  return glickoRd * GLICKO_SCALE;
}

/**
 * Calculate g(φ) function from Glicko-2 paper
 */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

/**
 * Calculate E(μ, μ_j, φ_j) - expected score function from Glicko-2
 */
function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/* -------------------------------------------------------------------------- */
/*                              Public API                                    */
/* -------------------------------------------------------------------------- */

/**
 * Get conservative lower bound rating (95% confidence interval)
 *
 * Returns rating - 2*RD, representing the lower bound where we're 95%
 * confident the player's true skill is above this value.
 *
 * @param rating - Mean rating
 * @param rd - Rating deviation
 * @returns Lower bound rating (floored at 0)
 */
export function getLowerBoundRating(rating: number, rd: number): number {
  return Math.max(0, Math.round(rating - 2 * rd));
}

/**
 * Get formatted display text for rating with uncertainty
 *
 * @param rating - Mean rating
 * @param rd - Rating deviation
 * @returns Formatted string like "Mean: 1523 ± 87"
 */
export function getRatingDisplayText(rating: number, rd: number): string {
  return `Mean: ${Math.round(rating)} ± ${Math.round(rd)}`;
}

/**
 * Apply time decay to rating deviation based on inactivity
 *
 * Implements standard Glicko RD increase during periods of inactivity:
 * φ' = sqrt(φ² + c² × t)
 * where t is elapsed rating periods and c is the c-parameter.
 *
 * @param userRating - Current user rating with lastUpdated timestamp
 * @param currentTime - Current timestamp in milliseconds
 * @returns Updated rating with decayed RD
 */
export function applyTimeDecay(userRating: UserRating, currentTime: number): UserRating {
  if (!userRating.lastUpdated) {
    // No previous update time, return as-is
    return userRating;
  }

  // Calculate elapsed time in milliseconds
  const elapsedMs = currentTime - userRating.lastUpdated;

  // Convert to rating periods (30 days each)
  const msPerPeriod = RATING_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  const elapsedPeriods = elapsedMs / msPerPeriod;

  // Apply RD increase: φ' = sqrt(φ² + c² × t)
  const rdSquared = userRating.rd * userRating.rd;
  const cSquared = C_PARAMETER * C_PARAMETER;
  const newRd = Math.sqrt(rdSquared + cSquared * elapsedPeriods);

  // Cap RD at DEFAULT_RD (350) to prevent unbounded growth
  const cappedRd = Math.min(newRd, DEFAULT_RD);

  return {
    ...userRating,
    rd: Math.round(cappedRd),
    lastUpdated: currentTime,
  };
}

/**
 * Initialize a new user rating with default values
 */
export function initializeRating(): UserRating {
  return {
    rating: DEFAULT_RATING,
    rd: DEFAULT_RD,
    volatility: DEFAULT_VOLATILITY,
    lastUpdated: Date.now(),
    solveCount: 0,
  };
}

/**
 * Calculate expected score (probability of success) for a user against a problem
 *
 * @param userRating - Current user rating
 * @param problemRating - Problem difficulty rating
 * @returns Probability between 0 and 1
 */
export function calculateExpectedScore(userRating: number, problemRating: number): number {
  const mu = toGlickoScale(userRating);
  const muProblem = toGlickoScale(problemRating);

  // Use a fixed RD for problems (treat as certain)
  const problemRd = 50 / GLICKO_SCALE;

  return E(mu, muProblem, problemRd);
}

/**
 * Calculate partial credit for a solve based on time used vs time limit
 *
 * Scoring:
 * - Within time limit (≤ 1.0×): Full credit (1.0)
 * - Overtime but reasonable (1.0× - 2.0×): Linear decay from 1.0 → 0.3
 * - Excessive overtime (> 2.0×) or failed: Minimal credit (0)
 *
 * @param timeUsed - Actual time taken in seconds
 * @param timeLimit - Allowed time in seconds
 * @param completed - Whether the problem was actually solved
 * @returns Score between 0 and 1.0
 */
export function calculatePartialCredit(
  timeUsed: number,
  timeLimit: number,
  completed: boolean,
): number {
  if (!completed) {
    return 0;
  }

  const ratio = timeUsed / timeLimit;

  if (ratio <= 1.0) {
    // Completed within time limit - full credit
    return 1.0;
  } else if (ratio <= 2.0) {
    // Overtime but not excessive - linear decay from 1.0 to 0.3
    // At 1.5x: 0.65, at 2.0x: 0.3
    return 1.0 - (ratio - 1.0) * 0.7;
  } else {
    // Excessive overtime - minimal credit
    return 0;
  }
}

/**
 * Determine time limit for a problem based on its rating
 *
 * Uses square root scaling so harder problems get proportionally more time,
 * but not linearly (to maintain challenge).
 *
 * Examples (with baseMinutes=20):
 * - Rating 1200: ~15.9 minutes
 * - Rating 1500: 20.0 minutes
 * - Rating 1800: ~21.9 minutes
 * - Rating 2200: ~24.2 minutes
 *
 * @param problemRating - Problem difficulty rating
 * @param baseMinutes - Base time for a 1500-rated problem
 * @returns Time limit in seconds
 */
export function determineTimeLimit(
  problemRating: number,
  baseMinutes: number = BASE_TIME_MINUTES,
): number {
  // Use fixed time limit for all problems (no scaling by difficulty)
  return baseMinutes * 60; // Convert to seconds
}

/**
 * Update user rating based on a solve outcome using Glicko-2 algorithm
 *
 * @param userRating - Current user rating
 * @param problemRating - Problem difficulty rating (unused, kept for API compatibility)
 * @param actualOutcome - Actual score (0.1 to 1.0, from partial credit)
 * @returns Updated user rating
 */
export function updateRating(
  userRating: UserRating,
  _problemRating: number,
  actualOutcome: number,
): UserRating {
  // Apply time decay to RD before update (increases RD based on inactivity)
  const currentTime = Date.now();
  const decayedRating = applyTimeDecay(userRating, currentTime);

  // Convert to Glicko-2 scale
  const mu = toGlickoScale(decayedRating.rating);
  const phi = rdToGlickoScale(decayedRating.rd);
  const sigma = decayedRating.volatility;

  const muJ = toGlickoScale(_problemRating);
  const phiJ = rdToGlickoScale(50); // Treat problem ratings as certain

  // Step 3: Calculate v (estimated variance)
  const gPhiJ = g(phiJ);
  const expectedScore = E(mu, muJ, phiJ);
  const v = 1 / (gPhiJ * gPhiJ * expectedScore * (1 - expectedScore));

  // Step 4: Calculate Δ (improvement)
  const delta = v * gPhiJ * (actualOutcome - expectedScore);

  // Step 5: Determine new volatility σ' using iterative algorithm
  const a = Math.log(sigma * sigma);
  const deltaSquared = delta * delta;
  const phiSquared = phi * phi;

  function f(x: number): number {
    const eX = Math.exp(x);
    const phiSquaredPlusV = phiSquared + v + eX;
    const term1 =
      (eX * (deltaSquared - phiSquared - v - eX)) / (2 * phiSquaredPlusV * phiSquaredPlusV);
    const term2 = (x - a) / (TAU * TAU);
    return term1 - term2;
  }

  // Find σ' using Illinois algorithm
  let A = a;
  let B: number;

  if (deltaSquared > phiSquared + v) {
    B = Math.log(deltaSquared - phiSquared - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) {
      k++;
    }
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);

  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);

    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }

    B = C;
    fB = fC;
  }

  const newSigma = Math.exp(A / 2);

  // Step 6: Update rating deviation to φ*
  const phiStar = Math.sqrt(phiSquared + newSigma * newSigma);

  // Step 7: Update rating and RD
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * gPhiJ * (actualOutcome - expectedScore);

  // Convert back to normal scale
  let newRating = fromGlickoScale(newMu);
  let newRd = rdFromGlickoScale(newPhi);

  // Ensure rating stays within reasonable bounds
  newRating = Math.max(800, Math.min(3500, newRating));
  newRd = Math.max(30, Math.min(350, newRd));

  return {
    rating: Math.round(newRating),
    rd: Math.round(newRd),
    volatility: newSigma,
    lastUpdated: Date.now(),
    solveCount: decayedRating.solveCount + 1,
  };
}

/**
 * Create a placeholder rating from historical solve data
 * Used when we have past solves but no rating yet
 *
 * @deprecated Use initializeRatingsFromHistory instead which produces real ratings
 */
export function createPlaceholderRating(estimatedRating: number, solveCount: number): UserRating {
  // Higher RD (uncertainty) for fewer solves
  const rd = solveCount < 10 ? HIGH_ESTIMATED_RD : ESTIMATED_RD;

  return {
    rating: Math.round(estimatedRating),
    rd,
    volatility: DEFAULT_VOLATILITY,
    lastUpdated: Date.now(),
    solveCount,
  };
}

/**
 * Get time limit for display (formatted string)
 */
export function formatTimeLimit(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (secs === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${secs}s`;
}

/**
 * Event dispatched when ratings are updated
 */
export const RATINGS_UPDATED_EVENT = 'ratings-updated';
