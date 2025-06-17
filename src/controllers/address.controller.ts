import { FastifyRequest, FastifyReply } from "fastify";
import { AddressService } from "../services/address.service.js";
import {
  createAddressSchema,
  updateAddressSchema,
  upsertAddressSchema,
  addressParamsSchema,
  AddressParams,
} from "../schemas/address.schema.js";
import { getPaginationParams } from "../utils/pagination.js";
import { createSuccessResponse, asyncHandler } from "../utils/errorHandler.js";
import {
  formatAddressForAPI,
  formatEntitiesForAPI,
} from "../utils/dynamicDbOperations.js";

export class AddressController {
  public addressService = new AddressService();

  getAddresses = asyncHandler(
    async (
      request: FastifyRequest<{ Querystring: Record<string, any> }>,
      reply: FastifyReply
    ) => {
      // Get all query parameters as filters (not just schema-validated ones)
      const allFilters: Record<string, any> = request.query || {};
      const { page, limit } = getPaginationParams(allFilters);

      // Remove pagination params from filters
      const { page: _, limit: __, ...filters } = allFilters;

      const result = await this.addressService.findMany(filters, page, limit);

      // Format all addresses in the result
      const formattedData = formatEntitiesForAPI(result.data, "address");

      const response = createSuccessResponse(
        "Addresses retrieved successfully",
        formattedData
      );
      return reply.code(200).send({
        ...response,
        pagination: result.pagination,
        meta: {
          filters: Object.keys(filters),
          total: result.pagination.total,
          filtered: Object.keys(filters).length > 0,
        },
      });
    }
  );

  getAddress = asyncHandler(
    async (
      request: FastifyRequest<{ Params: AddressParams }>,
      reply: FastifyReply
    ) => {
      const { id } = addressParamsSchema.parse(request.params);

      const address = await this.addressService.findById(id);

      const response = createSuccessResponse(
        "Address retrieved successfully",
        formatAddressForAPI(address)
      );
      return reply.code(200).send(response);
    }
  );

  createAddress = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createAddressSchema.parse(request.body);

      const address = await this.addressService.create(data);

      const response = createSuccessResponse(
        "Address created successfully",
        formatAddressForAPI(address)
      );
      return reply.code(201).send(response);
    }
  );

  updateAddress = asyncHandler(
    async (
      request: FastifyRequest<{ Params: AddressParams }>,
      reply: FastifyReply
    ) => {
      const { id } = addressParamsSchema.parse(request.params);
      const data = updateAddressSchema.parse(request.body);

      const address = await this.addressService.update(id, data);

      const response = createSuccessResponse(
        "Address updated successfully",
        formatAddressForAPI(address)
      );
      return reply.code(200).send(response);
    }
  );

  deleteAddress = asyncHandler(
    async (
      request: FastifyRequest<{ Params: AddressParams }>,
      reply: FastifyReply
    ) => {
      const { id } = addressParamsSchema.parse(request.params);

      await this.addressService.delete(id);

      const response = createSuccessResponse(
        "Address deleted successfully",
        null
      );
      return reply.code(200).send(response);
    }
  );

  upsertAddress = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = upsertAddressSchema.parse(request.body);

      const address = await this.addressService.upsert(data);

      const message = data.id
        ? "Address updated successfully"
        : "Address created successfully";
      const response = createSuccessResponse(
        message,
        formatAddressForAPI(address)
      );
      return reply.code(200).send(response);
    }
  );
}
