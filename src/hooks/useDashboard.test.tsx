import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDashboard } from './useDashboard';
import { computeDashboardProgress } from '@/domain/dashboardProgress';
import { loadProfilesForCategories } from '@/domain/goalProfiles';
import { db } from '@/storage/db';
import type { GoalProfile } from '@/types/types';
import type { CategoryProgress } from '@/types/progress';

vi.mock('@/domain/dashboardProgress');
vi.mock('@/domain/goalProfiles');

const mockToast = vi.fn();
vi.mock('@/components/ui/toast', () => ({
  useToast: () => mockToast,
}));

describe('useDashboard', () => {
  const mockProfile: GoalProfile = {
    id: 'test-profile',
    name: 'Test Profile',
    description: '',
    goals: { Array: 0.6 },
    createdAt: '',
    isEditable: true,
  };

  const mockProfiles: GoalProfile[] = [
    mockProfile,
    {
      id: 'another-profile',
      name: 'Another Profile',
      description: '',
      goals: { String: 0.7 },
      createdAt: '',
      isEditable: true,
    },
  ];

  const mockProgress: CategoryProgress[] = [
    {
      tag: 'Array',
      goal: 0.6,
      estimatedScore: 0.5,
      confidenceLevel: 0.8,
      adjustedScore: 0.4,
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(db, 'getCatalogCategories').mockResolvedValue(['Array', 'String']);
    vi.mocked(loadProfilesForCategories).mockResolvedValue({
      profiles: mockProfiles,
      activeProfile: mockProfile,
      activeProfileId: 'test-profile',
      prunedGoalCount: 0,
    });
    vi.mocked(computeDashboardProgress).mockResolvedValue(mockProgress);
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

    expect(db.getCatalogCategories).toHaveBeenCalledTimes(1);
    expect(loadProfilesForCategories).toHaveBeenCalledTimes(1);
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
        goal: 0.6,
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
        goal: 0.6,
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

    expect(mockToast).toHaveBeenCalledWith('Failed to update progress', 'error');
    expect(result.current.progress).toEqual([]);
  });

  it('handles errors during manual refresh', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.mocked(computeDashboardProgress).mockRejectedValue(new Error('Compute error'));

    await act(async () => {
      await result.current.refreshProgress();
    });

    expect(mockToast).toHaveBeenCalledWith('Failed to update progress', 'error');
    expect(result.current.syncing).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('cleans up event listener on unmount', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useDashboard());

    await waitFor(() => expect(loadProfilesForCategories).toHaveBeenCalled());

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

  it('updates profile when loadProfilesForCategories returns new profile', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    const newProfile: GoalProfile = {
      id: 'new-profile',
      name: 'New Profile',
      description: '',
      goals: { 'Hash Table': 0.5 },
      createdAt: '',
      isEditable: true,
    };
    const updatedProfiles: GoalProfile[] = [...mockProfiles, newProfile];
    vi.mocked(loadProfilesForCategories).mockResolvedValue({
      profiles: updatedProfiles,
      activeProfile: newProfile,
      activeProfileId: 'new-profile',
      prunedGoalCount: 0,
    });

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
        goals: { Tree: 0.8 },
        createdAt: '',
        isEditable: true,
      },
    ];
    vi.mocked(loadProfilesForCategories).mockResolvedValue({
      profiles: updatedProfiles,
      activeProfile: mockProfile,
      activeProfileId: 'third-profile',
      prunedGoalCount: 0,
    });

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
