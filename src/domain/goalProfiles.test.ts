import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSystemProfiles, loadProfilesForCategories } from './goalProfiles';
import { db } from '@/storage/db';

vi.mock('@/storage/db');
vi.mock('@/utils/analytics', () => ({
  trackProfilePruned: vi.fn(),
}));

describe('loadProfilesForCategories', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('updates system profiles on version bump without touching user profiles', async () => {
    const defaults = [
      {
        id: 'default',
        name: 'Default v2',
        description: 'Updated default',
        createdAt: 'now',
        createdVersion: 2,
        isEditable: false,
        goals: { Array: 0.6 },
      },
    ];

    const existing = [
      {
        id: 'default',
        name: 'Default v1',
        description: 'Old default',
        createdAt: 'then',
        createdVersion: 1,
        isEditable: false,
        goals: { Array: 0.2 },
      },
      {
        id: 'user-1',
        name: 'Custom',
        description: 'User profile',
        createdAt: 'then',
        isEditable: true,
        goals: { Array: 0.9 },
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ systemProfilesVersion: 2, profiles: defaults }),
    } as Response);

    vi.mocked(db.getAllGoalProfiles)
      .mockResolvedValueOnce(existing as any)
      .mockResolvedValueOnce(existing as any)
      .mockResolvedValueOnce(existing as any);
    vi.mocked(db.getUsernameOrThrow).mockResolvedValue('user1');
    vi.mocked(db.getAppPref).mockResolvedValue(1);
    vi.mocked(db.saveGoalProfile).mockResolvedValue('');
    vi.mocked(db.setAppPref).mockResolvedValue();
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue('default');

    await loadProfilesForCategories(['Array']);

    const saved = vi.mocked(db.saveGoalProfile).mock.calls.map((call) => call[0]);
    expect(saved).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'default', name: 'Default v2' })]),
    );
    expect(saved).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'user-1' })]));
    expect(db.setAppPref).toHaveBeenCalled();
  });

  it('creates missing system defaults introduced after the stored version', async () => {
    const defaults = [
      {
        id: 'amazon',
        name: 'Amazon',
        description: 'System Amazon',
        createdAt: 'now',
        createdVersion: 2,
        isEditable: true,
        goals: { Array: 0.7 },
      },
      {
        id: 'google',
        name: 'Google',
        description: 'System Google',
        createdAt: 'now',
        createdVersion: 1,
        isEditable: true,
        goals: { Tree: 0.7 },
      },
    ];

    const existing = [
      {
        id: 'user-1',
        name: 'Amazon',
        description: 'User Amazon',
        createdAt: 'then',
        isEditable: true,
        goals: { Array: 0.9 },
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ systemProfilesVersion: 2, profiles: defaults }),
    } as Response);

    vi.mocked(db.getAllGoalProfiles)
      .mockResolvedValueOnce(existing as any)
      .mockResolvedValueOnce(existing as any)
      .mockResolvedValueOnce(existing as any);
    vi.mocked(db.getUsernameOrThrow).mockResolvedValue('user1');
    vi.mocked(db.getAppPref).mockResolvedValue(1);
    vi.mocked(db.saveGoalProfile).mockResolvedValue('');
    vi.mocked(db.setAppPref).mockResolvedValue();
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue('user-1');

    await loadProfilesForCategories(['Array']);

    const saved = vi.mocked(db.saveGoalProfile).mock.calls.map((call) => call[0]);
    expect(saved).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'amazon' })]));
    expect(saved).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'google' })]));
  });

  it('skips creating missing defaults when createdVersion is not newer', async () => {
    const defaults = [
      {
        id: 'new-default',
        name: 'New Default',
        description: 'System New',
        createdAt: 'now',
        createdVersion: 1,
        isEditable: false,
        goals: { Array: 0.5 },
      },
    ];

    const existing = [
      {
        id: 'user-1',
        name: 'Custom',
        description: 'User profile',
        createdAt: 'then',
        isEditable: true,
        goals: { Array: 0.9 },
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ systemProfilesVersion: 2, profiles: defaults }),
    } as Response);

    vi.mocked(db.getAllGoalProfiles)
      .mockResolvedValueOnce(existing as any)
      .mockResolvedValueOnce(existing as any)
      .mockResolvedValueOnce(existing as any);
    vi.mocked(db.getUsernameOrThrow).mockResolvedValue('user1');
    vi.mocked(db.getAppPref).mockResolvedValue(2);
    vi.mocked(db.saveGoalProfile).mockResolvedValue('');
    vi.mocked(db.setAppPref).mockResolvedValue();
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue(undefined);

    await loadProfilesForCategories(['Array']);

    const saved = vi.mocked(db.saveGoalProfile).mock.calls.map((call) => call[0]);
    expect(saved).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'new-default' })]),
    );
  });

  it('uses the payload system version when seeding defaults', async () => {
    const defaults = [
      {
        id: 'default',
        name: 'Default',
        description: 'System Default',
        createdAt: 'now',
        createdVersion: 1,
        isEditable: false,
        goals: { Array: 0.6 },
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ systemProfilesVersion: 1, profiles: defaults }),
    } as Response);

    vi.mocked(db.getAllGoalProfiles)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce(defaults as any);
    vi.mocked(db.getUsernameOrThrow).mockResolvedValue('user1');
    vi.mocked(db.getAppPref).mockResolvedValue(undefined);
    vi.mocked(db.saveGoalProfile).mockResolvedValue('');
    vi.mocked(db.setAppPref).mockResolvedValue();
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue(undefined);

    await loadProfilesForCategories(['Array']);

    expect(db.setAppPref).toHaveBeenCalledWith('profiles.systemVersion.user1', 1);
  });

  it('replaces fallback profiles when system data becomes available', async () => {
    const fallbackProfiles = [
      {
        id: 'default',
        name: 'Default',
        description: 'Fallback profile',
        createdAt: 'now',
        createdVersion: 0,
        isEditable: false,
        goals: { Array: 0.6 },
      },
    ];
    const defaults = [
      {
        id: 'default',
        name: 'Default v2',
        description: 'System Default',
        createdAt: 'now',
        createdVersion: 1,
        isEditable: false,
        goals: { Array: 0.7 },
      },
    ];

    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ systemProfilesVersion: 2, profiles: defaults }),
      } as Response);

    vi.mocked(db.getAllGoalProfiles)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce(fallbackProfiles as any)
      .mockResolvedValueOnce(fallbackProfiles as any)
      .mockResolvedValueOnce(fallbackProfiles as any)
      .mockResolvedValueOnce(fallbackProfiles as any);
    vi.mocked(db.getUsernameOrThrow).mockResolvedValue('user1');
    vi.mocked(db.getAppPref).mockResolvedValueOnce(undefined).mockResolvedValueOnce(0);
    vi.mocked(db.saveGoalProfile).mockResolvedValue('');
    vi.mocked(db.setAppPref).mockResolvedValue();
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue('default');

    await loadProfilesForCategories(['Array']);
    await loadProfilesForCategories(['Array']);

    const saved = vi.mocked(db.saveGoalProfile).mock.calls.map((call) => call[0]);
    expect(saved).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'default', name: 'Default v2' })]),
    );
    expect(db.setAppPref).toHaveBeenCalledWith('profiles.systemVersion.user1', 2);
  });

  it('does not overwrite existing profiles when only fallback data is available', async () => {
    const existing = [
      {
        id: 'default',
        name: 'Default',
        description: 'System Default',
        createdAt: 'then',
        createdVersion: 0,
        isEditable: false,
        goals: { Array: 0.6 },
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    vi.mocked(db.getAllGoalProfiles)
      .mockResolvedValueOnce(existing as any)
      .mockResolvedValueOnce(existing as any)
      .mockResolvedValueOnce(existing as any);
    vi.mocked(db.getUsernameOrThrow).mockResolvedValue('user1');
    vi.mocked(db.getAppPref).mockResolvedValue(0);
    vi.mocked(db.saveGoalProfile).mockResolvedValue('');
    vi.mocked(db.setAppPref).mockResolvedValue();
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue('default');

    await loadProfilesForCategories(['Array']);

    expect(db.saveGoalProfile).not.toHaveBeenCalled();
    expect(db.setAppPref).not.toHaveBeenCalled();
  });

  it('prunes goals using exact category matches', async () => {
    const defaults = [
      {
        id: 'default',
        name: 'Default',
        description: 'System Default',
        createdAt: 'now',
        createdVersion: 1,
        isEditable: false,
        goals: { Array: 0.6 },
      },
    ];
    const existing = [
      {
        id: 'default',
        name: 'Default',
        description: 'System Default',
        createdAt: 'then',
        createdVersion: 1,
        isEditable: false,
        goals: { Array: 0.5, array: 0.4, 'Hash Table': 0.2 },
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ systemProfilesVersion: 1, profiles: defaults }),
    } as Response);

    vi.mocked(db.getAllGoalProfiles).mockResolvedValue(existing as any);
    vi.mocked(db.getUsernameOrThrow).mockResolvedValue('user1');
    vi.mocked(db.getAppPref).mockResolvedValue(1);
    vi.mocked(db.saveGoalProfile).mockResolvedValue('');
    vi.mocked(db.setAppPref).mockResolvedValue();
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue('default');

    const result = await loadProfilesForCategories(['Array']);

    expect(result.prunedGoalCount).toBe(2);
    expect(db.saveGoalProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'default',
        goals: { Array: 0.5 },
      }),
    );
  });
});

describe('fetchSystemProfiles', () => {
  it('parses the expected system profiles payload shape', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        systemProfilesVersion: 3,
        profiles: [
          {
            id: 'default',
            name: 'Default',
            description: 'System Default',
            goals: { Array: 0.6 },
            isEditable: false,
            createdAt: '',
            createdVersion: 2,
          },
          {
            id: 'interview',
            name: 'Interview Prep',
            description: 'System Interview',
            goals: { String: 0.5 },
          },
        ],
      }),
    } as Response);

    const result = await fetchSystemProfiles();

    expect(result.systemVersion).toBe(3);
    expect(result.profiles).toHaveLength(2);
    expect(result.profiles[0]).toEqual(
      expect.objectContaining({
        id: 'default',
        name: 'Default',
        isEditable: false,
        createdVersion: 2,
      }),
    );
    expect(result.profiles[0].createdAt).not.toBe('');
    expect(result.profiles[1]).toEqual(
      expect.objectContaining({
        id: 'interview',
        isEditable: false,
        createdVersion: 0,
      }),
    );
    expect(result.profiles[1].createdAt).toBeDefined();
  });
});
