import { FastifyRequest, FastifyReply } from 'fastify';
import { ekartService } from '../services/ekart.service.js';
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
      const payload = forwardShipmentSchemaWithDimensions.parse(request.body);

      logger.info(
        { orderNumber: payload.order_number, paymentMode: payload.payment_mode },
        'Creating forward shipment'
      );

      const result = await ekartService.createForwardShipment(payload);

      // Store shipment data in orders table
      try {
        const { OrdersService } = await import('../services/orders.service.js');
        const ordersService = new OrdersService();
        
        // Find order by order_number (orderid field)
        const order = await ordersService.findByOrderNumber(payload.order_number);
        
        if (order) {
          // Update orders table with shipment data
          await dynamicUpdate('orders', { id: order.id }, {
            tracking_id: result.tracking_id,
            vendor: result.vendor,
            barcodes: result.barcodes as any,
            public_tracking_link: `https://app.elite.ekartlogistics.in/track/${result.tracking_id}`,
            shipment_created_at: Date.now(),
            modifieddate: Date.now()
          });

          // Update all orderlines with tracking_id (but NOT status yet)
          const { OrderlineService } = await import('../services/orderline.service.js');
          const orderlineService = new OrderlineService();
          
          const { data: orderlines } = await orderlineService.findMany(
            { orderid: order.id.toString() },
            1,
            1000
          );

          for (const orderline of orderlines || []) {
            await orderlineService.update(orderline.id.toString(), {
              tracking_id: result.tracking_id
              // Note: Status remains "ready_for_dispatch" until label is printed
            });
          }

          logger.info(
            { orderId: order.id, trackingId: result.tracking_id },
            'Shipment data stored in orders and orderlines'
          );
        } else {
          logger.warn(
            { orderNumber: payload.order_number },
            'Order not found - shipment data not stored'
          );
        }
      } catch (error: any) {
        logger.error(
          { error: error.message, orderNumber: payload.order_number },
          'Failed to store shipment data in orders table'
        );
        // Don't fail the request - shipment was created successfully
      }

      const response = createSuccessResponse(
        'Forward shipment created successfully',
        {
          tracking_id: result.tracking_id,
          vendor: result.vendor,
          barcodes: result.barcodes,
          public_tracking_link: `https://app.elite.ekartlogistics.in/track/${result.tracking_id}`,
          order_number: payload.order_number
        }
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
      const payload = reverseShipmentSchemaWithDimensions.parse(request.body);

      logger.info(
        { orderNumber: payload.order_number, returnReason: payload.return_reason },
        'Creating reverse shipment'
      );

      const result = await ekartService.createReverseShipment(payload);

      const response = createSuccessResponse(
        'Reverse shipment created successfully',
        {
          tracking_id: result.tracking_id,
          vendor: result.vendor,
          barcodes: result.barcodes,
          public_tracking_link: `https://app.elite.ekartlogistics.in/track/${result.tracking_id}`,
          order_number: payload.order_number
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

      const pdfBuffer = await ekartService.downloadLabel(trackingIds);

      // Store label PDF in GCP and update orders table
      // Note: For now, we'll store a placeholder URL pattern
      // You can implement GCP upload using @google-cloud/storage package
      try {
        const { OrdersService } = await import('../services/orders.service.js');
        const ordersService = new OrdersService();

        // For each tracking ID, find the order and update label_url
        for (const trackingId of trackingIds) {
          const order = await ordersService.findByTrackingId(trackingId);
          
          if (order) {
            // Generate label URL (you can implement actual GCP upload here)
            // For now, using a pattern that can be replaced with actual GCP URL
            const labelUrl = `gs://nivaana-labels/${trackingId}.pdf`;
            
            await dynamicUpdate('orders', { id: order.id }, {
              label_url: labelUrl,
              label_downloaded_at: Date.now(),
              modifieddate: Date.now()
            });

            logger.info(
              { orderId: order.id, trackingId, labelUrl },
              'Label URL stored in orders table'
            );
          } else {
            logger.warn(
              { trackingId },
              'Order not found for tracking ID - label URL not stored'
            );
          }
        }
      } catch (error: any) {
        logger.error(
          { error: error.message, trackingIds },
          'Failed to store label URL in orders table'
        );
        // Don't fail the request - label was downloaded successfully
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

