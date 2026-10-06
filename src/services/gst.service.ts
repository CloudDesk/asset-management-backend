import axios from 'axios';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import {
  dynamicFindManyWithFilters,
  dynamicFindUnique,
  dynamicUpdate
} from '../utils/dynamicDbOperations.js';
import { EkartService } from './ekart.service.js';
import { prisma } from '../models/prisma.js';

/**
 * GST/HSN Mapping Service
 * Handles GST lookup, calculation, and state-based GST type determination
 */

export interface GstCalculationResult {
  hsn_code: string | null;
  gst_rate: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_gst_amount: number;
}

export interface OrderGstTotals {
  items_total: number;
  total_taxable_amount: number;
  total_cgst_amount: number;
  total_sgst_amount: number;
  total_igst_amount: number;
  total_gst_amount: number;
}

export interface GstTypeResult {
  gst_type: 'INTRA-STATE' | 'INTER-STATE';
  cgst: boolean;
  sgst: boolean;
  igst: boolean;
  fromState: string | null;
  toState: string | null;
  error?: string;
}

export class GstService {
  private ekartService: EkartService;

  constructor() {
    this.ekartService = new EkartService();
  }

  /**
   * Get state from pincode using postal pincode API
   * 
   * @param pincode - 6-digit pincode string or number
   * @returns State name or null if error
   */
  async getStateFromPincode(pincode: string | number | null | undefined): Promise<string | null> {
    if (!pincode) {
      logger.debug({ pincode }, 'Pincode is null/undefined');
      return null;
    }

    const pin = pincode.toString().trim();

    // Validate 6-digit pincode
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      logger.debug({ pincode: pin }, 'Invalid pincode format');
      return null;
    }

    try {
      const url = `https://api.postalpincode.in/pincode/${pin}`;
      logger.debug({ url, pincode: pin }, 'Fetching state from postal pincode API');

      const response = await axios.get(url);

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        logger.warn({ pincode: pin }, 'Invalid response from postal pincode API');
        return null;
      }

      if (response.data[0].Status !== 'Success') {
        logger.warn({
          pincode: pin,
          status: response.data[0].Status,
          message: response.data[0].Message
        }, 'Postal pincode API returned non-success status');
        return null;
      }

      const postOffice = response.data[0].PostOffice?.[0];
      const state = postOffice?.State || null;

      logger.debug({
        pincode: pin,
        state,
        postOffice: postOffice ? {
          name: postOffice.Name,
          district: postOffice.District,
          state: postOffice.State
        } : null
      }, 'State retrieved from postal pincode API');

      return state;
    } catch (error: any) {
      logger.error({
        error: error.message,
        pincode: pin
      }, 'Error fetching state from postal pincode API');
      return null;
    }
  }

  /**
   * Get warehouse pincode from EKART addresses
   * Falls back to WAREHOUSE_PINCODE env variable if EKART is unavailable
   * 
   * @param alias - Optional alias to filter address (defaults to first address)
   * @returns Warehouse pincode or null
   */
  async getWarehousePincode(alias?: string): Promise<string | null> {
    try {
      logger.info({ alias: alias || 'first address' }, 'Fetching warehouse address from EKART');

      const addresses = await this.ekartService.getAddresses();

      if (!addresses || addresses.length === 0) {
        logger.warn('No addresses found in EKART, checking fallback pincode');
        return this.getFallbackWarehousePincode();
      }

      // Find address by alias if provided, otherwise use first address
      const address = alias
        ? addresses.find(addr => addr.alias.toLowerCase() === alias.toLowerCase())
        : addresses[0];

      if (!address) {
        logger.warn({
          requestedAlias: alias,
          availableAliases: addresses.map(a => a.alias)
        }, 'Address with alias not found, using first address');
        const firstAddress = addresses[0];
        if (!firstAddress) {
          logger.warn('No valid address found, checking fallback pincode');
          return this.getFallbackWarehousePincode();
        }
        const pincode = firstAddress.pincode?.toString() || null;
        logger.info({
          pincode,
          address: firstAddress.alias,
          state: firstAddress.state
        }, 'Using first EKART address as warehouse');
        return pincode;
      }

      const pincode = address.pincode?.toString() || null;
      logger.info({
        pincode,
        alias: address.alias,
        state: address.state
      }, 'Warehouse pincode retrieved from EKART');

      return pincode;
    } catch (error: any) {
      // Handle different types of errors
      const errorStatus = error.response?.status;
      const errorCode = error.response?.data?.code;

      if (errorStatus === 401 || errorStatus === 403) {
        logger.error({
          error: error.message,
          status: errorStatus,
          code: errorCode,
          alias
        }, '⚠️ EKART authentication failed - cannot fetch warehouse address. Using fallback pincode.');
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        logger.error({
          error: error.message,
          code: error.code,
          alias
        }, '⚠️ EKART service unavailable (connection error). Using fallback pincode.');
      } else {
        logger.error({
          error: error.message,
          status: errorStatus,
          code: errorCode,
          alias
        }, '⚠️ Error fetching warehouse pincode from EKART. Using fallback pincode.');
      }

      // Always fallback to env variable
      return this.getFallbackWarehousePincode();
    }
  }

  /**
   * Get fallback warehouse pincode from environment variable
   * 
   * @returns Warehouse pincode from env or null
   */
  private getFallbackWarehousePincode(): string | null {
    const fallbackPincode = env.WAREHOUSE_PINCODE;

    if (fallbackPincode) {
      const pin = fallbackPincode.trim();
      // Validate 6-digit pincode
      if (pin.length === 6 && /^\d{6}$/.test(pin)) {
        logger.info({
          pincode: pin,
          source: 'ENV_WAREHOUSE_PINCODE'
        }, '✅ Using fallback warehouse pincode from environment variable');
        return pin;
      } else {
        logger.warn({
          pincode: pin
        }, '⚠️ WAREHOUSE_PINCODE env variable is invalid (must be 6 digits). Ignoring.');
      }
    } else {
      logger.warn('⚠️ No WAREHOUSE_PINCODE env variable set. GST type will default to INTER-STATE.');
    }

    return null;
  }

  /**
   * Determine GST type (INTRA-STATE or INTER-STATE) by comparing states
   * 
   * @param fromPincode - Warehouse/seller pincode
   * @param toPincode - Delivery/destination pincode
   * @returns GST type result with CGST/SGST/IGST flags
   */
  async getGstType(
    fromPincode: string | number | null | undefined,
    toPincode: string | number | null | undefined
  ): Promise<GstTypeResult> {
    try {
      logger.info({ fromPincode, toPincode }, 'Determining GST type from pincodes');

      const fromState = await this.getStateFromPincode(fromPincode);
      const toState = await this.getStateFromPincode(toPincode);

      if (!fromState || !toState) {
        const missingPincode = !fromState ? 'warehouse' : 'delivery';
        logger.warn({
          fromPincode,
          toPincode,
          fromState,
          toState,
          missingPincode
        }, `⚠️ Cannot determine state for ${missingPincode} pincode - defaulting to INTER-STATE (IGST)`);

        return {
          gst_type: 'INTER-STATE', // Default to INTER-STATE (IGST) if error
          cgst: false,
          sgst: false,
          igst: true,
          fromState,
          toState,
          error: `Invalid ${missingPincode} pincode or postal API unavailable`
        };
      }

      const isSameState = fromState.toLowerCase() === toState.toLowerCase();

      const result: GstTypeResult = {
        gst_type: isSameState ? 'INTRA-STATE' : 'INTER-STATE',
        cgst: isSameState,
        sgst: isSameState,
        igst: !isSameState,
        fromState,
        toState
      };

      logger.info({
        fromPincode,
        toPincode,
        fromState,
        toState,
        gst_type: result.gst_type,
        cgst: result.cgst,
        sgst: result.sgst,
        igst: result.igst
      }, 'GST type determined');

      return result;
    } catch (error: any) {
      logger.error({
        error: error.message,
        stack: error.stack,
        fromPincode,
        toPincode
      }, '⚠️ Critical error determining GST type - defaulting to INTER-STATE (IGST)');

      return {
        gst_type: 'INTER-STATE', // Default to INTER-STATE (IGST) on error
        cgst: false,
        sgst: false,
        igst: true,
        fromState: null,
        toState: null,
        error: `GST type determination failed: ${error.message}`
      };
    }
  }

  /**
   * Round to 2 decimal places
   */
  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Calculate GST amounts for an orderline
   * 
   * GST-INCLUSIVE PRICING FORMULA:
   * - orderamount is the GST-inclusive total amount (what customer pays for product)
   * - taxable_amount = orderamount / (1 + gst_rate/100)
   * - total_gst_amount = orderamount - taxable_amount
   * 
   * Example: orderamount = 598.15, gst_rate = 5%
   * - taxable_amount = 598.15 / 1.05 = 569.67
   * - total_gst_amount = 598.15 - 569.67 = 28.48
   * 
   * @param orderamount - Total amount AFTER discount (NOT including shipping)
   * @param gstRate - GST rate from mapping (e.g., 5, 18)
   * @param gstType - GST type result (INTRA-STATE or INTER-STATE)
   * @returns GST breakdown with taxable amount and GST components
   */
  calculateGstAmounts(
    orderamount: number,
    gstRate: number,
    gstType: GstTypeResult
  ): GstCalculationResult {
    // Handle edge cases
    if (!orderamount || orderamount <= 0) {
      return {
        hsn_code: null,
        gst_rate: gstRate,
        taxable_amount: 0,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        total_gst_amount: 0
      };
    }

    // GST-INCLUSIVE PRICING FORMULA:
    // Given: orderamount (GST-inclusive price)
    // Given: gst_rate (e.g., 5% or 18%)
    // Formula: taxable_amount = orderamount / (1 + gst_rate/100)
    // Then: total_gst_amount = orderamount - taxable_amount
    const taxable_amount = orderamount / (1 + gstRate / 100);
    const total_gst_amount = orderamount - taxable_amount;

    let cgst_amount = 0;
    let sgst_amount = 0;
    let igst_amount = 0;

    if (gstType.gst_type === 'INTRA-STATE' && gstType.cgst && gstType.sgst) {
      // Same state: CGST + SGST (split equally)
      cgst_amount = total_gst_amount / 2;
      sgst_amount = total_gst_amount / 2;
    } else {
      // Different state: IGST (full GST amount)
      igst_amount = total_gst_amount;
    }

    const result: GstCalculationResult = {
      hsn_code: null, // Will be set by caller
      gst_rate: this.round(gstRate),
      taxable_amount: this.round(taxable_amount),
      cgst_amount: this.round(cgst_amount),
      sgst_amount: this.round(sgst_amount),
      igst_amount: this.round(igst_amount),
      total_gst_amount: this.round(total_gst_amount)
    };

    logger.debug({
      input: { orderamount, gstRate, gst_type: gstType.gst_type, fromState: gstType.fromState, toState: gstType.toState },
      output: result,
      verification: {
        taxable_plus_gst: this.round(result.taxable_amount + result.total_gst_amount),
        equals_orderamount: this.round(result.taxable_amount + result.total_gst_amount) === this.round(orderamount)
      }
    }, 'GST calculation completed');

    return result;
  }

  /**
   * Calculate GST for a single orderline
   * 
   * @param orderamount - Orderline amount (GST-inclusive, excludes shipping)
   * @param gstType - GST type result (INTRA-STATE or INTER-STATE)
   * @returns GST calculation result with HSN code
   */
  async calculateGstForOrderline(
    orderamount: number,
    gstType: GstTypeResult,
    taxSnapshot: { hsn_code: string | null; gst_rate: number | null }
  ): Promise<GstCalculationResult> {
    logger.info({
      orderamount,
      gst_type: gstType.gst_type,
      note: 'orderamount should be TOTAL for line item (includes quantity), not per-unit'
    }, 'Calculating GST for orderline');

    const hsn_code = taxSnapshot.hsn_code?.trim() || null;
    const gst_rate = taxSnapshot.gst_rate;
    if (!hsn_code || gst_rate === null || !Number.isFinite(gst_rate) || gst_rate < 0 || gst_rate > 100) {
      throw new Error('Orderline is missing its mandatory immutable HSN/GST snapshot');
    }

    // 3. Calculate GST amounts
    const gstResult = this.calculateGstAmounts(orderamount, gst_rate, gstType);

    // 4. Add HSN code to result
    gstResult.hsn_code = hsn_code;

    logger.info({
      hsn_code,
      gst_rate,
      source: 'orderline_snapshot',
      orderamount,
      gst_type: gstType.gst_type,
      fromState: gstType.fromState,
      toState: gstType.toState,
      result: gstResult
    }, 'GST calculated for orderline');

    return gstResult;
  }

  /**
   * Calculate GST for all orderlines and aggregate to order level
   * 
   * @param orderlines - Array of orderlines with productid and orderamount
   * @param shippingCost - Order shipping cost (to calculate items_total)
   * @param orderAmount - Total order amount (includes shipping)
   * @param warehousePincode - Warehouse/seller pincode (from EKART)
   * @param deliveryPincode - Delivery address pincode
   * @param warehouseAlias - Optional alias to filter warehouse address
   * @returns Object with orderline GST data and order GST totals
   */
  async calculateGstForOrder(
    orderlines: Array<{
      id: number;
      productid: number | bigint;
      orderamount: number;
      hsn_code: string | null;
      gst_rate: number | null;
    }>,
    shippingCost: number,
    orderAmount: number,
    warehousePincode: string | number | null | undefined,
    deliveryPincode: string | number | null | undefined,
    warehouseAlias?: string
  ): Promise<{
    orderlineGst: Array<{ orderlineId: number; gst: GstCalculationResult }>;
    orderTotals: OrderGstTotals;
    gstType: GstTypeResult;
  }> {
    // Get warehouse pincode from EKART if not provided
    let fromPincode = warehousePincode;
    if (!fromPincode) {
      logger.info({ warehouseAlias }, 'Warehouse pincode not provided, fetching from EKART');
      fromPincode = await this.getWarehousePincode(warehouseAlias);

      if (!fromPincode) {
        logger.warn({
          warehouseAlias,
          hasEnvFallback: !!env.WAREHOUSE_PINCODE
        }, '⚠️ Warehouse pincode unavailable from EKART and no fallback configured. GST will default to INTER-STATE.');
      }
    }

    // Determine GST type by comparing states
    const gstType = await this.getGstType(fromPincode, deliveryPincode);

    logger.info({
      orderlinesCount: orderlines.length,
      shippingCost,
      orderAmount,
      warehousePincode: fromPincode,
      deliveryPincode,
      gst_type: gstType.gst_type,
      fromState: gstType.fromState,
      toState: gstType.toState
    }, 'Starting GST calculation for order');

    // Calculate GST for each orderline
    const orderlineGst: Array<{ orderlineId: number; gst: GstCalculationResult }> = [];

    for (const orderline of orderlines) {
      const gst = await this.calculateGstForOrderline(
        orderline.orderamount,
        gstType,
        { hsn_code: orderline.hsn_code, gst_rate: orderline.gst_rate }
      );

      orderlineGst.push({
        orderlineId: orderline.id,
        gst
      });
    }

    // Aggregate to order level
    const items_total = this.round(orderAmount - shippingCost); // Product-only total

    const total_taxable_amount = this.round(
      orderlineGst.reduce((sum, ol) => sum + ol.gst.taxable_amount, 0)
    );

    const total_cgst_amount = this.round(
      orderlineGst.reduce((sum, ol) => sum + ol.gst.cgst_amount, 0)
    );

    const total_sgst_amount = this.round(
      orderlineGst.reduce((sum, ol) => sum + ol.gst.sgst_amount, 0)
    );

    const total_igst_amount = this.round(
      orderlineGst.reduce((sum, ol) => sum + ol.gst.igst_amount, 0)
    );

    const total_gst_amount = this.round(
      orderlineGst.reduce((sum, ol) => sum + ol.gst.total_gst_amount, 0)
    );

    const orderTotals: OrderGstTotals = {
      items_total,
      total_taxable_amount,
      total_cgst_amount,
      total_sgst_amount,
      total_igst_amount,
      total_gst_amount
    };

    // Verification logging
    const sumOrderlineAmounts = this.round(
      orderlines.reduce((sum, ol) => sum + ol.orderamount, 0)
    );

    logger.info({
      orderTotals,
      verification: {
        items_total_matches_sum: items_total === sumOrderlineAmounts,
        taxable_plus_gst_equals_items_total:
          this.round(total_taxable_amount + total_gst_amount) === items_total,
        cgst_sgst_igst_equals_total_gst:
          this.round(total_cgst_amount + total_sgst_amount + total_igst_amount) === total_gst_amount,
        order_amount_equals_items_plus_shipping:
          this.round(items_total + shippingCost) === this.round(orderAmount)
      },
      gst_type: gstType.gst_type,
      fromState: gstType.fromState,
      toState: gstType.toState,
      orderlinesProcessed: orderlineGst.length
    }, 'GST calculation for order completed');

    return { orderlineGst, orderTotals, gstType };
  }

  /**
   * Update orderlines with GST data
   * Uses dynamicUpdate for consistent operations
   * 
   * @param orderlineGst - Array of orderline GST data
   */
  async updateOrderlinesWithGst(
    orderlineGst: Array<{ orderlineId: number; gst: GstCalculationResult }>
  ): Promise<void> {
    const currentTime = Date.now();

    await prisma.$transaction(orderlineGst.map(({ orderlineId, gst }) =>
      prisma.orderline.update({
        where: { id: orderlineId },
        data: {
          hsn_code: gst.hsn_code,
          gst_rate: gst.gst_rate,
          taxable_amount: gst.taxable_amount,
          cgst_amount: gst.cgst_amount,
          sgst_amount: gst.sgst_amount,
          igst_amount: gst.igst_amount,
          total_gst_amount: gst.total_gst_amount,
          modifieddate: currentTime,
        },
      })
    ));
  }

  async persistOrderGst(
    orderId: number,
    orderlineGst: Array<{ orderlineId: number; gst: GstCalculationResult }>,
    orderTotals: OrderGstTotals
  ): Promise<void> {
    const currentTime = Date.now();
    await prisma.$transaction(async (tx) => {
      for (const { orderlineId, gst } of orderlineGst) {
        await tx.orderline.update({
          where: { id: orderlineId },
          data: {
            hsn_code: gst.hsn_code,
            gst_rate: gst.gst_rate,
            taxable_amount: gst.taxable_amount,
            cgst_amount: gst.cgst_amount,
            sgst_amount: gst.sgst_amount,
            igst_amount: gst.igst_amount,
            total_gst_amount: gst.total_gst_amount,
            modifieddate: currentTime,
          },
        });
      }
      await tx.orders.update({
        where: { id: orderId },
        data: {
          items_total: orderTotals.items_total,
          total_taxable_amount: orderTotals.total_taxable_amount,
          total_cgst_amount: orderTotals.total_cgst_amount,
          total_sgst_amount: orderTotals.total_sgst_amount,
          total_igst_amount: orderTotals.total_igst_amount,
          total_gst_amount: orderTotals.total_gst_amount,
          modifieddate: currentTime,
        },
      });
    });
  }

  /**
   * Update order with GST totals
   * Uses dynamicUpdate for consistent operations
   * 
   * @param orderId - Order ID
   * @param orderTotals - Aggregated GST totals
   */
  async updateOrderWithGst(
    orderId: number,
    orderTotals: OrderGstTotals
  ): Promise<void> {
    const currentTime = Date.now();

    try {
      await dynamicUpdate(
        'orders',
        { id: orderId },
        {
          items_total: orderTotals.items_total,
          total_taxable_amount: orderTotals.total_taxable_amount,
          total_cgst_amount: orderTotals.total_cgst_amount,
          total_sgst_amount: orderTotals.total_sgst_amount,
          total_igst_amount: orderTotals.total_igst_amount,
          total_gst_amount: orderTotals.total_gst_amount,
          modifieddate: currentTime
        }
      );

      logger.info({
        orderId,
        orderTotals
      }, 'Order updated with GST totals');
    } catch (error) {
      logger.error({
        error,
        orderId,
        orderTotals
      }, 'Error updating order with GST totals');
      throw error;
    }
  }

  /**
   * Get delivery pincode from address ID
   * 
   * @param addressId - Address ID
   * @returns Pincode string or null
   */
  async getDeliveryPincode(addressId: number | null | undefined): Promise<string | null> {
    if (!addressId) return null;

    try {
      const address = await dynamicFindUnique('address', { id: addressId });

      return address?.pincode?.toString() || null;
    } catch (error) {
      logger.error({
        error,
        addressId
      }, 'Error fetching delivery pincode');
      return null;
    }
  }

  /**
   * Complete GST calculation and update for an order
   * This is the main entry point for GST calculation after order creation
   * 
   * @param orderId - Order ID
   * @param addressId - Delivery address ID
   * @param orderAmount - Total order amount (includes shipping)
   * @param shippingCost - Shipping cost
   * @param warehouseAlias - Optional alias to filter warehouse address from EKART
   * @param warehousePincode - Optional warehouse pincode (if not provided, fetched from EKART)
   * @returns Result with order totals and GST type
   */
  async processOrderGst(
    orderId: number,
    addressId: number | null | undefined,
    orderAmount: number,
    shippingCost: number,
    warehouseAlias?: string,
    warehousePincode?: string | number | null
  ): Promise<{
    success: boolean;
    orderTotals?: OrderGstTotals;
    gstType?: GstTypeResult;
    error?: string;
  }> {
    try {
      logger.info({
        orderId,
        addressId,
        orderAmount,
        shippingCost,
        warehouseAlias,
        warehousePincode
      }, 'Starting GST processing for order');

      // 1. Get delivery pincode
      const deliveryPincode = await this.getDeliveryPincode(addressId);

      if (!deliveryPincode) {
        logger.warn({ orderId, addressId }, 'Delivery pincode not found');
        return { success: false, error: 'Delivery pincode not found' };
      }

      // 2. Get orderlines for this order using dynamic operation
      const { data: orderlines } = await dynamicFindManyWithFilters(
        'orderline',
        { orderid: orderId },
        { take: 100, useAllColumns: true }
      );

      if (!orderlines || orderlines.length === 0) {
        logger.warn({ orderId }, 'No orderlines found for GST calculation');
        return { success: false, error: 'No orderlines found' };
      }

      // 3. Calculate GST (warehouse pincode will be fetched from EKART if not provided)
      // IMPORTANT: orderamount is ALWAYS the total for the line item (quantity * unit price after discounts)
      // According to PHONEPE_PAYMENT_IMPLEMENTATION_GUIDE.md: "orderamount is Final item amount"
      // This means orderamount already includes quantity, so we use it directly for GST calculation
      const { orderlineGst, orderTotals, gstType } = await this.calculateGstForOrder(
        orderlines.map((ol: any) => {
          const orderamount = parseFloat(ol.orderamount?.toString() || '0');
          const quantity = parseFloat(ol.quantity?.toString() || '1');

          // orderamount is already the total for the line item (includes quantity)
          // Example: If quantity=2 and unit price=300, orderamount=600 (not 300)
          // We use orderamount directly for GST calculation
          logger.debug({
            orderlineId: ol.id,
            productid: ol.productid,
            orderamount,
            quantity,
            verification: {
              orderamount_is_total: orderamount,
              quantity: quantity,
              expected_per_unit: quantity > 0 ? (orderamount / quantity).toFixed(2) : 'N/A',
              note: 'orderamount MUST be TOTAL for line item (quantity × unit price after discounts)'
            }
          }, 'GST calculation: using orderamount as total for line item');

          return {
            id: ol.id,
            productid: ol.productid ? Number(ol.productid) : 0,
            orderamount: orderamount, // Use orderamount directly (already includes quantity)
            hsn_code: ol.hsn_code ? String(ol.hsn_code) : null,
            gst_rate: ol.gst_rate === null || ol.gst_rate === undefined
              ? null
              : Number(ol.gst_rate),
          };
        }),
        shippingCost,
        orderAmount,
        warehousePincode,
        deliveryPincode,
        warehouseAlias
      );

      // 4. Persist line and order totals atomically. A partial tax snapshot is
      // never reported as successful.
      await this.persistOrderGst(orderId, orderlineGst, orderTotals);

      logger.info({
        orderId,
        orderTotals,
        gst_type: gstType.gst_type,
        fromState: gstType.fromState,
        toState: gstType.toState,
        orderlinesUpdated: orderlineGst.length
      }, 'GST processing completed successfully');

      return { success: true, orderTotals, gstType };
    } catch (error: any) {
      logger.error({
        error: error.message,
        stack: error.stack,
        orderId
      }, 'Error processing order GST');

      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const gstService = new GstService();
