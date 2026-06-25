import { z } from 'zod';

export const registerPushTokenSchema = z.object({
  token: z.string().min(10).max(2048),
  platform: z.enum(['android', 'ios']),
  provider: z.enum(['fcm', 'apns']).default('fcm'),
  deviceId: z.string().max(255).optional(),
  appVersion: z.string().max(100).optional(),
  buildNumber: z.string().max(100).optional(),
  permissionStatus: z.string().max(50).optional(),
});

export const unregisterPushTokenSchema = z.object({
  token: z.string().min(10).max(2048).optional().nullable(),
  deviceId: z.string().max(255).optional().nullable(),
}).refine((value) => value.token || value.deviceId, {
  message: 'Either token or deviceId is required',
});

export const sendTestPushSchema = z.object({
  title: z.string().min(1).max(120).default('Nivaana'),
  body: z.string().min(1).max(500).default('Test push notification'),
  data: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  url: z.string().max(500).optional(),
});

export const cartReminderCampaignSchema = z.object({
  minInactiveMinutes: z.number().int().min(15).max(10080).default(60).optional(),
  maxUsers: z.number().int().min(1).max(500).default(100).optional(),
  dryRun: z.boolean().default(false).optional(),
});

export const promotionBroadcastSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(500).optional(),
  url: z.string().max(500).optional(),
  userIds: z.array(z.number().int().positive()).max(2000).optional(),
  promotionId: z.number().int().positive().optional(),
  maxUsers: z.number().int().min(1).max(2000).default(500).optional(),
  data: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
}).refine((value) => value.promotionId || (value.title && value.body), {
  message: 'Either promotionId or both title and body are required',
});

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;
export type UnregisterPushTokenInput = z.infer<typeof unregisterPushTokenSchema>;
export type SendTestPushInput = z.infer<typeof sendTestPushSchema>;
export type CartReminderCampaignInput = z.infer<typeof cartReminderCampaignSchema>;
export type PromotionBroadcastInput = z.infer<typeof promotionBroadcastSchema>;
