import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// The user-plan cache is read synchronously by non-React cloud-sync gates, so a
// sign-out that fails to clear it leaves the previous account looking premium.
// Customization entitlement is no longer a module-level cache in the current
// fork: it is derived directly from the current JWT and must flip immediately
// when that token changes.

const auth = vi.hoisted(() => ({ token: null as string | null, user: null as unknown }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));

const cache = vi.hoisted(() => ({
  setCachedUserPlan: vi.fn(),
}));
vi.mock('@/services/sync/cloudSyncProvider', () => cache);

vi.mock('@/hooks/useTranslation', () => ({ useTranslation: () => (s: string) => s }));

vi.mock('@/utils/access', () => ({
  getStoragePlanData: () => ({ plan: 'free', usage: 0, quota: 1000 }),
  getTranslationPlanData: () => ({ plan: 'free', usage: 0, quota: 1000 }),
  getUserProfilePlan: () => 'purchase',
  getCustomizationPurchased: () => true,
}));

import { useQuotaStats } from '@/hooks/useQuotaStats';

beforeEach(() => {
  cache.setCachedUserPlan.mockReset();
});

describe('useQuotaStats — account changes clear stale entitlement state', () => {
  it('caches the user plan while deriving customization from the current token', () => {
    auth.token = 'a-token';
    auth.user = { id: 'user-1' };

    const { result } = renderHook(() => useQuotaStats());

    expect(result.current.customizationPurchased).toBe(true);
    expect(cache.setCachedUserPlan).toHaveBeenLastCalledWith('purchase');
  });

  it('clears the plan cache and customization entitlement when the session goes away', () => {
    auth.token = 'a-token';
    auth.user = { id: 'user-1' };
    const { rerender, result } = renderHook(() => useQuotaStats());
    expect(cache.setCachedUserPlan).toHaveBeenLastCalledWith('purchase');

    auth.token = null;
    auth.user = null;
    rerender();

    expect(cache.setCachedUserPlan).toHaveBeenLastCalledWith(undefined);
    // Derived from the token, so the rendered value flips in the same pass
    // rather than a render later.
    expect(result.current.customizationPurchased).toBe(false);
  });
});
