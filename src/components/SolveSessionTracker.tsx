import { useState, useEffect } from 'react';
import { SolveSession } from '@/types/types';
import {
  getActiveSolveSession,
  endSolveSession,
  SOLVE_SESSION_STARTED_EVENT,
  SOLVE_SESSION_ENDED_EVENT,
} from '@/storage/solveSession';
import { db } from '@/storage/db';
import { updateRatingsFromSolve } from '@/domain/ratingSyncIntegration';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { ratingToColor } from '@/domain/problemRatings';

/**
 * Component that displays and manages an active solve session
 * Shows timer, problem info, and completion options
 */
export function SolveSessionTracker() {
  const [session, setSession] = useState<SolveSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  // Load active session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const username = await db.getUsername();
        if (!username) return;

        const activeSession = await getActiveSolveSession(username);
        setSession(activeSession);

        if (activeSession) {
          // Calculate elapsed time
          const elapsed = Math.floor((Date.now() - activeSession.startedAt) / 1000);
          setElapsedSeconds(elapsed);
        }
      } catch (error) {
        // Gracefully handle database errors (e.g., schema not at v6 in tests)
        console.warn('[SolveSessionTracker] Failed to load session:', error);
      }
    };

    loadSession();
  }, []);

  // Listen for session events
  useEffect(() => {
    const handleSessionStarted = async () => {
      try {
        const username = await db.getUsername();
        if (!username) return;

        const activeSession = await getActiveSolveSession(username);
        setSession(activeSession);
        setElapsedSeconds(0);
      } catch (error) {
        console.warn('[SolveSessionTracker] Failed to load session on start:', error);
      }
    };

    const handleSessionEnded = () => {
      setSession(null);
      setElapsedSeconds(0);
    };

    window.addEventListener(SOLVE_SESSION_STARTED_EVENT, handleSessionStarted);
    window.addEventListener(SOLVE_SESSION_ENDED_EVENT, handleSessionEnded);

    return () => {
      window.removeEventListener(SOLVE_SESSION_STARTED_EVENT, handleSessionStarted);
      window.removeEventListener(SOLVE_SESSION_ENDED_EVENT, handleSessionEnded);
    };
  }, []);

  // Timer effect
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  const handleComplete = async (completed: boolean) => {
    if (!session || isCompleting) return;

    setIsCompleting(true);
    try {
      const username = await db.getUsername();
      if (!username) return;

      // Create a solve record
      const solve = {
        slug: session.problem.slug,
        title: session.problem.title,
        timestamp: Math.floor(session.startedAt / 1000), // Convert to seconds
        status: completed ? 'Accepted' : 'failed',
        lang: 'unknown',
        difficulty: session.problem.difficulty,
        rating: session.problem.rating,
        tags: session.problem.tags,
        timeUsed: elapsedSeconds,
      };

      // Save solve to database
      await db.saveSolve(solve);

      // Update ratings
      await updateRatingsFromSolve(username, solve);

      // End session
      await endSolveSession(username);
      window.dispatchEvent(new CustomEvent(SOLVE_SESSION_ENDED_EVENT));

      // Dispatch solves updated event for UI refresh
      window.dispatchEvent(
        new CustomEvent('solves-updated', {
          detail: { count: 1 },
        }),
      );
    } catch (error) {
      console.error('[SolveSessionTracker] Failed to complete session:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleAbort = async () => {
    if (!session || isCompleting) return;

    setIsCompleting(true);
    try {
      const username = await db.getUsername();
      if (!username) return;

      // End session without updating ratings
      await endSolveSession(username);
      window.dispatchEvent(new CustomEvent(SOLVE_SESSION_ENDED_EVENT));
    } catch (error) {
      console.error('[SolveSessionTracker] Failed to abort session:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  if (!session) return null;

  const isOvertime = elapsedSeconds > session.timeLimit;
  const timeRemaining = Math.max(0, session.timeLimit - elapsedSeconds);
  const timeRemainingMinutes = Math.floor(timeRemaining / 60);
  const timeRemainingSeconds = Math.floor(timeRemaining % 60);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedSecondsDisplay = Math.floor(elapsedSeconds % 60);

  const timeLimitMinutes = Math.floor(session.timeLimit / 60);
  const timeLimitSeconds = Math.floor(session.timeLimit % 60);

  // Determine urgency color
  let timerColor = 'text-green-600 dark:text-green-400';
  if (isOvertime) {
    timerColor = 'text-red-600 dark:text-red-400';
  } else if (timeRemaining < 300) {
    // Less than 5 minutes
    timerColor = 'text-red-500 dark:text-red-400';
  } else if (timeRemaining < 600) {
    // Less than 10 minutes
    timerColor = 'text-yellow-600 dark:text-yellow-400';
  }

  const ratingColor = ratingToColor(session.problem.rating || 1500);
  const ratingColorClass =
    ratingColor === 'easy'
      ? 'text-green-600 dark:text-green-400'
      : ratingColor === 'medium'
        ? 'text-yellow-600 dark:text-yellow-500'
        : 'text-red-600 dark:text-red-400';

  return (
    <Card className="fixed bottom-4 right-4 w-96 p-4 shadow-lg border-2 border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-800 z-50">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-lg">Active Solve</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAbort}
            disabled={isCompleting}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Abort
          </Button>
        </div>

        {/* Problem Info */}
        <div>
          <h4 className="font-medium text-base mb-1 line-clamp-2">{session.problem.title}</h4>
          <div className="flex items-center gap-3 text-sm">
            <span className={`font-semibold ${ratingColorClass}`}>
              Rating: {session.problem.rating || '1500'}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              Limit: {timeLimitMinutes}:{timeLimitSeconds.toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Timer Display */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
          <div className={`text-4xl font-bold font-mono ${timerColor}`}>
            {elapsedMinutes}:{elapsedSecondsDisplay.toString().padStart(2, '0')}
          </div>
          {isOvertime ? (
            <div className="text-sm text-red-600 dark:text-red-400 mt-1 font-semibold">
              OVERTIME
            </div>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {timeRemainingMinutes}:{timeRemainingSeconds.toString().padStart(2, '0')} remaining
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => handleComplete(true)}
            disabled={isCompleting}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Completed
          </Button>
          <Button
            onClick={() => handleComplete(false)}
            disabled={isCompleting}
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Did Not Complete
          </Button>
        </div>

        {/* Info Message */}
        <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-950 p-2 rounded">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>
            Rating will be updated based on your performance. Abort to cancel without affecting your
            rating.
          </p>
        </div>
      </div>
    </Card>
  );
}
