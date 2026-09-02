import { describe, expect, it } from 'vitest';

import { resolveLibraryUpdatedAt } from '@/services/libraryService';

describe('resolveLibraryUpdatedAt', () => {
  it('keeps an existing updatedAt unchanged', () => {
    expect(
      resolveLibraryUpdatedAt({
        updatedAt: 300,
        lastUpdated: 200,
        createdAt: 100,
      }),
    ).toBe(300);
  });

  it('uses stable legacy timestamps instead of load time', () => {
    expect(
      resolveLibraryUpdatedAt({
        updatedAt: undefined,
        lastUpdated: 200,
        createdAt: 100,
      }),
    ).toBe(200);
    expect(
      resolveLibraryUpdatedAt({
        updatedAt: undefined,
        lastUpdated: undefined,
        createdAt: 100,
      }),
    ).toBe(100);
  });

  it('uses a deterministic floor when no historical timestamp exists', () => {
    expect(
      resolveLibraryUpdatedAt({
        updatedAt: undefined,
        lastUpdated: undefined,
        createdAt: undefined as unknown as number,
      }),
    ).toBe(0);
  });
});
