import { FastifyRequest, FastifyReply } from 'fastify';
import { analyticsService } from '../services/analytics.service.js';
import { createSuccessResponse, createErrorResponse } from '../utils/errorHandler.js';

export class AnalyticsController {

    async getInventoryHealth(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { category, subcategory, subsubcategory, platform } = request.query as {
                category?: string;
                subcategory?: string;
                subsubcategory?: string;
                platform?: string;
            };

            const filters: any = {};
            if (category) filters.category = category;
            if (subcategory) filters.subcategory = subcategory;
            if (subsubcategory) filters.subsubcategory = subsubcategory;
            if (platform) filters.platform = platform;

            const data = await analyticsService.getInventoryHealth(
                Object.keys(filters).length > 0 ? filters : undefined
            );
            return reply.code(200).send(createSuccessResponse('Inventory health metrics', data));
        } catch (error: any) {
            request.log.error(error);
            return reply.code(500).send(createErrorResponse('Failed to fetch inventory health', error.message));
        }
    }

    async getFulfillmentSummary(request: FastifyRequest, reply: FastifyReply) {
        try {
            const data = await analyticsService.getFulfillmentSummary();
            return reply.code(200).send(createSuccessResponse('Fulfillment summary metrics', data));
        } catch (error: any) {
            request.log.error(error);
            return reply.code(500).send(createErrorResponse('Failed to fetch fulfillment summary', error.message));
        }
    }

    async getSalesVelocity(request: FastifyRequest, reply: FastifyReply) {
        try {
            const data = await analyticsService.getSalesVelocity();
            return reply.code(200).send(createSuccessResponse('Sales velocity metrics', data));
        } catch (error: any) {
            request.log.error(error);
            return reply.code(500).send(createErrorResponse('Failed to fetch sales velocity', error.message));
        }
    }

    async getSupplyChainStats(request: FastifyRequest, reply: FastifyReply) {
        try {
            const data = await analyticsService.getSupplyChainStats();
            return reply.code(200).send(createSuccessResponse('Supply chain metrics', data));
        } catch (error: any) {
            request.log.error(error);
            return reply.code(500).send(createErrorResponse('Failed to fetch supply chain stats', error.message));
        }
    }

    async getOrderAnalytics(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { startDate, endDate, status, mode } = request.query as {
                startDate?: string;
                endDate?: string;
                status?: string;
                mode?: string;
            };

            const filters: any = {};
            if (startDate) filters.startDate = startDate;
            if (endDate) filters.endDate = endDate;
            if (status) filters.status = status;
            if (mode) filters.mode = mode;

            const data = await analyticsService.getOrderAnalytics(
                Object.keys(filters).length > 0 ? filters : undefined
            );
            return reply.code(200).send(createSuccessResponse('Order analytics data', data));
        } catch (error: any) {
            request.log.error(error);
            return reply.code(500).send(createErrorResponse('Failed to fetch order analytics', error.message));
        }
    }
}
