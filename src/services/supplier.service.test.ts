import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { ValidationError } from '../utils/errorHandler.js';
import { SupplierService, buildDuplicateSupplierCodeError } from './supplier.service.js';

const supplierService = (findFirst: (args: unknown) => Promise<unknown>) =>
  new SupplierService({ findFirst } as never);

test('duplicate supplier code error is a 400 validation error with a plain-language message', () => {
  const error = buildDuplicateSupplierCodeError('00001');
  assert.ok(error instanceof ValidationError);
  assert.equal(error.statusCode, 400);
  assert.equal(error.message, "Supplier code '00001' is already in use.");
  assert.equal(error.details, 'Please enter a different supplier code. Each supplier needs its own code.');
  assert.deepEqual(error.fields, ['suppliercode']);
});

test('rejects a supplier code owned by another supplier', async () => {
  const findFirst = mock.fn(async (_args: unknown) => ({ id: 7 }));

  await assert.rejects(
    supplierService(findFirst).assertSupplierCodeAvailable('00001', '12'),
    (error: unknown) => error instanceof ValidationError && error.message.includes("'00001' is already in use")
  );
  assert.deepEqual(findFirst.mock.calls[0].arguments[0], {
    where: { suppliercode: '00001', NOT: { id: 12 } },
    select: { id: true },
  });
});

test('allows keeping the supplier\'s own code or a free code', async () => {
  const findFirst = mock.fn(async (_args: unknown) => null);

  await supplierService(findFirst).assertSupplierCodeAvailable('00001', '12');
  assert.equal(findFirst.mock.callCount(), 1);
});

test('create checks the code against every existing supplier', async () => {
  const findFirst = mock.fn(async (_args: unknown) => ({ id: 7 }));

  await assert.rejects(supplierService(findFirst).assertSupplierCodeAvailable('00001'), ValidationError);
  assert.deepEqual(findFirst.mock.calls[0].arguments[0], {
    where: { suppliercode: '00001' },
    select: { id: true },
  });
});

test('skips the lookup when the update does not change the supplier code', async () => {
  const findFirst = mock.fn(async (_args: unknown) => ({ id: 7 }));

  await supplierService(findFirst).assertSupplierCodeAvailable(undefined, '12');
  assert.equal(findFirst.mock.callCount(), 0);
});
