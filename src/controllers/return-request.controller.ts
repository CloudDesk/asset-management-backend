import { FastifyReply, FastifyRequest } from 'fastify';
import { ReturnRequestService } from '../services/return-request.service.js';
import {
  addReturnRequestAttachmentSchema,
  approveReturnRequestSchema,
  attachmentTypeSchema,
  completeReturnResolutionSchema,
  createReturnCreditNoteSchema,
  createReturnRequestSchema,
  createRtoRequestSchema,
  evidenceReviewSchema,
  inspectReturnRequestSchema,
  markRtoReceivedSchema,
  markReturnReceivedSchema,
  preparePickupSchema,
  returnOperationsSummaryQuerySchema,
  returnRequestQuerySchema,
  returnSourceParamsSchema,
  rejectReturnRequestSchema,
  updateReturnRefundStatusSchema,
  updateReturnShipmentStatusSchema,
  updateRtoStatusSchema,
} from '../schemas/return-source.schema.js';
import { asyncHandler, createSuccessResponse, ValidationError } from '../utils/errorHandler.js';
import { getPaginationParams } from '../utils/pagination.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

const getMultipartFieldValue = (field: any, fallback = ''): string => {
  if (field === undefined || field === null) return fallback;
  if (typeof field === 'string') return field;
  if (typeof field.value === 'string') return field.value;
  return fallback;
};

export class ReturnRequestController {
  private returnRequestService = new ReturnRequestService();

  private getEvidenceFilePath(request: FastifyRequest) {
    const requestPath = String(request.url || '').split('?')[0] || '';
    const marker = '/evidence-file/';
    const markerIndex = requestPath.indexOf(marker);
    if (markerIndex >= 0) {
      return requestPath.slice(markerIndex + marker.length);
    }

    const params = request.params as Record<string, string>;
    return params['*'] || params.objectPath || '';
  }

  getRequests = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const query = returnRequestQuerySchema.parse(request.query || {});
    const { page, limit } = getPaginationParams(request.query as Record<string, unknown>);
    const result = await this.returnRequestService.findMany(query, page, limit, request.user);

    return reply.code(200).send({
      ...createSuccessResponse('Return requests retrieved successfully', result.data),
      pagination: result.pagination,
    });
  });

  getRequest = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const returnRequest = await this.returnRequestService.findById(id);

    return reply.code(200).send(createSuccessResponse('Return request retrieved successfully', returnRequest));
  });

  getOperationsSummary = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const query = returnOperationsSummaryQuerySchema.parse(request.query || {});
    const summary = await this.returnRequestService.getOperationsSummary(query, request.user);

    return reply.code(200).send(createSuccessResponse('Return operations summary retrieved successfully', summary));
  });

  getResolutionPreview = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const preview = await this.returnRequestService.getResolutionPreview(id, request.user);

    return reply.code(200).send(createSuccessResponse('Return resolution preview retrieved successfully', preview));
  });

  getEvidenceHealth = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const health = await this.returnRequestService.getEvidenceHealth(id, request.user);

    return reply.code(200).send(createSuccessResponse('Return evidence health retrieved successfully', health));
  });

  repairEvidenceLinks = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const result = await this.returnRequestService.repairEvidenceLinks(id, request.user);

    return reply.code(200).send(createSuccessResponse('Return evidence links repaired successfully', result));
  });

  getEvidenceFile = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const evidenceFile = await this.returnRequestService.openEvidenceFile(this.getEvidenceFilePath(request));

    if (evidenceFile.redirectUrl) {
      return reply.redirect(evidenceFile.redirectUrl);
    }

    reply
      .header('Cache-Control', 'private, max-age=3600')
      .type(evidenceFile.contentType);

    if (evidenceFile.contentLength) {
      reply.header('Content-Length', evidenceFile.contentLength);
    }

    return reply.code(200).send(evidenceFile.stream);
  });

  createRequest = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const data = createReturnRequestSchema.parse(request.body);
    const returnRequest = await this.returnRequestService.createCustomerRequest(data, request.user);

    return reply.code(201).send(createSuccessResponse('Return request created successfully', returnRequest));
  });

  createRtoRequest = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const data = createRtoRequestSchema.parse(request.body);
    const returnRequest = await this.returnRequestService.createRtoRequest(data, request.user);

    return reply.code(201).send(createSuccessResponse('RTO record created successfully', returnRequest));
  });

  addAttachments = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const data = addReturnRequestAttachmentSchema.parse(request.body);
    const returnRequest = await this.returnRequestService.addAttachments(id, data, request.user);

    return reply.code(200).send(createSuccessResponse('Return request attachments added successfully', returnRequest));
  });

  updateRtoStatus = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const data = updateRtoStatusSchema.parse(request.body);
    const returnRequest = await this.returnRequestService.updateRtoStatus(id, data, request.user);

    return reply.code(200).send(createSuccessResponse('RTO status updated successfully', returnRequest));
  });

  markRtoReceived = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const data = markRtoReceivedSchema.parse(request.body || {});
    const returnRequest = await this.returnRequestService.markRtoReceived(id, data, request.user);

    return reply.code(200).send(createSuccessResponse('RTO marked received at warehouse successfully', returnRequest));
  });

  reviewEvidence = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const data = evidenceReviewSchema.parse(request.body);
    const returnRequest = await this.returnRequestService.reviewEvidence(id, data, request.user);

    return reply.code(200).send(createSuccessResponse('Evidence review completed successfully', returnRequest));
  });

  approveRequest = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const data = approveReturnRequestSchema.parse(request.body || {});
    const returnRequest = await this.returnRequestService.approveRequest(id, data, request.user);

    return reply.code(200).send(createSuccessResponse('Return request approved successfully', returnRequest));
  });

  rejectRequest = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const data = rejectReturnRequestSchema.parse(request.body);
    const returnRequest = await this.returnRequestService.rejectRequest(id, data, request.user);

    return reply.code(200).send(createSuccessResponse('Return request rejected successfully', returnRequest));
  });

  preparePickup = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const data = preparePickupSchema.parse(request.body || {});
    const returnRequest = await this.returnRequestService.preparePickup(id, data, request.user);

    return reply.code(200).send(createSuccessResponse('Pickup preparation saved successfully', returnRequest));
  });

  markReceived = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const data = markReturnReceivedSchema.parse(request.body || {});
    const returnRequest = await this.returnRequestService.markReceivedAtWarehouse(id, data, request.user);

    return reply.code(200).send(createSuccessResponse('Return received at warehouse successfully', returnRequest));
  });

  inspectReturn = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const data = inspectReturnRequestSchema.parse(request.body || {});
    const returnRequest = await this.returnRequestService.inspectReturn(id, data, request.user);

    return reply.code(200).send(createSuccessResponse('Return inspection saved successfully', returnRequest));
  });

  completeResolution = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const data = completeReturnResolutionSchema.parse(request.body || {});
    const returnRequest = await this.returnRequestService.completeResolution(id, data, request.user);

    return reply.code(200).send(createSuccessResponse('Return resolution action saved successfully', returnRequest));
  });

  updateShipmentStatus = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const data = updateReturnShipmentStatusSchema.parse(request.body || {});
    const returnRequest = await this.returnRequestService.updateShipmentStatus(id, data, request.user);

    return reply.code(200).send(createSuccessResponse('Return fulfilment shipment status saved successfully', returnRequest));
  });

  updateRefundStatus = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const data = updateReturnRefundStatusSchema.parse(request.body || {});
    const returnRequest = await this.returnRequestService.updateRefundStatus(id, data, request.user);

    return reply.code(200).send(createSuccessResponse('Return refund status saved successfully', returnRequest));
  });

  createCreditNote = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const data = createReturnCreditNoteSchema.parse(request.body || {});
    const returnRequest = await this.returnRequestService.createCreditNote(id, data, request.user);

    return reply.code(201).send(createSuccessResponse('Return credit note saved successfully', returnRequest));
  });

  uploadEvidence = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const uploadedFile = body?.file;

    if (!uploadedFile) {
      throw new ValidationError('No evidence file uploaded', 'Upload multipart/form-data using the field name "file"');
    }

    const attachmenttype = attachmentTypeSchema.parse(getMultipartFieldValue(body?.attachmenttype, 'product_photo'));
    const fileBuffer = await uploadedFile.toBuffer();
    const uploaded = await this.returnRequestService.uploadEvidenceFile({
      attachmenttype,
      fileBuffer,
      filename: uploadedFile.filename || `${attachmenttype}-evidence`,
      mimetype: uploadedFile.mimetype || 'application/octet-stream',
    });

    return reply.code(201).send(createSuccessResponse('Evidence uploaded successfully', uploaded));
  });

  uploadAndAttachEvidence = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const body = request.body as any;
    const uploadedFile = body?.file;

    if (!uploadedFile) {
      throw new ValidationError('No evidence file uploaded', 'Upload multipart/form-data using the field name "file"');
    }

    const attachmenttype = attachmentTypeSchema.parse(getMultipartFieldValue(body?.attachmenttype, 'product_photo'));
    const fileBuffer = await uploadedFile.toBuffer();
    const returnRequest = await this.returnRequestService.uploadAndAttachEvidence(
      id,
      {
        attachmenttype,
        fileBuffer,
        filename: uploadedFile.filename || `${attachmenttype}-evidence`,
        mimetype: uploadedFile.mimetype || 'application/octet-stream',
      },
      request.user
    );

    return reply.code(201).send(createSuccessResponse('Evidence uploaded and attached successfully', returnRequest));
  });

  replaceEvidenceAttachment = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const params = request.params as Record<string, string>;
    const attachmentId = String(params.attachmentId || '').trim();
    const body = request.body as any;
    const uploadedFile = body?.file;

    if (!attachmentId || !Number.isInteger(Number(attachmentId))) {
      throw new ValidationError('Invalid evidence attachment', 'A valid attachment ID is required');
    }
    if (!uploadedFile) {
      throw new ValidationError('No evidence file uploaded', 'Upload multipart/form-data using the field name "file"');
    }

    const attachmenttype = attachmentTypeSchema.parse(getMultipartFieldValue(body?.attachmenttype, 'product_photo'));
    const fileBuffer = await uploadedFile.toBuffer();
    const returnRequest = await this.returnRequestService.replaceEvidenceAttachment(
      id,
      attachmentId,
      {
        attachmenttype,
        fileBuffer,
        filename: uploadedFile.filename || `${attachmenttype}-evidence`,
        mimetype: uploadedFile.mimetype || 'application/octet-stream',
      },
      request.user
    );

    return reply.code(200).send(createSuccessResponse('Evidence attachment replaced successfully', returnRequest));
  });
}
