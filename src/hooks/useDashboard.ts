import { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/toast';
import { computeDashboardProgress } from '@/domain/dashboardProgress';
import { loadProfilesForCategories } from '@/domain/goalProfiles';
import { db } from '@/storage/db';
import { SOLVES_UPDATED_EVENT } from '@/domain/extensionPoller';
import { trackProfileGoalsIgnored } from '@/utils/analytics';
import type { CategoryProgress } from '@/types/progress';
import type { GoalProfile } from '@/types/types';

interface DashboardState {
  loading: boolean; // Only true during initial load
  syncing: boolean; // For "Sync Now" button spinner only
  progress: CategoryProgress[];
  profile: GoalProfile | null;
  profiles: GoalProfile[]; // All available profiles
  activeProfileId: string | undefined; // ID of the active profile
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
 */
export function useDashboard() {
  const toast = useToast();
  const ignoredGoalsFingerprint = useRef('');
  const [state, setState] = useState<DashboardState>({
    loading: true,
    syncing: false,
    progress: [],
    profile: null,
    profiles: [],
    activeProfileId: undefined,
  });

  const notifyIgnoredGoals = useCallback(
    (profile: GoalProfile, ignoredGoals: string[]) => {
      const fingerprint = `${profile.id}:${ignoredGoals.slice().sort().join('|')}`;
      if (ignoredGoals.length === 0) {
        ignoredGoalsFingerprint.current = '';
        return;
      }
      if (fingerprint === ignoredGoalsFingerprint.current) return;

      ignoredGoalsFingerprint.current = fingerprint;
      const visibleGoals = ignoredGoals.slice(0, 5).join(', ');
      const remaining = ignoredGoals.length - 5;
      const suffix = remaining > 0 ? `, … (+${remaining} more)` : '';
      toast(
        `Some goals are temporarily hidden because their categories aren't available in the current problem catalog: ${visibleGoals}${suffix}. Try syncing again. If those categories were permanently removed, create a new profile using the available categories.`,
        'warning',
      );
      trackProfileGoalsIgnored({
        profileId: profile.id,
        profileName: profile.name,
        ignoredGoals,
      });
    },
    [toast],
  );

  const refreshProgress = useCallback(
    async (showSyncing = false) => {
      try {
        if (showSyncing) {
          setState((prev) => ({ ...prev, syncing: true }));
        }

        const categories = await db.getCatalogCategories();
        if (categories.length === 0) {
          toast('No categories found in the problem catalog', 'error');
          throw new Error('No categories found in the problem catalog');
        }

        const { profiles, activeProfile, activeProfileId, ignoredGoals } =
          await loadProfilesForCategories(categories);
        notifyIgnoredGoals(activeProfile, ignoredGoals);

        // Compute progress with the profile
        const progress = await computeDashboardProgress(activeProfile);

        setState({
          loading: false,
          syncing: false,
          progress,
          profile: activeProfile,
          profiles,
          activeProfileId: activeProfileId ?? profiles[0]?.id,
        });
      } catch (err: any) {
        console.error('[useDashboard] Failed to compute progress:', err);
        toast('Failed to update progress', 'error');
        setState((prev) => ({ ...prev, loading: false, syncing: false }));
      }
    },
    [notifyIgnoredGoals, toast],
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
    return () => window.removeEventListener(SOLVES_UPDATED_EVENT, handleSolvesUpdated);
  }, [refreshProgress]);

  // Manual refresh for "Sync Now" button (shows syncing state)
  const manualRefresh = useCallback(async () => {
    await refreshProgress(true); // Show syncing spinner
  }, [refreshProgress]);

  // Reload profiles without recomputing progress (for ProfileManager changes)
  const reloadProfiles = useCallback(async () => {
    const categories = await db.getCatalogCategories();
    const { profiles, activeProfile, activeProfileId, ignoredGoals } =
      await loadProfilesForCategories(categories);
    notifyIgnoredGoals(activeProfile, ignoredGoals);
    setState((prev) => ({
      ...prev,
      profiles,
      activeProfileId: activeProfileId ?? profiles[0]?.id,
    }));
  }, [notifyIgnoredGoals]);

  return {
    ...state,
    refreshProgress: manualRefresh, // For "Sync Now" button
    reloadProfiles, // For ProfileManager to refresh profile list
  };
}
