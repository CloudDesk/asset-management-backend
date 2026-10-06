import { PrismaClient } from '@prisma/client';
import { STANDALONE_COUPON_DESCRIPTION_PREFIX } from '../src/utils/couponWalletPolicy.js';

const prisma = new PrismaClient();

const increment = (record: Record<string, number>, key: string) => {
  record[key] = (record[key] || 0) + 1;
};

try {
  const assignments = await prisma.promotion_assignments.findMany({
    where: {
      promotion: {
        is: {
          visibility: 'private',
          description: { startsWith: STANDALONE_COUPON_DESCRIPTION_PREFIX },
        },
      },
    },
    select: {
      id: true,
      status: true,
      delivery_channel: true,
      claimed_at: true,
      used_count: true,
      wallet_credit: { select: { id: true } },
      _count: { select: { redemptions: true } },
      promotion: {
        select: {
          applicable_channel: true,
          stackable: true,
        },
      },
    },
  });

  const byDeliveryChannel: Record<string, number> = {};
  const byAdministrativeStatus: Record<string, number> = {};
  const byUseState: Record<string, number> = {};
  let nonCompliantAssignments = 0;
  let nonCompliantPromotions = 0;

  for (const assignment of assignments) {
    increment(byDeliveryChannel, assignment.delivery_channel);
    increment(byAdministrativeStatus, assignment.status);
    const useState = assignment.claimed_at || assignment.wallet_credit
      ? 'claimed'
      : assignment.used_count > 0 || assignment._count.redemptions > 0
        ? 'redeemed'
        : 'unclaimed';
    increment(byUseState, useState);
    if (assignment.delivery_channel !== 'all') nonCompliantAssignments += 1;
    if (assignment.promotion.applicable_channel !== 'all' || assignment.promotion.stackable !== false) {
      nonCompliantPromotions += 1;
    }
  }

  console.log(JSON.stringify({
    standalone_coupon_assignments: assignments.length,
    by_delivery_channel: byDeliveryChannel,
    by_administrative_status: byAdministrativeStatus,
    by_use_state: byUseState,
    non_compliant_assignment_channels: nonCompliantAssignments,
    non_compliant_promotion_policies: nonCompliantPromotions,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
