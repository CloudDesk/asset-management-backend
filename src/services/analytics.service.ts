import { prisma } from '../models/prisma.js';
import { buildProductTaxonomyWhere } from '../utils/productTaxonomy.js';

export class AnalyticsService {
    /**
     * Module A: Inventory Health & Stock Control
     * Real-time visibility into stock levels
     */
    async getInventoryHealth(filters?: {
        category?: string;
        subcategory?: string;
        subsubcategory?: string;
        platform?: string;
    }) {
        const lowStockThreshold = 10;

        // ===================================================================
        // PLATFORM-SPECIFIC LOGIC
        // When platform is specified, use platformStock.availableqty
        // ===================================================================
        if (filters?.platform) {
            // Build category filters for product (exclude combo products)
            const productWhere: any = {
                iscombo: false,
                ...buildProductTaxonomyWhere(filters),
            };

            // Query platformStock table directly for platform-specific data
            const [lowStockItems, outOfStockItems, allPlatformStocks, platformDistribution, stockItemCount] = await Promise.all([
                // Low stock on this platform (availableqty < 10 AND > 0)
                prisma.platformStock.findMany({
                    where: {
                        platform: filters.platform,
                        availableqty: { lt: lowStockThreshold, gt: 0 },
                        product: productWhere,
                    },
                    take: 5,
                    orderBy: {
                        availableqty: 'asc',
                    },
                    select: {
                        productid: true,
                        platform: true,
                        availableqty: true,
                        totalqty: true,
                        product: {
                            select: {
                                id: true,
                                name: true,
                                puc: true,
                                availablequantity: true,
                                category: true,
                                subcategory: true,
                                subsubcategory: true,
                                platformStocks: {
                                    select: {
                                        platform: true,
                                        availableqty: true,
                                        totalqty: true,
                                    },
                                },
                            },
                        },
                    },
                }),
                // Out of stock on this platform (availableqty = 0)
                // Note: PlatformStock.availableqty has default(0), so it should never be NULL
                prisma.platformStock.findMany({
                    where: {
                        platform: filters.platform,
                        availableqty: 0,
                        product: productWhere,
                    },
                    take: 5,
                    orderBy: {
                        modifieddate: 'desc',
                    },
                    select: {
                        productid: true,
                        platform: true,
                        availableqty: true,
                        totalqty: true,
                        product: {
                            select: {
                                id: true,
                                name: true,
                                puc: true,
                                availablequantity: true,
                                category: true,
                                subcategory: true,
                                subsubcategory: true,
                                platformStocks: {
                                    select: {
                                        platform: true,
                                        availableqty: true,
                                        totalqty: true,
                                    },
                                },
                            },
                        },
                    },
                }),
                // All platform stocks for this platform (for counts)
                prisma.platformStock.findMany({
                    where: {
                        platform: filters.platform,
                        product: productWhere,
                    },
                    select: {
                        availableqty: true,
                    },
                }),
                // Platform distribution (all platforms)
                prisma.platformStock.groupBy({
                    by: ['platform'],
                    _sum: {
                        availableqty: true,
                    },
                }),
                // Count individual stock items (from stock table)
                prisma.stock.count({
                    where: {
                        platform: filters.platform,
                        product: productWhere,
                    },
                }),
            ]);

            // Calculate counts based on platform-specific stock
            // PlatformStock.availableqty has default(0), so null coalescing is safe but shouldn't be needed
            const lowStockCount = allPlatformStocks.filter(ps => {
                const qty = ps.availableqty ?? 0;
                return qty > 0 && qty < lowStockThreshold;
            }).length;
            const outOfStockCount = allPlatformStocks.filter(ps => {
                const qty = ps.availableqty ?? 0;
                return qty === 0;
            }).length;
            const totalProducts = allPlatformStocks.length;
            const totalStockItems = stockItemCount;

            // Format platform distribution
            const distribution = platformDistribution.map(p => ({
                platform: p.platform,
                count: p._sum.availableqty || 0,
            }));

            // Transform platformStock results to match product format
            const lowStockProducts = lowStockItems.map(ps => ps.product);
            const outOfStockProducts = outOfStockItems.map(ps => ps.product);

            return {
                lowStockCount,
                outOfStockCount,
                totalProducts,
                totalStockItems,
                distribution,
                lowStockProducts,
                outOfStockProducts,
            };
        }

        // ===================================================================
        // GLOBAL LOGIC (NO PLATFORM FILTER)
        // Use product.availablequantity for total across all platforms
        // ===================================================================

        // Build where clause with category filters (exclude combo products)
        const whereClause: any = {
            availablequantity: { lt: lowStockThreshold, gt: 0 },
            iscombo: false,
            ...buildProductTaxonomyWhere(filters || {}),
        };

        // Out of stock where clause
        // Include products with availablequantity = 0 OR NULL (products with no stock added yet)
        const outOfStockWhere: any = {
            OR: [
                { availablequantity: 0 },
                { availablequantity: null }
            ],
            iscombo: false,
            ...buildProductTaxonomyWhere(filters || {}),
        };

        // Total SKU where clause (optional filters)
        const totalSkuWhere: any = {
            iscombo: false,
            ...buildProductTaxonomyWhere(filters || {}),
        };

        // Run parallel queries for performance
        const [lowStockCount, outOfStockCount, totalProducts, platformDistribution, lowStockProducts, outOfStockProducts, totalStockItems] = await Promise.all([
            prisma.product.count({ where: whereClause }),
            prisma.product.count({ where: outOfStockWhere }),
            prisma.product.count({ where: Object.keys(totalSkuWhere).length > 0 ? totalSkuWhere : undefined }),
            prisma.platformStock.groupBy({
                by: ['platform'],
                _sum: {
                    availableqty: true,
                },
            }),
            // Fetch top 5 low stock products with platform breakdown
            prisma.product.findMany({
                where: whereClause,
                take: 5,
                orderBy: {
                    availablequantity: 'asc', // Most critical first
                },
                select: {
                    id: true,
                    name: true,
                    puc: true,
                    availablequantity: true,
                    category: true,
                    subcategory: true,
                    subsubcategory: true,
                    platformStocks: {
                        select: {
                            platform: true,
                            availableqty: true,
                            totalqty: true,
                        },
                    },
                },
            }),
            // Fetch top 5 out of stock products with platform breakdown
            prisma.product.findMany({
                where: outOfStockWhere,
                take: 5,
                orderBy: {
                    modifieddate: 'desc', // Most recently updated first
                },
                select: {
                    id: true,
                    name: true,
                    puc: true,
                    availablequantity: true,
                    category: true,
                    subcategory: true,
                    subsubcategory: true,
                    platformStocks: {
                        select: {
                            platform: true,
                            availableqty: true,
                            totalqty: true,
                        },
                    },
                },
            }),
            // Count individual stock items (from stock table)
            prisma.stock.count({
                where: {
                    product: Object.keys(totalSkuWhere).length > 0 ? totalSkuWhere : { iscombo: false },
                },
            }),
        ]);

        // Format platform distribution
        const distribution = platformDistribution.map(p => ({
            platform: p.platform,
            count: p._sum.availableqty || 0,
        }));

        return {
            lowStockCount,
            outOfStockCount,
            totalProducts,
            totalStockItems,
            distribution,
            lowStockProducts,
            outOfStockProducts,
        };
    }

    /**
     * Module B: Order Fulfillment Center (Ops)
     * The "Command Center" for the operations team
     */
    async getFulfillmentSummary() {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startOfDayEpoch = startOfDay.getTime();

        const [pending, readyToDispatch, shippedToday, returnsPending, breaches] = await Promise.all([
            prisma.orders.count({
                where: { orderstatus: 'order_placed' },
            }),
            prisma.orders.count({
                where: { orderstatus: 'ready_for_dispatch' },
            }),
            prisma.orders.count({
                where: {
                    orderstatus: 'shipped',
                    dispatcheddate: {
                        gte: BigInt(startOfDayEpoch),
                    },
                },
            }),
            prisma.orders.count({
                where: {
                    orderstatus: { in: ['return_initiated', 'return_received'] }, // Adjust based on actual status enums
                },
            }),
            // SLA Breach: Pending > 48 hours
            prisma.orders.count({
                where: {
                    orderstatus: 'order_placed',
                    createddate: {
                        lt: BigInt(Date.now() - 48 * 60 * 60 * 1000),
                    },
                },
            }),
        ]);

        return {
            pending,
            ready_to_dispatch: readyToDispatch,
            shipped_today: shippedToday,
            returns_pending: returnsPending,
            sla_breached: breaches,
        };
    }

    /**
     * Module C: Sales & Revenue Analytics
     * High-level business performance tracking
     */
    async getSalesVelocity() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEpoch = BigInt(today.getTime());

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayEpoch = BigInt(yesterday.getTime());

        // Revenue Today
        const todayRevenueAgg = await prisma.orders.aggregate({
            _sum: { orderamount: true },
            where: {
                createddate: { gte: todayEpoch },
                orderstatus: { notIn: ['cancelled', 'payment_failed'] },
            },
        });

        // Revenue Yesterday
        const yesterdayRevenueAgg = await prisma.orders.aggregate({
            _sum: { orderamount: true },
            where: {
                createddate: { gte: yesterdayEpoch, lt: todayEpoch },
                orderstatus: { notIn: ['cancelled', 'payment_failed'] },
            },
        });

        // Top Platforms (Sales Volume by Platform Stock sold today)
        // Note: This relies on the Stock table having solddate populated correctly
        /* 
           Alternative (Using Orders): 
           We don't have a direct 'platform' column on orders, but if specific users 
           or order types indicate platform, we use that. 
           Fallback: Use 'mode' (PhonePe/COD) as a proxy for channel if mostly direct, 
           OR rely on PlatformStock updates if 'soldqty' is tracked daily (harder).
           
           Better approach for now: Group by 'mode' as proxy, or if 'vendor' field exists in orders (schema showed vendor).
        */
        const platformSplit = await prisma.orders.groupBy({
            by: ['vendor'], // Schema showed 'vendor' with default 'EKART'. Check if this captures Amazon/Flipkart?
            _sum: { orderamount: true },
            where: {
                createddate: { gte: todayEpoch },
                orderstatus: { notIn: ['cancelled', 'payment_failed'] },
            }
        });

        // If vendor is always 'EKART' (courier), this might not work. 
        // Let's check 'deliveryfrom' or just stick to simple Revenue for v1.
        // Schema has `Stock` table with `platform` and `solddate`. Let's use that for units sold.

        const unitsByPlatform = await prisma.stock.groupBy({
            by: ['platform'],
            _count: { id: true },
            where: {
                stockstatus: 'sold',
                solddate: { gte: todayEpoch }
            }
        });


        return {
            todayRevenue: Number(todayRevenueAgg._sum.orderamount) || 0,
            yesterdayRevenue: Number(yesterdayRevenueAgg._sum.orderamount) || 0,
            platformSplit: unitsByPlatform.map(p => ({ platform: p.platform, units: p._count.id })),
        };
    }

    /**
     * Module D: Procurement & Supply Chain
     * Managing incoming inventory
     */
    async getSupplyChainStats() {
        const [openPOs, pendingPRs] = await Promise.all([
            prisma.purchaseOrder.count({
                where: {
                    po_status: { notIn: ['Closed', 'Cancelled', 'Delivered'] }, // Adjust based on actual status
                },
            }),
            prisma.purchaseRequest.count({
                where: {
                    prstatus: 'In Progress',
                },
            }),
        ]);

        return {
            open_pos: openPOs,
            pending_prs: pendingPRs,
        };
    }

    /**
     * Module E: Order Analytics
     * Comprehensive order analytics with date range filtering
     */
    async getOrderAnalytics(filters?: {
        startDate?: string; // ISO date string or epoch milliseconds
        endDate?: string; // ISO date string or epoch milliseconds
        status?: string; // Filter by specific status
        mode?: string; // Filter by payment mode: 'phonepe' | 'cod'
    }) {
        // Parse date filters
        let startDateEpoch: bigint | undefined;
        let endDateEpoch: bigint | undefined;

        if (filters?.startDate) {
            const startDate = new Date(filters.startDate);
            startDate.setHours(0, 0, 0, 0);
            startDateEpoch = BigInt(startDate.getTime());
        }

        if (filters?.endDate) {
            const endDate = new Date(filters.endDate);
            endDate.setHours(23, 59, 59, 999);
            endDateEpoch = BigInt(endDate.getTime());
        }

        // Build where clause
        const whereClause: any = {};
        
        if (startDateEpoch || endDateEpoch) {
            whereClause.createddate = {};
            if (startDateEpoch) whereClause.createddate.gte = startDateEpoch;
            if (endDateEpoch) whereClause.createddate.lte = endDateEpoch;
        }

        if (filters?.status) {
            whereClause.orderstatus = filters.status;
        }

        if (filters?.mode) {
            whereClause.mode = filters.mode;
        } else {
            // In production, if no mode filter specified, we can optionally default to phonepe
            // But for analytics, we want to see all modes, so we don't filter here
        }

        // All valid order statuses from ORDER_ORDERLINE_STATUS_REFERENCE.md
        const allStatuses = [
            'order_placed',
            'payment_completed',
            'payment_failed',
            'order_confirmed',
            'packed',
            'ready_for_dispatch',
            'shipped',
            'in_transit',
            'out_for_delivery',
            'delivered',
            'cod_payment_received',
            'cancelled',
            'cancelled_refund_processing',
            'cancelled_refunded',
            'cancelled_completed',
            'return_initiated',
            'returned',
            'rto_initiated',
            'rto_delivered',
            'partially_cancelled',
            'partially_returned',
        ];

        // EXCLUDE from revenue: All cancellation statuses, payment failures, and refunded orders
        // Revenue should only count orders that are actually completed or in progress (not cancelled/refunded)
        // Based on ORDER_CANCELLATION_FLOW.md: cancelled orders should not count as revenue
        const excludedRevenueStatuses = [
            'cancelled',                    // Initial cancellation
            'cancelled_refund_processing',   // Refund in progress (money will be returned)
            'cancelled_refunded',            // Refund completed (money returned)
            'cancelled_completed',           // COD cancellation complete (no payment collected)
            'payment_failed',                // Payment never succeeded
            'partially_cancelled',            // Partial cancellation (some items cancelled)
        ];

        // Run parallel queries for performance
        const [
            totalOrders,
            totalRevenue,
            averageOrderValue,
            statusBreakdown,
            modeBreakdown,
            paymentStatusBreakdown,
            statusFlowData,
            topStatuses,
            recentOrders,
        ] = await Promise.all([
            // Total orders count
            prisma.orders.count({ where: whereClause }),

            // Total revenue (sum of orderamount for non-cancelled orders)
            prisma.orders.aggregate({
                _sum: { orderamount: true },
                where: {
                    ...whereClause,
                    orderstatus: { notIn: excludedRevenueStatuses },
                },
            }),

            // Average order value (same exclusions as revenue)
            prisma.orders.aggregate({
                _avg: { orderamount: true },
                where: {
                    ...whereClause,
                    orderstatus: { notIn: excludedRevenueStatuses },
                },
            }),

            // Status breakdown (count by status)
            prisma.orders.groupBy({
                by: ['orderstatus'],
                _count: { id: true },
                _sum: { orderamount: true },
                where: whereClause,
            }),

            // Mode breakdown (PhonePe vs COD)
            prisma.orders.groupBy({
                by: ['mode'],
                _count: { id: true },
                _sum: { orderamount: true },
                where: whereClause,
            }),

            // Payment status breakdown (ispaymentsucceed)
            prisma.orders.groupBy({
                by: ['ispaymentsucceed'],
                _count: { id: true },
                _sum: { orderamount: true },
                where: whereClause,
            }),

            // Status flow data (from status_history JSONB field)
            prisma.orders.findMany({
                where: whereClause,
                select: {
                    id: true,
                    orderid: true,
                    orderstatus: true,
                    status_history: true,
                    createddate: true,
                },
                take: 1000, // Limit for performance
            }),

            // Top 5 statuses by count
            prisma.orders.groupBy({
                by: ['orderstatus'],
                _count: { id: true },
                where: whereClause,
                orderBy: { _count: { id: 'desc' } },
                take: 5,
            }),

            // Recent orders (last 10)
            prisma.orders.findMany({
                where: whereClause,
                select: {
                    id: true,
                    orderid: true,
                    orderstatus: true,
                    orderamount: true,
                    mode: true,
                    ispaymentsucceed: true,
                    createddate: true,
                    quantity: true,
                },
                orderBy: { createddate: 'desc' },
                take: 10,
            }),
        ]);

        // Process status flow data
        const statusFlow: Record<string, number> = {};
        const statusTransitions: Array<{
            from: string | null;
            to: string;
            count: number;
        }> = [];

        (statusFlowData || []).forEach((order: any) => {
            const history = order.status_history as any[];
            if (Array.isArray(history)) {
                history.forEach((entry: any) => {
                    const fromStatus = entry.previous_status || 'null';
                    const toStatus = entry.new_status;
                    
                    // Count status occurrences
                    statusFlow[toStatus] = (statusFlow[toStatus] || 0) + 1;
                    
                    // Track transitions
                    const transitionKey = `${fromStatus}→${toStatus}`;
                    const existingTransition = statusTransitions.find(
                        (t) => t.from === fromStatus && t.to === toStatus
                    );
                    if (existingTransition) {
                        existingTransition.count++;
                    } else {
                        statusTransitions.push({
                            from: fromStatus,
                            to: toStatus,
                            count: 1,
                        });
                    }
                });
            }
        });

        // Format status breakdown
        const statusBreakdownFormatted = allStatuses.map((status) => {
            const found = (statusBreakdown || []).find((s: any) => s.orderstatus === status);
            return {
                status,
                count: found?._count.id || 0,
                revenue: Number(found?._sum.orderamount) || 0,
            };
        }).filter((s) => s.count > 0); // Only include statuses with orders

        // Format mode breakdown (handle null/undefined modes and production case with no COD)
        const modeBreakdownFormatted = (modeBreakdown || [])
            .filter((m: any) => m.mode !== null && m.mode !== undefined) // Filter out null modes
            .map((m: any) => ({
                mode: m.mode || 'unknown',
                count: m._count.id,
                revenue: Number(m._sum.orderamount) || 0,
            }))
            .sort((a: any, b: any) => b.count - a.count); // Sort by count descending

        // Format payment status breakdown
        const paymentStatusBreakdownFormatted = (paymentStatusBreakdown || []).map((p: any) => ({
            payment_successful: p.ispaymentsucceed || false,
            count: p._count.id,
            revenue: Number(p._sum.orderamount) || 0,
        }));

        // Calculate additional metrics
        // Count all cancellation-related statuses (from ORDER_CANCELLATION_FLOW.md)
        const cancelledOrders = (statusBreakdown || [])
            .filter((s: any) => 
                s.orderstatus === 'cancelled' || 
                s.orderstatus === 'partially_cancelled' ||
                s.orderstatus === 'cancelled_refund_processing' ||
                s.orderstatus === 'cancelled_refunded' ||
                s.orderstatus === 'cancelled_completed'
            )
            .reduce((sum: number, s: any) => sum + s._count.id, 0);

        const returnedOrders = (statusBreakdown || [])
            .filter((s: any) => 
                s.orderstatus === 'returned' || 
                s.orderstatus === 'partially_returned'
            )
            .reduce((sum: number, s: any) => sum + s._count.id, 0);

        const deliveredOrders = (statusBreakdown || []).find((s: any) => 
            s.orderstatus === 'delivered'
        )?._count.id || 0;

        // Calculate refund metrics (from ORDER_CANCELLATION_FLOW.md)
        const refundedOrders = (statusBreakdown || []).find((s: any) => 
            s.orderstatus === 'cancelled_refunded'
        )?._count.id || 0;

        const refundProcessingOrders = (statusBreakdown || []).find((s: any) => 
            s.orderstatus === 'cancelled_refund_processing'
        )?._count.id || 0;

        // Calculate revenue lost due to cancellations/refunds
        // This is the sum of order amounts for all cancelled orders
        const cancelledRevenue = (statusBreakdown || [])
            .filter((s: any) => 
                s.orderstatus === 'cancelled' || 
                s.orderstatus === 'cancelled_refund_processing' ||
                s.orderstatus === 'cancelled_refunded' ||
                s.orderstatus === 'cancelled_completed' ||
                s.orderstatus === 'partially_cancelled'
            )
            .reduce((sum: number, s: any) => sum + Number(s._sum.orderamount || 0), 0);

        const conversionRate = totalOrders > 0 
            ? ((deliveredOrders / totalOrders) * 100).toFixed(2)
            : '0.00';

        const cancellationRate = totalOrders > 0
            ? ((cancelledOrders / totalOrders) * 100).toFixed(2)
            : '0.00';

        const returnRate = totalOrders > 0
            ? ((returnedOrders / totalOrders) * 100).toFixed(2)
            : '0.00';

        const refundRate = totalOrders > 0
            ? ((refundedOrders / totalOrders) * 100).toFixed(2)
            : '0.00';

        // Calculate gross revenue (all orders including cancelled)
        // This is for reference - actual total_revenue excludes cancelled orders
        const grossRevenue = Number((totalRevenue as any)?._sum?.orderamount) || 0;
        const netRevenue = grossRevenue; // Same as total_revenue (already excludes cancelled)
        
        // Verification: total_revenue + cancelled_revenue should equal gross revenue if we included cancelled
        // But since total_revenue already excludes cancelled, we calculate gross separately for clarity
        const grossRevenueIncludingCancelled = grossRevenue + cancelledRevenue;

        return {
            // Overview metrics
            overview: {
                total_orders: totalOrders,
                // total_revenue is calculated by EXCLUDING cancelled orders from the query
                // It is NOT calculated as "gross - cancelled_revenue"
                // Instead, cancelled orders are filtered out at the database query level
                total_revenue: netRevenue, // Net revenue (excludes cancelled orders)
                gross_revenue: grossRevenueIncludingCancelled, // Gross revenue (if we included cancelled)
                average_order_value: Number((averageOrderValue as any)?._avg?.orderamount) || 0,
                delivered_orders: deliveredOrders,
                cancelled_orders: cancelledOrders,
                returned_orders: returnedOrders,
                refunded_orders: refundedOrders,
                refund_processing_orders: refundProcessingOrders,
                cancelled_revenue: cancelledRevenue, // Revenue lost due to cancellations (sum of cancelled order amounts)
                // Note: total_revenue + cancelled_revenue = gross_revenue
                conversion_rate: `${conversionRate}%`,
                cancellation_rate: `${cancellationRate}%`,
                return_rate: `${returnRate}%`,
                refund_rate: `${refundRate}%`,
            },

            // Status breakdown
            status_breakdown: statusBreakdownFormatted,

            // Mode breakdown
            mode_breakdown: modeBreakdownFormatted,

            // Payment status breakdown
            payment_status_breakdown: paymentStatusBreakdownFormatted,

            // Status flow analytics
            status_flow: {
                status_occurrences: Object.entries(statusFlow)
                    .map(([status, count]) => ({ status, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10), // Top 10
                top_transitions: statusTransitions
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10), // Top 10 transitions
            },

            // Top statuses
            top_statuses: (topStatuses || []).map((s: any) => ({
                status: s.orderstatus || 'unknown',
                count: s._count.id,
            })),

            // Recent orders
            recent_orders: (recentOrders || []).map((o: any) => ({
                id: o.id,
                orderid: o.orderid,
                status: o.orderstatus,
                amount: Number(o.orderamount) || 0,
                mode: o.mode,
                payment_successful: o.ispaymentsucceed,
                quantity: o.quantity,
                created_date: o.createddate ? Number(o.createddate) : null,
            })),

            // Date range info
            date_range: {
                start_date: filters?.startDate || null,
                end_date: filters?.endDate || null,
                start_date_epoch: startDateEpoch ? Number(startDateEpoch) : null,
                end_date_epoch: endDateEpoch ? Number(endDateEpoch) : null,
            },
        };
    }
}

export const analyticsService = new AnalyticsService();
