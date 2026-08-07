import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCancellationRefundBreakdown,
  calculateReturnRefundBreakdown,
  isRefundWalletSourceExpired,
} from '../src/utils/refund-allocation.js';

test('preserves valid wallet value and excludes expired promotional value', () => {
  const now = 2_000;
  const result = calculateCancellationRefundBreakdown(700, [
    { amount: 100, expiresAt: 1_999 },
    { amount: 150, expiresAt: 2_001 },
    { amount: 50, expiresAt: null },
  ], now);

  assert.deepEqual(result, {
    approvedAmount: 1000,
    originalWalletAmount: 300,
    eligibleWalletAmount: 200,
    expiredWalletAmount: 100,
    onlineAmount: 700,
    customerReceivesAmount: 900,
  });
});

test('credit remains valid at its exact expiry second', () => {
  assert.equal(isRefundWalletSourceExpired(2_000, 2_000), false);
  assert.equal(isRefundWalletSourceExpired(1_999, 2_000), true);
  assert.equal(isRefundWalletSourceExpired(null, 2_000), false);
});

test('allocates a partial return proportionally across PhonePe and wallet sources', () => {
  const result = calculateReturnRefundBreakdown(250, 700, [
    { reservationId: 1, amount: 200, expiresAt: 2_100 },
    { reservationId: 2, amount: 100, expiresAt: 1_900 },
  ], 2_000);

  assert.equal(result.approvedAmount, 250);
  assert.equal(result.onlineAmount, 175);
  assert.equal(result.originalWalletAmount, 75);
  assert.equal(result.eligibleWalletAmount, 50);
  assert.equal(result.expiredWalletAmount, 25);
  assert.equal(result.customerReceivesAmount, 225);
  assert.deepEqual(result.walletAllocations.map((source) => source.allocatedAmount), [50, 25]);
});

test('caps a return allocation to the payment sources that remain available', () => {
  const result = calculateReturnRefundBreakdown(200, 40, [
    { reservationId: 1, amount: 100, availableAmount: 60, expiresAt: null },
  ], 2_000);

  assert.equal(result.approvedAmount, 100);
  assert.equal(result.onlineAmount, 40);
  assert.equal(result.originalWalletAmount, 60);
  assert.equal(result.customerReceivesAmount, 100);
});
