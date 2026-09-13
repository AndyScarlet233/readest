import { describe, expect, test } from 'vitest';

import {
  isCloudSyncAllowed,
  isCustomizationAllowed,
  isEmailInPlan,
  isNearbyPairingAllowed,
  isTTSCacheAllowed,
} from '@/utils/access';

describe('fork local feature unlock boundary', () => {
  test('unlocks only client-side or user-owned-resource premium features', () => {
    expect(isCloudSyncAllowed('free', false)).toBe(true);
    expect(isTTSCacheAllowed('free', false)).toBe(true);
    expect(isNearbyPairingAllowed('free', false)).toBe(true);
  });

  test('does not globally forge premium entitlement or unlock server-backed email-in', () => {
    expect(isCustomizationAllowed('free', false)).toBe(false);
    expect(isEmailInPlan('free', false)).toBe(false);
  });
});
