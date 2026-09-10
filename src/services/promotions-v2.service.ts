import { createHash, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PromotionEligibilityRequestSchema, PromotionQuoteRequestSchema, PromotionRuleV2Schema, type PromotionQuoteRequest, type PromotionRuleV2 } from '../schemas/promotions-v2.schema.js';
import { PromotionQuoteRequestCurrentSchema, PromotionRuleV3Schema, PromotionV3MultiSimulationRequestSchema, PromotionV3SimulationRequestSchema, type PromotionRuleV3 } from '../schemas/promotions-v3.schema.js';
import { evaluatePromotionQuote, isLineInPromotionScope, type PromotionCampaign, type PromotionCatalogProduct, type PromotionCartLine, type PromotionQuote } from './promotion-v2-engine.js';
import { evaluateV3ItemPromotions } from './promotion-v3-engine.js';
import { convertLegacyPromotionRule } from '../utils/legacy-promotion-v2.js';
import { isPromotionChannelEligible } from '../utils/promotionChannel.js';
import { logger } from '../config/logger.js';
import { promotionQuotesMatchForCheckout } from '../utils/promotionCheckoutValidation.js';

const prisma = new PrismaClient();

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(',')}}`;
  return JSON.stringify(value);
}

const seconds = (): bigint => BigInt(Math.floor(Date.now() / 1000));
const asJson = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const immutableRuleCache = new Map<string, PromotionRuleV2>();

function parseCachedRule(checksum: string, value: Prisma.JsonValue): PromotionRuleV2 {
  const cached = immutableRuleCache.get(checksum);
  if (cached) return cached;
  const parsed = PromotionRuleV2Schema.parse(value);
  if (immutableRuleCache.size >= 1_000) immutableRuleCache.delete(immutableRuleCache.keys().next().value!);
  immutableRuleCache.set(checksum, parsed);
  return parsed;
}

export class PromotionsV2Service {
  async getLatestRule(promotionId: number): Promise<{ version: number; status: string; rule: PromotionRuleV2 } | null> {
    const version = await prisma.promotionRuleVersion.findFirst({
      where: { promotionId, schemaVersion: 2 },
      orderBy: { version: 'desc' },
    });
    if (!version) return null;
    return {
      version: version.version,
      status: version.status,
      rule: PromotionRuleV2Schema.parse(version.ruleJson),
    };
  }

  async getLatestCurrentRule(promotionId: number): Promise<{ version: number; status: string; rule: PromotionRuleV3 } | null> {
    const version = await prisma.promotionRuleVersion.findFirst({
      where: { promotionId, schemaVersion: 3 },
      orderBy: { version: 'desc' },
    });
    if (!version) return null;
    return {
      version: version.version,
      status: version.status,
      rule: PromotionRuleV3Schema.parse(version.ruleJson),
    };
  }

  async saveDraft(promotionId: number, input: unknown): Promise<{ id: string; version: number; checksum: string; rule: PromotionRuleV2 }> {
    const rule = PromotionRuleV2Schema.parse(input);
    const checksum = createHash('sha256').update(stableJson(rule)).digest('hex');
    const latest = await prisma.promotionRuleVersion.findFirst({ where: { promotionId }, orderBy: { version: 'desc' }, select: { version: true } });
    const version = (latest?.version ?? 0) + 1;
    const created = await prisma.$transaction(async (tx) => {
      await tx.promotionRuleVersion.updateMany({
        where: { promotionId, schemaVersion: 2, status: 'draft' },
        data: { status: 'retired', modifiedAt: seconds() },
      });
      const row = await tx.promotionRuleVersion.create({
        data: { promotionId, version, schemaVersion: 2, ruleJson: asJson(rule), status: 'draft', checksum, createdAt: seconds(), modifiedAt: seconds() },
      });
      const targets = [
        ...rule.qualifier.scope.include.flatMap((group) => group.values.map((facetValue) => ({ promotionRuleVersionId: row.id, facetType: group.facet, facetValue: facetValue.trim().toLocaleLowerCase('en-IN'), inclusion: 'include', createdAt: seconds() }))),
        ...rule.qualifier.scope.exclude.flatMap((group) => group.values.map((facetValue) => ({ promotionRuleVersionId: row.id, facetType: group.facet, facetValue: facetValue.trim().toLocaleLowerCase('en-IN'), inclusion: 'exclude', createdAt: seconds() }))),
      ];
      if (targets.length) await tx.promotionTarget.createMany({ data: targets, skipDuplicates: true });
      return row;
    });
    return { id: created.id.toString(), version, checksum, rule };
  }

  async saveCurrentDraft(promotionId: number, input: unknown): Promise<{ id: string; version: number; checksum: string; rule: PromotionRuleV3 }> {
    const rule = PromotionRuleV3Schema.parse(input);
    const checksum = createHash('sha256').update(stableJson(rule)).digest('hex');
    const latest = await prisma.promotionRuleVersion.findFirst({
      where: { promotionId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    const created = await prisma.$transaction(async (tx) => {
      await tx.promotionRuleVersion.updateMany({
        where: { promotionId, schemaVersion: 3, status: 'draft' },
        data: { status: 'retired', modifiedAt: seconds() },
      });
      const row = await tx.promotionRuleVersion.create({
        data: {
          promotionId,
          version,
          schemaVersion: 3,
          ruleJson: asJson(rule),
          status: 'draft',
          checksum,
          createdAt: seconds(),
          modifiedAt: seconds(),
        },
      });
      const targets = [
        ...rule.qualifier.scope.include.flatMap((group) => group.values.map((facetValue) => ({
          promotionRuleVersionId: row.id,
          facetType: group.facet,
          facetValue: facetValue.trim().toLocaleLowerCase('en-IN'),
          inclusion: 'include',
          createdAt: seconds(),
        }))),
        ...rule.qualifier.scope.exclude.flatMap((group) => group.values.map((facetValue) => ({
          promotionRuleVersionId: row.id,
          facetType: group.facet,
          facetValue: facetValue.trim().toLocaleLowerCase('en-IN'),
          inclusion: 'exclude',
          createdAt: seconds(),
        }))),
      ];
      if (targets.length) await tx.promotionTarget.createMany({ data: targets, skipDuplicates: true });
      return row;
    });
    return { id: created.id.toString(), version, checksum, rule };
  }

  async publishCurrent(promotionId: number, expectedChecksum: string, publishedBy: number): Promise<{
    promotion_id: number;
    rule_version_id: string;
    version: number;
    checksum: string;
    matched_products: number;
    published_at: number;
    rule_snapshot: PromotionRuleV3;
  }> {
    const draft = await prisma.promotionRuleVersion.findFirst({
      where: { promotionId, schemaVersion: 3, status: 'draft' },
      orderBy: { version: 'desc' },
      include: { promotion: true },
    });
    if (!draft) throw Object.assign(new Error('No draft rule exists for this promotion'), { statusCode: 404 });
    if (draft.checksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
      throw Object.assign(new Error('Promotion draft changed; reload it before publishing'), { statusCode: 409, code: 'PROMOTION_DRAFT_CHANGED' });
    }
    const rule = PromotionRuleV3Schema.parse(draft.ruleJson);
    const matchedProducts = await this.countCurrentMatchedProducts(rule);
    if (!matchedProducts) throw Object.assign(new Error('Promotion cannot be published because it matches no active products'), { statusCode: 422 });
    if (draft.promotion.start_date && draft.promotion.end_date && draft.promotion.start_date >= draft.promotion.end_date) {
      throw Object.assign(new Error('Promotion end date must be after its start date'), { statusCode: 422 });
    }
    if (draft.promotion.budget !== null && Number(draft.promotion.budget) < 0) {
      throw Object.assign(new Error('Promotion budget cannot be negative'), { statusCode: 422 });
    }
    await this.validateCurrentGiftAvailability(rule, draft.promotion.applicable_channel);
    const publishedAt = seconds();
    await prisma.$transaction(async (tx) => {
      const guarded = await tx.promotionRuleVersion.updateMany({
        where: { id: draft.id, status: 'draft', checksum: draft.checksum },
        data: { status: 'published', publishedAt, publishedBy, modifiedAt: publishedAt },
      });
      if (guarded.count !== 1) {
        throw Object.assign(new Error('Promotion draft changed while publishing; reload and try again'), { statusCode: 409, code: 'PROMOTION_DRAFT_CHANGED' });
      }
      await tx.promotionRuleVersion.updateMany({
        where: { promotionId, schemaVersion: 3, status: 'published', id: { not: draft.id } },
        data: { status: 'retired', modifiedAt: publishedAt },
      });
      await tx.promotionRuleVersion.updateMany({
        where: { promotionId, schemaVersion: 3, status: 'draft', id: { not: draft.id } },
        data: { status: 'retired', modifiedAt: publishedAt },
      });
    });
    return {
      promotion_id: promotionId,
      rule_version_id: draft.id.toString(),
      version: draft.version,
      checksum: draft.checksum,
      matched_products: matchedProducts,
      published_at: Number(publishedAt),
      rule_snapshot: rule,
    };
  }

  private async countCurrentMatchedProducts(rule: PromotionRuleV3): Promise<number> {
    const products = await prisma.product.findMany({
      where: { productstatus: { notIn: ['inactive', 'deleted'] } },
      select: { id: true, category: true, subcategory: true },
    });
    const normalise = (value: string): string => value.trim().toLocaleLowerCase('en-IN');
    const matches = (product: typeof products[number], group: PromotionRuleV3['qualifier']['scope']['include'][number]): boolean => {
      if (group.facet === 'ENTIRE_CART') return group.values.includes('*');
      const actual = group.facet === 'PRODUCT' ? [product.id.toString()]
        : group.facet === 'CATEGORY' ? [product.category ?? ''] : [product.subcategory ?? ''];
      const expected = new Set(group.values.map(normalise));
      return actual.some((value) => value && expected.has(normalise(value)));
    };
    return products.filter((product) => {
      const scope = rule.qualifier.scope;
      const included = scope.include.length === 0 || (scope.group_operator === 'AND'
        ? scope.include.every((group) => matches(product, group))
        : scope.include.some((group) => matches(product, group)));
      return included && !scope.exclude.some((group) => matches(product, group));
    }).length;
  }

  private async validateCurrentGiftAvailability(rule: PromotionRuleV3, applicableChannel: string): Promise<void> {
    if (!rule.reward || rule.reward.mode !== 'SPECIFIC_PRODUCT') return;
    const platform = ['all', 'web', 'mobile', 'nivapp'].includes(applicableChannel.toLowerCase()) ? 'nivapp' : applicableChannel.toLowerCase();
    const rows = await prisma.platformStock.findMany({
      where: { productid: { in: rule.reward.product_ids.map(BigInt) }, platform, availableqty: { gt: 0 }, platformstatus: { not: 'inactive' } },
      select: { productid: true },
    });
    const available = new Set(rows.map((row) => row.productid.toString()));
    const missing = rule.reward.product_ids.filter((id) => !available.has(id));
    if (missing.length) throw Object.assign(new Error(`Gift products unavailable for this channel: ${missing.join(', ')}`), { statusCode: 422 });
  }

  private async hydrateCurrentRewardCatalog(rules: PromotionRuleV3[], channel: PromotionQuoteRequest['channel']) {
    const ids = [...new Set(rules.flatMap((rule) => rule.reward?.mode === 'SPECIFIC_PRODUCT' ? rule.reward.product_ids : []))];
    if (!ids.length) return [];
    const products = await prisma.product.findMany({ where: { id: { in: ids.map(BigInt) }, productstatus: { notIn: ['inactive', 'deleted'] } }, include: { platformStocks: true } });
    const platform = ['web', 'mobile', 'nivapp'].includes(channel) ? 'nivapp' : channel;
    return products.map((product) => {
      const stock = product.platformStocks.find((item) => item.platform.toLowerCase() === platform)?.availableqty ?? 0;
      const price = Math.max(0, Number(product.price ?? 0) - Math.max(0, Number(product.discount ?? 0)));
      return {
        product_id: product.id.toString(), quantity: 0, unit_price_paise: Math.round(price * 100), available_quantity: stock,
        facets: { CATEGORY: product.category ? [product.category] : [], SUBCATEGORY: product.subcategory ? [product.subcategory] : [] },
      };
    });
  }

  async migrateLegacy(promotionId: number): Promise<{ id: string; version: number; checksum: string; rule: PromotionRuleV2 }> {
    const promotion = await prisma.promotions.findUniqueOrThrow({ where: { id: promotionId } });
    return this.saveDraft(promotionId, convertLegacyPromotionRule(promotion));
  }

  async publish(promotionId: number, publishedBy?: number): Promise<{ promotion_id: number; version: number; matched_products: number }> {
    const draft = await prisma.promotionRuleVersion.findFirst({ where: { promotionId, schemaVersion: 2, status: 'draft' }, orderBy: { version: 'desc' }, include: { promotion: true } });
    if (!draft) throw new Error('No draft rule version exists for this promotion');
    const rule = PromotionRuleV2Schema.parse(draft.ruleJson);
    const matched = await this.matchedProducts(promotionId, rule, 1, 1);
    if (!matched.total) throw new Error('Promotion cannot be published because it matches no active products');
    if (draft.promotion.start_date && draft.promotion.end_date && draft.promotion.start_date >= draft.promotion.end_date) throw new Error('Promotion end date must be after its start date');
    if (draft.promotion.budget !== null && Number(draft.promotion.budget) < 0) throw new Error('Promotion budget cannot be negative');
    await this.validateGiftAvailability(rule, draft.promotion.applicable_channel);
    await prisma.$transaction(async (tx) => {
      await tx.promotionRuleVersion.updateMany({ where: { promotionId, schemaVersion: 2, status: 'published' }, data: { status: 'retired', modifiedAt: seconds() } });
      await tx.promotionRuleVersion.updateMany({ where: { promotionId, schemaVersion: 2, status: 'draft', id: { not: draft.id } }, data: { status: 'retired', modifiedAt: seconds() } });
      await tx.promotionRuleVersion.update({ where: { id: draft.id }, data: { status: 'published', publishedAt: seconds(), ...(publishedBy !== undefined ? { publishedBy } : {}), modifiedAt: seconds() } });
    });
    return { promotion_id: promotionId, version: draft.version, matched_products: matched.total };
  }

  private async validateGiftAvailability(rule: PromotionRuleV2, applicableChannel: string): Promise<void> {
    const benefits = [rule.benefit, ...rule.tiers.map((tier) => tier.benefit)].filter((benefit) => benefit?.type === 'FREE_ITEM');
    const giftIds = new Set(benefits.flatMap((benefit) => benefit?.product_ids ?? benefit?.reward_group ?? []));
    if (!giftIds.size) return;
    const platform = ['all', 'web', 'mobile', 'nivapp'].includes(applicableChannel.toLowerCase()) ? 'nivapp' : applicableChannel.toLowerCase();
    const rows = await prisma.platformStock.findMany({ where: { productid: { in: [...giftIds].map(BigInt) }, platform, availableqty: { gt: 0 }, platformstatus: { not: 'inactive' } }, select: { productid: true } });
    const available = new Set(rows.map((row) => row.productid.toString()));
    const missing = [...giftIds].filter((id) => !available.has(id));
    if (missing.length) throw new Error(`Gift products unavailable on all channels: ${missing.join(', ')}`);
  }

  async getFacets(): Promise<Record<string, Array<{ id: string; label: string; count: number }>>> {
    const products = await prisma.product.findMany({
      where: { productstatus: { notIn: ['inactive', 'deleted'] } },
      select: { id: true, name: true, category: true, subcategory: true },
    });
    const facet = (selector: (product: typeof products[number]) => string | null): Array<{ id: string; label: string; count: number }> => {
      const counts = new Map<string, number>();
      for (const product of products) {
        const value = selector(product)?.trim();
        if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      return [...counts].map(([value, count]) => ({ id: value, label: value, count })).sort((a, b) => a.label.localeCompare(b.label));
    };
    return {
      PRODUCT: products.map((product) => ({ id: product.id.toString(), label: product.name, count: 1 })),
      CATEGORY: facet((product) => product.category), SUBCATEGORY: facet((product) => product.subcategory),
      // Future facet responses intentionally disabled:
      // FRAGRANCE, BRAND, COLLECTION, TAG and SUBSUBCATEGORY.
    };
  }

  async getMatchedProducts(promotionId: number, page = 1, limit = 50): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
    const version = await prisma.promotionRuleVersion.findFirst({ where: { promotionId, schemaVersion: 2 }, orderBy: [{ status: 'asc' }, { version: 'desc' }] });
    if (!version) throw new Error('No rule version exists for this promotion');
    return this.matchedProducts(promotionId, PromotionRuleV2Schema.parse(version.ruleJson), page, limit);
  }

  async getAnalytics(): Promise<Record<string, unknown>> {
    const [evaluationTotal, evaluationStatuses, adjustmentTypes, redemptions] = await Promise.all([
      prisma.promotion_evaluations.count(),
      prisma.promotion_evaluations.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.promotionEvaluationAdjustment.groupBy({ by: ['adjustmentType'], _count: { _all: true }, _sum: { amount: true } }),
      prisma.promotion_redemptions.aggregate({ _count: { _all: true }, _sum: { discount_amount: true } }),
    ]);
    return {
      schema_version: 2,
      evaluations: { total: evaluationTotal, by_status: Object.fromEntries(evaluationStatuses.map((item) => [item.status ?? 'unknown', item._count._all])) },
      adjustments: adjustmentTypes.map((item) => ({ type: item.adjustmentType, count: item._count._all, amount: Number(item._sum.amount ?? 0) })),
      redemptions: { count: redemptions._count._all, discount_amount: Number(redemptions._sum.discount_amount ?? 0) },
    };
  }

  private async matchedProducts(_promotionId: number, rule: PromotionRuleV2, page: number, limit: number): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
    const products = await prisma.product.findMany({
      where: { productstatus: { notIn: ['inactive', 'deleted'] } },
      select: { id: true, name: true, category: true, subcategory: true, price: true, availablequantity: true },
    });
    const matching = products.filter((product) => isLineInPromotionScope(this.productToLine(product, 1), rule));
    const start = Math.max(0, (page - 1) * limit);
    return { data: matching.slice(start, start + limit).map((product) => ({ ...product, id: product.id.toString(), price: Number(product.price ?? 0) })), total: matching.length, page, limit };
  }

  async simulate(promotionId: number, request: unknown): Promise<PromotionQuote> {
    const parsed = PromotionQuoteRequestSchema.parse(request);
    const version = await prisma.promotionRuleVersion.findFirst({ where: { promotionId, schemaVersion: 2 }, orderBy: { version: 'desc' }, include: { promotion: true } });
    if (!version) throw new Error('No rule version exists for this promotion');
    const hydrated = await this.hydrateCart(parsed);
    const campaigns = [{ promotionId, ruleVersion: version.version, name: version.promotion.name ?? `Promotion ${promotionId}`, rule: PromotionRuleV2Schema.parse(version.ruleJson) }];
    const catalog = await this.hydrateRewardCatalog(campaigns, hydrated.catalog, parsed.channel);
    return evaluatePromotionQuote(hydrated.lines, campaigns, catalog, { shippingAmount: parsed.shipping_amount, rewardSelections: parsed.reward_selections });
  }

  async quoteCurrent(input: unknown, authenticatedCustomerId?: string): Promise<Record<string, unknown>> {
    const request = PromotionQuoteRequestCurrentSchema.parse(input);
    const hydrationRequest = PromotionQuoteRequestSchema.parse({
      schema_version: 2,
      cart_items: request.cart_items,
      channel: request.channel,
      shipping_amount: request.shipping_amount,
    });
    const hydrated = await this.hydrateCart(hydrationRequest);
    const lines = hydrated.lines.map((line) => ({
      ...(line.cartRecordId ? { cart_record_id: line.cartRecordId } : {}),
      product_id: line.id,
      quantity: line.quantity,
      unit_price_paise: line.unitPricePaise,
      ...(line.stock !== undefined ? { available_quantity: line.stock } : {}),
      facets: line.facets,
    }));
    const now = seconds();
    const activeAutomaticFilter = {
      status: 'active',
      OR: [{ application_mode: 'automatic' }, { auto_apply: true }],
      AND: [
        { OR: [{ start_date: null }, { start_date: { lte: now } }] },
        { OR: [{ end_date: null }, { end_date: { gte: now } }] },
      ],
    } satisfies Prisma.promotionsWhereInput;
    const [rows, legacyFreeShippingRows] = await Promise.all([
      prisma.promotionRuleVersion.findMany({
        where: {
          schemaVersion: 3,
          status: 'published',
          promotion: activeAutomaticFilter,
        },
        include: { promotion: true },
        orderBy: [{ promotionId: 'asc' }, { version: 'desc' }],
      }),
      // Free-shipping campaigns created before V3 do not have a canonical
      // rule version. Evaluate them inside this quote during the migration so
      // cart refreshes cannot lose shipping while retaining item promotions.
      prisma.promotions.findMany({
        where: {
          ...activeAutomaticFilter,
          type: 'FREE_SHIPPING',
          ruleVersions: { none: { schemaVersion: 3, status: 'published' } },
        },
        include: { assignments: { where: { status: 'active' } } },
        orderBy: { id: 'asc' },
      }),
    ]);
    const latestRows = [...new Map(rows.map((row) => [row.promotionId, row])).values()]
      .filter((row) => isPromotionChannelEligible(row.promotion.applicable_channel, request.channel === 'nivapp' ? 'mobile' : request.channel));
    const channel = request.channel === 'nivapp' ? 'mobile' : request.channel;
    const legacyFreeShipping = legacyFreeShippingRows.filter((promotion) =>
      isPromotionChannelEligible(promotion.applicable_channel, channel));
    const promotionIds = [...new Set([
      ...latestRows.map((row) => row.promotionId),
      ...legacyFreeShipping.map((promotion) => promotion.id),
    ])];
    const numericCustomerId = authenticatedCustomerId && /^\d+$/.test(authenticatedCustomerId)
      ? Number(authenticatedCustomerId)
      : undefined;
    const [usage, customerUsage, groupMemberships] = await Promise.all([
      prisma.promotion_redemptions.groupBy({ by: ['promotion_id'], where: { promotion_id: { in: promotionIds } }, _count: { _all: true }, _sum: { discount_amount: true } }),
      authenticatedCustomerId
        ? prisma.promotion_redemptions.groupBy({ by: ['promotion_id'], where: { promotion_id: { in: promotionIds }, user_id: authenticatedCustomerId }, _count: { _all: true } })
        : Promise.resolve([]),
      numericCustomerId !== undefined
        ? prisma.customer_group_members.findMany({ where: { customer_id: numericCustomerId, status: 'active' }, select: { customer_group_id: true } })
        : Promise.resolve([]),
    ]);
    const usageById = new Map(usage.map((item) => [item.promotion_id, { count: item._count._all, amount: Number(item._sum.discount_amount ?? 0) }]));
    const customerUsageById = new Map(customerUsage.map((item) => [item.promotion_id, item._count._all]));
    const customerGroups = new Set(groupMemberships.map((item) => item.customer_group_id));
    const withinLimits = (promotion: { id: number; max_redemptions: number | null; per_user_limit: number | null; budget: Prisma.Decimal | null }): boolean => {
      const used = usageById.get(promotion.id) ?? { count: 0, amount: 0 };
      if (promotion.max_redemptions && used.count >= promotion.max_redemptions) return false;
      if (promotion.per_user_limit && authenticatedCustomerId && (customerUsageById.get(promotion.id) ?? 0) >= promotion.per_user_limit) return false;
      const budget = Number(promotion.budget ?? 0);
      return budget <= 0 || used.amount < budget;
    };
    const eligibleRows = latestRows.filter((row) => {
      const used = usageById.get(row.promotionId) ?? { count: 0, amount: 0 };
      if (row.promotion.max_redemptions && used.count >= row.promotion.max_redemptions) return false;
      if (row.promotion.per_user_limit && authenticatedCustomerId && (customerUsageById.get(row.promotionId) ?? 0) >= row.promotion.per_user_limit) return false;
      const budget = Number(row.promotion.budget ?? 0);
      return budget <= 0 || used.amount < budget;
    });
    const eligibleLegacyFreeShipping = legacyFreeShipping.filter((promotion) => {
      if (!withinLimits(promotion)) return false;
      const segmentCondition = Array.isArray(promotion.conditions)
        ? (promotion.conditions as Array<{ attribute?: unknown; value?: unknown }>).find((condition) => condition.attribute === 'user.segment')
        : undefined;
      if (segmentCondition) {
        const required = Array.isArray(segmentCondition.value)
          ? segmentCondition.value.map(String)
          : [String(segmentCondition.value ?? '')];
        if (required.includes('authenticated_user') && !authenticatedCustomerId) return false;
      }
      if (!promotion.assignments.length) return true;
      return promotion.assignments.some((assignment) => assignment.assignment_type === 'anyone'
        || (numericCustomerId !== undefined && (assignment.customer_id === numericCustomerId || assignment.claimed_by_customer_id === numericCustomerId))
        || (assignment.customer_group_id !== null && customerGroups.has(assignment.customer_group_id)));
    });
    const campaigns = eligibleRows.map((row) => ({
      promotion_id: row.promotionId,
      rule_version: row.version,
      name: row.promotion.name ?? `Promotion ${row.promotionId}`,
      rule: PromotionRuleV3Schema.parse(row.ruleJson),
    }));
    const rewardCatalog = await this.hydrateCurrentRewardCatalog(campaigns.map((campaign) => campaign.rule), request.channel);
    const evaluation = evaluateV3ItemPromotions(lines, campaigns, {
      channel: request.channel,
      shipping_amount: request.shipping_amount,
      customer_segments: request.customer_segments,
      reward_catalog: rewardCatalog,
    });
    const legacyShippingQuote = evaluatePromotionQuote(
      hydrated.lines,
      eligibleLegacyFreeShipping.map((promotion) => ({
        promotionId: promotion.id,
        ruleVersion: 0,
        name: promotion.name ?? `Promotion ${promotion.id}`,
        rule: convertLegacyPromotionRule(promotion),
      })),
      hydrated.catalog,
      { shippingAmount: request.shipping_amount },
    );
    const shippingAdjustments = legacyShippingQuote.adjustments.filter((adjustment) => adjustment.type === 'FREE_SHIPPING');
    const shippingDiscount = shippingAdjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
    const appliedPromotions = [
      ...evaluation.applied_promotions,
      ...legacyShippingQuote.applied_promotions,
    ];
    const evaluationId = randomUUID();
    const expiryMinutes = Math.max(1, Math.min(
      ...eligibleRows.map((row) => row.promotion.evaluation_expiry_minutes ?? 15),
      ...eligibleLegacyFreeShipping.map((promotion) => promotion.evaluation_expiry_minutes ?? 15),
      15,
    ));
    const expiresAt = now + BigInt(expiryMinutes * 60);
    const ruleSnapshots = eligibleRows
      .filter((row) => evaluation.applied_promotions.some((promotion) => promotion.promotion_id === row.promotionId))
      .map((row) => ({ promotion_id: row.promotionId, rule_version_id: row.id.toString(), version: row.version, schema_version: row.schemaVersion, checksum: row.checksum, rule: row.ruleJson }));
    const snapshotChecksum = createHash('sha256').update(stableJson(ruleSnapshots)).digest('hex');
    const quoteAdjustments = [
      ...evaluation.adjustments.map((adjustment) => ({
        ...adjustment,
        type: adjustment.adjustment_type ?? 'ITEM_DISCOUNT',
        source_product_ids: Array.isArray(adjustment.metadata?.source_product_ids) ? adjustment.metadata.source_product_ids : [adjustment.product_id],
      })),
      ...evaluation.order_adjustments.map((adjustment) => ({
        ...adjustment,
        type: adjustment.adjustment_type,
        affected_quantity: 0,
        list_amount: adjustment.basis_amount,
        source_product_ids: [],
        metadata: { application_level: 'ORDER' },
      })),
      ...shippingAdjustments,
    ];
    const quote = {
      ...evaluation,
      discount_total: evaluation.discount_total + shippingDiscount,
      applied_promotions: appliedPromotions,
      evaluation_id: evaluationId,
      currency: 'INR' as const,
      original_total: evaluation.original_merchandise_total + request.shipping_amount,
      shipping_amount: request.shipping_amount,
      payable_total: evaluation.payable_merchandise_total + request.shipping_amount - shippingDiscount,
      adjustments: quoteAdjustments,
      eligible_alternatives: [],
      rejected_candidates: evaluation.rejected_candidates.map((candidate) => ({ promotion_id: candidate.promotion_id, reason_code: candidate.reason_codes[0] ?? 'NO_ELIGIBLE_PRODUCTS' })),
      next_tier_progress: evaluation.progress.map((item) => ({ promotion_id: item.promotion_id, current: item.current, next_minimum: item.required, remaining: item.remaining, metric: item.field })),
      gift_choices: [],
      expires_at: new Date(Number(expiresAt) * 1000).toISOString(),
    };
    const signature = createHash('sha256').update(stableJson(lines.map((line) => ({ product_id: line.product_id, quantity: line.quantity, unit_price_paise: line.unit_price_paise })))).digest('hex');
    const versionIds = new Map(eligibleRows.map((row) => [`${row.promotionId}:${row.version}`, row.id]));
    const persistCurrentQuote = async (includeRuleSnapshots: boolean): Promise<void> => prisma.$transaction(async (tx) => {
      await tx.promotion_evaluations.create({
        data: {
          evaluation_id: evaluationId,
          user_id: authenticatedCustomerId ?? null,
          cart_data: asJson(request),
          cart_signature: signature,
          original_total: quote.original_total / 100,
          discounted_total: quote.payable_total / 100,
          applied_promotions: asJson(appliedPromotions),
          ineligible_coupons: asJson(evaluation.rejected_candidates),
          context: asJson({ schema_version: 3, channel: request.channel, quote }),
          ...(includeRuleSnapshots ? {
            rule_snapshots: asJson(ruleSnapshots),
            rule_snapshot_checksum: snapshotChecksum,
          } : {}),
          created_at: now,
          expires_at: expiresAt,
          status: 'active',
          createddate: now,
          modifieddate: now,
        },
        select: { evaluation_id: true },
      });
      if (quoteAdjustments.length) await tx.promotionEvaluationAdjustment.createMany({ data: quoteAdjustments.map((adjustment) => ({
        id: adjustment.adjustment_id,
        evaluationId,
        promotionId: adjustment.promotion_id,
        promotionRuleVersionId: versionIds.get(`${adjustment.promotion_id}:${adjustment.rule_version}`) ?? null,
        adjustmentType: adjustment.type,
        cartRecordId: 'cart_record_id' in adjustment ? adjustment.cart_record_id ?? null : null,
        productId: 'product_id' in adjustment && adjustment.product_id !== undefined ? BigInt(adjustment.product_id) : null,
        affectedQuantity: adjustment.affected_quantity,
        amount: adjustment.amount / 100,
        listAmount: adjustment.list_amount / 100,
        payableAmount: adjustment.payable_amount / 100,
        sourceProductIds: asJson(adjustment.source_product_ids),
        metadata: asJson(adjustment.metadata ?? {}),
        createdAt: now,
      })) });
    });
    try {
      await persistCurrentQuote(true);
    } catch (error: any) {
      if (error?.code !== 'P2022' || !String(error?.meta?.column ?? '').includes('rule_snapshot')) throw error;
      logger.warn({ evaluationId }, 'Promotion snapshot columns unavailable; persisting current quote without snapshots');
      await persistCurrentQuote(false);
    }
    return quote;
  }

  async validateCurrentQuote(evaluationId: string, authenticatedCustomerId?: string): Promise<Record<string, unknown>> {
    const evaluation = await prisma.promotion_evaluations.findUnique({
      where: { evaluation_id: evaluationId },
      select: { user_id: true, status: true, expires_at: true, context: true },
    });
    if (!evaluation) throw Object.assign(new Error('Promotion quote was not found'), { statusCode: 404 });
    if (evaluation.user_id && evaluation.user_id !== authenticatedCustomerId) throw Object.assign(new Error('This promotion quote belongs to another customer'), { statusCode: 403 });
    if (evaluation.status !== 'active' || evaluation.expires_at <= seconds()) throw Object.assign(new Error('Promotion quote has expired'), { statusCode: 409 });
    const context = evaluation.context as { schema_version?: number; quote?: Record<string, unknown> } | null;
    if (context?.schema_version !== 3 || !context.quote) throw Object.assign(new Error('Promotion quote contract is not supported by this endpoint'), { statusCode: 409 });
    return context.quote;
  }

  async simulateCurrent(promotionId: number, input: unknown): Promise<{
    schema_version: 3;
    promotion_id: number;
    rule_version: number;
    currency: 'INR';
    original_merchandise_total: number;
    shipping_amount: number;
    discount_total: number;
    payable_total: number;
    evaluation: ReturnType<typeof evaluateV3ItemPromotions>;
    rule_snapshot: PromotionRuleV3;
  }> {
    const request = PromotionV3SimulationRequestSchema.parse(input);
    let rule = request.rule;
    let ruleVersion = 0;
    if (!rule) {
      const stored = await prisma.promotionRuleVersion.findFirst({
        where: { promotionId, schemaVersion: 3 },
        orderBy: { version: 'desc' },
      });
      if (!stored) throw Object.assign(new Error('PROMOTION_RULE_NOT_FOUND'), { statusCode: 404 });
      rule = PromotionRuleV3Schema.parse(stored.ruleJson);
      ruleVersion = stored.version;
    }
    const hydrationRequest = PromotionQuoteRequestSchema.parse({
      schema_version: 2,
      cart_items: request.cart_items,
      channel: request.channel,
      shipping_amount: request.shipping_amount,
    });
    const hydrated = await this.hydrateCart(hydrationRequest);
    const lines = hydrated.lines.map((line) => ({
      ...(line.cartRecordId ? { cart_record_id: line.cartRecordId } : {}),
      product_id: line.id,
      quantity: line.quantity,
      unit_price_paise: line.unitPricePaise,
      ...(line.stock !== undefined ? { available_quantity: line.stock } : {}),
      facets: line.facets,
    }));
    const rewardCatalog = await this.hydrateCurrentRewardCatalog([rule], request.channel);
    const evaluation = evaluateV3ItemPromotions(lines, [{
      promotion_id: promotionId,
      rule_version: ruleVersion,
      rule,
    }], {
      channel: request.channel,
      shipping_amount: request.shipping_amount,
      ...(request.remaining_cart_value !== undefined ? { remaining_cart_value: request.remaining_cart_value } : {}),
      customer_segments: request.customer_segments,
      reward_catalog: rewardCatalog,
    });
    return {
      schema_version: 3,
      promotion_id: promotionId,
      rule_version: ruleVersion,
      currency: 'INR',
      original_merchandise_total: evaluation.original_merchandise_total,
      shipping_amount: request.shipping_amount,
      discount_total: evaluation.discount_total,
      payable_total: evaluation.payable_merchandise_total + request.shipping_amount,
      evaluation,
      rule_snapshot: rule,
    };
  }

  async simulateCampaigns(input: unknown): Promise<{
    schema_version: 3;
    currency: 'INR';
    shipping_amount: number;
    payable_total: number;
    evaluation: ReturnType<typeof evaluateV3ItemPromotions>;
    rule_snapshots: Array<{ promotion_id: number; rule_version: number; checksum: string; rule: PromotionRuleV3 }>;
  }> {
    const request = PromotionV3MultiSimulationRequestSchema.parse(input);
    const hydrationRequest = PromotionQuoteRequestSchema.parse({
      schema_version: 2,
      cart_items: request.cart_items,
      channel: request.channel,
      shipping_amount: request.shipping_amount,
    });
    const hydrated = await this.hydrateCart(hydrationRequest);
    const lines = hydrated.lines.map((line) => ({
      ...(line.cartRecordId ? { cart_record_id: line.cartRecordId } : {}),
      product_id: line.id,
      quantity: line.quantity,
      unit_price_paise: line.unitPricePaise,
      ...(line.stock !== undefined ? { available_quantity: line.stock } : {}),
      facets: line.facets,
    }));
    const rewardCatalog = await this.hydrateCurrentRewardCatalog(request.campaigns.map((campaign) => campaign.rule), request.channel);
    const evaluation = evaluateV3ItemPromotions(lines, request.campaigns, {
      channel: request.channel,
      shipping_amount: request.shipping_amount,
      ...(request.remaining_cart_value !== undefined ? { remaining_cart_value: request.remaining_cart_value } : {}),
      customer_segments: request.customer_segments,
      reward_catalog: rewardCatalog,
    });
    return {
      schema_version: 3,
      currency: 'INR',
      shipping_amount: request.shipping_amount,
      payable_total: evaluation.payable_merchandise_total + request.shipping_amount,
      evaluation,
      rule_snapshots: request.campaigns.map((campaign) => ({
        promotion_id: campaign.promotion_id,
        rule_version: campaign.rule_version,
        checksum: createHash('sha256').update(stableJson(campaign.rule)).digest('hex'),
        rule: campaign.rule,
      })),
    };
  }

  async eligibility(input: unknown, authenticatedCustomerId?: string): Promise<{
    versioned_promotion_ids: number[];
    eligible_promotions: Array<{ promotion_id: number; name: string; saving: number }>;
    ineligible_promotions: PromotionQuote['rejected_candidates'];
  }> {
    const parsed = PromotionEligibilityRequestSchema.parse(input);
    const versionRows = await prisma.promotionRuleVersion.findMany({
      where: { promotionId: { in: parsed.promotion_ids }, schemaVersion: 2, status: 'published' },
      orderBy: [{ promotionId: 'asc' }, { version: 'desc' }],
      select: { promotionId: true },
    });
    const versionedIds = [...new Set(versionRows.map((row) => row.promotionId))];
    if (!versionedIds.length) {
      return { versioned_promotion_ids: [], eligible_promotions: [], ineligible_promotions: [] };
    }

    const request = PromotionQuoteRequestSchema.parse({
      schema_version: parsed.schema_version,
      cart_items: parsed.cart_items,
      channel: parsed.channel,
      shipping_amount: parsed.shipping_amount,
      customer_id: authenticatedCustomerId,
      selected_promotion_ids: versionedIds,
    });
    const hydrated = await this.hydrateCart(request);
    const active = await this.activeCampaigns(request, hydrated.lines);
    const catalog = await this.hydrateRewardCatalog(active.campaigns, hydrated.catalog, request.channel);
    const eligibleById = new Map<number, { promotion_id: number; name: string; saving: number }>();
    const rejectionById = new Map(active.rejections.map((rejection) => [rejection.promotion_id, rejection]));

    // Evaluate each campaign independently. A combined quote intentionally
    // resolves conflicts and may allocate only the remaining cart units to an
    // alternative offer; that would understate the saving shown on its card.
    for (const campaign of active.campaigns) {
      const candidateQuote = evaluatePromotionQuote(hydrated.lines, [campaign], catalog, {
        shippingAmount: request.shipping_amount,
      });
      const offer = candidateQuote.applied_promotions.find((item) => item.promotion_id === campaign.promotionId);
      if (offer) {
        eligibleById.set(offer.promotion_id, offer);
        continue;
      }
      if (candidateQuote.gift_choices.some((choice) => choice.promotion_id === campaign.promotionId)) {
        eligibleById.set(campaign.promotionId, {
          promotion_id: campaign.promotionId,
          name: campaign.name,
          saving: 0,
        });
        continue;
      }
      const rejection = candidateQuote.rejected_candidates.find((item) => item.promotion_id === campaign.promotionId);
      if (rejection) rejectionById.set(campaign.promotionId, rejection);
    }

    const ineligible: PromotionQuote['rejected_candidates'] = versionedIds
      .filter((promotionId) => !eligibleById.has(promotionId))
      .map((promotionId) => rejectionById.get(promotionId)
        ?? { promotion_id: promotionId, reason_code: 'NO_ELIGIBLE_PRODUCTS' as const });

    return {
      versioned_promotion_ids: versionedIds,
      eligible_promotions: [...eligibleById.values()].sort((left, right) => right.saving - left.saving || left.promotion_id - right.promotion_id),
      ineligible_promotions: ineligible,
    };
  }

  async quote(input: unknown, authenticatedCustomerId?: string): Promise<PromotionQuote> {
    const startedAt = performance.now();
    const request = PromotionQuoteRequestSchema.parse(input);
    if (request.selected_promotion_ids?.length) {
      const selectedIds = [...new Set(request.selected_promotion_ids)];
      const versionedCount = await prisma.promotionRuleVersion.groupBy({
        by: ['promotionId'],
        where: { promotionId: { in: selectedIds }, schemaVersion: 2, status: 'published' },
      });
      if (versionedCount.length !== selectedIds.length) {
        throw Object.assign(new Error('PROMOTION_V2_RULE_NOT_FOUND'), { statusCode: 404 });
      }
    }
    if (authenticatedCustomerId) request.customer_id = authenticatedCustomerId;
    else delete request.customer_id;
    const hydrated = await this.hydrateCart(request);
    const active = await this.activeCampaigns(request, hydrated.lines);
    const catalog = await this.hydrateRewardCatalog(active.campaigns, hydrated.catalog, request.channel);
    const quote = evaluatePromotionQuote(hydrated.lines, active.campaigns, catalog, { shippingAmount: request.shipping_amount, rewardSelections: request.reward_selections });
    quote.rejected_candidates.push(...active.rejections.filter((rejection) => !quote.rejected_candidates.some((item) => item.promotion_id === rejection.promotion_id)));
    await this.persistQuote(quote, request, hydrated.lines);
    logger.info({
      event: 'promotions_v2_quote', mode: 'active',
      evaluationId: quote.evaluation_id, channel: request.channel, cartLineCount: request.cart_items.length,
      appliedCount: quote.applied_promotions.length, rejectedCount: quote.rejected_candidates.length,
      conflictCount: quote.rejected_candidates.filter((item) => item.reason_code === 'CONFLICTED_WITH_BETTER_OFFER').length,
      giftCount: quote.adjustments.filter((item) => item.type === 'FREE_ITEM').length,
      discountPaise: quote.discount_total, durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    }, 'Promotions V2 quote completed');
    return quote;
  }

  private async activeCampaigns(request: PromotionQuoteRequest, lines: PromotionCartLine[]): Promise<{ campaigns: PromotionCampaign[]; rejections: PromotionQuote['rejected_candidates'] }> {
    const now = Math.floor(Date.now() / 1000);
    const targetMatches: Prisma.PromotionTargetWhereInput[] = [{ facetType: 'ENTIRE_CART', facetValue: '*' }];
    for (const line of lines) {
      targetMatches.push({ facetType: 'PRODUCT', facetValue: line.id.toLocaleLowerCase('en-IN') });
      for (const [facetType, values] of Object.entries(line.facets)) for (const facetValue of values ?? []) targetMatches.push({ facetType, facetValue: facetValue.trim().toLocaleLowerCase('en-IN') });
    }
    const activeDateFilter = {
      status: 'active',
      AND: [
        { OR: [{ start_date: null }, { start_date: { lte: BigInt(now) } }] },
        { OR: [{ end_date: null }, { end_date: { gte: BigInt(now) } }] },
      ],
    } satisfies Prisma.promotionsWhereInput;
    const [rows, legacyAutomaticPromotions] = await Promise.all([
      prisma.promotionRuleVersion.findMany({
        where: {
          schemaVersion: 2,
          status: 'published',
          OR: [{ targets: { none: { inclusion: 'include' } } }, { targets: { some: { inclusion: 'include', OR: targetMatches } } }],
          promotion: activeDateFilter,
        },
        include: { promotion: { include: { assignments: { where: { status: 'active' } } } } }, orderBy: [{ promotionId: 'asc' }, { version: 'desc' }],
      }),
      // During rollout, click-to-apply campaigns can have published V2 rules
      // before long-lived automatic offers are migrated. Carry those legacy
      // automatic offers into the canonical quote so shipping and payment
      // validation cannot disagree with the legacy auto-evaluation.
      prisma.promotions.findMany({
        where: {
          ...activeDateFilter,
          OR: [{ application_mode: 'automatic' }, { auto_apply: true }],
          ruleVersions: { none: { status: 'published' } },
        },
        include: { assignments: { where: { status: 'active' } } },
        orderBy: { id: 'asc' },
      }),
    ]);
    const promotionIds = [...new Set([
      ...rows.map((row) => row.promotionId),
      ...legacyAutomaticPromotions.map((promotion) => promotion.id),
    ])];
    const [usage, customerUsage, groupMemberships] = await Promise.all([
      prisma.promotion_redemptions.groupBy({ by: ['promotion_id'], where: { promotion_id: { in: promotionIds } }, _count: { _all: true }, _sum: { discount_amount: true } }),
      request.customer_id
        ? prisma.promotion_redemptions.groupBy({ by: ['promotion_id'], where: { promotion_id: { in: promotionIds }, user_id: request.customer_id }, _count: { _all: true } })
        : Promise.resolve([]),
      request.customer_id
        ? prisma.customer_group_members.findMany({ where: { customer_id: Number(request.customer_id), status: 'active' }, select: { customer_group_id: true } })
        : Promise.resolve([]),
    ]);
    const usageByPromotion = new Map(usage.map((item) => [item.promotion_id, { count: item._count._all, amount: Number(item._sum.discount_amount ?? 0) }]));
    const customerUsageByPromotion = new Map(customerUsage.map((item) => [item.promotion_id, item._count._all]));
    const customerGroups = new Set(groupMemberships.map((item) => item.customer_group_id));
    const seen = new Set<number>();
    const selected = new Set(request.selected_promotion_ids ?? []);
    const result: PromotionCampaign[] = [];
    const rejections: PromotionQuote['rejected_candidates'] = [];
    for (const row of rows) {
      if (seen.has(row.promotionId)) continue;
      seen.add(row.promotionId);
      const promotion = row.promotion;
      if (!isPromotionChannelEligible(promotion.applicable_channel, request.channel === 'nivapp' ? 'mobile' : request.channel)) {
        rejections.push({ promotion_id: promotion.id, reason_code: 'CHANNEL_NOT_ELIGIBLE' }); continue;
      }
      if (promotion.application_mode !== 'automatic' && !selected.has(promotion.id) && (!request.coupon_code || promotion.code?.toUpperCase() !== request.coupon_code.toUpperCase())) continue;
      const assignments = promotion.assignments;
      if (assignments.length) {
        const customerId = request.customer_id ? Number(request.customer_id) : undefined;
        const audienceMatch = assignments.some((assignment) => assignment.assignment_type === 'anyone'
          || (customerId !== undefined && (assignment.customer_id === customerId || assignment.claimed_by_customer_id === customerId))
          || (assignment.customer_group_id !== null && customerGroups.has(assignment.customer_group_id)));
        if (!audienceMatch) { rejections.push({ promotion_id: promotion.id, reason_code: 'CUSTOMER_NOT_ELIGIBLE' }); continue; }
      }
      const used = usageByPromotion.get(promotion.id) ?? { count: 0, amount: 0 };
      if (promotion.max_redemptions && used.count >= promotion.max_redemptions) { rejections.push({ promotion_id: promotion.id, reason_code: 'USAGE_LIMIT_REACHED' }); continue; }
      if (promotion.per_user_limit && request.customer_id && (customerUsageByPromotion.get(promotion.id) ?? 0) >= promotion.per_user_limit) { rejections.push({ promotion_id: promotion.id, reason_code: 'USAGE_LIMIT_REACHED' }); continue; }
      const budget = Number(promotion.budget ?? 0);
      // Existing promotions use 0 to mean "no budget limit". Prisma Decimal(0)
      // is an object and therefore truthy, so checking the object itself marked
      // every such promotion as exhausted.
      if (budget > 0 && used.amount >= budget) { rejections.push({ promotion_id: promotion.id, reason_code: 'BUDGET_EXHAUSTED' }); continue; }
      result.push({ promotionId: promotion.id, ruleVersion: row.version, name: promotion.name ?? `Promotion ${promotion.id}`, rule: parseCachedRule(row.checksum, row.ruleJson) });
    }
    for (const promotion of legacyAutomaticPromotions) {
      if (seen.has(promotion.id)) continue;
      seen.add(promotion.id);
      if (!isPromotionChannelEligible(promotion.applicable_channel, request.channel === 'nivapp' ? 'mobile' : request.channel)) {
        rejections.push({ promotion_id: promotion.id, reason_code: 'CHANNEL_NOT_ELIGIBLE' }); continue;
      }
      const segmentCondition = Array.isArray(promotion.conditions)
        ? (promotion.conditions as Array<{ attribute?: unknown; value?: unknown }>).find((condition) => condition.attribute === 'user.segment')
        : undefined;
      if (segmentCondition) {
        const requiredSegments = Array.isArray(segmentCondition.value)
          ? segmentCondition.value.map(String)
          : [String(segmentCondition.value ?? '')];
        if (!request.customer_id || !requiredSegments.includes('authenticated_user')) {
          rejections.push({ promotion_id: promotion.id, reason_code: 'CUSTOMER_NOT_ELIGIBLE' }); continue;
        }
      }
      const assignments = promotion.assignments;
      if (assignments.length) {
        const customerId = request.customer_id ? Number(request.customer_id) : undefined;
        const audienceMatch = assignments.some((assignment) => assignment.assignment_type === 'anyone'
          || (customerId !== undefined && (assignment.customer_id === customerId || assignment.claimed_by_customer_id === customerId))
          || (assignment.customer_group_id !== null && customerGroups.has(assignment.customer_group_id)));
        if (!audienceMatch) { rejections.push({ promotion_id: promotion.id, reason_code: 'CUSTOMER_NOT_ELIGIBLE' }); continue; }
      }
      const used = usageByPromotion.get(promotion.id) ?? { count: 0, amount: 0 };
      if (promotion.max_redemptions && used.count >= promotion.max_redemptions) { rejections.push({ promotion_id: promotion.id, reason_code: 'USAGE_LIMIT_REACHED' }); continue; }
      if (promotion.per_user_limit && request.customer_id && (customerUsageByPromotion.get(promotion.id) ?? 0) >= promotion.per_user_limit) { rejections.push({ promotion_id: promotion.id, reason_code: 'USAGE_LIMIT_REACHED' }); continue; }
      const budget = Number(promotion.budget ?? 0);
      if (budget > 0 && used.amount >= budget) { rejections.push({ promotion_id: promotion.id, reason_code: 'BUDGET_EXHAUSTED' }); continue; }
      try {
        result.push({
          promotionId: promotion.id,
          // Version zero identifies an in-memory legacy bridge. Persisted
          // adjustments intentionally keep a null rule-version FK.
          ruleVersion: 0,
          name: promotion.name ?? `Promotion ${promotion.id}`,
          rule: convertLegacyPromotionRule(promotion),
        });
      } catch (error) {
        logger.warn({ promotionId: promotion.id, error }, 'Unable to bridge legacy automatic promotion into V2 quote');
      }
    }
    return { campaigns: result, rejections };
  }

  private async hydrateCart(request: PromotionQuoteRequest): Promise<{ lines: PromotionCartLine[]; catalog: PromotionCatalogProduct[] }> {
    const ids = [...new Set(request.cart_items.map((item) => BigInt(item.product_id)))];
    const products = await prisma.product.findMany({ where: { id: { in: ids } }, include: { platformStocks: true } });
    if (products.length !== ids.length) throw new Error('One or more cart products do not exist');
    const platform = ['web', 'mobile', 'nivapp'].includes(request.channel) ? 'nivapp' : request.channel;
    const catalog = products.map((product) => {
      const channelStock = product.platformStocks.find((stock) => stock.platform.toLowerCase() === platform);
      const price = Number(product.price ?? 0);
      const discountedPrice = Math.max(0, price - Math.max(0, Number(product.discount ?? 0)));
      return this.productToLine(product, channelStock?.availableqty ?? product.availablequantity ?? 0, Math.round(discountedPrice * 100));
    });
    const byId = new Map(catalog.map((product) => [product.id, product]));
    const lines = request.cart_items.map((item) => {
      const product = byId.get(item.product_id)!;
      return { ...product, cartRecordId: item.cart_record_id, quantity: item.quantity };
    });
    return { lines, catalog };
  }

  private async hydrateRewardCatalog(campaigns: PromotionCampaign[], existing: PromotionCatalogProduct[], channel: PromotionQuoteRequest['channel']): Promise<PromotionCatalogProduct[]> {
    const existingIds = new Set(existing.map((product) => product.id));
    const rewardIds = new Set(campaigns.flatMap((campaign) => [campaign.rule.benefit, ...campaign.rule.tiers.map((tier) => tier.benefit)]
      .flatMap((benefit) => benefit?.type === 'FREE_ITEM' ? [...(benefit.product_ids ?? []), ...(benefit.reward_group ?? [])] : [])));
    const missing = [...rewardIds].filter((id) => !existingIds.has(id));
    if (!missing.length) return existing;
    const products = await prisma.product.findMany({ where: { id: { in: missing.map(BigInt) } }, include: { platformStocks: true } });
    const platform = ['web', 'mobile', 'nivapp'].includes(channel) ? 'nivapp' : channel;
    return [...existing, ...products.map((product) => {
      const stock = product.platformStocks.find((item) => item.platform.toLowerCase() === platform)?.availableqty ?? 0;
      const price = Math.max(0, Number(product.price ?? 0) - Math.max(0, Number(product.discount ?? 0)));
      return this.productToLine(product, stock, Math.round(price * 100));
    })];
  }

  private productToLine(product: { id: bigint; name: string; category: string | null; subcategory: string | null; price?: Prisma.Decimal | null; availablequantity?: number | null; productstatus?: string | null; modifieddate?: bigint | null }, stock?: number, pricePaise?: number): PromotionCartLine {
    const values = (value: string | null): string[] => value ? [value] : [];
    return {
      id: product.id.toString(), name: product.name, quantity: 1, unitPricePaise: pricePaise ?? Math.round(Number(product.price ?? 0) * 100),
      stock: stock ?? product.availablequantity ?? 0, catalogVersion: product.modifieddate?.toString() ?? '0', active: !['inactive', 'deleted'].includes((product.productstatus ?? '').toLowerCase()),
      facets: { CATEGORY: values(product.category), SUBCATEGORY: values(product.subcategory) },
      // Future hydration intentionally disabled: FRAGRANCE, BRAND, COLLECTION,
      // TAG and SUBSUBCATEGORY.
    };
  }

  private async persistQuote(quote: PromotionQuote, request: PromotionQuoteRequest, lines: PromotionCartLine[]): Promise<void> {
    const created = seconds();
    const signature = createHash('sha256').update(stableJson(lines.map((line) => ({
      cart_record_id: line.cartRecordId, product_id: line.id, quantity: line.quantity,
      unit_price_paise: line.unitPricePaise, catalog_version: line.catalogVersion,
    })).sort((left, right) => left.product_id.localeCompare(right.product_id)))).digest('hex');
    const versionRows = quote.adjustments.length ? await prisma.promotionRuleVersion.findMany({
      where: { OR: quote.adjustments.map((adjustment) => ({ promotionId: adjustment.promotion_id, version: adjustment.rule_version })) },
      select: { id: true, promotionId: true, version: true, schemaVersion: true, checksum: true, ruleJson: true },
    }) : [];
    const versionIds = new Map(versionRows.map((row) => [`${row.promotionId}:${row.version}`, row.id]));
    const ruleSnapshots = versionRows.map((row) => ({
      promotion_id: row.promotionId,
      rule_version_id: row.id.toString(),
      version: row.version,
      schema_version: row.schemaVersion,
      checksum: row.checksum,
      rule: row.ruleJson,
    })).sort((left, right) => left.promotion_id - right.promotion_id);
    const ruleSnapshotChecksum = createHash('sha256').update(stableJson(ruleSnapshots)).digest('hex');
    const persist = async (includeRuleSnapshots: boolean): Promise<void> => prisma.$transaction(async (tx) => {
      await tx.promotion_evaluations.create({
        data: {
          evaluation_id: quote.evaluation_id, user_id: request.customer_id ?? null, cart_data: asJson(request), cart_signature: signature,
          original_total: quote.original_total / 100, discounted_total: quote.payable_total / 100,
          applied_promotions: asJson(quote.applied_promotions), ineligible_coupons: asJson(quote.rejected_candidates),
          ...(includeRuleSnapshots ? {
            rule_snapshots: asJson(ruleSnapshots),
            rule_snapshot_checksum: ruleSnapshotChecksum,
          } : {}),
          context: asJson({ schema_version: 2, channel: request.channel, quote }), created_at: created,
          expires_at: BigInt(Math.floor(new Date(quote.expires_at).getTime() / 1000)), status: 'active', createddate: created, modifieddate: created,
        },
        // Avoid Prisma's default RETURNING of additive columns that may not
        // exist yet during a rolling deployment.
        select: { evaluation_id: true },
      });
      if (quote.adjustments.length) await tx.promotionEvaluationAdjustment.createMany({ data: quote.adjustments.map((adjustment) => ({
        id: adjustment.adjustment_id, evaluationId: quote.evaluation_id, promotionId: adjustment.promotion_id,
        promotionRuleVersionId: versionIds.get(`${adjustment.promotion_id}:${adjustment.rule_version}`) ?? null,
        adjustmentType: adjustment.type, cartRecordId: adjustment.cart_record_id ?? null, productId: adjustment.product_id ? BigInt(adjustment.product_id) : null,
        affectedQuantity: adjustment.affected_quantity, amount: adjustment.amount / 100, listAmount: adjustment.list_amount / 100,
        payableAmount: adjustment.payable_amount / 100, sourceProductIds: asJson(adjustment.source_product_ids), metadata: asJson(adjustment.metadata), createdAt: created,
      })) });
    });
    try {
      await persist(true);
    } catch (error: any) {
      if (error?.code !== 'P2022' || !String(error?.meta?.column ?? '').includes('rule_snapshot')) throw error;
      logger.warn({ evaluationId: quote.evaluation_id }, 'Promotion snapshot columns unavailable; persisting V2 quote without snapshots');
      await persist(false);
    }
  }

  async requoteEvaluation(evaluationId: string, selection?: { promotionId?: number; removePromotionId?: number; giftProductId?: string }, authenticatedCustomerId?: string): Promise<PromotionQuote> {
    const evaluation = await prisma.promotion_evaluations.findUniqueOrThrow({
      where: { evaluation_id: evaluationId },
      select: { status: true, expires_at: true, user_id: true, cart_data: true },
    });
    if (evaluation.status !== 'active' || evaluation.expires_at < seconds()) throw new Error('Promotion evaluation has expired');
    if (evaluation.user_id && evaluation.user_id !== authenticatedCustomerId) throw Object.assign(new Error('This promotion evaluation belongs to another customer'), { statusCode: 403 });
    const request = PromotionQuoteRequestSchema.parse(evaluation.cart_data);
    const ids = new Set(request.selected_promotion_ids ?? []);
    if (selection?.promotionId) ids.add(selection.promotionId);
    if (selection?.removePromotionId) ids.delete(selection.removePromotionId);
    request.selected_promotion_ids = [...ids];
    if (selection?.promotionId && selection.giftProductId) request.reward_selections = { ...request.reward_selections, [String(selection.promotionId)]: selection.giftProductId };
    return this.quote(request, authenticatedCustomerId);
  }

  async validateEvaluationForOrder(evaluationId: string, authenticatedCustomerId?: string): Promise<{
    isValid: boolean;
    reason?: string;
    evaluationId?: string;
    evaluation?: unknown;
  }> {
    const evaluation = await prisma.promotion_evaluations.findUnique({
      where: { evaluation_id: evaluationId },
      select: { user_id: true, status: true, expires_at: true, context: true },
    });
    if (!evaluation) return { isValid: false, reason: 'PROMOTION_NOT_FOUND: Promotion evaluation was not found.' };
    if (evaluation.user_id && evaluation.user_id !== authenticatedCustomerId) {
      return { isValid: false, reason: 'PROMOTION_ASSIGNMENT_CHANGED: Promotion evaluation belongs to another customer.' };
    }
    if (evaluation.status !== 'active') {
      return { isValid: false, reason: `PROMOTION_NO_LONGER_ELIGIBLE: Evaluation is ${evaluation.status}.` };
    }

    // V2 evaluation timestamps are epoch seconds; legacy evaluations use
    // epoch milliseconds. This method is only for schema-version 2 records.
    const expiresAtMilliseconds = Number(evaluation.expires_at) * 1000;
    if (!Number.isFinite(expiresAtMilliseconds) || expiresAtMilliseconds <= Date.now()) {
      await prisma.promotion_evaluations.updateMany({
        where: { evaluation_id: evaluationId, status: 'active' },
        data: { status: 'cancelled', modifieddate: seconds() },
      });
      return { isValid: false, reason: 'EVALUATION_EXPIRED: Refresh the cart and apply an available promotion again.' };
    }

    const context = evaluation.context as { schema_version?: number; quote?: PromotionQuote } | null;
    if (context?.schema_version !== 2 || !context.quote) {
      return { isValid: false, reason: 'PROMOTION_CART_CHANGED: Stored promotion quote is unavailable.' };
    }

    try {
      const refreshedQuote = await this.requoteEvaluation(
        evaluationId,
        undefined,
        authenticatedCustomerId,
      );
      if (!promotionQuotesMatchForCheckout(context.quote, refreshedQuote)) {
        await prisma.promotion_evaluations.updateMany({
          where: { evaluation_id: { in: [evaluationId, refreshedQuote.evaluation_id] }, status: 'active' },
          data: { status: 'cancelled', modifieddate: seconds() },
        });
        return {
          isValid: false,
          reason: 'PROMOTION_CART_CHANGED: Promotion benefits changed during checkout. Refresh the cart to review the updated total.',
        };
      }

      await prisma.promotion_evaluations.updateMany({
        where: { evaluation_id: evaluationId, status: 'active' },
        data: { status: 'cancelled', modifieddate: seconds() },
      });
      return {
        isValid: true,
        evaluationId: refreshedQuote.evaluation_id,
        evaluation: refreshedQuote,
      };
    } catch (error) {
      logger.warn({ evaluationId, error }, 'Promotions V2 evaluation failed checkout revalidation');
      return {
        isValid: false,
        reason: `PROMOTION_NO_LONGER_ELIGIBLE: ${error instanceof Error ? error.message : 'Promotion could not be revalidated.'}`,
      };
    }
  }
}
