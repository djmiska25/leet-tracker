import posthog from 'posthog-js';
import { captureInitialAttribution, getStoredAttribution } from './utm';

const DEMO_USERNAME = import.meta.env.VITE_DEMO_USERNAME;

/**
 * SHA-256 helper to hash the LeetCode username before sending to PostHog.
 * Returns a lowercase hex string.
 */
export async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

let identified = false;
let attributionCaptured = false;

/**
 * Capture UTM parameters and referrer on first app load.
 * Call this early in the app lifecycle, before user identification.
 * Safe to call multiple times - only captures once per session.
 */
export function initializeAttribution(): void {
  if (attributionCaptured) return;

  try {
    captureInitialAttribution();
    attributionCaptured = true;
  } catch (err) {
    console.warn('[analytics] Failed to capture attribution', err);
  }
}

/**
 * Identify the current user (once per page load) and emit the `app_opened` event.
 * Automatically includes first-touch attribution data (UTMs, referrer) if available.
 */
export async function identifyUser(username: string, props: { lastSync: number }): Promise<void> {
  if (!username || identified || username == DEMO_USERNAME) return;
  try {
    const distinctId = await sha256(username);

    // Get stored attribution data for first-touch attribution
    const attribution = getStoredAttribution();

    // Merge attribution data into user properties
    const userProps = {
      username: username,
      ...(attribution && {
        initial_utm_source: attribution.utm_source,
        initial_utm_medium: attribution.utm_medium,
        initial_utm_campaign: attribution.utm_campaign,
        initial_utm_content: attribution.utm_content,
        initial_utm_term: attribution.utm_term,
        initial_referrer: attribution.initial_referrer,
        initial_landing_page: attribution.initial_landing_page,
        attribution_timestamp: attribution.attribution_timestamp,
      }),
    };

    posthog.identify(distinctId, userProps);
    posthog.people.set(props);
    identified = true;

    // Include attribution in the app_opened event for immediate visibility
    posthog.capture('app_opened', { ...props, ...attribution });
  } catch (err) {
    // Analytics failure shouldn't break the app
    console.warn('[analytics] identify failed', err);
  }
}

export async function resetUser() {
  if (!identified) return;
  try {
    posthog.reset();
    identified = false;
  } catch (err) {
    // Analytics failure shouldn't break the app
    console.warn('[analytics] reset failed', err);
  }
}

/**
 * Reset attribution and identification flags.
 * For testing purposes only - resets session state without clearing stored data.
 * @internal
 */
export function __resetAnalyticsState() {
  identified = false;
  attributionCaptured = false;
}

/* ---------- helper wrappers ---------- */

export const trackUserSignedIn = (hasDemoAccount: boolean) =>
  posthog.capture('user_signed_in', { hasDemoAccount });

export const trackSyncCompleted = (
  numNewSolves: number,
  durationMs: number,
  usedExtension: boolean,
) => posthog.capture('sync_completed', { numNewSolves, durationMs, usedExtension });

export const trackSolveSaved = (slug: string, status: string | undefined, withFeedback: boolean) =>
  posthog.capture('solve_saved', { slug, status, withFeedback });

export const trackPromptCopied = (slug: string) => posthog.capture('prompt_copied', { slug });

export const trackFeedbackImported = (slug: string, finalScore: number) =>
  posthog.capture('feedback_imported', { slug, finalScore });

export const trackRecommendationClicked = (slug: string, bucket: string, tag: string) =>
  posthog.capture('recommendation_clicked', { slug, bucket, tag });

export const trackProfileChanged = (newProfileId: string) =>
  posthog.capture('profile_changed', { newProfileId });

export const trackProfileGoalsIgnored = (payload: {
  profileId: string;
  profileName: string;
  ignoredGoals: string[];
}) => posthog.capture('profile_goals_ignored', payload);

export const trackExtensionDetected = () => posthog.capture('extension_detected');

export const trackTourStarted = () => posthog.capture('tour_started');

export const trackTourFinished = (status: 'finished' | 'skipped') =>
  posthog.capture('tour_finished', { status });

export const trackTourStep = (stepId: string, view: 'dashboard' | 'history') =>
  posthog.capture('tour_step', { stepId, view });

export const trackErrorBoundary = (errorMessage: string, stack?: string) =>
  posthog.capture('error_boundary_triggered', { errorMessage, stack });

export const trackUnknownDifficulty = (raw: string) =>
  posthog.capture('unknown_difficulty_value', { raw });

/* ---------- Onboarding tracking ---------- */

export const trackOnboardingStarted = (username: string, hasExtension: boolean) =>
  posthog.capture('onboarding_started', { username, hasExtension });

export const trackOnboardingStepChanged = (
  username: string,
  step: 'extension_install' | 'data_sync',
  direction: 'forward' | 'back',
) => posthog.capture('onboarding_step_changed', { username, step, direction });

export const trackOnboardingCompleted = (
  username: string,
  durationMs: number,
  skippedExtension: boolean,
) => posthog.capture('onboarding_completed', { username, durationMs, skippedExtension });

export const trackOnboardingAbandoned = (
  username: string,
  currentStep: 'extension_install' | 'data_sync',
) => posthog.capture('onboarding_abandoned', { username, currentStep });

export const trackExtensionInstallViewed = (username: string) =>
  posthog.capture('extension_install_viewed', { username });

export const trackExtensionInstallClicked = (username: string) =>
  posthog.capture('extension_install_clicked', { username });

export const trackDataSyncStarted = (username: string) =>
  posthog.capture('data_sync_started', { username });

export const trackDataSyncCompleted = (
  username: string,
  syncTimeMs: number,
  problemCount: number,
  solveCount: number,
) => posthog.capture('data_sync_completed', { username, syncTimeMs, problemCount, solveCount });

export const trackDataSyncError = (username: string, errorMessage: string) =>
  posthog.capture('data_sync_error', { username, errorMessage });

export const trackDemoModeSelected = (username: string) =>
  posthog.capture('demo_mode_selected', { username });
