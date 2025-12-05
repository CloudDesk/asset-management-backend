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

