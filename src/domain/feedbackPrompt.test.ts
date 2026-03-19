import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildFeedbackPrompt } from '@/domain/feedbackPrompt';
import { db } from '@/storage/db';
import { Solve, Difficulty, Category } from '@/types/types';

// Mock storage db
vi.mock('@/storage/db');

const getProblem = vi.mocked(db.getProblem);

describe('buildFeedbackPrompt', () => {
  const baseSolve: Solve = {
    slug: 'two-sum',
    title: 'Two Sum',
    timestamp: Math.floor(Date.now() / 1000),
    status: 'Accepted',
    lang: 'typescript',
    code: 'function twoSum(nums, target) { return []; }',
    timeUsed: 1800, // 30 minutes
    usedHints: 'leetcode_hint',
  };

  beforeEach(() => {
    getProblem.mockResolvedValue({
      slug: 'two-sum',
      title: 'Two Sum',
      tags: ['Array'] as Category[],
      description:
        'Given an array of integers, return indices of the two numbers that add up to a specific target.',
      difficulty: Difficulty.Easy,
      popularity: 0.95,
      isPaid: false,
      isFundamental: true,
      createdAt: Math.floor(Date.now() / 1000),
    });
  });

  it('includes the updated rubric with Algorithmic Efficiency and scaled-weight formula', async () => {
    const prompt = await buildFeedbackPrompt({ ...baseSolve });

    // Core header + rubric anchors
    expect(prompt).toContain('You are a seasoned algorithms mentor and coding interview coach.');
    expect(prompt).toContain('### Scoring Rubric & Anchors');

    // Algorithmic Efficiency as a first-class dimension
    expect(prompt).toContain('Algorithmic Efficiency (0-5)');

    // Scaled-weight formula parts
    expect(prompt).toContain('Final Score (0-100):');
    expect(prompt).toContain('20 * (time_to_solve / 5)');
    expect(prompt).toContain('30 * (correctness / 5)');
    expect(prompt).toContain('15 * (readability / 5)');
    expect(prompt).toContain('15 * (maintainability / 5)');
    expect(prompt).toContain('10 * (process_subscore / 5)');
    expect(prompt).toContain('10 * (algorithmic_efficiency / 5)');

    // Penalties are negative-only and bounded
    expect(prompt).toContain('Penalties (negative only, bounded total -8)');
    expect(prompt).toContain('Hint usage (0 to -5)');
    expect(prompt).toContain('Error thrash (0 to -3)');
  });

  it('includes problem metadata, submission details, final code, and problem description', async () => {
    const prompt = await buildFeedbackPrompt({
      ...baseSolve,
      submissionDetails: {
        runtimeDisplay: '12 ms',
        runtimePercentile: 95,
        memoryDisplay: '35 MB',
        memoryPercentile: 90,
        totalCorrect: 55,
        totalTestcases: 55,
        lastTestcase: null,
        codeOutput: null,
        expectedOutput: null,
        runtimeError: null,
        compileError: null,
        fullCodeOutput: null,
        notes: null,
      },
      notes: 'Had to think about edge cases',
    });

    // Problem block
    expect(prompt).toContain('### Problem');
    expect(prompt).toContain('Title: Two Sum');
    expect(prompt).toContain('Difficulty: Easy');
    expect(prompt).toContain('Tags: Array');

    // Submission block
    expect(prompt).toContain('### Submission');
    expect(prompt).toContain('Solve Time: 30 min'); // formatted
    expect(prompt).toContain('Hints Used: leetcode_hint');

    // Final code block
    expect(prompt).toContain('### Final Submitted Code');
    expect(prompt).toContain('function twoSum');

    // Stats
    expect(prompt).toContain('### Final Submission Stats');
    expect(prompt).toContain('Runtime: 12 ms (95% percentile)');
    expect(prompt).toContain('Memory: 35 MB (90% percentile)');
    expect(prompt).toContain('Passed: 55 / 55');

    // Problem description appended for reference
    expect(prompt).toContain('### Problem Description (for reference)');
    expect(prompt).toContain(
      'Given an array of integers, return indices of the two numbers that add up to a specific target.',
    );

    // Notes section
    expect(prompt).toContain('### Solve Notes');
    expect(prompt).toContain('Had to think about edge cases');
  });

  it('renders a timeline with snapshots and runs (patch/code presence)', async () => {
    const now = Date.now();
    const prompt = await buildFeedbackPrompt({
      ...baseSolve,
      codingJourney: {
        snapshotCount: 3,
        totalCodingTime: 600000,
        firstSnapshot: now - 600000,
        lastSnapshot: now - 1000,
        hasDetailedJourney: true,
        snapshots: [
          { timestamp: now - 600000, fullCode: 'v1', isCheckpoint: true },
          { timestamp: now - 300000, patchText: '@@ patch-1 @@\n- foo\n+ bar' },
          { timestamp: now - 1000, patchText: '@@ patch-2 @@\n- bar\n+ baz' },
        ],
      },
      runEvents: {
        count: 2,
        firstRun: now - 200000,
        lastRun: now - 1000,
        hasDetailedRuns: true,
        runs: [
          {
            id: 'r1',
            startedAt: now - 200000,
            statusMsg: 'Runtime Error',
            totalCorrect: 10,
            totalTestcases: 55,
            runtimeError: 'TypeError: x is not a function',
            lastTestcase: 'input=... expected=...',
            code: 'function twoSum(a,b){throw new Error()}',
            compareResult: null,
            runtime: null,
            memory: null,
          },
          {
            id: 'r2',
            startedAt: now - 1000,
            statusMsg: 'Accepted',
            totalCorrect: 55,
            totalTestcases: 55,
            runtimeError: null,
            lastTestcase: null,
            code: 'function twoSum(a,b){return [0,1]}',
            compareResult: null,
            runtime: 12,
            memory: 35,
          },
        ],
        _window: { startMs: now - 600000, endMs: now },
      },
    });

    expect(prompt).toContain('### Timeline (Snapshots & Runs — if available)');
    // Snapshot lines (at least references to snapshot indices)
    expect(prompt).toContain('snapshot #0');
    expect(prompt).toContain('snapshot #1');
    // Depending on token budget, we either include a patch or a reconstructed code block
    expect(prompt).toMatch(/(patch-1|reconstructed code:)/);
    // Runs should appear with "— run"
    expect(prompt).toMatch(/— run/);
    // Code at run (we include code when available)
    expect(prompt).toContain('code at run:');
    expect(prompt).toContain('function twoSum(a,b){return [0,1]}');
  });

  it('handles no timeline gracefully', async () => {
    const prompt = await buildFeedbackPrompt({
      ...baseSolve,
      // No codingJourney, no runEvents
    });

    // Header still present, but we clearly indicate timeline may be absent
    expect(prompt).toContain('### Timeline (Snapshots & Runs — if available)');
    // The fallback note should appear
    expect(prompt).toContain('No timeline data was captured by the extension.');
    // Should not contain run lines or snapshot labels
    expect(prompt).not.toMatch(/— run/);
    expect(prompt).not.toContain('snapshot #0');
  });
});
