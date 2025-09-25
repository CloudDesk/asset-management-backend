import { FastifyInstance } from "fastify";
import { PlatformStockController } from "../controllers/platformStock.controller.js";

export async function platformStockRoutes(fastify: FastifyInstance) {
  const platformStockController = new PlatformStockController();

  // GET /v1/platform-stocks - Get all platform stocks with pagination and filtering
  fastify.get("/", {
    schema: {
      description: "Get all platform stocks with pagination and filtering",
      tags: ["Platform Stocks"],
      querystring: {
        type: "object",
        properties: {
          page: { type: "string", description: "Page number" },
          limit: { type: "string", description: "Items per page" },
          // Current PlatformStock model fields
          productId: { type: "string", description: "Filter by product ID" },
          platform: { type: "string", description: "Filter by platform (amazon, flipkart, nivapp)" },
          minAvailableQty: { type: "string", description: "Minimum available quantity" },
          maxAvailableQty: { type: "string", description: "Maximum available quantity" },
          minOrderedQty: { type: "string", description: "Minimum ordered quantity" },
          maxOrderedQty: { type: "string", description: "Maximum ordered quantity" },
          minSoldQty: { type: "string", description: "Minimum sold quantity" },
          maxSoldQty: { type: "string", description: "Maximum sold quantity" },
          minTotalQty: { type: "string", description: "Minimum total quantity" },
          maxTotalQty: { type: "string", description: "Maximum total quantity" },
          minLockQty: { type: "string", description: "Minimum lock quantity" },
          maxLockQty: { type: "string", description: "Maximum lock quantity" },
          createdAfter: { type: "string", description: "Created after date (timestamp)" },
          createdBefore: { type: "string", description: "Created before date (timestamp)" },
        },
        additionalProperties: true, // Allow any query parameters for dynamic filtering
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number", description: "Platform Stock ID" },
                  productId: { type: "number", description: "Product ID" },
                  platform: { type: "string", description: "Platform (amazon, flipkart, nivapp)" },
                  availableQty: { type: "number", description: "Available quantity" },
                  orderedQty: { type: "number", description: "Ordered quantity" },
                  soldQty: { type: "number", description: "Sold quantity" },
                  totalQty: { type: "number", description: "Total quantity" },
                  lockQty: { type: "number", nullable: true, description: "Lock quantity" },
                  createddate: { type: "number", nullable: true, description: "Creation timestamp" },
                  modifieddate: { type: "number", nullable: true, description: "Modification timestamp" },
                },
                additionalProperties: true, // Allow additional dynamic fields
              },
            },
            pagination: {
              type: "object",
              properties: {
                page: { type: "number" },
                limit: { type: "number" },
                total: { type: "number" },
                totalPages: { type: "number" },
                hasNext: { type: "boolean" },
                hasPrev: { type: "boolean" },
              },
            },
            meta: {
              type: "object",
              properties: {
                filters: { type: "array", items: { type: "string" } },
                total: { type: "number" },
                filtered: { type: "boolean" },
              },
            },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
        500: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, platformStockController.getPlatformStocks.bind(platformStockController));

  // GET /v1/platform-stocks/:id - Get platform stock by ID
  fastify.get("/:id", {
    schema: {
      description: "Get platform stock by ID",
      tags: ["Platform Stocks"],
      params: {
        type: "object",
        properties: {
          id: { type: "string", description: "Platform Stock ID" },
        },
        required: ["id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                id: { type: "number", description: "Platform Stock ID" },
                productId: { type: "number", description: "Product ID" },
                platform: { type: "string", description: "Platform (amazon, flipkart, nivapp)" },
                availableQty: { type: "number", description: "Available quantity" },
                orderedQty: { type: "number", description: "Ordered quantity" },
                soldQty: { type: "number", description: "Sold quantity" },
                totalQty: { type: "number", description: "Total quantity" },
                lockQty: { type: "number", nullable: true, description: "Lock quantity" },
                createddate: { type: "number", nullable: true, description: "Creation timestamp" },
                modifieddate: { type: "number", nullable: true, description: "Modification timestamp" },
              },
              additionalProperties: true, // Allow additional dynamic fields
            },
            message: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
          },
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
          },
        },
        500: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
          },
        },
      },
    },
  }, platformStockController.getPlatformStockById.bind(platformStockController));

  // POST /v1/platform-stocks - Create new platform stock
  fastify.post("/", {
    schema: {
      description: "Create a new platform stock entry",
      tags: ["Platform Stocks"],
      body: {
        type: "object",
        properties: {
          // Required fields
          productId: { type: "number", description: "Product ID (required)" },
          platform: { type: "string", maxLength: 100, description: "Platform (amazon, flipkart, nivapp) (required)" },
          // Optional fields with defaults
          availableQty: { type: "number", description: "Available quantity", default: 0 },
          orderedQty: { type: "number", description: "Ordered quantity", default: 0 },
          soldQty: { type: "number", description: "Sold quantity", default: 0 },
          totalQty: { type: "number", description: "Total quantity", default: 0 },
          lockQty: { type: "number", description: "Lock quantity", default: 0 },
        },
        required: ["productId", "platform"],
        additionalProperties: true, // Allow additional dynamic fields
      },
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              additionalProperties: true, // Allow any fields in platform stock object
            },
            message: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
          },
        },
        500: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
          },
        },
      },
    },
  }, platformStockController.createPlatformStock.bind(platformStockController));

  // PUT /v1/platform-stocks/:id - Update platform stock
  fastify.put("/:id", {
    schema: {
      description: "Update platform stock by ID",
      tags: ["Platform Stocks"],
      params: {
        type: "object",
        properties: {
          id: { type: "string", description: "Platform Stock ID" },
        },
        required: ["id"],
      },
      body: {
        type: "object",
        properties: {
          // Updateable fields
          platform: { type: "string", maxLength: 100, description: "Platform (amazon, flipkart, nivapp)" },
          availableQty: { type: "number", description: "Available quantity" },
          orderedQty: { type: "number", description: "Ordered quantity" },
          soldQty: { type: "number", description: "Sold quantity" },
          totalQty: { type: "number", description: "Total quantity" },
          lockQty: { type: "number", description: "Lock quantity" },
        },
        additionalProperties: true, // Allow additional dynamic fields
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              additionalProperties: true, // Allow any fields in platform stock object
            },
            message: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
          },
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
          },
        },
        500: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
          },
        },
      },
    },
  }, platformStockController.updatePlatformStock.bind(platformStockController));

  // DELETE /v1/platform-stocks/:id - Delete platform stock
  fastify.delete("/:id", {
    schema: {
      description: "Delete platform stock by ID",
      tags: ["Platform Stocks"],
      params: {
        type: "object",
        properties: {
          id: { type: "string", description: "Platform Stock ID" },
        },
        required: ["id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
          },
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
          },
        },
        500: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
          },
        },
      },
    },
  }, platformStockController.deletePlatformStock.bind(platformStockController));

  // POST /v1/platform-stocks/upsert - Upsert platform stock
  fastify.post("/upsert", {
    schema: {
      description: "Create or update platform stock (upsert)",
      tags: ["Platform Stocks"],
      body: {
        type: "object",
        properties: {
          productId: { type: "number", description: "Product ID (required)" },
          platform: { type: "string", maxLength: 100, description: "Platform (amazon, flipkart, nivapp) (required)" },
          availableQty: { type: "number", description: "Available quantity", default: 0 },
          orderedQty: { type: "number", description: "Ordered quantity", default: 0 },
          soldQty: { type: "number", description: "Sold quantity", default: 0 },
          totalQty: { type: "number", description: "Total quantity", default: 0 },
          lockQty: { type: "number", description: "Lock quantity", default: 0 },
        },
        required: ["productId", "platform"],
        additionalProperties: true, // Allow additional dynamic fields
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "object" },
            message: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
          },
        },
        500: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
          },
        },
      },
    },
  }, platformStockController.upsertPlatformStock.bind(platformStockController));

  // GET /v1/platform-stocks/product/:productId - Get platform stocks for a specific product
  fastify.get("/product/:productId", {
    schema: {
      description: "Get all platform stocks for a specific product",
      tags: ["Platform Stocks"],
      params: {
        type: "object",
        properties: {
          productId: { type: "string", description: "Product ID" },
        },
        required: ["productId"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number", description: "Platform Stock ID" },
                  productId: { type: "number", description: "Product ID" },
                  platform: { type: "string", description: "Platform (amazon, flipkart, nivapp)" },
                  availableQty: { type: "number", description: "Available quantity" },
                  orderedQty: { type: "number", description: "Ordered quantity" },
                  soldQty: { type: "number", description: "Sold quantity" },
                  totalQty: { type: "number", description: "Total quantity" },
                  lockQty: { type: "number", nullable: true, description: "Lock quantity" },
                  createddate: { type: "number", nullable: true, description: "Creation timestamp" },
                  modifieddate: { type: "number", nullable: true, description: "Modification timestamp" },
                },
                additionalProperties: true,
              },
            },
            message: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
          },
        },
        500: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
          },
        },
      },
    },
  }, platformStockController.getPlatformStocksByProduct.bind(platformStockController));
}
