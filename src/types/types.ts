/* eslint-disable no-unused-vars */
// Possible difficulties
export enum Difficulty {
  Easy = 'Easy',
  Medium = 'Medium',
  Hard = 'Hard',
}

export const allCategories = [
  'Counting',
  'Binary Search Tree',
  'Concurrency',
  'Dynamic Programming',
  'Matrix',
  'Memoization',
  'Union Find',
  'Line Sweep',
  'Interactive',
  'Number Theory',
  'Backtracking',
  'Array',
  'Rejection Sampling',
  'Geometry',
  'Randomized',
  'String',
  'Topological Sort',
  'Binary Indexed Tree',
  'String Matching',
  'Enumeration',
  'Binary Tree',
  'Doubly-Linked List',
  'Heap (Priority Queue)',
  'Binary Search',
  'Combinatorics',
  'Bucket Sort',
  'Greedy',
  'Trie',
  'Prefix Sum',
  'Bitmask',
  'Linked List',
  'Depth-First Search',
  'Database',
  'Graph',
  'Divide and Conquer',
  'Tree',
  'Breadth-First Search',
  'Recursion',
  'Shortest Path',
  'Design',
  'Eulerian Circuit',
  'Biconnected Component',
  'Stack',
  'Monotonic Stack',
  'Hash Table',
  'Rolling Hash',
  'Two Pointers',
  'Sorting',
  'Ordered Set',
  'Probability and Statistics',
  'Hash Function',
  'Quickselect',
  'Queue',
  'Strongly Connected Component',
  'Segment Tree',
  'Minimum Spanning Tree',
  'Radix Sort',
  'Math',
  'Monotonic Queue',
  'Merge Sort',
  'Bit Manipulation',
  'Data Stream',
  'Shell',
  'Sliding Window',
  'Simulation',
  'Counting Sort',
  'Game Theory',
  'Iterator',
  'Brainteaser',
  'Reservoir Sampling',
  'Suffix Array',
] as const;

export type Category = (typeof allCategories)[number] | 'Random';

/* -------------------------------------------------------------------------- */
/*                                Problem types                               */
/* -------------------------------------------------------------------------- */

export interface Problem {
  slug: string;
  title: string;
  tags: Category[];
  description: string;
  difficulty: Difficulty;
  rating?: number; // contest-based Elo rating (from zerotrac/leetcode_problem_rating)
  popularity: number; // 0.0–1.0
  isPaid: boolean; // true if problem is paid
  isFundamental: boolean; // infered from ai model
  createdAt: number; // epoch time in seconds
}

/** Shape sometimes returned by the extension for problemDescription enrichment. */
export interface ProblemDescription {
  questionId?: string | number;
  content?: string; // HTML
}

/* -------------------------------------------------------------------------- */
/*                          Extension-enriched structures                     */
/* -------------------------------------------------------------------------- */

/** Detailed submission stats from LeetCode's submissionDetails query. */
export interface SubmissionDetails {
  runtime?: number | string | null;
  memory?: number | string | null;
  runtimeDisplay?: string | null;
  runtimePercentile?: number | null;
  memoryDisplay?: string | null;
  memoryPercentile?: number | null;
  totalCorrect?: number | null;
  totalTestcases?: number | null;
  lastTestcase?: string | null;
  codeOutput?: string | null;
  expectedOutput?: string | null;
  runtimeError?: string | null;
  compileError?: string | null;
  fullCodeOutput?: string | null;
  notes?: string | null;
}

/** Individual code snapshot as captured by the extension. */
export interface CodeSnapshot {
  timestamp: number; // ms
  patchText?: string; // new format (diff-match-patch)
  checksumBefore?: string;
  checksumAfter?: string;
  encodingInfo?: string;
  fullCode?: string; // present for checkpoints
  isCheckpoint?: boolean;
  /** Legacy support (older snapshot format) */
  patch?: string;
}

/** Compact journey summary stored on solves, with optional detail enrichment. */
export interface CodingJourneySummary {
  snapshotCount: number;
  totalCodingTime: number; // ms
  firstSnapshot: number; // ms
  lastSnapshot: number; // ms
  hasDetailedJourney?: boolean;
}

/** Detailed journey including the full snapshot list (provided via inject_webapp.js). */
export interface CodingJourneyDetailed extends CodingJourneySummary {
  snapshots: CodeSnapshot[];
}

export type CodingJourney = CodingJourneySummary | CodingJourneyDetailed;

/** Per-run summary captured from interpret_solution/check network events. */
export interface RunEvent {
  id: string | null;
  startedAt: number | null; // ms since epoch, if available
  statusMsg: string;
  totalCorrect: number | null;
  totalTestcases: number | null;
  runtimeError: string | null;
  lastTestcase: string | null;
  code: string | null;
  compareResult: unknown; // pass-through, structure varies by LC
  runtime: number | string | null;
  memory: number | string | null;
}

/** Run events attached to a submission with the capture window. */
export interface RunEventsSummary {
  count: number;
  firstRun: number; // ms
  lastRun: number; // ms
  hasDetailedRuns?: boolean;
  runs?: RunEvent[];
  _window?: { startMs: number; endMs: number };
}

/* -------------------------------------------------------------------------- */
/*                                   Solve                                    */
/* -------------------------------------------------------------------------- */

// Single user solve attempt
export const HINT_TYPES = ['none', 'leetcode_hint', 'solution_peek', 'gpt_help'] as const;
export type HintType = (typeof HINT_TYPES)[number];
export interface Solve {
  slug: string;
  title: string;
  username?: string; // Optional: added in v3 db migration, used for indexing
  timestamp: number; // epoch time in seconds
  status: string;
  lang: string; // e.g. "python3", "cpp", etc.
  code?: string; // full source code
  difficulty?: Difficulty; // ← optional at first, inferred from Problem DB
  rating?: number; // contest-based Elo rating (from zerotrac/leetcode_problem_rating)
  tags?: Category[]; // ← optional at first, inferred from Problem DB

  /** Time used in seconds (mapped from extension's solveTime). */
  timeUsed?: number;

  usedHints?: HintType;
  notes?: string; // Optional: user notes

  /** Optional LeetCode submission identifier. */
  submissionId?: string;

  /** Optional problem note content captured by the extension. */
  problemNote?: string | null;

  /** Optional structured submission details. */
  submissionDetails?: SubmissionDetails;

  /** Optional coding journey summary or detailed snapshots. */
  codingJourney?: CodingJourney;

  /** Optional captured run events within the solve window. */
  runEvents?: RunEventsSummary;

  /** Structured feedback (manual or AI-generated) */
  feedback?: {
    performance: {
      time_to_solve: number; // 0-5
      time_complexity: string;
      space_complexity: string;
      comments: string;
    };
    code_quality: {
      readability: number; // 0-5
      correctness: number; // 0-5
      maintainability: number; // 0-5
      comments: string;
    };
    summary: {
      final_score: number; // 0-100
      comments: string;
    };
  };
}

// Scoring summary for a category
export interface CategoryScore {
  tag: Category;
  estimatedScore: number; // [0.0–1.0]
  confidence: number; // [0.0–1.0]
  adjustedScore: number; // confidence-weighted score [0.0–1.0]
}

export type GoalMap = Partial<Record<Category, number>>;
export interface GoalProfile {
  id: string; // Unique identifier
  name: string; // User-visible name (e.g. "My Custom Goals")
  username?: string; // Optional: added in v3 db migration, used for indexing
  description?: string; // Optional details
  goals: GoalMap; // Goals by category
  createdAt: string; // epoch time in milliseconds
  isEditable: boolean; // If false, profile is locked(default profile)
}
