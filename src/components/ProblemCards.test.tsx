import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProblemCards from './ProblemCards';
import { Difficulty } from '@/types/types';
import type { ProblemLite } from '@/types/recommendation';

describe('<ProblemCards>', () => {
  const baseProblem: ProblemLite = {
    slug: 'prob-1',
    title: 'Problem One',
    difficulty: Difficulty.Easy,
    popularity: 0.5,
    isFundamental: true,
    tags: ['Array'],
  };

  it('shows tags and fundamental badge', () => {
    render(<ProblemCards problems={[baseProblem]} bucket="fundamentals" />);
    expect(screen.getByText('Problem One')).toBeInTheDocument();
    expect(screen.getByText('Array')).toBeInTheDocument();
    expect(screen.getByText('Fundamental')).toBeInTheDocument();
  });

  it('hides tags and fundamental badge when showTags is false', () => {
    const prob = { ...baseProblem, lastSolved: Date.now() / 1000 };
    render(<ProblemCards problems={[prob]} bucket="refresh" showTags={false} />);
    expect(screen.queryByText('Array')).not.toBeInTheDocument();
    expect(screen.queryByText('Fundamental')).not.toBeInTheDocument();
    expect(screen.getByText(/Last solved/)).toBeInTheDocument();
  });

  it('renders a native LeetCode link that opens in a new tab', () => {
    render(<ProblemCards problems={[baseProblem]} bucket="fundamentals" />);

    expect(screen.getByRole('link', { name: /solve on leetcode/i })).toHaveAttribute(
      'href',
      'https://leetcode.com/problems/prob-1/',
    );
    expect(screen.getByRole('link', { name: /solve on leetcode/i })).toHaveAttribute(
      'target',
      '_blank',
    );
  });
});
