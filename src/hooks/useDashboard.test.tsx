import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDashboard } from './useDashboard';
import { computeDashboardProgress } from '@/domain/dashboardProgress';
import { getActiveOrInitProfile } from '@/domain/goalProfiles';
import { db } from '@/storage/db';
import type { GoalProfile } from '@/types/types';
import type { CategoryProgress } from '@/types/progress';

vi.mock('@/domain/dashboardProgress');
vi.mock('@/domain/goalProfiles');
vi.mock('@/storage/ratings', () => ({
  getRatings: vi.fn().mockResolvedValue({ global: { rating: 1500 }, categories: {} }),
}));
vi.mock('@/storage/db', () => ({
  db: {
    getAllGoalProfiles: vi.fn(),
    getActiveGoalProfileId: vi.fn(),
    setActiveGoalProfile: vi.fn(),
    getUsername: vi.fn(),
    getAllSolves: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('@/components/ui/toast', () => ({
  useToast: () => mockToast,
}));

describe('useDashboard', () => {
  const mockProfile: GoalProfile = {
    id: 'test-profile',
    name: 'Test Profile',
    description: '',
    goals: { Array: 1500 },
    createdAt: '',
    isEditable: true,
  };

  const mockProfiles: GoalProfile[] = [
    mockProfile,
    {
      id: 'another-profile',
      name: 'Another Profile',
      description: '',
      goals: { String: 1700 },
      createdAt: '',
      isEditable: true,
    },
  ];

  const mockProgress: CategoryProgress[] = [
    {
      tag: 'Array',
      goal: 1500,
      estimatedScore: 0.5,
      confidenceLevel: 0.8,
      adjustedScore: 0.4,
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getActiveOrInitProfile).mockResolvedValue(mockProfile);
    vi.mocked(computeDashboardProgress).mockResolvedValue(mockProgress);
    vi.mocked(db.getAllGoalProfiles).mockResolvedValue(mockProfiles);
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue('test-profile');
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('starts with loading state', () => {
    const { result } = renderHook(() => useDashboard());

    expect(result.current.loading).toBe(true);
    expect(result.current.syncing).toBe(false);
    expect(result.current.progress).toEqual([]);
    expect(result.current.profile).toBeNull();
    expect(result.current.profiles).toEqual([]);
    expect(result.current.activeProfileId).toBeUndefined();
  });

  it('loads progress and profiles on mount', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getActiveOrInitProfile).toHaveBeenCalledTimes(1);
    expect(db.getAllGoalProfiles).toHaveBeenCalledTimes(1);
    expect(db.getActiveGoalProfileId).toHaveBeenCalledTimes(1);
    expect(computeDashboardProgress).toHaveBeenCalledWith(mockProfile);
    expect(result.current.progress).toEqual(mockProgress);
    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.profiles).toEqual(mockProfiles);
    expect(result.current.activeProfileId).toBe('test-profile');
  });

  it('sets loading to false after initial load', async () => {
    const { result } = renderHook(() => useDashboard());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.loading).toBe(false);
  });

  it('refreshProgress updates progress data', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    const newProgress: CategoryProgress[] = [
      {
        tag: 'Array',
        goal: 1500,
        estimatedScore: 0.7,
        confidenceLevel: 0.9,
        adjustedScore: 0.63,
      },
    ];
    vi.mocked(computeDashboardProgress).mockResolvedValue(newProgress);

    await act(async () => {
      await result.current.refreshProgress();
    });

    expect(result.current.progress).toEqual(newProgress);
  });

  it('sets syncing state during manual refresh', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Mock with a promise we control to observe syncing state
    let resolveProgress: (_value: any) => void;
    const progressPromise = new Promise((resolve) => {
      resolveProgress = resolve;
    });
    vi.mocked(computeDashboardProgress).mockReturnValue(progressPromise as any);

    // Start the refresh in background
    const refreshPromise = result.current.refreshProgress();

    // Wait for syncing to be set to true
    await waitFor(() => expect(result.current.syncing).toBe(true));

    // Now resolve the progress promise
    await act(async () => {
      resolveProgress!(mockProgress);
      await refreshPromise;
    });

    // Should be reset after completion
    expect(result.current.syncing).toBe(false);
  });

  it('does not set loading during manual refresh', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refreshProgress();
    });

    expect(result.current.loading).toBe(false);
  });

  it('listens to solves-updated events', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    const newProgress: CategoryProgress[] = [
      {
        tag: 'Array',
        goal: 1500,
        estimatedScore: 0.8,
        confidenceLevel: 0.85,
        adjustedScore: 0.68,
      },
    ];
    vi.mocked(computeDashboardProgress).mockResolvedValue(newProgress);

    // Trigger solves-updated event
    act(() => {
      window.dispatchEvent(new Event('solves-updated'));
    });

    await waitFor(() => expect(result.current.progress).toEqual(newProgress));
  });

  it('silent updates do not show syncing state', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    let syncingDuringUpdate = false;
    vi.mocked(computeDashboardProgress).mockImplementation(async () => {
      syncingDuringUpdate = result.current.syncing;
      return mockProgress;
    });

    // Trigger silent update via event
    act(() => {
      window.dispatchEvent(new Event('solves-updated'));
    });

    await waitFor(() => expect(computeDashboardProgress).toHaveBeenCalledTimes(2));

    expect(syncingDuringUpdate).toBe(false);
  });

  it('handles errors during initial load', async () => {
    vi.mocked(computeDashboardProgress).mockRejectedValue(new Error('DB error'));

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockToast).toHaveBeenCalledWith('Failed to update progress', 'error', 'DB error');
    expect(result.current.progress).toEqual([]);
  });

  it('handles errors during manual refresh', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.mocked(computeDashboardProgress).mockRejectedValue(new Error('Compute error'));

    await act(async () => {
      await result.current.refreshProgress();
    });

    expect(mockToast).toHaveBeenCalledWith('Failed to update progress', 'error', 'Compute error');
    expect(result.current.syncing).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('cleans up event listener on unmount', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useDashboard());

    await waitFor(() => expect(getActiveOrInitProfile).toHaveBeenCalled());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('solves-updated', expect.any(Function));
  });

  it('handles multiple rapid solves-updated events', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Trigger multiple events rapidly
    act(() => {
      window.dispatchEvent(new Event('solves-updated'));
      window.dispatchEvent(new Event('solves-updated'));
      window.dispatchEvent(new Event('solves-updated'));
    });

    await waitFor(() => expect(computeDashboardProgress).toHaveBeenCalledTimes(4)); // 1 initial + 3 events

    expect(result.current.progress).toEqual(mockProgress);
  });

  it('updates profile when getActiveOrInitProfile returns new profile', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    const newProfile: GoalProfile = {
      id: 'new-profile',
      name: 'New Profile',
      description: '',
      goals: { 'Hash Table': 1400 },
      createdAt: '',
      isEditable: true,
    };
    const updatedProfiles: GoalProfile[] = [...mockProfiles, newProfile];
    vi.mocked(getActiveOrInitProfile).mockResolvedValue(newProfile);
    vi.mocked(db.getAllGoalProfiles).mockResolvedValue(updatedProfiles);
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue('new-profile');

    await act(async () => {
      await result.current.refreshProgress();
    });

    expect(result.current.profile).toEqual(newProfile);
    expect(result.current.profiles).toEqual(updatedProfiles);
    expect(result.current.activeProfileId).toBe('new-profile');
    expect(computeDashboardProgress).toHaveBeenCalledWith(newProfile);
  });

  it('reloadProfiles updates profile list without recomputing progress', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    const initialCallCount = vi.mocked(computeDashboardProgress).mock.calls.length;

    const updatedProfiles: GoalProfile[] = [
      ...mockProfiles,
      {
        id: 'third-profile',
        name: 'Third Profile',
        description: '',
        goals: { Tree: 1900 },
        createdAt: '',
        isEditable: true,
      },
    ];
    vi.mocked(db.getAllGoalProfiles).mockResolvedValue(updatedProfiles);
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue('third-profile');

    await act(async () => {
      await result.current.reloadProfiles();
    });

    expect(result.current.profiles).toEqual(updatedProfiles);
    expect(result.current.activeProfileId).toBe('third-profile');
    // Should NOT have called computeDashboardProgress again
    expect(computeDashboardProgress).toHaveBeenCalledTimes(initialCallCount);
  });

  it('exposes refreshProgress function for manual refresh', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(typeof result.current.refreshProgress).toBe('function');
  });

  it('multiple manual refreshes work correctly', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refreshProgress();
    });

    await act(async () => {
      await result.current.refreshProgress();
    });

    await act(async () => {
      await result.current.refreshProgress();
    });

    expect(computeDashboardProgress).toHaveBeenCalledTimes(4); // 1 initial + 3 manual
  });
});
