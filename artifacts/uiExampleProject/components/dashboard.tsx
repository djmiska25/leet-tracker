"use client"

import { useState, useEffect } from "react"
import { RefreshCcw, ExternalLink, RotateCcw } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ProfileManager } from "@/components/profile-manager"
import { ExtensionWarning } from "@/components/extension-warning"
import SolveHistory from "@/components/solve-history"
import ProblemDetails from "@/components/problem-details"
import { useTheme } from "next-themes"
import { ThemeToggle } from "@/components/theme-toggle"

// Mock data - replace with actual data fetching
const mockUser = {
  username: "leetcoder42",
  lastSynced: new Date(Date.now() - 3600000 * 3), // 3 hours ago
}

const initialProfiles = [
  {
    id: 1,
    name: "Amazon",
    isActive: true,
    isDefault: true,
    categoryTargets: {
      "Dynamic Programming": 85,
      "Linked List": 80,
      Graph: 75,
      "Binary Tree": 90,
      "Hash Table": 85,
      Array: 95,
    },
  },
  {
    id: 2,
    name: "Microsoft",
    isActive: false,
    isDefault: true,
    categoryTargets: {
      "Dynamic Programming": 80,
      "Linked List": 75,
      Graph: 70,
      "Binary Tree": 85,
      "Hash Table": 80,
      Array: 90,
    },
  },
  {
    id: 3,
    name: "Google",
    isActive: false,
    isDefault: true,
    categoryTargets: {
      "Dynamic Programming": 90,
      "Linked List": 85,
      Graph: 80,
      "Binary Tree": 95,
      "Hash Table": 90,
      Array: 95,
    },
  },
  {
    id: 4,
    name: "Custom 123",
    isActive: false,
    isDefault: false,
    categoryTargets: {
      "Dynamic Programming": 60,
      "Linked List": 65,
      Graph: 55,
      "Binary Tree": 70,
      "Hash Table": 65,
      Array: 75,
    },
  },
]

const mockCategories = [
  {
    id: 5,
    name: "Dynamic Programming",
    adjustedScore: 30,
    goalLevel: 70,
    confidenceLevel: "low",
    fundamentals: [
      { id: 101, title: "Fibonacci Number", difficulty: "easy", tags: ["dp", "math"] },
      { id: 102, title: "Climbing Stairs", difficulty: "easy", tags: ["dp"] },
      { id: 103, title: "Coin Change", difficulty: "medium", tags: ["dp"] },
    ],
    refresh: [
      { id: 104, title: "Maximum Subarray", difficulty: "medium", tags: ["dp", "array"] },
      { id: 105, title: "House Robber", difficulty: "medium", tags: ["dp"] },
    ],
    new: [
      { id: 106, title: "Longest Increasing Subsequence", difficulty: "medium", tags: ["dp", "binary search"] },
      { id: 107, title: "Edit Distance", difficulty: "hard", tags: ["dp", "string"] },
    ],
  },
  {
    id: 3,
    name: "Linked List",
    adjustedScore: 45,
    goalLevel: 75,
    confidenceLevel: "low",
    fundamentals: [
      { id: 201, title: "Reverse Linked List", difficulty: "easy", tags: ["linked list"] },
      { id: 202, title: "Merge Two Sorted Lists", difficulty: "easy", tags: ["linked list"] },
    ],
    refresh: [
      {
        id: 203,
        title: "Remove Nth Node From End of List",
        difficulty: "medium",
        tags: ["linked list", "two pointers"],
      },
    ],
    new: [
      { id: 204, title: "LRU Cache", difficulty: "medium", tags: ["linked list", "design"] },
      { id: 205, title: "Merge k Sorted Lists", difficulty: "hard", tags: ["linked list", "heap"] },
    ],
  },
  {
    id: 6,
    name: "Graph",
    adjustedScore: 40,
    goalLevel: 65,
    confidenceLevel: "low",
    fundamentals: [
      { id: 301, title: "Number of Islands", difficulty: "medium", tags: ["graph", "dfs", "bfs"] },
      { id: 302, title: "Clone Graph", difficulty: "medium", tags: ["graph", "dfs", "bfs"] },
    ],
    refresh: [{ id: 303, title: "Course Schedule", difficulty: "medium", tags: ["graph", "topological sort"] }],
    new: [
      { id: 304, title: "Word Ladder", difficulty: "hard", tags: ["graph", "bfs"] },
      { id: 305, title: "Network Delay Time", difficulty: "medium", tags: ["graph", "dijkstra"] },
    ],
  },
  {
    id: 4,
    name: "Binary Tree",
    adjustedScore: 60,
    goalLevel: 85,
    confidenceLevel: "medium",
    fundamentals: [
      { id: 401, title: "Maximum Depth of Binary Tree", difficulty: "easy", tags: ["binary tree", "dfs"] },
      { id: 402, title: "Invert Binary Tree", difficulty: "easy", tags: ["binary tree", "dfs"] },
    ],
    refresh: [
      { id: 403, title: "Binary Tree Level Order Traversal", difficulty: "medium", tags: ["binary tree", "bfs"] },
    ],
    new: [
      { id: 404, title: "Serialize and Deserialize Binary Tree", difficulty: "hard", tags: ["binary tree", "design"] },
    ],
  },
  {
    id: 2,
    name: "Hash Table",
    adjustedScore: 65,
    goalLevel: 80,
    confidenceLevel: "medium",
    fundamentals: [
      { id: 501, title: "Two Sum", difficulty: "easy", tags: ["hash table", "array"] },
      { id: 502, title: "Group Anagrams", difficulty: "medium", tags: ["hash table", "string"] },
    ],
    refresh: [{ id: 503, title: "LRU Cache", difficulty: "medium", tags: ["hash table", "linked list", "design"] }],
    new: [
      {
        id: 504,
        title: "Longest Substring Without Repeating Characters",
        difficulty: "medium",
        tags: ["hash table", "string", "sliding window"],
      },
    ],
  },
  {
    id: 1,
    name: "Array",
    adjustedScore: 78,
    goalLevel: 90,
    confidenceLevel: "high",
    fundamentals: [
      { id: 601, title: "Contains Duplicate", difficulty: "easy", tags: ["array", "hash table"] },
      { id: 602, title: "Best Time to Buy and Sell Stock", difficulty: "easy", tags: ["array", "dp"] },
    ],
    refresh: [{ id: 603, title: "Product of Array Except Self", difficulty: "medium", tags: ["array"] }],
    new: [{ id: 604, title: "Trapping Rain Water", difficulty: "hard", tags: ["array", "two pointers", "stack"] }],
  },
]

// Custom Progress component that allows for colored progress
function CustomProgress({ value, className }: { value: number; className?: string }) {
  // Get progress bar color based on completion percentage
  const getProgressBarColor = (score: number) => {
    if (score < 40) return "bg-leetcode-hard"
    if (score < 70) return "bg-leetcode-medium"
    return "bg-leetcode-easy"
  }

  return (
    <div className="relative w-full overflow-hidden rounded-full bg-secondary h-2">
      <div className={`h-full ${getProgressBarColor(value)} transition-all`} style={{ width: `${value}%` }} />
    </div>
  )
}

export default function Dashboard() {
  const [profiles, setProfiles] = useState(initialProfiles)
  const [activeProfile, setActiveProfile] = useState(profiles.find((p) => p.isActive) || profiles[0])
  const [categories, setCategories] = useState(mockCategories)
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState(mockUser.lastSynced)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState("dashboard")
  const { theme } = useTheme()
  const [hasClickedAnyCategory, setHasClickedAnyCategory] = useState(false)

  // After mounting, we can show the theme UI
  useEffect(() => {
    setMounted(true)
  }, [])

  // Update categories when active profile changes
  useEffect(() => {
    const updatedCategories = categories.map((category) => ({
      ...category,
      goalLevel: activeProfile.categoryTargets[category.name] || category.goalLevel,
    }))
    setCategories(updatedCategories.sort((a, b) => a.adjustedScore - b.adjustedScore))
  }, [activeProfile])

  // Format the last synced time
  const formatLastSynced = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`
  }

  // Handle sync/refresh
  const handleSync = () => {
    setSyncing(true)
    // Simulate API call
    setTimeout(() => {
      setLastSynced(new Date())
      setSyncing(false)
    }, 1500)
  }

  // Get difficulty badge color
  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return (
          <Badge variant="outline" className="bg-leetcode-easy/10 text-leetcode-easy hover:bg-leetcode-easy/20">
            Easy
          </Badge>
        )
      case "medium":
        return (
          <Badge variant="outline" className="bg-leetcode-medium/10 text-leetcode-medium hover:bg-leetcode-medium/20">
            Medium
          </Badge>
        )
      case "hard":
        return (
          <Badge variant="outline" className="bg-leetcode-hard/10 text-leetcode-hard hover:bg-leetcode-hard/20">
            Hard
          </Badge>
        )
      default:
        return null
    }
  }

  // Handle profile change
  const handleProfileChange = (profileId: number) => {
    const newActiveProfile = profiles.find((p) => p.id === profileId)
    if (newActiveProfile) {
      // Update active status
      const updatedProfiles = profiles.map((p) => ({
        ...p,
        isActive: p.id === profileId,
      }))
      setProfiles(updatedProfiles)
      setActiveProfile(newActiveProfile)
    }
  }

  // Handle profiles change from ProfileManager
  const handleProfilesChange = (newProfiles: typeof profiles) => {
    setProfiles(newProfiles)
  }

  // Handle active profile change from ProfileManager
  const handleActiveProfileChange = (newActiveProfile: typeof activeProfile) => {
    const updatedProfiles = profiles.map((p) => ({
      ...p,
      isActive: p.id === newActiveProfile.id,
    }))
    setProfiles(updatedProfiles)
    setActiveProfile(newActiveProfile)
  }

  // Handle reset onboarding
  const handleResetOnboarding = () => {
    localStorage.removeItem("leettracker-onboarding-complete")
    window.location.reload()
  }

  // Avoid hydration mismatch by not rendering theme-dependent UI until mounted
  if (!mounted) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">Loading...</div>
  }

  // Render problem details page
  if (activeTab === "problems") {
    return (
      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <div className="border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex h-16 items-center px-0">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">LeetTracker</h2>
              </div>
              <div className="ml-auto flex items-center gap-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mr-4">
                  <TabsList>
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                    <TabsTrigger value="history">Solve History</TabsTrigger>
                    <TabsTrigger value="problems">Problem Details</TabsTrigger>
                  </TabsList>
                </Tabs>
                <ThemeToggle />
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to sign out? Your synced progress will be deleted.")) {
                      console.log("User signed out")
                    }
                  }}
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
        <ProblemDetails />

        {/* DEV Reset Onboarding Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetOnboarding}
          className="fixed bottom-4 right-4 z-50 border-dashed border-2 border-yellow-500 text-yellow-600 hover:bg-yellow-500 hover:text-white bg-transparent gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          DEV: Reset Onboarding
        </Button>
      </div>
    )
  }

  // Render solve history page
  if (activeTab === "history") {
    return (
      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <div className="border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex h-16 items-center px-0">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">LeetTracker</h2>
              </div>
              <div className="ml-auto flex items-center gap-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mr-4">
                  <TabsList>
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                    <TabsTrigger value="history">Solve History</TabsTrigger>
                    <TabsTrigger value="problems">Problem Details</TabsTrigger>
                  </TabsList>
                </Tabs>
                <ThemeToggle />
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to sign out? Your synced progress will be deleted.")) {
                      // Sign out logic would go here
                      console.log("User signed out")
                    }
                  }}
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
        <SolveHistory />

        {/* DEV Reset Onboarding Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetOnboarding}
          className="fixed bottom-4 right-4 z-50 border-dashed border-2 border-yellow-500 text-yellow-600 hover:bg-yellow-500 hover:text-white bg-transparent gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          DEV: Reset Onboarding
        </Button>
      </div>
    )
  }

  // Handle accordion expansion
  const handleAccordionChange = (value: string) => {
    if (value && !hasClickedAnyCategory) {
      setHasClickedAnyCategory(true)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Navigation */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex h-16 items-center px-0">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold">LeetTracker</h2>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mr-4">
                <TabsList>
                  <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                  <TabsTrigger value="history">Solve History</TabsTrigger>
                  <TabsTrigger value="problems">Problem Details</TabsTrigger>
                </TabsList>
              </Tabs>
              <ThemeToggle />
              <Button
                variant="ghost"
                onClick={() => {
                  if (window.confirm("Are you sure you want to sign out? Your synced progress will be deleted.")) {
                    // Sign out logic would go here
                    console.log("User signed out")
                  }
                }}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Extension Warning */}
      <ExtensionWarning />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hello, {mockUser.username}!</h1>
          <p className="text-muted-foreground">Last synced: {formatLastSynced(lastSynced)}</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Profile: {activeProfile.name}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {profiles.map((profile) => (
                <DropdownMenuItem
                  key={profile.id}
                  onClick={() => handleProfileChange(profile.id)}
                  className={profile.id === activeProfile.id ? "bg-accent" : ""}
                >
                  {profile.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ProfileManager
            profiles={profiles}
            categories={categories}
            activeProfile={activeProfile}
            onProfilesChange={handleProfilesChange}
            onActiveProfileChange={handleActiveProfileChange}
          />
          <Button onClick={handleSync} disabled={syncing} className="flex items-center gap-2">
            <RefreshCcw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </div>

      {/* Recommendations with integrated progress */}
      <Card>
        <CardHeader>
          <CardTitle>Problem Categories</CardTitle>
          <CardDescription>Categories sorted by completion (lowest first)</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full" onValueChange={handleAccordionChange}>
            {categories.map((category, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger
                  className={`hover:no-underline [&>svg]:order-first [&>svg]:mr-3 ${
                    !hasClickedAnyCategory ? "[&>svg]:shadow-[0_0_8px_rgba(255,161,22,0.6)] [&>svg]:animate-pulse" : ""
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center w-full gap-2">
                    <div className="min-w-[180px]">
                      <span>{category.name}</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{category.adjustedScore}%</span>
                        <span className="text-muted-foreground">Goal: {category.goalLevel}%</span>
                      </div>
                      <div className="relative">
                        <CustomProgress value={category.adjustedScore} />
                        <div
                          className="absolute top-0 h-2 border-r-2 border-primary/50"
                          style={{ left: `${category.goalLevel}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Tabs defaultValue="fundamentals" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="fundamentals">Fundamentals</TabsTrigger>
                      <TabsTrigger value="refresh">Refresh</TabsTrigger>
                      <TabsTrigger value="new">New</TabsTrigger>
                    </TabsList>

                    {/* Fundamentals Tab */}
                    <TabsContent value="fundamentals" className="mt-4">
                      <div className="grid gap-4">
                        {category.fundamentals.map((problem) => (
                          <Card key={problem.id}>
                            <CardHeader className="p-4 pb-2">
                              <div className="flex justify-between items-start">
                                <CardTitle className="text-base">{problem.title}</CardTitle>
                                {getDifficultyBadge(problem.difficulty)}
                              </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 pb-2">
                              <div className="flex flex-wrap gap-1 mt-1">
                                {problem.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </CardContent>
                            <CardFooter className="p-4 pt-2 flex justify-end">
                              <Button variant="outline" size="sm" className="gap-1 bg-transparent">
                                <ExternalLink className="h-4 w-4" />
                                Solve on LeetCode
                              </Button>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>

                    {/* Refresh Tab */}
                    <TabsContent value="refresh" className="mt-4">
                      <div className="grid gap-4">
                        {category.refresh.map((problem) => (
                          <Card key={problem.id}>
                            <CardHeader className="p-4 pb-2">
                              <div className="flex justify-between items-start">
                                <CardTitle className="text-base">{problem.title}</CardTitle>
                                {getDifficultyBadge(problem.difficulty)}
                              </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 pb-2">
                              <div className="flex flex-wrap gap-1 mt-1">
                                {problem.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </CardContent>
                            <CardFooter className="p-4 pt-2 flex justify-end">
                              <Button variant="outline" size="sm" className="gap-1 bg-transparent">
                                <ExternalLink className="h-4 w-4" />
                                Solve on LeetCode
                              </Button>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>

                    {/* New Tab */}
                    <TabsContent value="new" className="mt-4">
                      <div className="grid gap-4">
                        {category.new.map((problem) => (
                          <Card key={problem.id}>
                            <CardHeader className="p-4 pb-2">
                              <div className="flex justify-between items-start">
                                <CardTitle className="text-base">{problem.title}</CardTitle>
                                {getDifficultyBadge(problem.difficulty)}
                              </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 pb-2">
                              <div className="flex flex-wrap gap-1 mt-1">
                                {problem.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </CardContent>
                            <CardFooter className="p-4 pt-2 flex justify-end">
                              <Button variant="outline" size="sm" className="gap-1 bg-transparent">
                                <ExternalLink className="h-4 w-4" />
                                Solve on LeetCode
                              </Button>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* DEV Reset Onboarding Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleResetOnboarding}
        className="fixed bottom-4 right-4 z-50 border-dashed border-2 border-yellow-500 text-yellow-600 hover:bg-yellow-500 hover:text-white bg-transparent gap-2"
      >
        <RotateCcw className="h-4 w-4" />
        DEV: Reset Onboarding
      </Button>
    </div>
  )
}
