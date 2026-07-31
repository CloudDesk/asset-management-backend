import { FastifyReply, FastifyRequest } from 'fastify';
import { ReturnRequestService } from '../services/return-request.service.js';
import {
  addReturnRequestAttachmentSchema,
  approveReturnRequestSchema,
  attachmentTypeSchema,
  createReturnRequestSchema,
  createRtoRequestSchema,
  evidenceReviewSchema,
  inspectReturnRequestSchema,
  markRtoReceivedSchema,
  markReturnReceivedSchema,
  preparePickupSchema,
  returnRequestQuerySchema,
  returnSourceParamsSchema,
  rejectReturnRequestSchema,
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

  getRequests = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const query = returnRequestQuerySchema.parse(request.query || {});
    const { page, limit } = getPaginationParams(request.query as Record<string, unknown>);
    const result = await this.returnRequestService.findMany(query, page, limit);

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
}
