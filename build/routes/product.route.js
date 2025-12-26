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
                    subsubcategory: {
                        type: "string",
                        description: "Filter by sub-subcategory",
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
                    isdealoftheday: {
                        type: "string",
                        description: "Filter by deal of the day status (true or false)",
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
                    // Additional Product Information filters
                    material: {
                        type: "string",
                        description: "Filter by material",
                    },
                    itemlength: {
                        type: "string",
                        description: "Filter by item length",
                    },
                    manufacturer: {
                        type: "string",
                        description: "Filter by manufacturer",
                    },
                    netform: {
                        type: "string",
                        description: "Filter by net form",
                    },
                    netquantity: {
                        type: "string",
                        description: "Filter by net quantity",
                    },
                    numberofitems: {
                        type: "string",
                        description: "Filter by number of items",
                    },
                    itemthickness: {
                        type: "string",
                        description: "Filter by item thickness",
                    },
                    // New product fields filters
                    purpose: {
                        type: "string",
                        description: "Filter by product purpose",
                    },
                    burntime: {
                        type: "string",
                        description: "Filter by burn time",
                    },
                    power: {
                        type: "string",
                        description: "Filter by power/intensity",
                    },
                    usage: {
                        type: "string",
                        description: "Filter by usage instructions",
                    },
                    longevity: {
                        type: "string",
                        description: "Filter by longevity/duration",
                    },
                    gender: {
                        type: "string",
                        description: "Filter by target gender",
                    },
                    searchtext: {
                        type: "string",
                        description: "Full-text search across product fields (name, description, category, etc.)",
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
                                    puc: {
                                        type: "string",
                                        nullable: true,
                                        description: "PUC code",
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
                                    subsubcategory: {
                                        type: "string",
                                        nullable: true,
                                        description: "Product sub-subcategory",
                                    },
                                    // Deal of the day field
                                    isdealoftheday: {
                                        type: "boolean",
                                        description: "Is deal of the day",
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
                                    // Additional Product Information
                                    material: {
                                        type: "string",
                                        nullable: true,
                                        description: "Product material",
                                    },
                                    itemlength: {
                                        type: "string",
                                        nullable: true,
                                        description: "Item length",
                                    },
                                    manufacturer: {
                                        type: "string",
                                        nullable: true,
                                        description: "Manufacturer",
                                    },
                                    netform: {
                                        type: "string",
                                        nullable: true,
                                        description: "Net form (e.g., stick, bottle)",
                                    },
                                    netquantity: {
                                        type: "string",
                                        nullable: true,
                                        description: "Net quantity (e.g., 30 sticks, 500ml)",
                                    },
                                    numberofitems: {
                                        type: "number",
                                        nullable: true,
                                        description: "Number of items",
                                    },
                                    itemthickness: {
                                        type: "string",
                                        nullable: true,
                                        description: "Item thickness",
                                    },
                                    // Product Dimensions & Weight (single unit)
                                    length: {
                                        type: "number",
                                        nullable: true,
                                        description: "Product length in cm (single unit)",
                                    },
                                    width: {
                                        type: "number",
                                        nullable: true,
                                        description: "Product width in cm (single unit)",
                                    },
                                    height: {
                                        type: "number",
                                        nullable: true,
                                        description: "Product height in cm (single unit)",
                                    },
                                    weight: {
                                        type: "number",
                                        nullable: true,
                                        description: "Product weight in grams (single unit)",
                                    },
                                    purpose: {
                                        type: "string",
                                        nullable: true,
                                        description: "Product purpose",
                                    },
                                    burntime: {
                                        type: "string",
                                        nullable: true,
                                        description: "Burn time",
                                    },
                                    power: {
                                        type: "string",
                                        nullable: true,
                                        description: "Power/intensity",
                                    },
                                    longevity: {
                                        type: "string",
                                        nullable: true,
                                        description: "Longevity/duration",
                                    },
                                    gender: {
                                        type: "string",
                                        nullable: true,
                                        description: "Target gender",
                                    },
                                    // Combo Pack Support
                                    iscombo: {
                                        type: "boolean",
                                        nullable: true,
                                        description: "Is this a combo product?",
                                    },
                                    combotype: {
                                        type: "string",
                                        nullable: true,
                                        description: "Combo type: 'fixed' or 'dynamic'",
                                    },
                                    components: {
                                        type: "array",
                                        nullable: true,
                                        description: "Component products (only present if iscombo is true)",
                                        items: {
                                            type: "object",
                                            properties: {
                                                componentproductid: {
                                                    oneOf: [
                                                        { type: "string", pattern: "^\\d+$" },
                                                        { type: "number" },
                                                    ],
                                                    description: "Component product ID",
                                                },
                                                requiredqty: {
                                                    type: "integer",
                                                    description: "Quantity of this component needed per combo",
                                                },
                                                isactive: {
                                                    type: "boolean",
                                                    description: "Is this component active?",
                                                },
                                                product: {
                                                    type: "object",
                                                    properties: {
                                                        name: {
                                                            type: "string",
                                                            nullable: true,
                                                            description: "Component product name",
                                                        },
                                                        puc: {
                                                            type: "string",
                                                            nullable: true,
                                                            description: "Component product PUC code",
                                                        },
                                                    },
                                                    required: ["name", "puc"],
                                                    additionalProperties: false,
                                                },
                                            },
                                            required: ["componentproductid", "requiredqty", "isactive", "product"],
                                            additionalProperties: false,
                                        },
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
                                puc: {
                                    type: "string",
                                    nullable: true,
                                    description: "PUC code",
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
                                subsubcategory: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product sub-subcategory",
                                },
                                brand: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product brand",
                                },
                                pack: {
                                    type: "string",
                                    nullable: true,
                                    description: "Pack size",
                                },
                                isdealoftheday: {
                                    type: "boolean",
                                    description: "Is deal of the day",
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
                                // Additional Product Information
                                material: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product material",
                                },
                                itemlength: {
                                    type: "string",
                                    nullable: true,
                                    description: "Item length",
                                },
                                manufacturer: {
                                    type: "string",
                                    nullable: true,
                                    description: "Manufacturer",
                                },
                                netform: {
                                    type: "string",
                                    nullable: true,
                                    description: "Net form (e.g., stick, bottle)",
                                },
                                netquantity: {
                                    type: "string",
                                    nullable: true,
                                    description: "Net quantity (e.g., 30 sticks, 500ml)",
                                },
                                numberofitems: {
                                    type: "number",
                                    nullable: true,
                                    description: "Number of items",
                                },
                                itemthickness: {
                                    type: "string",
                                    nullable: true,
                                    description: "Item thickness",
                                },
                                // Product Dimensions & Weight (single unit)
                                length: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product length in cm (single unit)",
                                },
                                width: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product width in cm (single unit)",
                                },
                                height: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product height in cm (single unit)",
                                },
                                weight: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product weight in grams (single unit)",
                                },
                                purpose: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product purpose",
                                },
                                burntime: {
                                    type: "string",
                                    nullable: true,
                                    description: "Burn time",
                                },
                                power: {
                                    type: "string",
                                    nullable: true,
                                    description: "Power/intensity",
                                },
                                longevity: {
                                    type: "string",
                                    nullable: true,
                                    description: "Longevity/duration",
                                },
                                gender: {
                                    type: "string",
                                    nullable: true,
                                    description: "Target gender",
                                },
                                // Combo Pack Support
                                iscombo: {
                                    type: "boolean",
                                    nullable: true,
                                    description: "Is this a combo product?",
                                },
                                combotype: {
                                    type: "string",
                                    nullable: true,
                                    description: "Combo type: 'fixed' or 'dynamic'",
                                },
                                components: {
                                    type: "array",
                                    nullable: true,
                                    description: "Component products (only present if iscombo is true)",
                                    items: {
                                        type: "object",
                                        properties: {
                                            componentproductid: {
                                                oneOf: [
                                                    { type: "string", pattern: "^\\d+$" },
                                                    { type: "number" },
                                                ],
                                                description: "Component product ID",
                                            },
                                            requiredqty: {
                                                type: "integer",
                                                description: "Quantity of this component needed per combo",
                                            },
                                            isactive: {
                                                type: "boolean",
                                                description: "Is this component active?",
                                            },
                                            product: {
                                                type: "object",
                                                properties: {
                                                    name: {
                                                        type: "string",
                                                        nullable: true,
                                                        description: "Component product name",
                                                    },
                                                    puc: {
                                                        type: "string",
                                                        nullable: true,
                                                        description: "Component product PUC code",
                                                    },
                                                },
                                                required: ["name", "puc"],
                                                additionalProperties: false,
                                            },
                                            platformStock: {
                                                type: "object",
                                                nullable: true,
                                                properties: {
                                                    availableqty: {
                                                        type: "number",
                                                        description: "Available quantity for nivapp platform",
                                                    },
                                                    lockqty: {
                                                        type: "number",
                                                        description: "Lock quantity for nivapp platform",
                                                    },
                                                    orderedqty: {
                                                        type: "number",
                                                        description: "Ordered quantity for nivapp platform",
                                                    },
                                                    soldqty: {
                                                        type: "number",
                                                        description: "Sold quantity for nivapp platform",
                                                    },
                                                    platformstatus: {
                                                        type: "string",
                                                        nullable: true,
                                                        description: "Platform stock status for nivapp platform",
                                                    },
                                                },
                                                description: "Platform stock data for nivapp platform (fetched by componentproductid and platform=nivapp)",
                                            },
                                        },
                                        required: ["componentproductid", "requiredqty", "isactive", "product"],
                                        additionalProperties: false,
                                    },
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
    // GET /v1/products/platform/:platform - Get products for specific platform
    fastify.get("/platform/:platform", {
        schema: {
            description: "Get products for specific platform with platform stock data",
            tags: ["Products", "E-Commerce"],
            params: {
                type: "object",
                properties: {
                    platform: {
                        type: "string",
                        enum: ["amazon", "flipkart", "nivapp"],
                        description: "Platform name"
                    },
                },
                required: ["platform"],
            },
            querystring: {
                type: "object",
                properties: {
                    page: { type: "string", description: "Page number" },
                    limit: { type: "string", description: "Items per page" },
                    category: { type: "string", description: "Filter by category" },
                    subcategory: { type: "string", description: "Filter by subcategory" },
                    subsubcategory: { type: "string", description: "Filter by sub-subcategory" },
                    brand: { type: "string", description: "Filter by brand" },
                    minPrice: { type: "string", description: "Minimum price" },
                    maxPrice: { type: "string", description: "Maximum price" },
                    stockStatus: {
                        type: "string",
                        enum: ["in_stock", "low_stock", "out_of_stock"],
                        description: "Filter by platform stock status"
                    },
                    search: { type: "string", description: "Search in product name/description" },
                    isdealoftheday: {
                        type: "string",
                        enum: ["true", "false"],
                        description: "Filter by deal of the day status (true or false)"
                    },
                },
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
                                    shortdescription: { type: "string", nullable: true, description: "Short description" },
                                    fulldescription: { type: "string", nullable: true, description: "Full description" },
                                    price: { type: "number", nullable: true, description: "Product price" },
                                    discount: { type: "number", nullable: true, description: "Discount amount" },
                                    category: { type: "string", nullable: true, description: "Product category" },
                                    subcategory: { type: "string", nullable: true, description: "Product subcategory" },
                                    subsubcategory: { type: "string", nullable: true, description: "Product sub-subcategory" },
                                    // Image arrays
                                    large: { type: "array", items: { type: "string" }, nullable: true, description: "Large size images" },
                                    medium: { type: "array", items: { type: "string" }, nullable: true, description: "Medium size images" },
                                    small: { type: "array", items: { type: "string" }, nullable: true, description: "Small size images" },
                                    // Platform stock quantity
                                    availablequantity: { type: "number", nullable: true, description: "Available quantity from platform stock" },
                                    // Combo Pack Support
                                    iscombo: {
                                        type: "boolean",
                                        nullable: true,
                                        description: "Is this a combo product?",
                                    },
                                    combotype: {
                                        type: "string",
                                        nullable: true,
                                        description: "Combo type: 'fixed' or 'dynamic'",
                                    },
                                    components: {
                                        type: "array",
                                        nullable: true,
                                        description: "Component products (only present if iscombo is true)",
                                        items: {
                                            type: "object",
                                            properties: {
                                                componentproductid: {
                                                    oneOf: [
                                                        { type: "string", pattern: "^\\d+$" },
                                                        { type: "number" },
                                                    ],
                                                    description: "Component product ID",
                                                },
                                                requiredqty: {
                                                    type: "integer",
                                                    description: "Quantity of this component needed per combo",
                                                },
                                                isactive: {
                                                    type: "boolean",
                                                    description: "Is this component active?",
                                                },
                                                product: {
                                                    type: "object",
                                                    properties: {
                                                        name: {
                                                            type: "string",
                                                            nullable: true,
                                                            description: "Component product name",
                                                        },
                                                        puc: {
                                                            type: "string",
                                                            nullable: true,
                                                            description: "Component product PUC code",
                                                        },
                                                    },
                                                    required: ["name", "puc"],
                                                    additionalProperties: false,
                                                },
                                                platformStock: {
                                                    type: "object",
                                                    nullable: true,
                                                    properties: {
                                                        availableqty: {
                                                            type: "number",
                                                            description: "Available quantity for nivapp platform",
                                                        },
                                                        lockqty: {
                                                            type: "number",
                                                            description: "Lock quantity for nivapp platform",
                                                        },
                                                        orderedqty: {
                                                            type: "number",
                                                            description: "Ordered quantity for nivapp platform",
                                                        },
                                                        soldqty: {
                                                            type: "number",
                                                            description: "Sold quantity for nivapp platform",
                                                        },
                                                        platformstatus: {
                                                            type: "string",
                                                            nullable: true,
                                                            description: "Platform stock status for nivapp platform",
                                                        },
                                                    },
                                                    description: "Platform stock data for nivapp platform (fetched by componentproductid and platform=nivapp)",
                                                },
                                            },
                                            required: ["componentproductid", "requiredqty", "isactive", "product"],
                                            additionalProperties: false,
                                        },
                                    },
                                },
                                additionalProperties: true,
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
                                platform: { type: "string" },
                                filters: { type: "array", items: { type: "string" } },
                                total: { type: "number" },
                                filtered: { type: "boolean" },
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
    }, productController.getProductsForPlatform.bind(productController));
    // GET /v1/products/platform/:platform/counts - Get product counts by category for platform
    fastify.get("/platform/:platform/counts", {
        schema: {
            description: "Get product counts grouped by category and subcategory for a specific platform",
            tags: ["Products", "E-Commerce", "Analytics"],
            params: {
                type: "object",
                properties: {
                    platform: {
                        type: "string",
                        enum: ["amazon", "flipkart", "nivapp"],
                        description: "Platform name"
                    },
                },
                required: ["platform"],
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: {
                            type: "object",
                            properties: {
                                platform: {
                                    type: "string",
                                    description: "Platform name"
                                },
                                totalProducts: {
                                    type: "number",
                                    description: "Total number of products for this platform"
                                },
                                categories: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            id: {
                                                type: "string",
                                                description: "Category ID"
                                            },
                                            label: {
                                                type: "string",
                                                description: "Human-readable category label"
                                            },
                                            count: {
                                                type: "number",
                                                description: "Number of products in this category"
                                            },
                                            subcategories: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        id: {
                                                            type: "string",
                                                            description: "Subcategory ID"
                                                        },
                                                        label: {
                                                            type: "string",
                                                            description: "Human-readable subcategory label"
                                                        },
                                                        count: {
                                                            type: "number",
                                                            description: "Number of products in this subcategory"
                                                        },
                                                        subsubcategories: {
                                                            type: "array",
                                                            items: {
                                                                type: "object",
                                                                properties: {
                                                                    id: {
                                                                        type: "string",
                                                                        description: "Subsubcategory ID"
                                                                    },
                                                                    label: {
                                                                        type: "string",
                                                                        description: "Human-readable subsubcategory label"
                                                                    },
                                                                    count: {
                                                                        type: "number",
                                                                        description: "Number of products in this subsubcategory"
                                                                    },
                                                                },
                                                                required: ["id", "label", "count"],
                                                            },
                                                        },
                                                    },
                                                    required: ["id", "label", "count", "subsubcategories"],
                                                },
                                            },
                                        },
                                        required: ["id", "label", "count", "subcategories"],
                                    },
                                },
                            },
                            required: ["platform", "totalProducts", "categories"],
                        },
                        message: { type: "string" },
                    },
                },
                400: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        error: { type: "string" },
                        statusCode: { type: "number" },
                    },
                },
                401: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        error: { type: "string" },
                        statusCode: { type: "number" },
                    },
                },
                500: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        error: { type: "string" },
                        statusCode: { type: "number" },
                    },
                },
            },
        },
    }, productController.getProductCountsByCategory.bind(productController));
    // GET /v1/products/:id/platform/:platform - Get single product with platform stock
    fastify.get("/:id/platform/:platform", {
        schema: {
            description: "Get single product with platform-specific stock data",
            tags: ["Products", "E-Commerce"],
            params: {
                type: "object",
                properties: {
                    id: { type: "string", description: "Product ID" },
                    platform: {
                        type: "string",
                        enum: ["amazon", "flipkart", "nivapp"],
                        description: "Platform name"
                    },
                },
                required: ["id", "platform"],
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
                                price: { type: "number", nullable: true, description: "Product price" },
                                category: { type: "string", nullable: true, description: "Product category" },
                                subcategory: { type: "string", nullable: true, description: "Product subcategory" },
                                // Combo Pack Support
                                iscombo: {
                                    type: "boolean",
                                    nullable: true,
                                    description: "Is this a combo product?",
                                },
                                combotype: {
                                    type: "string",
                                    nullable: true,
                                    description: "Combo type: 'fixed' or 'dynamic'",
                                },
                                components: {
                                    type: "array",
                                    nullable: true,
                                    description: "Component products (only present if iscombo is true)",
                                    items: {
                                        type: "object",
                                        properties: {
                                            componentproductid: {
                                                oneOf: [
                                                    { type: "string", pattern: "^\\d+$" },
                                                    { type: "number" },
                                                ],
                                                description: "Component product ID",
                                            },
                                            requiredqty: {
                                                type: "integer",
                                                description: "Quantity of this component needed per combo",
                                            },
                                            isactive: {
                                                type: "boolean",
                                                description: "Is this component active?",
                                            },
                                            product: {
                                                type: "object",
                                                properties: {
                                                    name: {
                                                        type: "string",
                                                        nullable: true,
                                                        description: "Component product name",
                                                    },
                                                    puc: {
                                                        type: "string",
                                                        nullable: true,
                                                        description: "Component product PUC code",
                                                    },
                                                },
                                                required: ["name", "puc"],
                                                additionalProperties: false,
                                            },
                                            platformStock: {
                                                type: "object",
                                                nullable: true,
                                                properties: {
                                                    availableqty: {
                                                        type: "number",
                                                        description: "Available quantity for nivapp platform",
                                                    },
                                                    lockqty: {
                                                        type: "number",
                                                        description: "Lock quantity for nivapp platform",
                                                    },
                                                    orderedqty: {
                                                        type: "number",
                                                        description: "Ordered quantity for nivapp platform",
                                                    },
                                                    soldqty: {
                                                        type: "number",
                                                        description: "Sold quantity for nivapp platform",
                                                    },
                                                    platformstatus: {
                                                        type: "string",
                                                        nullable: true,
                                                        description: "Platform stock status for nivapp platform",
                                                    },
                                                },
                                                description: "Platform stock data for nivapp platform (fetched by componentproductid and platform=nivapp)",
                                            },
                                        },
                                        required: ["componentproductid", "requiredqty", "isactive", "product"],
                                        additionalProperties: false,
                                    },
                                },
                            },
                            additionalProperties: true,
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
    }, productController.getProductForPlatform.bind(productController));
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
                    subsubcategory: {
                        type: "string",
                        maxLength: 255,
                        description: "Product sub-subcategory",
                    },
                    brand: {
                        type: "string",
                        maxLength: 255,
                        description: "Product brand",
                    },
                    pack: {
                        type: "string",
                        maxLength: 255,
                        description: "Pack size",
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
                    isdealoftheday: {
                        type: "boolean",
                        description: "Mark product as deal of the day",
                    },
                    // Additional Product Information
                    material: {
                        type: "string",
                        maxLength: 255,
                        description: "Product material",
                    },
                    itemlength: {
                        type: "string",
                        maxLength: 255,
                        description: "Item length",
                    },
                    manufacturer: {
                        type: "string",
                        maxLength: 255,
                        description: "Manufacturer",
                    },
                    netform: {
                        type: "string",
                        maxLength: 255,
                        description: "Net form (e.g., stick, bottle)",
                    },
                    netquantity: {
                        type: "string",
                        maxLength: 255,
                        description: "Net quantity (e.g., 30 sticks, 500ml)",
                    },
                    numberofitems: {
                        type: "integer",
                        minimum: 0,
                        description: "Number of items",
                    },
                    itemthickness: {
                        type: "string",
                        maxLength: 255,
                        description: "Item thickness",
                    },
                    purpose: {
                        type: "string",
                        maxLength: 255,
                        description: "Product purpose",
                    },
                    burntime: {
                        type: "string",
                        maxLength: 255,
                        description: "Burn time",
                    },
                    power: {
                        type: "string",
                        maxLength: 255,
                        description: "Power/intensity",
                    },
                    longevity: {
                        type: "string",
                        maxLength: 255,
                        description: "Longevity/duration",
                    },
                    gender: {
                        type: "string",
                        maxLength: 50,
                        description: "Target gender",
                    },
                    // Combo Pack Support
                    iscombo: {
                        type: "boolean",
                        description: "Is this a combo product? (default: false)",
                    },
                    combotype: {
                        type: "string",
                        maxLength: 50,
                        description: "Combo type: 'fixed' or 'dynamic' (default: 'fixed')",
                    },
                    components: {
                        type: "array",
                        description: "Component products for combo pack (required if iscombo is true)",
                        items: {
                            type: "object",
                            properties: {
                                productid: {
                                    anyOf: [
                                        { type: "string", pattern: "^\\d+$" },
                                        { type: "number" },
                                    ],
                                    description: "Component product ID",
                                },
                                requiredqty: {
                                    type: "integer",
                                    minimum: 1,
                                    description: "Quantity of this component needed per combo (minimum: 1)",
                                },
                            },
                            required: ["productid", "requiredqty"],
                            additionalProperties: false,
                        },
                    },
                },
                required: ["name"], // Only name is required as per schema
                additionalProperties: false, // Strict validation - only allow specified fields
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
                                subsubcategory: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product sub-subcategory",
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
                                isdealoftheday: {
                                    type: "boolean",
                                    nullable: true,
                                    description: "Is deal of the day",
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
                                // Additional Product Information
                                material: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product material",
                                },
                                itemlength: {
                                    type: "string",
                                    nullable: true,
                                    description: "Item length",
                                },
                                manufacturer: {
                                    type: "string",
                                    nullable: true,
                                    description: "Manufacturer",
                                },
                                netform: {
                                    type: "string",
                                    nullable: true,
                                    description: "Net form (e.g., stick, bottle)",
                                },
                                netquantity: {
                                    type: "string",
                                    nullable: true,
                                    description: "Net quantity (e.g., 30 sticks, 500ml)",
                                },
                                numberofitems: {
                                    type: "number",
                                    nullable: true,
                                    description: "Number of items",
                                },
                                itemthickness: {
                                    type: "string",
                                    nullable: true,
                                    description: "Item thickness",
                                },
                                // Product Dimensions & Weight (single unit)
                                length: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product length in cm (single unit)",
                                },
                                width: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product width in cm (single unit)",
                                },
                                height: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product height in cm (single unit)",
                                },
                                weight: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product weight in grams (single unit)",
                                },
                                purpose: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product purpose",
                                },
                                burntime: {
                                    type: "string",
                                    nullable: true,
                                    description: "Burn time",
                                },
                                power: {
                                    type: "string",
                                    nullable: true,
                                    description: "Power/intensity",
                                },
                                longevity: {
                                    type: "string",
                                    nullable: true,
                                    description: "Longevity/duration",
                                },
                                gender: {
                                    type: "string",
                                    nullable: true,
                                    description: "Target gender",
                                },
                                // Combo Pack Support
                                iscombo: {
                                    type: "boolean",
                                    nullable: true,
                                    description: "Is this a combo product?",
                                },
                                combotype: {
                                    type: "string",
                                    nullable: true,
                                    description: "Combo type: 'fixed' or 'dynamic'",
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
    // POST /v1/products/validate-combo - Validate combo components before creation
    fastify.post("/validate-combo", {
        schema: {
            description: "Validate combo product components before creation",
            tags: ["Products"],
            body: {
                type: "object",
                required: ["components"],
                properties: {
                    components: {
                        type: "array",
                        description: "Component products for combo pack",
                        items: {
                            type: "object",
                            properties: {
                                productid: {
                                    anyOf: [
                                        { type: "string", pattern: "^\\d+$" },
                                        { type: "number" },
                                    ],
                                    description: "Component product ID",
                                },
                                requiredqty: {
                                    type: "integer",
                                    minimum: 1,
                                    description: "Quantity of this component needed per combo (minimum: 1)",
                                },
                            },
                            required: ["productid", "requiredqty"],
                            additionalProperties: false,
                        },
                    },
                },
                additionalProperties: false,
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        isValid: { type: "boolean" },
                        message: { type: "string" },
                    },
                },
                400: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        message: { type: "string" },
                        details: { type: "string" },
                    },
                },
                409: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        isValid: { type: "boolean" },
                        message: { type: "string" },
                        existingCombo: {
                            type: "object",
                            properties: {
                                id: { type: "number" },
                                name: { type: "string" },
                                components: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            productid: { type: "number" },
                                            requiredqty: { type: "number" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    }, productController.validateComboComponents.bind(productController));
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
                    subsubcategory: {
                        type: "string",
                        maxLength: 255,
                        description: "Product sub-subcategory",
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
                    isdealoftheday: {
                        type: "boolean",
                        description: "Mark product as deal of the day",
                    },
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
                    // Additional Product Information
                    material: {
                        type: "string",
                        maxLength: 255,
                        description: "Product material",
                    },
                    itemlength: {
                        type: "string",
                        maxLength: 255,
                        description: "Item length",
                    },
                    manufacturer: {
                        type: "string",
                        maxLength: 255,
                        description: "Manufacturer",
                    },
                    netform: {
                        type: "string",
                        maxLength: 255,
                        description: "Net form (e.g., stick, bottle)",
                    },
                    netquantity: {
                        type: "string",
                        maxLength: 255,
                        description: "Net quantity (e.g., 30 sticks, 500ml)",
                    },
                    numberofitems: {
                        type: "integer",
                        minimum: 0,
                        description: "Number of items",
                    },
                    itemthickness: {
                        type: "string",
                        maxLength: 255,
                        description: "Item thickness",
                    },
                    purpose: {
                        type: "string",
                        maxLength: 255,
                        description: "Product purpose",
                    },
                    burntime: {
                        type: "string",
                        maxLength: 255,
                        description: "Burn time",
                    },
                    power: {
                        type: "string",
                        maxLength: 255,
                        description: "Power/intensity",
                    },
                    longevity: {
                        type: "string",
                        maxLength: 255,
                        description: "Longevity/duration",
                    },
                    gender: {
                        type: "string",
                        maxLength: 50,
                        description: "Target gender",
                    },
                    // Note: iscombo, combotype, and components are NOT allowed in update
                    // These fields can only be set during product creation (POST /v1/products)
                },
                additionalProperties: true, // Allow additional dynamic fields (but iscombo/combotype/components will be rejected by service)
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
                                puc: {
                                    type: "string",
                                    nullable: true,
                                    description: "PUC code",
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
                                subsubcategory: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product sub-subcategory",
                                },
                                brand: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product brand",
                                },
                                pack: {
                                    type: "string",
                                    nullable: true,
                                    description: "Pack size",
                                },
                                isdealoftheday: {
                                    type: "boolean",
                                    description: "Is deal of the day",
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
                                // Additional Product Information
                                material: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product material",
                                },
                                itemlength: {
                                    type: "string",
                                    nullable: true,
                                    description: "Item length",
                                },
                                manufacturer: {
                                    type: "string",
                                    nullable: true,
                                    description: "Manufacturer",
                                },
                                netform: {
                                    type: "string",
                                    nullable: true,
                                    description: "Net form (e.g., stick, bottle)",
                                },
                                netquantity: {
                                    type: "string",
                                    nullable: true,
                                    description: "Net quantity (e.g., 30 sticks, 500ml)",
                                },
                                numberofitems: {
                                    type: "number",
                                    nullable: true,
                                    description: "Number of items",
                                },
                                itemthickness: {
                                    type: "string",
                                    nullable: true,
                                    description: "Item thickness",
                                },
                                // Product Dimensions & Weight (single unit)
                                length: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product length in cm (single unit)",
                                },
                                width: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product width in cm (single unit)",
                                },
                                height: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product height in cm (single unit)",
                                },
                                weight: {
                                    type: "number",
                                    nullable: true,
                                    description: "Product weight in grams (single unit)",
                                },
                                purpose: {
                                    type: "string",
                                    nullable: true,
                                    description: "Product purpose",
                                },
                                burntime: {
                                    type: "string",
                                    nullable: true,
                                    description: "Burn time",
                                },
                                power: {
                                    type: "string",
                                    nullable: true,
                                    description: "Power/intensity",
                                },
                                longevity: {
                                    type: "string",
                                    nullable: true,
                                    description: "Longevity/duration",
                                },
                                gender: {
                                    type: "string",
                                    nullable: true,
                                    description: "Target gender",
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
                    subsubcategory: {
                        type: "string",
                        maxLength: 255,
                        description: "Product sub-subcategory",
                    },
                    brand: {
                        type: "string",
                        maxLength: 255,
                        description: "Product brand",
                    },
                    pack: {
                        type: "string",
                        maxLength: 255,
                        description: "Pack size",
                    },
                    isdealoftheday: {
                        type: "boolean",
                        description: "Is deal of the day",
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
                    // Additional Product Information
                    material: {
                        type: "string",
                        maxLength: 255,
                        description: "Product material",
                    },
                    itemlength: {
                        type: "string",
                        maxLength: 255,
                        description: "Item length",
                    },
                    manufacturer: {
                        type: "string",
                        maxLength: 255,
                        description: "Manufacturer",
                    },
                    netform: {
                        type: "string",
                        maxLength: 255,
                        description: "Net form (e.g., stick, bottle)",
                    },
                    netquantity: {
                        type: "string",
                        maxLength: 255,
                        description: "Net quantity (e.g., 30 sticks, 500ml)",
                    },
                    numberofitems: {
                        type: "integer",
                        minimum: 0,
                        description: "Number of items",
                    },
                    itemthickness: {
                        type: "string",
                        maxLength: 255,
                        description: "Item thickness",
                    },
                    purpose: {
                        type: "string",
                        maxLength: 255,
                        description: "Product purpose",
                    },
                    burntime: {
                        type: "string",
                        maxLength: 255,
                        description: "Burn time",
                    },
                    power: {
                        type: "string",
                        maxLength: 255,
                        description: "Power/intensity",
                    },
                    longevity: {
                        type: "string",
                        maxLength: 255,
                        description: "Longevity/duration",
                    },
                    gender: {
                        type: "string",
                        maxLength: 50,
                        description: "Target gender",
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
                                        puc: {
                                            type: "string",
                                            nullable: true,
                                            description: "PUC code",
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
                                        subsubcategory: {
                                            type: "string",
                                            nullable: true,
                                            description: "Product sub-subcategory",
                                        },
                                        brand: {
                                            type: "string",
                                            nullable: true,
                                            description: "Product brand",
                                        },
                                        pack: {
                                            type: "string",
                                            nullable: true,
                                            description: "Pack size",
                                        },
                                        isdealoftheday: {
                                            type: "boolean",
                                            description: "Is deal of the day",
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
                                        createddate: {
                                            type: "number",
                                            description: "Creation timestamp",
                                        },
                                        modifieddate: {
                                            type: "number",
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
                                        // Additional Product Information
                                        material: {
                                            type: "string",
                                            nullable: true,
                                            description: "Product material",
                                        },
                                        itemlength: {
                                            type: "string",
                                            nullable: true,
                                            description: "Item length",
                                        },
                                        manufacturer: {
                                            type: "string",
                                            nullable: true,
                                            description: "Manufacturer",
                                        },
                                        netform: {
                                            type: "string",
                                            nullable: true,
                                            description: "Net form (e.g., stick, bottle)",
                                        },
                                        netquantity: {
                                            type: "string",
                                            nullable: true,
                                            description: "Net quantity (e.g., 30 sticks, 500ml)",
                                        },
                                        numberofitems: {
                                            type: "number",
                                            nullable: true,
                                            description: "Number of items",
                                        },
                                        itemthickness: {
                                            type: "string",
                                            nullable: true,
                                            description: "Item thickness",
                                        },
                                        // Product Dimensions & Weight (single unit)
                                        length: {
                                            type: "number",
                                            nullable: true,
                                            description: "Product length in cm (single unit)",
                                        },
                                        width: {
                                            type: "number",
                                            nullable: true,
                                            description: "Product width in cm (single unit)",
                                        },
                                        height: {
                                            type: "number",
                                            nullable: true,
                                            description: "Product height in cm (single unit)",
                                        },
                                        weight: {
                                            type: "number",
                                            nullable: true,
                                            description: "Product weight in grams (single unit)",
                                        },
                                        purpose: {
                                            type: "string",
                                            nullable: true,
                                            description: "Product purpose",
                                        },
                                        burntime: {
                                            type: "string",
                                            nullable: true,
                                            description: "Burn time",
                                        },
                                        power: {
                                            type: "string",
                                            nullable: true,
                                            description: "Power/intensity",
                                        },
                                        longevity: {
                                            type: "string",
                                            nullable: true,
                                            description: "Longevity/duration",
                                        },
                                        gender: {
                                            type: "string",
                                            nullable: true,
                                            description: "Target gender",
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