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

test('wallet quote is capped at the remaining post-promotion payable amount', async () => {
  const service = new WalletRedemptionService() as any;
  service.prisma = {
    wallet_reservations: { updateMany: async () => ({ count: 0 }) },
    wallet_credits: {
      findMany: async () => [{
        remaining_amount: 500,
        reservations: [],
      }],
    },
  };

  const result = await service.quote(10, 80, 150);

  assert.deepEqual(result, { eligible_balance: 500, discount_amount: 150 });
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

test('wallet reservation never exceeds the post-promotion payable amount', async () => {
  const createdAmounts: number[] = [];
  const database = {
    wallet_reservations: {
      updateMany: async () => ({ count: 0 }),
      findMany: async () => [],
      create: async ({ data }: any) => {
        createdAmounts.push(Number(data.amount));
        return data;
      },
    },
    wallet_credits: {
      findMany: async () => [{
        id: 1,
        remaining_amount: 500,
        reservations: [],
      }],
    },
  };
  const service = new WalletRedemptionService() as any;
  service.prisma = {
    $transaction: async (callback: (database: unknown) => unknown) => callback(database),
  };

  const result = await service.reserve(10, 'NV-WALLET-CAP', 80, 150);

  assert.equal(result.discount_amount, 150);
  assert.deepEqual(createdAmounts, [150]);
});

test('wallet reservation splits across credits but stops at the payable amount', async () => {
  const createdAmounts: number[] = [];
  const database = {
    wallet_reservations: {
      updateMany: async () => ({ count: 0 }),
      findMany: async () => [],
      create: async ({ data }: any) => {
        createdAmounts.push(Number(data.amount));
        return data;
      },
    },
    wallet_credits: {
      findMany: async () => [
        { id: 1, remaining_amount: 40, reservations: [] },
        { id: 2, remaining_amount: 80, reservations: [] },
      ],
    },
  };
  const service = new WalletRedemptionService() as any;
  service.prisma = {
    $transaction: async (callback: (database: unknown) => unknown) => callback(database),
  };

  const result = await service.reserve(10, 'NV-WALLET-SPLIT', 100, 75);

  assert.equal(result.discount_amount, 75);
  assert.deepEqual(createdAmounts, [40, 35]);
});

test('wallet rejects zero or negative payable reservations', async () => {
  const service = new WalletRedemptionService();

  await assert.rejects(
    () => service.reserve(10, 'NV-ZERO-PAYABLE', 100, 0),
    /INVALID_WALLET_PAYABLE_AMOUNT/,
  );
});

test('wallet quote rejects invalid monetary inputs', async () => {
  const service = new WalletRedemptionService();

  await assert.rejects(
    () => service.quote(10, -1, 100),
    /INVALID_WALLET_QUOTE_AMOUNTS/,
  );
  await assert.rejects(
    () => service.quote(10, 100, Number.NaN),
    /INVALID_WALLET_QUOTE_AMOUNTS/,
  );
});

test('wallet consumption rejects a reservation amount changed after checkout', async () => {
  const database = {
    wallet_reservations: {
      updateMany: async () => ({ count: 0 }),
      findMany: async ({ where }: any) =>
        where.status === 'reserved' ? [{ amount: 40 }] : [],
    },
  };
  const service = new WalletRedemptionService() as any;
  service.prisma = {
    $transaction: async (callback: (database: unknown) => unknown) => callback(database),
  };

  await assert.rejects(
    () => service.consume('NV-WALLET-CHANGED', 300, 50),
    /WALLET_RESERVATION_CHANGED/,
  );
});

test('wallet consumption rejects a balance that changed below the reservation', async () => {
  const database = {
    wallet_reservations: {
      updateMany: async () => ({ count: 0 }),
      findMany: async ({ where }: any) =>
        where.status === 'reserved' ? [{ wallet_credit_id: 1, amount: 50 }] : [],
    },
    wallet_credits: {
      findUniqueOrThrow: async () => ({ id: 1, remaining_amount: 40 }),
    },
  };
  const service = new WalletRedemptionService() as any;
  service.prisma = {
    $transaction: async (callback: (database: unknown) => unknown) => callback(database),
  };

  await assert.rejects(
    () => service.consume('NV-WALLET-BALANCE-CHANGED', 300, 50),
    /WALLET_BALANCE_CHANGED/,
  );
});
