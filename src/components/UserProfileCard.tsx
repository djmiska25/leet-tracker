import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRatings, Solve } from '@/types/types';
import { getLowerBoundRating, getRatingDisplayText } from '@/domain/eloRating';
import { useMemo } from 'react';

interface UserProfileCardProps {
  username: string;
  ratings: UserRatings | null;
  solves: Solve[];
}

function getRatingColor(rating: number) {
  if (rating >= 1900) return 'text-red-600 dark:text-red-400';
  if (rating >= 1500) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

export function UserProfileCard({ username, ratings, solves }: UserProfileCardProps) {
  const stats = useMemo(() => {
    const uniqueSolved = new Set<string>();
    const byDifficulty = {
      Easy: 0,
      Medium: 0,
      Hard: 0,
    };

    solves.forEach((solve) => {
      // Only count success status
      if (solve.status === 'Accepted' && !uniqueSolved.has(solve.slug)) {
        uniqueSolved.add(solve.slug);
        // Normalize difficulty case
        const diff = solve.difficulty
          ? ((solve.difficulty.charAt(0).toUpperCase() +
              solve.difficulty.slice(1).toLowerCase()) as keyof typeof byDifficulty)
          : 'Medium'; // Default fallback

        if (byDifficulty[diff] !== undefined) {
          byDifficulty[diff]++;
        }
      }
    });

    return { total: uniqueSolved.size, byDifficulty };
  }, [solves]);

  const ratingCategories = useMemo(() => {
    if (!ratings?.categories) return [];
    return Object.entries(ratings.categories)
      .map(([category, data]) => ({
        category,
        rating: data?.rating || 0,
        rd: data?.rd || 0,
      }))
      .sort((a, b) => b.rating - a.rating); // Sort by highest rating
  }, [ratings]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-2xl font-bold">{username}</CardTitle>
            <p className="text-gray-500 text-sm">LeetCode Tracker Profile</p>
          </div>
          <div className="text-right">
            <div
              className={`text-3xl font-bold font-mono ${getRatingColor(ratings?.global.rating || 0)}`}
              title={
                ratings?.global
                  ? getRatingDisplayText(ratings.global.rating, ratings.global.rd)
                  : undefined
              }
            >
              {ratings?.global.rating
                ? getLowerBoundRating(ratings.global.rating, ratings.global.rd)
                : 'Unrated'}
            </div>
            <p className="text-xs text-gray-500">Global Rating</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Solved Counts */}
        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
            <div className="text-3xl font-bold">{stats.total}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mt-1">
              Solved
            </div>
          </div>
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3 text-green-700 dark:text-green-400">
            <div className="text-xl font-bold">{stats.byDifficulty.Easy}</div>
            <div className="text-xs opacity-80 uppercase tracking-wide">Easy</div>
          </div>
          <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-3 text-yellow-700 dark:text-yellow-400">
            <div className="text-xl font-bold">{stats.byDifficulty.Medium}</div>
            <div className="text-xs opacity-80 uppercase tracking-wide">Medium</div>
          </div>
          <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-3 text-red-700 dark:text-red-400">
            <div className="text-xl font-bold">{stats.byDifficulty.Hard}</div>
            <div className="text-xs opacity-80 uppercase tracking-wide">Hard</div>
          </div>
        </div>

        {/* Category Ratings */}
        {ratingCategories.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 text-gray-500 uppercase tracking-wider">
              Top Category Ratings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ratingCategories.slice(0, 9).map(({ category, rating, rd }) => (
                <div
                  key={category}
                  className="flex justify-between items-center p-2 rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800"
                >
                  <span className="font-medium truncate mr-2 text-sm">{category}</span>
                  <span
                    className={`font-mono font-bold ${getRatingColor(rating)}`}
                    title={getRatingDisplayText(rating, rd)}
                  >
                    {getLowerBoundRating(rating, rd)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
