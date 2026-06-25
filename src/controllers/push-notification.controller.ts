import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  cartReminderCampaignSchema,
  registerPushTokenSchema,
  promotionBroadcastSchema,
  sendTestPushSchema,
  unregisterPushTokenSchema,
} from '../schemas/push-notification.schema.js';
import { CustomerNotificationService } from '../services/customer-notification.service.js';
import { PushNotificationService } from '../services/push-notification.service.js';
import { asyncHandler, createSuccessResponse } from '../utils/errorHandler.js';

export class PushNotificationController {
  private pushNotificationService = new PushNotificationService();
  private customerNotificationService = new CustomerNotificationService();

  registerToken = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({
        success: false,
        message: 'Authentication required',
        statusCode: 401,
      });
    }

    const input = registerPushTokenSchema.parse(request.body);
    const device = await this.pushNotificationService.registerDeviceToken(user, input);
    const response = createSuccessResponse('Push token registered successfully', device);
    return reply.code(200).send(response);
  });

  unregisterToken = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({
        success: false,
        message: 'Authentication required',
        statusCode: 401,
      });
    }

    const input = unregisterPushTokenSchema.parse(request.body);
    const result = await this.pushNotificationService.unregisterDeviceToken(user, input);
    const response = createSuccessResponse('Push token unregistered successfully', result);
    return reply.code(200).send(response);
  });

  sendTest = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({
        success: false,
        message: 'Authentication required',
        statusCode: 401,
      });
    }

    const input = sendTestPushSchema.parse(request.body || {});
    const result = await this.pushNotificationService.sendTestNotification(user, input);
    const response = createSuccessResponse('Test push notification processed', result);
    return reply.code(200).send(response);
  });

  sendCartReminders = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || user.userType !== 'inventory') {
      return reply.code(403).send({
        success: false,
        message: 'Inventory user authentication is required for campaign pushes',
        statusCode: 403,
      });
    }

    const input = cartReminderCampaignSchema.parse(request.body || {});
    const result = await this.customerNotificationService.sendAbandonedCartReminders(input);
    const response = createSuccessResponse('Cart reminder campaign processed', result);
    return reply.code(200).send(response);
  });

  sendPromotionBroadcast = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || user.userType !== 'inventory') {
      return reply.code(403).send({
        success: false,
        message: 'Inventory user authentication is required for campaign pushes',
        statusCode: 403,
      });
    }

    const input = promotionBroadcastSchema.parse(request.body || {});
    const result = await this.customerNotificationService.sendPromotionBroadcast(input);
    const response = createSuccessResponse('Promotion campaign processed', result);
    return reply.code(200).send(response);
  });
}
