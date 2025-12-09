import { FastifyRequest, FastifyReply } from 'fastify';
import { ekartService, CreateShipmentPayload } from '../services/ekart.service.js';
import { ekartAuthService } from '../services/ekart-auth.service.js';
import { env } from '../config/env.js';
import {
  forwardShipmentSchemaWithDimensions,
  reverseShipmentSchemaWithDimensions,
  trackShipmentSchema,
  cancelShipmentSchema,
  downloadLabelSchema,
  shippingRatesSchema,
  ForwardShipmentInput,
  ReverseShipmentInput,
  TrackShipmentInput,
  CancelShipmentInput,
  DownloadLabelInput,
  ShippingRatesInput
} from '../schemas/ekart.schema.js';
import { createSuccessResponse, createErrorResponse, asyncHandler } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';
import { dynamicUpdate } from '../utils/dynamicDbOperations.js';
import axios from 'axios';

export class EkartController {
  /**
   * Check Ekart Connection Status
   * GET /v1/ekart/connection-status
   */
  getConnectionStatus = asyncHandler(
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      logger.info('Checking Ekart connection status');

      try {
        // Get token info without connecting
        const tokenInfo = ekartAuthService.getTokenInfo();
        const isConfigured = !!(env.EKART_CLIENT_ID && env.EKART_USERNAME && env.EKART_PASSWORD);

        const response = createSuccessResponse(
          'Connection status retrieved successfully',
          {
            connected: tokenInfo.isValid,
            configured: isConfigured,
            token_type: 'Bearer',
            expires_in: tokenInfo.expiresIn,
            expires_at: tokenInfo.expiresAt ? new Date(tokenInfo.expiresAt).toISOString() : null,
            is_valid: tokenInfo.isValid,
            message: tokenInfo.isValid 
              ? 'Ekart channel is connected and ready to use'
              : isConfigured
              ? 'Ekart channel is not connected. Use POST /connect-channel to connect.'
              : 'Ekart credentials are not configured in environment variables'
          }
        );

        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to check connection status');
        
        const errorResponse = createErrorResponse(
          'Failed to check connection status',
          error.message || 'Status check failed',
          500
        );

        return reply.code(500).send(errorResponse);
      }
    }
  );

  /**
   * Connect to Ekart Channel
   * POST /v1/ekart/connect-channel
   */
  connectChannel = asyncHandler(
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      logger.info('Manual Ekart channel connection requested');

      try {
        // Connect to Ekart
        const tokenCache = await ekartAuthService.connect();
        
        // Get token info
        const tokenInfo = ekartAuthService.getTokenInfo();

        const response = createSuccessResponse(
          'Successfully connected to Ekart channel',
          {
            connected: true,
            token_type: tokenCache.token_type,
            expires_in: tokenInfo.expiresIn,
            expires_at: tokenInfo.expiresAt ? new Date(tokenInfo.expiresAt).toISOString() : null,
            is_valid: tokenInfo.isValid,
            message: 'Ekart channel is now connected and ready to use'
          }
        );

        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to connect to Ekart channel');
        
        const errorResponse = createErrorResponse(
          'Failed to connect to Ekart channel',
          error.message || 'Connection failed',
          500
        );

        return reply.code(500).send(errorResponse);
      }
    }
  );
  /**
   * Create Forward Shipment (Seller → Customer)
   * POST /v1/ekart/shipments/forward
   */
  createForwardShipment = asyncHandler(
    async (
      request: FastifyRequest<{ Body: ForwardShipmentInput }>,
      reply: FastifyReply
    ) => {
      logger.info(
        {
          bodyKeys: Object.keys(request.body || {}),
          hasSellerName: !!(request.body as any)?.seller_name,
          hasSellerAddress: !!(request.body as any)?.seller_address,
          hasSellerGstTin: !!(request.body as any)?.seller_gst_tin
        },
        '📥 [CONTROLLER] Received request to create forward shipment'
      );

      const requestBody = forwardShipmentSchemaWithDimensions.parse(request.body);

      logger.info(
        {
          orderNumber: requestBody.order_number,
          paymentMode: requestBody.payment_mode,
          hasSellerName: !!requestBody.seller_name,
          hasSellerAddress: !!requestBody.seller_address,
          hasSellerGstTin: !!requestBody.seller_gst_tin,
          sellerName: requestBody.seller_name
        },
        '✅ [CONTROLLER] Request body validated successfully - seller info from FE'
      );

      // Service will handle fetching seller info from EKART if fetch_seller_from_ekart is true
      const result = await ekartService.createForwardShipment(requestBody as CreateShipmentPayload);

      logger.info(
        {
          orderNumber: requestBody.order_number,
          trackingId: result.tracking_id,
          vendor: result.vendor
        },
        '✅ [CONTROLLER] Shipment created, now storing data in database'
      );

      // Store shipment data in orders table
      logger.info(
        { orderNumber: requestBody.order_number },
        '📍 [CONTROLLER] Step 6: Storing shipment data in database'
      );

      try {
        const { OrdersService } = await import('../services/orders.service.js');
        const ordersService = new OrdersService();
        
        // Find order by order_number (orderid field)
        logger.info(
          { orderNumber: requestBody.order_number },
          '📍 [CONTROLLER] Step 6.1: Looking up order in database'
        );

        const order = await ordersService.findByOrderNumber(requestBody.order_number);
        
        if (order) {
          logger.info(
            {
              orderId: order.id,
              orderNumber: requestBody.order_number,
              currentStatus: order.orderstatus
            },
            '✅ [CONTROLLER] Step 6.1 SUCCESS: Order found in database'
          );

          // Update orders table with shipment data (NO status change, NO status_history update)
          // Status remains "ready_for_dispatch" until mark-shipped is called
          logger.info(
            {
              orderId: order.id,
              trackingId: result.tracking_id,
              vendor: result.vendor
            },
            '📍 [CONTROLLER] Step 6.2: Updating orders table with shipment data'
          );

          await dynamicUpdate('orders', { id: order.id }, {
            tracking_id: result.tracking_id,
            vendor: result.vendor,
            barcodes: result.barcodes as any,
            public_tracking_link: `https://app.elite.ekartlogistics.in/track/${result.tracking_id}`,
            shipment_created_at: Date.now(),
            modifieddate: Date.now()
            // Note: status_history NOT updated - status doesn't change (remains ready_for_dispatch)
          });

          logger.info(
            { orderId: order.id },
            '✅ [CONTROLLER] Step 6.2 SUCCESS: Orders table updated'
          );

          // Update all orderlines with tracking_id (NO status change, NO status_history update)
          const { OrderlineService } = await import('../services/orderline.service.js');
          const orderlineService = new OrderlineService();
          
          logger.info(
            { orderId: order.id },
            '📍 [CONTROLLER] Step 6.3: Fetching orderlines for update'
          );

          const { data: orderlines } = await orderlineService.findMany(
            { orderid: order.id.toString() },
            1,
            1000
          );

          logger.info(
            {
              orderId: order.id,
              orderlineCount: orderlines?.length || 0
            },
            `✅ [CONTROLLER] Step 6.3 SUCCESS: Found ${orderlines?.length || 0} orderlines`
          );

          if (orderlines && orderlines.length > 0) {
            logger.info(
              { orderId: order.id, orderlineCount: orderlines.length },
              '📍 [CONTROLLER] Step 6.4: Updating orderlines with tracking_id'
            );

            for (const orderline of orderlines) {
              await orderlineService.update(orderline.id.toString(), {
                tracking_id: result.tracking_id
                // Note: Status remains "ready_for_dispatch" until mark-shipped is called
                // Note: status_history NOT updated - status doesn't change
              });
            }

            logger.info(
              {
                orderId: order.id,
                orderlineCount: orderlines.length,
                trackingId: result.tracking_id
              },
              '✅ [CONTROLLER] Step 6.4 SUCCESS: All orderlines updated with tracking_id'
            );
          }

          logger.info(
            {
              orderId: order.id,
              trackingId: result.tracking_id,
              vendor: result.vendor,
              publicTrackingLink: `https://app.elite.ekartlogistics.in/track/${result.tracking_id}`
            },
            '✅ [CONTROLLER] Step 6 SUCCESS: Shipment data stored in orders and orderlines'
          );
        } else {
          logger.warn(
            { orderNumber: requestBody.order_number },
            '⚠️ [CONTROLLER] Step 6 WARNING: Order not found in database - shipment data not stored (but shipment was created in EKART)'
          );
        }
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            stack: error.stack,
            orderNumber: requestBody.order_number
          },
          '❌ [CONTROLLER] Step 6 ERROR: Failed to store shipment data in orders table (but shipment was created in EKART)'
        );
        // Don't fail the request - shipment was created successfully
      }

      logger.info(
        {
          orderNumber: requestBody.order_number,
          trackingId: result.tracking_id,
          vendor: result.vendor,
          publicTrackingLink: `https://app.elite.ekartlogistics.in/track/${result.tracking_id}`
        },
        '✅ [CONTROLLER] Step 7: Preparing success response'
      );

      const response = createSuccessResponse(
        'Forward shipment created successfully',
        {
          tracking_id: result.tracking_id,
          vendor: result.vendor,
          barcodes: result.barcodes,
          public_tracking_link: `https://app.elite.ekartlogistics.in/track/${result.tracking_id}`,
          order_number: requestBody.order_number
        }
      );

      logger.info(
        {
          orderNumber: requestBody.order_number,
          trackingId: result.tracking_id
        },
        '🎉 [CONTROLLER] COMPLETE: Forward shipment creation process completed successfully'
      );

      return reply.code(200).send(response);
    }
  );

  /**
   * Create Reverse Shipment (Customer → Seller)
   * POST /v1/ekart/shipments/reverse
   */
  createReverseShipment = asyncHandler(
    async (
      request: FastifyRequest<{ Body: ReverseShipmentInput }>,
      reply: FastifyReply
    ) => {
      const requestBody = reverseShipmentSchemaWithDimensions.parse(request.body);

      // Use GST TIN from payload or env
      const finalPayload = {
        ...requestBody,
        seller_gst_tin: requestBody.seller_gst_tin || env.SELLER_GST_TIN || ''
      };

      // Validate required seller fields are present
      if (!finalPayload.seller_name || !finalPayload.seller_address || !finalPayload.seller_gst_tin) {
        throw new Error('Seller name, address, and GST TIN are required (GST TIN can come from payload or SELLER_GST_TIN env variable)');
      }

      logger.info(
        { orderNumber: finalPayload.order_number, returnReason: finalPayload.return_reason },
        'Creating reverse shipment'
      );

      const result = await ekartService.createReverseShipment(finalPayload as CreateShipmentPayload);

      const response = createSuccessResponse(
        'Reverse shipment created successfully',
        {
          tracking_id: result.tracking_id,
          vendor: result.vendor,
          barcodes: result.barcodes,
          public_tracking_link: `https://app.elite.ekartlogistics.in/track/${result.tracking_id}`,
          order_number: finalPayload.order_number
        }
      );

      return reply.code(200).send(response);
    }
  );

  /**
   * Download Label (PDF)
   * POST /v1/ekart/shipments/label
   */
  downloadLabel = asyncHandler(
    async (
      request: FastifyRequest<{ Body: DownloadLabelInput }>,
      reply: FastifyReply
    ) => {
      const { trackingIds } = downloadLabelSchema.parse(request.body);

      logger.info({ trackingIds }, 'Downloading labels');

      // Step 1: Call EKART API to download label (binary PDF)
      const pdfBuffer = await ekartService.downloadLabel(trackingIds);

      // Step 2: Upload PDF to GCP Storage Backend (server 4500) - one PDF per tracking ID
      // NO STATUS CHANGE, NO status_history update
      try {
        const { OrdersService } = await import('../services/orders.service.js');
        const ordersService = new OrdersService();

        // GCP Storage Backend URL (server 4500)
        const storageBackendUrl = process.env.STORAGE_BACKEND_URL || 'http://localhost:4500';

        // Upload one PDF per tracking ID (same PDF buffer, different paths)
        const updatePromises = trackingIds.map(async (trackingId) => {
          try {
            const order = await ordersService.findByTrackingId(trackingId);
            
            if (!order) {
              logger.warn(
                { trackingId },
                'Order not found for tracking ID - label URL not stored'
              );
              return { trackingId, success: false, error: 'Order not found' };
            }

            // Call GCP Storage Backend API (server 4500)
            // Server 4500 endpoint: POST /api/v1/storage/upload-buffer
            // Path format: tracking_id/label.pdf (e.g., FMPC001/label.pdf)
            const fileName = `${trackingId}/label.pdf`;
            const shippingBucket = process.env.SHIPPING_BUCKET || 'niv-shipping-lavel-dev';

            const response = await axios.post(
              `${storageBackendUrl}/api/v1/storage/upload-buffer`,
              {
                fileBuffer: pdfBuffer.toString('base64'),
                fileName,
                bucket: shippingBucket,
                contentType: 'application/pdf',
                makePublic: true
              },
              {
                headers: {
                  'Content-Type': 'application/json'
                },
                timeout: 30000
              }
            );

            if (!response.data.success || !response.data.data?.url) {
              throw new Error('Invalid response from storage backend');
            }

            const labelUrl = response.data.data.url;

            logger.info(
              { labelUrl, trackingId, fileSize: pdfBuffer.length },
              'Label PDF uploaded to GCP Storage Backend (server 4500)'
            );

            // Update order with label_url (NO STATUS CHANGE, NO status_history)
            await dynamicUpdate('orders', { id: order.id }, {
              label_url: labelUrl,
              label_downloaded_at: Date.now(),
              modifieddate: Date.now()
              // Note: status remains "ready_for_dispatch", no status_history update
            });

            logger.info(
              { orderId: order.id, trackingId, labelUrl },
              'Label URL stored in orders table'
            );
            
            return { trackingId, orderId: order.id, labelUrl, success: true };
          } catch (error: any) {
            logger.error(
              { error: error.message, trackingId, stack: error.stack },
              'Failed to upload label to GCP Storage Backend or update order'
            );
            return { trackingId, success: false, error: error.message };
          }
        });

        const updateResults = await Promise.all(updatePromises);
        const successful = updateResults.filter(r => r.success).length;
        const failed = updateResults.filter(r => !r.success).length;

        logger.info(
          { 
            totalTrackingIds: trackingIds.length,
            successful,
            failed,
            updateResults
          },
          'Label upload to GCP Storage Backend completed'
        );
      } catch (error: any) {
        logger.error(
          { error: error.message, trackingIds, stack: error.stack },
          'Failed to process label uploads to GCP Storage Backend'
        );
        // Don't fail the request - label was downloaded successfully, just GCP upload failed
        // Frontend can still download the PDF from the response
      }

      // Set appropriate headers for PDF download
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="ekart-labels-${Date.now()}.pdf"`);
      reply.header('Content-Length', pdfBuffer.length.toString());

      return reply.code(200).send(pdfBuffer);
    }
  );

  /**
   * Track Shipment
   * GET /v1/ekart/shipments/:trackingId/track
   */
  trackShipment = asyncHandler(
    async (
      request: FastifyRequest<{ Params: { trackingId: string } }>,
      reply: FastifyReply
    ) => {
      const { trackingId } = trackShipmentSchema.parse({ trackingId: request.params.trackingId });

      logger.info({ trackingId }, 'Tracking shipment');

      const result = await ekartService.trackShipment(trackingId);

      const response = createSuccessResponse(
        'Shipment tracking retrieved successfully',
        {
          tracking_id: trackingId,
          status: result.track.status,
          current_location: result.track.location,
          description: result.track.desc,
          estimated_delivery: result.edd ? new Date(result.edd).toISOString() : null,
          order_number: result.order_number,
          status_history: result.track.details,
          ndr_status: result.track.ndrStatus,
          ndr_actions: result.track.ndrActions,
          attempts: result.track.attempts,
          public_tracking_link: `https://app.elite.ekartlogistics.in/track/${trackingId}`
        }
      );

      return reply.code(200).send(response);
    }
  );

  /**
   * Cancel Shipment
   * DELETE /v1/ekart/shipments/:trackingId/cancel
   */
  cancelShipment = asyncHandler(
    async (
      request: FastifyRequest<{ Params: { trackingId: string } }>,
      reply: FastifyReply
    ) => {
      const { trackingId } = cancelShipmentSchema.parse({ trackingId: request.params.trackingId });

      logger.info({ trackingId }, 'Cancelling shipment');

      const result = await ekartService.cancelShipment(trackingId);

      const response = createSuccessResponse(
        'Shipment cancelled successfully',
        {
          tracking_id: result.tracking_id,
          remark: result.remark
        }
      );

      return reply.code(200).send(response);
    }
  );

  /**
   * Get Addresses from EKART
   * GET /v1/ekart/addresses
   * Returns list of registered seller/pickup addresses from EKART
   */
  getAddresses = asyncHandler(
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      logger.info('📥 [CONTROLLER] Received request to get EKART addresses');

      const addresses = await ekartService.getAddresses();

      logger.info(
        { count: addresses.length },
        '✅ [CONTROLLER] Addresses fetched successfully'
      );

      const response = createSuccessResponse(
        'Addresses fetched successfully',
        addresses
      );

      return reply.code(200).send(response);
    }
  );

  /**
   * Get Shipping Rates
   * POST /v1/ekart/shipments/rates
   */
  getShippingRates = asyncHandler(
    async (
      request: FastifyRequest<{ Body: ShippingRatesInput }>,
      reply: FastifyReply
    ) => {
      const payload = shippingRatesSchema.parse(request.body);

      logger.info(
        {
          pickupPincode: payload.pickupPincode,
          dropPincode: payload.dropPincode
        },
        'Getting shipping rates'
      );

      const result = await ekartService.getShippingRates(payload);

      const response = createSuccessResponse(
        'Shipping rates retrieved successfully',
        {
          type: result.type,
          zone: result.zone,
          volumetric_weight: result.volumetricWeight,
          billing_weight: result.billingWeight,
          shipping_charge: result.shippingCharge,
          rto_charge: result.rtoCharge,
          fuel_surcharge: result.fuelSurcharge,
          cod_charge: result.codCharge,
          qc_charge: result.qcCharge,
          taxes: result.taxes,
          total: result.total,
          rid: result.rid,
          r_snapshot_id: result.rSnapshotId
        }
      );

      return reply.code(200).send(response);
    }
  );
}

