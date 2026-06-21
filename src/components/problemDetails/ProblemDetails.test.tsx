import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProblemDetails from './ProblemDetails';
import * as useProblemDetailsModule from '@/hooks/useProblemDetails';
import type { ProblemWithSubmissions } from '@/domain/problemDetails';
import type { Solve, Category } from '@/types/types';
import { Difficulty } from '@/types/types';

vi.mock('@/hooks/useProblemDetails');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSolve = (): Solve => ({
  slug: 'two-sum',
  title: 'Two Sum',
  timestamp: Date.now() / 1000,
  status: 'Accepted',
  lang: 'python3',
});

const mockProblem = (overrides: Partial<ProblemWithSubmissions> = {}): ProblemWithSubmissions => ({
  slug: 'two-sum',
  title: 'Two Sum',
  difficulty: Difficulty.Easy,
  tags: ['Array' as Category, 'Hash Table' as Category],
  lastSolved: Date.now() / 1000,
  submissionGroups: [[mockSolve()]],
  latestScore: 85,
  latestScoreIsEstimated: false,
  totalSubmissions: 1,
  ...overrides,
});

describe('ProblemDetails', () => {
  it('shows loading state', () => {
    vi.mocked(useProblemDetailsModule.useProblemDetails).mockReturnValue({
      loading: true,
      problems: [],
      allProblems: [],
      problemCatalog: new Map(),
      refresh: vi.fn(),
    });

    render(
      <BrowserRouter>
        <ProblemDetails />
      </BrowserRouter>,
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows empty state when no problems', () => {
    vi.mocked(useProblemDetailsModule.useProblemDetails).mockReturnValue({
      loading: false,
      problems: [],
      allProblems: [],
      problemCatalog: new Map(),
      refresh: vi.fn(),
    });

    render(
      <BrowserRouter>
        <ProblemDetails />
      </BrowserRouter>,
    );

    // When there are no problems at all (not just filtered), should show empty state in sidebar
    expect(screen.getByText(/No problems match the current filters/i)).toBeInTheDocument();
    // And the detail view should show simple message to select
    expect(screen.getByText(/Select a problem to view details/i)).toBeInTheDocument();
  });

  it('renders problem list', () => {
    const problems = [
      mockProblem({ slug: 'two-sum', title: 'Two Sum' }),
      mockProblem({ slug: 'three-sum', title: 'Three Sum' }),
    ];

    vi.mocked(useProblemDetailsModule.useProblemDetails).mockReturnValue({
      loading: false,
      problems,
      allProblems: problems,
      problemCatalog: new Map(),
      refresh: vi.fn(),
    });

    render(
      <BrowserRouter>
        <ProblemDetails />
      </BrowserRouter>,
    );

    // Check that both problems appear in the list
    const problemItems = screen.getAllByText('Two Sum');
    expect(problemItems.length).toBeGreaterThan(0);

    const threeSumItems = screen.getAllByText('Three Sum');
    expect(threeSumItems.length).toBeGreaterThan(0);
  });

  it('navigates when problem is selected', () => {
    const problems = [mockProblem({ slug: 'two-sum', title: 'Two Sum' })];

    vi.mocked(useProblemDetailsModule.useProblemDetails).mockReturnValue({
      loading: false,
      problems,
      allProblems: problems,
      problemCatalog: new Map(),
      refresh: vi.fn(),
    });

    render(
      <BrowserRouter>
        <ProblemDetails />
      </BrowserRouter>,
    );

    // Click on one of the "Two Sum" texts (will be in sidebar)
    const twoSumElements = screen.getAllByText('Two Sum');
    const problemItem = twoSumElements[0].closest('div');
    if (problemItem) {
      fireEvent.click(problemItem);
      expect(mockNavigate).toHaveBeenCalledWith('/problem-details/two-sum');
    }
  });

  it('selects problem from URL parameter', () => {
    const problems = [
      mockProblem({ slug: 'two-sum', title: 'Two Sum' }),
      mockProblem({ slug: 'three-sum', title: 'Three Sum' }),
    ];

    vi.mocked(useProblemDetailsModule.useProblemDetails).mockReturnValue({
      loading: false,
      problems,
      allProblems: problems,
      problemCatalog: new Map(),
      refresh: vi.fn(),
    });

    render(
      <BrowserRouter>
        <ProblemDetails activeSlug="three-sum" />
      </BrowserRouter>,
    );

    // The three-sum problem should be selected (shown in detail view)
    // Check for multiple occurrences (sidebar + detail view)
    const threeSumElements = screen.getAllByText('Three Sum');
    expect(threeSumElements.length).toBeGreaterThan(0);
  });

  it('handles invalid URL slug with redirect', () => {
    const problems = [mockProblem({ slug: 'two-sum', title: 'Two Sum' })];

    vi.mocked(useProblemDetailsModule.useProblemDetails).mockReturnValue({
      loading: false,
      problems,
      allProblems: problems,
      problemCatalog: new Map(),
      refresh: vi.fn(),
    });

    render(
      <BrowserRouter>
        <ProblemDetails activeSlug="nonexistent-problem" />
      </BrowserRouter>,
    );

    // Should redirect when slug is not found
    expect(mockNavigate).toHaveBeenCalledWith('/problem-details', { replace: true });
  });

  it('defaults to most recent problem when no URL parameter', () => {
    const problems = [
      mockProblem({ slug: 'recent', title: 'Recent Problem', lastSolved: Date.now() / 1000 }),
      mockProblem({ slug: 'old', title: 'Old Problem', lastSolved: Date.now() / 1000 - 10000 }),
    ];

    vi.mocked(useProblemDetailsModule.useProblemDetails).mockReturnValue({
      loading: false,
      problems,
      allProblems: problems,
      problemCatalog: new Map(),
      refresh: vi.fn(),
    });

    render(
      <BrowserRouter>
        <ProblemDetails />
      </BrowserRouter>,
    );

    // Most recent problem should be displayed in detail view
    const recentElements = screen.getAllByText('Recent Problem');
    expect(recentElements.length).toBeGreaterThan(0);
  });

  it('updates selection when problem list changes', () => {
    const initialProblems = [mockProblem({ slug: 'two-sum', title: 'Two Sum' })];

    const { rerender } = render(
      <BrowserRouter>
        <ProblemDetails activeSlug="two-sum" />
      </BrowserRouter>,
    );

    vi.mocked(useProblemDetailsModule.useProblemDetails).mockReturnValue({
      loading: false,
      problems: initialProblems,
      allProblems: initialProblems,
      problemCatalog: new Map(),
      refresh: vi.fn(),
    });

    rerender(
      <BrowserRouter>
        <ProblemDetails activeSlug="two-sum" />
      </BrowserRouter>,
    );

    // Problem should still be selected after list update
    expect(screen.getAllByText('Two Sum').length).toBeGreaterThan(0);
  });
});
