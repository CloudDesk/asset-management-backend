import { FastifyInstance } from 'fastify';
import { RatingController } from '../controllers/rating.controller.js';

export async function ratingRoutes(fastify: FastifyInstance) {
  const ratingController = new RatingController();

  // GET /v1/ratings - Get all ratings with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all ratings with pagination and filtering',
      tags: ['Ratings'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          userid: { type: 'string', description: 'Filter by user ID' },
          productid: { type: 'string', description: 'Filter by product ID' },
          orderid: { type: 'string', description: 'Filter by order ID' },
          starrating: { type: 'string', description: 'Filter by star rating' },
          usermail: { type: 'string', description: 'Filter by user email' },
          orderlineid: { type: 'string', description: 'Filter by order line ID' },
          createdAfter: { type: 'string', description: 'Created after date' },
          createdBefore: { type: 'string', description: 'Created before date' },
        },
        additionalProperties: true, // Allow any query parameters for dynamic filtering
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  userid: { type: 'number' },
                  productid: { type: 'number' },
                  orderid: { type: 'number' },
                  starrating: { type: 'number', minimum: 1, maximum: 5 },
                  comments: { type: 'string' },
                  url: { type: 'array', items: { type: 'string' } },
                  usermail: { type: 'string' },
                  orderlineid: { type: 'number' },
                  createddate: { type: 'number' },
                  modifieddate: { type: 'number' },
                },
                additionalProperties: true
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' },
                hasNext: { type: 'boolean' },
                hasPrev: { type: 'boolean' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                filters: { type: 'array', items: { type: 'string' } },
                total: { type: 'number' },
                filtered: { type: 'boolean' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, ratingController.getRatings.bind(ratingController));

  // GET /v1/ratings/:id - Get rating by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get rating by ID',
      tags: ['Ratings'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Rating ID' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              properties: {
                id: { type: 'number' },
                userid: { type: 'number' },
                productid: { type: 'number' },
                orderid: { type: 'number' },
                starrating: { type: 'number', minimum: 1, maximum: 5 },
                comments: { type: 'string' },
                url: { type: 'array', items: { type: 'string' } },
                usermail: { type: 'string' },
                orderlineid: { type: 'number' },
                createddate: { type: 'number' },
                modifieddate: { type: 'number' },
              },
              additionalProperties: true
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ratingController.getRating.bind(ratingController));

  // POST /v1/ratings - Create new rating
  fastify.post('/', {
    schema: {
      description: 'Create a new rating',
      tags: ['Ratings'],
      body: {
        type: 'object',
        properties: {
          userid: { type: 'number', description: 'User ID who is rating' },
          productid: { type: 'number', description: 'Product ID being rated' },
          orderid: { type: 'number', description: 'Order ID' },
          starrating: { type: 'number', minimum: 1, maximum: 5, description: 'Star rating (1-5)' },
          comments: { type: 'string', description: 'Rating comments' },
          url: { type: 'array', items: { type: 'string' }, description: 'Array of URLs' },
          usermail: { type: 'string', format: 'email', description: 'User email' },
          orderlineid: { type: 'number', description: 'Order line ID' },
        },
        additionalProperties: true,
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              additionalProperties: true
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ratingController.createRating.bind(ratingController));

  // PUT /v1/ratings/:id - Update rating
  fastify.put('/:id', {
    schema: {
      description: 'Update an existing rating',
      tags: ['Ratings'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Rating ID' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          userid: { type: 'number', description: 'User ID who is rating' },
          productid: { type: 'number', description: 'Product ID being rated' },
          orderid: { type: 'number', description: 'Order ID' },
          starrating: { type: 'number', minimum: 1, maximum: 5, description: 'Star rating (1-5)' },
          comments: { type: 'string', description: 'Rating comments' },
          url: { type: 'array', items: { type: 'string' }, description: 'Array of URLs' },
          usermail: { type: 'string', format: 'email', description: 'User email' },
          orderlineid: { type: 'number', description: 'Order line ID' },
        },
        additionalProperties: true,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              additionalProperties: true
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ratingController.updateRating.bind(ratingController));

  // DELETE /v1/ratings/:id - Delete rating
  fastify.delete('/:id', {
    schema: {
      description: 'Delete a rating',
      tags: ['Ratings'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Rating ID' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'null' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ratingController.deleteRating.bind(ratingController));

  // POST /v1/ratings/upsert - Upsert rating
  fastify.post('/upsert', {
    schema: {
      description: 'Create or update a rating (upsert operation)',
      tags: ['Ratings'],
      body: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Rating ID (if updating)' },
          userid: { type: 'number', description: 'User ID who is rating' },
          productid: { type: 'number', description: 'Product ID being rated' },
          orderid: { type: 'number', description: 'Order ID' },
          starrating: { type: 'number', minimum: 1, maximum: 5, description: 'Star rating (1-5)' },
          comments: { type: 'string', description: 'Rating comments' },
          url: { type: 'array', items: { type: 'string' }, description: 'Array of URLs' },
          usermail: { type: 'string', format: 'email', description: 'User email' },
          orderlineid: { type: 'number', description: 'Order line ID' },
        },
        additionalProperties: true,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              additionalProperties: true
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ratingController.upsertRating.bind(ratingController));

  // GET /v1/ratings/user/:userId - Get ratings by user ID
  fastify.get('/user/:userId', {
    schema: {
      description: 'Get all ratings by a specific user',
      tags: ['Ratings'],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID' },
        },
        required: ['userId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  userid: { type: 'number' },
                  productid: { type: 'number' },
                  orderid: { type: 'number' },
                  starrating: { type: 'number', minimum: 1, maximum: 5 },
                  comments: { type: 'string' },
                  url: { type: 'array', items: { type: 'string' } },
                  usermail: { type: 'string' },
                  orderlineid: { type: 'number' },
                  createddate: { type: 'number' },
                  modifieddate: { type: 'number' },
                },
                additionalProperties: true
              }
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ratingController.getRatingsByUserId.bind(ratingController));

  // GET /v1/ratings/product/:productId - Get ratings by product ID
  fastify.get('/product/:productId', {
    schema: {
      description: 'Get all ratings for a specific product',
      tags: ['Ratings'],
      params: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID' },
        },
        required: ['productId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  userid: { type: 'number' },
                  productid: { type: 'number' },
                  orderid: { type: 'number' },
                  starrating: { type: 'number', minimum: 1, maximum: 5 },
                  comments: { type: 'string' },
                  url: { type: 'array', items: { type: 'string' } },
                  usermail: { type: 'string' },
                  orderlineid: { type: 'number' },
                  createddate: { type: 'number' },
                  modifieddate: { type: 'number' },
                },
                additionalProperties: true
              }
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ratingController.getRatingsByProductId.bind(ratingController));

  // GET /v1/ratings/order/:orderId - Get ratings by order ID
  fastify.get('/order/:orderId', {
    schema: {
      description: 'Get all ratings for a specific order',
      tags: ['Ratings'],
      params: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'Order ID' },
        },
        required: ['orderId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  userid: { type: 'number' },
                  productid: { type: 'number' },
                  orderid: { type: 'number' },
                  starrating: { type: 'number', minimum: 1, maximum: 5 },
                  comments: { type: 'string' },
                  url: { type: 'array', items: { type: 'string' } },
                  usermail: { type: 'string' },
                  orderlineid: { type: 'number' },
                  createddate: { type: 'number' },
                  modifieddate: { type: 'number' },
                },
                additionalProperties: true
              }
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ratingController.getRatingsByOrderId.bind(ratingController));

  // GET /v1/ratings/product/:productId/average - Get average rating for product
  fastify.get('/product/:productId/average', {
    schema: {
      description: 'Get average rating and total count for a specific product',
      tags: ['Ratings'],
      params: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID' },
        },
        required: ['productId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              properties: {
                averageRating: { type: 'number', description: 'Average rating (1-5)' },
                totalRatings: { type: 'number', description: 'Total number of ratings' },
              }
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ratingController.getAverageRatingByProductId.bind(ratingController));

  // GET /v1/ratings/stars - Get rating distribution by star level
  fastify.get('/stars', {
    schema: {
      description: 'Get rating distribution by star level (optionally for a specific product)',
      tags: ['Ratings'],
      querystring: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID (optional)' },
        },
        additionalProperties: false,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              properties: {
                1: { type: 'number', description: 'Count of 1-star ratings' },
                2: { type: 'number', description: 'Count of 2-star ratings' },
                3: { type: 'number', description: 'Count of 3-star ratings' },
                4: { type: 'number', description: 'Count of 4-star ratings' },
                5: { type: 'number', description: 'Count of 5-star ratings' },
              }
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ratingController.getRatingsByStarLevel.bind(ratingController));

  // GET /v1/ratings/product/:productId/stars - Get rating distribution by star level for specific product
  fastify.get('/product/:productId/stars', {
    schema: {
      description: 'Get rating distribution by star level for a specific product',
      tags: ['Ratings'],
      params: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID' },
        },
        required: ['productId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              properties: {
                1: { type: 'number', description: 'Count of 1-star ratings' },
                2: { type: 'number', description: 'Count of 2-star ratings' },
                3: { type: 'number', description: 'Count of 3-star ratings' },
                4: { type: 'number', description: 'Count of 4-star ratings' },
                5: { type: 'number', description: 'Count of 5-star ratings' },
              }
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ratingController.getRatingsByStarLevel.bind(ratingController));
} 