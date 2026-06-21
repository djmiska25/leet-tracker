import { useEffect, useState, useCallback } from 'react';
import { db } from '@/storage/db';
import type { Solve } from '@/types/types';
import { SOLVES_UPDATED_EVENT } from '@/domain/extensionPoller';

// We aren't handling errors here, we let the error boundary catch them.
interface State {
  loading: boolean;
  solves: Solve[];
}

/**
 * Loads the full solve list from IndexedDB (newest first) and provides
 * a refresh helper for when a solve is updated in place.
 *
 * Includes passive listener for automatic updates when new solves are detected.
 */
export function useSolveHistory() {
  const [state, setState] = useState<State>({ loading: true, solves: [] });

  const load = useCallback(async () => {
    const solves = await db.getAllSolvesSorted();
    setState({ loading: false, solves });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Re-read solves from the DB (e.g. after an edit) */
  const refresh = async () => {
    setState((s) => ({ ...s, loading: true }));
    await load();
    // Notify other components that solves have been updated
    window.dispatchEvent(new CustomEvent(SOLVES_UPDATED_EVENT, { detail: { count: 0 } }));
  };

  // Listen for updates from the global poller (managed by App.tsx)
  useEffect(() => {
    const handleSolvesUpdated = async (event: Event) => {
      const newSolvesCount = (event as CustomEvent<{ count: number }>).detail.count;
      console.log(`[useSolveHistory] ${newSolvesCount} new solves detected, refreshing solve list`);
      await load(); // Refresh without setting loading state (silent refresh)
    };

    window.addEventListener(SOLVES_UPDATED_EVENT, handleSolvesUpdated);
    return () => window.removeEventListener(SOLVES_UPDATED_EVENT, handleSolvesUpdated);
  }, [load]);

  return { ...state, refresh };
}
