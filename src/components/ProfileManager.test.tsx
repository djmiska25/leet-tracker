import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi, describe, it, beforeAll, beforeEach, afterEach, expect, Mock } from 'vitest';
import ProfileManager from './ProfileManager';
import { db } from '@/storage/db';

describe('<ProfileManager>', () => {
  let setActiveGoalProfileSpy: ReturnType<typeof vi.spyOn>;

  const onDone = vi.fn();
  beforeAll(() => {
    // @ts-ignore
    if (!globalThis.crypto) globalThis.crypto = {};
    // @ts-ignore
    globalThis.crypto.randomUUID = () => 'uuid-1234';
  });

  const profiles = [
    {
      id: 'default',
      name: 'Default',
      description: '',
      goals: {},
      createdAt: '',
      isEditable: false,
    },
    {
      id: 'alt',
      name: 'Alt',
      description: '',
      goals: {},
      createdAt: '',
      isEditable: true,
    },
  ] as any;

  beforeEach(() => {
    vi.spyOn(db, 'getCatalogCategories').mockResolvedValue(['Array', 'Matrix']);
    vi.spyOn(db, 'getAllGoalProfiles').mockResolvedValue(profiles);
    vi.spyOn(db, 'getActiveGoalProfileId').mockResolvedValue('default');
    setActiveGoalProfileSpy = vi.spyOn(db, 'setActiveGoalProfile').mockResolvedValue('') as Mock;
    vi.spyOn(db, 'saveGoalProfile').mockResolvedValue('');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders profiles and highlights the active one', async () => {
    render(<ProfileManager onDone={onDone} />);

    await waitFor(() => {
      const matches = screen.getAllByText(/default/i);
      expect(matches.length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('changes active profile when another card is clicked', async () => {
    const user = userEvent.setup();
    render(<ProfileManager onDone={onDone} />);

    await waitFor(() => expect(screen.getByText(/alt/i)).toBeInTheDocument());

    await user.click(screen.getByText(/alt/i));

    await waitFor(() => expect(setActiveGoalProfileSpy).toHaveBeenCalledWith('alt'));
  });

  it('shows creation form when "New Profile” is clicked and hides on cancel', async () => {
    const user = userEvent.setup();
    render(<ProfileManager onDone={onDone} />);

    const newBtn = await screen.findByRole('button', { name: /new profile/i });
    await user.click(newBtn);

    await waitFor(() => expect(screen.getByLabelText(/profile name/i)).toBeInTheDocument());

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelBtn);

    await waitFor(() => expect(screen.queryByLabelText(/profile name/i)).not.toBeInTheDocument());
  });
});
