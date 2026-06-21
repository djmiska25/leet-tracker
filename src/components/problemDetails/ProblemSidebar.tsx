import { useState, useMemo } from 'react';
import { ChevronLeft, Filter, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { ProblemWithSubmissions, ProblemFilters } from '@/domain/problemDetails';
import type { Difficulty, HintType } from '@/types/types';

interface Props {
  problems: ProblemWithSubmissions[];
  allProblems: ProblemWithSubmissions[];
  selectedSlug: string | null;
  onSelect: (_: ProblemWithSubmissions) => void;
  onHide: () => void;
  filters: ProblemFilters;
  onFiltersChange: (_: ProblemFilters) => void;
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
    <Badge variant="outline" className={`text-[11px] px-1.5 py-0.5 ${colors[difficulty]}`}>
      {difficulty}
    </Badge>
  );
};

const getScoreBadgeClass = (score: number | null, isEstimated: boolean) => {
  if (score === null || isEstimated) {
    return 'bg-gray-100 text-gray-600';
  }
  if (score >= 80) return 'bg-emerald-100 text-emerald-800';
  if (score >= 50) return 'bg-amber-100 text-amber-800';
  return 'bg-rose-100 text-rose-800';
};

export default function ProblemSidebar({
  problems,
  allProblems,
  selectedSlug,
  onSelect,
  onHide,
  filters,
  onFiltersChange,
}: Props) {
  const [showFilters, setShowFilters] = useState(false);

  const categories = useMemo(() => {
    // Extract unique categories from ALL problems (not filtered)
    const uniqueCategories = new Set<string>();
    allProblems.forEach((problem) => {
      problem.tags?.forEach((tag) => uniqueCategories.add(tag));
    });
    // Convert to sorted array and prepend 'All'
    return ['All', ...Array.from(uniqueCategories).sort()];
  }, [allProblems]);

  const hasActiveFilters =
    filters.category !== 'All' ||
    filters.difficulty !== 'all' ||
    filters.hintsUsed !== 'all' ||
    (filters.scoreThreshold !== undefined && filters.scoreThreshold >= 0) ||
    filters.includeNoFeedback === false;

  const clearFilters = () => {
    onFiltersChange({
      category: 'All',
      difficulty: 'all',
      hintsUsed: 'all',
      scoreComparison: 'greater',
      scoreThreshold: undefined,
      includeNoFeedback: true,
    });
  };

  return (
    <div className="w-full sm:w-80 h-full shrink-0">
      <Card className="h-full flex flex-col">
        <CardHeader className="px-4 pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Solved Problems</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant={showFilters ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="p-1"
              >
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onHide} className="p-1">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleContent className="space-y-3 pt-3">
              <Separator />

              {/* Category Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select
                  value={filters.category || 'All'}
                  onValueChange={(v: string) => onFiltersChange({ ...filters, category: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-xs">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Difficulty Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Difficulty</Label>
                <Select
                  value={filters.difficulty || 'all'}
                  onValueChange={(v: string) =>
                    onFiltersChange({ ...filters, difficulty: v as Difficulty | 'all' })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      All
                    </SelectItem>
                    <SelectItem value="Easy" className="text-xs">
                      Easy
                    </SelectItem>
                    <SelectItem value="Medium" className="text-xs">
                      Medium
                    </SelectItem>
                    <SelectItem value="Hard" className="text-xs">
                      Hard
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Hints Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Hints Used</Label>
                <Select
                  value={filters.hintsUsed || 'all'}
                  onValueChange={(v: string) =>
                    onFiltersChange({ ...filters, hintsUsed: v as HintType | 'all' })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      All
                    </SelectItem>
                    <SelectItem value="none" className="text-xs">
                      No hints
                    </SelectItem>
                    <SelectItem value="leetcode_hint" className="text-xs">
                      LeetCode Hint
                    </SelectItem>
                    <SelectItem value="solution_peek" className="text-xs">
                      Solution Peek
                    </SelectItem>
                    <SelectItem value="gpt_help" className="text-xs">
                      GPT Help
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Score Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Final Score</Label>
                <div className="flex gap-2">
                  <Select
                    value={filters.scoreComparison || 'greater'}
                    onValueChange={(v: string) =>
                      onFiltersChange({ ...filters, scoreComparison: v as 'greater' | 'less' })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="greater" className="text-xs">
                        ≥
                      </SelectItem>
                      <SelectItem value="less" className="text-xs">
                        ≤
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Score"
                    value={filters.scoreThreshold ?? ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        scoreThreshold: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    className="h-8 text-xs"
                    min={0}
                    max={100}
                  />
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <Checkbox
                    id="includeNoFeedback"
                    checked={filters.includeNoFeedback ?? true}
                    onCheckedChange={(checked: boolean) =>
                      onFiltersChange({ ...filters, includeNoFeedback: checked as boolean })
                    }
                  />
                  <Label htmlFor="includeNoFeedback" className="text-xs cursor-pointer">
                    Include no feedback submissions?
                  </Label>
                </div>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-xs">
                  <X className="h-3 w-3 mr-1" />
                  Clear Filters
                </Button>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardHeader>

        <CardContent className="pb-4 flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="space-y-2 p-4 pt-0">
              {problems.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  No problems match the current filters
                </div>
              ) : (
                problems.map((problem) => (
                  <div
                    key={problem.slug}
                    onClick={() => onSelect(problem)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                      selectedSlug === problem.slug ? 'bg-accent border-primary' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-medium text-sm line-clamp-2 flex-1">{problem.title}</p>
                      {getDifficultyBadge(problem.difficulty)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Latest:</span>
                      <span>{formatDate(problem.lastSolved)}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0.5 border-0 ${getScoreBadgeClass(
                          problem.latestScore,
                          problem.latestScoreIsEstimated,
                        )}`}
                      >
                        {problem.latestScore ?? 80}
                        {problem.latestScoreIsEstimated && ' (est.)'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
