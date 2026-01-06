import { FastifyInstance } from 'fastify';
import { AnalyticsController } from '../controllers/analytics.controller.js';

export async function analyticsRoutes(fastify: FastifyInstance) {
    const analyticsController = new AnalyticsController();

    // GET /v1/analytics/inventory-health
    fastify.get('/inventory-health', {
        schema: {
            description: 'Get inventory health metrics with optional category filters (Module A)',
            tags: ['Analytics'],
            querystring: {
                type: 'object',
                properties: {
                    category: {
                        type: 'string',
                        description: 'Filter by product category (e.g., home_fragrance, candles)'
                    },
                    subcategory: {
                        type: 'string',
                        description: 'Filter by product subcategory'
                    },
                    subsubcategory: {
                        type: 'string',
                        description: 'Filter by product subsubcategory (if applicable)'
                    },
                    platform: {
                        type: 'string',
                        description: 'Filter by platform (e.g., nivapp, amazon, flipkart)'
                    }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: {
                            type: 'object',
                            properties: {
                                lowStockCount: { type: 'number' },
                                outOfStockCount: { type: 'number' },
                                totalProducts: { type: 'number' },
                                totalStockItems: { type: 'number' },
                                distribution: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            platform: { type: 'string' },
                                            count: { type: 'number' }
                                        }
                                    }
                                },
                                lowStockProducts: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'number' },
                                            name: { type: 'string' },
                                            puc: { type: 'string' },
                                            availablequantity: { type: 'number', nullable: true },
                                            category: { type: 'string', nullable: true },
                                            subcategory: { type: 'string', nullable: true },
                                            platformStocks: {
                                                type: 'array',
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        platform: { type: 'string' },
                                                        availableqty: { type: 'number' },
                                                        totalqty: { type: 'number' }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                outOfStockProducts: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'number' },
                                            name: { type: 'string' },
                                            puc: { type: 'string' },
                                            availablequantity: { type: 'number', nullable: true },
                                            category: { type: 'string', nullable: true },
                                            subcategory: { type: 'string', nullable: true },
                                            subsubcategory: { type: 'string', nullable: true },
                                            platformStocks: {
                                                type: 'array',
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        platform: { type: 'string' },
                                                        availableqty: { type: 'number' },
                                                        totalqty: { type: 'number' }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }, analyticsController.getInventoryHealth.bind(analyticsController));
    
    // GET /v1/analytics/orders
    fastify.get('/orders', {
        schema: {
            description: 'Get comprehensive order analytics with date range filtering (Module E)',
            tags: ['Analytics'],
            querystring: {
                type: 'object',
                properties: {
                    startDate: {
                        type: 'string',
                        description: 'Start date (ISO format: YYYY-MM-DD or epoch milliseconds)',
                        examples: ['2024-01-01', '1704067200000']
                    },
                    endDate: {
                        type: 'string',
                        description: 'End date (ISO format: YYYY-MM-DD or epoch milliseconds)',
                        examples: ['2024-12-31', '1735689599999']
                    },
                    status: {
                        type: 'string',
                        description: 'Filter by order status',
                        enum: [
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
                            'partially_returned'
                        ]
                    },
                    mode: {
                        type: 'string',
                        description: 'Filter by payment mode',
                        enum: ['phonepe', 'cod']
                    }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: {
                            type: 'object',
                            properties: {
                                overview: {
                                    type: 'object',
                                    properties: {
                                        total_orders: { type: 'number' },
                                        total_revenue: { 
                                            type: 'number',
                                            description: 'Net revenue from non-cancelled orders. Calculated by EXCLUDING cancelled orders from query (NOT calculated as gross - cancelled). Excludes: cancelled, cancelled_refund_processing, cancelled_refunded, cancelled_completed, payment_failed, partially_cancelled'
                                        },
                                        gross_revenue: {
                                            type: 'number',
                                            description: 'Gross revenue including cancelled orders (total_revenue + cancelled_revenue). For reference only.'
                                        },
                                        average_order_value: { type: 'number' },
                                        delivered_orders: { type: 'number' },
                                        cancelled_orders: { 
                                            type: 'number',
                                            description: 'Total cancelled orders (includes all cancellation statuses)'
                                        },
                                        returned_orders: { type: 'number' },
                                        refunded_orders: { 
                                            type: 'number',
                                            description: 'Orders with refund completed (cancelled_refunded status)'
                                        },
                                        refund_processing_orders: { 
                                            type: 'number',
                                            description: 'Orders with refund in progress (cancelled_refund_processing status)'
                                        },
                                        cancelled_revenue: { 
                                            type: 'number',
                                            description: 'Revenue lost due to cancellations (sum of cancelled order amounts)'
                                        },
                                        conversion_rate: { type: 'string' },
                                        cancellation_rate: { type: 'string' },
                                        return_rate: { type: 'string' },
                                        refund_rate: { 
                                            type: 'string',
                                            description: 'Percentage of orders that were refunded'
                                        }
                                    }
                                },
                                status_breakdown: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            status: { type: 'string' },
                                            count: { type: 'number' },
                                            revenue: { type: 'number' }
                                        }
                                    }
                                },
                                mode_breakdown: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            mode: { type: 'string' },
                                            count: { type: 'number' },
                                            revenue: { type: 'number' }
                                        }
                                    }
                                },
                                payment_status_breakdown: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            payment_successful: { type: 'boolean' },
                                            count: { type: 'number' },
                                            revenue: { type: 'number' }
                                        }
                                    }
                                },
                                status_flow: {
                                    type: 'object',
                                    properties: {
                                        status_occurrences: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    status: { type: 'string' },
                                                    count: { type: 'number' }
                                                }
                                            }
                                        },
                                        top_transitions: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    from: { type: ['string', 'null'] },
                                                    to: { type: 'string' },
                                                    count: { type: 'number' }
                                                }
                                            }
                                        }
                                    }
                                },
                                top_statuses: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            status: { type: 'string' },
                                            count: { type: 'number' }
                                        }
                                    }
                                },
                                recent_orders: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'number' },
                                            orderid: { type: 'string', nullable: true },
                                            status: { type: 'string', nullable: true },
                                            amount: { type: 'number' },
                                            mode: { type: 'string', nullable: true },
                                            payment_successful: { type: 'boolean', nullable: true },
                                            quantity: { type: 'number', nullable: true },
                                            created_date: { type: ['number', 'null'] }
                                        }
                                    }
                                },
                                date_range: {
                                    type: 'object',
                                    properties: {
                                        start_date: { type: ['string', 'null'] },
                                        end_date: { type: ['string', 'null'] },
                                        start_date_epoch: { type: ['number', 'null'] },
                                        end_date_epoch: { type: ['number', 'null'] }
                                    }
                                }
                            }
                        }
                    }
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }, analyticsController.getOrderAnalytics.bind(analyticsController));

    // GET /v1/analytics/fulfillment-summary
    fastify.get('/fulfillment-summary', {
        schema: {
            description: 'Get order fulfillment summary (Module B)',
            tags: ['Analytics'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: {
                            type: 'object',
                            properties: {
                                pending: { type: 'number' },
                                ready_to_dispatch: { type: 'number' },
                                shipped_today: { type: 'number' },
                                returns_pending: { type: 'number' },
                                sla_breached: { type: 'number' }
                            }
                        }
                    }
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }, analyticsController.getFulfillmentSummary.bind(analyticsController));

    // GET /v1/analytics/sales-velocity
    fastify.get('/sales-velocity', {
        schema: {
            description: 'Get sales velocity metrics (Module C)',
            tags: ['Analytics'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: {
                            type: 'object',
                            properties: {
                                todayRevenue: { type: 'number' },
                                yesterdayRevenue: { type: 'number' },
                                platformSplit: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            platform: { type: 'string' },
                                            units: { type: 'number' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }, analyticsController.getSalesVelocity.bind(analyticsController));

    // GET /v1/analytics/supply-chain
    fastify.get('/supply-chain', {
        schema: {
            description: 'Get procurement and supply chain stats (Module D)',
            tags: ['Analytics'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: {
                            type: 'object',
                            properties: {
                                open_pos: { type: 'number' },
                                pending_prs: { type: 'number' }
                            }
                        }
                    }
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }, analyticsController.getSupplyChainStats.bind(analyticsController));


}
