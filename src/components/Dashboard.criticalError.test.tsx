import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Dashboard from './Dashboard';

// Mock the database to prevent unhandled promise rejections
vi.mock('@/storage/db', () => ({
  db: {
    getAllGoalProfiles: vi.fn().mockResolvedValue([]),
    getActiveGoalProfileId: vi.fn().mockResolvedValue(undefined),
    saveGoalProfile: vi.fn().mockResolvedValue('default'),
    setActiveGoalProfile: vi.fn().mockResolvedValue('default'),
  },
}));

// Mock useDashboard to provide test data
vi.mock('@/hooks/useDashboard', () => ({
  useDashboard: () => ({
    loading: false,
    syncing: false,
    progress: [],
    profiles: [],
    activeProfileId: undefined,
    profile: null,
    refreshProgress: vi.fn(),
    reloadProfiles: vi.fn(),
    ratings: {
      global: { rating: 1500, rd: 350, volatility: 0.06, lastUpdated: Date.now(), solveCount: 0 },
      categories: {},
    },
    solves: [],
  }),
}));

describe('<Dashboard> critical error state', () => {
  it('no longer displays critical error (handled by App.tsx now)', () => {
    // Dashboard no longer handles critical errors - they are handled by App.tsx
    // This test verifies Dashboard renders normally even if progress is empty
    render(<Dashboard username="testuser" />);

    // Dashboard should render without critical error UI
    expect(screen.queryByText(/Progress data could not be loaded/i)).not.toBeInTheDocument();
  });
});
