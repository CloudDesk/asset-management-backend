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
import FormData from 'form-data';
import crypto from 'crypto';
import { OrdersService } from '../services/orders.service.js';
import { OrderlineService } from '../services/orderline.service.js';
import { CustomerNotificationService } from '../services/customer-notification.service.js';
import { json } from 'stream/consumers';

export class EkartController {
  // Static service instances (stateless, reusable)
  private readonly ordersService = new OrdersService();
  private readonly orderlineService = new OrderlineService();
  private readonly customerNotificationService = new CustomerNotificationService();

  // Webhook secret (constant, no need to recreate on each request)
  private static readonly WEBHOOK_SECRET = 'Nivaana-Ekart-Track-Status';

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
        // Find order by order_number (orderid field)
        logger.info(
          { orderNumber: requestBody.order_number },
          '📍 [CONTROLLER] Step 6.1: Looking up order in database'
        );

        // Use findByOrderIdString for searching by orderid field (order_number from payload)
        const order = await this.ordersService.findByOrderIdString(requestBody.order_number);

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

          logger.info(
            { orderId: order.id },
            '📍 [CONTROLLER] Step 6.3: Fetching orderlines for update'
          );

          const { data: orderlines } = await this.orderlineService.findMany(
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
              await this.orderlineService.update(orderline.id.toString(), {
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

          // Step 7: Generate invoice (moved from mark-shipped)
          try {
            logger.info(
              { orderId: order.id },
              '📍 [CONTROLLER] Step 7: Generating invoice for order'
            );

            const invoiceUrl = await this.ordersService.generateInvoice(order.id);

            if (invoiceUrl) {
              logger.info(
                { orderId: order.id, invoiceUrl },
                '✅ [CONTROLLER] Step 7 SUCCESS: Invoice generated successfully'
              );
            } else {
              logger.warn(
                { orderId: order.id },
                '⚠️ [CONTROLLER] Step 7 WARNING: Invoice generation returned no URL (non-blocking)'
              );
            }
          } catch (invoiceError: any) {
            // Invoice generation is non-blocking - don't fail the shipment creation
            logger.error(
              {
                error: invoiceError.message,
                orderId: order.id
              },
              '❌ [CONTROLLER] Step 7 ERROR: Failed to generate invoice (non-blocking)'
            );
          }
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
      logger.info(request.body, "request.body createReverseShipment in controller")
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
      logger.info(finalPayload, "finalPayload createReverseShipment")
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
      const { tracking_ids: trackingIds } = downloadLabelSchema.parse(request.body);

      logger.info({ trackingIds }, 'Downloading labels');

      // Step 1: Call EKART API to download label (binary PDF)
      const pdfBuffer = await ekartService.downloadLabel(trackingIds);

      // Step 2: Upload PDF to GCP Storage Backend (server 4500) - one PDF per tracking ID
      // NO STATUS CHANGE, NO status_history update
      try {

        // GCP Storage Backend URL (server 4500)
        const storageBackendUrl = process.env.STORAGE_BACKEND_URL || 'http://localhost:4500';

        // Upload one PDF per tracking ID (same PDF buffer, different paths)
        const updatePromises = trackingIds.map(async (trackingId) => {
          try {
            const order = await this.ordersService.findByTrackingId(trackingId);
            if (!order) {
              logger.warn(
                { trackingId },
                'Order not found for tracking ID - label URL not stored'
              );
              return { trackingId, success: false, error: 'Order not found' };
            }

            // Call GCP Storage Backend API (server 4500)
            // Server 4500 endpoint: POST /shipping/label/:trackingId
            // Sends PDF buffer directly as multipart/form-data
            logger.debug(
              {
                trackingId,
                pdfSize: pdfBuffer.length,
                storageBackendUrl
              },
              'Uploading PDF to GCP Storage Backend'
            );

            // Create FormData for multipart/form-data upload
            const formData = new FormData();
            formData.append('file', pdfBuffer, {
              filename: 'label.pdf',
              contentType: 'application/pdf'
            });

            const response = await axios.post(
              `${storageBackendUrl}/shipping/label/${trackingId}`,
              formData,
              {
                headers: {
                  ...formData.getHeaders()
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

        // Return JSON response with label URLs
        // If single tracking ID, return single object; if multiple, return array
        const responseData = trackingIds.length === 1
          ? updateResults[0]
          : updateResults;

        const response = createSuccessResponse(
          'Labels uploaded successfully',
          responseData
        );

        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error(
          { error: error.message, trackingIds, stack: error.stack },
          'Failed to process label uploads to GCP Storage Backend'
        );

        // Return error response
        const errorResponse = createErrorResponse(
          'Failed to upload labels to storage backend',
          error.message,
          500
        );
        return reply.code(500).send(errorResponse);
      }
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

  /**
   * Handle Ekart Tracking Status Webhook
   * POST /v1/ekart/webhook/track-status
   * Unauthenticated endpoint for Ekart to send tracking updates
   */
  handleTrackStatusWebhook = asyncHandler(
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      try {
        const webhookPayload = request.body as any;
        const hmacHeader =
          request.headers['x-swift-webhook-hmac'] as string ||
          request.headers['x-ekart-signature'] as string ||
          request.headers['x-hub-signature'] as string ||
          request.headers['eka-webhook-signature'] as string ||
          request.headers['x-hmac'] as string ||
          request.headers['hmac'] as string;

        // Keep the raw webhook diagnostics visible in Cloud Run logs for
        // troubleshooting the Elite Ekart integration.
        console.log(webhookPayload, 'webhookPayload handleTrackStatusWebhook');
        console.log(JSON.stringify(webhookPayload), 'webhookPayload stringify handleTrackStatusWebhook');
        console.log(hmacHeader, 'hmacHeader');

        logger.info(
          {
            requestId: request.id,
            webhookTopic: request.headers['x-swift-webhook-topic'],
            contentType: request.headers['content-type'],
            contentLength: request.headers['content-length'],
            trackingId: webhookPayload?.wbn,
            ekartStatus: webhookPayload?.status,
            signatureHeaderPresent: !!hmacHeader
          },
          'Received Ekart tracking status webhook'
        );

        // Early validation (fail fast before any processing)
        if (!webhookPayload || !webhookPayload.wbn || !webhookPayload.status) {
          logger.warn(
            { hasPayload: !!webhookPayload, hasWbn: !!webhookPayload?.wbn, hasStatus: !!webhookPayload?.status },
            'Ekart webhook missing required fields (wbn or status)'
          );

          return reply.code(400).send(
            createErrorResponse(
              'Invalid webhook payload',
              'Missing required fields: wbn and status',
              400
            )
          );
        }

        // Verify HMAC signature using raw body (captured in ekart.route.ts)
        const rawBody = (request as any).rawBody;
        if (!rawBody) {
          logger.error('Raw body missing — cannot verify Ekart signature');
          return reply.code(401).send(
            createErrorResponse(
              'Invalid signature',
              'Raw body missing for HMAC verification',
              401
            )
          );
        }


        const expectedHmac = crypto
          .createHmac('sha256', EkartController.WEBHOOK_SECRET)
          .update(rawBody)
          .digest('hex');

        // Clean provided HMAC (Ekart sometimes sends `sha256=<hash>`)
        const providedHmac = hmacHeader ? hmacHeader.trim().replace(/^sha256=/i, '') : '';
        // Timing-safe comparison to prevent timing attacks
        let isSignatureValid = false;
        if (/^[a-f\d]{64}$/i.test(providedHmac)) {
          try {
            isSignatureValid = crypto.timingSafeEqual(
              Buffer.from(providedHmac, 'hex'),
              Buffer.from(expectedHmac, 'hex')
            );
          } catch (e) {
            isSignatureValid = false;
          }
        }

        logger.info(
          {
            requestId: request.id,
            trackingId: webhookPayload.wbn,
            rawBodyBytes: rawBody.length,
            signatureHeaderPresent: !!hmacHeader,
            signatureFormatValid: /^[a-f\d]{64}$/i.test(providedHmac),
            signatureValid: isSignatureValid
          },
          'Completed Ekart webhook signature verification'
        );

        if (!isSignatureValid) {
          logger.warn(
            {
              signatureHeaderPresent: !!hmacHeader,
              signatureFormatValid: /^[a-f\d]{64}$/i.test(providedHmac),
              webhookTopic: request.headers['x-swift-webhook-topic']
            },
            'Invalid Ekart webhook HMAC signature'
          );

          return reply.code(401).send(
            createErrorResponse(
              'Invalid signature',
              'HMAC verification failed',
              401
            )
          );
        }

        // Find order by tracking_id (the "wbn" field in webhook)
        const trackingId = webhookPayload.wbn;
        const order = await this.ordersService.findByTrackingId(trackingId);
        if (!order) {
          logger.warn(
            { trackingId },
            'Order not found for tracking ID from Ekart webhook'
          );

          return reply.code(404).send(
            createErrorResponse(
              'Order not found',
              `No order found with tracking_id: ${trackingId}`,
              404
            )
          );
        }

        // Process webhook status update using service method
        // This handles:
        // 1. Mapping EKART status to system status
        // 2. Updating shipment_tracking_status (original EKART status)
        // 3. Updating orderstatus (mapped system status)
        // 4. Updating status_history for order and orderlines
        // 5. Updating all orderlines status
        const updatedOrder = await this.ordersService.handleEkartWebhookStatusUpdate(
          trackingId,
          webhookPayload.status,
          {
            location: webhookPayload.location,
            description: webhookPayload.desc,
            ctime: webhookPayload.ctime,
            pickupTime: webhookPayload.pickupTime,
            attempts: webhookPayload.attempts
          },
          webhookPayload // Pass full webhook payload for unknown statuses
        );

        try {
          await this.customerNotificationService.notifyOrderStatus(
            updatedOrder,
            updatedOrder?.orderstatus
          );
        } catch (notificationError: any) {
          logger.warn(
            {
              orderId: updatedOrder?.id,
              trackingId,
              error: notificationError?.message || 'Unknown error',
            },
            'Failed to send EKART order push notification'
          );
        }

        logger.info(
          {
            requestId: request.id,
            orderId: updatedOrder.id,
            trackingId,
            ekartStatus: webhookPayload.status,
            systemStatus: updatedOrder.orderstatus,
            shipmentTrackingStatus: updatedOrder.shipment_tracking_status
          },
          'Ekart tracking status webhook processed successfully'
        );

        return reply.code(200).send(
          createSuccessResponse(
            'Tracking status updated successfully',
            {
              orderId: updatedOrder.id,
              trackingId: webhookPayload.wbn,
              ekartStatus: webhookPayload.status,
              systemStatus: updatedOrder.orderstatus,
              shipmentTrackingStatus: updatedOrder.shipment_tracking_status
            }
          )
        );
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            stack: error.stack,
            webhookPayload: request.body,
          },
          'Error processing Ekart track status webhook'
        );

        return reply.code(500).send(
          createErrorResponse(
            'Failed to process webhook',
            error.message || 'Internal server error',
            500
          )
        );
      }
    }
  );
}
