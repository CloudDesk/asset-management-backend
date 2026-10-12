import assert from 'node:assert/strict';
import test from 'node:test';
import { ValidationError } from '../utils/errorHandler.js';
import { createRoleSchema, updateRoleSchema } from '../schemas/role.schema.js';
import { roleErrors } from './role.service.js';

test('role rule errors are 400s with plain wording', () => {
  const cases: Array<[ValidationError, string]> = [
    [roleErrors.codeInUse('system_admin'), "Role code 'system_admin' is already in use."],
    [roleErrors.nameInUse('System Admin'), "Role name 'System Admin' is already in use."],
    [roleErrors.levelTooLow(), 'Level must be 1 or higher.'],
    [roleErrors.systemRoleLocked(), "System roles can't be turned off."],
  ];
  for (const [error, message] of cases) {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.statusCode, 400);
    assert.equal(error.message, message);
    assert.ok(error.details);
  }
});

const issueMessages = (result: { success: boolean; error?: { errors: Array<{ message: string }> } }) =>
  result.success ? [] : result.error!.errors.map((issue) => issue.message);

test('role form rules use plain wording on create', () => {
  const messages = issueMessages(createRoleSchema.safeParse({
    name: '',
    code: 'System-Admin',
    level: 0,
    description: 'x'.repeat(501),
  }));
  assert.ok(messages.includes('Role name is required.'));
  assert.ok(messages.includes('Role code can only use lowercase letters, numbers and underscores (e.g. super_admin).'));
  assert.ok(messages.includes('Level must be 1 or higher.'));
  assert.ok(messages.includes('Description must be 500 characters or fewer.'));
  assert.ok(messages.every((message) => !/alphanumeric|String must/.test(message)));
});

test('role form rules use plain wording on update', () => {
  const messages = issueMessages(updateRoleSchema.safeParse({ name: 'n'.repeat(101), code: 'c'.repeat(51) }));
  assert.ok(messages.includes('Role name must be 100 characters or fewer.'));
  assert.ok(messages.includes('Role code must be 50 characters or fewer.'));
});
