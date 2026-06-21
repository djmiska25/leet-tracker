import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { signOut } from '@/utils/auth';

export default function HeaderNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  /* ---------- helpers ---------- */
  const NavBtn = ({
    path,
    label,
    className,
    isActive,
    ...buttonProps
  }: {
    path: string;
    label: string;
    className?: string;
    isActive: boolean;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
      type="button"
      onClick={() => navigate(path)}
      className={clsx(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium',
        isActive
          ? 'bg-background text-foreground shadow'
          : 'text-muted-foreground hover:text-foreground',
        className,
      )}
      {...buttonProps}
    >
      {label}
    </button>
  );

  /* ---------- render ---------- */
  return (
    <nav className="border-b bg-card" data-tour="header-nav">
      <div className="max-w-6xl mx-auto flex h-16 items-center px-4 sm:px-6">
        {/* Logo */}
        <div className="flex items-center">
          <h1 className="text-lg font-semibold">LeetTracker</h1>
        </div>

        {/* Right-side controls */}
        <div className="ml-auto flex items-center gap-4">
          {/* View selector */}
          <div className="hidden sm:inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1">
            <NavBtn
              path="/dashboard"
              label="Dashboard"
              className="dashboard-nav"
              isActive={currentPath === '/dashboard' || currentPath === '/'}
            />
            <NavBtn
              path="/solve-history"
              label="Solve History"
              className="solve-history-nav"
              data-tour="nav-history"
              isActive={currentPath.startsWith('/solve-history')}
            />
            <NavBtn
              path="/problem-details"
              label="Problem Details"
              className="problem-details-nav"
              isActive={currentPath.startsWith('/problem-details')}
            />
          </div>

          <ThemeToggle />
          <Button
            variant="ghost"
            onClick={() => window.dispatchEvent(new CustomEvent('leet:replay-tour'))}
            className="replay-tour-btn"
            title="Replay tutorial"
          >
            Help
          </Button>

          <Button variant="ghost" onClick={() => signOut({ skipConfirm: false })}>
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
}
