import { prisma } from "../models/prisma.js";
import { Prisma } from "@prisma/client";
import {
  CreateAddressInput,
  UpdateAddressInput,
  UpsertAddressInput,
} from "../schemas/address.schema.js";
import {
  PaginationResult,
  createPaginationResult,
  getPrismaSkipTake,
} from "../utils/pagination.js";
import { FilterOptions } from "../utils/filterBuilder.js";
import {
  dynamicFindMany,
  dynamicCount,
  dynamicFindUnique,
  dynamicCreate,
  dynamicUpdate,
  dynamicDelete,
  dynamicFindManyWithFilters,
} from "../utils/dynamicDbOperations.js";
import { logger } from "../config/logger.js";

export class AddressService {
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info(
        { filters, page, limit },
        "Starting dynamic address findMany with filters"
      );

      const { skip, take } = getPrismaSkipTake(page, limit);

      // Use the new dynamic filtering system
      const { data: addresses, total } = await dynamicFindManyWithFilters(
        "address",
        filters,
        {
          skip,
          take,
          useAllColumns: true, // Get all available columns
        }
      );

      logger.info(
        {
          addressCount: addresses.length,
          total,
          filtered: Object.keys(filters).length > 0,
          appliedFilters: Object.keys(filters),
          availableFields:
            addresses.length > 0 ? Object.keys(addresses[0]) : [],
        },
        "Dynamic address findMany with filters completed"
      );

      return createPaginationResult(addresses, total, page, limit);
    } catch (error) {
      logger.error(
        { error, filters, page, limit },
        "Error in dynamic address findMany operation"
      );
      throw error;
    }
  }

  async findById(id: string) {
    try {
      logger.debug(
        { addressId: id },
        "Starting dynamic address findById operation"
      );

      const address = await dynamicFindUnique("address", { id });

      if (!address) {
        throw new Error("Address not found");
      }

      logger.debug(
        {
          addressId: id,
          availableFields: Object.keys(address),
        },
        "Dynamic address findById completed"
      );

      return address;
    } catch (error) {
      logger.error(
        { error, addressId: id },
        "Error in address findById operation"
      );
      throw error;
    }
  }

  private async handleDefaultAddress(
    userid: number,
    isdefaultaddress: boolean,
    excludeAddressId?: string
  ) {
    if (isdefaultaddress && userid) {
      // If setting this address as default, unset all other addresses for this user
      logger.debug(
        { userid, excludeAddressId },
        "Unsetting default status for other addresses"
      );

      // Find all addresses for this user and unset their default status
      const filters = { userid: userid };
      const { data: addresses } = await dynamicFindManyWithFilters(
        "address",
        filters,
        {
          useAllColumns: false,
        }
      );

      // Update all other addresses to not be default
      for (const address of addresses) {
        if (
          address.id !== excludeAddressId &&
          address.isdefaultaddress === true
        ) {
          await dynamicUpdate(
            "address",
            { id: address.id },
            { isdefaultaddress: false, modifieddate: Date.now() }
          );
        }
      }
    }
  }

  async create(data: CreateAddressInput & Record<string, any>) {
    try {
      logger.debug(
        { originalData: data },
        "Starting dynamic address create operation"
      );

      // Handle default address logic
      if (data.isdefaultaddress && data.userid) {
        await this.handleDefaultAddress(data.userid, data.isdefaultaddress);
      }

      // Auto-set created and modified dates if not provided
      const currentTimestamp = Date.now();
      const createData = {
        ...data,
        createddate: data.createddate || currentTimestamp,
        modifieddate: data.modifieddate || currentTimestamp,
      };

      const address = await dynamicCreate("address", createData);

      if (!address) {
        throw new Error("Failed to create address - no valid fields provided");
      }

      logger.info(
        {
          addressId: address.id,
          availableFields: Object.keys(address),
        },
        "Dynamic address create completed"
      );

      return address;
    } catch (error) {
      logger.error({ error, data }, "Error in address create operation");
      throw error;
    }
  }

  async update(id: string, data: UpdateAddressInput & Record<string, any>) {
    try {
      // Check if address exists
      const existingAddress = await this.findById(id);

      logger.debug(
        { originalData: data, addressId: id },
        "Starting dynamic address update operation"
      );

      // Handle default address logic
      if (data.isdefaultaddress && data.userid) {
        await this.handleDefaultAddress(data.userid, data.isdefaultaddress, id);
      } else if (data.isdefaultaddress && existingAddress.userid) {
        await this.handleDefaultAddress(
          existingAddress.userid,
          data.isdefaultaddress,
          id
        );
      }

      // Auto-set modified date
      const updateData = {
        ...data,
        modifieddate: data.modifieddate || Date.now(),
      };

      const address = await dynamicUpdate("address", { id }, updateData);

      if (!address) {
        throw new Error("Failed to update address - no valid fields provided");
      }

      logger.info(
        {
          addressId: id,
          availableFields: Object.keys(address),
        },
        "Dynamic address update completed"
      );

      return address;
    } catch (error) {
      logger.error(
        { error, data, addressId: id },
        "Error in address update operation"
      );
      throw error;
    }
  }

  async delete(id: string) {
    try {
      // Check if address exists
      await this.findById(id);

      logger.debug(
        { addressId: id },
        "Starting dynamic address delete operation"
      );

      const success = await dynamicDelete("address", { id });

      if (!success) {
        throw new Error("Failed to delete address");
      }

      logger.info(
        { addressId: id },
        "Dynamic address delete completed successfully"
      );
    } catch (error) {
      logger.error(
        { error, addressId: id },
        "Error in address delete operation"
      );
      throw error;
    }
  }

  async upsert(data: UpsertAddressInput & Record<string, any>) {
    try {
      const { id, ...updateData } = data;

      if (id) {
        // Update existing address
        logger.debug(
          { addressId: id, data: updateData },
          "Upserting existing address"
        );
        return this.update(id, updateData);
      } else {
        // Create new address
        logger.debug({ data: updateData }, "Upserting new address");
        return this.create(updateData);
      }
    } catch (error) {
      logger.error({ error, data }, "Error in address upsert operation");
      throw error;
    }
  }
}
