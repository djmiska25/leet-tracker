import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

import SolveDetail from './SolveDetail';
import { db, AI_FEEDBACK_USED_KEY } from '@/storage/db';
import { Difficulty, Category, Solve } from '@/types/types';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

// Spy‑able toast helper
const toastMock = vi.fn();
vi.mock('@/components/ui/toast', () => ({
  useToast: () => toastMock,
}));

// Mock database functions
vi.mock('@/storage/db', () => ({
  db: {
    saveSolve: vi.fn(),
    getProblem: vi.fn(),
  },
  // Provide real implementations for AI feedback localStorage functions
  getAiFeedbackUsed: vi.fn(() => {
    return localStorage.getItem('leettracker-ai-feedback-used') === 'true';
  }),
  markAiFeedbackUsed: vi.fn(() => {
    localStorage.setItem('leettracker-ai-feedback-used', 'true');
  }),
  // Export the constant for testing
  AI_FEEDBACK_USED_KEY: 'leettracker-ai-feedback-used',
}));

const saveSolve = vi.mocked(db.saveSolve);
const getProblem = vi.mocked(db.getProblem);

const baseSolve: Solve = {
  slug: 'two-sum',
  title: 'Two Sum',
  timestamp: Math.floor(Date.now() / 1000),
  status: 'Accepted',
  lang: 'typescript',
  code: 'function twoSum() {}',
  difficulty: Difficulty.Easy,
  tags: ['Array'] as Category[],
};

// Helper to wrap component with Router context
function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('<SolveDetail>', () => {
  const onSaved = vi.fn();
  const onShowList = vi.fn();

  beforeEach(() => {
    // Set AI feedback as already used to skip first-time user flow
    localStorage.setItem(AI_FEEDBACK_USED_KEY, 'true');

    // Mock document.querySelector to prevent DOM manipulation issues in tests
    const mockQuerySelector = vi.fn().mockReturnValue(null);
    Object.defineProperty(document, 'querySelector', {
      value: mockQuerySelector,
      writable: true,
      configurable: true,
    });

    saveSolve.mockResolvedValue('');
    getProblem.mockResolvedValue({
      slug: 'two-sum',
      title: 'Two Sum',
      tags: ['Array'] as Category[],
      description:
        'Given an array of integers, return indices of the two numbers that add up to a specific target.',
      difficulty: Difficulty.Easy,
      popularity: 0.9,
      isPaid: false,
      isFundamental: true,
      createdAt: Math.floor(Date.now() / 1000),
    });
    onSaved.mockClear();
    toastMock.mockClear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('allows editing and saving submission code', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <SolveDetail
        solve={baseSolve}
        onSaved={onSaved}
        onShowList={onShowList}
        showListButton={false}
      />,
    );

    // Enter code edit mode
    const editBtns = screen.getAllByRole('button', { name: /edit/i });
    await user.click(editBtns[0]);

    const textarea = await screen.findByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'new code');

    // Save changes
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(saveSolve).toHaveBeenCalledWith(expect.objectContaining({ code: 'new code' }));
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it('shows an error toast if code is empty when saving', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <SolveDetail
        solve={baseSolve}
        onSaved={onSaved}
        onShowList={onShowList}
        showListButton={false}
      />,
    );

    // Enter code edit mode
    const editBtns = screen.getAllByRole('button', { name: /edit/i });
    await user.click(editBtns[0]);

    const textarea = await screen.findByRole('textbox');
    await user.clear(textarea);

    // Attempt to save empty code
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith('Code cannot be empty.', 'error');
      expect(saveSolve).not.toHaveBeenCalled();
    });
  });

  it('handles save failure gracefully for code', async () => {
    saveSolve.mockRejectedValue(new Error('Save failed'));
    const user = userEvent.setup();
    renderWithRouter(
      <SolveDetail
        solve={baseSolve}
        onSaved={onSaved}
        onShowList={onShowList}
        showListButton={false}
      />,
    );

    // Enter code edit mode
    const editBtns = screen.getAllByRole('button', { name: /edit/i });
    await user.click(editBtns[0]);

    const textarea = await screen.findByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'new code');

    // Attempt to save
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith('Failed to save code. Please try again.', 'error');
      expect(onSaved).not.toHaveBeenCalled();
    });
  });

  it('allows adding solve details', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <SolveDetail
        solve={{ ...baseSolve, timeUsed: undefined, usedHints: undefined, notes: undefined }}
        onSaved={onSaved}
        onShowList={onShowList}
        showListButton={false}
      />,
    );

    // Open details edit
    await user.click(screen.getByRole('button', { name: /add details/i }));

    const timeInput = screen.getByLabelText(/time spent/i);
    await user.clear(timeInput);
    await user.type(timeInput, '10'); // minutes

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(saveSolve).toHaveBeenCalledWith(expect.objectContaining({ timeUsed: 600 }));
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it('validates solve time input when adding details', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <SolveDetail
        solve={{ ...baseSolve, timeUsed: undefined, usedHints: undefined, notes: undefined }}
        onSaved={onSaved}
        onShowList={onShowList}
        showListButton={false}
      />,
    );

    // Open details edit
    await user.click(screen.getByRole('button', { name: /add details/i }));

    const timeInput = screen.getByLabelText(/time spent/i);
    await user.clear(timeInput);
    await user.type(timeInput, '-10'); // Invalid negative time

    // Attempt to save
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith('Solve time must be a non-negative number.', 'error');
      expect(saveSolve).not.toHaveBeenCalled();
    });
  });

  it('handles save failure gracefully for solve details', async () => {
    saveSolve.mockRejectedValue(new Error('Save failed'));
    const user = userEvent.setup();
    renderWithRouter(
      <SolveDetail
        solve={{ ...baseSolve, timeUsed: undefined, usedHints: undefined, notes: undefined }}
        onSaved={onSaved}
        onShowList={onShowList}
        showListButton={false}
      />,
    );

    // Open details edit
    await user.click(screen.getByRole('button', { name: /add details/i }));

    const timeInput = screen.getByLabelText(/time spent/i);
    await user.clear(timeInput);
    await user.type(timeInput, '10'); // Valid time

    // Attempt to save
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith('Failed to save details. Please try again.', 'error');
      expect(onSaved).not.toHaveBeenCalled();
    });
  });

  it('allows adding feedback with final score', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <SolveDetail
        solve={{
          ...baseSolve,
        }}
        onSaved={onSaved}
        onShowList={onShowList}
        showListButton={false}
      />,
    );

    // Open feedback edit
    await user.click(screen.getByRole('button', { name: /add feedback/i }));

    // Set performance feedback
    const timeToSolveInput = screen.getByLabelText(/time to solve \(0-5\)/i);
    await user.clear(timeToSolveInput);
    await user.type(timeToSolveInput, '3'); // Valid value

    const timeComplexityInput = screen.getByLabelText(/time complexity/i);
    await user.clear(timeComplexityInput);
    await user.type(timeComplexityInput, 'O(n)');

    const spaceComplexityInput = screen.getByLabelText(/space complexity/i);
    await user.clear(spaceComplexityInput);
    await user.type(spaceComplexityInput, 'O(1)');

    const performanceCommentsInput = screen.getByLabelText(/performance comments/i);
    await user.clear(performanceCommentsInput);
    await user.type(performanceCommentsInput, 'Good performance overall.');

    // Set code quality feedback
    const readabilityInput = screen.getByLabelText(/readability \(0-5\)/i);
    await user.clear(readabilityInput);
    await user.type(readabilityInput, '4'); // Valid value

    const correctnessInput = screen.getByLabelText(/correctness \(0-5\)/i);
    await user.clear(correctnessInput);
    await user.type(correctnessInput, '5'); // Valid value

    const maintainabilityInput = screen.getByLabelText(/maintainability \(0-5\)/i);
    await user.clear(maintainabilityInput);
    await user.type(maintainabilityInput, '3'); // Valid value

    const codeQualityCommentsInput = screen.getByLabelText(/code quality comments/i);
    await user.clear(codeQualityCommentsInput);
    await user.type(codeQualityCommentsInput, 'Code is clean and maintainable.');

    // Set summary feedback
    const finalScoreInput = screen.getByLabelText(/final score \(0-100\)/i);
    await user.clear(finalScoreInput);
    await user.type(finalScoreInput, '85'); // Valid value

    const summaryCommentsInput = screen.getByLabelText(/summary comments/i);
    await user.clear(summaryCommentsInput);
    await user.type(summaryCommentsInput, 'Great solution overall.');

    // Save feedback
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(saveSolve).toHaveBeenCalledWith(
        expect.objectContaining({
          feedback: expect.objectContaining({
            performance: expect.objectContaining({
              time_to_solve: 3,
              time_complexity: 'O(n)',
              space_complexity: 'O(1)',
              comments: 'Good performance overall.',
            }),
            code_quality: expect.objectContaining({
              readability: 4,
              correctness: 5,
              maintainability: 3,
              comments: 'Code is clean and maintainable.',
            }),
            summary: expect.objectContaining({
              final_score: 85,
              comments: 'Great solution overall.',
            }),
          }),
        }),
      );
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it('validates feedback input when adding feedback', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <SolveDetail
        solve={{
          ...baseSolve,
        }}
        onSaved={onSaved}
        onShowList={onShowList}
        showListButton={false}
      />,
    );

    // Open feedback edit
    await user.click(screen.getByRole('button', { name: /add feedback/i }));

    const scoreInput = screen.getByLabelText(/final score/i);
    await user.clear(scoreInput);
    await user.type(scoreInput, '150'); // Invalid score

    // Attempt to save
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith('Numeric ratings are out of range.', 'error');
      expect(saveSolve).not.toHaveBeenCalled();
    });
  });

  it('handles save failure gracefully for feedback', async () => {
    saveSolve.mockRejectedValue(new Error('Save failed'));
    const user = userEvent.setup();
    renderWithRouter(
      <SolveDetail
        solve={{
          ...baseSolve,
          feedback: {
            performance: {
              time_to_solve: 3,
              time_complexity: '',
              space_complexity: '',
              comments: '',
            },
            code_quality: { readability: 3, correctness: 3, maintainability: 3, comments: '' },
            summary: { final_score: 1, comments: '' }, // Set a valid initial value
          },
        }}
        onSaved={onSaved}
        onShowList={onShowList}
        showListButton={false}
      />,
    );

    // Open feedback edit
    await user.click(screen.getByRole('button', { name: /edit feedback/i }));

    const scoreInput = screen.getByLabelText(/final score/i);
    await user.clear(scoreInput);
    await user.type(scoreInput, '85'); // Valid score

    // Attempt to save
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith('Failed to save feedback. Please try again.', 'error');
      expect(onSaved).not.toHaveBeenCalled();
    });
  });

  describe('ChatGPT prompt copy/paste flow', () => {
    // Mock clipboard API
    const mockWriteText = vi.fn();
    const mockReadText = vi.fn();

    beforeEach(() => {
      // Setup clipboard mocks using defineProperty
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: mockWriteText,
          readText: mockReadText,
        },
        writable: true,
        configurable: true,
      });
      mockWriteText.mockClear();
      mockReadText.mockClear();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('generates and displays prompt content with solve details', async () => {
      const user = userEvent.setup();
      const testSolve = {
        ...baseSolve,
        timeUsed: 1800, // 30 minutes
        usedHints: 'leetcode_hint' as const,
        notes: 'Had to think about edge cases',
        code: 'function twoSum(nums, target) {\n  // solution here\n  return result;\n}',
      };

      // Mock clipboard writeText to track what would be copied
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
      });

      renderWithRouter(
        <SolveDetail
          solve={testSolve}
          onSaved={onSaved}
          onShowList={onShowList}
          showListButton={false}
        />,
      );

      await user.click(screen.getByRole('button', { name: /copy prompt/i }));

      // Check that the prompt contains all expected content
      await waitFor(() => {
        // New header text from feedbackPrompt.ts
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining(
            'You are a seasoned algorithms mentor and coding interview coach.',
          ),
        );
        expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('Two Sum'));
        expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('30 min'));
        // Hints now shown in raw enum form inside the prompt
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining('Hints Used: leetcode_hint'),
        );
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining('Had to think about edge cases'),
        );
        expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('function twoSum'));
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining(
            'Given an array of integers, return indices of the two numbers that add up to a specific target.',
          ),
        );
      });
    });

    it('opens XML input for manual paste when Import Feedback is clicked', async () => {
      const user = userEvent.setup();

      // Mock clipboard to simulate no access
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      });

      renderWithRouter(
        <SolveDetail
          solve={baseSolve}
          onSaved={onSaved}
          onShowList={onShowList}
          showListButton={false}
        />,
      );

      await user.click(screen.getByRole('button', { name: /import feedback/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/paste llm xml response here/i)).toBeInTheDocument();
      });
    });

    it('allows manual XML input and import when textarea is used', async () => {
      const validXML = `<feedback>
        <performance time_to_solve="3" time_complexity="O(n log n)" space_complexity="O(n)">
          <comments>Decent approach with sorting</comments>
        </performance>
        <code_quality readability="4" correctness="5" maintainability="4">
          <comments>Well structured code</comments>
        </code_quality>
        <summary final_score="78">
          <comments>Good overall performance</comments>
        </summary>
      </feedback>`;

      const user = userEvent.setup();

      // Mock clipboard to simulate no access
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      });

      renderWithRouter(
        <SolveDetail
          solve={baseSolve}
          onSaved={onSaved}
          onShowList={onShowList}
          showListButton={false}
        />,
      );

      // Open XML input manually
      await user.click(screen.getByRole('button', { name: /import feedback/i }));

      const textarea = screen.getByPlaceholderText(/paste llm xml response here/i);
      await user.type(textarea, validXML);

      await user.click(screen.getByRole('button', { name: /^import$/i }));

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith('Feedback imported and saved!', 'success');
        expect(saveSolve).toHaveBeenCalledWith(
          expect.objectContaining({
            feedback: expect.objectContaining({
              performance: expect.objectContaining({
                time_to_solve: 3,
                time_complexity: 'O(n log n)',
                space_complexity: 'O(n)',
                comments: 'Decent approach with sorting',
              }),
              summary: expect.objectContaining({
                final_score: 78,
              }),
            }),
          }),
        );
      });
    });

    it('shows error for invalid XML format', async () => {
      const invalidXML = 'not valid xml';

      const user = userEvent.setup();

      // Mock clipboard to simulate no access
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      });

      renderWithRouter(
        <SolveDetail
          solve={baseSolve}
          onSaved={onSaved}
          onShowList={onShowList}
          showListButton={false}
        />,
      );

      // Open XML input manually
      await user.click(screen.getByRole('button', { name: /import feedback/i }));

      const textarea = screen.getByPlaceholderText(/paste llm xml response here/i);
      await user.type(textarea, invalidXML);

      await user.click(screen.getByRole('button', { name: /^import$/i }));

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('Import failed:'), 'error');
      });
    });

    it('shows error for XML with invalid numeric values', async () => {
      const invalidXML = `<feedback>
        <performance time_to_solve="invalid" time_complexity="O(n)" space_complexity="O(1)">
          <comments>Good solution approach</comments>
        </performance>
        <code_quality readability="5" correctness="4" maintainability="3">
          <comments>Clean and readable code</comments>
        </code_quality>
        <summary final_score="85">
          <comments>Overall excellent work</comments>
        </summary>
      </feedback>`;

      const user = userEvent.setup();

      // Mock clipboard to simulate no access
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      });

      renderWithRouter(
        <SolveDetail
          solve={baseSolve}
          onSaved={onSaved}
          onShowList={onShowList}
          showListButton={false}
        />,
      );

      // Open XML input manually
      await user.click(screen.getByRole('button', { name: /import feedback/i }));

      const textarea = screen.getByPlaceholderText(/paste llm xml response here/i);
      await user.type(textarea, invalidXML);

      await user.click(screen.getByRole('button', { name: /^import$/i }));

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('Import failed:'), 'error');
      });
    });

    it('cancels XML input and clears state when cancel is clicked', async () => {
      const user = userEvent.setup();

      // Mock clipboard to simulate no access
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      });

      renderWithRouter(
        <SolveDetail
          solve={baseSolve}
          onSaved={onSaved}
          onShowList={onShowList}
          showListButton={false}
        />,
      );

      // Open XML input
      await user.click(screen.getByRole('button', { name: /import feedback/i }));

      const textarea = screen.getByPlaceholderText(/paste llm xml response here/i);
      await user.type(textarea, 'some text');

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText(/paste llm xml response here/i),
        ).not.toBeInTheDocument();
      });
    });

    it('trims and normalizes whitespace in XML text fields during import', async () => {
      const xmlWithExtraSpaces = `<feedback>
        <performance time_to_solve="4" time_complexity="  O(n)  " space_complexity=" O(1) ">
          <comments>   Good   solution   approach   </comments>
        </performance>
        <code_quality readability="5" correctness="4" maintainability="3">
          <comments>Clean    and    readable    code</comments>
        </code_quality>
        <summary final_score="85">
          <comments>  Overall   excellent   work  </comments>
        </summary>
      </feedback>`;

      const user = userEvent.setup();

      // Mock clipboard to simulate no access
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      });

      renderWithRouter(
        <SolveDetail
          solve={baseSolve}
          onSaved={onSaved}
          onShowList={onShowList}
          showListButton={false}
        />,
      );

      // Open XML input manually
      await user.click(screen.getByRole('button', { name: /import feedback/i }));

      const textarea = screen.getByPlaceholderText(/paste llm xml response here/i);
      await user.type(textarea, xmlWithExtraSpaces);

      await user.click(screen.getByRole('button', { name: /^import$/i }));

      await waitFor(() => {
        expect(saveSolve).toHaveBeenCalledWith(
          expect.objectContaining({
            feedback: expect.objectContaining({
              performance: expect.objectContaining({
                time_complexity: 'O(n)', // trimmed and normalized
                space_complexity: 'O(1)', // trimmed and normalized
                comments: 'Good solution approach', // multiple spaces normalized
              }),
              code_quality: expect.objectContaining({
                comments: 'Clean and readable code', // multiple spaces normalized
              }),
              summary: expect.objectContaining({
                comments: 'Overall excellent work', // trimmed and normalized
              }),
            }),
          }),
        );
      });
    });

    it('imports feedback in edit mode without auto-saving', async () => {
      const validXML = `<feedback>
        <performance time_to_solve="3" time_complexity="O(n)" space_complexity="O(1)">
          <comments>Good approach</comments>
        </performance>
        <code_quality readability="4" correctness="5" maintainability="4">
          <comments>Clean code</comments>
        </code_quality>
        <summary final_score="80">
          <comments>Good work</comments>
        </summary>
      </feedback>`;

      const user = userEvent.setup();

      // Mock clipboard to simulate no access
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      });

      renderWithRouter(
        <SolveDetail
          solve={baseSolve}
          onSaved={onSaved}
          onShowList={onShowList}
          showListButton={false}
        />,
      );

      // First enter edit mode
      await user.click(screen.getByRole('button', { name: /add feedback/i }));

      // Then import XML
      await user.click(screen.getByRole('button', { name: /import feedback/i }));

      const textarea = screen.getByPlaceholderText(/paste llm xml response here/i);
      await user.type(textarea, validXML);

      await user.click(screen.getByRole('button', { name: /^import$/i }));

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith('Feedback imported!', 'success');
        expect(saveSolve).not.toHaveBeenCalled(); // Should not auto-save in edit mode
      });
    });

    it('validates manual feedback entry with consistent requirements', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <SolveDetail
          solve={baseSolve}
          onSaved={onSaved}
          onShowList={onShowList}
          showListButton={false}
        />,
      );

      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /add feedback/i }));

      // Default values (all 0) should be valid - save should succeed
      await user.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith('Feedback saved!', 'success');
        expect(saveSolve).toHaveBeenCalled();
      });

      // Reset mocks for next test
      toastMock.mockClear();
      saveSolve.mockClear();

      // Test with invalid values
      const finalScoreInput = screen.getByLabelText(/final score/i);
      await user.clear(finalScoreInput);
      await user.type(finalScoreInput, '150'); // Invalid score > 100

      await user.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith('Numeric ratings are out of range.', 'error');
        expect(saveSolve).toHaveBeenCalledTimes(0); // Should not save invalid data
      });
    });
  });

  describe('AI Feedback First-Time User Help Button Flow', () => {
    beforeEach(() => {
      // Clear localStorage to simulate first-time user
      localStorage.clear();

      // Mock document.querySelector to avoid DOM errors but not test the actual DOM interaction
      vi.spyOn(document, 'querySelector').mockReturnValue(null);

      saveSolve.mockResolvedValue('');
      getProblem.mockResolvedValue({
        slug: 'two-sum',
        title: 'Two Sum',
        tags: ['Array'] as Category[],
        description:
          'Given an array of integers, return indices of the two numbers that add up to a specific target.',
        difficulty: Difficulty.Easy,
        popularity: 0.9,
        isPaid: false,
        isFundamental: true,
        createdAt: Math.floor(Date.now() / 1000),
      });
      onSaved.mockClear();
      toastMock.mockClear();
    });

    it('should trigger help button for first-time user when copying prompt', async () => {
      const user = userEvent.setup();

      // Mock clipboard
      const mockWriteText = vi.fn();
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: mockWriteText,
        },
        writable: true,
      });

      renderWithRouter(
        <SolveDetail
          solve={baseSolve}
          onSaved={onSaved}
          onShowList={onShowList}
          showListButton={false}
        />,
      );

      await user.click(screen.getByRole('button', { name: /copy prompt/i }));

      await waitFor(() => {
        // Should mark AI feedback as used for first-time user
        expect(localStorage.getItem(AI_FEEDBACK_USED_KEY)).toBe('true');
        expect(mockWriteText).toHaveBeenCalled();
      });
    });

    it('should NOT trigger help button for returning user when copying prompt', async () => {
      const user = userEvent.setup();

      // Mark user as having used AI feedback before
      localStorage.setItem(AI_FEEDBACK_USED_KEY, 'true');

      // Mock clipboard
      const mockWriteText = vi.fn();
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: mockWriteText,
        },
        writable: true,
      });

      renderWithRouter(
        <SolveDetail
          solve={baseSolve}
          onSaved={onSaved}
          onShowList={onShowList}
          showListButton={false}
        />,
      );

      await user.click(screen.getByRole('button', { name: /copy prompt/i }));

      await waitFor(() => {
        // Should NOT mark as used again for returning user - localStorage should remain unchanged
        expect(localStorage.getItem(AI_FEEDBACK_USED_KEY)).toBe('true');
        expect(mockWriteText).toHaveBeenCalled();
      });
    });

    it('should trigger help button for first-time user when using smart import', async () => {
      const user = userEvent.setup();

      // Mock clipboard with valid XML
      const validXML = `<feedback>
        <performance time_to_solve="3" time_complexity="O(n)" space_complexity="O(1)">
          Great solution!
        </performance>
        <code_quality overall_rating="4" readability="4" efficiency="5" best_practices="3">
          Clean code.
        </code_quality>
        <summary final_score="85">
          Good work overall.
        </summary>
      </feedback>`;

      const mockReadText = vi.fn().mockResolvedValue(validXML);
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          readText: mockReadText,
        },
        writable: true,
      });

      renderWithRouter(
        <SolveDetail
          solve={baseSolve}
          onSaved={onSaved}
          onShowList={onShowList}
          showListButton={false}
        />,
      );

      await user.click(screen.getByRole('button', { name: /import feedback/i }));

      await waitFor(() => {
        // Should mark AI feedback as used for first-time user
        expect(localStorage.getItem(AI_FEEDBACK_USED_KEY)).toBe('true');
      });
    });

    it('should NOT trigger help button for returning user when using smart import', async () => {
      const user = userEvent.setup();

      // Mark user as having used AI feedback before
      localStorage.setItem(AI_FEEDBACK_USED_KEY, 'true');

      // Mock clipboard with valid XML
      const validXML = `<feedback>
        <performance time_to_solve="3" time_complexity="O(n)" space_complexity="O(1)">
          Great solution!
        </performance>
        <code_quality overall_rating="4" readability="4" efficiency="5" best_practices="3">
          Clean code.
        </code_quality>
        <summary final_score="85">
          Good work overall.
        </summary>
      </feedback>`;

      const mockReadText = vi.fn().mockResolvedValue(validXML);
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          readText: mockReadText,
        },
        writable: true,
      });

      renderWithRouter(
        <SolveDetail
          solve={baseSolve}
          onSaved={onSaved}
          onShowList={onShowList}
          showListButton={false}
        />,
      );

      await user.click(screen.getByRole('button', { name: /import feedback/i }));

      await waitFor(() => {
        // Should NOT mark as used again for returning user - localStorage should remain unchanged
        expect(localStorage.getItem(AI_FEEDBACK_USED_KEY)).toBe('true');
      });
    });

    it('should handle gracefully when help button is not found', async () => {
      const user = userEvent.setup();

      // Mock querySelector to return null (help button not found)
      const mockQuerySelector = vi.fn().mockReturnValue(null);
      Object.defineProperty(document, 'querySelector', {
        value: mockQuerySelector,
        writable: true,
        configurable: true,
      });

      // Mock clipboard
      const mockWriteText = vi.fn();
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: mockWriteText,
        },
        writable: true,
        configurable: true,
      });

      renderWithRouter(
        <SolveDetail
          solve={baseSolve}
          onSaved={onSaved}
          onShowList={onShowList}
          showListButton={false}
        />,
      );

      // This should not throw an error even if help button is not found
      await user.click(screen.getByRole('button', { name: /copy prompt/i }));

      // Should still look for the help button
      expect(mockQuerySelector).toHaveBeenCalledWith('[data-tooltip-id="feedback-help"]');

      // Should mark AI feedback as used for first-time user
      expect(localStorage.getItem(AI_FEEDBACK_USED_KEY)).toBe('true');

      // Should still copy the prompt successfully
      expect(mockWriteText).toHaveBeenCalled();
    });

    it('should trigger help button when import fails', async () => {
      const user = userEvent.setup();

      // Mock clipboard with invalid XML that will cause parseXmlFeedback to fail
      const invalidXML = `<invalid>xml</invalid>`;
      const mockReadText = vi.fn().mockResolvedValue(invalidXML);
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          readText: mockReadText,
          writeText: vi.fn(),
        },
        writable: true,
      });

      renderWithRouter(
        <SolveDetail
          solve={baseSolve}
          onSaved={onSaved}
          onShowList={onShowList}
          showListButton={false}
        />,
      );

      await user.click(screen.getByRole('button', { name: /import feedback/i }));

      await waitFor(() => {
        // Should mark AI feedback as used for first-time user even when import fails
        expect(localStorage.getItem(AI_FEEDBACK_USED_KEY)).toBe('true');
      });
    });
  });
});
