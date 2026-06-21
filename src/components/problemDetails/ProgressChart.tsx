import type { Solve } from '@/types/types';
import { getDisplayScore, formatHintLabel } from '@/domain/problemDetails';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  submissions: Solve[][];
  height?: number;
  width?: number;
  onPointClick?: (_solve: Solve) => void;
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatShortDate = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const getYear = (timestamp: number) => {
  return new Date(timestamp * 1000).getFullYear().toString();
};

const getScoreColor = (score: number, isEstimated: boolean) => {
  if (isEstimated) return '#9ca3af'; // gray
  if (score >= 80) return '#10b981'; // emerald
  if (score >= 50) return '#f59e0b'; // amber
  return '#f43f5e'; // rose
};

/**
 * Chart showing score progression over time for a problem's submission groups
 */
export default function ProgressChart({
  submissions,
  height = 180,
  width = 500,
  onPointClick,
}: Props) {
  if (!submissions || submissions.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
        No submission data available
      </div>
    );
  }

  const chartPadding = { top: 20, right: 30, bottom: 50, left: 40 };
  const innerWidth = width - chartPadding.left - chartPadding.right;
  const innerHeight = height - chartPadding.top - chartPadding.bottom;

  // Flatten submission groups to individual data points (newest solve from each group)
  // Reverse to show chronological order (oldest to newest)
  const dataPoints = [...submissions].reverse().map((group) => {
    const newestInGroup = group[0]; // Already sorted newest first
    const { score, isEstimated } = getDisplayScore(newestInGroup);
    return {
      solve: newestInGroup,
      score,
      isEstimated,
    };
  });

  const pointSpacing = dataPoints.length > 1 ? innerWidth / (dataPoints.length - 1) : 0;

  return (
    <TooltipProvider>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Y-axis */}
        <line
          x1={chartPadding.left}
          y1={chartPadding.top}
          x2={chartPadding.left}
          y2={height - chartPadding.bottom}
          stroke="currentColor"
          strokeOpacity={0.2}
        />
        {/* X-axis */}
        <line
          x1={chartPadding.left}
          y1={height - chartPadding.bottom}
          x2={width - chartPadding.right}
          y2={height - chartPadding.bottom}
          stroke="currentColor"
          strokeOpacity={0.2}
        />

        {/* Y-axis labels and grid lines */}
        {[0, 25, 50, 75, 100].map((value) => (
          <g key={value}>
            <text
              x={chartPadding.left - 8}
              y={chartPadding.top + innerHeight - (value / 100) * innerHeight}
              textAnchor="end"
              alignmentBaseline="middle"
              className="text-[10px] fill-muted-foreground"
            >
              {value}
            </text>
            <line
              x1={chartPadding.left}
              y1={chartPadding.top + innerHeight - (value / 100) * innerHeight}
              x2={width - chartPadding.right}
              y2={chartPadding.top + innerHeight - (value / 100) * innerHeight}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeDasharray="4,4"
            />
          </g>
        ))}

        {/* Line connecting points */}
        {dataPoints.length > 1 && (
          <path
            d={dataPoints
              .map((point, i) => {
                const x =
                  dataPoints.length === 1
                    ? chartPadding.left + innerWidth / 2
                    : chartPadding.left + i * pointSpacing;
                const y = chartPadding.top + innerHeight - (point.score / 100) * innerHeight;
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
              })
              .join(' ')}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeWidth={1.5}
          />
        )}

        {/* Data points and X-axis labels */}
        {dataPoints.map((point, index) => {
          const x =
            dataPoints.length === 1
              ? chartPadding.left + innerWidth / 2
              : chartPadding.left + index * pointSpacing;
          const y = chartPadding.top + innerHeight - (point.score / 100) * innerHeight;

          return (
            <g key={point.solve.timestamp}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <circle
                    cx={x}
                    cy={y}
                    r={6}
                    className="cursor-pointer hover:r-8 transition-all"
                    style={{ fill: getScoreColor(point.score, point.isEstimated) }}
                    onClick={() => onPointClick?.(point.solve)}
                  >
                    <title>View in Solve History</title>
                  </circle>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <p className="font-medium">{formatDate(point.solve.timestamp)}</p>
                    <p>
                      Score: {point.score}
                      {point.isEstimated && ' (estimated)'}
                    </p>
                    <p>Hints: {formatHintLabel(point.solve.usedHints)}</p>
                  </div>
                </TooltipContent>
              </Tooltip>

              {/* X-axis label - vertical tilted timestamp with year on second line */}
              <text
                x={x}
                y={height - chartPadding.bottom + 8}
                textAnchor="start"
                className="text-[9px] fill-muted-foreground"
                transform={`rotate(45, ${x}, ${height - chartPadding.bottom + 8})`}
              >
                <tspan x={x} dy="0">
                  {formatShortDate(point.solve.timestamp)}
                </tspan>
                <tspan x={x} dy="10">
                  {getYear(point.solve.timestamp)}
                </tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </TooltipProvider>
  );
}
