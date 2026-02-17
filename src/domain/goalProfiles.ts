import { GoalProfile } from '../types/types';
import { db } from '../storage/db';

/**
 * Fetch default goal profiles from the public JSON file.
 * Falls back to an inline minimal profile if the network fetch fails
 * (handy for unit tests without a dev server).
 */
export async function fetchDefaultProfiles(): Promise<GoalProfile[]> {
  try {
    const res = await fetch('/default-goal-profiles.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const profiles = (await res.json()) as GoalProfile[];
    const now = new Date().toISOString();
    return profiles.map((p) => ({
      ...p,
      createdAt: p.createdAt || now,
      isEditable: p.isEditable ?? false,
    }));
  } catch {
    return [
      {
        id: 'default',
        name: 'Default',
        description: 'Interview-ready fallback',
        createdAt: new Date().toISOString(),
        isEditable: false,
        goals: {
          Array: 1900,
          String: 1900,
          'Hash Table': 1900,
        },
      },
    ];
  }
}

/**
 * Return the currently active profile or seed the DB with the "Default”
 * preset from the JSON file.
 */
export async function getActiveOrInitProfile(): Promise<GoalProfile> {
  const activeId = await db.getActiveGoalProfileId();
  if (activeId) {
    const existing = await db.getGoalProfile(activeId);
    if (existing) return existing;
  }

  const defaults = await fetchDefaultProfiles();
  const def = defaults.find((p) => p.id === 'default') ?? defaults[0];
  await Promise.all(defaults.map((p) => db.saveGoalProfile(p)));
  await db.setActiveGoalProfile(def.id);
  return def;
}
