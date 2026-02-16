import { db } from '../storage/db';
import type {
  Solve,
  CodingJourney,
  CodingJourneyDetailed,
  CodeSnapshot,
  RunEventsSummary,
  RunEvent,
  Problem,
} from '@/types/types';
import { reconstructWithCache, type ReconCache } from './timelineProcessing';

/**
 * Max tokens for the prompt. Configurable via env, default 32768.
 * We conservatively estimate 1 token ≈ 4 characters.
 */
const MAX_TOKENS =
  Number.parseInt((import.meta as any).env?.VITE_FEEDBACK_MAX_TOKENS ?? '32768', 10) || 32768;

/** Approximate tokens using ~4 characters/token (conservative). */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Truncate a string to an approximate token budget. */
function truncateToTokens(text: string, tokens: number): string {
  if (!text || tokens <= 0) return '';
  const maxChars = tokens * 4;
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.7);
  const tail = Math.max(0, maxChars - head - 20); // room for marker
  return `${text.slice(0, head)}\n/* …omitted… */\n${tail > 0 ? text.slice(-tail) : ''}`;
}

/** Nicely format seconds → human text for prompts. */
function formatTimeUsed(sec?: number): string {
  if (!sec || sec <= 0) return 'Not specified';
  const min = Math.round(sec / 60);
  return min < 60 ? `${min} min` : `${(min / 60).toFixed(1)} h`;
}

/** Convert epoch ms → readable UTC ISO without milliseconds for compactness. */
function iso(tsMs: number | null | undefined): string {
  if (!tsMs || tsMs <= 0) return 'unknown';
  const d = new Date(tsMs);
  return `${d.toISOString().replace('.000Z', 'Z')}`;
}

/* -------------------------------------------------------------------------- */
/*                 Timeline assembly and budgeting strategy                    */
/* -------------------------------------------------------------------------- */

interface TimelineSnapshot {
  kind: 'snapshot';
  idx: number;
  timestamp: number;
  includeCode: boolean;
  patchIncluded?: string; // final patch text included in prompt (possibly truncated)
  patchTokens?: number; // tokens counted for included patch
  note?: string;
  reconstructedCode?: string;
}

interface TimelineRun {
  kind: 'run';
  timestamp: number | null;
  run: RunEvent;
  codeIncluded?: string; // final code included for run (possibly truncated)
  codeTokens?: number;
}

/** Evenly distribute `count` picks across the candidate indices array. */
function pickEvenly(candidates: number[], count: number): number[] {
  if (count <= 0 || candidates.length === 0) return [];
  if (count >= candidates.length) return [...candidates];
  const picks: number[] = [];
  const step = candidates.length / count;
  for (let i = 0; i < count; i++) picks.push(Math.floor(i * step));
  return [...new Set(picks.map((i) => candidates[i]))];
}

/** Utility to shorten large code blocks if needed (rare, conservational). */
function maybeTruncateCode(code: string, maxChars = 10000): string {
  if (!code || code.length <= maxChars) return code || '';
  const head = Math.floor(maxChars * 0.6);
  const tail = maxChars - head;
  return `${code.slice(0, head)}\n/* …omitted… */\n${code.slice(-tail)}`;
}

/** Extract the raw patch text for a snapshot, if any. */
function rawPatchText(s: CodeSnapshot): string {
  if (typeof s.patchText === 'string' && s.patchText.length) return s.patchText;
  if (typeof s.patch === 'string' && s.patch.length) return s.patch;
  return '';
}

/* -------------------------------------------------------------------------- */
/*                              Prompt Builder                                 */
/* -------------------------------------------------------------------------- */

/**
 * Build a rich feedback prompt:
 * - Header (instructions + metadata)
 * - Timeline (snapshots/runs if available; otherwise note absence)
 * - Solve details + final code
 * - Problem description (reference)
 *
 * Budgeting:
 * 1) Base (header + final code + problem desc)
 * 2) Add all run codes (truncated) into the budget
 * 3) Allocate remaining to patches (prefer including all; evenly truncate if needed)
 * 4) With remaining budget, add evenly distributed full-code reconstructions
 */
export async function buildFeedbackPrompt(solve: Solve): Promise<string> {
  // Problem details
  const problem: Problem | undefined = await db.getProblem(solve.slug).catch(() => undefined);

  // Final submission code
  const finalCode = solve.code ?? '';
  const finalCodeSection = finalCode
    ? `\n### Final Submitted Code\n\`\`\`\n${maybeTruncateCode(finalCode)}\n\`\`\`\n`
    : `\n### Final Submitted Code\nNo final code was captured.\n`;

  // Journey & runs
  const cj: CodingJourney | undefined = solve.codingJourney;
  const runsSummary: RunEventsSummary | undefined = solve.runEvents;
  const runs: RunEvent[] | undefined = runsSummary?.runs ?? undefined;

  const hasDetailedJourney =
    cj &&
    (cj as CodingJourneyDetailed).snapshots &&
    Array.isArray((cj as CodingJourneyDetailed).snapshots);

  const snapshots: CodeSnapshot[] = hasDetailedJourney
    ? [...(cj as CodingJourneyDetailed).snapshots].sort(
        (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0),
      )
    : [];

  // ---------------- Base scaffold (no timeline yet) ----------------
  const headerParts: string[] = [];
  headerParts.push(
    [
      `You are a seasoned algorithms mentor and coding interview coach.`,
      `You may be given a user's LeetCode submission details along with a timeline of their coding journey and run attempts (if available).`,
      `Analyze the behavior chronologically when the timeline is present and provide constructive, **actionable** guidance. If the timeline is not present, infer process from the final submission, any runtime/memory stats, and comments—be explicit about uncertainty.`,
      ``,
      `### Scoring Rubric & Anchors (Use this consistently)`,
      ``,
      `Rate each core dimension 0-5, then compute final_score per the formula below.`,
      ``,
      `Field Formats (for XML at the end):`,
      `- time_to_solve: integer 0-5 (how efficiently solved)`,
      `- readability: integer 0-5 (code clarity and style)`,
      `- correctness: integer 0-5 (solution accuracy)`,
      `- maintainability: integer 0-5 (code organization and extensibility)`,
      `- time_complexity: string(score: complexity) (e.g., "5: O(n)", "5: O(log n)", "3: O(n²)")`,
      `- space_complexity: string(score: complexity) (e.g., "5: O(1)", "4: O(n)", "2: O(n log n)")`,
      `- final_score: integer 0-100 (overall performance)`,
      ``,
      `### Rubric Details`,
      ``,
      `Time to Solve (0-5)`,
      `- Baselines: Easy 5-15m, Medium 15-35m, Hard 35-75m (guideline).`,
      `- 5: Fast for difficulty; few runs; no hint reliance.`,
      `- 4: Reasonably fast; a few runs or minor hint usage.`,
      `- 3: Average/slightly slow; multiple runs or small thrash.`,
      `- 2: Slow; heavy thrash or several failing runs.`,
      `- 1: Very slow; frequent compile/runtime errors.`,
      `- 0: No viable progress.`,
      ``,
      `Correctness (0-5)`,
      `- 5: Accepted; robust; edge cases handled; minimal earlier errors.`,
      `- 4: Accepted with minor issues or brief earlier errors.`,
      `- 3: Accepted but fragile OR partially correct (some failing tests).`,
      `- 2: Partially correct with frequent failures.`,
      `- 1: Mostly incorrect.`,
      `- 0: Did not compile / no meaningful execution.`,
      ``,
      `Readability (0-5)`,
      `- 5: Clear names/structure; idiomatic; minimal noise.`,
      `- 4: Mostly clean; small issues.`,
      `- 3: Understandable but messy/verbose spots.`,
      `- 2: Hard to follow; poor naming/structure.`,
      `- 1: Very hard to read; inconsistent style.`,
      `- 0: Unreadable.`,
      ``,
      `Maintainability (0-5)`,
      `- 5: Well-factored (helpers/invariants), low duplication, clear responsibilities.`,
      `- 4: Generally solid; minor improvements possible.`,
      `- 3: Some decomposition; noticeable duplication/ad-hoc fixes.`,
      `- 2: Monolithic/brittle; magic numbers; weak edge handling.`,
      `- 1: Tightly coupled; fragile.`,
      `- 0: Unmaintainable.`,
      ``,
      `Algorithmic Efficiency (0-5)`,
      `- 5: Matches optimal time/space for the standard pattern (e.g., O(n log n) when appropriate, minimal extra space).`,
      `- 4: Near-optimal with minor constant or space overhead.`,
      `- 3: Workable but clearly sub-optimal vs. known solutions.`,
      `- 2: Wrong leading complexity or avoidable overhead for key steps.`,
      `- 1: Severe blow-ups (e.g., quadratic where linear is standard).`,
      `- 0: Exponential/backtracking where polynomial is known; wrong data structure choice.`,
      ``,
      `Process Subscore (0-5) — from the Timeline (snapshots & runs, if available)`,
      `- When timeline is available:`,
      `  - 5: Plans before running; purposeful iterations; targeted tests; few compile errors.`,
      `  - 4: Some planning; iterations mostly purposeful.`,
      `  - 3: Mixed; some thrash; visible course-corrections.`,
      `  - 2: Frequent thrash; many runs without clear improvements.`,
      `  - 1: Guess-and-check; repeated identical errors.`,
      `  - 0: No coherent process.`,
      `- When timeline is not available: estimate from submission details and final code quality;`,
      `  use neutral 3 if truly unknown and state uncertainty.`,
      ``,
      `Penalties (negative only, bounded total -8)`,
      `- Hint usage (0 to -5): none (0); LeetCode hint (-1); GPT help (-3); solution peek (-5).`,
      `- Error thrash (0 to -3): repeated compile/runtime loops or identical failures.`,
      ``,
      `Final Score (0-100):`,
      `final_score = clamp_0_100(`,
      `  20 * (time_to_solve / 5) +`,
      `  30 * (correctness / 5) +`,
      `  15 * (readability / 5) +`,
      `  15 * (maintainability / 5) +`,
      `  10 * (process_subscore / 5) +`,
      `  10 * (algorithmic_efficiency / 5) +`,
      `  penalties   // negative only, see above`,
      `)`,
      ``,
      `Also provide:`,
      `- time_complexity: e.g., "O(n log n)"`,
      `- space_complexity: e.g., "O(1)"`,
      `- Comments fields: concise, actionable bullets.`,
      ``,
      `Follow the rubric above strictly so scores are comparable across problems.`,
      ``,
      `### What to return (in this EXACT order):`,
      `1) **Strategy Timeline Summary (if available)** — What happened chronologically; highlight key decisions, pivots, and where time was spent. If no timeline is present, briefly infer likely strategy from the submission/stats and call out uncertainty.`,
      `2) **How to Improve Faster** — Specific feedback on how the user could reach an optimal solution sooner; common mistakes/misconceptions to address; concrete strategies to improve speed and efficiency for this and similar problems.`,
      `3) **Final Submission Review** — Critique of the final code and outcome (including any runtime/memory stats); correctness, complexity, clarity, and potential refactors.`,
      `4) **Legacy XML (at the very end)** — Include the XML block used by the app with the most important points echoed in the comments that the user can carry with them in future problems:`,
      '   Return exactly one code block containing:',
      '   <feedback>',
      '     <performance time_to_solve="" time_complexity="" space_complexity=""><comments></comments></performance>',
      '     <code_quality readability="" correctness="" maintainability=""><comments></comments></code_quality>',
      '     <summary final_score=""><comments></comments></summary>',
      '   </feedback>',
      ``,
      `Stay concise but thorough. Prefer plain language and numbered bullets.`,
    ].join('\n'),
  );

  // Summary metadata
  headerParts.push(`\n### Problem\n- Title: ${solve.title}`);
  if (problem) {
    const ratingStr = problem.rating ? ` (Rating: ${problem.rating})` : '';
    headerParts.push(
      `- Difficulty: ${problem.difficulty}${ratingStr}`,
      `- Tags: ${problem.tags?.join(', ') || '—'}`,
    );
  }
  headerParts.push(
    `\n### Submission`,
    `- Status: ${solve.status}`,
    `- Language: ${solve.lang}`,
    `- Solve Time: ${formatTimeUsed(solve.timeUsed)}`,
    `- Hints Used: ${solve.usedHints ?? '—'}`,
  );

  // Problem description appended at the end to help analysis
  const problemDescSection = problem?.description
    ? `\n### Problem Description (for reference)\n${problem.description}\n`
    : '';

  // Preliminary base text (header + final code + problem desc)
  const baseText = headerParts.join('\n') + finalCodeSection + problemDescSection;
  let usedTokens = estimateTokens(baseText);

  // ---------------- Prepare run code blocks (include them directly) ----------------
  const runPrepared: Array<{ run: RunEvent; codeIncluded?: string; tokens: number }> = [];
  if (runs && runs.length) {
    for (const r of runs) {
      let codeText: string | undefined = undefined;
      if (typeof r.code === 'string' && r.code.length) {
        codeText = maybeTruncateCode(r.code, 10000);
      }
      const t = estimateTokens(codeText || '');
      runPrepared.push({ run: r, codeIncluded: codeText, tokens: t });
      usedTokens += t;
    }
  }

  // ---------------- Prepare snapshot patches (budget first for patches) ----------------
  // Compute total tokens if we included all patches
  const patchesRaw = snapshots.map((s) => rawPatchText(s));
  const patchTokensFull = patchesRaw.reduce((sum, p) => sum + estimateTokens(p), 0);
  const patchBudget = Math.max(0, MAX_TOKENS - usedTokens); // what's left for patches + recon
  const patchRatio = patchTokensFull > 0 ? Math.min(1, patchBudget / patchTokensFull) : 1;

  const snapshotPatchInclusions: Array<{ included: string; tokens: number }> = patchesRaw.map(
    (p) => {
      if (!p) return { included: '', tokens: 0 };
      // If we must compress, truncate proportionally
      const fullTokens = estimateTokens(p);
      const allowed = Math.max(0, Math.floor(fullTokens * patchRatio));
      const included = truncateToTokens(p, allowed);
      return { included, tokens: estimateTokens(included) };
    },
  );

  const includedPatchTokens = snapshotPatchInclusions.reduce((sum, x) => sum + x.tokens, 0);
  usedTokens += includedPatchTokens;

  // ---------------- Decide which snapshots to reconstruct fully ----------------
  // No run-priority anymore; pick evenly across all snapshots within remaining budget.
  const finalCodeTokenBaseline = Math.max(estimateTokens(finalCode), 200); // conservative per-recon baseline
  const remainingForRecons = Math.max(0, MAX_TOKENS - usedTokens);
  const maxRecons = Math.floor(remainingForRecons / finalCodeTokenBaseline);

  const allIdxs = snapshots.map((_, i) => i);
  const reconIdxs = pickEvenly(allIdxs, maxRecons);
  const reconSet = new Set<number>(reconIdxs);

  // ---------------- Build unified timeline with patch-first output ----------------
  const timeline: Array<TimelineSnapshot | TimelineRun> = [];

  for (let i = 0; i < snapshots.length; i++) {
    const s = snapshots[i];
    timeline.push({
      kind: 'snapshot',
      idx: i,
      timestamp: s.timestamp ?? 0,
      includeCode: reconSet.has(i),
      patchIncluded: snapshotPatchInclusions[i].included,
      patchTokens: snapshotPatchInclusions[i].tokens,
      note: s.isCheckpoint ? 'checkpoint' : undefined,
    });
  }

  if (runs && runs.length) {
    for (const rp of runPrepared) {
      timeline.push({
        kind: 'run',
        timestamp: rp.run.startedAt ?? null,
        run: rp.run,
        codeIncluded: rp.codeIncluded,
        codeTokens: rp.tokens,
      });
    }
  }

  timeline.sort((a, b) => {
    const ta = a.kind === 'snapshot' ? a.timestamp : (a.timestamp ?? 0);
    const tb = b.kind === 'snapshot' ? b.timestamp : (b.timestamp ?? 0);
    return ta - tb;
  });

  // ---------------- Perform reconstructions with incremental cache ----------------
  if (snapshots.length && reconSet.size) {
    const reconOrder = [...reconSet].sort((a, b) => a - b);
    let cache: ReconCache = null;
    for (const idx of reconOrder) {
      const { code, cache: nextCache } = await reconstructWithCache(snapshots, idx, cache);
      cache = nextCache;
      // find the timeline entry for this idx and attach code
      const entry = timeline.find((t) => t.kind === 'snapshot' && t.idx === idx) as
        | TimelineSnapshot
        | undefined;
      if (entry && code) entry.reconstructedCode = code;
    }
  }

  // ---------------- Render timeline text ----------------
  const timelineParts: string[] = [];
  timelineParts.push(`\n### Timeline (Snapshots & Runs — if available)\n`);

  const hasTimeline = timeline.length > 0;

  // Runs overview (optional quick glance)
  if (runs && runs.length) {
    const firstRun = iso(runsSummary?.firstRun ?? runs[0].startedAt ?? null);
    const lastRun = iso(runsSummary?.lastRun ?? runs[runs.length - 1].startedAt ?? null);
    timelineParts.push(
      `**Run Attempts Overview** — Count: ${runs.length} • Window: ${firstRun} → ${lastRun}\n`,
    );
  }

  if (hasTimeline) {
    for (const ev of timeline) {
      if (ev.kind === 'snapshot') {
        const s = snapshots[ev.idx];
        const when = iso(s.timestamp ?? null);
        const label = ev.note ? `snapshot #${ev.idx} (${ev.note})` : `snapshot #${ev.idx}`;
        timelineParts.push(`- **${when} — ${label}**`);
        // Include full reconstructed code if selected and available
        if (ev.includeCode && ev.reconstructedCode) {
          timelineParts.push(
            `  - reconstructed code:\n\`\`\`\n${maybeTruncateCode(ev.reconstructedCode)}\n\`\`\``,
          );
        }
        // Include patch if not including full code
        else if (ev.patchIncluded && ev.patchIncluded.trim().length) {
          timelineParts.push(`  - patch:\n\`\`\`\n${ev.patchIncluded}\n\`\`\``);
        } else {
          timelineParts.push(`  - patch: (no patch text captured)`);
        }
      } else {
        const r = ev.run;
        const when = iso(r.startedAt ?? null);
        const ratio =
          r.totalCorrect != null && r.totalTestcases != null
            ? `${r.totalCorrect}/${r.totalTestcases}`
            : 'n/a';
        const rt = r.runtime != null ? `${r.runtime}` : 'n/a';
        const mem = r.memory != null ? `${r.memory}` : 'n/a';
        timelineParts.push(
          `- **${when} — run**: status="${r.statusMsg}", cases=${ratio}, runtime=${rt}, memory=${mem}`,
        );
        if (r.runtimeError) timelineParts.push(`  - runtimeError: ${r.runtimeError}`);
        if (typeof r.lastTestcase === 'string' && r.lastTestcase.length > 0) {
          timelineParts.push(`  - lastTestcase: ${r.lastTestcase}`);
        }
        // Include exact code used at this run (if present)
        if (ev.codeIncluded && ev.codeIncluded.trim().length) {
          timelineParts.push(
            `  - code at run:\n\`\`\`\n${maybeTruncateCode(ev.codeIncluded)}\n\`\`\``,
          );
        }
      }
    }
  } else {
    timelineParts.push(
      `No timeline data was captured by the extension. If you need process insights, infer from submission details and the final code and be explicit about uncertainty (use a neutral process baseline of ~3 if unknown).`,
    );
  }

  // ---------------- Solve details & final stats ----------------
  const detailsParts: string[] = [];
  if (solve.notes || solve.problemNote) {
    detailsParts.push(
      `\n### Solve Notes`,
      solve.notes ? `- Notes: ${solve.notes}` : `- Notes: —`,
      solve.problemNote ? `- Problem Note: ${solve.problemNote}` : `- Problem Note: —`,
    );
  }

  if (solve.submissionDetails) {
    const sd = solve.submissionDetails;
    const rtDisp = sd.runtimeDisplay ?? (sd.runtime != null ? `${sd.runtime}` : 'n/a');
    const memDisp = sd.memoryDisplay ?? (sd.memory != null ? `${sd.memory}` : 'n/a');
    const pct = (n: number | null | undefined) => (n != null ? `${Math.round(n)}%` : 'n/a');
    detailsParts.push(
      `\n### Final Submission Stats`,
      `- Runtime: ${rtDisp} (${pct(sd.runtimePercentile)} percentile)`,
      `- Memory: ${memDisp} (${pct(sd.memoryPercentile)} percentile)`,
      `- Passed: ${sd.totalCorrect ?? 'n/a'} / ${sd.totalTestcases ?? 'n/a'}`,
      sd.lastTestcase ? `- Last Testcase: ${sd.lastTestcase}` : '',
    );
  }

  // ---------------- Final assembly ----------------
  const prompt =
    headerParts.join('\n') +
    timelineParts.join('\n') +
    detailsParts.join('\n') +
    finalCodeSection +
    problemDescSection;

  return prompt;
}
