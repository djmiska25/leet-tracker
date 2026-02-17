import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';

import Dashboard from './Dashboard';
import { db } from '@/storage/db';

/* ------------------------------------------------------------------ */
/*  Mock useDashboard so Dashboard mounts instantly with stub refresh   */
/* ------------------------------------------------------------------ */
const refreshProgressMock = vi.fn().mockResolvedValue(undefined);
const reloadProfilesMock = vi.fn().mockResolvedValue(undefined);
const dashboardHookState = {
  loading: false,
  syncing: false,
  progress: [],
  profiles: [
    {
      id: 'default',
      name: 'Default',
      description: '',
      goals: {},
      createdAt: '',
      isEditable: false,
    },
  ],
  activeProfileId: 'default',
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

/* ------------------------------------------------------------------ */

describe('Dashboard – Manage Profiles modal', () => {
  let getAllGoalProfilesSpy: ReturnType<typeof vi.spyOn>;
  let getActiveGoalProfileIdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    /* goal profiles returned to the ProfileManager inside the modal */
    const profiles = [
      {
        id: 'default',
        name: 'Default',
        description: '',
        goals: {},
        createdAt: '',
        isEditable: false,
      },
      { id: 'alt', name: 'Alt', description: '', goals: {}, createdAt: '', isEditable: true },
    ] as any;

    getAllGoalProfilesSpy = vi.spyOn(db, 'getAllGoalProfiles').mockResolvedValue(profiles);
    getActiveGoalProfileIdSpy = vi.spyOn(db, 'getActiveGoalProfileId').mockResolvedValue('default');
  });

  afterEach(() => {
    getAllGoalProfilesSpy.mockRestore();
    getActiveGoalProfileIdSpy.mockRestore();
  });

  it('opens and closes the Manage Profiles modal', async () => {
    const user = userEvent.setup();
    render(<Dashboard username="testuser" />);

    /* open modal */
    const openBtn = screen.getByRole('button', { name: /manage profiles/i });
    await user.click(openBtn);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /manage profiles/i })).toBeInTheDocument(),
    );

    /* close modal via "X” button */
    await user.click(screen.getByRole('button', { name: /close/i }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /manage profiles/i })).not.toBeInTheDocument(),
    );
  });
});
