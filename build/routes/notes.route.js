import { NotesController } from '../controllers/notes.controller.js';
export async function notesRoutes(fastify) {
    const notesController = new NotesController();
    // GET /v1/notes - Get all notes with pagination and filtering
    fastify.get('/', {
        schema: {
            description: 'Get all notes with pagination and filtering',
            tags: ['Notes'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                    quotenumber: { type: 'string', description: 'Filter by quote number' },
                    title: { type: 'string', description: 'Filter by title' },
                    ispinned: { type: 'string', description: 'Filter by pinned status' },
                },
                additionalProperties: true, // Allow any query parameters for dynamic filtering
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'number', description: 'Note ID' },
                                    quotenumber: { type: 'string', description: 'Associated quote number' },
                                    comment: { type: 'string', description: 'Note content' },
                                    title: { type: 'string', description: 'Note title' },
                                    ispinned: { type: 'boolean', description: 'Whether the note is pinned' },
                                },
                                additionalProperties: true // Allow any additional fields
                            }
                        },
                        message: { type: 'string' },
                        pagination: {
                            type: 'object',
                            properties: {
                                page: { type: 'number' },
                                limit: { type: 'number' },
                                total: { type: 'number' },
                                totalPages: { type: 'number' },
                            }
                        },
                        meta: {
                            type: 'object',
                            properties: {
                                filters: { type: 'array', items: { type: 'string' } },
                                total: { type: 'number' },
                                filtered: { type: 'boolean' },
                            },
                        },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        error: { type: 'string' },
                    },
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        error: { type: 'string' },
                    },
                },
            },
        },
    }, notesController.getNotes.bind(notesController));
    // GET /v1/notes/:id - Get note by ID
    fastify.get('/:id', {
        schema: {
            description: 'Get note by ID',
            tags: ['Notes'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Note ID' },
                },
                required: ['id'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                id: { type: 'number', description: 'Note ID' },
                                quotenumber: { type: 'string', description: 'Associated quote number' },
                                comment: { type: 'string', description: 'Note content' },
                                title: { type: 'string', description: 'Note title' },
                                ispinned: { type: 'boolean', description: 'Whether the note is pinned' },
                            },
                            additionalProperties: true // Allow any additional fields
                        },
                        message: { type: 'string' },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
            },
        },
    }, notesController.getNote.bind(notesController));
    // POST /v1/notes - Create new note
    fastify.post('/', {
        schema: {
            description: 'Create a new note',
            tags: ['Notes'],
            body: {
                type: 'object',
                properties: {
                    quotenumber: { type: 'string', maxLength: 500, description: 'Associated quote number' },
                    comment: { type: 'string', description: 'Note content' },
                    title: { type: 'string', maxLength: 500, description: 'Note title' },
                    ispinned: { type: 'boolean', description: 'Whether the note is pinned' },
                },
                additionalProperties: true, // Allow any additional fields
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                id: { type: 'number', description: 'Note ID' },
                                quotenumber: { type: 'string', description: 'Associated quote number' },
                                comment: { type: 'string', description: 'Note content' },
                                title: { type: 'string', description: 'Note title' },
                                ispinned: { type: 'boolean', description: 'Whether the note is pinned' },
                            },
                            additionalProperties: true
                        },
                        message: { type: 'string' },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
            },
        },
    }, notesController.createNote.bind(notesController));
    // PUT /v1/notes/:id - Update note
    fastify.put('/:id', {
        schema: {
            description: 'Update a note',
            tags: ['Notes'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Note ID' },
                },
                required: ['id'],
            },
            body: {
                type: 'object',
                properties: {
                    quotenumber: { type: 'string', maxLength: 500, description: 'Associated quote number' },
                    comment: { type: 'string', description: 'Note content' },
                    title: { type: 'string', maxLength: 500, description: 'Note title' },
                    ispinned: { type: 'boolean', description: 'Whether the note is pinned' },
                },
                additionalProperties: true,
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                id: { type: 'number', description: 'Note ID' },
                                quotenumber: { type: 'string', description: 'Associated quote number' },
                                comment: { type: 'string', description: 'Note content' },
                                title: { type: 'string', description: 'Note title' },
                                ispinned: { type: 'boolean', description: 'Whether the note is pinned' },
                            },
                            additionalProperties: true
                        },
                        message: { type: 'string' },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
            },
        },
    }, notesController.updateNote.bind(notesController));
    // DELETE /v1/notes/:id - Delete note
    fastify.delete('/:id', {
        schema: {
            description: 'Delete a note',
            tags: ['Notes'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Note ID' },
                },
                required: ['id'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: { type: 'null' },
                        message: { type: 'string' },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
            },
        },
    }, notesController.deleteNote.bind(notesController));
    // GET /v1/notes/quotenumber/:quotenumber - Get notes by quote number
    fastify.get('/quotenumber/:quotenumber', {
        schema: {
            description: 'Get notes by quote number',
            tags: ['Notes'],
            params: {
                type: 'object',
                properties: {
                    quotenumber: { type: 'string', description: 'Quote number' },
                },
                required: ['quotenumber'],
            },
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'number', description: 'Note ID' },
                                    quotenumber: { type: 'string', description: 'Associated quote number' },
                                    comment: { type: 'string', description: 'Note content' },
                                    title: { type: 'string', description: 'Note title' },
                                    ispinned: { type: 'boolean', description: 'Whether the note is pinned' },
                                },
                                additionalProperties: true
                            }
                        },
                        message: { type: 'string' },
                        pagination: {
                            type: 'object',
                            properties: {
                                page: { type: 'number' },
                                limit: { type: 'number' },
                                total: { type: 'number' },
                                totalPages: { type: 'number' },
                            }
                        },
                        meta: {
                            type: 'object',
                            properties: {
                                quotenumber: { type: 'string' },
                                total: { type: 'number' },
                                filtered: { type: 'boolean' },
                            },
                        },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        error: { type: 'string' },
                    },
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        error: { type: 'string' },
                    },
                },
            },
        },
    }, notesController.getNotesByQuoteNumber.bind(notesController));
    // GET /v1/notes/stats - Get notes statistics
    fastify.get('/stats', {
        schema: {
            description: 'Get notes statistics',
            tags: ['Notes'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                total: { type: 'number', description: 'Total number of notes' },
                                byQuote: {
                                    type: 'object',
                                    description: 'Count of notes by quote number',
                                    additionalProperties: { type: 'number' }
                                },
                                pinned: { type: 'number', description: 'Number of pinned notes' },
                            },
                        },
                        message: { type: 'string' },
                    },
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        error: { type: 'string' },
                    },
                },
            },
        },
    }, notesController.getNotesStats.bind(notesController));
}
//# sourceMappingURL=notes.route.js.map