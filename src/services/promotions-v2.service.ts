import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PromotionEligibilityRequestSchema, PromotionQuoteRequestSchema, PromotionRuleV2Schema, type PromotionQuoteRequest, type PromotionRuleV2 } from '../schemas/promotions-v2.schema.js';
import { evaluatePromotionQuote, isLineInPromotionScope, type PromotionCampaign, type PromotionCatalogProduct, type PromotionCartLine, type PromotionQuote } from './promotion-v2-engine.js';
import { convertLegacyPromotionRule } from '../utils/legacy-promotion-v2.js';
import { isPromotionChannelEligible } from '../utils/promotionChannel.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

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
      where: { promotionId },
      orderBy: { version: 'desc' },
    });
    if (!version) return null;
    return {
      version: version.version,
      status: version.status,
      rule: PromotionRuleV2Schema.parse(version.ruleJson),
    };
  }

  async saveDraft(promotionId: number, input: unknown): Promise<{ id: string; version: number; checksum: string; rule: PromotionRuleV2 }> {
    const rule = PromotionRuleV2Schema.parse(input);
    const checksum = createHash('sha256').update(stableJson(rule)).digest('hex');
    const latest = await prisma.promotionRuleVersion.findFirst({ where: { promotionId }, orderBy: { version: 'desc' }, select: { version: true } });
    const version = (latest?.version ?? 0) + 1;
    const created = await prisma.$transaction(async (tx) => {
      await tx.promotionRuleVersion.updateMany({
        where: { promotionId, status: 'draft' },
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

  async migrateLegacy(promotionId: number): Promise<{ id: string; version: number; checksum: string; rule: PromotionRuleV2 }> {
    const promotion = await prisma.promotions.findUniqueOrThrow({ where: { id: promotionId } });
    return this.saveDraft(promotionId, convertLegacyPromotionRule(promotion));
  }

  async publish(promotionId: number, publishedBy?: number): Promise<{ promotion_id: number; version: number; matched_products: number }> {
    const draft = await prisma.promotionRuleVersion.findFirst({ where: { promotionId, status: 'draft' }, orderBy: { version: 'desc' }, include: { promotion: true } });
    if (!draft) throw new Error('No draft rule version exists for this promotion');
    const rule = PromotionRuleV2Schema.parse(draft.ruleJson);
    const matched = await this.matchedProducts(promotionId, rule, 1, 1);
    if (!matched.total) throw new Error('Promotion cannot be published because it matches no active products');
    if (draft.promotion.start_date && draft.promotion.end_date && draft.promotion.start_date >= draft.promotion.end_date) throw new Error('Promotion end date must be after its start date');
    if (draft.promotion.budget !== null && Number(draft.promotion.budget) < 0) throw new Error('Promotion budget cannot be negative');
    await this.validateGiftAvailability(rule, draft.promotion.applicable_channel);
    await prisma.$transaction(async (tx) => {
      await tx.promotionRuleVersion.updateMany({ where: { promotionId, status: 'published' }, data: { status: 'retired', modifiedAt: seconds() } });
      await tx.promotionRuleVersion.updateMany({ where: { promotionId, status: 'draft', id: { not: draft.id } }, data: { status: 'retired', modifiedAt: seconds() } });
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
    const version = await prisma.promotionRuleVersion.findFirst({ where: { promotionId }, orderBy: [{ status: 'asc' }, { version: 'desc' }] });
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
    const version = await prisma.promotionRuleVersion.findFirst({ where: { promotionId }, orderBy: { version: 'desc' }, include: { promotion: true } });
    if (!version) throw new Error('No rule version exists for this promotion');
    const hydrated = await this.hydrateCart(parsed);
    const campaigns = [{ promotionId, ruleVersion: version.version, name: version.promotion.name ?? `Promotion ${promotionId}`, rule: PromotionRuleV2Schema.parse(version.ruleJson) }];
    const catalog = await this.hydrateRewardCatalog(campaigns, hydrated.catalog, parsed.channel);
    return evaluatePromotionQuote(hydrated.lines, campaigns, catalog, { shippingAmount: parsed.shipping_amount, rewardSelections: parsed.reward_selections });
  }

  async eligibility(input: unknown, authenticatedCustomerId?: string): Promise<{
    versioned_promotion_ids: number[];
    eligible_promotions: Array<{ promotion_id: number; name: string; saving: number }>;
    ineligible_promotions: PromotionQuote['rejected_candidates'];
  }> {
    const parsed = PromotionEligibilityRequestSchema.parse(input);
    const versionRows = await prisma.promotionRuleVersion.findMany({
      where: { promotionId: { in: parsed.promotion_ids }, status: 'published' },
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

  async quote(input: unknown, authenticatedCustomerId?: string, allowWhenDisabled = false): Promise<PromotionQuote> {
    const startedAt = performance.now();
    const request = PromotionQuoteRequestSchema.parse(input);
    // Explicit selection is also the compatibility bridge used by V1 clients
    // for a campaign that already has a published V2 rule. General automatic
    // V2 evaluation remains protected by the rollout flags.
    if (
      !env.PROMOTIONS_V2_ENABLED &&
      !env.PROMOTIONS_V2_SHADOW &&
      !(request.selected_promotion_ids?.length) &&
      !allowWhenDisabled
    ) {
      throw Object.assign(new Error('Promotions are temporarily unavailable'), { statusCode: 503 });
    }
    if (request.selected_promotion_ids?.length) {
      const selectedIds = [...new Set(request.selected_promotion_ids)];
      const versionedCount = await prisma.promotionRuleVersion.groupBy({
        by: ['promotionId'],
        where: { promotionId: { in: selectedIds }, status: 'published' },
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
      event: 'promotions_v2_quote', mode: env.PROMOTIONS_V2_ENABLED ? 'active' : 'shadow',
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
      select: { id: true, promotionId: true, version: true },
    }) : [];
    const versionIds = new Map(versionRows.map((row) => [`${row.promotionId}:${row.version}`, row.id]));
    await prisma.$transaction(async (tx) => {
      await tx.promotion_evaluations.create({ data: {
        evaluation_id: quote.evaluation_id, user_id: request.customer_id ?? null, cart_data: asJson(request), cart_signature: signature,
        original_total: quote.original_total / 100, discounted_total: quote.payable_total / 100,
        applied_promotions: asJson(quote.applied_promotions), ineligible_coupons: asJson(quote.rejected_candidates),
        context: asJson({ schema_version: 2, channel: request.channel, quote }), created_at: created,
        expires_at: BigInt(Math.floor(new Date(quote.expires_at).getTime() / 1000)), status: 'active', createddate: created, modifieddate: created,
      } });
      if (quote.adjustments.length) await tx.promotionEvaluationAdjustment.createMany({ data: quote.adjustments.map((adjustment) => ({
        id: adjustment.adjustment_id, evaluationId: quote.evaluation_id, promotionId: adjustment.promotion_id,
        promotionRuleVersionId: versionIds.get(`${adjustment.promotion_id}:${adjustment.rule_version}`) ?? null,
        adjustmentType: adjustment.type, cartRecordId: adjustment.cart_record_id ?? null, productId: adjustment.product_id ? BigInt(adjustment.product_id) : null,
        affectedQuantity: adjustment.affected_quantity, amount: adjustment.amount / 100, listAmount: adjustment.list_amount / 100,
        payableAmount: adjustment.payable_amount / 100, sourceProductIds: asJson(adjustment.source_product_ids), metadata: asJson(adjustment.metadata), createdAt: created,
      })) });
    });
  }

  async requoteEvaluation(evaluationId: string, selection?: { promotionId?: number; removePromotionId?: number; giftProductId?: string }, authenticatedCustomerId?: string): Promise<PromotionQuote> {
    const evaluation = await prisma.promotion_evaluations.findUniqueOrThrow({ where: { evaluation_id: evaluationId } });
    if (evaluation.status !== 'active' || evaluation.expires_at < seconds()) throw new Error('Promotion evaluation has expired');
    if (evaluation.user_id && evaluation.user_id !== authenticatedCustomerId) throw Object.assign(new Error('This promotion evaluation belongs to another customer'), { statusCode: 403 });
    const request = PromotionQuoteRequestSchema.parse(evaluation.cart_data);
    const ids = new Set(request.selected_promotion_ids ?? []);
    if (selection?.promotionId) ids.add(selection.promotionId);
    if (selection?.removePromotionId) ids.delete(selection.removePromotionId);
    request.selected_promotion_ids = [...ids];
    if (selection?.promotionId && selection.giftProductId) request.reward_selections = { ...request.reward_selections, [String(selection.promotionId)]: selection.giftProductId };
    return this.quote(request, authenticatedCustomerId, true);
  }
}
