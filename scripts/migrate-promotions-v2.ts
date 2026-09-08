import { PrismaClient } from '@prisma/client';
import { PromotionsV2Service } from '../src/services/promotions-v2.service.js';
import { convertLegacyPromotionRule } from '../src/utils/legacy-promotion-v2.js';

const prisma = new PrismaClient();
const service = new PromotionsV2Service();
const apply = process.argv.includes('--apply');
const confirmed = process.argv.includes('--confirm=NIVAANA_PROMOTIONS_V2');

if (apply && !confirmed) throw new Error('Apply mode requires --confirm=NIVAANA_PROMOTIONS_V2');

try {
  const promotions = await prisma.promotions.findMany({ include: { ruleVersions: { select: { id: true } } }, orderBy: { id: 'asc' } });
  const report: Array<Record<string, unknown>> = [];
  for (const promotion of promotions) {
    if (promotion.ruleVersions.length) { report.push({ promotion_id: promotion.id, status: 'skipped', reason: 'already_versioned' }); continue; }
    try {
      const rule = convertLegacyPromotionRule(promotion);
      if (apply) {
        const created = await service.saveDraft(promotion.id, rule);
        report.push({ promotion_id: promotion.id, status: 'converted_to_draft', version: created.version, checksum: created.checksum });
      } else report.push({ promotion_id: promotion.id, status: 'convertible', benefit: rule.benefit?.type, target_count: rule.qualifier.scope.include.length });
    } catch (error) {
      report.push({ promotion_id: promotion.id, status: 'unsupported', reason: error instanceof Error ? error.message : String(error) });
    }
  }
  console.table(report);
  const unsupported = report.filter((item) => item.status === 'unsupported').length;
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', total: report.length, unsupported }, null, 2));
  if (unsupported) process.exitCode = 2;
} finally {
  await prisma.$disconnect();
}
