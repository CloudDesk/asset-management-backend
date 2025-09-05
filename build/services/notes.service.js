import { logger } from '../config/logger.js';
import { dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters, dynamicCount } from '../utils/dynamicDbOperations.js';
import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
export class NotesService {
    async findMany(filters, page, limit) {
        try {
            logger.debug({ filters, page, limit }, 'Starting dynamic notes findMany operation');
            const { skip, take } = getPrismaSkipTake(page, limit);
            const result = await dynamicFindManyWithFilters('notes', filters, {
                skip,
                take,
                useAllColumns: true
            });
            logger.debug({
                resultCount: result.data.length,
                total: result.total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: result.data[0] ? Object.keys(result.data[0]) : []
            }, 'Dynamic notes findMany completed');
            return createPaginationResult(result.data, result.total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters }, 'Error in notes findMany operation');
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ notesId: id }, 'Starting dynamic notes findById operation');
            const note = await dynamicFindUnique('notes', { id: parseInt(id) });
            if (!note) {
                throw new Error('Note not found');
            }
            logger.debug({
                notesId: id,
                availableFields: Object.keys(note)
            }, 'Dynamic notes findById completed');
            return note;
        }
        catch (error) {
            logger.error({ error, notesId: id }, 'Error in notes findById operation');
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ data }, 'Starting dynamic notes create operation');
            const note = await dynamicCreate('notes', data);
            logger.debug({
                noteId: note.id,
                availableFields: Object.keys(note)
            }, 'Dynamic notes create completed');
            return note;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in notes create operation');
            throw error;
        }
    }
    async update(id, data) {
        try {
            logger.debug({ notesId: id, data }, 'Starting dynamic notes update operation');
            const note = await dynamicUpdate('notes', { id: parseInt(id) }, data);
            logger.debug({
                noteId: note.id,
                availableFields: Object.keys(note)
            }, 'Dynamic notes update completed');
            return note;
        }
        catch (error) {
            logger.error({ error, notesId: id, data }, 'Error in notes update operation');
            throw error;
        }
    }
    async delete(id) {
        try {
            logger.debug({ notesId: id }, 'Starting dynamic notes delete operation');
            // First check if the note exists
            const note = await dynamicFindUnique('notes', { id: parseInt(id) });
            if (!note) {
                throw new Error('Note not found');
            }
            await dynamicDelete('notes', { id: parseInt(id) });
            logger.debug({ notesId: id }, 'Dynamic notes delete completed');
        }
        catch (error) {
            logger.error({ error, notesId: id }, 'Error in notes delete operation');
            throw error;
        }
    }
    async findByQuoteNumber(quotenumber, page = 1, limit = 10) {
        try {
            logger.debug({ quotenumber, page, limit }, 'Finding notes by quote number');
            const filters = { quotenumber };
            return this.findMany(filters, page, limit);
        }
        catch (error) {
            logger.error({ error, quotenumber }, 'Error finding notes by quote number');
            throw error;
        }
    }
    async getNotesStats() {
        try {
            logger.debug('Getting notes statistics');
            // Get total count
            const total = await dynamicCount('notes');
            // Get all notes for stats
            const notesCounts = await dynamicFindManyWithFilters('notes', {}, {
                useAllColumns: false
            });
            const stats = {
                total,
                byQuote: notesCounts.data.reduce((acc, note) => {
                    const quotenumber = note.quotenumber || 'unassigned';
                    acc[quotenumber] = (acc[quotenumber] || 0) + 1;
                    return acc;
                }, {}),
                pinned: notesCounts.data.filter((note) => note.ispinned).length
            };
            logger.debug({ stats }, 'Notes statistics retrieved');
            return stats;
        }
        catch (error) {
            logger.error({ error }, 'Error getting notes statistics');
            throw error;
        }
    }
}
//# sourceMappingURL=notes.service.js.map