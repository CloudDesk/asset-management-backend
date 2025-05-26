import { FastifySchema } from "fastify";

export const userInsertSchema = {
    type: 'object',
    properties: {
        useremail: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'User e-mail should be string'
            }
        },
        userpassword: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'User Password should be string'
            }
        },
    },

    required: []
};

export const userSchemas = {
  getUsers: {
    tags: ['Users'],
    summary: 'Get all users',
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'number', default: 1 },
        count: { type: 'number', default: 5000 },
        useremail: { type: 'string' },
        sortby: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                firstname: { type: 'string' },
                lastname: { type: 'string' },
                useremail: { type: 'string' },
                usermobilenumber: { type: 'string' },
                fcmid: { type: 'string' },
                createddate: { type: 'string', format: 'date-time' },
                modifieddate: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  } as FastifySchema,

  login: {
    tags: ['Users'],
    summary: 'User login',
    body: {
      type: 'object',
      required: ['useremail', 'userpassword'],
      properties: {
        useremail: { type: 'string', format: 'email' },
        userpassword: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          userdata: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                firstname: { type: 'string' },
                lastname: { type: 'string' },
                useremail: { type: 'string' },
                usermobilenumber: { type: 'string' },
                fcmid: { type: 'string' }
              }
            }
          },
          redirect: { type: 'boolean' },
          inventoryAppUrl: { type: 'string' }
        }
      },
      401: {
        type: 'object',
        properties: {
          error: { type: 'string' }
        }
      }
    }
  } as FastifySchema,

  forgotPassword: {
    tags: ['Users'],
    summary: 'Forgot password request',
    body: {
      type: 'object',
      required: ['useremail'],
      properties: {
        useremail: { type: 'string', format: 'email' },
        otp: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          message: { type: 'string' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                firstname: { type: 'string' },
                lastname: { type: 'string' },
                useremail: { type: 'string' }
              }
            }
          }
        }
      },
      404: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        }
      }
    }
  } as FastifySchema,

  upsertUser: {
    tags: ['Users'],
    summary: 'Create or update user',
    body: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        firstname: { type: 'string' },
        lastname: { type: 'string' },
        useremail: { type: 'string', format: 'email' },
        userpassword: { type: 'string' },
        usermobilenumber: { type: 'string' }
      },
      required: ['firstname', 'lastname', 'useremail', 'userpassword']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                firstname: { type: 'string' },
                lastname: { type: 'string' },
                useremail: { type: 'string' }
              }
            }
          }
        }
      },
      401: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        }
      }
    }
  } as FastifySchema,

  deleteUser: {
    tags: ['Users'],
    summary: 'Delete user',
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'number' }
      }
    },
    response: {
      200: {
        type: 'string'
      }
    }
  } as FastifySchema,

  logout: {
    tags: ['Users'],
    summary: 'User logout',
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' }
        }
      }
    }
  } as FastifySchema
};
