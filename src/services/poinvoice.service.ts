import { prisma } from '../models/prisma.js';
import { Prisma } from '@prisma/client';
import { 
  CreatePoinvoiceInput, 
  UpdatePoinvoiceInput, 
  UpsertPoinvoiceInput
} from '../schemas/poinvoice.schema.js';
import { PaginationResult, createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
import { 
  dynamicFindMany, 
  dynamicCount, 
  dynamicFindUnique, 
  dynamicCreate, 
  dynamicUpdate, 
  dynamicDelete,
  dynamicFindManyWithFilters
} from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
import { writeFileSync } from 'fs';

console.log('🚀 POINVOICE SERVICE LOADED - This should appear when the service is imported');

// Write to a debug file to verify our code is running
try {
  writeFileSync('debug_service_loaded.txt', `Service loaded at ${new Date().toISOString()}\n`, { flag: 'a' });
} catch (e) {
  // Ignore file write errors
}

export class PoinvoiceService {
  /**
   * Helper method to extract payment amount from payment data
   * For PUT operations, supports primarily direct array format:
   * Direct array: [{paymentamount: 100}, {paymentamount: 200}]
   * Also supports: Single payment object: {paymentamount: 300}
   * Legacy support: Object with items array: {items: [{paymentamount: 100}, {paymentamount: 200}]}
   */
  private extractPaymentAmount(paymentdata: any): number {
    console.log('💳 DEBUG: Extracting payment amount from:', JSON.stringify(paymentdata));
    
    if (!paymentdata) {
      console.log('💳 DEBUG: No payment data provided');
      logger.debug('No payment data provided');
      return 0;
    }
    
    let totalPaymentAmount = 0;
    
    // Format 1: Direct array of payment objects (PRIMARY FORMAT FOR PUT)
    if (Array.isArray(paymentdata)) {
      totalPaymentAmount = paymentdata.reduce((sum, payment) => {
        const amount = parseFloat(payment.paymentamount || 0);
        const validAmount = isNaN(amount) ? 0 : amount;
        console.log('💳 DEBUG: Processing payment from direct array:', { payment, amount, validAmount });
        logger.debug({ payment, amount, validAmount }, 'Processing payment from direct array');
        return sum + validAmount;
      }, 0);
    } 
    // Format 2: Single payment object with direct paymentamount
    else if (typeof paymentdata === 'object' && paymentdata.paymentamount) {
      const amount = parseFloat(paymentdata.paymentamount || 0);
      totalPaymentAmount = isNaN(amount) ? 0 : amount;
      console.log('💳 DEBUG: Processing single payment object:', { paymentdata, amount, totalPaymentAmount });
      logger.debug({ paymentdata, amount, totalPaymentAmount }, 'Processing single payment object');
    }
    // Format 3: Legacy support - Object with items array (for backward compatibility)
    else if (typeof paymentdata === 'object' && paymentdata.items && Array.isArray(paymentdata.items)) {
      totalPaymentAmount = paymentdata.items.reduce((sum: number, payment: any) => {
        const amount = parseFloat(payment.paymentamount || 0);
        const validAmount = isNaN(amount) ? 0 : amount;
        console.log('💳 DEBUG: Processing payment from legacy items array:', { payment, amount, validAmount });
        logger.debug({ payment, amount, validAmount }, 'Processing payment from legacy items array');
        return sum + validAmount;
      }, 0);
    }
    
    console.log('💳 DEBUG: Final payment amount extracted:', totalPaymentAmount);
    
    logger.debug({ 
      paymentdata, 
      totalPaymentAmount,
      isArray: Array.isArray(paymentdata),
      isObject: typeof paymentdata === 'object',
      hasItems: paymentdata?.items ? true : false,
      format: Array.isArray(paymentdata) ? 'direct_array' : 
              (paymentdata?.paymentamount ? 'single_object' : 
               (paymentdata?.items ? 'legacy_items' : 'unknown'))
    }, 'Payment amount extraction result');
    
    return totalPaymentAmount;
  }

  /**
   * Validate purchase order exists and get its current state
   * Production-ready validation following existing project structure
   */
  private async validateAndGetPurchaseOrder(ponumber: string): Promise<any | null> {
    try {
      writeFileSync('debug_po_validation_start.txt', `Starting PO validation for ${ponumber}\n`, { flag: 'a' });
      
      // Use dynamicFindManyWithFilters since dynamicFindUnique only supports finding by ID
      const purchaseOrderResult = await dynamicFindManyWithFilters('purchaseorder', { ponumber }, {
        useAllColumns: true
      });

      writeFileSync('debug_po_validation_result.txt', `PO validation result for ${ponumber}: found ${purchaseOrderResult.data.length} records\n`, { flag: 'a' });
      
      if (!purchaseOrderResult.data || purchaseOrderResult.data.length === 0) {
        writeFileSync('debug_po_validation_details.txt', `PO not found for ponumber: ${ponumber}\n`, { flag: 'a' });
        logger.warn({ ponumber }, 'Purchase order not found during validation');
        return null;
      }

      const purchaseOrder = purchaseOrderResult.data[0]; // Get the first (and should be only) result

      // Validate PO total is a valid number
      const poTotal = parseFloat(purchaseOrder.total || 0);
      if (isNaN(poTotal) || poTotal < 0) {
        writeFileSync('debug_po_validation_invalid_total.txt', `Invalid PO total for ${ponumber}: ${purchaseOrder.total}\n`, { flag: 'a' });
        logger.warn({ ponumber, total: purchaseOrder.total }, 'Invalid purchase order total detected');
        return null;
      }

      writeFileSync('debug_po_validation_success.txt', `PO validation success for ${ponumber}: status=${purchaseOrder.po_status}, total=${poTotal}\n`, { flag: 'a' });

      return {
        ...purchaseOrder,
        total: poTotal
      };
    } catch (error) {
      writeFileSync('debug_po_validation_error.txt', `PO validation error for ${ponumber}: ${error}\n`, { flag: 'a' });
      logger.error({ error, ponumber }, 'Error validating purchase order');
      throw error;
    }
  }

  /**
   * Helper method to calculate total payments for a ponumber
   */
  private async calculateTotalPaymentsForPO(ponumber: string): Promise<number> {
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
    } catch (error) {
      logger.error({ error, ponumber }, '❌ Error calculating total payments for PO');
      return 0;
    }
  }

  /**
   * Specialized function to update purchase order status by ponumber
   * Uses existing dynamicDbOperations following the project structure
   */
  private async updatePurchaseOrderStatusByPonumber(
    ponumber: string, 
    newStatus: string, 
    totalPayments: number, 
    poTotal: number
  ): Promise<boolean> {
    try {
      writeFileSync('debug_po_update_start.txt', `Starting PO update for ${ponumber} to status ${newStatus}\n`, { flag: 'a' });
      
      logger.info({ 
        ponumber, 
        newStatus, 
        totalPayments, 
        poTotal 
      }, 'Updating purchase order status by ponumber using dynamic operations');

      // First get the purchase order to get its ID (since dynamicUpdate needs ID)
      const purchaseOrderResult = await dynamicFindManyWithFilters('purchaseorder', { ponumber }, {
        useAllColumns: true
      });
      
      if (!purchaseOrderResult.data || purchaseOrderResult.data.length === 0) {
        writeFileSync('debug_po_update_not_found.txt', `PO not found for update: ${ponumber}\n`, { flag: 'a' });
        logger.warn({ ponumber, newStatus }, 'Purchase order not found for update');
        return false;
      }

      const purchaseOrder = purchaseOrderResult.data[0];
      writeFileSync('debug_po_update_found.txt', `PO found for update: ${ponumber}, ID: ${purchaseOrder.id}\n`, { flag: 'a' });

      // Use existing dynamicUpdate with the correct ID
      const updatedPO = await dynamicUpdate('purchaseorder', { id: purchaseOrder.id }, { 
        po_status: newStatus,
        modifieddate: Math.floor(Date.now() / 1000)
      });
      
      writeFileSync('debug_po_update_result.txt', `PO update result: ${updatedPO ? 'SUCCESS' : 'FAILED'}\n`, { flag: 'a' });
      
      if (updatedPO) {
        writeFileSync('debug_po_update_success.txt', `Successfully updated PO ${ponumber} to status ${newStatus}\n`, { flag: 'a' });
        logger.info({ 
          ponumber, 
          updatedId: purchaseOrder.id,
          newStatus: updatedPO.po_status,
          totalPayments,
          poTotal
        }, 'Purchase order status updated successfully via dynamic operations');
        return true;
      } else {
        writeFileSync('debug_po_update_failed.txt', `Failed to update PO ${ponumber} - dynamicUpdate returned null\n`, { flag: 'a' });
        logger.warn({ ponumber, newStatus }, 'Failed to update purchase order status');
        return false;
      }
    } catch (error) {
      writeFileSync('debug_po_update_error.txt', `Error updating PO ${ponumber}: ${error}\n`, { flag: 'a' });
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
  private async updatePurchaseOrderStatus(ponumber: string, currentPaymentAmount: number): Promise<void> {
    try {
      writeFileSync('debug_status_update_start.txt', `Starting status update for ${ponumber} with payment ${currentPaymentAmount}\n`, { flag: 'a' });
      
      console.log('🔄 DEBUG: Starting PO status update for', ponumber, 'payment:', currentPaymentAmount);
      
      logger.info({ ponumber, currentPaymentAmount }, '🔄 Starting purchase order status update process');
      
      // Use the new validation function for better reliability
      const purchaseOrder = await this.validateAndGetPurchaseOrder(ponumber);
      
      if (!purchaseOrder) {
        writeFileSync('debug_po_validation_failed.txt', `PO validation failed for ${ponumber}\n`, { flag: 'a' });
        console.log('❌ DEBUG: PO validation failed for', ponumber);
        logger.warn({ ponumber }, 'Purchase order validation failed - skipping status update');
        return;
      }

      writeFileSync('debug_po_found.txt', `PO found: ${ponumber}, status: ${purchaseOrder.po_status}, total: ${purchaseOrder.total}\n`, { flag: 'a' });
      console.log('📋 DEBUG: PO found - status:', purchaseOrder.po_status, 'total:', purchaseOrder.total);
      
      logger.info({ 
        ponumber, 
        currentPOStatus: purchaseOrder.po_status,
        poTotal: purchaseOrder.total 
      }, '📋 Purchase order validation successful');

      // Calculate total payments for this PO (including all existing poinvoices)
      const totalPayments = await this.calculateTotalPaymentsForPO(ponumber);
      const poTotal = purchaseOrder.total; // Already validated as number

      writeFileSync('debug_payment_calculation.txt', `Total payments: ${totalPayments}, PO total: ${poTotal}\n`, { flag: 'a' });
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
      } else if (totalPayments > 0 && poTotal > 0) {
        newStatus = 'partially_fulfilled';
        console.log('🟡 DEBUG: Status determined: partially_fulfilled');
        logger.info({ ponumber, totalPayments, poTotal }, '🟡 Status determined: partially_fulfilled (has payments)');
      } else if (totalPayments === 0) {
        newStatus = 'in_progress';
        console.log('🔵 DEBUG: Status determined: in_progress');
        logger.info({ ponumber, totalPayments }, '🔵 Status determined: in_progress (no payments)');
      }

      writeFileSync('debug_status_determination.txt', `Old status: ${purchaseOrder.po_status}, New status: ${newStatus}, Changed: ${newStatus !== purchaseOrder.po_status}\n`, { flag: 'a' });
      console.log('🎯 DEBUG: Status change check - old:', purchaseOrder.po_status, 'new:', newStatus, 'changed:', newStatus !== purchaseOrder.po_status);

      logger.info({ 
        ponumber, 
        oldStatus: purchaseOrder.po_status,
        newStatus,
        statusChanged: newStatus !== purchaseOrder.po_status
      }, '🎯 Status determination complete');

      // Only update if status has changed
      if (newStatus !== purchaseOrder.po_status) {
        writeFileSync('debug_status_update_attempt.txt', `Attempting to update status from ${purchaseOrder.po_status} to ${newStatus}\n`, { flag: 'a' });
        console.log('🔄 DEBUG: Status change detected - updating database');
        
        logger.info({ ponumber, oldStatus: purchaseOrder.po_status, newStatus }, '🔄 Status change detected - updating database');
        
        // Use the specialized function for updating PO status
        writeFileSync('debug_calling_po_update.txt', `About to call updatePurchaseOrderStatusByPonumber with ${ponumber}, ${newStatus}\n`, { flag: 'a' });
        
        const updateSuccess = await this.updatePurchaseOrderStatusByPonumber(
          ponumber, 
          newStatus, 
          totalPayments, 
          poTotal
        );

        writeFileSync('debug_po_update_returned.txt', `updatePurchaseOrderStatusByPonumber returned: ${updateSuccess}\n`, { flag: 'a' });

        if (updateSuccess) {
          writeFileSync('debug_status_update_success.txt', `Successfully updated status to ${newStatus}\n`, { flag: 'a' });
          console.log('✅ DEBUG: PO status update successful');
          
          logger.info({ 
            ponumber, 
            currentPaymentAmount, 
            totalPayments, 
            poTotal, 
            oldStatus: purchaseOrder.po_status,
            newStatus 
          }, '✅ Purchase order status updated successfully');
        } else {
          writeFileSync('debug_status_update_failed.txt', `Failed to update status to ${newStatus}\n`, { flag: 'a' });
          console.log('❌ DEBUG: PO status update failed');
          
          logger.error({ 
            ponumber, 
            newStatus 
          }, '❌ Failed to update purchase order status');
          throw new Error(`Failed to update purchase order status for ${ponumber}`);
        }
      } else {
        writeFileSync('debug_status_unchanged.txt', `Status unchanged: ${purchaseOrder.po_status}\n`, { flag: 'a' });
        console.log('➡️  DEBUG: No status change needed');
        
        logger.info({ 
          ponumber, 
          totalPayments, 
          poTotal, 
          currentStatus: purchaseOrder.po_status 
        }, '➡️  Purchase order status unchanged - no update needed');
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      writeFileSync('debug_status_update_error.txt', `Error in status update: ${errorMessage}\n`, { flag: 'a' });
      console.log('💥 DEBUG: Error in PO status update:', errorMessage);
      
      logger.error({ error, ponumber, currentPaymentAmount }, '💥 Error updating purchase order status');
      throw error;
    }
  }

  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, filters, page, limit }, 'Error in dynamic poinvoice findMany operation');
      throw error;
    }
  }

  async findById(id: string) {
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, poinvoiceId: id }, 'Error in poinvoice findById operation');
      throw error;
    }
  }

  async create(data: CreatePoinvoiceInput & Record<string, any>) {
    try {
      // Write debug info to file
      writeFileSync('debug_create_called.txt', `Create method called at ${new Date().toISOString()} with data: ${JSON.stringify(data, null, 2)}\n`, { flag: 'a' });
      
      console.log('💳 DEBUG: CREATE METHOD CALLED with data:', JSON.stringify(data, null, 2));
      
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
      
      // Write debug info to file
      writeFileSync('debug_payment_extraction.txt', `Payment extracted: ${currentPaymentAmount} from data: ${JSON.stringify(data.paymentdata)}\n`, { flag: 'a' });
      
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
        writeFileSync('debug_status_update_trigger.txt', `Triggering status update for ${data.ponumber} with payment ${currentPaymentAmount}\n`, { flag: 'a' });
        
        console.log('🚀 DEBUG: Triggering PO status update for', data.ponumber, 'with payment', currentPaymentAmount);
        
        logger.info({ 
          ponumber: data.ponumber, 
          currentPaymentAmount 
        }, '🚀 Triggering purchase order status update');
        
        await this.updatePurchaseOrderStatus(data.ponumber as string, currentPaymentAmount);
        
        // Update the poinvoice with the new purchase order status
        const updatedPOResult = await dynamicFindManyWithFilters('purchaseorder', { ponumber: data.ponumber }, {
          useAllColumns: true
        });
        if (updatedPOResult.data && updatedPOResult.data.length > 0) {
          const updatedPO = updatedPOResult.data[0];
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
      } else {
        writeFileSync('debug_status_update_skip.txt', `Skipping status update - payment: ${currentPaymentAmount}, ponumber: ${data.ponumber}\n`, { flag: 'a' });
        
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, data }, 'Error in poinvoice create operation');
      throw error;
    }
  }

  async update(id: string, data: UpdatePoinvoiceInput & Record<string, any>) {
    try {
      // Check if poinvoice exists
      await this.findById(id);

      // Write debug info to file
      writeFileSync('debug_update_start.txt', `Update method called for ID ${id} with data: ${JSON.stringify(data, null, 2)}\n`, { flag: 'a' });
      
      logger.debug({ originalData: data, poinvoiceId: id }, 'Starting dynamic poinvoice update operation');

      // Auto-set modified date
      const updateData = {
        ...data,
        modifieddate: data.modifieddate || Date.now(),
      };

      writeFileSync('debug_update_data.txt', `Update data after modifieddate: ${JSON.stringify(updateData, null, 2)}\n`, { flag: 'a' });

      const poinvoice = await dynamicUpdate('poinvoice', { id }, updateData);

      if (!poinvoice) {
        writeFileSync('debug_update_failed.txt', `dynamicUpdate returned null for ID ${id}\n`, { flag: 'a' });
        throw new Error('Failed to update poinvoice - no valid fields provided');
      }

      writeFileSync('debug_update_success.txt', `Update successful for ID ${id}: ${JSON.stringify(poinvoice, null, 2)}\n`, { flag: 'a' });

      logger.info({ 
        poinvoiceId: id, 
        availableFields: Object.keys(poinvoice) 
      }, 'Dynamic poinvoice update completed');

      return poinvoice;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      writeFileSync('debug_update_error.txt', `Update error for ID ${id}: ${errorMessage}\n`, { flag: 'a' });
      logger.error({ error: errorMessage, data, poinvoiceId: id }, 'Error in poinvoice update operation');
      throw error;
    }
  }

  async delete(id: string) {
    try {
      // Check if poinvoice exists
      await this.findById(id);

      logger.debug({ poinvoiceId: id }, 'Starting dynamic poinvoice delete operation');

      const success = await dynamicDelete('poinvoice', { id });

      if (!success) {
        throw new Error('Failed to delete poinvoice');
      }

      logger.info({ poinvoiceId: id }, 'Dynamic poinvoice delete completed successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, poinvoiceId: id }, 'Error in poinvoice delete operation');
      throw error;
    }
  }

  async upsert(data: UpsertPoinvoiceInput & Record<string, any>) {
    try {
      const { id, ...updateData } = data;

      if (id) {
        // Update existing poinvoice
        logger.debug({ poinvoiceId: id, data: updateData }, 'Upserting existing poinvoice');
        return this.update(id, updateData);
      } else {
        // Create new poinvoice
        logger.debug({ data: updateData }, 'Upserting new poinvoice');
        return this.create(updateData);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, data }, 'Error in poinvoice upsert operation');
      throw error;
    }
  }
} 