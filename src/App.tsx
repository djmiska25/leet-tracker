import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, matchPath } from 'react-router-dom';
import { useInitApp } from '@/hooks/useInitApp';
import Dashboard from '@/components/Dashboard';
import SignIn from '@/components/SignIn';
import SolveHistory from '@/components/solveHistory/SolveHistory';
import ProblemDetails from '@/components/problemDetails/ProblemDetails';
import HeaderNav from '@/components/HeaderNav';
import TutorialPrompt from '@/components/TutorialPrompt';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { useTutorial } from '@/tutorial/TutorialContext';
import { buildSteps } from '@/tutorial/steps';
import { db } from '@/storage/db';
import {
  getTutorialSeen,
  markTutorialSeen,
  getTutorialActive,
  getTutorialStartedWithUser,
  setPrevUser,
  getOnboardingComplete,
  markOnboardingComplete,
  clearOnboardingComplete,
} from '@/storage/db';
import { checkExtensionInstalled } from '@/api/extensionBridge';
import { syncProblemCatalog } from '@/domain/syncProblemCatalog';
import { useExtensionPoller } from '@/hooks/useExtensionPoller';
import { initializeAttribution } from '@/utils/analytics';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, username } = useInitApp();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [extensionInstalled, setExtensionInstalled] = useState(false);

  // Determine current view state for manual rendering
  const isDashboard =
    location.pathname === '/dashboard' || location.pathname === '/' || location.pathname === '';
  const isHistory = location.pathname.startsWith('/solve-history');
  const historyMatch = matchPath({ path: '/solve-history/:solveId', end: true }, location.pathname);
  const solveId = historyMatch?.params.solveId;
  const isProblemDetails = location.pathname.startsWith('/problem-details');
  const problemDetailsMatch = matchPath(
    { path: '/problem-details/:slug', end: true },
    location.pathname,
  );
  const problemSlug = problemDetailsMatch?.params.slug;

  const tutorial = useTutorial();
  const [showPrompt, setShowPrompt] = useState(false);
  const [tutorialInitialized, setTutorialInitialized] = useState(false);

  const demoUsername = import.meta.env.VITE_DEMO_USERNAME || 'leet-tracker-demo-user';

  const steps = useMemo(
    () =>
      buildSteps({
        extensionInstalled,
        onNavigateToHistory: () => navigate('/solve-history'),
      }),
    [extensionInstalled, navigate],
  );

  // Capture UTM parameters and attribution on first app load
  useEffect(() => {
    initializeAttribution();
  }, []);

  // Initialize problem catalog on app startup (runs once, independent of user sign-in)
  useEffect(() => {
    syncProblemCatalog();
  }, []); // Empty dependency array = runs once on mount

  // Check extension installation status when user is loaded
  useEffect(() => {
    (async () => {
      if (!username) return;
      if (username === demoUsername) {
        setExtensionInstalled(false);
        return;
      }
      const isInstalled = await checkExtensionInstalled();
      setExtensionInstalled(isInstalled);
    })();
  }, [username, demoUsername]);

  // GLOBAL POLLER: Single instance of extension polling for entire app
  // Components (Dashboard, SolveHistory) listen to 'solves-updated' events passively
  useExtensionPoller({
    onSolvesUpdated: (count) => {
      console.log(`[App] ${count} new solves detected from global poller`);
      // Event is dispatched by poller - components will handle their own updates
    },
  });

  // Check if user needs to see onboarding
  useEffect(() => {
    (async () => {
      if (loading || onboardingChecked) return;
      if (!username) {
        setOnboardingChecked(true);
        return;
      }

      // Skip onboarding for demo user entirely
      if (username === demoUsername) {
        setShowOnboarding(false);
        setOnboardingChecked(true);
        return;
      }

      // Check escape hatch for development (allows bypassing extension requirement)
      const skipExtensionCheck =
        localStorage.getItem('leet-tracker-skip-extension-check') === 'true';

      // Check if this user has completed onboarding
      const hasCompleted = skipExtensionCheck ? true : await getOnboardingComplete(username);

      // If user has completed onboarding, verify extension is still installed
      if (hasCompleted && !skipExtensionCheck) {
        console.log('[App] Verifying extension installation for onboarded user...');
        const isInstalled = await checkExtensionInstalled();

        if (!isInstalled) {
          console.warn('[App] Extension not detected - resetting onboarding for user:', username);
          // Reset onboarding state to force user through setup again
          await clearOnboardingComplete(username);
          setShowOnboarding(true);
          setOnboardingChecked(true);
          return;
        }
      }

      setShowOnboarding(!hasCompleted);
      setOnboardingChecked(true);
    })();
  }, [loading, username, onboardingChecked, demoUsername]);

  // Handle navigation events from tutorial
  useEffect(() => {
    const handleNavigateToHistory = () => navigate('/solve-history');
    const handleShowTutorialPrompt = () => setShowPrompt(true);

    window.addEventListener('leet:navigate-to-history', handleNavigateToHistory);
    window.addEventListener('leet:show-tutorial-prompt', handleShowTutorialPrompt);
    return () => {
      window.removeEventListener('leet:navigate-to-history', handleNavigateToHistory);
      window.removeEventListener('leet:show-tutorial-prompt', handleShowTutorialPrompt);
    };
  }, [navigate]);

  useEffect(() => {
    (async () => {
      if (loading || tutorialInitialized) return;
      if (!username) return; // No prompt on sign-in screen

      // If tutorial is already active, check if we need to provide steps
      if (await getTutorialActive()) {
        // If we're on demo account and tutorial is active but no steps are loaded,
        // we need to restart with steps (happens after user switching + reload)
        if (username === demoUsername && tutorial.steps.length === 0) {
          const startedWithUser = await getTutorialStartedWithUser();
          await tutorial.start(steps, { startedWith: startedWithUser || 'normal' });
        }
        setTutorialInitialized(true);
        return;
      }

      // If user has opted out, don't show prompt
      if (await getTutorialSeen()) {
        setTutorialInitialized(true);
        return;
      }

      // If we're the demo user and tutorial was started by switching from normal user,
      // start tutorial immediately without prompt
      const startedWithUser = await getTutorialStartedWithUser();
      if (username === demoUsername && startedWithUser === 'normal') {
        await tutorial.start(steps, { startedWith: 'normal' });
        setTutorialInitialized(true);
        return;
      }

      // Show tutorial prompt to any signed-in user
      setShowPrompt(true);
      setTutorialInitialized(true);
    })();
  }, [loading, username, demoUsername, tutorial, steps, tutorialInitialized]);

  const startTutorialFlow = async () => {
    setShowPrompt(false);

    // If the user is already demo, start the tutorial and reload to reset all state
    if (username === demoUsername) {
      await tutorial.start(steps, { startedWith: 'demo' });
      // Reload to ensure we're on dashboard with clean state
      window.location.assign('/dashboard');
      return;
    }

    // Normal user: switch to demo, remember who to restore.
    await setPrevUser(username!);
    await db.setUsername(demoUsername);
    // We want the tutorial to autostart after reload:
    //   TutorialProvider resumes because tutorial.active stays true.
    // Set active now and reload.
    await tutorial.start(steps, { startedWith: 'normal' });

    // Important: after setting state, reload to ensure demo data loads
    window.location.assign('/dashboard');
  };

  const handleOnboardingComplete = async () => {
    if (username) {
      await markOnboardingComplete(username);
      setShowOnboarding(false);
    }
  };

  if (loading || !onboardingChecked) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }
  if (!username) {
    return <SignIn />;
  }

  // Show onboarding flow for users who haven't completed it (excluding demo user)
  if (showOnboarding && username !== demoUsername) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} username={username} />;
  }

  return (
    <>
      <HeaderNav />
      <TutorialPrompt
        open={showPrompt}
        onStart={startTutorialFlow}
        onLater={() => setShowPrompt(false)}
        onNever={async () => {
          await markTutorialSeen();
          setShowPrompt(false);
        }}
      />
      {/* We use manual display toggling to preserve state/prevent re-renders when switching tabs */}
      <div style={{ display: isDashboard ? 'block' : 'none' }}>
        <Dashboard username={username} />
      </div>
      <div style={{ display: isHistory ? 'block' : 'none' }}>
        <SolveHistory activeSolveId={solveId} />
      </div>
      <div style={{ display: isProblemDetails ? 'block' : 'none' }}>
        <ProblemDetails activeSlug={problemSlug} />
      </div>

      {/* Keep Routes for URL side-effects or future dedicated routes, but main views are handled above */}
      <Routes>
        <Route path="/" element={null} />
        <Route path="/dashboard" element={null} />
        <Route path="/solve-history" element={null} />
        <Route path="/solve-history/:solveId" element={null} />
        <Route path="/problem-details" element={null} />
        <Route path="/problem-details/:slug" element={null} />
      </Routes>
    </>
  );
}

export default App;
