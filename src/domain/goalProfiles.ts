import { GoalProfile } from '../types/types';
import { db } from '../storage/db';

/**
 * Fetch system goal profiles from the public JSON file.
 * Falls back to an inline minimal profile if the network fetch fails
 * (handy for unit tests without a dev server).
 */
type SystemProfilesPayload = {
  systemProfilesVersion: number;
  profiles: GoalProfile[];
};

const FALLBACK_SYSTEM_PROFILES_VERSION = 0;

export async function fetchSystemProfiles(): Promise<{
  profiles: GoalProfile[];
  systemVersion: number;
}> {
  try {
    const res = await fetch('/system-goal-profiles.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = (await res.json()) as SystemProfilesPayload;
    const rawProfiles = payload.profiles;
    const systemVersion = payload.systemProfilesVersion;
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

export function filterProfileForCategories(
  profile: GoalProfile,
  categories: string[],
): {
  effectiveProfile: GoalProfile;
  ignoredGoals: string[];
} {
  const categorySet = new Set(categories);
  const effectiveGoals: Array<[string, number]> = [];
  const ignoredGoals: string[] = [];
  const entries = Object.entries(profile.goals ?? {}).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0,
  );
  for (const [key, value] of entries) {
    if (categorySet.has(key)) {
      effectiveGoals.push([key, value]);
    } else {
      ignoredGoals.push(key);
    }
  }

  return {
    effectiveProfile: { ...profile, goals: Object.fromEntries(effectiveGoals) },
    ignoredGoals,
  };
}

export async function loadProfilesForCategories(categories: string[]): Promise<{
  profiles: GoalProfile[];
  activeProfile: GoalProfile;
  activeProfileId: string;
  ignoredGoals: string[];
}> {
  const { profiles: systemProfiles, systemVersion } = await fetchSystemProfiles();
  const existing = await db.getAllGoalProfiles();
  const existingById = new Map(existing.map((p) => [p.id, p] as const));
  const username = await db.getUsernameOrThrow();
  const versionKey = `profiles.systemVersion.${username}`;
  const storedVersion = (await db.getAppPref<number>(versionKey)) ?? 0;

  if (existing.length === 0) {
    await Promise.all(systemProfiles.map((p) => db.saveGoalProfile(p)));
    await db.setAppPref(versionKey, systemVersion);
  } else {
    // update stored system profiles if version is newer
    if (storedVersion < systemVersion) {
      const updates: GoalProfile[] = [];
      const creations: GoalProfile[] = [];

      for (const systemProfile of systemProfiles) {
        const existingProfile = existingById.get(systemProfile.id);
        // if profile exists, update it
        if (existingProfile) {
          updates.push({
            ...existingProfile,
            name: systemProfile.name,
            description: systemProfile.description,
            goals: systemProfile.goals,
            isEditable: systemProfile.isEditable,
            createdVersion: systemProfile.createdVersion ?? existingProfile.createdVersion,
          });
          continue;
        }
        const createdVersion = systemProfile.createdVersion ?? FALLBACK_SYSTEM_PROFILES_VERSION;
        // if profile doesn't exist, add it only if it's new (ignore user deleted system profiles)
        if (createdVersion > storedVersion || systemProfile.id === 'default') {
          creations.push({
            ...systemProfile,
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

  // reload profiles after potential updates/creations
  const profiles = await db.getAllGoalProfiles();

  // resolve active profile
  let activeProfileId = await db.getActiveGoalProfileId();
  let activeProfile = profiles.find((p) => p.id === activeProfileId);
  if (!activeProfile || !activeProfileId) {
    const fallbackProfile = profiles[0]!!;
    await db.setActiveGoalProfile(fallbackProfile.id);
    activeProfileId = fallbackProfile.id;
    activeProfile = fallbackProfile;
  }

  const filtered = filterProfileForCategories(activeProfile, categories);

  return {
    profiles,
    activeProfile: filtered.effectiveProfile,
    activeProfileId,
    ignoredGoals: filtered.ignoredGoals,
  };
}
