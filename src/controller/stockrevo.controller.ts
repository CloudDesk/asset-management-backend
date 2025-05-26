import { FastifyRequest, FastifyReply } from 'fastify';
import { stockRevoService } from "../services/stockRevo.service.js";
import { stockrevoSchema, stockrevoIdSchema, stockrevoUpsertSchema, stockrevoDeleteSchema, stockrevoArchiveSchema, stockrevoRfidSchema } from '../schemas/stockRevo.schema.js';

interface StockRevoUpsertResponse {
    command: string;
    result: {
        puc: string;
        rows: Array<{
            puc: string;
            isdeleted?: boolean;
            isarchive?: boolean;
        }>;
    };
    totalCount: number;
}

interface StockRevoErrorResponse {
    errorMessage: string;
    errorDetails: string;
    statusCode: number;
}

type StockRevoServiceResponse = StockRevoUpsertResponse | StockRevoErrorResponse;

export module stockRevoController {
    export const getStockRevoData = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await stockRevoService.getStockRevoData(request);
            return reply.send(result);
        } catch (error) {
            console.error("Error in getStockRevoData", error);
            return reply.send({
                success: false,
                data: null,
                total: 0,
                page: 1,
                limit: 0,
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    export const getEachStockRevoData = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await stockRevoService.getEachStockRevoData(request);
            return reply.send(result);
        } catch (error) {
            console.error("Error in getEachStockRevoData", error);
            return reply.send({
                success: false,
                data: null,
                total: 0,
                page: 1,
                limit: 0,
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    export const getEwasteStocksRevo = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await stockRevoService.getEwasteStocksrevo(request);
            return reply.send(result);
        } catch (error) {
            console.error("Error in getEwasteStocksRevo", error);
            return reply.send({
                success: false,
                data: null,
                total: 0,
                page: 1,
                limit: 0,
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    export const updateEwaste = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as { id: number };
            const result = await stockRevoService.updateEwaste(id);
            return reply.send(result);
        } catch (error) {
            console.error("Error in updateEwaste", error);
            return reply.send({
                success: false,
                data: null,
                total: 0,
                page: 1,
                limit: 0,
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    export const getDeletedStocksRevo = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await stockRevoService.getDeletedStocksrevo(request);
            return reply.send(result);
        } catch (error) {
            console.error("Error in getDeletedStocksRevo", error);
            return reply.send({
                success: false,
                data: null,
                total: 0,
                page: 1,
                limit: 0,
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    export const updateRemovedFromRecyclebinRevo = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await stockRevoService.updateRemoveFromRecyclebin();
            return reply.send(result);
        } catch (error) {
            console.error("Error in updateRemovedFromRecyclebinRevo", error);
            return reply.send({
                success: false,
                data: null,
                total: 0,
                page: 1,
                limit: 0,
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    export const upsertStockRevoData = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await stockRevoService.upsertStockRevoData(request.body) as StockRevoServiceResponse;
            if ('command' in result && (result.command === "UPDATE" || result.command === "INSERT")) {
                const puc = result.result.puc;
                const pucArray: string[] = Array.from(new Set(result.result.rows.map(row => row.puc)));
                await stockRevoService.updateQuantity(pucArray);
                return reply.send({
                    product: result.command === "UPDATE" ? "Stock Updated successfully" : "Stock Inserted successfully"
                });
            } else if ('statusCode' in result) {
                return reply.status(404).send({ error: [result.errorMessage] });
            } else {
                return reply.status(404).send({ error: [result] });
            }
        } catch (error) {
            console.error("Error in upsertStockRevoData", error);
            return reply.send({
                success: false,
                data: null,
                total: 0,
                page: 1,
                limit: 0,
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    export const assetlocationstock = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await stockRevoService.upsertStockRevoData(request.body) as StockRevoServiceResponse;
            if ('command' in result && (result.command === "UPDATE" || result.command === "INSERT")) {
                const puc = result.result.puc;
                const pucArray: string[] = Array.from(new Set(result.result.rows.map(row => row.puc)));
                await stockRevoService.updateQuantity(pucArray);
                return reply.send({
                    product: result.command === "UPDATE" ? "Stock Updated successfully" : "Stock Inserted successfully"
                });
            } else if ('statusCode' in result) {
                return reply.status(404).send({ error: [result.errorMessage] });
            } else {
                return reply.status(404).send({ error: [result] });
            }
        } catch (error) {
            console.error("Error in assetlocationstock", error);
            return reply.send({
                success: false,
                data: null,
                total: 0,
                page: 1,
                limit: 0,
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    export const upsertStockRevoDatadelete = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await stockRevoService.upsertStockRevoDatadelete(request.body) as StockRevoServiceResponse;
            if ('command' in result && (result.command === "UPDATE" || result.command === "INSERT")) {
                const puc = result.result.puc;
                const pucArray: string[] = Array.from(new Set(result.result.rows.map(row => row.puc)));
                await stockRevoService.updateQuantity(pucArray);
                return reply.send({
                    Stock: result.command === "UPDATE" && result.result.rows[0]?.isdeleted === true
                        ? "Stock Deleted successfully"
                        : "Stock Restored successfully"
                });
            } else if ('statusCode' in result) {
                return reply.status(404).send({ error: [result.errorMessage] });
            } else {
                return reply.status(404).send({ error: [result] });
            }
        } catch (error) {
            console.error("Error in upsertStockRevoDatadelete", error);
            return reply.send({
                success: false,
                data: null,
                total: 0,
                page: 1,
                limit: 0,
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    export const upsertStockRevoDataarchive = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await stockRevoService.upsertStockRevoDataarchive(request.body) as StockRevoServiceResponse;
            if ('command' in result && (result.command === "UPDATE" || result.command === "INSERT")) {
                const puc = result.result.puc;
                const pucArray: string[] = Array.from(new Set(result.result.rows.map(row => row.puc)));
                await stockRevoService.updateQuantity(pucArray);
                return reply.send({
                    Stock: result.command === "UPDATE" && result.result.rows[0]?.isarchive === true
                        ? "Stock successfully archived"
                        : "Stock successfully unarchived"
                });
            } else if ('statusCode' in result) {
                return reply.status(404).send({ error: [result.errorMessage] });
            } else {
                return reply.status(404).send({ error: [result] });
            }
        } catch (error) {
            console.error("Error in upsertStockRevoDataarchive", error);
            return reply.send({
                success: false,
                data: null,
                total: 0,
                page: 1,
                limit: 0,
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    export const deleteStockRevoData = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as { id: number };
            const result = await stockRevoService.deleteStockrevo(id);
            return reply.send(result);
        } catch (error) {
            console.error("Error in deleteStockRevoData", error);
            return reply.send({
                success: false,
                data: null,
                total: 0,
                page: 1,
                limit: 0,
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    export const getArcheivedStocksRevo = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await stockRevoService.getArcheivedStocksrevo(request);
            return reply.send(result);
        } catch (error) {
            console.error("Error in getArcheivedStocksRevo", error);
            return reply.send({
                success: false,
                data: null,
                total: 0,
                page: 1,
                limit: 0,
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };
}

