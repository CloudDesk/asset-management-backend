import { FastifyRequest, FastifyReply } from 'fastify';
import { UsersService } from '../services/users.service.js';
export declare class UsersController {
    usersService: UsersService;
    getUsers: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=users.controller.d.ts.map