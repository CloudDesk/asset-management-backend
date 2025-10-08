import { FastifyRequest, FastifyReply } from 'fastify';
import { UsersService } from '../services/users.service.js';
export declare class UsersController {
    usersService: UsersService;
    getUsers: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Create a guest user for checkout without registration
     */
    createGuestUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Convert guest user to registered user
     */
    convertGuestToRegistered: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=users.controller.d.ts.map