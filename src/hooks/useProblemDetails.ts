import { useEffect, useState, useCallback, useMemo } from 'react';
import { db } from '@/storage/db';
import type { Problem } from '@/types/types';
import { SOLVES_UPDATED_EVENT } from '@/domain/extensionPoller';
import {
  groupSolvesByProblem,
  filterProblems,
  type ProblemWithSubmissions,
  type ProblemFilters,
} from '@/domain/problemDetails';

interface State {
  loading: boolean;
  problems: ProblemWithSubmissions[];
  problemCatalog: Map<string, Problem>;
}

/**
 * Hook to load and manage problem details data
 * Groups all solves by problem and provides filtering capabilities
 */
export function useProblemDetails(filters?: ProblemFilters) {
  const [state, setState] = useState<State>({
    loading: true,
    problems: [],
    problemCatalog: new Map(),
  });

  const load = useCallback(async () => {
    // Load both solves and problem catalog
    const [solves, catalogArray] = await Promise.all([
      db.getAllSolvesSorted(),
      db.getAllProblems(),
    ]);

    // Convert catalog to map for fast lookups
    const problemCatalog = new Map<string, Problem>();
    for (const problem of catalogArray) {
      problemCatalog.set(problem.slug, problem);
    }

    // Group solves by problem
    const problems = groupSolvesByProblem(solves, problemCatalog);

    setState({ loading: false, problems, problemCatalog });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Apply filters to problems
  const filteredProblems = useMemo(() => {
    if (!filters) return state.problems;
    return filterProblems(state.problems, filters);
  }, [state.problems, filters]);

  /** Re-read data from the DB (e.g. after an edit) */
  const refresh = async () => {
    setState((s) => ({ ...s, loading: true }));
    await load();
  };

  // Listen for updates from the global poller (managed by App.tsx)
  useEffect(() => {
    const handleSolvesUpdated = async (event: Event) => {
      const newSolvesCount = (event as CustomEvent<{ count: number }>).detail.count;
      console.log(
        `[useProblemDetails] ${newSolvesCount} new solves detected, refreshing problem list`,
      );
      await load(); // Refresh without setting loading state (silent refresh)
    };

    window.addEventListener(SOLVES_UPDATED_EVENT, handleSolvesUpdated);
    return () => window.removeEventListener(SOLVES_UPDATED_EVENT, handleSolvesUpdated);
  }, [load]);

  return {
    loading: state.loading,
    problems: filteredProblems,
    allProblems: state.problems,
    problemCatalog: state.problemCatalog,
    refresh,
  };
}
