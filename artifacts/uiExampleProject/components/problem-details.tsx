"use client"

import { useState, useMemo } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Filter,
  X,
  Lightbulb,
  ExternalLink,
  Link2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Submission {
  id: number
  date: Date
  score: number
  isEstimated: boolean
  hintsUsed: "none" | "leetcode_hint" | "solution_peek" | "gpt_help"
}

interface Problem {
  id: number
  title: string
  description: string
  difficulty: "easy" | "medium" | "hard"
  tags: string[]
  category: string
  lastSolved: Date
  submissions: Submission[]
}

// Mock problem data - estimated scores are always 80
const mockProblems: Problem[] = [
  {
    id: 1,
    title: "Two Sum",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order. Example 1: Input: nums = [2,7,11,15], target = 9 Output: [0,1] Explanation: Because nums[0] + nums[1] == 9, we return [0, 1]. Example 2: Input: nums = [3,2,4], target = 6 Output: [1,2]",
    difficulty: "easy",
    tags: ["array", "hash table"],
    category: "Array",
    lastSolved: new Date(Date.now() - 86400000),
    submissions: [
      { id: 1, date: new Date(Date.now() - 86400000), score: 85, isEstimated: false, hintsUsed: "none" },
      { id: 2, date: new Date(Date.now() - 86400000 * 7), score: 72, isEstimated: false, hintsUsed: "leetcode_hint" },
      { id: 3, date: new Date(Date.now() - 86400000 * 14), score: 80, isEstimated: true, hintsUsed: "gpt_help" },
      { id: 4, date: new Date(Date.now() - 86400000 * 30), score: 80, isEstimated: true, hintsUsed: "solution_peek" },
    ],
  },
  {
    id: 2,
    title: "Longest Substring Without Repeating Characters",
    description: "Given a string s, find the length of the longest substring without repeating characters. Example 1: Input: s = 'abcabcbb' Output: 3 Explanation: The answer is 'abc', with the length of 3. Example 2: Input: s = 'bbbbb' Output: 1",
    difficulty: "medium",
    tags: ["hash table", "string", "sliding window"],
    category: "Hash Table",
    lastSolved: new Date(Date.now() - 172800000),
    submissions: [
      { id: 1, date: new Date(Date.now() - 172800000), score: 78, isEstimated: false, hintsUsed: "leetcode_hint" },
      { id: 2, date: new Date(Date.now() - 86400000 * 10), score: 80, isEstimated: true, hintsUsed: "gpt_help" },
    ],
  },
  {
    id: 3,
    title: "Merge Two Sorted Lists",
    description: "You are given the heads of two sorted linked lists list1 and list2. Merge the two lists into one sorted list. The list should be made by splicing together the nodes of the first two lists. Return the head of the merged linked list.",
    difficulty: "easy",
    tags: ["linked list", "recursion"],
    category: "Linked List",
    lastSolved: new Date(Date.now() - 259200000),
    submissions: [
      { id: 1, date: new Date(Date.now() - 259200000), score: 90, isEstimated: false, hintsUsed: "none" },
    ],
  },
  {
    id: 4,
    title: "LRU Cache",
    description: "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache. Implement the LRUCache class with get and put operations that run in O(1) average time complexity.",
    difficulty: "medium",
    tags: ["hash table", "linked list", "design"],
    category: "Hash Table",
    lastSolved: new Date(Date.now() - 345600000),
    submissions: [
      { id: 1, date: new Date(Date.now() - 345600000), score: 65, isEstimated: false, hintsUsed: "leetcode_hint" },
      { id: 2, date: new Date(Date.now() - 86400000 * 20), score: 80, isEstimated: true, hintsUsed: "solution_peek" },
      { id: 3, date: new Date(Date.now() - 86400000 * 35), score: 80, isEstimated: true, hintsUsed: "gpt_help" },
    ],
  },
  {
    id: 5,
    title: "Binary Tree Level Order Traversal",
    description: "Given the root of a binary tree, return the level order traversal of its nodes' values. (i.e., from left to right, level by level).",
    difficulty: "medium",
    tags: ["binary tree", "bfs"],
    category: "Binary Tree",
    lastSolved: new Date(Date.now() - 432000000),
    submissions: [
      { id: 1, date: new Date(Date.now() - 432000000), score: 82, isEstimated: false, hintsUsed: "none" },
      { id: 2, date: new Date(Date.now() - 86400000 * 15), score: 70, isEstimated: false, hintsUsed: "leetcode_hint" },
    ],
  },
  {
    id: 6,
    title: "Coin Change",
    description: "You are given an integer array coins representing coins of different denominations and an integer amount representing a total amount of money. Return the fewest number of coins that you need to make up that amount.",
    difficulty: "medium",
    tags: ["dp", "array"],
    category: "Dynamic Programming",
    lastSolved: new Date(Date.now() - 518400000),
    submissions: [
      { id: 1, date: new Date(Date.now() - 518400000), score: 55, isEstimated: false, hintsUsed: "gpt_help" },
      { id: 2, date: new Date(Date.now() - 86400000 * 25), score: 80, isEstimated: true, hintsUsed: "solution_peek" },
    ],
  },
]

const categories = ["All", "Array", "Hash Table", "Linked List", "Binary Tree", "Dynamic Programming", "Graph"]

export default function ProblemDetails() {
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(mockProblems[0])
  const [showSidebar, setShowSidebar] = useState(true)
  const [expandedDescription, setExpandedDescription] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const { toast } = useToast()

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>("All")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all")
  const [hintsFilter, setHintsFilter] = useState<string>("all")
  const [scoreComparison, setScoreComparison] = useState<"greater" | "less">("greater")
  const [scoreThreshold, setScoreThreshold] = useState<string>("")
  const [includeNoFeedback, setIncludeNoFeedback] = useState<boolean>(true)

  // Apply filters
  const filteredProblems = useMemo(() => {
    let filtered = [...mockProblems]

    // Category filter
    if (categoryFilter !== "All") {
      filtered = filtered.filter((p) => p.category === categoryFilter)
    }

    // Difficulty filter
    if (difficultyFilter !== "all") {
      filtered = filtered.filter((p) => p.difficulty === difficultyFilter)
    }

    // Hints filter
    if (hintsFilter !== "all") {
      filtered = filtered.filter((p) =>
        p.submissions.some((s) => s.hintsUsed === hintsFilter)
      )
    }

    // Score filter
    if (scoreThreshold) {
      const threshold = parseInt(scoreThreshold)
      if (!isNaN(threshold)) {
        filtered = filtered.filter((p) => {
          const latestScore = p.submissions[0]?.score || 0
          return scoreComparison === "greater"
            ? latestScore >= threshold
            : latestScore <= threshold
        })
      }
    }

    // Include no feedback filter
    if (!includeNoFeedback) {
      filtered = filtered.filter((p) => {
        const latestSubmission = p.submissions[0]
        return latestSubmission && !latestSubmission.isEstimated
      })
    }

    // Sort by most recent solve
    return filtered.sort((a, b) => b.lastSolved.getTime() - a.lastSolved.getTime())
  }, [categoryFilter, difficultyFilter, hintsFilter, scoreComparison, scoreThreshold, includeNoFeedback])

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatShortDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return (
          <Badge variant="outline" className="bg-leetcode-easy/10 text-leetcode-easy">
            Easy
          </Badge>
        )
      case "medium":
        return (
          <Badge variant="outline" className="bg-leetcode-medium/10 text-leetcode-medium">
            Medium
          </Badge>
        )
      case "hard":
        return (
          <Badge variant="outline" className="bg-leetcode-hard/10 text-leetcode-hard">
            Hard
          </Badge>
        )
      default:
        return null
    }
  }

  const getScoreColor = (score: number, isEstimated: boolean) => {
    if (isEstimated) return "#9ca3af" // gray
    if (score >= 80) return "#10b981" // emerald
    if (score >= 50) return "#f59e0b" // amber
    return "#f43f5e" // rose
  }

  const getScoreBgColor = (score: number, isEstimated: boolean = false) => {
    if (isEstimated) return "bg-gray-100 text-gray-600"
    if (score >= 80) return "bg-emerald-100 text-emerald-800"
    if (score >= 50) return "bg-amber-100 text-amber-800"
    return "bg-rose-100 text-rose-800"
  }

  const getHintsLabel = (hints: string) => {
    switch (hints) {
      case "none":
        return "No hints"
      case "leetcode_hint":
        return "LeetCode Hint"
      case "solution_peek":
        return "Solution Peek"
      case "gpt_help":
        return "GPT Help"
      default:
        return hints
    }
  }

  const clearFilters = () => {
    setCategoryFilter("All")
    setDifficultyFilter("all")
    setHintsFilter("all")
    setScoreThreshold("")
    setIncludeNoFeedback(true)
  }

  const hasActiveFilters = categoryFilter !== "All" || difficultyFilter !== "all" || hintsFilter !== "all" || scoreThreshold !== "" || !includeNoFeedback

  const copyInsightsPrompt = () => {
    if (!selectedProblem) return

    const submissionsData = selectedProblem.submissions
      .map(
        (s) =>
          `- Date: ${formatDate(s.date)}, Score: ${s.score}${s.isEstimated ? " (estimated)" : ""}, Hints Used: ${getHintsLabel(s.hintsUsed)}`
      )
      .join("\n")

    const prompt = `Please analyze my progress on this LeetCode problem and provide insights:

Problem: ${selectedProblem.title}
Difficulty: ${selectedProblem.difficulty}
Category: ${selectedProblem.category}
Tags: ${selectedProblem.tags.join(", ")}

Description:
${selectedProblem.description}

My Submission History:
${submissionsData}

Please analyze:
1. My progress over time (improving, declining, or stagnant)
2. Patterns in my approach (reliance on hints, consistency)
3. Specific areas where I seem to struggle with this problem
4. Recommendations for improvement
5. Related concepts I should review

Format your response as a structured analysis with clear sections.`

    navigator.clipboard.writeText(prompt)
    toast({
      title: "Prompt copied!",
      description: "Paste this prompt into your preferred AI assistant for insights.",
    })
  }

  // Calculate chart dimensions
  const chartHeight = 180
  const chartWidth = 500
  const chartPadding = { top: 20, right: 20, bottom: 50, left: 40 }
  const innerWidth = chartWidth - chartPadding.left - chartPadding.right
  const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom

  const renderChart = () => {
    if (!selectedProblem || selectedProblem.submissions.length === 0) {
      return (
        <div className="h-40 flex items-center justify-center text-muted-foreground">
          No submission data available
        </div>
      )
    }

    const submissions = [...selectedProblem.submissions].reverse() // Chronological order
    const pointSpacing = innerWidth / Math.max(submissions.length - 1, 1)

    return (
      <TooltipProvider>
        <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="overflow-visible">
          {/* Y-axis */}
          <line
            x1={chartPadding.left}
            y1={chartPadding.top}
            x2={chartPadding.left}
            y2={chartHeight - chartPadding.bottom}
            stroke="currentColor"
            strokeOpacity={0.2}
          />
          {/* X-axis */}
          <line
            x1={chartPadding.left}
            y1={chartHeight - chartPadding.bottom}
            x2={chartWidth - chartPadding.right}
            y2={chartHeight - chartPadding.bottom}
            stroke="currentColor"
            strokeOpacity={0.2}
          />

          {/* Y-axis labels */}
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
                x2={chartWidth - chartPadding.right}
                y2={chartPadding.top + innerHeight - (value / 100) * innerHeight}
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeDasharray="4,4"
              />
            </g>
          ))}

          {/* Line connecting points */}
          {submissions.length > 1 && (
            <path
              d={submissions
                .map((s, i) => {
                  const x = submissions.length === 1 
                    ? chartPadding.left + innerWidth / 2 
                    : chartPadding.left + i * pointSpacing
                  const y = chartPadding.top + innerHeight - (s.score / 100) * innerHeight
                  return `${i === 0 ? "M" : "L"} ${x} ${y}`
                })
                .join(" ")}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeWidth={1.5}
            />
          )}

          {/* Data points and X-axis labels */}
          {submissions.map((submission, index) => {
            const x = submissions.length === 1 
              ? chartPadding.left + innerWidth / 2 
              : chartPadding.left + index * pointSpacing
            const y = chartPadding.top + innerHeight - (submission.score / 100) * innerHeight

            return (
              <g key={submission.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <circle
                      cx={x}
                      cy={y}
                      r={6}
                      className="cursor-pointer hover:r-8 transition-all"
                      style={{ fill: getScoreColor(submission.score, submission.isEstimated) }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <p className="font-medium">{formatDate(submission.date)}</p>
                      <p>Score: {submission.score}{submission.isEstimated && " (estimated)"}</p>
                      <p>Hints: {getHintsLabel(submission.hintsUsed)}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* X-axis label - vertical tilted timestamp */}
                <text
                  x={x}
                  y={chartHeight - chartPadding.bottom + 8}
                  textAnchor="start"
                  className="text-[9px] fill-muted-foreground"
                  transform={`rotate(45, ${x}, ${chartHeight - chartPadding.bottom + 8})`}
                >
                  {formatShortDate(submission.date)}
                </text>
              </g>
            )
          })}
        </svg>
      </TooltipProvider>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex gap-6 h-[calc(100vh-8rem)]">
        {/* Sidebar */}
        <div className={`transition-all duration-300 ${showSidebar ? "w-80" : "w-0"} overflow-hidden`}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Solved Problems</CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant={showFilters ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="p-1 relative"
                  >
                    <Filter className="h-4 w-4" />
                    {hasActiveFilters && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 bg-leetcode-orange rounded-full" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowSidebar(false)} className="p-1">
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
                                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
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
                                    <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="all" className="text-xs">All</SelectItem>
                                        <SelectItem value="easy" className="text-xs">Easy</SelectItem>
                                        <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                                        <SelectItem value="hard" className="text-xs">Hard</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Hints Filter */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Hints Used</Label>
                    <Select value={hintsFilter} onValueChange={setHintsFilter}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All</SelectItem>
                        <SelectItem value="none" className="text-xs">No hints</SelectItem>
                        <SelectItem value="leetcode_hint" className="text-xs">LeetCode Hint</SelectItem>
                        <SelectItem value="solution_peek" className="text-xs">Solution Peek</SelectItem>
                        <SelectItem value="gpt_help" className="text-xs">GPT Help</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Score Filter */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Final Score</Label>
                    <div className="flex gap-2">
                      <Select value={scoreComparison} onValueChange={(v) => setScoreComparison(v as "greater" | "less")}>
                        <SelectTrigger className="h-8 text-xs w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="greater" className="text-xs">{"≥"}</SelectItem>
                          <SelectItem value="less" className="text-xs">{"≤"}</SelectItem>
                        </SelectContent>
                      </Select>
<Input
                                        type="number"
                                        placeholder="Score"
                                        value={scoreThreshold}
                                        onChange={(e) => setScoreThreshold(e.target.value)}
                                        className="h-8 text-xs"
                                        min={0}
                                        max={100}
                                      />
                                    </div>
                                    <div className="flex items-center space-x-2 mt-2">
                                      <Checkbox 
                                        id="includeNoFeedback" 
                                        checked={includeNoFeedback}
                                        onCheckedChange={(checked) => setIncludeNoFeedback(checked as boolean)}
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
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-14rem)]">
                <div className="space-y-2 p-4 pt-0">
                  {filteredProblems.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 text-sm">
                      No problems match the current filters
                    </div>
                  ) : (
filteredProblems.map((problem) => {
                                      const latestScore = problem.submissions[0]?.score || 0
                                      const latestIsEstimated = problem.submissions[0]?.isEstimated || false
                                      return (
                                        <div
                                          key={problem.id}
                                          onClick={() => {
                                            setSelectedProblem(problem)
                                            setExpandedDescription(false)
                                          }}
                                          className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                                            selectedProblem?.id === problem.id ? "bg-accent border-primary" : ""
                                          }`}
                                        >
                                          <div className="flex items-center justify-between gap-2 mb-1">
                                            <p className="font-medium text-sm truncate flex-1">{problem.title}</p>
                                            {getDifficultyBadge(problem.difficulty)}
                                          </div>
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs text-muted-foreground">
                                              {formatDate(problem.lastSolved)}
                                            </p>
                                            <Badge className={`text-[10px] px-1.5 py-0.5 ${getScoreBgColor(latestScore, latestIsEstimated)}`}>
                                              {latestScore}{latestIsEstimated && " (est.)"}
                                            </Badge>
                                          </div>
                                        </div>
                                      )
                                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Toggle button when sidebar is hidden */}
        {!showSidebar && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSidebar(true)}
            className="absolute left-4 top-24 bg-transparent"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          {selectedProblem ? (
            <Card className="h-full">
              <ScrollArea className="h-full">
                <div className="p-6">
                  {/* Problem Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-bold">{selectedProblem.title}</h1>
                      {getDifficultyBadge(selectedProblem.difficulty)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={() => window.open(`https://leetcode.com/problems/${selectedProblem.title.toLowerCase().replace(/\s+/g, '-')}/`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                      View on LeetCode
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Last solved: {formatDate(selectedProblem.lastSolved)}
                  </p>

                  <Separator className="my-6" />

                  {/* Problem Description */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-lg font-semibold">Problem Description</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedDescription(!expandedDescription)}
                      >
                        {expandedDescription ? (
                          <EyeOff className="h-4 w-4 mr-1" />
                        ) : (
                          <Eye className="h-4 w-4 mr-1" />
                        )}
                        {expandedDescription ? "Collapse" : "Expand"}
                      </Button>
                    </div>
                    <p
                      className={`text-sm text-muted-foreground whitespace-pre-wrap ${
                        !expandedDescription && "line-clamp-3"
                      }`}
                    >
                      {selectedProblem.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-4">
                      {selectedProblem.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Separator className="my-6" />

                  {/* Grouped Submission Timeline Chart */}
                  <div>
                    <h2 className="text-lg font-semibold mb-1">Grouped Submission Timeline</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Track your progress over time. Hover over points for details.
                    </p>
                    
                    <div className="mb-4">
                      {renderChart()}
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
                        <span>{"Low (<50)"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full bg-gray-400" />
                        <span>Estimated (no feedback provided)</span>
                      </div>
                    </div>

                    {/* Get Insights */}
                    <div className="space-y-3 mt-6">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 mt-0.5 text-leetcode-orange" />
                        <p className="text-sm text-muted-foreground">
                          Get AI-powered insights by copying a prompt that includes all your submission history for this problem. Paste it into ChatGPT, Claude, or your preferred AI assistant to receive personalized feedback on your progress and recommendations for improvement.
                        </p>
                      </div>
                      <Button onClick={copyInsightsPrompt} variant="outline" className="gap-2 bg-transparent">
                        <Copy className="h-4 w-4" />
                        Copy Insights Prompt
                      </Button>
                    </div>
                  </div>

                  <Separator className="my-6" />

                  {/* All Grouped Submissions Table */}
                  <div>
                    <h2 className="text-lg font-semibold mb-3">All Grouped Submissions</h2>
                    <div className="space-y-2">
                      {selectedProblem.submissions.map((submission, index) => (
                        <div
                          key={submission.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground w-8">
                              #{selectedProblem.submissions.length - index}
                            </span>
                            <span className="text-sm">{formatDate(submission.date)}</span>
                            <Badge variant="outline" className="text-xs">
                              {getHintsLabel(submission.hintsUsed)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge
                              className={getScoreBgColor(submission.score, submission.isEstimated)}
                            >
                              {submission.score}
                              {submission.isEstimated && " (est.)"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              title="View in Solve History"
                            >
                              <Link2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center text-muted-foreground">
              Select a problem to view details
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
