import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi, describe, it, beforeEach, afterEach } from 'vitest';

import Dashboard, { RANDOM_TAG } from './Dashboard';
import { db } from '@/storage/db';
import { getRandomSuggestions, getCategorySuggestions } from '@/domain/recommendations';
import { Difficulty } from '@/types/types';

/* ------------------------------------------------------------------ */
/*  Mock useDashboard so Dashboard mounts instantly with stub refresh   */
/* ------------------------------------------------------------------ */
const refreshProgressMock = vi.fn().mockResolvedValue(undefined);
const reloadProfilesMock = vi.fn().mockResolvedValue(undefined);
const dashboardHookState = {
  loading: false,
  syncing: false,
  progress: [
    {
      tag: 'Array',
      goal: 1400,
      estimatedScore: 0.4,
      confidenceLevel: 0.4,
      adjustedScore: 0.16,
    },
  ],
  profiles: [
    { id: 'test', name: 'Test', description: '', goals: {}, createdAt: '', isEditable: true },
  ],
  activeProfileId: 'test',
  profile: null,
  refreshProgress: refreshProgressMock,
  reloadProfiles: reloadProfilesMock,
  ratings: {
    global: { rating: 1500, rd: 350, volatility: 0.06, lastUpdated: Date.now(), solveCount: 0 },
    categories: {},
  },
  solves: [],
};

vi.mock('@/hooks/useDashboard', () => ({
  useDashboard: () => dashboardHookState,
}));

vi.mock('@/domain/recommendations');
vi.mock('@/storage/db');

/* ------------------------------------------------------------------ */

describe('Dashboard \u2013 Random category', () => {
  beforeEach(() => {
    vi.mocked(getCategorySuggestions).mockResolvedValue({
      tag: 'Array',
      fundamentals: [],
      refresh: [],
      new: [],
    });

    vi.mocked(getRandomSuggestions).mockResolvedValue({
      tag: 'Random',
      fundamentals: [
        {
          slug: 'rand-1',
          title: 'Random One',
          difficulty: Difficulty.Easy,
          popularity: 0.5,
          isFundamental: false,
        },
      ],
      refresh: [],
      new: [],
    });

    vi.mocked(db.getAllGoalProfiles).mockResolvedValue([
      {
        id: 'default',
        name: 'Default',
        description: '',
        goals: {},
        createdAt: '',
        isEditable: false,
      },
    ] as any);
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue('default');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls getRandomSuggestions and hides tags', async () => {
    const user = userEvent.setup();
    render(<Dashboard username="testuser" />);

    const randomBtn = screen.getByRole('button', { name: RANDOM_TAG });
    expect(randomBtn).toBeInTheDocument();

    await user.click(randomBtn);

    await waitFor(() => {
      expect(getRandomSuggestions).toHaveBeenCalledWith(['Array']);
    });

    const cardTitle = await screen.findByText('Random One');
    const card = cardTitle.closest('div')!;
    expect(within(card).queryByText('Array')).not.toBeInTheDocument();
  });
});
