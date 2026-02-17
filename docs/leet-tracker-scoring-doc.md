# Leet Tracker: Scoring Algorithm Deep Dive

This document is a technical supplement to the Leet Tracker README, providing a comprehensive explanation of how the category scoring algorithm works, the rationale behind its design, and how it can be tuned or extended to improve accuracy in the future. For context, this algorithm is responsible for the visual aid to help users identify their skill level in a specific category and is used to help prioritize specific categories for refreshing their skills.

**Source**: [`evaluateCategoryProgress`](../src/domain/progress.ts)

---

## Glossary

- **Solve**: A successful solution submission to a LeetCode problem, recorded with metadata such as difficulty, category, timestamp, and language.
- **Category**: One or more tags associated with a problem, such as "Array", "Graph", or "Dynamic Programming".
- **Difficulty**: The LeetCode-defined level of challenge for a problem: Easy, Medium, or Hard.
- **Timestamp**: Unix timestamp representing when the problem was solved.
- **Attempts**: The number of tries a user needed before submitting a successful solution.
- **Recency Decay**: A time-based weighting factor that reduces the score contribution of older solves.
- **Weight**: A per-problem measure of how strongly that solve should count toward category mastery, based on recency and difficulty.
- **Quality Score**: A per-solve multiplier (default 0.8) which can optionally reflect subjective quality.
- **Adjusted Quality**: The solve's quality multiplied by an attempt penalty.
- **Total Evidence**: The sum of all solve weights in a category. This determines confidence.
- **Total Easy Equivalent Evidence**: The sum of all decayed weights, treating all solves as Easy-level (weight = decay × 1.0). Used to normalize estimated score.
- **Confidence Level**: A final category-level value between 0 and 1 that represents our overall confidence in the accuracy of the estimated score, based on total evidence.
- **Glicko-2 Rating**: A skill rating system (similar to chess Elo) that tracks per-category performance on a scale of ~800-3000+, with rating deviation (uncertainty) and volatility measures.
- **Goal Profile**: A set of target ratings for categories (e.g., "Amazon" profile targets 1700 for Arrays, 1500 for DP), used to track interview preparation progress.

---

## Rating Systems Overview

Leet Tracker uses **two complementary systems** to measure your progress:

### 1. Progress Scores (0-1 scale)

**Purpose:** Confidence-weighted mastery visualization for recommendations and progress tracking.

This is the system described in detail below. It produces a 0-1 score for each category based on:

- Weighted solve quality (adjusted by attempts)
- Recency decay (90-day linear)
- Difficulty weighting
- Confidence level (based on evidence volume)

**Use cases:**

- Driving the recommendation engine (Fundamentals, Refresh, New)
- Visualizing category mastery as a percentage
- Identifying weak areas that need practice

### 2. Glicko-2 Ratings (800-3000+ scale)

**Purpose:** Skill level tracking and goal setting using a robust statistical rating system.

Glicko-2 is an extension of the Elo rating system that adds:

- **Rating (μ):** Mean skill estimate (default: 1500)
- **Rating Deviation (RD):** Uncertainty in the rating (decreases with more solves, increases with inactivity)
- **Volatility (σ):** Expected rating fluctuation

**Rating ranges:**

- **~800-1300:** Beginner / Easy problems
- **~1500-1700:** Medium difficulty proficiency
- **~1700-1900:** Medium-Hard proficiency
- **~1900-2200:** Hard problem proficiency
- **~2200+:** Expert level

**Use cases:**

- Goal profiles (e.g., "Amazon" targets 1700 for key categories)
- Tracking skill progression over time
- Comparing your skill level against problem difficulties

**Relationship:** Progress scores help you know _what_ to practice, while ratings tell you _how skilled_ you are.

---

## Goal

The scoring algorithm in Leet Tracker is designed to:

1. Estimate a user's **skill level per category** based on recent LeetCode solves.
2. Weight solves based on difficulty, recency, and confidence.
3. Reflect not only volume of practice but _quality_ of solves.
4. Decay over time to reflect skill rust and need for refresh.

---

## Key Concepts

### Score Definition

Each category score represents a confidence-weighted, decay-aware estimate of user mastery in that category. It is a number between 0 and 1, normalized against a suggested solve count (20).

### Score Inputs per Solve

Each solve contributes to the score with the following inputs:

- **Difficulty Weight:** Easy = 1.0, Medium = 1.2, Hard = 1.5
- **Recency Decay:** Linear decay from 1 → 0 over 90 days
- **Attempt Penalty:** Clean solves receive more weight than ones with multiple failed attempts

The weighted contribution of a single solve is:

```
weight = difficulty_weight × recency_decay
adjusted_quality = quality × attempt_penalty
```

These contribute to two separate aggregates:

```
totalScore += adjusted_quality × weight
totalEvidence += weight
totalEasyEquivalentEvidence += recency_decay × 1.0
```

The category score is calculated as:

```
estimated = totalScore / totalEasyEquivalentEvidence
confidence = min(1, totalEvidence / SUGGESTED_CATEGORY_SOLVES)
adjustedScore = estimated × confidence
```

Fundamentally, this is a **weighted average**, where each solve is treated as a vote for your category skill level, scaled by how much that vote should count. This approach ensures that newer, harder, and more confidently solved problems contribute more to the estimate.

---

## Functions and Intuition

### Recency Decay

```ts
function recencyDecay(daysAgo: number): number {
  return Math.max(0, 1 - daysAgo / 90);
}
```

This linear decay ensures a solve 90+ days old has no impact. Recently practiced topics retain high influence.

### Attempt Penalty

```ts
function getAttemptPenalty(attempts: number): number {
  if (attempts === 0) return 1.0;
  if (attempts === 1) return 0.9;
  if (attempts <= 3) return 0.7;
  return 0.5;
}
```

Multiple failed attempts reduce quality confidence. This rewards clean solves and encourages repeated review.

### Weighted Average Intuition

Imagine three problems with different weights and quality scores:

| Problem | Adjusted Quality | Weight |
| ------- | ---------------- | ------ |
| A       | 1.0              | 1.0    |
| B       | 0.5              | 2.0    |
| C       | 0.8              | 1.5    |

Compute contributions:

```
totalScore = (1.0×1.0) + (0.5×2.0) + (0.8×1.5) = 3.2
totalWeight = 1.0 + 2.0 + 1.5 = 4.5
estimatedScore = totalScore / totalWeight ≈ 0.711
```

This is a classic weighted average. The adjustedScore is further scaled down based on confidence.

---

## Full Walkthrough

### Example Input Data

```json
[
  {
    "slug": "merge-k-sorted-lists",
    "category": ["Heap"],
    "difficulty": "Hard",
    "timestamp": 1745600000,
    "status": "Accepted",
    "lang": "python3",
    "attempts": 4
  },
  {
    "slug": "kth-largest-element-in-an-array",
    "category": ["Heap"],
    "difficulty": "Medium",
    "timestamp": 1745700000,
    "status": "Accepted",
    "lang": "python3",
    "attempts": 2
  },
  {
    "slug": "last-stone-weight",
    "category": ["Heap"],
    "difficulty": "Easy",
    "timestamp": 1745800000,
    "status": "Accepted",
    "lang": "python3",
    "attempts": 1
  }
]
```

### Step-by-Step Calculation for "Heap" Category

Assume current time is `1745900000`:

| Problem                      | Diff   | DaysAgo | Decay | Diff Wt | Failed Attempts | Penalty | Quality | Adj. Q | Weight | Contribution |
| ---------------------------- | ------ | ------- | ----- | ------- | --------------- | ------- | ------- | ------ | ------ | ------------ |
| merge-k-sorted-lists         | Hard   | 30      | 0.67  | 1.5     | 4               | 0.5     | 0.8     | 0.4    | 1.005  | 0.402        |
| kth-largest-element-in-array | Medium | 20      | 0.78  | 1.2     | 2               | 0.7     | 0.8     | 0.56   | 0.936  | 0.524        |
| last-stone-weight            | Easy   | 10      | 0.89  | 1.0     | 1               | 0.9     | 0.8     | 0.72   | 0.89   | 0.648        |

**Final Aggregates**:

```
totalScore = 0.402 + 0.524 + 0.648 = 1.574
totalEvidence = 1.005 + 0.936 + 0.89 = 2.831
totalEasyEquivalentEvidence = 0.67 + 0.78 + 0.89 = 2.34
```

```
estimated = 1.574 / 2.34 ≈ 0.672
confidence = 2.831 / 20 ≈ 0.141
adjustedScore = 0.672 × 0.141 ≈ 0.095
```

---

## Design Tradeoffs

- **Confidence threshold** is set at 20 weighted solves to reflect a baseline for meaningful category insights. It is mostly an arbitrary number. It could easily be adjusted as needs evolve.
- Linear **recency decay** (from 1 to 0 over 90 days) is simple, interpretable, and easy to implement. Alternatives like exponential decay were considered but add complexity without clear gain.
- **Clean solves** are rewarded through the attempt penalty, ensuring we value learning efficiency and not just brute-force persistence. This is done through grouping problem solves into **sessions** (defined by a 4-hour inactivity gap), effectively capturing coding "sprints" regardless of timezone or midnight boundaries.
- **Varied, recent practice** yields higher scores than older or repeated problem attempts, aligning with modern understanding of learning retention. One limitation is that the model does not _yet_ consider that if a user has a solid solve history, then regaining mastery is easier with fewer attempts in the future.
- Confidence is based on **total weight**, not solved count—emphasizing the _depth_ of experience via harder or more recent problems.
- Evidence is normalized to **Easy-equivalent solves** for consistent interpretation across users.
