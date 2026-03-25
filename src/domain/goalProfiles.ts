import { GoalProfile } from '../types/types';
import { db } from '../storage/db';
import { trackProfilePruned } from '@/utils/analytics';

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

function pruneGoals(
  profile: GoalProfile,
  categorySet: Set<string>,
): {
  profile: GoalProfile;
  removedCount: number;
} {
  const entries = Object.entries(profile.goals ?? {});
  if (!entries.length) return { profile, removedCount: 0 };

  const kept: Array<[string, number]> = [];
  for (const [key, value] of entries) {
    if (!categorySet.has(key) || !value) continue;
    kept.push([key, value]);
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
  let profiles = await db.getAllGoalProfiles();

  // prune goals based on categories (handles case where leetcode updates catalog and some categories are removed)
  let prunedGoalCount = 0;
  const categorySet = new Set(categories);
  const updatedProfiles: GoalProfile[] = [];
  for (const profile of profiles) {
    const { profile: nextProfile, removedCount } = pruneGoals(profile, categorySet);
    if (removedCount > 0) {
      const previousGoals = Object.fromEntries(
        Object.entries(profile.goals ?? {}).filter(([, value]) => typeof value === 'number'),
      ) as Record<string, number>;
      const removedGoals = Object.keys(previousGoals).filter(
        (key) => !(nextProfile.goals && key in nextProfile.goals),
      );
      trackProfilePruned({
        profileId: profile.id,
        profileName: profile.name,
        previousGoals,
        removedGoals,
        categories: categories.slice(),
      });
      await db.saveGoalProfile(nextProfile);
      prunedGoalCount += removedCount;
    }
    updatedProfiles.push(nextProfile);
  }
  profiles = updatedProfiles;

  // resolve active profile
  let activeProfileId = await db.getActiveGoalProfileId();
  let activeProfile = profiles.find((p) => p.id === activeProfileId);
  if (!activeProfile || !activeProfileId) {
    const fallbackProfile = profiles[0]!!;
    await db.setActiveGoalProfile(fallbackProfile.id);
    activeProfileId = fallbackProfile.id;
    activeProfile = fallbackProfile;
  }

  return {
    profiles,
    activeProfile,
    activeProfileId,
    prunedGoalCount,
  };
}
