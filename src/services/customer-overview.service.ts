import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { OrdersService } from './orders.service.js';

const money = (value: Prisma.Decimal | number | string | null | undefined) =>
  Math.round(Number(value ?? 0) * 100) / 100;

const toNumberOrNull = (value: bigint | number | null | undefined) =>
  value === null || value === undefined ? null : Number(value);

/**
 * Read-only "customer 360" figures for the Inventory customer detail page.
 *
 * Order totals reuse OrdersService.getOrderSummaryByUserId so revenue matches
 * the storefront: paid amount on non-cancelled orders minus completed return
 * refunds, replacement orders excluded. Every other figure follows the same
 * order scope.
 */
export class CustomerOverviewService {
  private ordersService = new OrdersService();

  async getOverview(userId: number) {
    const userIdText = String(userId);
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    const nowMs = BigInt(Date.now());

    const [
      summary,
      orderDates,
      returnRequests,
      topCategories,
      topProducts,
      promotions,
      walletCredits,
      groups,
    ] = await Promise.all([
      this.ordersService.getOrderSummaryByUserId(userId),
      prisma.$queryRaw<Array<{ first_order: bigint | null; last_order: bigint | null }>>`
        SELECT MIN(o.createddate) AS first_order, MAX(o.createddate) AS last_order
        FROM orders o
        WHERE o.userid = ${userId}
          AND LOWER(COALESCE(o.mode, '')) <> 'replacement'
          AND COALESCE(o.orderid, '') NOT LIKE 'REP-REP-%'
      `,
      prisma.$queryRaw<Array<{ total: number }>>`
        SELECT COUNT(*)::int AS total
        FROM return_requests rr
        LEFT JOIN orders o ON o.id = rr.orderid
        WHERE (rr.customerid = ${userId} OR o.userid = ${userId})
          AND LOWER(COALESCE(rr.status, '')) NOT IN ('rejected', 'cancelled')
      `,
      prisma.$queryRaw<Array<{ category: string | null; quantity: number; revenue: Prisma.Decimal | null }>>`
        SELECT ol.productcategory AS category,
               SUM(COALESCE(ol.quantity, 0))::int AS quantity,
               SUM(COALESCE(ol.orderamount, 0)) AS revenue
        FROM orderline ol
        JOIN orders o ON o.id = ol.orderid
        WHERE o.userid = ${userId}
          AND LOWER(COALESCE(o.orderstatus, '')) NOT LIKE '%cancel%'
          AND LOWER(COALESCE(o.mode, '')) <> 'replacement'
          AND LOWER(COALESCE(ol.orderstatus, '')) NOT LIKE '%cancel%'
          AND LOWER(COALESCE(ol.orderstatus, '')) NOT LIKE '%return%'
          AND COALESCE(ol.is_free_item, false) = false
        GROUP BY ol.productcategory
        ORDER BY revenue DESC NULLS LAST
        LIMIT 5
      `,
      prisma.$queryRaw<Array<{ productid: bigint | null; name: string | null; quantity: number; revenue: Prisma.Decimal | null; orders: number }>>`
        SELECT ol.productid,
               MAX(COALESCE(NULLIF(TRIM(ol.productshortname), ''), ol.productname)) AS name,
               SUM(COALESCE(ol.quantity, 0))::int AS quantity,
               SUM(COALESCE(ol.orderamount, 0)) AS revenue,
               COUNT(DISTINCT ol.orderid)::int AS orders
        FROM orderline ol
        JOIN orders o ON o.id = ol.orderid
        WHERE o.userid = ${userId}
          AND LOWER(COALESCE(o.orderstatus, '')) NOT LIKE '%cancel%'
          AND LOWER(COALESCE(o.mode, '')) <> 'replacement'
          AND LOWER(COALESCE(ol.orderstatus, '')) NOT LIKE '%cancel%'
          AND LOWER(COALESCE(ol.orderstatus, '')) NOT LIKE '%return%'
          AND COALESCE(ol.is_free_item, false) = false
        GROUP BY ol.productid
        ORDER BY quantity DESC, revenue DESC NULLS LAST
        LIMIT 5
      `,
      // promotion_redemptions.order_id holds the order number (older rows the
      // numeric id); only redemptions on non-cancelled orders count as used.
      prisma.$queryRaw<Array<{ promotion_id: number | null; name: string | null; codes: string[] | null; times_used: number; saved: Prisma.Decimal | null }>>`
        SELECT pr.promotion_id,
               MAX(p.name) AS name,
               ARRAY_REMOVE(ARRAY_AGG(DISTINCT pr.voucher_code), NULL) AS codes,
               COUNT(DISTINCT o.id)::int AS times_used,
               SUM(COALESCE(pr.discount_amount, 0)) AS saved
        FROM promotion_redemptions pr
        JOIN orders o ON (o.orderid = pr.order_id OR o.id::text = pr.order_id)
        LEFT JOIN promotions p ON p.id = pr.promotion_id
        WHERE pr.user_id = ${userIdText}
          AND o.userid = ${userId}
          AND LOWER(COALESCE(o.orderstatus, '')) NOT LIKE '%cancel%'
        GROUP BY pr.promotion_id
        ORDER BY saved DESC NULLS LAST
      `,
      prisma.wallet_credits.findMany({
        where: { customer_id: userId },
        include: {
          reservations: {
            where: { status: 'reserved', expires_at: { gt: nowMs } },
            select: { amount: true },
          },
        },
        orderBy: { id: 'desc' },
      }),
      prisma.customer_group_members.findMany({
        where: { customer_id: userId, status: 'active', customer_group: { status: 'active' } },
        select: { customer_group: { select: { id: true, name: true, code: true } } },
      }),
    ]);

    // Same spendable rule as the customer wallet: active/partially used,
    // not expired, and remaining amount not held by a live reservation.
    const credits = walletCredits.map((credit) => {
      const reserved = credit.reservations.reduce((sum, reservation) => sum + Number(reservation.amount), 0);
      const expired = Boolean(credit.expires_at && credit.expires_at < nowSeconds);
      const available = expired ? 0 : Math.max(money(Number(credit.remaining_amount) - reserved), 0);
      return {
        id: credit.id,
        assignment_id: credit.assignment_id,
        source_type: credit.source_type,
        label: credit.label,
        original_amount: money(credit.original_amount),
        remaining_amount: money(credit.remaining_amount),
        available_amount: available,
        status: expired ? 'expired' : credit.status,
        expires_at: toNumberOrNull(credit.expires_at),
        createddate: toNumberOrNull(credit.createddate),
      };
    });
    const walletBalance = money(
      credits
        .filter((credit) => ['active', 'partially_used'].includes(credit.status))
        .reduce((sum, credit) => sum + credit.available_amount, 0),
    );

    const promotionsUsed = promotions.map((row) => ({
      promotion_id: row.promotion_id,
      name: row.name || 'Promotion',
      codes: row.codes ?? [],
      times_used: Number(row.times_used),
      saved: money(row.saved),
    }));

    return {
      orders: {
        ...summary,
        returned_requests: Number(returnRequests[0]?.total ?? 0),
        average_order_value: summary.active_orders > 0 ? money(summary.total_spent / summary.active_orders) : 0,
        first_order_at: toNumberOrNull(orderDates[0]?.first_order),
        last_order_at: toNumberOrNull(orderDates[0]?.last_order),
      },
      top_categories: topCategories.map((row) => ({
        category: row.category || 'Uncategorised',
        quantity: Number(row.quantity),
        revenue: money(row.revenue),
      })),
      top_products: topProducts.map((row) => ({
        productid: toNumberOrNull(row.productid),
        name: row.name || 'Product',
        quantity: Number(row.quantity),
        orders: Number(row.orders),
        revenue: money(row.revenue),
      })),
      promotions: {
        total_saved: money(promotionsUsed.reduce((sum, row) => sum + row.saved, 0)),
        used: promotionsUsed,
      },
      wallet: {
        balance: walletBalance,
        // Coupon-backed credits are shown with their coupon (single source);
        // refund credits have no coupon, so they are listed here.
        refund_credits: credits.filter((credit) => credit.assignment_id === null),
      },
      groups: groups.map((member) => member.customer_group),
    };
  }
}
