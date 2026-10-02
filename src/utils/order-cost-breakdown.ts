export interface PromotionCostBreakdown {
  promotion_id: number | null;
  promotion_name: string;
  coupon_code: string | null;
  discount_type: string;
  merchandise_discount: number;
  free_item_discount: number;
  shipping_discount: number;
  discount_amount: number;
}

export interface OrderCostBreakdown {
  original_cart_value: number;
  promotions: PromotionCostBreakdown[];
  product_discount: number;
  promotion_discount: number;
  free_item_discount: number;
  shipping_discount: number;
  total_discount: number;
  taxes: number;
  delivery_charges: number;
  final_payable_amount: number;
}

export interface LinePromotionBreakdown {
  promotion_id: number | null;
  promotion_name: string;
  coupon_code: string | null;
  discount_type: string;
  discount_amount: number;
  allocation_method: 'EXACT' | 'PROPORTIONAL';
}

type BreakdownOrder = {
  orderamount?: unknown;
  productamount?: unknown;
  discountamount?: unknown;
  promotion_discount_total?: unknown;
  wallet_discount_total?: unknown;
  original_total?: unknown;
  shipping_cost?: unknown;
  tax_amount?: unknown;
  total_gst_amount?: unknown;
};

type BreakdownOrderline = {
  id?: unknown;
  productid?: unknown;
  original_price?: unknown;
  quantity?: unknown;
  product_discount_amount?: unknown;
  promotion_discount_amount?: unknown;
  promotion_adjustment_id?: unknown;
};

type BreakdownRedemption = {
  promotion_id?: number | null;
  discount_amount?: unknown;
  voucher_code?: string | null;
  redemption_data?: unknown;
  promotion?: { name?: string | null; type?: string | null; code?: string | null } | null;
};

type BreakdownAdjustment = {
  id?: unknown;
  promotionId: number;
  adjustmentType: string;
  productId?: unknown;
  amount: unknown;
  metadata?: unknown;
  promotion?: { name?: string | null; type?: string | null; code?: string | null } | null;
};

type BreakdownEvaluation = {
  applied_promotions?: unknown;
  adjustments?: BreakdownAdjustment[];
};

const amount = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const moneyToCents = (value: unknown): number =>
  Math.round(amount(value) * 100);

const record = (value: unknown): Record<string, any> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : null;

const classifyLegacyDiscount = (promotionType: string, discount: number) => {
  const normalized = promotionType.toUpperCase();
  if (normalized.includes('SHIPPING')) {
    return { merchandise: 0, freeItem: 0, shipping: discount };
  }
  if (normalized.includes('FREE_PRODUCT') || normalized.includes('FREE_ITEM') || normalized.includes('BOGO')) {
    return { merchandise: 0, freeItem: discount, shipping: 0 };
  }
  return { merchandise: discount, freeItem: 0, shipping: 0 };
};

type AllocationRow = {
  id: number;
  cents: number;
};

type AllocationColumn = {
  promotion: PromotionCostBreakdown;
  cents: number;
};

const appendLineBreakdown = (
  result: Map<number, LinePromotionBreakdown[]>,
  lineId: number,
  promotion: PromotionCostBreakdown,
  cents: number,
  allocationMethod: LinePromotionBreakdown['allocation_method'],
) => {
  if (cents <= 0) return;
  const values = result.get(lineId) ?? [];
  const existing = values.find((value) =>
    value.promotion_id === promotion.promotion_id
    && value.allocation_method === allocationMethod
  );
  if (existing) {
    existing.discount_amount = (moneyToCents(existing.discount_amount) + cents) / 100;
  } else {
    values.push({
      promotion_id: promotion.promotion_id,
      promotion_name: promotion.promotion_name,
      coupon_code: promotion.coupon_code,
      discount_type: promotion.discount_type,
      discount_amount: cents / 100,
      allocation_method: allocationMethod,
    });
  }
  result.set(lineId, values);
};

/**
 * Allocates promotion columns across line capacities, preserving both totals to
 * the cent. This is the compatibility path for legacy promotions that do not
 * have product-targeted V2 adjustment rows.
 */
const allocateProportionally = (
  rows: AllocationRow[],
  columns: AllocationColumn[],
  result: Map<number, LinePromotionBreakdown[]>,
) => {
  if (rows.length === 0 || columns.length === 0) return;

  const rowTotal = rows.reduce((sum, row) => sum + row.cents, 0);
  const columnTotal = columns.reduce((sum, column) => sum + column.cents, 0);
  if (rowTotal <= 0 || columnTotal <= 0) return;

  // Normalize promotion targets to the available line total when legacy values
  // differ by a rounding cent. The final column receives the exact remainder.
  let normalizedRemaining = rowTotal;
  const normalizedColumns = columns.map((column, index) => {
    const cents = index === columns.length - 1
      ? normalizedRemaining
      : Math.min(
        normalizedRemaining,
        Math.round((column.cents / columnTotal) * rowTotal),
      );
    normalizedRemaining -= cents;
    return { ...column, cents };
  });

  const rowRemaining = rows.map((row) => row.cents);
  let capacityRemaining = rowTotal;

  normalizedColumns.forEach((column, columnIndex) => {
    let allocations: number[];
    if (columnIndex === normalizedColumns.length - 1) {
      allocations = [...rowRemaining];
    } else {
      const exact = rowRemaining.map((capacity) =>
        capacityRemaining > 0 ? (column.cents * capacity) / capacityRemaining : 0
      );
      allocations = exact.map((value, rowIndex) =>
        Math.min(rowRemaining[rowIndex] ?? 0, Math.floor(value))
      );
      let remainder = column.cents - allocations.reduce((sum, value) => sum + value, 0);
      const priority = exact
        .map((value, rowIndex) => ({ rowIndex, fraction: value - Math.floor(value) }))
        .sort((left, right) => right.fraction - left.fraction || left.rowIndex - right.rowIndex);

      while (remainder > 0) {
        let allocatedInPass = false;
        for (const { rowIndex } of priority) {
          if (remainder === 0) break;
          const allocated = allocations[rowIndex] ?? 0;
          const capacity = rowRemaining[rowIndex] ?? 0;
          if (allocated < capacity) {
            allocations[rowIndex] = allocated + 1;
            remainder -= 1;
            allocatedInPass = true;
          }
        }
        if (!allocatedInPass) break;
      }
    }

    allocations.forEach((allocatedCents, rowIndex) => {
      if (allocatedCents <= 0) return;
      const row = rows[rowIndex];
      if (!row) return;
      appendLineBreakdown(result, row.id, column.promotion, allocatedCents, 'PROPORTIONAL');
      rowRemaining[rowIndex] = (rowRemaining[rowIndex] ?? 0) - allocatedCents;
    });
    capacityRemaining -= column.cents;
  });
};

/**
 * Uses persisted V2 adjustment product IDs for an exact per-line breakdown.
 * Promotions without usable V2 targeting retain the legacy proportional split,
 * so old orders remain readable without a migration or data rewrite.
 */
export function buildLinePromotionBreakdowns(
  orderlines: BreakdownOrderline[],
  promotions: PromotionCostBreakdown[],
  evaluations: BreakdownEvaluation[] = [],
): Map<number, LinePromotionBreakdown[]> {
  const rows = orderlines
    .map((line) => ({
      id: Number(line.id),
      productId: line.productid === null || line.productid === undefined
        ? null
        : String(line.productid),
      promotionAdjustmentId: line.promotion_adjustment_id === null || line.promotion_adjustment_id === undefined
        ? null
        : String(line.promotion_adjustment_id),
      cents: moneyToCents(line.promotion_discount_amount),
    }))
    .filter((line) => Number.isFinite(line.id) && line.cents > 0);
  const promotionById = new Map(promotions
    .filter((promotion) => promotion.promotion_id !== null)
    .map((promotion) => [Number(promotion.promotion_id), promotion]));
  const allColumns = promotions
    .map((promotion) => ({
      promotion,
      cents: moneyToCents(promotion.merchandise_discount + promotion.free_item_discount),
    }))
    .filter((column) => column.cents > 0);

  const result = new Map<number, LinePromotionBreakdown[]>();
  if (rows.length === 0 || allColumns.length === 0) return result;

  const rowsByProductId = new Map<string, typeof rows>();
  const rowByAdjustmentId = new Map<string, typeof rows[number]>();
  const remainingByLineId = new Map(rows.map((row) => [row.id, row.cents]));
  for (const row of rows) {
    if (row.productId) {
      const matchingRows = rowsByProductId.get(row.productId) ?? [];
      matchingRows.push(row);
      rowsByProductId.set(row.productId, matchingRows);
    }
    if (row.promotionAdjustmentId) rowByAdjustmentId.set(row.promotionAdjustmentId, row);
  }

  const exactPromotionIds = new Set<number>();
  for (const evaluation of evaluations) {
    for (const adjustment of evaluation.adjustments ?? []) {
      const promotionId = Number(adjustment.promotionId);
      const promotion = promotionById.get(promotionId);
      const adjustmentType = String(adjustment.adjustmentType || '').toUpperCase();
      if (!promotion || adjustmentType === 'FREE_SHIPPING') continue;

      const adjustmentId = adjustment.id === null || adjustment.id === undefined
        ? null
        : String(adjustment.id);
      const productId = adjustment.productId === null || adjustment.productId === undefined
        ? null
        : String(adjustment.productId);
      const linkedGiftRow = adjustmentId ? rowByAdjustmentId.get(adjustmentId) : undefined;
      const candidateRows = linkedGiftRow
        ? [linkedGiftRow]
        : productId
          ? rowsByProductId.get(productId) ?? []
          : [];
      if (candidateRows.length === 0) continue;

      let adjustmentRemaining = moneyToCents(adjustment.amount);
      let allocated = 0;
      for (const row of candidateRows) {
        if (adjustmentRemaining <= 0) break;
        const capacity = remainingByLineId.get(row.id) ?? 0;
        const lineAllocation = Math.min(capacity, adjustmentRemaining);
        if (lineAllocation <= 0) continue;
        appendLineBreakdown(result, row.id, promotion, lineAllocation, 'EXACT');
        remainingByLineId.set(row.id, capacity - lineAllocation);
        adjustmentRemaining -= lineAllocation;
        allocated += lineAllocation;
      }
      if (allocated > 0) exactPromotionIds.add(promotionId);
    }
  }

  const fallbackRows = rows
    .map((row) => ({ id: row.id, cents: remainingByLineId.get(row.id) ?? 0 }))
    .filter((row) => row.cents > 0);
  const fallbackColumns = allColumns.filter((column) =>
    column.promotion.promotion_id === null
    || !exactPromotionIds.has(Number(column.promotion.promotion_id))
  );
  allocateProportionally(fallbackRows, fallbackColumns, result);

  return result;
}

export function buildOrderCostBreakdown(
  order: BreakdownOrder,
  orderlines: BreakdownOrderline[],
  redemptions: BreakdownRedemption[],
  evaluations: BreakdownEvaluation[],
): OrderCostBreakdown {
  const promotionRows = new Map<number, PromotionCostBreakdown>();
  const evaluationPromotionSnapshots = new Map<number, Record<string, any>>();

  for (const evaluation of evaluations) {
    if (!Array.isArray(evaluation.applied_promotions)) continue;
    for (const rawPromotion of evaluation.applied_promotions) {
      const promotion = record(rawPromotion);
      const promotionId = Number(promotion?.promotion_id);
      if (promotion && Number.isFinite(promotionId)) {
        evaluationPromotionSnapshots.set(promotionId, promotion);
      }
    }
  }

  const ensureRow = (
    promotionId: number,
    source?: { name?: string | null; type?: string | null; code?: string | null } | null,
    redemptionData?: Record<string, any> | null,
    voucherCode?: string | null,
  ) => {
    const snapshot = evaluationPromotionSnapshots.get(promotionId);
    const existing = promotionRows.get(promotionId);
    if (existing) return existing;
    const row: PromotionCostBreakdown = {
      promotion_id: promotionId,
      promotion_name: String(
        redemptionData?.promotion_name ??
        snapshot?.promotion_name ??
        snapshot?.name ??
        source?.name ??
        `Promotion #${promotionId}`
      ),
      coupon_code: String(
        voucherCode ??
        redemptionData?.voucher_code ??
        snapshot?.voucher_code ??
        snapshot?.code ??
        source?.code ??
        ''
      ) || null,
      discount_type: String(snapshot?.promotion_type ?? source?.type ?? 'PROMOTION'),
      merchandise_discount: 0,
      free_item_discount: 0,
      shipping_discount: 0,
      discount_amount: 0,
    };
    promotionRows.set(promotionId, row);
    return row;
  };

  for (const redemption of redemptions) {
    const promotionId = Number(redemption.promotion_id);
    if (!Number.isFinite(promotionId)) continue;
    const redemptionData = record(redemption.redemption_data);
    const row = ensureRow(
      promotionId,
      redemption.promotion,
      redemptionData,
      redemption.voucher_code,
    );
    const discount = amount(redemption.discount_amount);
    const classified = classifyLegacyDiscount(row.discount_type, discount);
    row.merchandise_discount = classified.merchandise;
    row.free_item_discount = classified.freeItem;
    row.shipping_discount = classified.shipping;
    row.discount_amount = discount;
  }

  const promotionIdsWithAdjustments = new Set<number>();
  for (const evaluation of evaluations) {
    for (const adjustment of evaluation.adjustments ?? []) {
      const promotionId = Number(adjustment.promotionId);
      if (!Number.isFinite(promotionId)) continue;
      const isFirstAdjustment = !promotionIdsWithAdjustments.has(promotionId);
      promotionIdsWithAdjustments.add(promotionId);
      const row = ensureRow(promotionId, adjustment.promotion);
      if (isFirstAdjustment) {
        row.merchandise_discount = 0;
        row.free_item_discount = 0;
        row.shipping_discount = 0;
        row.discount_amount = 0;
      }
      const adjustmentAmount = amount(adjustment.amount);
      const adjustmentType = String(adjustment.adjustmentType || 'PROMOTION').toUpperCase();
      if (adjustmentType === 'FREE_SHIPPING') {
        row.shipping_discount += adjustmentAmount;
      } else if (adjustmentType === 'FREE_ITEM') {
        row.free_item_discount += adjustmentAmount;
      } else {
        row.merchandise_discount += adjustmentAmount;
      }
      row.discount_type = row.discount_type === 'PROMOTION'
        ? adjustmentType
        : row.discount_type;
    }
  }

  for (const promotionId of promotionIdsWithAdjustments) {
    const row = promotionRows.get(promotionId)!;
    row.merchandise_discount = roundMoney(row.merchandise_discount);
    row.free_item_discount = roundMoney(row.free_item_discount);
    row.shipping_discount = roundMoney(row.shipping_discount);
    row.discount_amount = roundMoney(
      row.merchandise_discount + row.free_item_discount + row.shipping_discount
    );
  }

  const persistedPromotionDiscount = amount(order.promotion_discount_total);
  if (promotionRows.size === 0 && persistedPromotionDiscount > 0) {
    promotionRows.set(-1, {
      promotion_id: null,
      promotion_name: 'Promotion discount',
      coupon_code: null,
      discount_type: 'LEGACY_COMBINED',
      merchandise_discount: persistedPromotionDiscount,
      free_item_discount: 0,
      shipping_discount: 0,
      discount_amount: persistedPromotionDiscount,
    });
  }

  const promotions = [...promotionRows.values()]
    .map((row) => ({
      ...row,
      merchandise_discount: roundMoney(row.merchandise_discount),
      free_item_discount: roundMoney(row.free_item_discount),
      shipping_discount: roundMoney(row.shipping_discount),
      discount_amount: roundMoney(row.discount_amount),
    }))
    .filter((row) => row.discount_amount > 0)
    .sort((left, right) => (left.promotion_id ?? Number.MAX_SAFE_INTEGER) - (right.promotion_id ?? Number.MAX_SAFE_INTEGER));

  const lineProductDiscount = orderlines.reduce(
    (total, line) => total + amount(line.product_discount_amount),
    0,
  );
  const combinedDiscount = amount(order.discountamount);
  const productDiscount = lineProductDiscount > 0
    ? lineProductDiscount
    : Math.max(0, combinedDiscount - persistedPromotionDiscount);
  const merchandisePromotionDiscount = promotions.reduce((total, row) => total + row.merchandise_discount, 0);
  const freeItemDiscount = promotions.reduce((total, row) => total + row.free_item_discount, 0);
  const shippingDiscount = promotions.reduce((total, row) => total + row.shipping_discount, 0);
  const detailedPromotionDiscount = merchandisePromotionDiscount + freeItemDiscount + shippingDiscount;
  const promotionDiscount = detailedPromotionDiscount > 0
    ? detailedPromotionDiscount
    : persistedPromotionDiscount;
  const originalFromLines = orderlines.reduce(
    (total, line) => total + amount(line.original_price) * Math.max(1, amount(line.quantity)),
    0,
  );

  return {
    original_cart_value: roundMoney(amount(order.original_total) || originalFromLines || amount(order.productamount)),
    promotions,
    product_discount: roundMoney(productDiscount),
    promotion_discount: roundMoney(promotionDiscount),
    free_item_discount: roundMoney(freeItemDiscount),
    shipping_discount: roundMoney(shippingDiscount),
    total_discount: roundMoney(productDiscount + promotionDiscount),
    taxes: roundMoney(amount(order.total_gst_amount) || amount(order.tax_amount)),
    delivery_charges: roundMoney(amount(order.shipping_cost)),
    final_payable_amount: roundMoney(amount(order.orderamount)),
  };
}
