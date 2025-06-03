import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class PoinvoiceService {
    /**
     * Helper method to extract payment amount from payment data
     */
    extractPaymentAmount(paymentdata) {
        console.log('💳 DEBUG: Extracting payment amount from:', JSON.stringify(paymentdata));
        if (!paymentdata) {
            console.log('💳 DEBUG: No payment data provided');
            logger.debug('No payment data provided');
            return 0;
        }
        let totalPaymentAmount = 0;
        if (Array.isArray(paymentdata)) {
            // If paymentdata is an array, sum all payment amounts
            totalPaymentAmount = paymentdata.reduce((sum, payment) => {
                const amount = parseFloat(payment.paymentamount || 0);
                const validAmount = isNaN(amount) ? 0 : amount;
                console.log('💳 DEBUG: Processing payment from array:', { payment, amount, validAmount });
                logger.debug({ payment, amount, validAmount }, 'Processing payment from array');
                return sum + validAmount;
            }, 0);
        }
        else if (typeof paymentdata === 'object' && paymentdata.paymentamount) {
            // If paymentdata is a single object with paymentamount
            const amount = parseFloat(paymentdata.paymentamount || 0);
            totalPaymentAmount = isNaN(amount) ? 0 : amount;
            console.log('💳 DEBUG: Processing single payment object:', { paymentdata, amount, totalPaymentAmount });
            logger.debug({ paymentdata, amount, totalPaymentAmount }, 'Processing single payment object');
        }
        console.log('💳 DEBUG: Final payment amount extracted:', totalPaymentAmount);
        logger.debug({
            paymentdata,
            totalPaymentAmount,
            isArray: Array.isArray(paymentdata),
            isObject: typeof paymentdata === 'object'
        }, 'Payment amount extraction result');
        return totalPaymentAmount;
    }
    /**
     * Validate purchase order exists and get its current state
     * Production-ready validation following existing project structure
     */
    async validateAndGetPurchaseOrder(ponumber) {
        try {
            const purchaseOrder = await dynamicFindUnique('purchaseorder', { ponumber });
            if (!purchaseOrder) {
                logger.warn({ ponumber }, 'Purchase order not found during validation');
                return null;
            }
            // Validate PO total is a valid number
            const poTotal = parseFloat(purchaseOrder.total || 0);
            if (isNaN(poTotal) || poTotal < 0) {
                logger.warn({ ponumber, total: purchaseOrder.total }, 'Invalid purchase order total detected');
                return null;
            }
            return {
                ...purchaseOrder,
                total: poTotal
            };
        }
        catch (error) {
            logger.error({ error, ponumber }, 'Error validating purchase order');
            throw error;
        }
    }
    /**
     * Helper method to calculate total payments for a ponumber
     */
    async calculateTotalPaymentsForPO(ponumber) {
        try {
            logger.info({ ponumber }, '🔍 Starting payment calculation for PO');
            // Use existing dynamic operations for consistency
            const existingInvoices = await dynamicFindManyWithFilters('poinvoice', { ponumber }, {
                useAllColumns: true
            });
            logger.info({
                ponumber,
                foundCount: existingInvoices.data.length,
                totalRecords: existingInvoices.total
            }, '📋 Found poinvoices for PO');
            let totalPaid = 0;
            for (const invoice of existingInvoices.data) {
                const paymentAmount = this.extractPaymentAmount(invoice.paymentdata);
                totalPaid += paymentAmount;
                logger.debug({
                    poinvoiceId: invoice.id,
                    ponumber: invoice.ponumber,
                    paymentAmount,
                    paymentData: invoice.paymentdata
                }, '💰 Processing individual poinvoice payment');
            }
            logger.info({
                ponumber,
                invoiceCount: existingInvoices.data.length,
                totalPaid
            }, '✅ Payment calculation completed');
            return totalPaid;
        }
        catch (error) {
            logger.error({ error, ponumber }, '❌ Error calculating total payments for PO');
            return 0;
        }
    }
    /**
     * Specialized function to update purchase order status by ponumber
     * Uses existing dynamicDbOperations following the project structure
     */
    async updatePurchaseOrderStatusByPonumber(ponumber, newStatus, totalPayments, poTotal) {
        try {
            logger.info({
                ponumber,
                newStatus,
                totalPayments,
                poTotal
            }, 'Updating purchase order status by ponumber using dynamic operations');
            // First get the purchase order to get its ID (since dynamicUpdate needs ID)
            const purchaseOrder = await dynamicFindUnique('purchaseorder', { ponumber });
            if (!purchaseOrder) {
                logger.warn({ ponumber, newStatus }, 'Purchase order not found for update');
                return false;
            }
            // Use existing dynamicUpdate with the correct ID
            const updatedPO = await dynamicUpdate('purchaseorder', { id: purchaseOrder.id }, {
                po_status: newStatus,
                modifieddate: Math.floor(Date.now() / 1000)
            });
            if (updatedPO) {
                logger.info({
                    ponumber,
                    updatedId: purchaseOrder.id,
                    newStatus: updatedPO.po_status,
                    totalPayments,
                    poTotal
                }, 'Purchase order status updated successfully via dynamic operations');
                return true;
            }
            else {
                logger.warn({ ponumber, newStatus }, 'Failed to update purchase order status');
                return false;
            }
        }
        catch (error) {
            logger.error({
                error: error instanceof Error ? error.message : error,
                ponumber,
                newStatus
            }, 'Error updating purchase order status by ponumber');
            throw error;
        }
    }
    /**
     * Helper method to update purchase order status based on payment amounts
     * Production-ready with comprehensive validation and error handling
     */
    async updatePurchaseOrderStatus(ponumber, currentPaymentAmount) {
        try {
            console.log('🔄 DEBUG: Starting PO status update for', ponumber, 'payment:', currentPaymentAmount);
            logger.info({ ponumber, currentPaymentAmount }, '🔄 Starting purchase order status update process');
            // Use the new validation function for better reliability
            const purchaseOrder = await this.validateAndGetPurchaseOrder(ponumber);
            if (!purchaseOrder) {
                console.log('❌ DEBUG: PO validation failed for', ponumber);
                logger.warn({ ponumber }, 'Purchase order validation failed - skipping status update');
                return;
            }
            console.log('📋 DEBUG: PO found - status:', purchaseOrder.po_status, 'total:', purchaseOrder.total);
            logger.info({
                ponumber,
                currentPOStatus: purchaseOrder.po_status,
                poTotal: purchaseOrder.total
            }, '📋 Purchase order validation successful');
            // Calculate total payments for this PO (including all existing poinvoices)
            const totalPayments = await this.calculateTotalPaymentsForPO(ponumber);
            const poTotal = purchaseOrder.total; // Already validated as number
            console.log('💰 DEBUG: Total payments calculated:', totalPayments, 'PO total:', poTotal);
            logger.info({
                ponumber,
                totalPayments,
                poTotal,
                currentPaymentAmount,
                paymentRatio: totalPayments / poTotal
            }, '💰 Payment calculation completed');
            let newStatus = 'in_progress';
            // Determine status based on total payments vs PO total with better logic
            if (totalPayments >= poTotal && totalPayments > 0 && poTotal > 0) {
                newStatus = 'fulfilled';
                console.log('✅ DEBUG: Status determined: fulfilled');
                logger.info({ ponumber, totalPayments, poTotal }, '✅ Status determined: fulfilled (total >= PO total)');
            }
            else if (totalPayments > 0 && poTotal > 0) {
                newStatus = 'partially_fulfilled';
                console.log('🟡 DEBUG: Status determined: partially_fulfilled');
                logger.info({ ponumber, totalPayments, poTotal }, '🟡 Status determined: partially_fulfilled (has payments)');
            }
            else if (totalPayments === 0) {
                newStatus = 'in_progress';
                console.log('🔵 DEBUG: Status determined: in_progress');
                logger.info({ ponumber, totalPayments }, '🔵 Status determined: in_progress (no payments)');
            }
            console.log('🎯 DEBUG: Status change check - old:', purchaseOrder.po_status, 'new:', newStatus, 'changed:', newStatus !== purchaseOrder.po_status);
            logger.info({
                ponumber,
                oldStatus: purchaseOrder.po_status,
                newStatus,
                statusChanged: newStatus !== purchaseOrder.po_status
            }, '🎯 Status determination complete');
            // Only update if status has changed
            if (newStatus !== purchaseOrder.po_status) {
                console.log('🔄 DEBUG: Status change detected - updating database');
                logger.info({ ponumber, oldStatus: purchaseOrder.po_status, newStatus }, '🔄 Status change detected - updating database');
                // Use the specialized function for updating PO status
                const updateSuccess = await this.updatePurchaseOrderStatusByPonumber(ponumber, newStatus, totalPayments, poTotal);
                if (updateSuccess) {
                    console.log('✅ DEBUG: PO status update successful');
                    logger.info({
                        ponumber,
                        currentPaymentAmount,
                        totalPayments,
                        poTotal,
                        oldStatus: purchaseOrder.po_status,
                        newStatus
                    }, '✅ Purchase order status updated successfully');
                }
                else {
                    console.log('❌ DEBUG: PO status update failed');
                    logger.error({
                        ponumber,
                        newStatus
                    }, '❌ Failed to update purchase order status');
                    throw new Error(`Failed to update purchase order status for ${ponumber}`);
                }
            }
            else {
                console.log('➡️  DEBUG: No status change needed');
                logger.info({
                    ponumber,
                    totalPayments,
                    poTotal,
                    currentStatus: purchaseOrder.po_status
                }, '➡️  Purchase order status unchanged - no update needed');
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('💥 DEBUG: Error in PO status update:', errorMessage);
            logger.error({ error, ponumber, currentPaymentAmount }, '💥 Error updating purchase order status');
            throw error;
        }
    }
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic poinvoice findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the new dynamic filtering system
            const { data: poinvoices, total } = await dynamicFindManyWithFilters('poinvoice', filters, {
                skip,
                take,
                useAllColumns: true // Get all available columns
            });
            logger.info({
                poinvoiceCount: poinvoices.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: poinvoices.length > 0 ? Object.keys(poinvoices[0]) : []
            }, 'Dynamic poinvoice findMany with filters completed');
            return createPaginationResult(poinvoices, total, page, limit);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error: errorMessage, filters, page, limit }, 'Error in dynamic poinvoice findMany operation');
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ poinvoiceId: id }, 'Starting dynamic poinvoice findById operation');
            const poinvoice = await dynamicFindUnique('poinvoice', { id });
            if (!poinvoice) {
                throw new Error('Poinvoice not found');
            }
            logger.debug({
                poinvoiceId: id,
                availableFields: Object.keys(poinvoice)
            }, 'Dynamic poinvoice findById completed');
            return poinvoice;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error: errorMessage, poinvoiceId: id }, 'Error in poinvoice findById operation');
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ originalData: data }, 'Starting dynamic poinvoice create operation');
            // Validate required fields
            if (!data.ponumber) {
                throw new Error('ponumber is required for creating poinvoice');
            }
            // Auto-set created and modified dates if not provided
            const currentTimestamp = Date.now();
            const createData = {
                ...data,
                createddate: data.createddate || currentTimestamp,
                modifieddate: data.modifieddate || currentTimestamp,
            };
            // Extract payment amount for purchase order status update
            const currentPaymentAmount = this.extractPaymentAmount(data.paymentdata);
            logger.info({
                ponumber: data.ponumber,
                currentPaymentAmount,
                paymentData: data.paymentdata
            }, '💳 Extracted payment amount from poinvoice data');
            // Create the poinvoice first
            const newPoinvoice = await dynamicCreate('poinvoice', createData);
            if (!newPoinvoice) {
                throw new Error('Failed to create poinvoice - no valid fields provided');
            }
            logger.info({
                poinvoiceId: newPoinvoice.id,
                ponumber: data.ponumber,
                currentPaymentAmount
            }, '📄 Poinvoice created successfully');
            // Update purchase order status based on payment amount AFTER poinvoice is created
            if (currentPaymentAmount > 0 && data.ponumber) {
                console.log('🚀 DEBUG: Triggering PO status update for', data.ponumber, 'with payment', currentPaymentAmount);
                logger.info({
                    ponumber: data.ponumber,
                    currentPaymentAmount
                }, '🚀 Triggering purchase order status update');
                await this.updatePurchaseOrderStatus(data.ponumber, currentPaymentAmount);
                // Update the poinvoice with the new purchase order status
                const updatedPO = await dynamicFindUnique('purchaseorder', { ponumber: data.ponumber });
                if (updatedPO) {
                    await dynamicUpdate('poinvoice', { id: newPoinvoice.id }, {
                        purchaseorderstatus: updatedPO.po_status,
                        modifieddate: currentTimestamp
                    });
                    newPoinvoice.purchaseorderstatus = updatedPO.po_status;
                    console.log('📝 DEBUG: Updated poinvoice with PO status:', updatedPO.po_status);
                    logger.info({
                        poinvoiceId: newPoinvoice.id,
                        updatedStatus: updatedPO.po_status
                    }, '📝 Updated poinvoice with new PO status');
                }
            }
            else {
                console.log('⚠️  DEBUG: Skipping PO status update - payment:', currentPaymentAmount, 'ponumber:', data.ponumber);
                logger.warn({
                    currentPaymentAmount,
                    ponumber: data.ponumber
                }, '⚠️  Skipping PO status update - no payment amount or ponumber');
            }
            logger.info({
                poinvoiceId: newPoinvoice.id,
                ponumber: data.ponumber,
                paymentAmount: currentPaymentAmount,
                availableFields: Object.keys(newPoinvoice)
            }, 'Dynamic poinvoice create completed with purchase order status update');
            return newPoinvoice;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error: errorMessage, data }, 'Error in poinvoice create operation');
            throw error;
        }
    }
    async update(id, data) {
        try {
            // Check if poinvoice exists
            await this.findById(id);
            logger.debug({ originalData: data, poinvoiceId: id }, 'Starting dynamic poinvoice update operation');
            // Auto-set modified date
            const updateData = {
                ...data,
                modifieddate: data.modifieddate || Date.now(),
            };
            const poinvoice = await dynamicUpdate('poinvoice', { id }, updateData);
            if (!poinvoice) {
                throw new Error('Failed to update poinvoice - no valid fields provided');
            }
            logger.info({
                poinvoiceId: id,
                availableFields: Object.keys(poinvoice)
            }, 'Dynamic poinvoice update completed');
            return poinvoice;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error: errorMessage, data, poinvoiceId: id }, 'Error in poinvoice update operation');
            throw error;
        }
    }
    async delete(id) {
        try {
            // Check if poinvoice exists
            await this.findById(id);
            logger.debug({ poinvoiceId: id }, 'Starting dynamic poinvoice delete operation');
            const success = await dynamicDelete('poinvoice', { id });
            if (!success) {
                throw new Error('Failed to delete poinvoice');
            }
            logger.info({ poinvoiceId: id }, 'Dynamic poinvoice delete completed successfully');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error: errorMessage, poinvoiceId: id }, 'Error in poinvoice delete operation');
            throw error;
        }
    }
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing poinvoice
                logger.debug({ poinvoiceId: id, data: updateData }, 'Upserting existing poinvoice');
                return this.update(id, updateData);
            }
            else {
                // Create new poinvoice
                logger.debug({ data: updateData }, 'Upserting new poinvoice');
                return this.create(updateData);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error: errorMessage, data }, 'Error in poinvoice upsert operation');
            throw error;
        }
    }
}
//# sourceMappingURL=poinvoice.service.js.map