import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { trackRecommendationClicked } from '@/utils/analytics';
import { Button } from '@/components/ui/button';
import { useTimeAgo } from '@/hooks/useTimeAgo';
import type { ProblemLite } from '@/types/recommendation';

function DifficultyBadge({ level }: { level: string }) {
  const lvl = level.toLowerCase();
  const classes =
    lvl === 'easy'
      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
      : lvl === 'medium'
        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
        : 'bg-rose-100 text-rose-800 hover:bg-rose-200';
  const label = lvl.charAt(0).toUpperCase() + lvl.slice(1);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${classes}`}
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
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {problems.map((p) => (
        <Card key={p.slug} className="flex flex-col">
          <CardHeader className="p-4 pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base">{p.title}</CardTitle>
              <DifficultyBadge level={p.difficulty} />
            </div>
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
          <CardFooter className="p-4 pt-2 mt-auto flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => {
                console.info('[ProblemCards] Solve on LeetCode clicked', {
                  slug: p.slug,
                  bucket,
                });
                trackRecommendationClicked(p.slug, bucket, (p.tags && p.tags[0]) || 'unknown');
                const popup = window.open(`https://leetcode.com/problems/${p.slug}`, '_blank');
                if (popup === null) {
                  console.error('[ProblemCards] LeetCode popup was blocked by the browser');
                } else {
                  console.info('[ProblemCards] LeetCode popup opened successfully');
                }
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Solve on LeetCode
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
