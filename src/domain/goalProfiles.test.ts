import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadProfilesForCategories } from './goalProfiles';
import { db } from '@/storage/db';

vi.mock('@/storage/db');

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
      .mockResolvedValueOnce(existing as any);
    vi.mocked(db.getUsername).mockResolvedValue('user1');
    vi.mocked(db.getAppPref).mockResolvedValue(1);
    vi.mocked(db.saveGoalProfile).mockResolvedValue('');
    vi.mocked(db.setAppPref).mockResolvedValue();
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue('default');

    await loadProfilesForCategories([]);

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
      .mockResolvedValueOnce(existing as any);
    vi.mocked(db.getUsername).mockResolvedValue('user1');
    vi.mocked(db.getAppPref).mockResolvedValue(1);
    vi.mocked(db.saveGoalProfile).mockResolvedValue('');
    vi.mocked(db.setAppPref).mockResolvedValue();
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue('user-1');

    await loadProfilesForCategories([]);

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
      .mockResolvedValueOnce(existing as any);
    vi.mocked(db.getUsername).mockResolvedValue('user1');
    vi.mocked(db.getAppPref).mockResolvedValue(2);
    vi.mocked(db.saveGoalProfile).mockResolvedValue('');
    vi.mocked(db.setAppPref).mockResolvedValue();
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue(undefined);

    await loadProfilesForCategories([]);

    const saved = vi.mocked(db.saveGoalProfile).mock.calls.map((call) => call[0]);
    expect(saved).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'new-default' })]),
    );
  });

  it('uses fallback system version when payload omits it', async () => {
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
      json: async () => defaults,
    } as Response);

    vi.mocked(db.getAllGoalProfiles)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any);
    vi.mocked(db.getUsername).mockResolvedValue('user1');
    vi.mocked(db.getAppPref).mockResolvedValue(undefined);
    vi.mocked(db.saveGoalProfile).mockResolvedValue('');
    vi.mocked(db.setAppPref).mockResolvedValue();
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue(undefined);

    await loadProfilesForCategories([]);

    expect(db.setAppPref).toHaveBeenCalledWith('profiles.systemVersion.user1', 0);
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
      .mockResolvedValueOnce(fallbackProfiles as any);
    vi.mocked(db.getUsername).mockResolvedValue('user1');
    vi.mocked(db.getAppPref).mockResolvedValueOnce(undefined).mockResolvedValueOnce(0);
    vi.mocked(db.saveGoalProfile).mockResolvedValue('');
    vi.mocked(db.setAppPref).mockResolvedValue();
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue('default');

    await loadProfilesForCategories([]);
    await loadProfilesForCategories([]);

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
      .mockResolvedValueOnce(existing as any);
    vi.mocked(db.getUsername).mockResolvedValue('user1');
    vi.mocked(db.getAppPref).mockResolvedValue(0);
    vi.mocked(db.saveGoalProfile).mockResolvedValue('');
    vi.mocked(db.setAppPref).mockResolvedValue();
    vi.mocked(db.getActiveGoalProfileId).mockResolvedValue('default');

    await loadProfilesForCategories([]);

    expect(db.saveGoalProfile).not.toHaveBeenCalled();
    expect(db.setAppPref).not.toHaveBeenCalled();
  });
});
