import assert from 'node:assert/strict';
import test from 'node:test';

import { EmailService, PasswordResetEmailError } from './email.service.js';

type MutableEmailService = {
  transporter: {
    sendMail: () => Promise<{
      messageId?: string;
      accepted?: string[];
      rejected?: string[];
    }>;
  };
};

function mockTransport(
  service: EmailService,
  sendMail: MutableEmailService['transporter']['sendMail']
): void {
  (service as unknown as MutableEmailService).transporter = { sendMail };
}

test('password reset email succeeds only when the recipient is accepted', async () => {
  const service = new EmailService();
  mockTransport(service, async () => ({
    messageId: 'message-1',
    accepted: ['admin@example.com'],
    rejected: [],
  }));

  await service.sendPasswordResetEmail('admin@example.com', 'reset-token', 'Admin');
});

test('password reset email reports a service failure when no recipient is accepted', async () => {
  const service = new EmailService();
  mockTransport(service, async () => ({
    messageId: 'message-2',
    accepted: [],
    rejected: ['admin@example.com'],
  }));

  await assert.rejects(
    service.sendPasswordResetEmail('admin@example.com', 'reset-token', 'Admin'),
    (error: unknown) =>
      error instanceof PasswordResetEmailError && error.statusCode === 503
  );
});

test('password reset email converts SMTP errors into a user-safe service error', async () => {
  const service = new EmailService();
  mockTransport(service, async () => {
    throw new Error('SMTP authentication failed');
  });

  await assert.rejects(
    service.sendPasswordResetEmail('admin@example.com', 'reset-token', 'Admin'),
    (error: unknown) =>
      error instanceof PasswordResetEmailError &&
      error.message ===
        'Unable to send the password reset email. Please contact the administrator.'
  );
});
