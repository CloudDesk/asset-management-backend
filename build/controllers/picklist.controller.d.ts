import { FastifyRequest, FastifyReply } from 'fastify';
import { PicklistService } from '../services/picklist.service.js';
export declare class PicklistController {
    picklistService: PicklistService;
    getPicklists: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getPicklist: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createPicklist: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updatePicklist: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deletePicklist: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * v2: Get picklists with optional grouping by fieldname and/or parent
     * Supports both flat and grouped response formats
     */
    getPicklistsV2: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * v2: Bulk update picklists - Update fieldname, parent, sortorder, label, value, controlled fields, and isactive
     * Allows reordering and reorganizing picklist items from frontend
     * Supports soft delete via isactive flag
     */
    bulkUpdatePicklistsV2: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get unique fieldnames filtered by object
     * Returns array of unique fieldname strings for dependency management
     */
    getDependencyFieldnames: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=picklist.controller.d.ts.map