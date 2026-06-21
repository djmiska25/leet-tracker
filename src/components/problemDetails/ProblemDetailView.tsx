import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Copy, Eye, EyeOff, ExternalLink, Lightbulb, Link2 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/toast';
import type { ProblemWithSubmissions } from '@/domain/problemDetails';
import type { Difficulty, Solve } from '@/types/types';
import { getDisplayScore, formatHintLabel } from '@/domain/problemDetails';
import ProgressChart from './ProgressChart';

interface Props {
  problem: ProblemWithSubmissions | null;
  onShowList: () => void;
  showListButton: boolean;
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getDifficultyBadge = (difficulty?: Difficulty) => {
  if (!difficulty) return null;

  const colors = {
    Easy: 'bg-emerald-100 text-emerald-800',
    Medium: 'bg-amber-100 text-amber-800',
    Hard: 'bg-rose-100 text-rose-800',
  };

  return (
    <Badge variant="outline" className={`${colors[difficulty]}`}>
      {difficulty}
    </Badge>
  );
};

const getScoreBadgeClass = (score: number, isEstimated: boolean) => {
  if (isEstimated) return 'bg-gray-100 text-gray-600';
  if (score >= 80) return 'bg-emerald-100 text-emerald-800';
  if (score >= 50) return 'bg-amber-100 text-amber-800';
  return 'bg-rose-100 text-rose-800';
};

/** Stable composite key for a solve */
const solveId = (s: Solve) => `${s.slug}|${s.timestamp}`;

export default function ProblemDetailView({ problem, onShowList, showListButton }: Props) {
  const [expandedDescription, setExpandedDescription] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  // Reset expanded state when problem changes
  useEffect(() => {
    setExpandedDescription(false);
  }, [problem?.slug]);

  if (!problem) {
    return (
      <Card className="h-full flex flex-col">
        {showListButton && (
          <div className="p-4 border-b">
            <Button variant="ghost" size="sm" onClick={onShowList} className="gap-2">
              <ChevronRight className="h-4 w-4 rotate-180" />
              Show List
            </Button>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center text-muted-foreground p-6 text-center">
          Select a problem from the list to view details
        </div>
      </Card>
    );
  }

  const copyInsightsPrompt = () => {
    // Flatten all submission groups and get display scores
    const allSubmissions = problem.submissionGroups.flat();
    const submissionsData = allSubmissions
      .map((s) => {
        const { score, isEstimated } = getDisplayScore(s);
        return `- Date: ${formatDate(s.timestamp)}, Score: ${score}${isEstimated ? ' (estimated)' : ''}, Hints Used: ${formatHintLabel(s.usedHints)}`;
      })
      .join('\n');

    const description = problem.problem?.description || 'Description not available';

    const prompt = `Please analyze my progress on this LeetCode problem and provide insights:

Problem: ${problem.title}
Difficulty: ${problem.difficulty || 'Unknown'}
Category: ${problem.tags?.join(', ') || 'Unknown'}

Description:
${description}

My Submission History (${problem.totalSubmissions} total submissions):
${submissionsData}

Please analyze:
1. My progress over time (improving, declining, or stagnant)
2. Patterns in my approach (reliance on hints, consistency)
3. Specific areas where I seem to struggle with this problem
4. Recommendations for improvement
5. Related concepts I should review

Format your response as a structured analysis with clear sections.`;

    navigator.clipboard.writeText(prompt);
    toast({
      title: 'Prompt copied!',
      description: 'Paste this prompt into your preferred AI assistant for insights.',
    } as any);
  };

  const navigateToSolve = (solve: Solve) => {
    const id = encodeURIComponent(solveId(solve));
    navigate(`/solve-history/${id}`);
  };

  return (
    <Card className="h-full">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold break-words">{problem.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              {getDifficultyBadge(problem.difficulty)}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Last solved: {formatDate(problem.lastSolved)} • {problem.totalSubmissions} total
              submissions
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() =>
                window.open(`https://leetcode.com/problems/${problem.slug}/`, '_blank')
              }
            >
              <ExternalLink className="h-4 w-4" />
              View on LeetCode
            </Button>
            {showListButton && (
              <Button variant="outline" size="sm" onClick={onShowList} className="gap-2">
                <ChevronRight className="h-4 w-4 rotate-180" />
                Show List
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        <ScrollArea className="h-[calc(100vh-16rem)]">
          <div className="space-y-6">
            {/* Problem Description */}
            {problem.problem?.description && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold">Problem Description</h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedDescription(!expandedDescription)}
                    >
                      {expandedDescription ? (
                        <EyeOff className="h-4 w-4 mr-1" />
                      ) : (
                        <Eye className="h-4 w-4 mr-1" />
                      )}
                      {expandedDescription ? 'Collapse' : 'Expand'}
                    </Button>
                  </div>
                  <div
                    className={`text-sm text-muted-foreground prose prose-sm max-w-none ${
                      !expandedDescription && 'line-clamp-3'
                    }`}
                    dangerouslySetInnerHTML={{ __html: problem.problem.description }}
                  />
                  {problem.tags && problem.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-4">
                      {problem.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Separator className="my-6" />
              </>
            )}

            {/* Grouped Submission Timeline Chart */}
            <div>
              <h2 className="text-lg font-semibold mb-1">Solve Timeline</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Track your progress over time. Each point represents a solve (submission group).
              </p>

              <div className="mb-4">
                <ProgressChart
                  submissions={problem.submissionGroups}
                  onPointClick={navigateToSolve}
                />
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span>High (80+)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-amber-500" />
                  <span>Medium (50-79)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-rose-500" />
                  <span>Low (&lt;50)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-gray-400" />
                  <span>Estimated (no feedback provided)</span>
                </div>
              </div>

              {/* Get Insights */}
              <div className="space-y-3 mt-6">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-12 w-12 mt-0.5 text-orange-500" />
                  <p className="text-sm text-muted-foreground">
                    Get AI-powered insights on this problem. A summary of your prior solve history,
                    where you went wrong, what has been holding you up to solve the problem without
                    help, and recommendations for other problems that target your challenge points.
                    Paste the provided prompt into ChatGPT, Claude, or your preferred AI assistant.
                  </p>
                </div>
                <Button onClick={copyInsightsPrompt} variant="outline" className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copy Insights Prompt
                </Button>
              </div>
            </div>

            <Separator className="my-6" />

            {/* All Submissions Table */}
            <div>
              <h2 className="text-lg font-semibold mb-3">All Solves</h2>
              <div className="space-y-2">
                {problem.submissionGroups.map((group, groupIndex) => {
                  // For each group, show the latest solve (head)
                  const solve = group[0];
                  const { score, isEstimated } = getDisplayScore(solve);
                  const submissionNumber = problem.submissionGroups.length - groupIndex;

                  return (
                    <div
                      key={solve.timestamp}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground w-8">
                          #{submissionNumber}
                        </span>
                        <span className="text-sm">{formatDate(solve.timestamp)}</span>
                        <Badge variant="outline" className="text-xs">
                          {formatHintLabel(solve.usedHints)}
                        </Badge>
                        {group.length > 1 && (
                          <Badge variant="secondary" className="text-xs">
                            {group.length} attempts
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={`border-0 ${getScoreBadgeClass(score, isEstimated)}`}
                        >
                          {score}
                          {isEstimated && ' (est.)'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          title="View in Solve History"
                          onClick={() => navigateToSolve(solve)}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
