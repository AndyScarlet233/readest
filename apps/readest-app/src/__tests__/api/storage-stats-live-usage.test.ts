import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const validateUserAndTokenMock = vi.fn();
const getStoragePlanDataMock = vi.fn();
const createSupabaseAdminClientMock = vi.fn();

vi.mock('@/utils/cors', () => ({
  corsAllMethods: {},
  runMiddleware: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils/access', () => ({
  validateUserAndToken: (...args: unknown[]) => validateUserAndTokenMock(...args),
  getStoragePlanData: (...args: unknown[]) => getStoragePlanDataMock(...args),
}));

vi.mock('@/utils/supabase', () => ({
  createSupabaseAdminClient: (...args: unknown[]) => createSupabaseAdminClientMock(...args),
}));

import handler from '@/pages/api/storage/stats';

const makeReqRes = () => {
  const req = {
    method: 'GET',
    headers: { authorization: 'Bearer tok' },
  } as unknown as NextApiRequest;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as NextApiResponse;
  return { req, res };
};

beforeEach(() => {
  validateUserAndTokenMock.mockReset().mockResolvedValue({ user: { id: 'user-1' }, token: 'tok' });
  // Deliberately stale: stats must report the live files-table sum instead.
  getStoragePlanDataMock.mockReset().mockReturnValue({ usage: 25, quota: 1000 });

  const range = vi.fn().mockResolvedValue({
    data: [{ file_size: 120 }, { file_size: 80 }],
    error: null,
  });
  const filesBuilder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'is']) filesBuilder[method] = () => filesBuilder;
  filesBuilder['range'] = range;

  createSupabaseAdminClientMock.mockReset().mockReturnValue({
    from: () => filesBuilder,
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  });
});

describe('GET /api/storage/stats — live usage', () => {
  it('reports the live files-table sum instead of the stale token usage claim', async () => {
    const { req, res } = makeReqRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = (res.json as unknown as { mock: { calls: [[{ usage: number; totalSize: number }]] } })
      .mock.calls[0]![0];
    expect(payload.totalSize).toBe(200);
    expect(payload.usage).toBe(200);
  });
});
