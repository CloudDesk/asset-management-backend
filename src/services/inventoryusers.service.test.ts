import assert from 'node:assert/strict';
import test from 'node:test';

import { prisma } from '../models/prisma.js';
import { PasswordResetEmailError } from './email.service.js';
import { InventoryUsersService } from './inventoryusers.service.js';

test('inventory user creation is kept and reports when the welcome email fails', async () => {
  const service = new InventoryUsersService();
  const inventoryUsers = (prisma as any).inventoryusers;
  const originalCreate = inventoryUsers.create;

  (service as any).findByEmail = async () => null;
  (service as any).sendPasswordSetLink = async () => {
    throw new PasswordResetEmailError();
  };
  inventoryUsers.create = async () => ({
    id: 91,
    useremail: 'new-user@example.com',
    firstname: 'New',
    roleid: null,
  });

  try {
    const createdUser = await service.create({ useremail: 'new-user@example.com' });
    assert.equal(createdUser.id, 91);
    assert.equal(createdUser.welcomeEmailSent, false);
  } finally {
    inventoryUsers.create = originalCreate;
  }
});
