import { FastifyInstance } from 'fastify';
import { PushNotificationController } from '../controllers/push-notification.controller.js';

const pushNotificationController = new PushNotificationController();

export async function pushNotificationRoutes(fastify: FastifyInstance) {
  fastify.post('/register', {
    schema: {
      tags: ['Push Notifications'],
      description: 'Register or refresh the current device push token',
      body: {
        type: 'object',
        required: ['token', 'platform'],
        properties: {
          token: { type: 'string' },
          platform: { type: 'string', enum: ['android', 'ios'] },
          provider: { type: 'string', enum: ['fcm', 'apns'], default: 'fcm' },
          deviceId: { type: 'string' },
          appVersion: { type: 'string' },
          buildNumber: { type: 'string' },
          permissionStatus: { type: 'string' },
        },
      },
    },
  }, pushNotificationController.registerToken);

  fastify.post('/unregister', {
    schema: {
      tags: ['Push Notifications'],
      description: 'Disable a push token for the current authenticated user',
      body: {
        type: 'object',
        properties: {
          token: { type: 'string', nullable: true },
          deviceId: { type: 'string', nullable: true },
        },
        anyOf: [
          { required: ['token'] },
          { required: ['deviceId'] },
        ],
      },
    },
  }, pushNotificationController.unregisterToken);

  fastify.post('/test', {
    schema: {
      tags: ['Push Notifications'],
      description: 'Send a test push notification to the current user devices',
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', default: 'Nivaana' },
          body: { type: 'string', default: 'Test push notification' },
          url: { type: 'string' },
          data: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
  }, pushNotificationController.sendTest);

  fastify.post('/campaigns/cart-reminders', {
    schema: {
      tags: ['Push Notifications'],
      description: 'Run abandoned cart reminder push campaign (inventory users only)',
      body: {
        type: 'object',
        properties: {
          minInactiveMinutes: { type: 'number', default: 60 },
          maxUsers: { type: 'number', default: 100 },
          dryRun: { type: 'boolean', default: false },
        },
      },
    },
  }, pushNotificationController.sendCartReminders);

  fastify.post('/campaigns/promotions', {
    schema: {
      tags: ['Push Notifications'],
      description: 'Send deals/promotion push campaign (inventory users only)',
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          url: { type: 'string' },
          promotionId: { type: 'number' },
          userIds: {
            type: 'array',
            items: { type: 'number' },
          },
          maxUsers: { type: 'number', default: 500 },
          data: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
  }, pushNotificationController.sendPromotionBroadcast);
}
