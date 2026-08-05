import assert from 'node:assert/strict';
import test from 'node:test';
import { WalletRedemptionService } from '../services/wallet-redemption.service.js';

test('wallet quotes allocate credits by earliest expiry and keep no-expiry credits last', async () => {
  let creditQuery: any;
  const service = new WalletRedemptionService() as any;
  service.prisma = {
    wallet_reservations: { updateMany: async () => ({ count: 0 }) },
    wallet_credits: {
      findMany: async (input: unknown) => {
        creditQuery = input;
        return [];
      },
    },
  };

  await service.quote(10, 500, 200);

  assert.deepEqual(creditQuery.orderBy, [
    { expires_at: { sort: 'asc', nulls: 'last' } },
    { id: 'asc' },
  ]);
});

test('wallet consumption rejects a checkout reservation after its 15-minute window', async () => {
  let expiryReleaseChecked = false;
  const database = {
    wallet_reservations: {
      updateMany: async () => {
        expiryReleaseChecked = true;
        return { count: 1 };
      },
      findMany: async () => [],
    },
  };
  const service = new WalletRedemptionService() as any;
  service.prisma = {
    $transaction: async (callback: (database: unknown) => unknown) => callback(database),
  };

  await assert.rejects(
    () => service.consume('NV-EXPIRED-RESERVATION', 300, 100),
    /WALLET_RESERVATION_NOT_AVAILABLE/,
  );
  assert.equal(expiryReleaseChecked, true);
});
