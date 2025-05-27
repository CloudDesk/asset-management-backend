import { FastifyRequest, FastifyReply } from "fastify";
import { productService } from "../services/product.service.js";
import uploadtos3 from "../aws/uploadtos3.js";

interface idparams {
    id: number
}

export namespace productController {
    export const getProductsrevoData = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            let getProductRevoResult = await productService.getproductsData(request);
            reply.send(getProductRevoResult)
        } catch (error) {
            console.error('ERROR IN  Controller getProductsrevoData', error);
            reply.status(500).send(error.message);
        }
    }
    export const getProductsEcomrevoData = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            let getProductRevoResult = await productService.getEcomProducts(request);
            reply.send(getProductRevoResult)
        } catch (error) {
            console.error('ERROR IN  Controller getProductsEcomrevoData', error);
            reply.send(error.message);
        }
    }
    export const getSimilarProducts = async function (request: any, reply: any) {
        try {
            let getProductsResult = await productService.getSimilarProducts(request)
            reply.send(getProductsResult)
        } catch (error) {
            console.error('ERROR IN  Controller getSimilarProducts', error);
            reply.send(`${error.message} error in get Products`)
        }
    }

    export const upsertlockqty = async function (request: any, reply: any) {
        try {
            let getProductsResult = await productService.bulkupsertProducttosetZero(request.body, true)
            reply.send(getProductsResult)
        } catch (error) {
            console.error('ERROR IN  Controller upsertlockqty', error);
            reply.send(`${error.message} error in get Products`)
        }
    }
    export const getArcheivedProductsRevo = async (request: any, reply: any) => {
        try {
            let getProductsResult = await productService.getArcheivedProductsrevo(request)
            reply.send(getProductsResult)
        } catch (error) {
            console.error('ERROR IN  Controller getArcheivedProductsRevo', error);
            reply.send(`${error.message} error in get Products`)
        }
    }

    export const getEachProductsRevo = async function (request: FastifyRequest<{ Params: idparams }>, reply: FastifyReply) {
        try {
            const { id } = request.params

            let getProductsResult = await productService.getEachProductsRevo(request, Number(id))
            reply.send(getProductsResult)
        } catch (error) {
            console.error('ERROR IN  Controller getEachProductsRevo', error);
            reply.send(`${error.message} error in get Each Products`)
        }
    }
    export const updateOrderedQuantityarray = async function (request: FastifyRequest<{ Params: idparams }>, reply: FastifyReply) {
        try {
            const { id } = request.params

            let getProductsResult = await productService.updateOrderedQuantityarray(request.body)
            reply.send(getProductsResult)
        } catch (error) {
            console.error('ERROR IN  Controller updateOrderedQuantityarray', error);
            reply.send(`${error.message} error in get Each Products`)
        }
    }
    export const deleteProductrevo = async (request: FastifyRequest<{ Params: idparams }>, reply: FastifyReply) => {
        try {
            const { id } = request.params;
            let deleteProductRevoResult = await productService.deleteProductrevo(Number(id));
            reply.send(deleteProductRevoResult);
        } catch (error) {
            console.error('ERROR IN  Controller deleteProductrevo', error);
            reply.send(error.message);
        }
    }
    export const upsertProductrevo = async (request: any, reply: any) => {
        try {
            const productrevoData = request.body;
            let upsertProductRevoResult = await productService.upsertProductrevo(productrevoData)
            if (upsertProductRevoResult.command === "UPDATE" || upsertProductRevoResult.command === "INSERT") {
                let message: any = {}
                message = {
                    product: upsertProductRevoResult.command === "UPDATE"
                        ? `Product Updated successfully`
                        : `Product Inserted successfully`
                };
                reply.status(200).send(message)
            }
            else {
                reply.status(404).send({ error: [upsertProductRevoResult] })
            }
        } catch (error) {
            console.error('ERROR IN  Controller upsertProductrevo', error);
            reply.send(error.message)
        }
    }


    export const upsertProductwithfileRevo = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            let productUpsertResult: any = await productService.upsertProductwithFileRevo(request)
            if (productUpsertResult.command === "UPDATE" || productUpsertResult.command === "INSERT") {
                let message: any = {}
                let productId = productUpsertResult.productid
                if (productId) {
                    let result = await uploadtos3(productUpsertResult.pathurldatas, productId)
                }
                message = {
                    product: productUpsertResult.command === "UPDATE"
                        ? `Product File Updated successfully`
                        : `Product File Inserted successfully`
                };
                reply.status(200).send(message)
            }
        } catch (error) {
            console.error('ERROR IN  Controller upsertProductwithfileRevo', error);
            reply.send(` Error in upsert Product : ${error.message}`)
        }
    }
    export const upsertProductwithfileRevogcp = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            let productUpsertResult: any = await productService.upsertProductwithfileRevogcp(request)
            if (productUpsertResult.result.command === "UPDATE" || productUpsertResult.result.command === "INSERT") {
                let message: any = {}

                message = {
                    product: productUpsertResult.command === "UPDATE"
                        ? `Product File Updated successfully`
                        : `Product File Inserted successfully`
                };
                return message
            }
            // reply.send('Success')
        } catch (error) {
            console.error('ERROR IN  Controller upsertProductwithfileRevogcp', error);
            reply.send(` Error in upsert Product : ${error.message}`)
        }
    }

    export const rearrangeImageRevo = async function (request, reply) {
        try {

            let getProductsResult = await productService.rearrangeImageRevo(request)
            if (getProductsResult.command === "UPDATE" || getProductsResult.command === "INSERT") {
                let message: any = {}
                message = {
                    product: getProductsResult.command === "UPDATE"
                        ? `Image Rearranged  successfully`
                        : `Image Rearranged  successfully`
                };
                reply.status(200).send(message)
            }
            else {
                reply.status(500).send(getProductsResult)
            }

        } catch (error) {
            console.error('ERROR IN  Controller rearrangeImageRevo', error);
            reply.send(`${error.message} error in get Products`)
        }
    }

    export const updateRemovedFromRecyclebinRevo = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            let resultremoverecyclebin = await productService.updateRemoveFromRecyclebinRevo()
            reply.send(resultremoverecyclebin)
        } catch (error) {
            console.error('ERROR IN  Controller updateRemovedFromRecyclebinRevo', error);
            reply.send(`Error in updating recyclebin : ${error.message}`)
        }
    }

}