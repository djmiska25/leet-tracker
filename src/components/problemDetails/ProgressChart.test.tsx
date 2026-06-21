import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import ProgressChart from './ProgressChart';
import type { Solve } from '@/types/types';
import { Difficulty } from '@/types/types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const mockSolve = (overrides: Partial<Solve> = {}): Solve => ({
  slug: 'two-sum',
  title: 'Two Sum',
  timestamp: Date.now() / 1000,
  status: 'Accepted',
  lang: 'python3',
  difficulty: Difficulty.Easy,
  tags: [],
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

describe('<ProgressChart>', () => {
  /* ------------------------------------------------------------------ */
  /*  Rendering                                                         */
  /* ------------------------------------------------------------------ */
  it('shows empty state when no submissions', () => {
    render(<ProgressChart submissions={[]} />);

    expect(screen.getByText('No submission data available')).toBeInTheDocument();
  });

  it('renders chart with correct dimensions', () => {
    const submissions = [[mockSolve()]];

    const { container } = render(
      <ProgressChart submissions={submissions} width={500} height={180} />,
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 500 180');
  });

  it('renders Y-axis with labels and gridlines', () => {
    const submissions = [[mockSolve()]];

    const { container } = render(<ProgressChart submissions={submissions} />);

    const svg = container.querySelector('svg');

    // Check for Y-axis labels (0, 25, 50, 75, 100)
    expect(svg?.textContent).toContain('0');
    expect(svg?.textContent).toContain('25');
    expect(svg?.textContent).toContain('50');
    expect(svg?.textContent).toContain('75');
    expect(svg?.textContent).toContain('100');
  });

  it('renders X-axis with date labels', () => {
    const timestamp = Date.now() / 1000;
    const solve = mockSolve({ timestamp });
    const submissions = [[solve]];

    const { container } = render(<ProgressChart submissions={submissions} />);

    const svg = container.querySelector('svg');
    const shortDate = new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    expect(svg?.textContent).toContain(shortDate);
  });

  it('date labels include month/day and year on separate lines', () => {
    const timestamp = Date.now() / 1000;
    const solve = mockSolve({ timestamp });
    const submissions = [[solve]];

    const { container } = render(<ProgressChart submissions={submissions} />);

    const svg = container.querySelector('svg');
    const year = new Date(timestamp * 1000).getFullYear().toString();

    expect(svg?.textContent).toContain(year);
  });

  it('renders data points with correct colors for high scores', () => {
    const solve = mockSolve();
    const submissions = [[solve]];

    const { container } = render(<ProgressChart submissions={submissions} />);

    const circle = container.querySelector('circle');
    expect(circle).toBeInTheDocument();
    // High score (85) should be green (hex or rgb format)
    const style = circle?.getAttribute('style');
    expect(style).toMatch(/(#10b981|rgb\(16, 185, 129\))/);
  });

  it('renders data points with correct colors for medium scores', () => {
    const solve = mockSolve({
      feedback: {
        ...mockSolve().feedback!,
        summary: { final_score: 65, comments: '' },
      },
    });
    const submissions = [[solve]];

    const { container } = render(<ProgressChart submissions={submissions} />);

    const circle = container.querySelector('circle');
    // Medium score (65) should be amber (hex or rgb format)
    const style = circle?.getAttribute('style');
    expect(style).toMatch(/(#f59e0b|rgb\(245, 158, 11\))/);
  });

  it('renders data points with correct colors for low scores', () => {
    const solve = mockSolve({
      feedback: {
        ...mockSolve().feedback!,
        summary: { final_score: 40, comments: '' },
      },
    });
    const submissions = [[solve]];

    const { container } = render(<ProgressChart submissions={submissions} />);

    const circle = container.querySelector('circle');
    // Low score (40) should be rose (hex or rgb format)
    const style = circle?.getAttribute('style');
    expect(style).toMatch(/(#f43f5e|rgb\(244, 63, 94\))/);
  });

  it('renders data points with correct colors for estimated scores', () => {
    const solve = mockSolve({ feedback: undefined });
    const submissions = [[solve]];

    const { container } = render(<ProgressChart submissions={submissions} />);

    const circle = container.querySelector('circle');
    // Estimated score should be gray (hex or rgb format)
    const style = circle?.getAttribute('style');
    expect(style).toMatch(/(#9ca3af|rgb\(156, 163, 175\))/);
  });

  it('renders connecting line between points', () => {
    const solve1 = mockSolve({ timestamp: Date.now() / 1000 });
    const solve2 = mockSolve({ timestamp: Date.now() / 1000 - 1000 });
    const submissions = [[solve1], [solve2]];

    const { container } = render(<ProgressChart submissions={submissions} />);

    const path = container.querySelector('path');
    expect(path).toBeInTheDocument();
    expect(path?.getAttribute('d')).toMatch(/^M.*L/); // Should have Move and Line commands
  });

  /* ------------------------------------------------------------------ */
  /*  Data Points                                                       */
  /* ------------------------------------------------------------------ */
  it('SVG title attribute set for accessibility', () => {
    const solve = mockSolve();
    const submissions = [[solve]];

    const { container } = render(<ProgressChart submissions={submissions} />);

    const title = container.querySelector('circle title');
    expect(title).toBeInTheDocument();
    expect(title?.textContent).toBe('View in Solve History');
  });

  it('onClick handler called when point clicked', () => {
    const onPointClick = vi.fn();
    const solve = mockSolve();
    const submissions = [[solve]];

    const { container } = render(
      <ProgressChart submissions={submissions} onPointClick={onPointClick} />,
    );

    const circle = container.querySelector('circle');
    circle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onPointClick).toHaveBeenCalledWith(solve);
  });

  it('correct number of points for submission groups', () => {
    const solve1 = mockSolve({ timestamp: Date.now() / 1000 });
    const solve2 = mockSolve({ timestamp: Date.now() / 1000 - 1000 });
    const solve3 = mockSolve({ timestamp: Date.now() / 1000 - 2000 });
    const submissions = [[solve1], [solve2], [solve3]];

    const { container } = render(<ProgressChart submissions={submissions} />);

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(3);
  });

  /* ------------------------------------------------------------------ */
  /*  Edge Cases                                                        */
  /* ------------------------------------------------------------------ */
  it('single submission renders correctly', () => {
    const solve = mockSolve();
    const submissions = [[solve]];

    const { container } = render(<ProgressChart submissions={submissions} />);

    const circle = container.querySelector('circle');
    expect(circle).toBeInTheDocument();

    // Should not throw error (no division by zero)
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('handles estimated scores with gray color', () => {
    const solveWithoutFeedback = mockSolve({ feedback: undefined });
    const submissions = [[solveWithoutFeedback]];

    const { container } = render(<ProgressChart submissions={submissions} />);

    const circle = container.querySelector('circle');
    const style = circle?.getAttribute('style');
    expect(style).toMatch(/(#9ca3af|rgb\(156, 163, 175\))/); // gray (hex or rgb)
  });

  it('right padding prevents date cutoff', () => {
    const solve = mockSolve();
    const submissions = [[solve]];

    const { container } = render(<ProgressChart submissions={submissions} width={500} />);

    const svg = container.querySelector('svg');
    // Chart should have viewBox that accounts for padding
    expect(svg?.getAttribute('viewBox')).toBe('0 0 500 180');

    // X-axis labels should be within bounds
    const texts = container.querySelectorAll('text');
    texts.forEach((text) => {
      const x = parseFloat(text.getAttribute('x') || '0');
      expect(x).toBeLessThanOrEqual(500);
    });
  });

  it('handles multiple submissions with different scores', () => {
    const solve1 = mockSolve({
      timestamp: Date.now() / 1000,
      feedback: {
        ...mockSolve().feedback!,
        summary: { final_score: 90, comments: '' },
      },
    });
    const solve2 = mockSolve({
      timestamp: Date.now() / 1000 - 1000,
      feedback: {
        ...mockSolve().feedback!,
        summary: { final_score: 60, comments: '' },
      },
    });
    const solve3 = mockSolve({
      timestamp: Date.now() / 1000 - 2000,
      feedback: {
        ...mockSolve().feedback!,
        summary: { final_score: 30, comments: '' },
      },
    });
    const submissions = [[solve1], [solve2], [solve3]];

    const { container } = render(<ProgressChart submissions={submissions} />);

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(3);

    // Check that colors are different (RGB strings should vary)
    const styles = Array.from(circles).map((c) => c.getAttribute('style'));
    const uniqueColors = new Set(styles);
    expect(uniqueColors.size).toBeGreaterThan(1); // At least 2 different colors
  });
});
