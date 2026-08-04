import { z } from 'zod';

export const claimCouponSchema = z.object({
  code: z.string().trim().min(4).max(100),
});

export const couponWalletListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['available', 'scheduled', 'reserved', 'redeemed', 'expired', 'revoked']).optional(),
  ownership_mode: z.enum(['customer', 'customer_group', 'anyone']).optional(),
  customer_id: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(100).optional(),
});

export type CouponWalletListInput = z.infer<typeof couponWalletListSchema>;
