import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProblemDetails } from '@/hooks/useProblemDetails';
import type { ProblemWithSubmissions, ProblemFilters } from '@/domain/problemDetails';
import ProblemSidebar from './ProblemSidebar';
import ProblemDetailView from './ProblemDetailView';

interface Props {
  activeSlug?: string;
}

export default function ProblemDetails({ activeSlug }: Props) {
  const navigate = useNavigate();

  /* ---------- Filter state ---------- */
  const [filters, setFilters] = useState<ProblemFilters>({
    category: 'All',
    difficulty: 'all',
    hintsUsed: 'all',
    scoreComparison: 'greater',
    scoreThreshold: undefined,
    includeNoFeedback: true,
  });

  const { loading, problems, allProblems } = useProblemDetails(filters);

  /* ---------- UI state ---------- */
  const [sidebarOpen, setSidebarOpen] = useState(true); // desktop (≥ sm)
  const [mobileView, setMobileView] = useState<'listing' | 'details'>('listing'); // < sm
  const [selected, setSelected] = useState<ProblemWithSubmissions | null>(null);

  /* Sync the selected problem when the problems list updates or URL param changes */
  useEffect(() => {
    if (loading || !problems.length) return;

    if (activeSlug) {
      // URL dictates selection
      const decodedSlug = decodeURIComponent(activeSlug);
      const match = problems.find((p) => p.slug === decodedSlug);
      if (match) {
        if (match !== selected) {
          setSelected(match);
        }
      } else {
        // Slug in URL not found -> invalid link? clear it.
        navigate('/problem-details', { replace: true });
      }
    } else if (!selected && problems.length) {
      // No URL param, and nothing selected -> default to most recent
      setSelected(problems[0]);
    } else if (selected) {
      // If we have a selection, but no URL param, ensure selection is still valid in fresh list
      const fresh = problems.find((p) => p.slug === selected.slug);
      if (fresh && fresh !== selected) {
        setSelected(fresh);
      }
    }
  }, [problems, activeSlug, loading, selected, navigate]);

  if (loading) return <p className="p-6">Loading…</p>;

  /* ---------- handlers ---------- */
  const selectProblem = (p: ProblemWithSubmissions) => {
    // Navigate to URL; useEffect will handle setting 'selected'
    const slug = encodeURIComponent(p.slug);
    navigate(`/problem-details/${slug}`);

    if (window.innerWidth < 640) {
      setMobileView('details'); // take over full width on mobile
    }
  };

  const hideSidebar = () => {
    if (window.innerWidth < 640) {
      setMobileView('details');
    } else {
      setSidebarOpen(false);
    }
  };

  const showList = () => {
    if (window.innerWidth < 640) {
      setMobileView('listing');
    } else {
      setSidebarOpen(true);
    }
  };

  /* ---------- render ---------- */
  const listVisible =
    typeof window !== 'undefined' && window.innerWidth < 640
      ? mobileView === 'listing'
      : sidebarOpen;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div
        className={`relative flex h-[calc(100vh-8rem)] transition-[gap] duration-300 ease-in-out ${
          sidebarOpen ? 'sm:gap-6' : 'sm:gap-0'
        }`}
      >
        {/* ───────── Listing / Sidebar ───────── */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out
            ${mobileView === 'listing' ? 'basis-full opacity-100' : 'basis-0 opacity-0'}
            ${sidebarOpen ? 'sm:basis-[20rem] sm:flex-none sm:opacity-100' : 'sm:basis-0 sm:opacity-0'}
          `}
        >
          <ProblemSidebar
            problems={problems}
            allProblems={allProblems}
            selectedSlug={selected?.slug ?? null}
            onSelect={selectProblem}
            onHide={hideSidebar}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>

        {/* ───────── Detail View ───────── */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out
            ${mobileView === 'details' ? 'basis-full opacity-100' : 'basis-0 opacity-0'}
            sm:flex-1 sm:min-w-0 sm:opacity-100
          `}
        >
          <div className="w-full max-w-4xl mx-auto h-full">
            {selected ? (
              <ProblemDetailView
                problem={selected}
                onShowList={showList}
                showListButton={!listVisible}
              />
            ) : (
              <p className="p-6 text-muted-foreground">Select a problem to view details.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
