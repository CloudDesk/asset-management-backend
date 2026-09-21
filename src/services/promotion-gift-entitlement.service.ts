import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const now = (): bigint => BigInt(Math.floor(Date.now() / 1000));

type EntitlementRow = {
  id: string;
  order_id: number;
  evaluation_id: string;
  promotion_id: number;
  promotion_rule_version_id: bigint;
  gift_quantity: number;
  reward_mode: string;
  allowed_scope_json: Prisma.JsonValue | null;
  status: string;
  selected_product_id: bigint | null;
  selected_by_user_id: number | null;
  selected_at: bigint | null;
  created_at: bigint;
  modified_at: bigint;
};

const serialize = (row: EntitlementRow) => ({
  ...row,
  promotion_rule_version_id: row.promotion_rule_version_id.toString(),
  selected_product_id: row.selected_product_id?.toString() ?? null,
  selected_at: row.selected_at ? Number(row.selected_at) : null,
  created_at: Number(row.created_at),
  modified_at: Number(row.modified_at),
});

function productMatchesScope(product: { id: bigint; category: string | null; subcategory: string | null }, value: Prisma.JsonValue | null): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const scope = value as { include?: Array<{ facet?: string; values?: string[] }>; exclude?: Array<{ facet?: string; values?: string[] }>; group_operator?: string };
  const normalise = (text: string) => text.trim().toLocaleLowerCase('en-IN');
  const matches = (group: { facet?: string; values?: string[] }) => {
    const expected = new Set((group.values ?? []).map(normalise));
    if (group.facet === 'ENTIRE_CART') return expected.has('*');
    if (group.facet === 'PRODUCT') return expected.has(normalise(product.id.toString()));
    if (group.facet === 'CATEGORY') return product.category ? expected.has(normalise(product.category)) : false;
    if (group.facet === 'SUBCATEGORY') return product.subcategory ? expected.has(normalise(product.subcategory)) : false;
    return false;
  };
  const include = scope.include ?? [];
  const included = scope.group_operator === 'AND' ? include.every(matches) : include.some(matches);
  return included && !(scope.exclude ?? []).some(matches);
}

export class PromotionGiftEntitlementService {
  async listForOrder(orderId: number) {
    const rows = await prisma.$queryRaw<EntitlementRow[]>`
      SELECT * FROM "promotion_gift_entitlements" WHERE "order_id" = ${orderId} ORDER BY "created_at", "id"
    `;
    return rows.map(serialize);
  }

  async eligibleProducts(entitlementId: string, search = '') {
    const rows = await prisma.$queryRaw<EntitlementRow[]>`SELECT * FROM "promotion_gift_entitlements" WHERE "id" = ${entitlementId}`;
    const entitlement = rows[0];
    if (!entitlement) throw Object.assign(new Error('Gift entitlement was not found'), { statusCode: 404 });
    if (entitlement.status !== 'PENDING_PACKING') throw Object.assign(new Error(`Gift entitlement is ${entitlement.status.toLowerCase()}`), { statusCode: 409 });
    const products = await prisma.product.findMany({
      where: {
        productstatus: { notIn: ['inactive', 'deleted'] },
        ...(search.trim() ? { OR: [{ name: { contains: search.trim(), mode: 'insensitive' } }, { puc: { contains: search.trim(), mode: 'insensitive' } }] } : {}),
      },
      include: { platformStocks: { where: { platform: 'nivapp' } } },
      take: 100,
      orderBy: { name: 'asc' },
    });
    return products.filter((product) => productMatchesScope(product, entitlement.allowed_scope_json)).map((product) => ({
      id: product.id.toString(), name: product.name, puc: product.puc, category: product.category, subcategory: product.subcategory,
      available_quantity: product.platformStocks[0]?.availableqty ?? 0,
    }));
  }

  async fulfil(entitlementId: string, productId: string, quantity: number, userId: number) {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<EntitlementRow[]>`SELECT * FROM "promotion_gift_entitlements" WHERE "id" = ${entitlementId} FOR UPDATE`;
      const entitlement = rows[0];
      if (!entitlement) throw Object.assign(new Error('Gift entitlement was not found'), { statusCode: 404 });
      if (entitlement.status === 'FULFILLED' && entitlement.selected_product_id?.toString() === productId) return serialize(entitlement);
      if (entitlement.status !== 'PENDING_PACKING') throw Object.assign(new Error(`Gift entitlement is ${entitlement.status.toLowerCase()}`), { statusCode: 409 });
      if (quantity !== entitlement.gift_quantity) throw Object.assign(new Error(`Gift quantity must equal the entitlement quantity of ${entitlement.gift_quantity}`), { statusCode: 422 });
      const product = await tx.product.findUniqueOrThrow({ where: { id: BigInt(productId) }, include: { platformStocks: { where: { platform: 'nivapp' } } } });
      if (!productMatchesScope(product, entitlement.allowed_scope_json)) throw Object.assign(new Error('Selected product is outside the allowed gift scope'), { statusCode: 422 });
      const platformUpdated = await tx.platformStock.updateMany({
        where: { productid: product.id, platform: 'nivapp', availableqty: { gte: quantity }, platformstatus: { not: 'inactive' } },
        data: { availableqty: { decrement: quantity }, orderedqty: { increment: quantity }, modifieddate: BigInt(Date.now()) },
      });
      if (platformUpdated.count !== 1) throw Object.assign(new Error('Selected gift is out of stock'), { statusCode: 409 });
      const productUpdated = await tx.product.updateMany({ where: { id: product.id, availablequantity: { gte: quantity } }, data: { availablequantity: { decrement: quantity }, orderedquantity: { increment: quantity }, modifieddate: BigInt(Date.now()) } });
      if (productUpdated.count !== 1) throw Object.assign(new Error('Selected gift total stock is unavailable'), { statusCode: 409 });
      const order = await tx.orders.findUniqueOrThrow({ where: { id: entitlement.order_id } });
      const listAmount = Number(product.price ?? 0) * quantity;
      await tx.orderline.create({ data: {
        orderid: order.id, productid: product.id, quantity, userid: order.userid, addressid: order.addressid,
        productamount: listAmount, discountamount: listAmount, orderamount: 0,
        productname: `${product.name} (Surprise Gift)`, productshortname: product.shortname, productcategory: product.category,
        orderstatus: order.orderstatus, uniqueordderid: order.orderid, evaluation_id: entitlement.evaluation_id,
        original_price: Number(product.price ?? 0), promotion_discount_amount: listAmount,
        line_type: 'SURPRISE_GIFT', promotion_id: entitlement.promotion_id, list_unit_price: product.price,
        promotion_unit_discount: Number(product.price ?? 0), is_free_item: true,
        createddate: BigInt(Date.now()), modifieddate: BigInt(Date.now()), ordereddate: BigInt(Date.now()),
        status_history: [{ previous_status: 'pending_packing', new_status: 'gift_selected', changed_date: Date.now(), source: 'promotions', is_active: true }],
      } });
      const selectedAt = now();
      await tx.$executeRaw`
        UPDATE "promotion_gift_entitlements" SET "status" = 'FULFILLED', "selected_product_id" = ${product.id},
          "selected_by_user_id" = ${userId}, "selected_at" = ${selectedAt}, "modified_at" = ${selectedAt}
        WHERE "id" = ${entitlementId}
      `;
      return serialize({ ...entitlement, status: 'FULFILLED', selected_product_id: product.id, selected_by_user_id: userId, selected_at: selectedAt, modified_at: selectedAt });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async removeUnavailable(entitlementId: string) {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<EntitlementRow[]>`SELECT * FROM "promotion_gift_entitlements" WHERE "id" = ${entitlementId} FOR UPDATE`;
      const entitlement = rows[0];
      if (!entitlement) throw Object.assign(new Error('Gift entitlement was not found'), { statusCode: 404 });
      if (entitlement.status === 'REMOVED_OUT_OF_STOCK') return serialize(entitlement);
      if (entitlement.status !== 'PENDING_PACKING') throw Object.assign(new Error(`Gift entitlement is ${entitlement.status.toLowerCase()}`), { statusCode: 409 });
      const products = await tx.product.findMany({
        where: { productstatus: { notIn: ['inactive', 'deleted'] } },
        include: { platformStocks: { where: { platform: 'nivapp', platformstatus: { not: 'inactive' } } } },
      });
      const available = products.some((product) => productMatchesScope(product, entitlement.allowed_scope_json)
        && (product.platformStocks[0]?.availableqty ?? 0) >= entitlement.gift_quantity
        && (product.availablequantity ?? 0) >= entitlement.gift_quantity);
      if (available) throw Object.assign(new Error('An eligible gift is still in stock and must be selected'), { statusCode: 409 });
      const changedAt = now();
      await tx.$executeRaw`
        UPDATE "promotion_gift_entitlements" SET "status" = 'REMOVED_OUT_OF_STOCK', "modified_at" = ${changedAt}
        WHERE "id" = ${entitlementId}
      `;
      return serialize({ ...entitlement, status: 'REMOVED_OUT_OF_STOCK', modified_at: changedAt });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
