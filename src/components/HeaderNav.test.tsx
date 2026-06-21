import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import HeaderNav from './HeaderNav';
import { db } from '@/storage/db';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('<HeaderNav>', () => {
  /* ------------------------------------------------------------ */
  /*  Sign‑out flow mocks                                         */
  /* ------------------------------------------------------------ */
  let confirmSpy: Mock;
  let reloadSpy: ReturnType<typeof vi.fn>;
  let clearUsernameSpy: Mock;
  let setActiveSpy: Mock;
  let clearProfilesSpy: Mock;
  let clearSolvesSpy: Mock;
  let setExtTsSpy: Mock;
  const originalLocation = window.location;

  beforeEach(() => {
    mockNavigate.mockClear();
    /* confirm dialog */
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true) as Mock;

    /* location.reload */
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });

    /* db spies */
    clearUsernameSpy = vi.spyOn(db, 'clearUsername').mockResolvedValue(undefined) as Mock;
    setActiveSpy = vi.spyOn(db, 'setActiveGoalProfile').mockResolvedValue('') as Mock;
    clearProfilesSpy = vi.spyOn(db, 'clearGoalProfiles').mockResolvedValue(undefined) as Mock;
    clearSolvesSpy = vi.spyOn(db, 'clearSolves').mockResolvedValue(undefined) as Mock;
    setExtTsSpy = vi.spyOn(db, 'setExtensionLastTimestamp').mockResolvedValue('') as Mock;
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    clearUsernameSpy.mockRestore();
    setActiveSpy.mockRestore();
    clearProfilesSpy.mockRestore();
    clearSolvesSpy.mockRestore();
    setExtTsSpy.mockRestore();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  /* ------------------------------------------------------------ */
  /*  Navigation buttons                                          */
  /* ------------------------------------------------------------ */
  it('navigates to "solve-history" when History nav is clicked', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /solve history/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/solve-history');
  });

  it('navigates to "dashboard" when Dashboard nav is clicked', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/solve-history']}>
        <HeaderNav />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /dashboard/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates to "problem-details" when Problem Details nav is clicked', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /problem details/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/problem-details');
  });

  /* ------------------------------------------------------------ */
  /*  Help / Tutorial replay                                      */
  /* ------------------------------------------------------------ */
  it('dispatches replay tour event when Help button is clicked', async () => {
    const user = userEvent.setup();
    const eventSpy = vi.fn();

    window.addEventListener('leet:replay-tour', eventSpy);

    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /help/i }));
    expect(eventSpy).toHaveBeenCalled();

    window.removeEventListener('leet:replay-tour', eventSpy);
  });

  /* ------------------------------------------------------------ */
  /*  Sign‑out behaviour                                          */
  /* ------------------------------------------------------------ */
  it('confirms and signs out when Sign Out button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>,
    );

    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    await user.click(signOutBtn);

    expect(confirmSpy).toHaveBeenCalled();

    await waitFor(() => {
      expect(clearUsernameSpy).toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
    });
  });
});
