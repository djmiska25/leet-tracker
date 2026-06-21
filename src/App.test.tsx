import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from './App';
import { TutorialProvider } from '@/tutorial/TutorialContext';

// Mock database functions
vi.mock('@/storage/db', () => ({
  db: {
    getUsername: vi.fn().mockResolvedValue('testuser'),
    getAllGoalProfiles: vi.fn().mockResolvedValue([]),
    getActiveGoalProfileId: vi.fn().mockResolvedValue(null),
    getAllSolvesSorted: vi.fn().mockResolvedValue([]),
    getProblemListLastUpdated: vi.fn().mockResolvedValue(Date.now()),
    getAllProblems: vi.fn().mockResolvedValue([]),
  },
  getTutorialActive: vi.fn().mockResolvedValue(false),
  getTutorialSeen: vi.fn().mockResolvedValue(false),
  getTutorialStep: vi.fn().mockResolvedValue(0),
  getTutorialStartedWithUser: vi.fn().mockResolvedValue(null),
  getOnboardingComplete: vi.fn().mockResolvedValue(true),
}));

// Mock useInitApp to return loading state
vi.mock('@/hooks/useInitApp', () => ({
  useInitApp: vi.fn(() => ({
    loading: true,
    username: null,
    progress: [],
    criticalError: false,
    refresh: vi.fn(),
  })),
}));

test('renders the main heading', () => {
  render(
    <MemoryRouter>
      <TutorialProvider>
        <App />
      </TutorialProvider>
    </MemoryRouter>,
  );
  expect(screen.getByText(/Loading…/i)).toBeInTheDocument();
});
