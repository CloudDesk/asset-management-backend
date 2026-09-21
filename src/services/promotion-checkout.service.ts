import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';

const prisma = new PrismaClient();
const epoch = (): bigint => BigInt(Math.floor(Date.now() / 1000));

type QuoteSnapshot = {
  schema_version?: number;
  payable_total?: number;
  adjustments?: Array<{ adjustment_id: string; promotion_id: number; type: string; product_id?: string; affected_quantity: number; list_amount: number; amount: number; source_product_ids?: string[]; metadata?: Record<string, unknown> }>;
  gift_entitlements?: Array<{ promotion_id: number; rule_version: number; gift_quantity: number; reward_mode: string; allowed_scope: unknown; status: string }>;
};

type StoredCartRequest = {
  cart_items?: Array<{ product_id: string; quantity: number }>;
  shipping_amount?: number;
};

export class PromotionCheckoutService {
  async commitEvaluationToOrder(orderId: number, evaluationId: string, customerId?: number): Promise<{ gift_orderline_ids: number[]; promotion_ids: number[] }> {
    const [snapshotSupport] = await prisma.$queryRaw<Array<{ supported: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'promotion_evaluations'
          AND column_name = 'rule_snapshots'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'orders'
          AND column_name = 'promotion_rule_snapshots'
      ) AS supported
    `;
    const snapshotColumnsAvailable = snapshotSupport?.supported === true;
    return prisma.$transaction(async (tx) => {
      const evaluation = await tx.promotion_evaluations.findUniqueOrThrow({
        where: { evaluation_id: evaluationId },
        select: {
          status: true,
          order_id: true,
          expires_at: true,
          user_id: true,
          context: true,
          cart_data: true,
          original_total: true,
          ...(snapshotColumnsAvailable ? { rule_snapshots: true } : {}),
        },
      });
      if (evaluation.status === 'redeemed' && evaluation.order_id === orderId) {
        const existing = await tx.orderline.findMany({ where: { orderid: orderId, evaluation_id: evaluationId, is_free_item: true }, select: { id: true, promotion_id: true } });
        return { gift_orderline_ids: existing.map((line) => line.id), promotion_ids: [...new Set(existing.flatMap((line) => line.promotion_id ?? []))] };
      }
      if (evaluation.status !== 'active' || evaluation.expires_at < epoch()) throw new Error('Promotion quote expired before checkout');
      if (evaluation.user_id && String(customerId ?? '') !== evaluation.user_id) throw new Error('Promotion quote customer does not match the order customer');
      if (evaluation.order_id && evaluation.order_id !== orderId) throw new Error('Promotion quote has already been used by another order');

      const order = await tx.orders.findUniqueOrThrow({
        where: { id: orderId },
        select: { id: true, userid: true, addressid: true, orderstatus: true, orderid: true },
      });
      const context = (evaluation.context && typeof evaluation.context === 'object' ? evaluation.context : {}) as Prisma.JsonObject;
      const quote = ((context.quote && typeof context.quote === 'object') ? context.quote : {}) as QuoteSnapshot;
      if (![2, 3].includes(quote.schema_version ?? 0)) throw new Error('This promotion evaluation cannot be committed to an order');

      const storedAdjustments = await tx.promotionEvaluationAdjustment.findMany({ where: { evaluationId } });
      const adjustments = storedAdjustments.length ? storedAdjustments : [];
      const giftLineIds: number[] = [];
      const promotionIds = new Set<number>();
      const normalLines = await tx.orderline.findMany({ where: { orderid: orderId, is_free_item: false } });
      const cart = (evaluation.cart_data && typeof evaluation.cart_data === 'object' ? evaluation.cart_data : {}) as StoredCartRequest;
      const expectedQuantities = new Map((cart.cart_items ?? []).map((item) => [String(item.product_id), item.quantity]));
      const actualQuantities = new Map<string, number>();
      for (const line of normalLines) if (line.productid) actualQuantities.set(line.productid.toString(), (actualQuantities.get(line.productid.toString()) ?? 0) + (line.quantity ?? 1));
      if (expectedQuantities.size !== actualQuantities.size || [...expectedQuantities].some(([id, quantity]) => actualQuantities.get(id) !== quantity)) {
        throw new Error('Cart changed after the promotion quote was created');
      }
      const products = await tx.product.findMany({ where: { id: { in: [...expectedQuantities.keys()].map(BigInt) } }, select: { id: true, price: true, discount: true, productstatus: true } });
      if (products.length !== expectedQuantities.size || products.some((product) => ['inactive', 'deleted'].includes((product.productstatus ?? '').toLowerCase()))) {
        throw new Error('A quoted product is no longer available');
      }
      const currentMerchandisePaise = products.reduce((sum, product) => {
        const discounted = Math.max(0, Number(product.price ?? 0) - Math.max(0, Number(product.discount ?? 0)));
        return sum + Math.round(discounted * 100) * (expectedQuantities.get(product.id.toString()) ?? 0);
      }, 0);
      const autoGiftListPaise = (quote.adjustments ?? []).filter((item) =>
        item.type === 'FREE_ITEM' &&
        item.metadata?.fulfilment === 'AUTO_ADD' &&
        (!Object.prototype.hasOwnProperty.call(item.metadata, 'added_quantity') || Number(item.metadata.added_quantity) > 0)
      ).reduce((sum, item) => sum + item.list_amount, 0);
      if (quote.payable_total === undefined || evaluation.original_total === null || Math.round(Number(evaluation.original_total) * 100) !== currentMerchandisePaise + (cart.shipping_amount ?? 0) + autoGiftListPaise) {
        throw new Error('Prices changed after the promotion quote was created');
      }

      const normalAdjustments = adjustments.filter((item) => item.adjustmentType === 'PERCENT_DISCOUNT' || item.adjustmentType === 'FIXED_AMOUNT_DISCOUNT'
        || item.adjustmentType === 'ITEM_PERCENTAGE_DISCOUNT' || item.adjustmentType === 'ITEM_FIXED_DISCOUNT'
        || (item.adjustmentType === 'FREE_ITEM' && (
          (item.metadata as Prisma.JsonObject | null)?.fulfilment === 'DISCOUNT_EXISTING' ||
          ((item.metadata as Prisma.JsonObject | null)?.fulfilment === 'AUTO_ADD' &&
            Object.prototype.hasOwnProperty.call((item.metadata as Prisma.JsonObject | null) ?? {}, 'added_quantity') &&
            Number((item.metadata as Prisma.JsonObject).added_quantity) === 0)
        )));
      for (const line of normalLines) {
        if (!line.productid) continue;
        const lineAdjustments = normalAdjustments.filter((item) => item.productId === line.productid);
        const promotionDiscount = lineAdjustments.reduce((sum, item) => sum + Number(item.amount), 0);
        const linePromotionIds = [...new Set(lineAdjustments.map((item) => item.promotionId))];
        const product = products.find((item) => item.id === line.productid)!;
        const quantity = line.quantity ?? 1;
        const listTotal = Number(product.price ?? 0) * quantity;
        const productDiscount = Math.max(0, Number(product.discount ?? 0)) * quantity;
        await tx.orderline.update({ where: { id: line.id }, data: {
          promotion_discount_amount: promotionDiscount,
          productamount: listTotal,
          product_discount_amount: productDiscount,
          discountamount: productDiscount + promotionDiscount,
          orderamount: Math.max(0, listTotal - productDiscount - promotionDiscount),
          promotion: linePromotionIds.length === 1 ? { connect: { id: linePromotionIds[0]! } } : { disconnect: true },
        } });
      }

      for (const adjustment of adjustments) {
        promotionIds.add(adjustment.promotionId);
        if (adjustment.adjustmentType !== 'FREE_ITEM' || !adjustment.productId) continue;
        const metadata = (adjustment.metadata && typeof adjustment.metadata === 'object' ? adjustment.metadata : {}) as Prisma.JsonObject;
        if (metadata.fulfilment !== 'AUTO_ADD') continue;
        if (Object.prototype.hasOwnProperty.call(metadata, 'added_quantity') && Number(metadata.added_quantity) <= 0) continue;
        const quantity = adjustment.affectedQuantity;
        const stockUpdated = await tx.platformStock.updateMany({
          where: { productid: adjustment.productId, platform: 'nivapp', availableqty: { gte: quantity } },
          data: { availableqty: { decrement: quantity }, orderedqty: { increment: quantity }, modifieddate: BigInt(Date.now()) },
        });
        if (stockUpdated.count !== 1) throw new Error(`Promotional gift ${adjustment.productId.toString()} is out of stock`);
        const productUpdated = await tx.product.updateMany({
          where: { id: adjustment.productId, availablequantity: { gte: quantity } },
          data: { availablequantity: { decrement: quantity }, orderedquantity: { increment: quantity }, modifieddate: BigInt(Date.now()) },
        });
        if (productUpdated.count !== 1) throw new Error(`Promotional gift ${adjustment.productId.toString()} total stock is unavailable`);
        const product = await tx.product.findUniqueOrThrow({ where: { id: adjustment.productId }, select: { name: true, shortname: true, category: true } });
        const sources = Array.isArray(adjustment.sourceProductIds) ? adjustment.sourceProductIds.map(String) : [];
        const parent = normalLines.find((line) => line.productid && sources.includes(line.productid.toString()));
        const listUnitPrice = Number(adjustment.listAmount ?? adjustment.amount) / Math.max(1, quantity);
        const created = await tx.orderline.create({ data: {
          orderid: orderId, productid: adjustment.productId, quantity, userid: order.userid, addressid: order.addressid,
          productamount: adjustment.listAmount ?? adjustment.amount, discountamount: adjustment.amount, orderamount: 0,
          productname: `${product.name} (Promotional Gift)`, productshortname: product.shortname, productcategory: product.category,
          orderstatus: order.orderstatus, uniqueordderid: order.orderid, evaluation_id: evaluationId,
          original_price: listUnitPrice, promotion_discount_amount: adjustment.amount,
          line_type: 'PROMOTIONAL_GIFT', promotion_id: adjustment.promotionId, promotion_adjustment_id: adjustment.id,
          parent_orderline_id: parent?.id ?? null, list_unit_price: listUnitPrice,
          promotion_unit_discount: Number(adjustment.amount) / Math.max(1, quantity), is_free_item: true,
          createddate: BigInt(Date.now()), modifieddate: BigInt(Date.now()), ordereddate: BigInt(Date.now()),
          status_history: [{ previous_status: 'order_placed', new_status: order.orderstatus ?? 'order_confirmed', changed_date: Date.now(), source: 'promotions_v2', is_active: true }],
        } });
        giftLineIds.push(created.id);
      }

      const evaluationSnapshots = (evaluation as typeof evaluation & { rule_snapshots?: Prisma.JsonValue }).rule_snapshots;
      const snapshots = Array.isArray(evaluationSnapshots) ? evaluationSnapshots as Array<{ promotion_id?: unknown; rule_version_id?: unknown }> : [];
      for (const entitlement of quote.gift_entitlements ?? []) {
        const snapshot = snapshots.find((item) => Number(item.promotion_id) === entitlement.promotion_id);
        if (!snapshot?.rule_version_id) throw new Error(`Promotion ${entitlement.promotion_id} is missing its immutable rule snapshot`);
        promotionIds.add(entitlement.promotion_id);
        const entitlementId = randomUUID();
        const allowedScope = JSON.stringify(entitlement.allowed_scope ?? null);
        await tx.$executeRaw`
          INSERT INTO "promotion_gift_entitlements" (
            "id", "order_id", "evaluation_id", "promotion_id", "promotion_rule_version_id",
            "gift_quantity", "reward_mode", "allowed_scope_json", "status", "created_at", "modified_at"
          ) VALUES (
            ${entitlementId}, ${orderId}, ${evaluationId}, ${entitlement.promotion_id}, ${BigInt(String(snapshot.rule_version_id))},
            ${entitlement.gift_quantity}, ${entitlement.reward_mode}, ${allowedScope}::jsonb, 'PENDING_PACKING', ${epoch()}, ${epoch()}
          )
          ON CONFLICT ("evaluation_id", "promotion_id") DO NOTHING
        `;
      }

      for (const promotionId of promotionIds) {
        const amount = adjustments.filter((item) => item.promotionId === promotionId).reduce((sum, item) => sum + Number(item.amount), 0);
        const promotion = await tx.promotions.findUniqueOrThrow({ where: { id: promotionId }, select: { max_redemptions: true, per_user_limit: true, budget: true } });
        const [campaignUsage, customerUsage] = await Promise.all([
          tx.promotion_redemptions.aggregate({ where: { promotion_id: promotionId }, _count: { _all: true }, _sum: { discount_amount: true } }),
          evaluation.user_id ? tx.promotion_redemptions.count({ where: { promotion_id: promotionId, user_id: evaluation.user_id } }) : Promise.resolve(0),
        ]);
        if (promotion.max_redemptions && campaignUsage._count._all >= promotion.max_redemptions) throw new Error(`Promotion ${promotionId} usage limit was reached`);
        if (promotion.per_user_limit && customerUsage >= promotion.per_user_limit) throw new Error(`Promotion ${promotionId} customer usage limit was reached`);
        if (promotion.budget && Number(campaignUsage._sum.discount_amount ?? 0) + amount > Number(promotion.budget)) throw new Error(`Promotion ${promotionId} budget was exhausted`);
        await tx.promotion_redemptions.create({ data: {
          id: randomUUID(), evaluation_id: evaluationId, order_id: order.orderid, user_id: evaluation.user_id,
          promotion_id: promotionId, discount_amount: amount, redeemed_at: epoch(),
          redemption_data: { schema_version: 2, adjustment_ids: adjustments.filter((item) => item.promotionId === promotionId).map((item) => item.id) },
          createddate: epoch(), modifieddate: epoch(),
        } });
      }
      const merchandisePromotionTotal = adjustments.filter((item) => item.adjustmentType !== 'FREE_SHIPPING').reduce((sum, item) => sum + Number(item.amount), 0);
      await tx.orders.update({
        where: { id: orderId },
        data: {
          evaluation_id: evaluationId,
          promotion_discount_total: merchandisePromotionTotal,
          ...(snapshotColumnsAvailable ? { promotion_rule_snapshots: evaluationSnapshots ?? Prisma.JsonNull } : {}),
        },
        select: { id: true },
      });
      await tx.promotion_evaluations.update({
        where: { evaluation_id: evaluationId },
        data: { status: 'redeemed', order_id: orderId, modifieddate: epoch() },
        select: { evaluation_id: true },
      });
      return { gift_orderline_ids: giftLineIds, promotion_ids: [...promotionIds] };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error) => {
      logger.error({
        event: 'promotions_v2_redemption_failed', orderId, evaluationId,
        reason: error instanceof Error ? error.message : String(error),
      }, 'Promotions V2 checkout commit failed');
      throw error;
    });
  }
}
