import { FastifyInstance } from "fastify";
import { PromotionalAssetsController } from "../controllers/promotional-assets.controller.js";
import { requireAuthentication } from "../middleware/auth.middleware.js";

export async function promotionalAssetsRoutes(fastify: FastifyInstance) {
  const controller = new PromotionalAssetsController();

  // Apply authentication to all routes - TEMPORARILY DISABLED FOR TESTING
  await fastify.register(async function (fastify) {
    // fastify.addHook('preHandler', requireAuthentication);

    // GET /v1/promotional-assets - List assets
    fastify.get(
      "/",
      {
        schema: {
          description: "Get promotional assets with filtering and pagination",
          tags: ["Promotional Assets"],
          querystring: {
            type: "object",
            properties: {
              page: { type: "string", description: "Page number" },
              limit: { type: "string", description: "Items per page" },
              type: { 
                type: "string", 
                description: "Filter by asset type (single: banner, or multiple: banner,popup)" 
              },
              placement: { type: "string", description: "Filter by placement" },
              is_active: { 
                type: "string", 
                description: "Filter by active status (true/false/1/0/yes/no/on/off)" 
              },
              schedule_active: { 
                type: "string", 
                enum: ["true", "false"],
                description: "Filter by current schedule status" 
              },
              priority: { type: "string", description: "Filter by exact priority value" },
              priority_min: { type: "string", description: "Minimum priority" },
              priority_max: { type: "string", description: "Maximum priority" },
              title: { type: "string", description: "Search in title (case-insensitive)" },
              content_search: { type: "string", description: "Search in content (JSONB search)" },
              schedule_start: { type: "string", format: "date-time", description: "Filter by schedule start date" },
              schedule_end: { type: "string", format: "date-time", description: "Filter by schedule end date" },
            },
          },
          response: {
            200: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" },
                data: { 
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer" },
                      type: { type: "string" },
                      placement: { type: "string" },
                      title: { type: "string" },
                      content: { type: "object", additionalProperties: true },
                      priority: { type: "integer" },
                      is_active: { type: "boolean" },
                      schedule_start: { type: "string", format: "date-time" },
                      schedule_end: { type: "string", format: "date-time" },
                      version: { type: "integer" },
                      createddate: { type: "number" },
                      modifieddate: { type: "number" }
                    }
                  }
                },
                pagination: { 
                  type: "object",
                  properties: {
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    total: { type: "integer" },
                    totalPages: { type: "integer" }
                  }
                },
                meta: { type: "object" }
              }
            },
            400: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" },
                details: { type: "string" },
                statusCode: { type: "integer" }
              }
            }
          }
        },
      },
      controller.getAssets
    );

    // GET /v1/promotional-assets/:id - Get specific asset
    fastify.get(
      "/:id",
      {
        schema: {
          description: "Get specific promotional asset",
          tags: ["Promotional Assets"],
          params: {
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string", pattern: "^\\d+$", description: "Asset ID" }
            }
          },
          response: {
            200: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" },
                data: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    type: { type: "string" },
                    placement: { type: "string" },
                    title: { type: "string" },
                    content: { type: "object", additionalProperties: true },
                    priority: { type: "integer" },
                    is_active: { type: "boolean" },
                    schedule_start: { type: "string", format: "date-time" },
                    schedule_end: { type: "string", format: "date-time" },
                    version: { type: "integer" },
                    createddate: { type: "number" },
                    modifieddate: { type: "number" }
                  }
                }
              }
            },
            404: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" },
                statusCode: { type: "integer" }
              }
            }
          }
        },
      },
      controller.getAsset
    );

    // POST /v1/promotional-assets - Create asset
    fastify.post(
      "/",
      {
        schema: {
          description: "Create new promotional asset",
          tags: ["Promotional Assets"],
          body: {
            type: "object",
            required: ["type", "placement", "title"],
            properties: {
              type: { 
                type: "string", 
                enum: ["banner", "featured_ad", "popup", "carousel"],
                description: "Type of promotional asset"
              },
              placement: { 
                type: "string", 
                maxLength: 100,
                description: "Where the asset will be displayed"
              },
              title: { 
                type: "string", 
                maxLength: 255,
                description: "Title of the promotional asset"
              },
              content: { 
                type: "object",
                additionalProperties: true,
                description: "JSONB content of the asset (images, text, etc.)"
              },
              priority: { 
                type: "integer", 
                minimum: 0, 
                default: 0,
                description: "Display priority (higher numbers shown first)"
              },
              is_active: { 
                type: "boolean", 
                default: true,
                description: "Whether the asset is active"
              },
              schedule_start: { 
                type: "string", 
                format: "date-time",
                description: "When the asset should start showing (ISO 8601)"
              },
              schedule_end: { 
                type: "string", 
                format: "date-time",
                description: "When the asset should stop showing (ISO 8601)"
              }
            }
          },
          response: {
            201: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" },
                data: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    type: { type: "string" },
                    placement: { type: "string" },
                    title: { type: "string" },
                    content: { type: "object", additionalProperties: true },
                    priority: { type: "integer" },
                    is_active: { type: "boolean" },
                    schedule_start: { type: "string", format: "date-time" },
                    schedule_end: { type: "string", format: "date-time" },
                    version: { type: "integer" },
                    createddate: { type: "number" },
                    modifieddate: { type: "number" }
                  }
                }
              }
            }
          }
        },
      },
      controller.createAsset
    );

    // PUT /v1/promotional-assets/:id - Update asset
    fastify.put(
      "/:id",
      {
        schema: {
          description: "Update promotional asset",
          tags: ["Promotional Assets"],
          params: {
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string", pattern: "^\\d+$", description: "Asset ID" }
            }
          },
          body: {
            type: "object",
            properties: {
              type: { 
                type: "string", 
                enum: ["banner", "featured_ad", "popup", "carousel"] 
              },
              placement: { type: "string", maxLength: 100 },
              title: { type: "string", maxLength: 255 },
              content: { type: "object", additionalProperties: true },
              priority: { type: "integer", minimum: 0 },
              is_active: { type: "boolean" },
              schedule_start: { type: "string", format: "date-time" },
              schedule_end: { type: "string", format: "date-time" },
              version: { 
                type: "integer", 
                minimum: 1,
                description: "Current version for optimistic concurrency control"
              }
            }
          },
          response: {
            200: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" },
                data: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    type: { type: "string" },
                    placement: { type: "string" },
                    title: { type: "string" },
                    content: { type: "object", additionalProperties: true },
                    priority: { type: "integer" },
                    is_active: { type: "boolean" },
                    schedule_start: { type: "string", format: "date-time" },
                    schedule_end: { type: "string", format: "date-time" },
                    version: { type: "integer" },
                    createddate: { type: "number" },
                    modifieddate: { type: "number" }
                  }
                }
              }
            },
            409: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" },
                details: { type: "string" },
                statusCode: { type: "integer" }
              }
            }
          }
        },
      },
      controller.updateAsset
    );

    // DELETE /v1/promotional-assets/:id - Delete asset
    fastify.delete(
      "/:id",
      {
        schema: {
          description: "Delete promotional asset",
          tags: ["Promotional Assets"],
          params: {
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string", pattern: "^\\d+$", description: "Asset ID" }
            }
          },
          response: {
            200: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" },
                data: { type: "null" }
              }
            }
          }
        },
      },
      controller.deleteAsset
    );

    // GET /v1/promotional-assets/audit/:id - Get audit logs
    fastify.get(
      "/audit/:id",
      {
        schema: {
          description: "Get audit logs for promotional asset",
          tags: ["Promotional Assets"],
          params: {
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string", pattern: "^\\d+$", description: "Asset ID" }
            }
          },
          querystring: {
            type: "object",
            properties: {
              page: { type: "string", description: "Page number" },
              limit: { type: "string", description: "Items per page" }
            }
          },
          response: {
            200: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" },
                data: { 
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer" },
                      asset_id: { type: "integer" },
                      action: { type: "string" },
                      changed_by: { type: "string" },
                      changes: { type: "object", additionalProperties: true },
                      createddate: { type: "number" }
                    }
                  }
                },
                pagination: { 
                  type: "object",
                  properties: {
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    total: { type: "integer" },
                    totalPages: { type: "integer" }
                  }
                }
              }
            }
          }
        },
      },
      controller.getAuditLogs
    );
  });
} 