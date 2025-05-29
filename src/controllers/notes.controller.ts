import { FastifyRequest, FastifyReply } from 'fastify';
import { NotesService } from '../services/notes.service.js';
import { 
  createNotesSchema, 
  updateNotesSchema,
  notesParamsSchema,
  NotesParams
} from '../schemas/notes.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';
import { formatEntityForAPI, formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';

export class NotesController {
  public notesService = new NotesService();

  getNotes = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters (not just schema-validated ones)
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.notesService.findMany(filters, page, limit);
    
    // Format all notes in the result
    const formattedData = formatEntitiesForAPI(result.data, 'notes');
    
    const response = createSuccessResponse('Notes retrieved successfully', formattedData);
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

  getNote = asyncHandler(async (request: FastifyRequest<{ Params: NotesParams }>, reply: FastifyReply) => {
    const { id } = notesParamsSchema.parse(request.params);
    
    const note = await this.notesService.findById(id);
    
    const response = createSuccessResponse('Note retrieved successfully', formatEntityForAPI(note, 'notes'));
    return reply.code(200).send(response);
  });

  createNote = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createNotesSchema.parse(request.body);
    
    const note = await this.notesService.create(data);
    
    const response = createSuccessResponse('Note created successfully', formatEntityForAPI(note, 'notes'));
    return reply.code(201).send(response);
  });

  updateNote = asyncHandler(async (request: FastifyRequest<{ Params: NotesParams }>, reply: FastifyReply) => {
    const { id } = notesParamsSchema.parse(request.params);
    const data = updateNotesSchema.parse(request.body);
    
    const note = await this.notesService.update(id, data);
    
    const response = createSuccessResponse('Note updated successfully', formatEntityForAPI(note, 'notes'));
    return reply.code(200).send(response);
  });

  deleteNote = asyncHandler(async (request: FastifyRequest<{ Params: NotesParams }>, reply: FastifyReply) => {
    const { id } = notesParamsSchema.parse(request.params);
    
    await this.notesService.delete(id);
    
    const response = createSuccessResponse('Note deleted successfully', null);
    return reply.code(200).send(response);
  });

  getNotesByQuoteNumber = asyncHandler(async (request: FastifyRequest<{ 
    Params: { quotenumber: string };
    Querystring: Record<string, any>;
  }>, reply: FastifyReply) => {
    const { quotenumber } = request.params;
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    const result = await this.notesService.findByQuoteNumber(quotenumber, page, limit);
    
    const formattedData = formatEntitiesForAPI(result.data, 'notes');
    
    const response = createSuccessResponse('Notes retrieved successfully', formattedData);
    return reply.code(200).send({
      ...response,
      pagination: result.pagination,
      meta: {
        quotenumber,
        total: result.pagination.total,
        filtered: true
      }
    });
  });

  getNotesStats = asyncHandler(async (_request: FastifyRequest, reply: FastifyReply) => {
    const stats = await this.notesService.getNotesStats();
    
    const response = createSuccessResponse('Notes statistics retrieved successfully', stats);
    return reply.code(200).send(response);
  });
} 