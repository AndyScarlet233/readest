import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';

/**
 * The pairing opt-in on an incoming Nearby BookDrop request.
 *
 * The fork unlock entitles every local user to pairing, so the locked
 * Premium-badge variant is unreachable here: a cert-verified sender always
 * gets the interactive checkbox. (Upstream renders a decorative locked row
 * for users without the entitlement.)
 */

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (s: string, o?: Record<string, unknown>) =>
    s.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(o?.[k] ?? '')),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({ envConfig: {}, appService: { osPlatform: 'macos' } }),
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/store/themeStore', () => ({
  useThemeStore: () => ({ safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 } }),
}));

const quota = { userProfilePlan: 'free' as string | undefined, customizationPurchased: false };
vi.mock('@/hooks/useQuotaStats', () => ({ useQuotaStats: () => quota }));

import ReceiveRequestDialog from '@/components/localsend/ReceiveRequestDialog';
import en from '../../../../public/locales/en/translation.json';

const request = {
  sessionId: 's1',
  sender: {
    alias: 'Readest',
    deviceModel: 'macOS',
    deviceType: 'desktop',
    fingerprint: 'fp',
    certVerified: true,
  },
  files: [
    { id: 'f1', fileName: 'Moby-Dick.epub', size: 1_550_000, fileType: 'epub', preview: null },
  ],
};

const renderDialog = () =>
  render(
    <ReceiveRequestDialog request={request as never} onAccept={vi.fn()} onDecline={vi.fn()} />,
  );

afterEach(() => {
  cleanup();
  quota.userProfilePlan = 'free';
  quota.customizationPurchased = false;
});

describe('ReceiveRequestDialog pairing opt-in', () => {
  it('offers a single opt-in, with no separate "accept once" choice', () => {
    quota.customizationPurchased = true;
    renderDialog();
    expect(screen.getByText('Always accept from Readest')).toBeTruthy();
    expect(screen.queryByText('Accept once')).toBeNull();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('fork unlock: a free user gets the interactive pairing checkbox', () => {
    renderDialog();
    expect(screen.queryByText('Premium')).toBeNull();
    const box = document.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(box).not.toBeNull();
    // Interactive: not the decorative locked row, which is unreachable now.
    expect(box!.disabled).toBe(false);
    expect(box!.checked).toBe(false);
    expect(box!.className).not.toContain('pointer-events-none');
  });

  it('passes the book count to the title so i18next can pluralise it', () => {
    renderDialog();
    // The mock translator only interpolates, so this proves `count` reaches
    // the key; the plural forms themselves are asserted below.
    expect(screen.getByText('Readest wants to send you 1 book(s)')).toBeTruthy();
    // The total size used to be repeated here even though every row shows one.
    expect(screen.queryByText(/1 book\(s\), /)).toBeNull();
  });

  it('ships English plural forms for the title, or it renders as "1 book(s)"', () => {
    const key = '{{alias}} wants to send you {{count}} book(s)';
    expect(en[`${key}_one` as keyof typeof en]).toBe('{{alias}} wants to send you {{count}} book');
    expect(en[`${key}_other` as keyof typeof en]).toBe(
      '{{alias}} wants to send you {{count}} books',
    );
  });
});
