import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ProblemDetailView from './ProblemDetailView';
import type { ProblemWithSubmissions } from '@/domain/problemDetails';
import type { Solve, Category } from '@/types/types';
import { Difficulty } from '@/types/types';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/components/ui/toast', () => ({
  useToast: () => vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const mockSolve = (overrides: Partial<Solve> = {}): Solve => ({
  slug: 'two-sum',
  title: 'Two Sum',
  timestamp: Date.now() / 1000,
  status: 'Accepted',
  lang: 'python3',
  feedback: {
    performance: {
      time_to_solve: 10,
      time_complexity: 'O(n)',
      space_complexity: 'O(1)',
      comments: 'Good',
    },
    code_quality: {
      readability: 4,
      correctness: 5,
      maintainability: 4,
      comments: 'Clean',
    },
    summary: {
      final_score: 85,
      comments: 'Well done',
    },
  },
  ...overrides,
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
  problem: {
    slug: 'two-sum',
    title: 'Two Sum',
    description: 'Given an array of integers, return indices of the two numbers.',
    difficulty: Difficulty.Easy,
    tags: ['Array' as Category],
    popularity: 0.9,
    isPaid: false,
    isFundamental: true,
    createdAt: Date.now() / 1000,
  },
  ...overrides,
});

describe('<ProblemDetailView>', () => {
  const noop = () => {};

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  /* ------------------------------------------------------------------ */
  /*  Display                                                           */
  /* ------------------------------------------------------------------ */
  it('shows problem title and metadata', () => {
    const problem = mockProblem();

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText(/1 total submissions/i)).toBeInTheDocument();
  });

  it('shows difficulty badge with correct color', () => {
    const problem = mockProblem({ difficulty: Difficulty.Medium });

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    const badge = screen.getByText('Medium');
    expect(badge).toHaveClass('bg-amber-100', 'text-amber-800');
  });

  it('shows problem description', () => {
    const problem = mockProblem();

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Given an array of integers/i)).toBeInTheDocument();
  });

  it('description expand/collapse toggle works', async () => {
    const longDescription = 'A'.repeat(500);
    const problem = mockProblem({
      problem: { ...mockProblem().problem!, description: longDescription },
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    // Should be collapsed initially with expand button
    const expandButton = screen.getByRole('button', { name: /expand/i });
    expect(expandButton).toBeInTheDocument();

    // Expand
    await user.click(expandButton);
    expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByRole('button', { name: /collapse/i }));
    expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();
  });

  it('shows "View on LeetCode" link', () => {
    const problem = mockProblem();

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    const link = screen.getByRole('button', { name: /view on leetcode/i });
    expect(link).toBeInTheDocument();
  });

  it('shows "Show List" button when sidebar hidden', () => {
    const problem = mockProblem();

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={true} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('button', { name: /show list/i }).length).toBeGreaterThan(0);
  });

  it('hides "Show List" button when sidebar visible', () => {
    const problem = mockProblem();

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /show list/i })).not.toBeInTheDocument();
  });

  it('empty state when no problem selected', () => {
    render(
      <MemoryRouter>
        <ProblemDetailView problem={null} onShowList={noop} showListButton={true} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Select a problem from the list to view details/i)).toBeInTheDocument();
  });

  /* ------------------------------------------------------------------ */
  /*  Solve Timeline Chart                                              */
  /* ------------------------------------------------------------------ */
  it('renders ProgressChart with submission groups', () => {
    const problem = mockProblem();

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Solve Timeline')).toBeInTheDocument();
  });

  it('chart subtitle displays correct text', () => {
    const problem = mockProblem();

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/Track your progress over time.*solve \(submission group\)/i),
    ).toBeInTheDocument();
  });

  it('shows score legend', () => {
    const problem = mockProblem();

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText('High (80+)')).toBeInTheDocument();
    expect(screen.getByText('Medium (50-79)')).toBeInTheDocument();
    expect(screen.getByText('Low (<50)')).toBeInTheDocument();
    expect(screen.getByText('Estimated (no feedback provided)')).toBeInTheDocument();
  });

  /* ------------------------------------------------------------------ */
  /*  All Solves Table                                                  */
  /* ------------------------------------------------------------------ */
  it('renders all submission groups', () => {
    const solve1 = mockSolve({ timestamp: Date.now() / 1000 });
    const solve2 = mockSolve({ timestamp: Date.now() / 1000 - 1000 });
    const problem = mockProblem({
      submissionGroups: [[solve1], [solve2]],
      totalSubmissions: 2,
    });

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText('All Solves')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('shows submission number, date, hints used', () => {
    const solve = mockSolve({ usedHints: 'gpt_help' });
    const problem = mockProblem({ submissionGroups: [[solve]] });

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('GPT Help')).toBeInTheDocument();
  });

  it('shows score badge with correct colors', () => {
    const solve = mockSolve();
    const problem = mockProblem({ submissionGroups: [[solve]] });

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    const scoreBadge = screen.getByText('85');
    expect(scoreBadge).toHaveClass('bg-emerald-100', 'text-emerald-800');
  });

  it('shows attempt count for grouped submissions', () => {
    const solve1 = mockSolve({ timestamp: Date.now() / 1000 });
    const solve2 = mockSolve({ timestamp: Date.now() / 1000 - 60 });
    const problem = mockProblem({
      submissionGroups: [[solve1, solve2]],
    });

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText('2 attempts')).toBeInTheDocument();
  });

  it('link to solve history navigation works', async () => {
    const solve = mockSolve({ slug: 'two-sum', timestamp: 123456 });
    const problem = mockProblem({ submissionGroups: [[solve]] });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    const linkButton = screen.getByRole('button', { name: /view in solve history/i });
    await user.click(linkButton);

    expect(mockNavigate).toHaveBeenCalledWith('/solve-history/two-sum%7C123456');
  });

  it('link button has correct tooltip', () => {
    const problem = mockProblem();

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    const linkButton = screen.getByRole('button', { name: /view in solve history/i });
    expect(linkButton).toHaveAttribute('title', 'View in Solve History');
  });

  /* ------------------------------------------------------------------ */
  /*  Problem Navigation                                                */
  /* ------------------------------------------------------------------ */
  it('clicking chart data point navigates to solve history', async () => {
    const solve = mockSolve({ slug: 'two-sum', timestamp: 123456 });
    const problem = mockProblem({ submissionGroups: [[solve]] });

    render(
      <MemoryRouter>
        <ProblemDetailView problem={problem} onShowList={noop} showListButton={false} />
      </MemoryRouter>,
    );

    // Find and click a data point (circle in SVG)
    const svg = document.querySelector('svg');
    const circle = svg?.querySelector('circle');

    if (circle) {
      circle.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/solve-history/two-sum%7C123456');
      });
    }
  });
});
