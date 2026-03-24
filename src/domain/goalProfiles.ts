import { GoalProfile } from '../types/types';
import { db } from '../storage/db';

/**
 * Fetch system goal profiles from the public JSON file.
 * Falls back to an inline minimal profile if the network fetch fails
 * (handy for unit tests without a dev server).
 */
type SystemProfilesPayload = {
  systemProfilesVersion?: number;
  profiles?: GoalProfile[];
};

const FALLBACK_SYSTEM_PROFILES_VERSION = 0;

export async function fetchSystemProfiles(): Promise<{
  profiles: GoalProfile[];
  systemVersion: number;
}> {
  try {
    const res = await fetch('/system-goal-profiles.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = (await res.json()) as SystemProfilesPayload | GoalProfile[];
    const rawProfiles = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.profiles)
        ? payload.profiles
        : [];
    const systemVersion =
      !Array.isArray(payload) && typeof payload.systemProfilesVersion === 'number'
        ? payload.systemProfilesVersion
        : FALLBACK_SYSTEM_PROFILES_VERSION;
    const now = new Date().toISOString();
    return {
      profiles: rawProfiles.map((p) => ({
        ...p,
        createdAt: p.createdAt || now,
        isEditable: p.isEditable ?? false,
        createdVersion: p.createdVersion ?? 0,
      })),
      systemVersion,
    };
  } catch {
    return {
      profiles: [
        {
          id: 'default',
          name: 'Default',
          description: 'Fallback profile',
          createdAt: new Date().toISOString(),
          createdVersion: FALLBACK_SYSTEM_PROFILES_VERSION,
          isEditable: false,
          goals: {
            Array: 0.6,
            String: 0.6,
            'Hash Table': 0.6,
          },
        },
      ],
      systemVersion: FALLBACK_SYSTEM_PROFILES_VERSION,
    };
  }
}

function normalizeCategoryKey(value: string): string {
  return value.trim().toLowerCase();
}

function buildCategoryMap(categories: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const category of categories) {
    const normalized = normalizeCategoryKey(category);
    if (!normalized || map.has(normalized)) continue;
    map.set(normalized, category);
  }
  return map;
}

function pruneGoals(
  profile: GoalProfile,
  categoryMap: Map<string, string>,
): {
  profile: GoalProfile;
  removedCount: number;
} {
  const entries = Object.entries(profile.goals ?? {});
  if (!entries.length) return { profile, removedCount: 0 };

  const kept: Array<[string, number]> = [];
  for (const [key, value] of entries) {
    const normalized = normalizeCategoryKey(key);
    const canonical = categoryMap.get(normalized);
    if (!canonical || !value) continue;
    kept.push([canonical, value]);
  }
  const removedCount = entries.length - kept.length;
  if (removedCount === 0) return { profile, removedCount: 0 };

  return {
    profile: { ...profile, goals: Object.fromEntries(kept) },
    removedCount,
  };
}

export async function loadProfilesForCategories(categories: string[]): Promise<{
  profiles: GoalProfile[];
  activeProfile: GoalProfile;
  activeProfileId: string;
  prunedGoalCount: number;
}> {
  const { profiles: defaults, systemVersion } = await fetchSystemProfiles();
  const existing = await db.getAllGoalProfiles();
  const existingById = new Map(existing.map((p) => [p.id, p] as const));
  const username = await db.getUsername();
  const versionKey = username ? `profiles.systemVersion.${username}` : 'profiles.systemVersion';
  const storedVersion = (await db.getAppPref<number>(versionKey)) ?? 0;

  if (existing.length === 0) {
    await Promise.all(defaults.map((p) => db.saveGoalProfile(p)));
    await db.setAppPref(versionKey, systemVersion);
  } else {
    // update profiles if system version is newer
    if (storedVersion < systemVersion) {
      const updates: GoalProfile[] = [];
      const creations: GoalProfile[] = [];

      for (const defaultProfile of defaults) {
        const existingProfile = existingById.get(defaultProfile.id);
        // if profile exists, update it
        if (existingProfile) {
          updates.push({
            ...existingProfile,
            name: defaultProfile.name,
            description: defaultProfile.description,
            goals: defaultProfile.goals,
            isEditable: defaultProfile.isEditable,
            createdVersion: defaultProfile.createdVersion ?? existingProfile.createdVersion,
          });
          continue;
        }
        const createdVersion = defaultProfile.createdVersion ?? FALLBACK_SYSTEM_PROFILES_VERSION;
        // if profile doesn't exist, add it only if it's new (ignore user deleted system profiles)
        if (createdVersion > storedVersion) {
          creations.push({
            ...defaultProfile,
            createdVersion,
          });
        }
      }

      if (updates.length > 0 || creations.length > 0) {
        await Promise.all([...updates, ...creations].map((p) => db.saveGoalProfile(p)));
      }

      await db.setAppPref(versionKey, systemVersion);
    }
  }

  let profiles = await db.getAllGoalProfiles();
  if (profiles.length === 0) {
    await Promise.all(defaults.map((p) => db.saveGoalProfile(p)));
    profiles = defaults;
  }

  let activeProfileId = await db.getActiveGoalProfileId();
  const activeExists = activeProfileId && profiles.some((p) => p.id === activeProfileId);
  if (!activeExists) {
    const fallbackId = defaults[0]?.id ?? profiles[0]?.id;
    if (fallbackId) {
      await db.setActiveGoalProfile(fallbackId);
      activeProfileId = fallbackId;
    }
  }

  let prunedGoalCount = 0;
  if (categories.length > 0) {
    const categoryMap = buildCategoryMap(categories);
    const updatedProfiles: GoalProfile[] = [];
    for (const profile of profiles) {
      const { profile: nextProfile, removedCount } = pruneGoals(profile, categoryMap);
      if (removedCount > 0) {
        await db.saveGoalProfile(nextProfile);
        prunedGoalCount += removedCount;
      }
      updatedProfiles.push(nextProfile);
    }
    profiles = updatedProfiles;
  }

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? defaults[0];
  const resolvedActiveId = activeProfile?.id ?? '';

  return {
    profiles,
    activeProfile,
    activeProfileId: resolvedActiveId,
    prunedGoalCount,
  };
}

/**
 * Return the currently active profile or seed the DB with the system
 * preset from the JSON file.
 */
export async function getActiveOrInitProfile(): Promise<GoalProfile> {
  const result = await loadProfilesForCategories([]);
  return result.activeProfile;
}
