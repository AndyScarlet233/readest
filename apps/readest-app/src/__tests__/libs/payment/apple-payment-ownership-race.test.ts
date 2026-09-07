import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const updateUserStorageMock = vi.hoisted(() => vi.fn());

vi.mock('@/utils/supabase', () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

vi.mock('@/libs/payment/storage', () => ({
  updateUserStorage: updateUserStorageMock,
}));

import { IAPError } from '@/libs/payment/iap/types';
import {
  createOrUpdatePayment,
  type VerifiedPurchase,
} from '@/libs/payment/iap/apple/server';

const USER_ID = 'e22f3863-a874-4e09-9524-f1c1810ec0d1';
const OTHER_USER_ID = '17f60b35-5f8a-4a19-9776-6bd14bb7791d';

const purchase: VerifiedPurchase = {
  platform: 'ios',
  status: 'active',
  customerEmail: 'reader@example.com',
  orderId: 'order-1',
  planName: 'Storage 5GB',
  planType: 'purchase',
  productId: 'com.bilingify.readest.storage.5gb.purchase',
  amount: 499,
  currency: 'USD',
  transactionId: 'tx-1',
  originalTransactionId: 'original-tx-1',
  quantity: 1,
  environment: 'production',
  bundleId: 'com.bilingify.readest',
};

const stubInsertRace = (ownerUserId: string) => {
  const updateBuilder: Record<string, unknown> = {};
  updateBuilder['eq'] = vi.fn(() => updateBuilder);
  updateBuilder['select'] = vi.fn().mockResolvedValue({ data: [], error: null });

  const ownerBuilder: Record<string, unknown> = {};
  ownerBuilder['eq'] = vi.fn(() => ownerBuilder);
  ownerBuilder['single'] = vi.fn().mockResolvedValue({
    data: { user_id: ownerUserId },
    error: null,
  });

  const table = {
    update: vi.fn(() => updateBuilder),
    insert: vi.fn().mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    }),
    select: vi.fn(() => ownerBuilder),
  };

  createSupabaseAdminClientMock.mockReturnValue({ from: vi.fn(() => table) });
};

beforeEach(() => {
  createSupabaseAdminClientMock.mockReset();
  updateUserStorageMock.mockReset().mockResolvedValue(undefined);
});

describe('createOrUpdatePayment — concurrent ownership arbitration', () => {
  it('treats a unique-conflict row owned by the same user as an idempotent race', async () => {
    stubInsertRace(USER_ID);

    await expect(createOrUpdatePayment(USER_ID, purchase)).resolves.toBeUndefined();

    expect(updateUserStorageMock).toHaveBeenCalledWith(USER_ID);
  });

  it('still rejects a unique-conflict row owned by a different user', async () => {
    stubInsertRace(OTHER_USER_ID);

    await expect(createOrUpdatePayment(USER_ID, purchase)).rejects.toThrow(
      IAPError.TRANSACTION_BELONGS_TO_ANOTHER_USER,
    );
    expect(updateUserStorageMock).not.toHaveBeenCalled();
  });
});
