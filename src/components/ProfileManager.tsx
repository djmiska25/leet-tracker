import { useEffect, useState } from 'react';
import { db } from '@/storage/db';
import type { GoalProfile } from '@/types/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, X } from 'lucide-react';
import clsx from 'clsx';
import { trackProfileChanged } from '@/utils/analytics';
import { getCatalogCategories } from '@/domain/catalogCategories';

interface Props {
  onDone: () => void;
}

export function ProfileManager({ onDone }: Props) {
  /* ---------------- state ---------------- */
  const [profiles, setProfiles] = useState<GoalProfile[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [showMore, setShowMore] = useState<Record<string, boolean>>({});

  /** creation UI */
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [targets, setTargets] = useState<Record<string, number>>({});

  /* ---------------- helpers ---------------- */
  const load = async () => {
    const list = await db.getAllGoalProfiles();
    setProfiles(list);
    setActiveId(await db.getActiveGoalProfileId());
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadCategories = async () => {
      setCategoriesLoading(true);
      try {
        const list = await getCatalogCategories(true);
        if (!mounted) return;
        setCategories(list);
        setTargets((prev) => {
          if (Object.keys(prev).length > 0) return prev;
          const next: Record<string, number> = {};
          list.forEach((c) => {
            next[c] = 0;
          });
          return next;
        });
      } catch (error) {
        if (!mounted) return;
        console.error('Failed to load categories for Profile Manager:', error);
        setCategories([]);
      } finally {
        if (mounted) {
          setCategoriesLoading(false);
        }
      }
    };

    loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (categories.length === 0) return;
    setTargets((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const category of categories) {
        if (next[category] === undefined) {
          next[category] = 0;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [categories]);

  // --- Prevent background scrolling while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    if (!Object.values(targets).some((value) => value > 0)) return;
    const profile: GoalProfile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
      isEditable: true,
      description: '',
      goals: Object.fromEntries(
        Object.entries(targets)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => [k, v / 100]),
      ),
    };
    await db.saveGoalProfile(profile);
    await db.setActiveGoalProfile(profile.id);
    setCreating(false);
    setName('');
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this profile permanently?')) return;
    await db.deleteGoalProfile(id);
    const remaining = await db.getAllGoalProfiles();
    if (activeId === id && remaining.length) {
      await db.setActiveGoalProfile(remaining[0].id);
    }
    await load();
  };

  const handleSetActive = async (id: string) => {
    await db.setActiveGoalProfile(id);
    setActiveId(id);
    trackProfileChanged(id);
  };

  /* ---------------- ui helpers ---------------- */
  const renderGoals = (goals: Record<string, number>, id: string) => {
    const keys = Object.keys(goals).filter((k) => goals[k] > 0);
    const slice = showMore[id] ? keys : keys.slice(0, 6);
    return (
      <>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {slice.map((k) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted-foreground truncate">{k}</span>
              <span className="font-medium">{Math.round(goals[k] * 100)}%</span>
            </div>
          ))}
        </div>
        {keys.length > 6 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs"
            onClick={() => setShowMore((s) => ({ ...s, [id]: !s[id] }))}
          >
            {showMore[id] ? 'Show less' : 'Show more'}
          </Button>
        )}
      </>
    );
  };

  /* ---------------- render ---------------- */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-2xl relative">
        {/* Close button */}
        <button
          type="button"
          aria-label="Close"
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          onClick={onDone}
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-2xl font-semibold mb-6">Manage Profiles</h2>

        {/* -------- create new profile -------- */}
        <div className="mb-8">
          {!creating && (
            <Button onClick={() => setCreating(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Profile
            </Button>
          )}

          {creating && (
            <Card className="mt-4">
              <CardHeader className="p-4">
                <CardTitle className="text-base">New Custom Profile</CardTitle>
                <CardDescription>Set a goal percentage for each category (0-100).</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* name */}
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="prof-name">
                    Profile name
                  </label>
                  <input
                    id="prof-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 bg-background"
                    placeholder="e.g. My Interview Goals"
                  />
                </div>

                {/* targets */}
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                  {categoriesLoading && (
                    <p className="text-sm text-muted-foreground">Loading categories…</p>
                  )}
                  {!categoriesLoading && categories.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No categories available yet. Try switching profiles or sync the catalog before
                      creating one.
                    </p>
                  )}
                  {!categoriesLoading &&
                    categories.map((cat) => (
                      <div key={cat} className="flex items-center justify-between gap-2">
                        <label className="text-sm truncate flex-1" htmlFor={`t-${cat}`}>
                          {cat}
                        </label>
                        <input
                          id={`t-${cat}`}
                          type="number"
                          min={0}
                          max={100}
                          className="w-20 rounded-md border px-2 py-1 text-right"
                          value={targets[cat]}
                          onChange={(e) =>
                            setTargets((t) => ({
                              ...t,
                              [cat]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                            }))
                          }
                        />
                      </div>
                    ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setCreating(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={
                      !name.trim() ||
                      categoriesLoading ||
                      categories.length === 0 ||
                      !Object.values(targets).some((value) => value > 0)
                    }
                  >
                    Create
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* -------- existing profiles -------- */}
        {!creating && (
          <div className="space-y-4">
            {profiles.map((p) => (
              <Card
                key={p.id}
                className={clsx(p.id === activeId && 'ring-2 ring-primary cursor-pointer')}
                onClick={() => handleSetActive(p.id)}
              >
                <CardHeader className="p-4 pb-2 flex flex-row justify-between items-start">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    {p.id === activeId && <Badge variant="default">Active</Badge>}
                    {!p.isEditable && <Badge variant="secondary">Default</Badge>}
                  </div>
                  {p.isEditable && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.id);
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </CardHeader>
                <CardContent className="px-4 pt-0 pb-4">
                  {renderGoals(p.goals as Record<string, number>, p.id)}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfileManager;
