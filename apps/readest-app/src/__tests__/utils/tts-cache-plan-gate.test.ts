import { describe, expect, test } from 'vitest';

import { TTS_CACHE_REQUIRES_PREMIUM, isTTSCacheAllowed, isTTSCacheInPlan } from '@/utils/access';

describe('isTTSCacheInPlan', () => {
  test('any paid plan can use the offline TTS audio cache', () => {
    expect(isTTSCacheInPlan('plus', false)).toBe(true);
    expect(isTTSCacheInPlan('pro', false)).toBe(true);
    // A storage-only buyer reports `purchase` without being entitled.
    expect(isTTSCacheInPlan('purchase', false)).toBe(false);
  });

  test('free plan cannot', () => {
    expect(isTTSCacheInPlan('free', false)).toBe(false);
  });
});

describe('isTTSCacheAllowed (fork unlock)', () => {
  test('offline TTS downloads stay available on every plan', () => {
    expect(TTS_CACHE_REQUIRES_PREMIUM).toBe(false);
    expect(isTTSCacheAllowed('free', false)).toBe(true);
    expect(isTTSCacheAllowed('plus', false)).toBe(true);
    expect(isTTSCacheAllowed('pro', false)).toBe(true);
    expect(isTTSCacheAllowed('purchase', false)).toBe(true);
  });
});

// Premium is now the plan OR an outright Full Customization purchase.
describe('isTTSCacheAllowed — customization unlock', () => {
  test('entitles a free user who bought Full Customization', () => {
    expect(isTTSCacheAllowed('free', true)).toBe(true);
  });

  test('entitles a grandfathered storage buyer, who carries the flag', () => {
    expect(isTTSCacheAllowed('purchase', true)).toBe(true);
  });

  test('fork unlock also allows a storage-only buyer', () => {
    expect(isTTSCacheAllowed('purchase', false)).toBe(true);
  });
});
