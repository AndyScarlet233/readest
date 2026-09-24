import { describe, expect, test } from 'vitest';

import {
  ABS_OFFLINE_REQUIRES_PREMIUM,
  isAbsOfflineAllowed,
  isAbsOfflineInPlan,
} from '@/utils/access';

describe('isAbsOfflineInPlan', () => {
  test('any paid plan can download Audiobookshelf books for offline use', () => {
    expect(isAbsOfflineInPlan('plus', false)).toBe(true);
    expect(isAbsOfflineInPlan('pro', false)).toBe(true);
    // A storage-only buyer reports `purchase` without being entitled.
    expect(isAbsOfflineInPlan('purchase', false)).toBe(false);
  });

  test('free plan cannot', () => {
    expect(isAbsOfflineInPlan('free', false)).toBe(false);
  });
});

describe('isAbsOfflineAllowed (fork unlock)', () => {
  test('offline Audiobookshelf downloads stay available on every plan', () => {
    expect(ABS_OFFLINE_REQUIRES_PREMIUM).toBe(false);
    expect(isAbsOfflineAllowed('free', false)).toBe(true);
    expect(isAbsOfflineAllowed('plus', false)).toBe(true);
    expect(isAbsOfflineAllowed('pro', false)).toBe(true);
    expect(isAbsOfflineAllowed('purchase', false)).toBe(true);
  });

  test('entitles a free user who bought Full Customization', () => {
    expect(isAbsOfflineAllowed('free', true)).toBe(true);
  });
});
