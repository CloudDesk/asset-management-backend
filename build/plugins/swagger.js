import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from '../config/env.js';
async function swaggerPlugin(fastify) {
    // Register Swagger
    await fastify.register(swagger, {
        openapi: {
            openapi: '3.0.0',
            info: {
                title: 'Asset Management API',
                description: 'Production-grade Node.js API backend with Fastify, TypeScript, and Prisma',
                version: '1.0.0',
            },
            servers: [
                {
                    url: `http://localhost:${env.PORT}`,
                    description: 'Development server',
                },
            ],
            tags: [
                { name: 'Health', description: 'Health check endpoints' },
                { name: 'Products', description: 'Product management endpoints' },
                { name: 'Stocks', description: 'Stock management endpoints' },
                { name: 'Picklists', description: 'Picklist management endpoints' },
                { name: 'Suppliers', description: 'Supplier management endpoints' },
                { name: 'Purchase Orders', description: 'Purchase order management endpoints' },
                { name: 'Purchase Requests', description: 'Purchase request management endpoints' },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                    },
                },
            },
        },
    });
    // Register Swagger UI
    await fastify.register(swaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: false,
        },
        staticCSP: true,
        transformStaticCSP: (header) => header,
        transformSpecification: (swaggerObject) => {
            return swaggerObject;
        },
        transformSpecificationClone: true,
    });
}
export default fp(swaggerPlugin, {
    name: 'swagger',
});
//# sourceMappingURL=swagger.js.map