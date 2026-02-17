import { useState, useEffect, useRef } from 'react';
import { RefreshCcw, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useDashboard } from '@/hooks/useDashboard';
import { ProfileManager } from '@/components/ProfileManager';
import { getCategorySuggestions, getRandomSuggestions } from '@/domain/recommendations';
import { getLowerBoundRating, getRatingDisplayText } from '@/domain/eloRating';
import { CategoryRecommendation } from '@/types/recommendation';
import { trackSyncCompleted } from '@/utils/analytics';
import { triggerManualSync, SOLVES_UPDATED_EVENT } from '@/domain/extensionPoller';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTimeAgo } from '@/hooks/useTimeAgo';
import ProblemCards from './ProblemCards';
import type { Category } from '@/types/types';
import { UserProfileCard } from './UserProfileCard';

export const RANDOM_TAG: Category = 'Random';
const initialSuggestions = {} as Record<Category, CategoryRecommendation>;

interface DashboardProps {
  username: string;
}

export default function Dashboard({ username }: DashboardProps) {
  // Use Dashboard-specific hook for progress and profile management
  const {
    loading,
    syncing,
    progress,
    profiles,
    activeProfileId,
    refreshProgress,
    reloadProfiles,
    ratings,
    solves,
  } = useDashboard();

  const [open, setOpen] = useState<Category | null>(null);
  const [suggestions, setSuggestions] =
    useState<Record<Category, CategoryRecommendation>>(initialSuggestions);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [profileManagerOpen, setProfileManagerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const timeAgo = useTimeAgo(lastSynced);

  // Listen for solves-updated events to update lastSynced timestamp
  // useDashboard already handles the progress refresh
  useEffect(() => {
    const handleSolvesUpdated = () => {
      setLastSynced(new Date());
    };

    window.addEventListener(SOLVES_UPDATED_EVENT, handleSolvesUpdated);
    return () => window.removeEventListener(SOLVES_UPDATED_EVENT, handleSolvesUpdated);
  }, []);

  // Handle click outside and Escape key for profile dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
      }
    };

    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [profileOpen]);

  /* update the last-synced timestamp once initial data is ready */
  useEffect(() => {
    if (!loading) setLastSynced(new Date());
  }, [loading]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  // Use ratings to sort categories if available, otherwise fallback to score
  // We want to sort by "need for improvement" or "closeness to target"?
  // Or just by rating ascending (weakest first)?
  // Original was adjustedScore ascending (lowest completion first).
  // Let's stick to adjustedScore for now as it's a good proxy for "work needed",
  // but if ratings are available, maybe sort by rating asc?
  // Let's keep existing logic but rely on the progress array which is already sorted by score usually?
  // Actually, let's sort by rating if available. Lowest rating first.
  const sorted = [...progress].sort((a, b) => {
    if (ratings?.categories) {
      const ratingA = ratings.categories[a.tag]?.rating || 0;
      const ratingB = ratings.categories[b.tag]?.rating || 0;
      if (ratingA !== ratingB) return ratingA - ratingB; // Ascending rating
    }
    return a.adjustedScore - b.adjustedScore;
  });

  /* ----- events ----- */

  const handleToggle = async (tag: Category) => {
    if (open === tag) return setOpen(null);
    setOpen(tag);
    if (!suggestions[tag]) {
      const rec =
        tag === RANDOM_TAG
          ? await getRandomSuggestions(progress.map((p) => p.tag))
          : await getCategorySuggestions(tag);
      setSuggestions((prev) => ({ ...prev, [tag]: rec }));
    }
  };

  const handleSync = async () => {
    const startTime = Date.now();
    try {
      if (import.meta.env.VITE_USE_DEMO_DATA === 'true') {
        await import('@/api/demo').then((m) =>
          import('@/storage/db').then(({ db }) => m.syncDemoSolves(db)),
        );
      } else {
        const count = await triggerManualSync();
        if (count > 0) {
          const durationMs = Date.now() - startTime;
          trackSyncCompleted(count, durationMs, true);
          try {
            await refreshProgress();
          } catch (_e) {
            /* ignore cleanup error */
          }
        }
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleSelectProfile = (id: string) => {
    // Only reload if valid ID
    if (!id) return;

    // We need to use ProfileManager or db to set active profile
    // But ProfileManager handles the DB update.
    // Here we can just assume the modal isn't used for selection.
    // Actually, we need to update the active profile in DB.
    import('@/storage/db').then(async ({ db }) => {
      await db.setActiveGoalProfile(id);
      await refreshProgress();
    });
    setProfileOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Profile Manager Dialog */}
      {profileManagerOpen && (
        <ProfileManager
          onDone={() => {
            setProfileManagerOpen(false);
            reloadProfiles();
            refreshProgress();
            setLastSynced(new Date());
          }}
        />
      )}

      {/* ───────── Main Content ───────── */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold">Dashboard</h2>
            <p className="text-muted-foreground">Your progress & recommendations</p>
            <p className="text-xs text-muted-foreground">Last synced: {timeAgo}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Profile controls wrapper */}
            <div className="flex items-center gap-2" data-tour="profile-controls">
              {/* Profile selector */}
              <div className="relative" ref={profileDropdownRef}>
                <Button
                  variant="outline"
                  onClick={() => setProfileOpen((o) => !o)}
                  className="px-3 py-2"
                  aria-expanded={profileOpen}
                  aria-haspopup="listbox"
                >
                  Profile:{' '}
                  {profiles.find((p) => p.id === activeProfileId)?.name ?? 'Select profile'}
                </Button>
                {profileOpen && (
                  <div
                    className="absolute right-0 z-20 mt-1 w-44 max-h-60 overflow-y-auto rounded-md border bg-card shadow"
                    role="listbox"
                    aria-label="Profile selection"
                  >
                    {profiles.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProfile(p.id)}
                        className={`block w-full text-left px-3 py-1.5 text-sm ${
                          p.id === activeProfileId ? 'bg-muted font-medium' : 'hover:bg-muted'
                        }`}
                        role="option"
                        aria-selected={p.id === activeProfileId}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Manage Profiles */}
              <Button variant="outline" onClick={() => setProfileManagerOpen(true)}>
                Manage Profiles
              </Button>
            </div>
            {/* Sync button */}
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 sync-now-btn"
            >
              <RefreshCcw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </Button>
          </div>
        </header>

        {/* User Profile Card */}
        <UserProfileCard username={username} ratings={ratings} solves={solves} />

        {/* Category list */}
        <Card className="progress-score-card">
          <CardHeader className="px-4 py-2">
            <CardTitle>Problem Categories</CardTitle>
            <CardDescription>Practice by category to improve your rating</CardDescription>
          </CardHeader>

          <CardContent className="divide-y px-4">
            <>
              {/* Random category row */}
              <div key="random" className="py-4 space-y-3">
                <button
                  className="w-full text-left space-y-2"
                  onClick={() => handleToggle(RANDOM_TAG)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center w-full gap-2">
                    <div className="w-[180px] flex items-center gap-2 pl-1 whitespace-normal break-words">
                      <ChevronDown
                        className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${
                          open === RANDOM_TAG ? 'rotate-180' : 'rotate-0'
                        }`}
                      />
                      <span>{RANDOM_TAG}</span>
                    </div>
                  </div>
                </button>

                <div
                  className={clsx(
                    'overflow-hidden transition-all duration-300 origin-top',
                    open === RANDOM_TAG ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
                  )}
                >
                  {suggestions[RANDOM_TAG] && (
                    <Tabs defaultValue="fundamentals" className="mt-4 w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="fundamentals">Fundamentals</TabsTrigger>
                        <TabsTrigger value="refresh">Refresh</TabsTrigger>
                        <TabsTrigger value="new">New</TabsTrigger>
                      </TabsList>

                      {(['fundamentals', 'refresh', 'new'] as const).map((bucket) => (
                        <TabsContent key={bucket} value={bucket} className="mt-4">
                          <ProblemCards
                            problems={suggestions[RANDOM_TAG][bucket]}
                            bucket={bucket}
                            showTags={false}
                          />
                        </TabsContent>
                      ))}
                    </Tabs>
                  )}
                </div>
              </div>

              {/* Category rows */}
              {sorted.map((cat, index) => {
                const categoryRatingData = ratings?.categories?.[cat.tag];
                const categoryRating = categoryRatingData?.rating || 1500;
                const categoryRd = categoryRatingData?.rd || 1500; // High uncertainty for unrated
                const displayRating = getLowerBoundRating(categoryRating, categoryRd);

                // Goal is now a rating target directly (e.g., 1500, 1700, 1900)
                const targetRating = Math.round(cat.goal);

                // Calculate progress bar percent (clamped 0-100)
                // If rating is 0 (uninitiated), bar is 0.
                const progressPercent =
                  targetRating > 0 ? Math.min(100, (displayRating / targetRating) * 100) : 0;

                const isOpen = open === cat.tag;

                return (
                  <div
                    key={cat.tag}
                    className="py-4 space-y-3"
                    {...(index === 0 ? { 'data-tour': 'category-row-0' } : {})}
                  >
                    {/* Summary row */}
                    <button
                      className="w-full text-left space-y-2"
                      onClick={() => handleToggle(cat.tag)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center w-full gap-2">
                        {/* Category name – fixed width so bars align */}
                        <div className="w-[180px] flex items-center gap-2 pl-1 whitespace-normal break-words">
                          <ChevronDown
                            className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${
                              isOpen ? 'rotate-180' : 'rotate-0'
                            }`}
                          />
                          <span>{cat.tag}</span>
                        </div>

                        {/* Rating Display */}
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span
                              className="font-medium"
                              title={getRatingDisplayText(categoryRating, categoryRd)}
                            >
                              Current: {displayRating}
                            </span>
                            <span className="text-muted-foreground mr-1">
                              Target: {targetRating}
                            </span>
                          </div>
                          <div className="h-2">
                            <ProgressBar value={progressPercent} />
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Detailed breakdown / recommendations */}
                    <div
                      className={clsx(
                        'overflow-hidden transition-all duration-300 origin-top',
                        isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
                      )}
                    >
                      {suggestions[cat.tag] && (
                        <Tabs defaultValue="fundamentals" className="mt-4 w-full">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="fundamentals">Fundamentals</TabsTrigger>
                            <TabsTrigger value="refresh">Refresh</TabsTrigger>
                            <TabsTrigger value="new">New</TabsTrigger>
                          </TabsList>

                          {(['fundamentals', 'refresh', 'new'] as const).map((bucket) => (
                            <TabsContent key={bucket} value={bucket} className="mt-4">
                              <ProblemCards
                                problems={suggestions[cat.tag][bucket]}
                                bucket={bucket}
                                showTags={false}
                              />
                            </TabsContent>
                          ))}
                        </Tabs>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
