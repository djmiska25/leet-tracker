import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { TutorialProvider } from '../tutorial/TutorialContext';
import * as db from '@/storage/db';

// Mock the database functions
vi.mock('@/storage/db', () => ({
  db: {
    getUsername: vi.fn(),
    setUsername: vi.fn(),
    getAllGoalProfiles: vi.fn(),
    getActiveGoalProfileId: vi.fn(),
    getAllSolvesSorted: vi.fn(),
    getProblemListLastUpdated: vi.fn(),
    getAllProblems: vi.fn(),
  },
  getTutorialActive: vi.fn(),
  setTutorialActive: vi.fn(),
  getTutorialStep: vi.fn(),
  setTutorialStep: vi.fn(),
  getTutorialStartedWithUser: vi.fn(),
  setTutorialStartedWithUser: vi.fn(),
  markTutorialSeen: vi.fn(),
  clearTutorialSeen: vi.fn(),
  getTutorialSeen: vi.fn(),
  getPrevUser: vi.fn(),
  setPrevUser: vi.fn(),
  clearPrevUser: vi.fn(),
  getOnboardingComplete: vi.fn(),
  markOnboardingComplete: vi.fn(),
  clearOnboardingComplete: vi.fn(),
}));

// Mock extension detection
vi.mock('@/api/extensionBridge', () => ({
  checkExtensionInstalled: vi.fn().mockResolvedValue(true),
}));

// Mock useInitApp hook
const mockUseInitApp = vi.fn();
vi.mock('@/hooks/useInitApp', () => ({
  useInitApp: () => mockUseInitApp(),
}));

// Mock analytics
vi.mock('@/utils/analytics', () => ({
  initializeAttribution: vi.fn(),
  trackTourStarted: vi.fn(),
  trackTourFinished: vi.fn(),
  trackTourStep: vi.fn(),
}));

describe('App Tutorial Integration', () => {
  // Fixed timestamp to avoid flakiness from staleness checks
  const MOCK_NOW = 1700000000000;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock environment variables using vi.stubEnv
    vi.stubEnv('VITE_DEMO_USERNAME', 'test-demo-user');

    // Set escape hatch to bypass extension check in tests
    localStorage.setItem('leet-tracker-skip-extension-check', 'true');

    // Default mock implementations
    (db.getTutorialActive as Mock).mockResolvedValue(false);
    (db.getTutorialStep as Mock).mockResolvedValue(0);
    (db.getTutorialStartedWithUser as Mock).mockResolvedValue('demo');
    (db.getTutorialSeen as Mock).mockResolvedValue(false);
    (db.getOnboardingComplete as Mock).mockResolvedValue(true); // Assume onboarding complete
    (db.db.getUsername as Mock).mockResolvedValue('testuser');
    (db.db.getAllGoalProfiles as Mock).mockResolvedValue([]);
    (db.db.getActiveGoalProfileId as Mock).mockResolvedValue(null);
    (db.db.getAllSolvesSorted as Mock).mockResolvedValue([]);
    (db.db.getProblemListLastUpdated as Mock).mockResolvedValue(MOCK_NOW); // Mock catalog as recently updated
    (db.db.getAllProblems as Mock).mockResolvedValue([]); // Mock problem catalog

    // Mock useInitApp to return signed-in user
    mockUseInitApp.mockReturnValue({
      loading: false,
      username: 'testuser', // This is what App.tsx checks for signed-in state
      progress: [
        // CategoryProgress[] - array of progress objects
        {
          tag: 'Easy',
          goal: 0.8,
          estimatedScore: 0.6,
          confidenceLevel: 0.7,
          adjustedScore: 0.42,
        },
        {
          tag: 'Medium',
          goal: 0.6,
          estimatedScore: 0.4,
          confidenceLevel: 0.5,
          adjustedScore: 0.2,
        },
      ],
      criticalError: false,
      refresh: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.removeItem('leet-tracker-skip-extension-check');
  });

  describe('Tutorial prompt display', () => {
    it('should show tutorial prompt for new users', async () => {
      render(
        <MemoryRouter>
          <TutorialProvider>
            <App />
          </TutorialProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/Welcome to LeetTracker!/i)).toBeInTheDocument();
      });
    });

    it('should not show prompt if tutorial was already seen', async () => {
      (db.getTutorialSeen as Mock).mockResolvedValue(true);

      render(
        <MemoryRouter>
          <TutorialProvider>
            <App />
          </TutorialProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        // Should not show the tutorial prompt
        expect(screen.queryByText(/Welcome to LeetTracker!/i)).not.toBeInTheDocument();
      });
    });

    it('should not show prompt while loading', async () => {
      mockUseInitApp.mockReturnValue({
        loading: true,
        username: null,
      });

      render(
        <MemoryRouter>
          <TutorialProvider>
            <App />
          </TutorialProvider>
        </MemoryRouter>,
      );

      expect(screen.getByText(/Loading…/i)).toBeInTheDocument();
      expect(screen.queryByText(/Welcome to LeetTracker!/i)).not.toBeInTheDocument();
    });
  });

  describe('Tutorial flow initiation', () => {
    it('should start tutorial when "Start Tour" is clicked', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <TutorialProvider>
            <App />
          </TutorialProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/Welcome to LeetTracker!/i)).toBeInTheDocument();
      });

      const startButton = screen.getByText(/Start tutorial/i);
      await act(async () => {
        await user.click(startButton);
      });

      // Should switch to demo user and start tutorial
      const demoUsername = import.meta.env.VITE_DEMO_USERNAME || 'leet-tracker-demo-user';
      await waitFor(() => {
        expect(db.setPrevUser).toHaveBeenCalledWith('testuser');
        expect(db.db.setUsername).toHaveBeenCalledWith(demoUsername);
      });
    });

    it('should dismiss prompt when "Maybe Later" is clicked', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <TutorialProvider>
            <App />
          </TutorialProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/Welcome to LeetTracker!/i)).toBeInTheDocument();
      });

      const laterButton = screen.getByText(/Maybe Later/i);
      await act(async () => {
        await user.click(laterButton);
      });

      await waitFor(() => {
        expect(screen.queryByText(/Welcome to LeetTracker!/i)).not.toBeInTheDocument();
      });
    });

    it('should permanently dismiss prompt when "Never Show Again" is clicked', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <TutorialProvider>
            <App />
          </TutorialProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/Welcome to LeetTracker!/i)).toBeInTheDocument();
      });

      const neverButton = screen.getByText(/Don't show again/i);
      await act(async () => {
        await user.click(neverButton);
      });

      await waitFor(() => {
        expect(db.markTutorialSeen).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(/Welcome to LeetTracker!/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Demo user handling', () => {
    it('should start tutorial immediately for demo user when switched from normal user', async () => {
      (db.getTutorialStartedWithUser as Mock).mockResolvedValue('normal');
      mockUseInitApp.mockReturnValue({
        loading: false,
        username: 'test-demo-user',
        progress: [],
        criticalError: false,
        refresh: vi.fn(),
      });

      render(
        <MemoryRouter>
          <TutorialProvider>
            <App />
          </TutorialProvider>
        </MemoryRouter>,
      );

      // Should not show prompt, should start tutorial directly
      await waitFor(() => {
        expect(screen.queryByText(/Welcome to LeetTracker!/i)).not.toBeInTheDocument();
      });
    });

    it('should resume tutorial for demo user with existing tutorial state', async () => {
      (db.getTutorialActive as Mock).mockResolvedValue(true);
      (db.getTutorialStep as Mock).mockResolvedValue(2);
      mockUseInitApp.mockReturnValue({
        loading: false,
        username: 'test-demo-user',
        progress: [],
        criticalError: false,
        refresh: vi.fn(),
      });

      render(
        <MemoryRouter>
          <TutorialProvider>
            <App />
          </TutorialProvider>
        </MemoryRouter>,
      );

      // Should resume tutorial without showing prompt
      await waitFor(() => {
        expect(screen.queryByText(/Welcome to LeetTracker!/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Navigation event handling', () => {
    it('should handle leet:navigate-to-history event', async () => {
      render(
        <MemoryRouter>
          <TutorialProvider>
            <App />
          </TutorialProvider>
        </MemoryRouter>,
      );

      // Initially should show dashboard
      await waitFor(() => {
        expect(screen.queryByText(/Loading…/i)).not.toBeInTheDocument();
      });

      // Dispatch navigation event
      act(() => {
        window.dispatchEvent(new CustomEvent('leet:navigate-to-history'));
      });

      // Should switch to history view
      await waitFor(() => {
        expect(screen.getByText(/Solve History/i)).toBeInTheDocument();
      });
    });

    it('should handle leet:show-tutorial-prompt event', async () => {
      (db.getTutorialSeen as Mock).mockResolvedValue(true); // Tutorial was seen

      render(
        <MemoryRouter>
          <TutorialProvider>
            <App />
          </TutorialProvider>
        </MemoryRouter>,
      );

      // Initially no prompt should show
      await waitFor(() => {
        expect(screen.queryByText(/Welcome to LeetTracker!/i)).not.toBeInTheDocument();
      });

      // Dispatch show prompt event (like from Help button)
      act(() => {
        window.dispatchEvent(new CustomEvent('leet:show-tutorial-prompt'));
      });

      // Should show the prompt
      await waitFor(() => {
        expect(screen.getByText(/Welcome to LeetTracker!/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      (db.db.getUsername as Mock).mockRejectedValue(new Error('DB Error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <MemoryRouter>
          <TutorialProvider>
            <App />
          </TutorialProvider>
        </MemoryRouter>,
      );

      // Should still render without crashing
      await waitFor(() => {
        expect(screen.queryByText(/Loading…/i)).not.toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });
});
