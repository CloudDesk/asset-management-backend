import { FastifyRequest, FastifyReply } from 'fastify';
import { AddressService } from '../services/address.service.js';
export declare class AddressController {
    addressService: AddressService;
    getAddresses: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getAddress: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createAddress: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateAddress: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteAddress: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertAddress: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getDefaultAddress: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=address.controller.d.ts.map