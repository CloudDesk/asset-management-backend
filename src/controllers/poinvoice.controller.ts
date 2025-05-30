import { FastifyRequest, FastifyReply } from 'fastify';
import { PoinvoiceService } from '../services/poinvoice.service.js';
import { 
  createPoinvoiceSchema, 
  updatePoinvoiceSchema, 
  upsertPoinvoiceSchema,
  poinvoiceParamsSchema,
  PoinvoiceParams
} from '../schemas/poinvoice.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';
import { formatPoinvoiceForAPI, formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';

export class PoinvoiceController {
  public poinvoiceService = new PoinvoiceService();

  getPoinvoices = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters (not just schema-validated ones)
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.poinvoiceService.findMany(filters, page, limit);
    
    // Format all poinvoices in the result
    const formattedData = formatEntitiesForAPI(result.data, 'poinvoice');
    
    const response = createSuccessResponse('Poinvoices retrieved successfully', formattedData);
    return reply.code(200).send({
      ...response,
      pagination: result.pagination,
      meta: {
        filters: Object.keys(filters),
        total: result.pagination.total,
        filtered: Object.keys(filters).length > 0
      }
    });
  });

  getPoinvoice = asyncHandler(async (request: FastifyRequest<{ Params: PoinvoiceParams }>, reply: FastifyReply) => {
    const { id } = poinvoiceParamsSchema.parse(request.params);
    
    const poinvoice = await this.poinvoiceService.findById(id);
    
    const response = createSuccessResponse('Poinvoice retrieved successfully', formatPoinvoiceForAPI(poinvoice));
    return reply.code(200).send(response);
  });

  createPoinvoice = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createPoinvoiceSchema.parse(request.body);
    
    const poinvoice = await this.poinvoiceService.create(data);
    
    const response = createSuccessResponse('Poinvoice created successfully', formatPoinvoiceForAPI(poinvoice));
    return reply.code(201).send(response);
  });

  updatePoinvoice = asyncHandler(async (request: FastifyRequest<{ Params: PoinvoiceParams }>, reply: FastifyReply) => {
    const { id } = poinvoiceParamsSchema.parse(request.params);
    const data = updatePoinvoiceSchema.parse(request.body);
    
    const poinvoice = await this.poinvoiceService.update(id, data);
    
    const response = createSuccessResponse('Poinvoice updated successfully', formatPoinvoiceForAPI(poinvoice));
    return reply.code(200).send(response);
  });

  deletePoinvoice = asyncHandler(async (request: FastifyRequest<{ Params: PoinvoiceParams }>, reply: FastifyReply) => {
    const { id } = poinvoiceParamsSchema.parse(request.params);
    
    await this.poinvoiceService.delete(id);
    
    const response = createSuccessResponse('Poinvoice deleted successfully', null);
    return reply.code(200).send(response);
  });

  upsertPoinvoice = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = upsertPoinvoiceSchema.parse(request.body);
    
    const poinvoice = await this.poinvoiceService.upsert(data);
    
    const message = data.id ? 'Poinvoice updated successfully' : 'Poinvoice created successfully';
    const response = createSuccessResponse(message, formatPoinvoiceForAPI(poinvoice));
    return reply.code(200).send(response);
  });
} 