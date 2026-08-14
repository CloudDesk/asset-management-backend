import assert from 'node:assert/strict';
import test from 'node:test';
import { hasAmazonChannelPermission } from './amazon-channel-permission.middleware.js';

test('allows an Amazon action when any accepted channel permission is present', () => {
  assert.equal(hasAmazonChannelPermission({ import: true }, ['import', 'create']), true);
  assert.equal(hasAmazonChannelPermission({ modifyall: true }, ['create', 'edit', 'modifyall']), true);
});

test('denies an Amazon action when accepted channel permissions are absent', () => {
  assert.equal(hasAmazonChannelPermission({ read: true }, ['import', 'create']), false);
  assert.equal(hasAmazonChannelPermission(undefined, ['read']), false);
});
