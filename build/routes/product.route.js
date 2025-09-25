import { ProductController } from "../controllers/product.controller.js";
import { formatProductForAPI } from "../utils/dynamicDbOperations.js";
export async function productRoutes(fastify) {
    const productController = new ProductController();
    // GET /v1/products - Get all products with pagination and filtering
    fastify.get("/", {
        schema: {
            description: "Get all products with pagination and filtering",
            tags: ["Products"],
            querystring: {
                type: "object",
                properties: {
                    page: { type: "string", description: "Page number" },
                    limit: { type: "string", description: "Items per page" },
                    id: { type: "string", description: "Filter by product ID" },
                    name: { type: "string", description: "Filter by product name" },
                    shortdescription: {
                        type: "string",
                        description: "Filter by short description",
                    },
                    fulldescription: {
                        type: "string",
                        description: "Filter by full description",
                    },
                    fragnancetype: {
                        type: "string",
                        description: "Filter by fragrance type",
                    },
                    category: { type: "string", description: "Filter by category" },
                    subcategory: {
                        type: "string",
                        description: "Filter by subcategory",
                    },
                    Brand: {
                        type: "string",
                        description: "Filter by brand",
                    },
                    pack: {
                        type: "string",
                        description: "Filter by pack size",
                    },
                    productstatus: {
                        type: "string",
                        description: "Filter by product status",
                    },
                    puc: { type: "string", description: "Filter by PUC code" },
                    averagerating: {
                        type: "string",
                        description: "Filter by average rating",
                    },
                    discount: {
                        type: "string",
                        description: "Filter by discount amount",
                    },
                    price: {
                        type: "string",
                        description: "Filter by product price",
                    },
                    quantity: {
                        type: "string",
                        description: "Filter by quantity",
                    },
                    orderedquantity: {
                        type: "string",
                        description: "Filter by ordered quantity",
                    },
                    soldquantity: {
                        type: "string",
                        description: "Filter by sold quantity",
                    },
                    availablequantity: {
                        type: "string",
                        description: "Filter by available quantity",
                    },
                    ecompublishedquantity: {
                        type: "string",
                        description: "Filter by e-commerce published quantity",
                    },
                    createddate: {
                        type: "string",
                        description: "Filter by creation date (timestamp)",
                    },
                    modifieddate: {
                        type: "string",
                        description: "Filter by modification date (timestamp)",
                    },
                    // Size-related filter fields
                    large: {
                        type: "string",
                        description: "Filter by large size options",
                    },
                    medium: {
                        type: "string",
                        description: "Filter by medium size options",
                    },
                    small: {
                        type: "string",
                        description: "Filter by small size options",
                    },
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
                                    id: { type: "number", description: "Product ID" },
                                    name: { type: "string", description: "Product name" },
                                    shortdescription: {
                                        type: "string",
                                        nullable: true,
                                        description: "Short description",
                                    },
                                    fulldescription: {
                                        type: "string",
                                        nullable: true,
                                        description: "Full description",
                                    },
                                    fragnancetype: {
                                        type: "string",
                                        nullable: true,
                                        description: "Fragrance type",
                                    },
                                    volume: {
                                        type: "string",
                                        nullable: true,
                                        description: "Volume",
                                    },
                                    origincountry: {
                                        type: "string",
                                        nullable: true,
                                        description: "Origin country",
                                    },
                                    organiccertified: {
                                        type: "boolean",
                                        nullable: true,
                                        description: "Organic certified status",
                                    },
                                    supplierid: {
                                        type: "number",
                                        nullable: true,
                                        description: "Supplier ID",
                                    },
                                    soldquantity: {
                                        type: "number",
                                        nullable: true,
                                        description: "Sold quantity",
                                    },
                                    availablequantity: {
                                        type: "number",
                                        nullable: true,
                                        description: "Available quantity",
                                    },
                                    quantity: {
                                        type: "number",
                                        nullable: true,
                                        description: "Product quantity",
                                    },
                                    ecompublishedquantity: {
                                        type: "number",
                                        nullable: true,
                                        description: "E-commerce published quantity",
                                    },
                                    productstatus: {
                                        type: "string",
                                        nullable: true,
                                        description: "Product status",
                                    },
                                    ponumber: {
                                        type: "string",
                                        nullable: true,
                                        description: "PO number",
                                    },
                                    puc: {
                                        type: "string",
                                        nullable: true,
                                        description: "PUC code",
                                    },
                                    suppliername: {
                                        type: "string",
                                        nullable: true,
                                        description: "Supplier name",
                                    },
                                    serialnumber: {
                                        type: "string",
                                        nullable: true,
                                        description: "Serial number",
                                    },
                                    averagerating: {
                                        type: "number",
                                        nullable: true,
                                        description: "Average rating (decimal)",
                                    },
                                    discount: {
                                        type: "number",
                                        nullable: true,
                                        description: "Discount amount",
                                    },
                                    price: {
                                        type: "number",
                                        nullable: true,
                                        description: "Product price",
                                    },
                                    orderedquantity: {
                                        type: "number",
                                        nullable: true,
                                        description: "Ordered quantity",
                                    },
                                    createddate: {
                                        type: "number",
                                        description: "Creation timestamp",
                                    },
                                    modifieddate: {
                                        type: "number",
                                        description: "Modification timestamp",
                                    },
                                    // Additional product fields from database (21 missing fields)
                                    ingredients: {
                                        type: "string",
                                        nullable: true,
                                        description: "Product ingredients",
                                    },
                                    usage: {
                                        type: "string",
                                        nullable: true,
                                        description: "Usage instructions",
                                    },
                                    extractionmethod: {
                                        type: "string",
                                        nullable: true,
                                        description: "Extraction method",
                                    },
                                    note: {
                                        type: "string",
                                        nullable: true,
                                        description: "Additional notes",
                                    },
                                    shelflife: {
                                        type: "string",
                                        nullable: true,
                                        description: "Shelf life information",
                                    },
                                    // Candle-specific fields
                                    wax_type: {
                                        type: "string",
                                        nullable: true,
                                        description: "Type of wax used",
                                    },
                                    burn_time: {
                                        type: "string",
                                        nullable: true,
                                        description: "Burn time duration",
                                    },
                                    scent_profile: {
                                        type: "string",
                                        nullable: true,
                                        description: "Scent profile description",
                                    },
                                    container_material: {
                                        type: "string",
                                        nullable: true,
                                        description: "Container material",
                                    },
                                    candle_dimensions: {
                                        type: "string",
                                        nullable: true,
                                        description: "Candle dimensions",
                                    },
                                    // Planter-specific fields
                                    planter_material: {
                                        type: "string",
                                        nullable: true,
                                        description: "Planter material",
                                    },
                                    drainage_hole: {
                                        type: "boolean",
                                        nullable: true,
                                        description: "Has drainage hole",
                                    },
                                    suitable_for: {
                                        type: "string",
                                        nullable: true,
                                        description: "Suitable for plants",
                                    },
                                    planter_dimensions: {
                                        type: "string",
                                        nullable: true,
                                        description: "Planter dimensions",
                                    },
                                    plant_included: {
                                        type: "boolean",
                                        nullable: true,
                                        description: "Plant included with planter",
                                    },
                                    // Art-specific fields
                                    art_type: {
                                        type: "string",
                                        nullable: true,
                                        description: "Type of art",
                                    },
                                    frame_included: {
                                        type: "boolean",
                                        nullable: true,
                                        description: "Frame included",
                                    },
                                    art_dimensions: {
                                        type: "string",
                                        nullable: true,
                                        description: "Art dimensions",
                                    },
                                    orientation: {
                                        type: "string",
                                        nullable: true,
                                        description: "Art orientation",
                                    },
                                    artist_name: {
                                        type: "string",
                                        nullable: true,
                                        description: "Artist name",
                                    },
                                    // Status field
                                    isactive: {
                                        type: "boolean",
                                        nullable: true,
                                        description: "Is product active",
                                    },
                                    // Deal of the day field
                                    isdealoftheday: {
                                        type: "boolean",
                                        nullable: true,
                                        description: "Is deal of the day",
                                    },
                                    // Category fields
                                    category: {
                                        type: "string",
                                        nullable: true,
                                        description: "Product category",
                                    },
                                    subcategory: {
                                        type: "string",
                                        nullable: true,
                                        description: "Product subcategory",
                                    },
                                    // Size-related fields (3 new fields)
                                    large: {
                                        type: "array",
                                        items: { type: "string" },
                                        nullable: true,
                                        description: "Large size options",
                                    },
                                    medium: {
                                        type: "array",
                                        items: { type: "string" },
                                        nullable: true,
                                        description: "Medium size options",
                                    },
                                    small: {
                                        type: "array",
                                        items: { type: "string" },
                                        nullable: true,
                                        description: "Small size options",
                                    },
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
    }, productController.getProducts.bind(productController));
    // GET /v1/products/:id - Get product by ID
    fastify.get("/:id", {
        schema: {
            description: "Get product by ID",
            tags: ["Products"],
            params: {
                type: "object",
                properties: {
                    id: { type: "string", description: "Product ID" },
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
                                id: { type: "number", description: "Product ID" },
                                name: { type: "string", description: "Product name" },
                                shortdescription: {
                                    type: "string",
                                    nullable: true,
                                    description: "Short description",
                                },
                                fulldescription: {
                                    type: "string",
                                    nullable: true,
                                    description: "Full description",
                                },
                                fragnancetype: {
                                    type: "string",
                                    nullable: true,
                                    description: "Fragrance type",
                                },
                                volume: {
                                    type: "string",
                                    nullable: true,
                                    description: "Volume",
                                },
                                origincountry: {
                                    type: "string",
                                    nullable: true,
                                    description: "Origin country",
                                },
                                organiccertified: {
                                    type: "boolean",
                                    nullable: true,
                                    description: "Organic certified status",
                                },
                                supplierid: {
                                    type: "number",
                                    nullable: true,
                                    description: "Supplier ID",
                                },
                                soldquantity: {
                                    type: "number",
                                    nullable: true,
                                    description: "Sold quantity",
                                },
                                availablequantity: {
                                    type: "number",
                                    nullable: true,
                                    description: "Available quantity",
                                },
                                quantity: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product quantity",
                                },
                                ecompublishedquantity: {
                                    type: "number",
                                    nullable: true,
                                    description: "E-commerce published quantity",
                                },
                                productstatus: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product status",
                                },
                                ponumber: {
                                    type: "string",
                                    nullable: true,
                                    description: "PO number",
                                },
                                puc: {
                                    type: "string",
                                    nullable: true,
                                    description: "PUC code",
                                },
                                suppliername: {
                                    type: "string",
                                    nullable: true,
                                    description: "Supplier name",
                                },
                                serialnumber: {
                                    type: "string",
                                    nullable: true,
                                    description: "Serial number",
                                },
                                averagerating: {
                                    type: "number",
                                    nullable: true,
                                    description: "Average rating (decimal)",
                                },
                                discount: {
                                    type: "number",
                                    nullable: true,
                                    description: "Discount amount",
                                },
                                price: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product price",
                                },
                                orderedquantity: {
                                    type: "number",
                                    nullable: true,
                                    description: "Ordered quantity",
                                },
                                createddate: {
                                    type: "number",
                                    description: "Creation timestamp",
                                },
                                modifieddate: {
                                    type: "number",
                                    nullable: true,
                                    description: "Modification timestamp",
                                },
                                // Size-related fields
                                large: {
                                    type: "array",
                                    items: { type: "string" },
                                    nullable: true,
                                    description: "Large size options",
                                },
                                medium: {
                                    type: "array",
                                    items: { type: "string" },
                                    nullable: true,
                                    description: "Medium size options",
                                },
                                small: {
                                    type: "array",
                                    items: { type: "string" },
                                    nullable: true,
                                    description: "Small size options",
                                },
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
    }, async (request, reply) => {
        try {
            const { id } = request.params;
            // Validate ID format
            if (!/^\d+$/.test(id)) {
                const errorResponse = {
                    success: false,
                    message: "Invalid ID format. ID must be an integer.",
                    details: `The provided ID '${id}' is not a valid integer format.`,
                    statusCode: 400,
                };
                return reply.code(400).send(errorResponse);
            }
            // Call the service method directly
            const product = await productController.productService.findById(id);
            const response = {
                success: true,
                message: "Product retrieved successfully",
                data: formatProductForAPI(product),
            };
            return reply.code(200).send(response);
        }
        catch (error) {
            console.log("=== PRODUCT GET ERROR:", error.message);
            if (error.message.includes("not found")) {
                const errorResponse = {
                    success: false,
                    message: `Product with ID ${request.params.id} not found`,
                    details: "The requested resource could not be found",
                    statusCode: 404,
                };
                return reply.code(404).send(errorResponse);
            }
            // Default error response
            const errorResponse = {
                success: false,
                message: "Internal server error",
                details: "Something went wrong on the server",
                statusCode: 500,
            };
            return reply.code(500).send(errorResponse);
        }
    });
    // POST /v1/products - Create new product
    fastify.post("/", {
        schema: {
            description: "Create a new product",
            tags: ["Products"],
            body: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        minLength: 1,
                        maxLength: 500,
                        description: "Product name (required)",
                    },
                    shortdescription: {
                        type: "string",
                        description: "Short description",
                    },
                    fulldescription: {
                        type: "string",
                        description: "Full description",
                    },
                    fragnancetype: {
                        type: "string",
                        maxLength: 255,
                        description: "Fragrance type",
                    },
                    category: {
                        type: "string",
                        maxLength: 255,
                        description: "Product category",
                    },
                    subcategory: {
                        type: "string",
                        maxLength: 255,
                        description: "Product subcategory",
                    },
                    Brand: {
                        type: "string",
                        maxLength: 255,
                        description: "Product brand",
                    },
                    pack: {
                        type: "string",
                        maxLength: 255,
                        description: "Pack size",
                    },
                    averagerating: {
                        type: "number",
                        minimum: 0,
                        maximum: 5,
                        description: "Average rating (0-5, decimal allowed)",
                    },
                    discount: {
                        type: "integer",
                        minimum: 0,
                        description: "Discount amount (integer)",
                    },
                    price: {
                        type: "number",
                        minimum: 0,
                        description: "Product price",
                    },
                    quantity: {
                        type: "number",
                        minimum: 0,
                        description: "Product quantity",
                    },
                    orderedquantity: {
                        type: "number",
                        description: "Ordered quantity",
                    },
                    soldquantity: {
                        type: "number",
                        description: "Sold quantity"
                    },
                    availablequantity: {
                        type: "number",
                        description: "Available quantity",
                    },
                    ecompublishedquantity: {
                        type: "number",
                        minimum: 0,
                        description: "E-commerce published quantity",
                    },
                    productstatus: {
                        type: "string",
                        maxLength: 255,
                        description: "Product status",
                    },
                    puc: { type: "string", maxLength: 255, description: "PUC code (auto-generated)" },
                    // Size-related fields
                    large: {
                        type: "array",
                        items: { type: "string" },
                        description: "Large size options",
                    },
                    medium: {
                        type: "array",
                        items: { type: "string" },
                        description: "Medium size options",
                    },
                    small: {
                        type: "array",
                        items: { type: "string" },
                        description: "Small size options",
                    },
                },
                required: ["name"], // Only name is required as per schema
                additionalProperties: true,
            },
            response: {
                201: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: {
                            type: "object",
                            properties: {
                                id: { type: "number", description: "Product ID" },
                                name: { type: "string", description: "Product name" },
                                shortdescription: {
                                    type: "string",
                                    nullable: true,
                                    description: "Short description",
                                },
                                fulldescription: {
                                    type: "string",
                                    nullable: true,
                                    description: "Full description",
                                },
                                fragnancetype: {
                                    type: "string",
                                    nullable: true,
                                    description: "Fragrance type",
                                },
                                category: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product category",
                                },
                                subcategory: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product subcategory",
                                },
                                Brand: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product brand",
                                },
                                pack: {
                                    type: "string",
                                    nullable: true,
                                    description: "Pack size",
                                },
                                averagerating: {
                                    type: "number",
                                    nullable: true,
                                    description: "Average rating (decimal)",
                                },
                                discount: {
                                    type: "number",
                                    nullable: true,
                                    description: "Discount amount",
                                },
                                price: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product price",
                                },
                                quantity: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product quantity",
                                },
                                orderedquantity: {
                                    type: "number",
                                    nullable: true,
                                    description: "Ordered quantity",
                                },
                                soldquantity: {
                                    type: "number",
                                    nullable: true,
                                    description: "Sold quantity",
                                },
                                availablequantity: {
                                    type: "number",
                                    nullable: true,
                                    description: "Available quantity",
                                },
                                ecompublishedquantity: {
                                    type: "number",
                                    nullable: true,
                                    description: "E-commerce published quantity",
                                },
                                productstatus: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product status",
                                },
                                puc: {
                                    type: "string",
                                    nullable: true,
                                    description: "PUC code",
                                },
                                createddate: {
                                    type: "number",
                                    nullable: true,
                                    description: "Creation timestamp",
                                },
                                modifieddate: {
                                    type: "number",
                                    nullable: true,
                                    description: "Modification timestamp",
                                },
                                // Size-related fields
                                large: {
                                    type: "array",
                                    items: { type: "string" },
                                    nullable: true,
                                    description: "Large size options",
                                },
                                medium: {
                                    type: "array",
                                    items: { type: "string" },
                                    nullable: true,
                                    description: "Medium size options",
                                },
                                small: {
                                    type: "array",
                                    items: { type: "string" },
                                    nullable: true,
                                    description: "Small size options",
                                },
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
    }, productController.createProduct.bind(productController));
    // PUT /v1/products/:id - Update product
    fastify.put("/:id", {
        schema: {
            description: "Update product by ID",
            tags: ["Products"],
            params: {
                type: "object",
                properties: {
                    id: { type: "string", description: "Product ID" },
                },
                required: ["id"],
            },
            body: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        minLength: 1,
                        maxLength: 500,
                        description: "Product name",
                    },
                    shortdescription: {
                        type: "string",
                        description: "Short description",
                    },
                    fulldescription: {
                        type: "string",
                        description: "Full description",
                    },
                    fragnancetype: {
                        type: "string",
                        maxLength: 255,
                        description: "Fragrance type",
                    },
                    category: {
                        type: "string",
                        maxLength: 255,
                        description: "Product category",
                    },
                    subcategory: {
                        type: "string",
                        maxLength: 255,
                        description: "Product subcategory",
                    },
                    Brand: {
                        type: "string",
                        maxLength: 255,
                        description: "Product brand",
                    },
                    pack: {
                        type: "string",
                        maxLength: 255,
                        description: "Pack size",
                    },
                    averagerating: {
                        type: "number",
                        minimum: 0,
                        maximum: 5,
                        description: "Average rating (0-5, decimal allowed)",
                    },
                    discount: {
                        type: "integer",
                        minimum: 0,
                        description: "Discount amount (integer)",
                    },
                    price: {
                        type: "number",
                        minimum: 0,
                        description: "Product price",
                    },
                    quantity: {
                        type: "number",
                        minimum: 0,
                        description: "Product quantity",
                    },
                    orderedquantity: {
                        type: "number",
                        description: "Ordered quantity",
                    },
                    soldquantity: {
                        type: "number",
                        description: "Sold quantity"
                    },
                    availablequantity: {
                        type: "number",
                        description: "Available quantity",
                    },
                    ecompublishedquantity: {
                        type: "number",
                        minimum: 0,
                        description: "E-commerce published quantity",
                    },
                    productstatus: {
                        type: "string",
                        maxLength: 255,
                        description: "Product status",
                    },
                    puc: { type: "string", maxLength: 255, description: "PUC code (auto-generated)" },
                    // Size array fields
                    large: {
                        type: "array",
                        items: { type: "string" },
                        description: "Large size options",
                    },
                    medium: {
                        type: "array",
                        items: { type: "string" },
                        description: "Medium size options",
                    },
                    small: {
                        type: "array",
                        items: { type: "string" },
                        description: "Small size options",
                    },
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
                            properties: {
                                id: { type: "number", description: "Product ID" },
                                name: { type: "string", description: "Product name" },
                                shortdescription: {
                                    type: "string",
                                    nullable: true,
                                    description: "Short description",
                                },
                                fulldescription: {
                                    type: "string",
                                    nullable: true,
                                    description: "Full description",
                                },
                                fragnancetype: {
                                    type: "string",
                                    nullable: true,
                                    description: "Fragrance type",
                                },
                                volume: {
                                    type: "string",
                                    nullable: true,
                                    description: "Volume",
                                },
                                origincountry: {
                                    type: "string",
                                    nullable: true,
                                    description: "Origin country",
                                },
                                organiccertified: {
                                    type: "boolean",
                                    nullable: true,
                                    description: "Organic certified status",
                                },
                                supplierid: {
                                    type: "number",
                                    nullable: true,
                                    description: "Supplier ID",
                                },
                                soldquantity: {
                                    type: "number",
                                    nullable: true,
                                    description: "Sold quantity",
                                },
                                availablequantity: {
                                    type: "number",
                                    nullable: true,
                                    description: "Available quantity",
                                },
                                quantity: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product quantity",
                                },
                                ecompublishedquantity: {
                                    type: "number",
                                    nullable: true,
                                    description: "E-commerce published quantity",
                                },
                                productstatus: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product status",
                                },
                                ponumber: {
                                    type: "string",
                                    nullable: true,
                                    description: "PO number",
                                },
                                puc: {
                                    type: "string",
                                    nullable: true,
                                    description: "PUC code",
                                },
                                suppliername: {
                                    type: "string",
                                    nullable: true,
                                    description: "Supplier name",
                                },
                                serialnumber: {
                                    type: "string",
                                    nullable: true,
                                    description: "Serial number",
                                },
                                averagerating: {
                                    type: "number",
                                    nullable: true,
                                    description: "Average rating (decimal)",
                                },
                                discount: {
                                    type: "number",
                                    nullable: true,
                                    description: "Discount amount",
                                },
                                price: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product price",
                                },
                                orderedquantity: {
                                    type: "number",
                                    nullable: true,
                                    description: "Ordered quantity",
                                },
                                createddate: {
                                    type: "number",
                                    description: "Creation timestamp",
                                },
                                modifieddate: {
                                    type: "number",
                                    description: "Modification timestamp",
                                },
                                // Size array fields
                                large: {
                                    type: "array",
                                    items: { type: "string" },
                                    nullable: true,
                                    description: "Large size options",
                                },
                                medium: {
                                    type: "array",
                                    items: { type: "string" },
                                    nullable: true,
                                    description: "Medium size options",
                                },
                                small: {
                                    type: "array",
                                    items: { type: "string" },
                                    nullable: true,
                                    description: "Small size options",
                                },
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
    }, async (request, reply) => {
        try {
            const { id } = request.params;
            // Validate ID format
            if (!/^\d+$/.test(id)) {
                const errorResponse = {
                    success: false,
                    message: "Invalid ID format. ID must be an integer.",
                    details: `The provided ID '${id}' is not a valid integer format.`,
                    statusCode: 400,
                };
                return reply.code(400).send(errorResponse);
            }
            // Update the product
            const product = await productController.productService.update(id, request.body);
            const response = {
                success: true,
                message: "Product updated successfully",
                data: product,
            };
            return reply.code(200).send(response);
        }
        catch (error) {
            console.log("=== PRODUCT PUT ERROR:", error.message);
            if (error.message.includes("not found")) {
                const errorResponse = {
                    success: false,
                    message: `Product with ID ${request.params.id} not found`,
                    details: "The requested resource could not be found",
                    statusCode: 404,
                };
                return reply.code(404).send(errorResponse);
            }
            if (error.message.includes("already exists")) {
                const errorResponse = {
                    success: false,
                    message: error.message,
                    details: "Duplicate entry detected",
                    statusCode: 400,
                };
                return reply.code(400).send(errorResponse);
            }
            // Default error response
            const errorResponse = {
                success: false,
                message: "Internal server error",
                details: "Something went wrong on the server",
                statusCode: 500,
            };
            return reply.code(500).send(errorResponse);
        }
    });
    // DELETE /v1/products/:id - Delete product
    fastify.delete("/:id", {
        schema: {
            description: "Delete product by ID",
            tags: ["Products"],
            params: {
                type: "object",
                properties: {
                    id: { type: "string", description: "Product ID" },
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
                409: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        message: { type: "string" },
                        details: { type: "string" },
                        statusCode: { type: "number" },
                        errorCode: { type: "string" },
                        blockingRecords: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    table: { type: "string", description: "Table name containing the blocking record" },
                                    recordId: { type: ["string", "number"], description: "ID of the blocking record" },
                                    details: {
                                        type: "object",
                                        description: "Detailed information about the blocking record",
                                        additionalProperties: true
                                    }
                                }
                            }
                        },
                        constraintInfo: {
                            type: "object",
                            properties: {
                                constraintName: { type: "string", description: "Foreign key constraint name" },
                                referencedTable: { type: "string", description: "Table being referenced" }
                            }
                        }
                    },
                },
            },
        },
    }, async (request, reply) => {
        try {
            const { id } = request.params;
            // Validate ID format
            if (!/^\d+$/.test(id)) {
                const errorResponse = {
                    success: false,
                    message: "Invalid ID format. ID must be an integer.",
                    details: `The provided ID '${id}' is not a valid integer format.`,
                    statusCode: 400,
                };
                return reply.code(400).send(errorResponse);
            }
            // Delete the product
            await productController.productService.delete(id);
            const response = {
                success: true,
                message: "Product deleted successfully",
            };
            return reply.code(200).send(response);
        }
        catch (error) {
            const { handleDeleteError } = await import('../utils/dynamicDbOperations.js');
            return await handleDeleteError(error, 'product', request.params.id, reply);
        }
    });
    // POST /v1/products/upsert - Upsert product
    fastify.post("/upsert", {
        schema: {
            description: "Create or update product (upsert)",
            tags: ["Products"],
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
    }, productController.upsertProduct.bind(productController));
    // POST /v1/products/upsert-with-file - Upsert product with file upload
    fastify.post("/upsert-with-file", {
        schema: {
            description: "Create or update product with file upload (image URL arrays)",
            tags: ["Products"],
            body: {
                type: "object",
                properties: {
                    productid: {
                        type: ["string", "number"],
                        description: "Product ID for update (optional for create)",
                    },
                    url: {
                        type: "object",
                        properties: {
                            Large: {
                                type: "array",
                                items: { type: "string" },
                                description: "Array of large image URLs",
                            },
                            Medium: {
                                type: "array",
                                items: { type: "string" },
                                description: "Array of medium image URLs",
                            },
                            Small: {
                                type: "array",
                                items: { type: "string" },
                                description: "Array of small image URLs",
                            },
                        },
                        description: "Image URLs organized by size (will be merged with existing arrays)",
                    },
                    // Include all standard product fields
                    name: {
                        type: "string",
                        minLength: 1,
                        maxLength: 500,
                        description: "Product name",
                    },
                    shortdescription: {
                        type: "string",
                        description: "Short description",
                    },
                    fulldescription: {
                        type: "string",
                        description: "Full description",
                    },
                    fragnancetype: {
                        type: "string",
                        maxLength: 255,
                        description: "Fragrance type",
                    },
                    volume: { type: "string", maxLength: 50, description: "Volume" },
                    origincountry: {
                        type: "string",
                        maxLength: 255,
                        description: "Origin country",
                    },
                    organiccertified: {
                        type: "boolean",
                        description: "Organic certified status",
                    },
                    supplierid: { type: "number", description: "Supplier ID" },
                    soldquantity: { type: "number", description: "Sold quantity" },
                    availablequantity: {
                        type: "number",
                        description: "Available quantity",
                    },
                    quantity: {
                        type: "number",
                        minimum: 0,
                        description: "Product quantity",
                    },
                    ecompublishedquantity: {
                        type: "number",
                        minimum: 0,
                        description: "E-commerce published quantity",
                    },
                    productstatus: {
                        type: "string",
                        maxLength: 255,
                        description: "Product status",
                    },
                    ponumber: {
                        type: "string",
                        maxLength: 255,
                        description: "PO number",
                    },
                    puc: { type: "string", maxLength: 255, description: "PUC code" },
                    suppliername: {
                        type: "string",
                        maxLength: 255,
                        description: "Supplier name",
                    },
                    serialnumber: {
                        type: "string",
                        maxLength: 255,
                        description: "Serial number",
                    },
                    averagerating: {
                        type: "number",
                        minimum: 0,
                        maximum: 5,
                        description: "Average rating (0-5, decimal allowed)",
                    },
                    discount: {
                        type: "integer",
                        minimum: 0,
                        description: "Discount amount (integer)",
                    },
                    price: {
                        type: "number",
                        minimum: 0,
                        description: "Product price",
                    },
                    orderedquantity: {
                        type: "number",
                        description: "Ordered quantity",
                    },
                    // Additional product fields
                    ingredients: { type: "string", description: "Product ingredients" },
                    usage: { type: "string", description: "Usage instructions" },
                    extractionmethod: {
                        type: "string",
                        maxLength: 100,
                        description: "Extraction method",
                    },
                    note: {
                        type: "string",
                        maxLength: 150,
                        description: "Additional notes",
                    },
                    shelflife: {
                        type: "string",
                        maxLength: 150,
                        description: "Shelf life information",
                    },
                    // Candle-specific fields
                    wax_type: {
                        type: "string",
                        maxLength: 150,
                        description: "Type of wax used",
                    },
                    burn_time: {
                        type: "string",
                        maxLength: 150,
                        description: "Burn time duration",
                    },
                    scent_profile: {
                        type: "string",
                        maxLength: 100,
                        description: "Scent profile description",
                    },
                    container_material: {
                        type: "string",
                        maxLength: 100,
                        description: "Container material",
                    },
                    candle_dimensions: {
                        type: "string",
                        description: "Candle dimensions",
                    },
                    // Planter-specific fields
                    planter_material: {
                        type: "string",
                        description: "Planter material",
                    },
                    drainage_hole: {
                        type: "boolean",
                        description: "Has drainage hole",
                    },
                    suitable_for: {
                        type: "string",
                        description: "Suitable for plants",
                    },
                    planter_dimensions: {
                        type: "string",
                        description: "Planter dimensions",
                    },
                    plant_included: {
                        type: "boolean",
                        description: "Plant included with planter",
                    },
                    // Art-specific fields
                    art_type: { type: "string", description: "Type of art" },
                    frame_included: { type: "boolean", description: "Frame included" },
                    art_dimensions: { type: "string", description: "Art dimensions" },
                    orientation: { type: "string", description: "Art orientation" },
                    artist_name: { type: "string", description: "Artist name" },
                    // Status field
                    isactive: { type: "boolean", description: "Is product active" },
                    // Deal of the day field
                    isdealoftheday: { type: "boolean", description: "Is deal of the day" },
                    // Category fields
                    category: {
                        type: "string",
                        maxLength: 255,
                        description: "Product category",
                    },
                    subcategory: {
                        type: "string",
                        maxLength: 255,
                        description: "Product subcategory",
                    },
                    // Size-related fields (3 new fields)
                    large: {
                        type: "array",
                        items: { type: "string" },
                        description: "Large size options",
                    },
                    medium: {
                        type: "array",
                        items: { type: "string" },
                        description: "Medium size options",
                    },
                    small: {
                        type: "array",
                        items: { type: "string" },
                        description: "Small size options",
                    },
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
                            properties: {
                                product: {
                                    type: "object",
                                    properties: {
                                        id: { type: "number", description: "Product ID" },
                                        name: { type: "string", description: "Product name" },
                                        shortdescription: {
                                            type: "string",
                                            nullable: true,
                                            description: "Short description",
                                        },
                                        fulldescription: {
                                            type: "string",
                                            nullable: true,
                                            description: "Full description",
                                        },
                                        fragnancetype: {
                                            type: "string",
                                            nullable: true,
                                            description: "Fragrance type",
                                        },
                                        volume: {
                                            type: "string",
                                            nullable: true,
                                            description: "Volume",
                                        },
                                        origincountry: {
                                            type: "string",
                                            nullable: true,
                                            description: "Origin country",
                                        },
                                        organiccertified: {
                                            type: "boolean",
                                            nullable: true,
                                            description: "Organic certified status",
                                        },
                                        supplierid: {
                                            type: "number",
                                            nullable: true,
                                            description: "Supplier ID",
                                        },
                                        soldquantity: {
                                            type: "number",
                                            nullable: true,
                                            description: "Sold quantity",
                                        },
                                        availablequantity: {
                                            type: "number",
                                            nullable: true,
                                            description: "Available quantity",
                                        },
                                        quantity: {
                                            type: "number",
                                            nullable: true,
                                            description: "Product quantity",
                                        },
                                        ecompublishedquantity: {
                                            type: "number",
                                            nullable: true,
                                            description: "E-commerce published quantity",
                                        },
                                        productstatus: {
                                            type: "string",
                                            nullable: true,
                                            description: "Product status",
                                        },
                                        ponumber: {
                                            type: "string",
                                            nullable: true,
                                            description: "PO number",
                                        },
                                        puc: {
                                            type: "string",
                                            nullable: true,
                                            description: "PUC code",
                                        },
                                        suppliername: {
                                            type: "string",
                                            nullable: true,
                                            description: "Supplier name",
                                        },
                                        serialnumber: {
                                            type: "string",
                                            nullable: true,
                                            description: "Serial number",
                                        },
                                        averagerating: {
                                            type: "number",
                                            nullable: true,
                                            description: "Average rating (decimal)",
                                        },
                                        discount: {
                                            type: "number",
                                            nullable: true,
                                            description: "Discount amount",
                                        },
                                        price: {
                                            type: "number",
                                            nullable: true,
                                            description: "Product price",
                                        },
                                        orderedquantity: {
                                            type: "number",
                                            nullable: true,
                                            description: "Ordered quantity",
                                        },
                                        createddate: {
                                            type: "number",
                                            description: "Creation timestamp",
                                        },
                                        modifieddate: {
                                            type: "number",
                                            description: "Modification timestamp",
                                        },
                                        // Additional product fields
                                        ingredients: {
                                            type: "string",
                                            nullable: true,
                                            description: "Product ingredients",
                                        },
                                        usage: {
                                            type: "string",
                                            nullable: true,
                                            description: "Usage instructions",
                                        },
                                        extractionmethod: {
                                            type: "string",
                                            nullable: true,
                                            description: "Extraction method",
                                        },
                                        note: {
                                            type: "string",
                                            nullable: true,
                                            description: "Additional notes",
                                        },
                                        shelflife: {
                                            type: "string",
                                            nullable: true,
                                            description: "Shelf life information",
                                        },
                                        // Candle-specific fields
                                        wax_type: {
                                            type: "string",
                                            nullable: true,
                                            description: "Type of wax used",
                                        },
                                        burn_time: {
                                            type: "string",
                                            nullable: true,
                                            description: "Burn time duration",
                                        },
                                        scent_profile: {
                                            type: "string",
                                            nullable: true,
                                            description: "Scent profile description",
                                        },
                                        container_material: {
                                            type: "string",
                                            nullable: true,
                                            description: "Container material",
                                        },
                                        candle_dimensions: {
                                            type: "string",
                                            nullable: true,
                                            description: "Candle dimensions",
                                        },
                                        // Planter-specific fields
                                        planter_material: {
                                            type: "string",
                                            nullable: true,
                                            description: "Planter material",
                                        },
                                        drainage_hole: {
                                            type: "boolean",
                                            nullable: true,
                                            description: "Has drainage hole",
                                        },
                                        suitable_for: {
                                            type: "string",
                                            nullable: true,
                                            description: "Suitable for plants",
                                        },
                                        planter_dimensions: {
                                            type: "string",
                                            nullable: true,
                                            description: "Planter dimensions",
                                        },
                                        plant_included: {
                                            type: "boolean",
                                            nullable: true,
                                            description: "Plant included with planter",
                                        },
                                        // Art-specific fields
                                        art_type: {
                                            type: "string",
                                            nullable: true,
                                            description: "Type of art",
                                        },
                                        frame_included: {
                                            type: "boolean",
                                            nullable: true,
                                            description: "Frame included",
                                        },
                                        art_dimensions: {
                                            type: "string",
                                            nullable: true,
                                            description: "Art dimensions",
                                        },
                                        orientation: {
                                            type: "string",
                                            nullable: true,
                                            description: "Art orientation",
                                        },
                                        artist_name: {
                                            type: "string",
                                            nullable: true,
                                            description: "Artist name",
                                        },
                                        // Status field
                                        isactive: {
                                            type: "boolean",
                                            nullable: true,
                                            description: "Is product active",
                                        },
                                        // Deal of the day field
                                        isdealoftheday: {
                                            type: "boolean",
                                            nullable: true,
                                            description: "Is deal of the day",
                                        },
                                    },
                                    additionalProperties: true,
                                },
                                productId: {
                                    type: ["string", "number"],
                                    description: "Product ID",
                                },
                                imageData: {
                                    type: "object",
                                    nullable: true,
                                    properties: {
                                        Large: { type: "array", items: { type: "string" } },
                                        Medium: { type: "array", items: { type: "string" } },
                                        Small: { type: "array", items: { type: "string" } },
                                    },
                                    description: "Uploaded image data",
                                },
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
    }, productController.upsertProductWithFile.bind(productController));
    // PUT /v1/products/:id/rearrange-images - Rearrange product image URLs
    fastify.put("/:id/rearrange-images", {
        schema: {
            description: "Rearrange image URLs within product arrays (large, medium, small)",
            tags: ["Products"],
            params: {
                type: "object",
                properties: {
                    id: { type: "string", description: "Product ID" },
                },
                required: ["id"],
            },
            body: {
                type: "object",
                properties: {
                    large: {
                        type: "array",
                        items: { type: "string" },
                        description: "Reordered array of large image URLs (must contain exactly the same URLs as existing)",
                    },
                    medium: {
                        type: "array",
                        items: { type: "string" },
                        description: "Reordered array of medium image URLs (must contain exactly the same URLs as existing)",
                    },
                    small: {
                        type: "array",
                        items: { type: "string" },
                        description: "Reordered array of small image URLs (must contain exactly the same URLs as existing)",
                    },
                },
                additionalProperties: false,
                minProperties: 1, // At least one array must be provided
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: {
                            type: "object",
                            properties: {
                                product: {
                                    type: "object",
                                    properties: {
                                        id: { type: "number", description: "Product ID" },
                                        name: { type: "string", description: "Product name" },
                                        large: {
                                            type: "array",
                                            items: { type: "string" },
                                            nullable: true,
                                            description: "Rearranged large image URLs",
                                        },
                                        medium: {
                                            type: "array",
                                            items: { type: "string" },
                                            nullable: true,
                                            description: "Rearranged medium image URLs",
                                        },
                                        small: {
                                            type: "array",
                                            items: { type: "string" },
                                            nullable: true,
                                            description: "Rearranged small image URLs",
                                        },
                                    },
                                    additionalProperties: true,
                                },
                                rearrangedArrays: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "List of arrays that were rearranged",
                                },
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
    }, productController.rearrangeProductImages.bind(productController));
    // DELETE /v1/products/:id/image-urls - Delete specific image URLs from product arrays
    fastify.delete("/:id/image-urls", {
        schema: {
            description: "Delete specific image URLs from product arrays (large, medium, small)",
            tags: ["Products"],
            params: {
                type: "object",
                properties: {
                    id: { type: "string", description: "Product ID" },
                },
                required: ["id"],
            },
            body: {
                type: "object",
                properties: {
                    large: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 1,
                        description: "Array of large image URLs to delete",
                    },
                    medium: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 1,
                        description: "Array of medium image URLs to delete",
                    },
                    small: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 1,
                        description: "Array of small image URLs to delete",
                    },
                },
                additionalProperties: false,
                minProperties: 1, // At least one array must be provided
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: {
                            type: "object",
                            properties: {
                                product: {
                                    type: "object",
                                    properties: {
                                        id: { type: "number", description: "Product ID" },
                                        name: { type: "string", description: "Product name" },
                                        large: {
                                            type: "array",
                                            items: { type: "string" },
                                            nullable: true,
                                            description: "Updated large image URLs",
                                        },
                                        medium: {
                                            type: "array",
                                            items: { type: "string" },
                                            nullable: true,
                                            description: "Updated medium image URLs",
                                        },
                                        small: {
                                            type: "array",
                                            items: { type: "string" },
                                            nullable: true,
                                            description: "Updated small image URLs",
                                        },
                                    },
                                    additionalProperties: true,
                                },
                                deletionSummary: {
                                    type: "object",
                                    properties: {
                                        large: {
                                            type: "object",
                                            properties: {
                                                before: {
                                                    type: "number",
                                                    description: "Count before deletion",
                                                },
                                                after: {
                                                    type: "number",
                                                    description: "Count after deletion",
                                                },
                                                deleted: {
                                                    type: "number",
                                                    description: "Number of URLs deleted",
                                                },
                                            },
                                        },
                                        medium: {
                                            type: "object",
                                            properties: {
                                                before: {
                                                    type: "number",
                                                    description: "Count before deletion",
                                                },
                                                after: {
                                                    type: "number",
                                                    description: "Count after deletion",
                                                },
                                                deleted: {
                                                    type: "number",
                                                    description: "Number of URLs deleted",
                                                },
                                            },
                                        },
                                        small: {
                                            type: "object",
                                            properties: {
                                                before: {
                                                    type: "number",
                                                    description: "Count before deletion",
                                                },
                                                after: {
                                                    type: "number",
                                                    description: "Count after deletion",
                                                },
                                                deleted: {
                                                    type: "number",
                                                    description: "Number of URLs deleted",
                                                },
                                            },
                                        },
                                    },
                                    description: "Summary of deletion operations",
                                },
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
    }, productController.deleteProductImageUrls.bind(productController));
}
//# sourceMappingURL=product.route.js.map