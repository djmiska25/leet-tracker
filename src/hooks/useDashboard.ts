import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { computeDashboardProgress } from '@/domain/dashboardProgress';
import { getActiveOrInitProfile } from '@/domain/goalProfiles';
import { SOLVES_UPDATED_EVENT } from '@/domain/extensionPoller';
import { db } from '@/storage/db';
import { getRatings } from '@/storage/ratings';
import type { CategoryProgress } from '@/types/progress';
import type { GoalProfile, UserRatings, Solve } from '@/types/types';

interface DashboardState {
  loading: boolean; // Only true during initial load
  syncing: boolean; // For "Sync Now" button spinner only
  progress: CategoryProgress[];
  profile: GoalProfile | null;
  profiles: GoalProfile[]; // All available profiles
  activeProfileId: string | undefined; // ID of the active profile
  ratings: UserRatings | null;
  solves: Solve[];
}

/**
 * Hook for Dashboard component to manage its own progress and profile state.
 * Listens to 'solves-updated' events and recomputes progress automatically.
 *
 * Initial load shows loading state, but subsequent updates are SILENT.
 * The `syncing` flag is only for the "Sync Now" button animation.
 *
 * This hook is responsible for:
 * - Loading and tracking all available profiles
 * - Tracking the active profile and passing it to computeDashboardProgress
 * - Providing profile switching functionality
 * - Fetching solves and ratings for display
 */
export function useDashboard() {
  const toast = useToast();
  const [state, setState] = useState<DashboardState>({
    loading: true,
    syncing: false,
    progress: [],
    profile: null,
    profiles: [],
    activeProfileId: undefined,
    ratings: null,
    solves: [],
  });

  const refreshProgress = useCallback(
    async (showSyncing = false) => {
      try {
        if (showSyncing) {
          setState((prev) => ({ ...prev, syncing: true }));
        }

        // Get the active profile (this initializes profiles if needed)
        const profile = await getActiveOrInitProfile();

        // Load all profiles and active profile ID
        const profiles = await db.getAllGoalProfiles();
        const activeProfileId = await db.getActiveGoalProfileId();
        const username = await db.getUsername();
        const solves = await db.getAllSolves();
        const ratings = username ? await getRatings(username) : null;

        // Compute progress with the profile
        const progress = await computeDashboardProgress(profile);

        setState({
          loading: false,
          syncing: false,
          progress,
          profile,
          profiles,
          activeProfileId: activeProfileId ?? profiles[0]?.id,
          ratings,
          solves,
        });
      } catch (err: any) {
        console.error('[useDashboard] Failed to compute progress:', err);
        toast('Failed to update progress', 'error', err instanceof Error ? err.message : undefined);
        setState((prev) => ({ ...prev, loading: false, syncing: false }));
      }
    },
    [toast],
  );

  // Initial load (shows loading state)
  useEffect(() => {
    refreshProgress(false);
  }, [refreshProgress]);

  // Listen for solve updates from extension poller (silent updates)
  useEffect(() => {
    const handleSolvesUpdated = () => {
      console.log('[useDashboard] Solves updated, refreshing progress silently');
      refreshProgress(false); // Silent update (no loading/syncing state)
    };

    window.addEventListener(SOLVES_UPDATED_EVENT, handleSolvesUpdated);
    window.addEventListener('ratings-updated', handleSolvesUpdated); // Also listen for rating changes
    return () => {
      window.removeEventListener(SOLVES_UPDATED_EVENT, handleSolvesUpdated);
      window.removeEventListener('ratings-updated', handleSolvesUpdated);
    };
  }, [refreshProgress]);

  // Manual refresh for "Sync Now" button (shows syncing state)
  const manualRefresh = useCallback(async () => {
    await refreshProgress(true); // Show syncing spinner
  }, [refreshProgress]);

  // Reload profiles without recomputing progress (for ProfileManager changes)
  const reloadProfiles = useCallback(async () => {
    const profiles = await db.getAllGoalProfiles();
    const activeProfileId = await db.getActiveGoalProfileId();
    setState((prev) => ({
      ...prev,
      profiles,
      activeProfileId: activeProfileId ?? profiles[0]?.id,
    }));
  }, []);

  return {
    ...state,
    refreshProgress: manualRefresh, // For "Sync Now" button
    reloadProfiles, // For ProfileManager to refresh profile list
  };
}
