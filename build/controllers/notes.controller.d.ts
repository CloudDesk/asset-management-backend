import { FastifyRequest, FastifyReply } from 'fastify';
import { NotesService } from '../services/notes.service.js';
export declare class NotesController {
    notesService: NotesService;
    getNotes: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getNote: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createNote: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateNote: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteNote: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getNotesByQuoteNumber: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getNotesStats: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=notes.controller.d.ts.map