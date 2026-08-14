import { env } from '../config/env.js';
import { prisma } from '../models/prisma.js';
import { AmazonListingScope } from './amazon-listing-scope.service.js';

type Actor = { requestedByUserId?: number; requestedByUserType?: string };
type DestinationKind = 'SQS' | 'EVENTBRIDGE';

export const AMAZON_NOTIFICATION_DEFINITIONS = [
  { notificationType: 'ORDER_CHANGE', payloadVersion: '1.0', destinationKind: 'SQS' as DestinationKind },
  { notificationType: 'FBA_INVENTORY_AVAILABILITY_CHANGES', payloadVersion: '1.0', destinationKind: 'SQS' as DestinationKind },
  { notificationType: 'LISTINGS_ITEM_STATUS_CHANGE', payloadVersion: '1.0', destinationKind: 'EVENTBRIDGE' as DestinationKind },
  { notificationType: 'LISTINGS_ITEM_ISSUES_CHANGE', payloadVersion: '2023-12-13', destinationKind: 'EVENTBRIDGE' as DestinationKind },
  { notificationType: 'LISTINGS_ITEM_MFN_QUANTITY_CHANGE', payloadVersion: '1.0', destinationKind: 'EVENTBRIDGE' as DestinationKind },
] as const;

export class AmazonNotificationSubscriptionError extends Error {
  constructor(message: string, readonly statusCode = 400, readonly code = 'AMAZON_NOTIFICATION_SETUP_FAILED') {
    super(message);
    this.name = 'AmazonNotificationSubscriptionError';
  }
}

export class AmazonNotificationSubscriptionService {
  private destination(kind: DestinationKind) {
    return kind === 'SQS'
      ? env.AMAZON_NOTIFICATION_SQS_DESTINATION_ID || env.AMAZON_NOTIFICATION_DESTINATION_ID || null
      : env.AMAZON_NOTIFICATION_EVENTBRIDGE_DESTINATION_ID || env.AMAZON_NOTIFICATION_DESTINATION_ID || null;
  }

  private actorData(actor: Actor) {
    return {
      ...(actor.requestedByUserId !== undefined ? { configuredByUserId: actor.requestedByUserId } : {}),
      ...(actor.requestedByUserType !== undefined ? { configuredByUserType: actor.requestedByUserType } : {}),
    };
  }

  async status(scope: AmazonListingScope) {
    const rows = await prisma.amazonNotificationSubscription.findMany({
      where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId },
    });
    return AMAZON_NOTIFICATION_DEFINITIONS.map((definition) => {
      const row = rows.find((item) => item.notificationType === definition.notificationType && item.payloadVersion === definition.payloadVersion);
      return {
        ...definition,
        destinationConfigured: Boolean(this.destination(definition.destinationKind)),
        status: row?.status ?? 'NOT_CONFIGURED',
        subscriptionId: row?.amazonSubscriptionId ?? null,
        lastError: row?.lastError ?? null,
        lastCheckedAt: row?.lastCheckedAt?.toISOString() ?? null,
        configuredAt: row?.configuredAt?.toISOString() ?? null,
      };
    });
  }

  async configure(scope: AmazonListingScope, actor: Actor) {
    if (!scope.client.getNotificationSubscription || !scope.client.createNotificationSubscription) {
      throw new AmazonNotificationSubscriptionError('Amazon Notifications API client is unavailable', 503, 'AMAZON_NOTIFICATIONS_CLIENT_UNAVAILABLE');
    }
    const results = [];
    for (const definition of AMAZON_NOTIFICATION_DEFINITIONS) {
      const destinationId = this.destination(definition.destinationKind);
      if (!destinationId) {
        await this.save(scope, definition, null, 'NOT_CONFIGURED', `Configure the ${definition.destinationKind} destination ID`, actor);
        results.push({ ...definition, success: false, status: 'NOT_CONFIGURED', message: `Configure the ${definition.destinationKind} destination ID` });
        continue;
      }
      try {
        const existing = await scope.client.getNotificationSubscription(definition.notificationType, definition.payloadVersion);
        const subscription = existing ?? await scope.client.createNotificationSubscription(definition.notificationType, definition.payloadVersion, destinationId);
        await this.save(scope, definition, subscription.subscriptionId, 'ACTIVE', null, actor, destinationId);
        results.push({ ...definition, success: true, status: 'ACTIVE', subscriptionId: subscription.subscriptionId, existing: Boolean(existing) });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Amazon notification subscription failed';
        await this.save(scope, definition, null, 'FAILED', message, actor, destinationId);
        results.push({ ...definition, success: false, status: 'FAILED', message });
      }
    }
    await prisma.amazonOperationsAudit.create({ data: {
      sellerId: scope.sellerId,
      marketplaceId: scope.marketplaceId,
      action: 'NOTIFICATION_SUBSCRIPTIONS_CONFIGURED',
      outcome: results.every((item) => item.success) ? 'SUCCESS' : results.some((item) => item.success) ? 'PARTIAL' : 'FAILED',
      details: { results },
      ...(actor.requestedByUserId !== undefined ? { requestedByUserId: actor.requestedByUserId } : {}),
      ...(actor.requestedByUserType !== undefined ? { requestedByUserType: actor.requestedByUserType } : {}),
    } });
    return { total: results.length, active: results.filter((item) => item.success).length, failed: results.filter((item) => !item.success).length, results };
  }

  async refresh(scope: AmazonListingScope, actor: Actor) {
    if (!scope.client.getNotificationSubscription) {
      throw new AmazonNotificationSubscriptionError('Amazon Notifications API client is unavailable', 503, 'AMAZON_NOTIFICATIONS_CLIENT_UNAVAILABLE');
    }
    const results = [];
    for (const definition of AMAZON_NOTIFICATION_DEFINITIONS) {
      const destinationId = this.destination(definition.destinationKind);
      if (!destinationId) {
        await this.save(scope, definition, null, 'NOT_CONFIGURED', `Configure the ${definition.destinationKind} destination ID`, actor);
        results.push({ ...definition, status: 'NOT_CONFIGURED' });
        continue;
      }
      try {
        const subscription = await scope.client.getNotificationSubscription(definition.notificationType, definition.payloadVersion);
        await this.save(scope, definition, subscription?.subscriptionId ?? null, subscription ? 'ACTIVE' : 'MISSING', null, actor, destinationId);
        results.push({ ...definition, status: subscription ? 'ACTIVE' : 'MISSING', subscriptionId: subscription?.subscriptionId ?? null });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to check Amazon notification subscription';
        await this.save(scope, definition, null, 'FAILED', message, actor, destinationId);
        results.push({ ...definition, status: 'FAILED', message });
      }
    }
    return results;
  }

  private async save(
    scope: AmazonListingScope,
    definition: typeof AMAZON_NOTIFICATION_DEFINITIONS[number],
    subscriptionId: string | null,
    status: string,
    lastError: string | null,
    actor: Actor,
    destinationId: string | null = null
  ) {
    const data = {
      destinationKind: definition.destinationKind,
      destinationId,
      amazonSubscriptionId: subscriptionId,
      status,
      lastError,
      lastCheckedAt: new Date(),
      ...(status === 'ACTIVE' ? { configuredAt: new Date() } : {}),
      ...this.actorData(actor),
    };
    await prisma.amazonNotificationSubscription.upsert({
      where: { sellerId_marketplaceId_notificationType_payloadVersion: {
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        notificationType: definition.notificationType,
        payloadVersion: definition.payloadVersion,
      } },
      create: {
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        notificationType: definition.notificationType,
        payloadVersion: definition.payloadVersion,
        ...data,
      },
      update: data,
    });
  }
}

export const amazonNotificationSubscriptionService = new AmazonNotificationSubscriptionService();
