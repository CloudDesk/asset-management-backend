import assert from 'node:assert/strict';
import test from 'node:test';
import { CustomerEmailNotificationService } from './customer-email-notification.service.js';

const order = {
  id: 12,
  userid: 7,
  orderid: 'NV-12',
  orderamount: 499,
  mode: 'online',
  orderstatus: 'payment_completed',
  tracking_id: null,
  vendor: null,
  public_tracking_link: null,
  refund_amount: null,
  refund_reference: null,
};

test('skips all customer notifications when the customer has no email', async () => {
  let sendCount = 0;
  const emailService = {
    async sendTransactionalEmail() { sendCount += 1; },
  };
  const database = {
    orders: { async findUnique() { return order; } },
    users: {
      async findUnique() {
        return { id: 7, useremail: null, firstname: 'No', lastname: 'Email' };
      },
    },
  };
  const service = new CustomerEmailNotificationService(emailService, database as any);

  const result = await service.sendOrderEmail(12, 'order_confirmation');

  assert.deepEqual(result, { sent: false, reason: 'missing_email' });
  assert.equal(sendCount, 0);
});

test('skips customers whose email contains only whitespace', async () => {
  let sendCount = 0;
  const emailService = {
    async sendTransactionalEmail() { sendCount += 1; },
  };
  const database = {
    orders: { async findUnique() { return order; } },
    users: {
      async findUnique() {
        return { id: 7, useremail: '   ', firstname: 'No', lastname: 'Email' };
      },
    },
  };
  const service = new CustomerEmailNotificationService(emailService, database as any);

  const result = await service.sendOrderEmail(12, 'order_confirmation');

  assert.deepEqual(result, { sent: false, reason: 'missing_email' });
  assert.equal(sendCount, 0);
});

test('sends an order template to the customer email', async () => {
  let sentMessage: Record<string, string> | undefined;
  const emailService = {
    async sendTransactionalEmail(message: Record<string, string>) { sentMessage = message; },
  };
  const database = {
    orders: { async findUnique() { return order; } },
    users: {
      async findUnique() {
        return { id: 7, useremail: ' customer@example.com ', firstname: 'Nivaana', lastname: 'Customer' };
      },
    },
  };
  const service = new CustomerEmailNotificationService(emailService, database as any);

  const result = await service.sendOrderEmail(12, 'payment_confirmation');

  assert.deepEqual(result, { sent: true, email: 'customer@example.com' });
  assert.equal(sentMessage?.to, 'customer@example.com');
  assert.equal(sentMessage?.subject, 'Payment confirmed for order NV-12');
  assert.match(sentMessage?.text || '', /₹499\.00/);
});

test('reports an email delivery failure without throwing into the order flow', async () => {
  const emailService = {
    async sendTransactionalEmail() { throw new Error('SMTP unavailable'); },
  };
  const database = {
    orders: { async findUnique() { return order; } },
    users: {
      async findUnique() {
        return { id: 7, useremail: 'customer@example.com', firstname: 'Nivaana', lastname: 'Customer' };
      },
    },
  };
  const service = new CustomerEmailNotificationService(emailService, database as any);

  const result = await service.sendOrderEmail(12, 'delivery_confirmation');

  assert.deepEqual(result, { sent: false, reason: 'send_failed' });
});

test('background queue returns before SMTP delivery finishes', async () => {
  let deliveryStarted = false;
  let finishDelivery!: () => void;
  const deliveryGate = new Promise<void>((resolve) => { finishDelivery = resolve; });
  const emailService = {
    async sendTransactionalEmail() {
      deliveryStarted = true;
      await deliveryGate;
    },
  };
  const database = {
    orders: { async findUnique() { return order; } },
    users: {
      async findUnique() {
        return { id: 7, useremail: 'customer@example.com', firstname: 'Nivaana', lastname: 'Customer' };
      },
    },
  };
  const service = new CustomerEmailNotificationService(emailService, database as any);

  const result = service.queueOrderEmail(12, 'order_confirmation');

  assert.equal(result, undefined);
  assert.equal(deliveryStarted, false);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(deliveryStarted, true);
  finishDelivery();
});

test('background database and email failures cannot reject the caller', async () => {
  const emailService = {
    async sendTransactionalEmail() { throw new Error('SMTP unavailable'); },
  };
  const failingDatabase = {
    orders: { async findUnique() { throw new Error('Database unavailable'); } },
  };
  const workingDatabase = {
    orders: { async findUnique() { return order; } },
    users: {
      async findUnique() {
        return { id: 7, useremail: 'customer@example.com', firstname: 'Nivaana', lastname: 'Customer' };
      },
    },
  };
  const databaseFailureService = new CustomerEmailNotificationService(emailService, failingDatabase as any);
  const smtpFailureService = new CustomerEmailNotificationService(emailService, workingDatabase as any);

  assert.doesNotThrow(() => databaseFailureService.queueOrderEmail(12, 'order_confirmation'));
  assert.doesNotThrow(() => smtpFailureService.queueOrderEmail(12, 'order_confirmation'));
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
});
