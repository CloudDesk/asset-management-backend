/**
 * One-time clean-up (PLAN-2026-10-12-107 follow-up). Free Shipping and the two
 * cart types ("Percent of entire cart value", "Fixed amount of entire cart
 * value") are priced from the promotion's own fields. Some of them still hold
 * a draft / published V2 rule from an earlier type (e.g. promotion 75 kept an
 * old category rule), which then prices the promotion and makes the admin edit
 * screen show the old type. Saving the promotion in admin now retires that
 * rule; this script does the same for every such promotion at once.
 *
 * Dry run (default) lists what would change:
 *   npx tsx scripts/retire-stale-cart-rule-versions.ts
 * Apply:
 *   RETIRE_STALE_RULES_APPLY=true npx tsx scripts/retire-stale-cart-rule-versions.ts
 */
import { PrismaClient } from '@prisma/client';
import { retireRuleVersionsForTypeDecidedPromotion } from '../src/utils/legacy-promotion-v2.js';

const prisma = new PrismaClient();
const apply = process.env.RETIRE_STALE_RULES_APPLY === 'true';

try {
  const promotions = await prisma.promotions.findMany({
    where: {
      type: { in: ['FREE_SHIPPING', 'FIXED_AMOUNT_OFF_CART', 'PERCENT_OFF_CART'], mode: 'insensitive' },
      ruleVersions: { some: { status: { in: ['draft', 'published'] } } },
    },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      ruleVersions: {
        where: { status: { in: ['draft', 'published'] } },
        select: { version: true, status: true, ruleJson: true },
        orderBy: { version: 'desc' },
      },
    },
    orderBy: { id: 'asc' },
  });

  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${promotions.length} promotion(s) with a leftover V2 rule`);
  for (const promotion of promotions) {
    const scopes = promotion.ruleVersions.map((version) => {
      const include = (version.ruleJson as { qualifier?: { scope?: { include?: Array<{ facet?: string; values?: string[] }> } } })
        ?.qualifier?.scope?.include ?? [];
      return `v${version.version} ${version.status} [${include.map((group) => `${group.facet}:${(group.values ?? []).join('|')}`).join(', ')}]`;
    });
    console.log(`- #${promotion.id} ${promotion.name ?? ''} (${promotion.type}, ${promotion.status}): ${scopes.join('; ')}`);
    if (apply) {
      const retired = await retireRuleVersionsForTypeDecidedPromotion(prisma, promotion.id, promotion.type);
      console.log(`  retired ${retired} version(s)`);
    }
  }
  if (!apply && promotions.length) console.log('Set RETIRE_STALE_RULES_APPLY=true to retire them.');
} finally {
  await prisma.$disconnect();
}
