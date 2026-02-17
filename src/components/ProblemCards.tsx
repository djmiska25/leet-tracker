import { ExternalLink, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { trackRecommendationClicked } from '@/utils/analytics';
import { Button } from '@/components/ui/button';
import { useTimeAgo } from '@/hooks/useTimeAgo';
import type { ProblemLite } from '@/types/recommendation';
import { ratingToColor, formatRating } from '@/domain/problemRatings';
import {
  startSolveSession,
  getActiveSolveSession,
  SOLVE_SESSION_STARTED_EVENT,
  SOLVE_SESSION_ENDED_EVENT,
} from '@/storage/solveSession';
import { db } from '@/storage/db';
import { useState, useEffect } from 'react';

function RatingBadge({
  slug,
  difficulty,
  rating,
}: {
  slug: string;
  difficulty: string;
  rating?: number;
}) {
  const displayRating = rating ?? undefined;
  const color =
    displayRating !== undefined
      ? ratingToColor(displayRating)
      : (difficulty.toLowerCase() as 'easy' | 'medium' | 'hard');
  const classes =
    color === 'easy'
      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
      : color === 'medium'
        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
        : 'bg-rose-100 text-rose-800 hover:bg-rose-200';
  const label = formatRating(slug, difficulty as any);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${classes}`}
      title={`Difficulty: ${difficulty}`}
    >
      {label}
    </span>
  );
}

function LastSolvedLabel({ ts }: { ts: number }) {
  const ago = useTimeAgo(new Date(ts * 1000));
  return (
    <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
      Last solved {ago}
    </span>
  );
}

export interface ProblemCardsProps {
  problems: ProblemLite[];
  bucket: 'fundamentals' | 'refresh' | 'new';
  showTags?: boolean;
}

export default function ProblemCards({ problems, bucket, showTags = true }: ProblemCardsProps) {
  const [startingSession, setStartingSession] = useState<string | null>(null);
  const [activeSessionSlug, setActiveSessionSlug] = useState<string | null>(null);

  // Load active session on mount and listen for changes
  useEffect(() => {
    const loadActiveSession = async () => {
      const username = await db.getUsername();
      if (!username) return;

      const session = await getActiveSolveSession(username);
      setActiveSessionSlug(session?.problem.slug ?? null);
    };

    loadActiveSession();

    const handleSessionStarted = () => loadActiveSession();
    const handleSessionEnded = () => setActiveSessionSlug(null);

    window.addEventListener(SOLVE_SESSION_STARTED_EVENT, handleSessionStarted);
    window.addEventListener(SOLVE_SESSION_ENDED_EVENT, handleSessionEnded);

    return () => {
      window.removeEventListener(SOLVE_SESSION_STARTED_EVENT, handleSessionStarted);
      window.removeEventListener(SOLVE_SESSION_ENDED_EVENT, handleSessionEnded);
    };
  }, []);

  const handleStartTimer = async (problem: ProblemLite) => {
    if (startingSession || activeSessionSlug) return;

    setStartingSession(problem.slug);
    try {
      const username = await db.getUsername();
      if (!username) {
        console.error('[ProblemCards] No username found');
        return;
      }

      // Get full problem data
      const fullProblem = await db.getProblem(problem.slug);
      if (!fullProblem) {
        console.error('[ProblemCards] Problem not found:', problem.slug);
        return;
      }

      // Start solve session
      await startSolveSession(username, fullProblem);

      // Emit event to update UI
      window.dispatchEvent(new CustomEvent(SOLVE_SESSION_STARTED_EVENT));

      // Track analytics
      trackRecommendationClicked(
        problem.slug,
        bucket,
        (problem.tags && problem.tags[0]) || 'unknown',
      );

      // Open LeetCode in new tab
      window.open(`https://leetcode.com/problems/${problem.slug}`, '_blank');
    } catch (error) {
      console.error('[ProblemCards] Failed to start solve session:', error);
    } finally {
      setStartingSession(null);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {problems.map((p) => {
        const isActive = activeSessionSlug === p.slug;
        const isStarting = startingSession === p.slug;

        return (
          <Card
            key={p.slug}
            className={`flex flex-col transition-all ${
              isActive
                ? 'border-2 border-yellow-500 dark:border-yellow-400 shadow-lg shadow-yellow-500/20'
                : ''
            }`}
          >
            <CardHeader className="p-4 pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-base">{p.title}</CardTitle>
                <RatingBadge slug={p.slug} difficulty={p.difficulty} rating={p.rating} />
              </div>
              {isActive && (
                <div className="mt-2">
                  <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">
                    ⏱️ Active Session
                  </Badge>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-4 pt-0 pb-2">
              <div className="flex flex-wrap gap-1 mt-1">
                {showTags && (
                  <>
                    {p.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[11px] px-1.5 py-0.5">
                        {tag}
                      </Badge>
                    ))}
                    {p.isFundamental && (
                      <Badge variant="secondary" className="text-[11px] px-1.5 py-0.5">
                        Fundamental
                      </Badge>
                    )}
                  </>
                )}
              </div>
              {bucket === 'refresh' && p.lastSolved && <LastSolvedLabel ts={p.lastSolved} />}
            </CardContent>
            <CardFooter className="p-4 pt-2 mt-auto flex gap-2">
              {isActive ? (
                <div className="flex-1 text-center text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                  Problem in progress...
                </div>
              ) : (
                <>
                  <Button
                    size="sm"
                    className="gap-1 flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleStartTimer(p)}
                    disabled={isStarting || activeSessionSlug !== null}
                  >
                    <Play className="h-4 w-4" />
                    {isStarting ? 'Starting...' : 'Start'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      trackRecommendationClicked(
                        p.slug,
                        bucket,
                        (p.tags && p.tags[0]) || 'unknown',
                      );
                      window.open(`https://leetcode.com/problems/${p.slug}`, '_blank');
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
