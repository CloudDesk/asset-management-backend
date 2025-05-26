import { getStockLocationData } from "../utils/StockLocationPicklist/locationpicklist.js";
import { Type } from '@sinclair/typebox';

const locationdataajv = await getStockLocationData()

export const stockrevoSchema = {
    type: 'object',
    properties: {
        puc: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'PUC should be String'
            }
        },
        category: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'Category should be String'
            }
        },
        subcategory: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'Subcategory should be String'
            }
        },
        brand: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'Brand should be String'
            }
        },
        model: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'Model should be String'
            }
        },
        operatingsystem: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'Operating System should be String'
            }
        },
        operatingsystemversion: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'Operating System Version should be String'
            }
        },
        ram: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'RAM should be String'
            }
        },
        storagetype: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'Storage Type should be String'
            }
        },
        storagecapacity: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'Storage Capacity should be String'
            }
        },
        colour: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'Colour should be String'
            }
        },
        graphicscard: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'Graphics card should be String'
            }
        },
        processor: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'Processor should be String'
            }
        },
        createdby: {
            type: ['number', 'null'],
            errorMessage: {
                type: 'Created by should be number'
            }
        },
        modifiedby: {
            type: ['number', 'null'],
            errorMessage: {
                type: 'Modified by should be number'
            }
        },
        serialnumber: {
            type: ["string"],
            errorMessage: {
                type: "Serial number should be a string",
            },
        },
        stockstatus: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'Stock status should be String'
            }
        },
        manufacturedyear: {
            type: ["string", "null"],
            pattern: "^(0[1-9]|[12][0-9]|3[01])[-/](0[1-9]|1[0-2])[-/](\\d{4})$",
            errorMessage: {
                type: "Manufactured year should be a string",
                pattern: "Manufactured year should be a valid date in the format DD-MM-YYYY"
            }
        },
        releaseyear: {
            type: ["string", "null"],
            pattern: "^(0[1-9]|[12][0-9]|3[01])[-/](0[1-9]|1[0-2])[-/](\\d{4})$",
            errorMessage: {
                type: "Release year should be a string",
                pattern: "Release year should be a valid date in the format DD-MM-YYYY"
            }
        },
        isdeleted: {
            type: ['boolean', 'null'],
            errorMessage: {
                type: 'Isdeleted should be boolean'
            }
        },
        isarchive: {
            type: ['boolean', 'null'],
            errorMessage: {
                type: 'Isarchive should be boolean'
            }
        },
        removefromrecyclebin: {
            type: ['boolean', 'null'],
            errorMessage: {
                type: 'Remove from recyclebin should be boolean'
            }
        },
        ecompublish: {
            type: ['boolean', 'null'],
            errorMessage: {
                type: 'Ecompublish should be boolean'
            }
        },
        productname: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'Productname should be String'
            }
        },
        rfid:{
            type: ['string', 'null'],
            errorMessage: {
                type: 'RFID should be String'
            }
        },
        location:{
            type: ['string', 'null'],
            errorMessage: {
                type: 'Location should be String',
            }
        }
    },
    required: [
        "serialnumber",
    ]
}

export const deletestockrevoSchema = {
    type: 'object',
    properties: {
        id: {
            type: ['number'],
            errorMessage: {
                type: 'Id should be number.',
            }
        },
        puc: {
            type: ['string', 'null'],
            errorMessage: {
                type: 'PUC should be String'
            }
        },
        serialnumber: {
            type: ["string"],
            errorMessage: {
                type: "Serial number should be a string",
            },
        },
        isdeleted: {
            type: ['boolean'],
            errorMessage: {
                type: 'Isdeleted should be boolean'
            }
        },
    },
    required: [
        "puc", "serialnumber", "isdeleted", "id"
    ],
    errorMessage: {
        required: {
            id: 'Id is mandatory.',
            puc: 'PUC is mandatory.',
            serialnumber: 'Serial number is mandatory.',
            isdeleted: 'Isdeleted is mandatory.'
        }

    }
}

export const archivestockrevoSchema = {
    type: 'object',
    properties: {
        id: {
            type: ['number'],
            errorMessage: {
                type: 'id should be number'
            }
        },
        puc: {
            type: ['string'],
            errorMessage: {
                type: 'PUC should be String'
            }
        },
        serialnumber: {
            type: ["string"],
            errorMessage: {
                type: "Serial number should be a string",
            },
        },
        isarchive: {
            type: ['boolean'],
            errorMessage: {
                type: 'Isarchive should be boolean'
            }
        },
    },
    required: [
        "puc", "serialnumber", "isarchive", "id"
    ],
    errorMessage: {
        required: {
            id: 'Id is mandatory.',
            puc: 'PUC is mandatory.',
            serialnumber: 'Serial number is mandatory.',
            isarchive: 'isarchive is mandatory.'
        }
    }
}

export const stockrevoIdSchema = {
    params: Type.Object({
        id: Type.Number()
    }),
    response: {
        200: Type.Object({
            success: Type.Boolean(),
            data: Type.Any(),
            total: Type.Number(),
            page: Type.Number(),
            limit: Type.Number()
        })
    }
}

export const stockrevoUpsertSchema = {
    body: Type.Object({
        id: Type.Optional(Type.Number()),
        puc: Type.String(),
        name: Type.String(),
        description: Type.Optional(Type.String()),
        category: Type.Optional(Type.String()),
        status: Type.Optional(Type.String()),
        quantity: Type.Optional(Type.Number()),
        price: Type.Optional(Type.Number()),
        displaysize: Type.Optional(Type.String()),
        manufacturedyear: Type.Optional(Type.String()),
        releaseyear: Type.Optional(Type.String()),
        location: Type.Optional(Type.String()),
        stockstatus: Type.Optional(Type.String()),
        ecompublish: Type.Optional(Type.Boolean()),
        isdeleted: Type.Optional(Type.Boolean()),
        isarchive: Type.Optional(Type.Boolean()),
        removefromrecyclebin: Type.Optional(Type.Boolean()),
        ewaste: Type.Optional(Type.Boolean()),
        rfid: Type.Optional(Type.String()),
        orderlinenumber: Type.Optional(Type.String())
    }),
    response: {
        200: Type.Object({
            command: Type.String(),
            result: Type.Any(),
            totalCount: Type.Number()
        })
    }
}

export const stockrevoDeleteSchema = {
    body: Type.Object({
        id: Type.Number(),
        isdeleted: Type.Boolean(),
        removefromrecyclebin: Type.Boolean()
    }),
    response: {
        200: Type.Object({
            command: Type.String(),
            result: Type.Any(),
            totalCount: Type.Number()
        })
    }
}

export const stockrevoArchiveSchema = {
    body: Type.Object({
        id: Type.Number(),
        isarchive: Type.Boolean(),
        removefromrecyclebin: Type.Boolean()
    }),
    response: {
        200: Type.Object({
            command: Type.String(),
            result: Type.Any(),
            totalCount: Type.Number()
        })
    }
}

export const stockrevoRfidSchema = {
    body: Type.Array(Type.Object({
        rfid: Type.String(),
        productid: Type.Number(),
        orderlinenumber: Type.String()
    })),
    response: {
        200: Type.Object({
            command: Type.String(),
            result: Type.Any(),
            totalCount: Type.Number(),
            arraylength: Type.Number()
        })
    }
}

export const StockQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ default: 1 })),
  limit: Type.Optional(Type.Number({ default: 10 })),
  search: Type.Optional(Type.String()),
  sortBy: Type.Optional(Type.String()),
  sortOrder: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  filters: Type.Optional(Type.Record(Type.String(), Type.Any()))
});

export const StockResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: Type.Array(Type.Object({
    id: Type.Number(),
    puc: Type.String(),
    quantity: Type.Number(),
    isdeleted: Type.Boolean(),
    isarchive: Type.Boolean(),
    isewaste: Type.Boolean(),
    created_at: Type.String(),
    updated_at: Type.String()
  })),
  total: Type.Number(),
  page: Type.Number(),
  limit: Type.Number()
});

export const StockUpdateSchema = Type.Object({
  puc: Type.String(),
  quantity: Type.Number(),
  isdeleted: Type.Optional(Type.Boolean()),
  isarchive: Type.Optional(Type.Boolean()),
  isewaste: Type.Optional(Type.Boolean())
});

export const StockRFIDSchema = Type.Object({
  rfid: Type.String(),
  puc: Type.String(),
  quantity: Type.Number()
});

export const StockBulkUpdateSchema = Type.Array(StockUpdateSchema);

export const StockUpdateResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String()
});