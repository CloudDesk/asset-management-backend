import assert from 'node:assert/strict';
import test from 'node:test';
import { WalletRedemptionService } from '../services/wallet-redemption.service.js';

test('cancelled orders restore consumed wallet credit to its original source', async () => {
  const reservationUpdates: unknown[] = [];
  const creditUpdates: unknown[] = [];
  const database = {
    wallet_reservations: {
      findMany: async () => [{ id: 7, wallet_credit_id: 3, amount: 50 }],
      updateMany: async (input: unknown) => {
        reservationUpdates.push(input);
        return { count: 1 };
      },
    },
    wallet_credits: {
      findUniqueOrThrow: async () => ({ id: 3, original_amount: 100, remaining_amount: 25 }),
      update: async (input: unknown) => {
        creditUpdates.push(input);
        return input;
      },
    },
  };

  const result = await new WalletRedemptionService().restoreForCancelledOrder(298, database as never);

  assert.deepEqual(result, { restored_amount: 50, restored_count: 1 });
  assert.equal(reservationUpdates.length, 1);
  assert.equal((reservationUpdates[0] as any).data.status, 'reversed');
  assert.equal(Number((creditUpdates[0] as any).data.remaining_amount), 75);
  assert.equal((creditUpdates[0] as any).data.status, 'partially_used');
});

test('repeating cancellation does not restore wallet credit twice', async () => {
  let creditUpdated = false;
  const database = {
    wallet_reservations: {
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
    },
    wallet_credits: {
      findUniqueOrThrow: async () => { throw new Error('must not be called'); },
      update: async () => { creditUpdated = true; },
    },
  };

  const result = await new WalletRedemptionService().restoreForCancelledOrder(298, database as never);

  assert.deepEqual(result, { restored_amount: 0, restored_count: 0 });
  assert.equal(creditUpdated, false);
});

test('cancellation restores value to an expired source without making it spendable', async () => {
  let creditUpdate: any;
  const database = {
    wallet_reservations: {
      findMany: async () => [{ id: 9, wallet_credit_id: 4, amount: 100 }],
      updateMany: async () => ({ count: 1 }),
    },
    wallet_credits: {
      findUniqueOrThrow: async () => ({
        id: 4,
        original_amount: 100,
        remaining_amount: 0,
        expires_at: BigInt(Math.floor(Date.now() / 1000) - 60),
      }),
      update: async (input: unknown) => {
        creditUpdate = input;
        return input;
      },
    },
  };

  const result = await new WalletRedemptionService().restoreForCancelledOrder(299, database as never);

  assert.deepEqual(result, { restored_amount: 100, restored_count: 1 });
  assert.equal(Number(creditUpdate.data.remaining_amount), 100);
  assert.equal(creditUpdate.data.status, 'expired');
});
