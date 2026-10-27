import test from 'node:test';
import assert from 'node:assert/strict';

import { withActorNames } from '../src/services/amazon-production-inventory.service.ts';
import { actorKey } from '../src/utils/amazonActorNames.ts';

const attempt = (id: string, operation: string, userId: number | null, userType: string | null = null) => ({
  id, operation, status: 'SUCCEEDED', amazonQuantity: 29, nivaanaQuantity: 5, targetQuantity: 5, previewId: null,
  amazonSubmissionId: null, errorCode: null, errorMessage: null,
  requestedByUserId: userId, requestedByUserType: userType,
  startedAt: '2026-10-22T10:05:00.000Z', finishedAt: '2026-10-22T10:05:00.000Z',
});

test('each stock send gets the name of who sent it; automatic sends have none', () => {
  const names = new Map([['inventory:7', 'Harish Raja'], ['ecommerce:3', 'Ecom Admin']]);
  const history = withActorNames(
    [attempt('11', 'MANUAL', 7), attempt('12', 'MANUAL', 3, 'ecommerce'), attempt('13', 'AUTOMATIC', null), attempt('14', 'MANUAL', 99)],
    names,
  );
  assert.deepEqual(history.map((entry) => [entry.id, entry.requestedByName]), [
    ['11', 'Harish Raja'], ['12', 'Ecom Admin'], ['13', null], ['14', null],
  ]);
});

test('a user without a type is Inventory staff; no user gives no key', () => {
  assert.equal(actorKey({ requestedByUserId: 4, requestedByUserType: null }), 'inventory:4');
  assert.equal(actorKey({ requestedByUserId: null, requestedByUserType: 'inventory' }), null);
});
