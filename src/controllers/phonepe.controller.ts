import { FastifyRequest, FastifyReply } from "fastify";
import {
  PhonePeService,
  PhonePePaymentRequest,
} from "../services/phonepe.service.js";
import { TransactionService } from "../services/transaction.service.js";
import { OrdersService } from "../services/orders.service.js";
import { OrderlineService } from "../services/orderline.service.js";
import { prisma } from "../models/prisma.js";
import {
  createSuccessResponse,
  createErrorResponse,
  asyncHandler,
  ValidationError,
  DatabaseError,
} from "../utils/errorHandler.js";
import { logger } from "../config/logger.js";

export class PhonePeController {
  public phonePeService = new PhonePeService();
  public transactionService = new TransactionService();
  public ordersService = new OrdersService();
  public orderlineService = new OrderlineService();

  /**
   * Initiate payment with PhonePe
   */
  initiatePayment = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const requestBody = request.body as {
          mode: "phonepe" | "cod";
          evaluation_ids?: string[];
          order: Array<{
            addressid: number;
            cartId: number;
            discountamount: number;
            orderamount: number;
            productamount: number;
            productcategory: string;
            productid: number;
            productname: string;
            quantity: number;
            userid: number;
          }>;
          transaction: {
            amount: number;
            mobilenumber: string;
            name: string;
            productid: number[];
            transactionfor: string;
            userId: number;
          };
        };
        console.log("test");
        console.log(request.body, "req body");
        logger.info(
          {
            mode: requestBody.mode,
            evaluation_ids: requestBody.evaluation_ids,
            orderCount: requestBody.order.length,
            transactionAmount: requestBody.transaction.amount,
            userId: requestBody.transaction.userId,
            productIds: requestBody.transaction.productid,
          },
          "Payment initiation request received with new payload structure"
        );
        console.log("first");
        // Step 1: Validate Promotions/Evaluations if provided
        const evaluationsToProcess = requestBody.evaluation_ids || [];
        const validEvaluations = [];
        const invalidEvaluations = [];
        const limitReachedEvaluations = [];

        // Validate all evaluations
        if (evaluationsToProcess.length > 0) {
          const { PromotionEvaluationService } = await import(
            "../services/promotion-evaluation.service.js"
          );
          const evaluationService = new PromotionEvaluationService();

          logger.info(
            {
              evaluationCount: evaluationsToProcess.length,
              evaluationIds: evaluationsToProcess,
              userId: requestBody.transaction.userId,
            },
            "Starting promotion evaluation validation"
          );

          // Validate each evaluation
          for (const evaluationId of evaluationsToProcess) {
            try {
              const validation =
                await evaluationService.validateEvaluationForOrder(
                  evaluationId,
                  requestBody.transaction.userId.toString()
                );

              if (!validation.isValid) {
                const reasonStr =
                  typeof validation.reason === "string"
                    ? validation.reason
                    : JSON.stringify(validation.reason);

                logger.warn(
                  {
                    evaluationId: evaluationId,
                    userId: requestBody.transaction.userId,
                    reason: reasonStr,
                    isValid: false,
                  },
                  "Evaluation validation failed"
                );

                // Check if it's expired/cancelled (block order)
                if (
                  reasonStr.includes("expired") ||
                  reasonStr.includes("cancelled") ||
                  reasonStr.includes("Promotion not found")
                ) {
                  // CRITICAL: Expired/cancelled/missing promotion - block the entire order
                  return reply.code(400).send({
                    success: false,
                    message: `Promotion validation failed: ${reasonStr}`,
                    error_code: "PROMOTION_EXPIRED_OR_INVALID",
                    evaluation_id: evaluationId,
                    reason: reasonStr,
                    action_required:
                      "remove_this_coupon_and_reapply_valid_coupon",
                    invalid_evaluations: [
                      {
                        evaluation_id: evaluationId,
                        reason: reasonStr,
                        status: "expired_or_invalid",
                      },
                    ],
                    statusCode: 400,
                  });
                }
                // Check if usage limit reached (continue without this promotion)
                else if (
                  reasonStr.includes("limit") ||
                  reasonStr.includes("usage") ||
                  reasonStr.includes("exceeded")
                ) {
                  // Usage limit reached - inform user but allow order to continue
                  limitReachedEvaluations.push({
                    evaluation_id: evaluationId,
                    reason: reasonStr,
                    status: "limit_reached",
                  });

                  invalidEvaluations.push({
                    evaluationId: evaluationId,
                    reason: reasonStr,
                    type: "limit_reached",
                  });

                  logger.info(
                    {
                      evaluationId,
                      reason: reasonStr,
                      action: "skipped_due_to_limit",
                    },
                    "Promotion limit reached - will continue without this discount"
                  );
                }
                // Other validation failures
                else {
                  invalidEvaluations.push({
                    evaluationId: evaluationId,
                    reason: reasonStr,
                    type: "other",
                  });
                }
              } else {
                // Evaluation is valid - include it
                validEvaluations.push(evaluationId);

                logger.info(
                  {
                    evaluationId,
                    userId: requestBody.transaction.userId,
                    status: "valid",
                  },
                  "Promotion evaluation validated successfully"
                );
              }
            } catch (evalError: any) {
              logger.error(
                {
                  evaluationId,
                  error: evalError.message,
                  stack: evalError.stack,
                },
                "Error validating promotion evaluation"
              );

              invalidEvaluations.push({
                evaluationId: evaluationId,
                reason: `Validation error: ${evalError.message}`,
                type: "error",
              });
            }
          }

          logger.info(
            {
              totalEvaluations: evaluationsToProcess.length,
              validCount: validEvaluations.length,
              invalidCount: invalidEvaluations.length,
              limitReachedCount: limitReachedEvaluations.length,
              validEvaluations: validEvaluations,
              invalidEvaluations: invalidEvaluations,
              limitReachedEvaluations: limitReachedEvaluations,
              userId: requestBody.transaction.userId,
            },
            "Promotion evaluation validation completed"
          );

          // If promotions have limit-reached issues, inform user but continue
          if (limitReachedEvaluations.length > 0) {
            logger.warn(
              {
                limitReachedCount: limitReachedEvaluations.length,
                limitReachedEvaluations: limitReachedEvaluations,
                validEvaluationsCount: validEvaluations.length,
                message:
                  "Some promotions reached usage limit - proceeding without them",
              },
              "Promotions with usage limits will be skipped"
            );
          }
        }

        // Step 2: Validate Product & PlatformStock availability BEFORE payment
        const PLATFORM_NAME = "nivapp";
        const validationErrors = [];

        logger.info(
          {
            platform: PLATFORM_NAME,
            productCount: requestBody.order.length,
            products: requestBody.order.map((item) => ({
              productid: item.productid,
              quantity: item.quantity,
            })),
          },
          "Starting product and platformstock validation before payment initiation"
        );

        for (const orderItem of requestBody.order) {
          try {
            const productId = orderItem.productid;
            const requestedQuantity = orderItem.quantity;

            // STEP 2A: Validate Product exists and has sufficient overall quantity
            const product = await prisma.product.findUnique({
              where: { id: BigInt(productId) },
              select: {
                id: true,
                name: true,
                puc: true,
                availablequantity: true,
                orderedquantity: true,
                productstatus: true,
                iscombo: true, // ✅ NEW: Check if product is combo
              },
            });

            // Check if product exists
            if (!product) {
              const error = {
                productid: productId,
                productname: orderItem.productname,
                quantity: requestedQuantity,
                error: `Product not found in database`,
                error_code: "PRODUCT_NOT_FOUND",
              };

              logger.error(
                {
                  productId,
                  productname: orderItem.productname,
                  requestedQuantity,
                },
                "Product not found - payment blocked"
              );

              validationErrors.push(error);
              continue;
            }

            // ========================================
            // STEP 2A.1: COMBO PRODUCT COMPONENT VALIDATION
            // ========================================
            if (product.iscombo) {
              logger.info(
                {
                  productId,
                  productname: product.name,
                  quantity: requestedQuantity,
                  productType: "combo",
                },
                "Detected combo product - validating component stock"
              );

              try {
                // Get all active components for this combo
                const components = await prisma.productBundleMap.findMany({
                  where: {
                    bundleproductid: BigInt(productId),
                    isactive: true,
                  },
                  include: {
                    componentproduct: {
                      select: {
                        id: true,
                        name: true,
                        puc: true,
                      },
                    },
                  },
                });

                if (!components || components.length === 0) {
                  const error = {
                    productid: productId,
                    productname: product.name,
                    quantity: requestedQuantity,
                    error: `Combo product has no active components defined in productbundlemap`,
                    error_code: "COMBO_NO_COMPONENTS",
                    productType: "combo",
                  };

                  logger.error(
                    {
                      productId,
                      productname: product.name,
                    },
                    "Combo product has no components - payment blocked"
                  );

                  validationErrors.push(error);
                  continue;
                }

                logger.info(
                  {
                    productId,
                    productname: product.name,
                    componentCount: components.length,
                    components: components.map((c: any) => ({
                      componentproductid: c.componentproductid,
                      requiredqty: c.requiredqty,
                      productname: c.componentproduct?.name,
                    })),
                  },
                  "Retrieved combo components for validation"
                );

                // Validate each component has sufficient stock
                const componentValidationErrors: string[] = [];
                const componentStockInfo: Array<{
                  componentproductid: number;
                  componentname: string;
                  requiredqty: number;
                  totalNeeded: number;
                  available: number;
                  lockqty: number;
                }> = [];

                for (const component of components) {
                  const componentProductId = Number(component.componentproductid);
                  const requiredQty = component.requiredqty || 1;
                  const totalNeeded = requiredQty * requestedQuantity;

                  // Check component platformstock
                  const componentPlatformStock = await prisma.platformStock.findUnique({
                    where: {
                      productid_platform: {
                        productid: BigInt(componentProductId),
                        platform: PLATFORM_NAME,
                      },
                    },
                    select: {
                      availableqty: true,
                      lockqty: true,
                      orderedqty: true,
                    },
                  });

                  if (!componentPlatformStock) {
                    componentValidationErrors.push(
                      `Component ${componentProductId} (${component.componentproduct?.name || "Unknown"}) has no platformstock record`
                    );
                    continue;
                  }

                  const currentAvailableQty = componentPlatformStock.availableqty || 0;
                  const currentLockQty = componentPlatformStock.lockqty || 0;
                  // availableqty already represents available stock, so check it directly
                  const actualAvailable = currentAvailableQty;

                  componentStockInfo.push({
                    componentproductid: componentProductId,
                    componentname: component.componentproduct?.name || "Unknown",
                    requiredqty: requiredQty,
                    totalNeeded: totalNeeded,
                    available: actualAvailable,
                    lockqty: currentLockQty,
                  });

                  // Validate availability
                  // Note: availableqty is the actual available stock, so we check it directly
                  if (actualAvailable < totalNeeded) {
                    componentValidationErrors.push(
                      `Component "${component.componentproduct?.name || componentProductId}" needs ${totalNeeded} units (${requiredQty} per combo × ${requestedQuantity} combos), but only ${actualAvailable} available`
                    );
                  }
                }

                // If any component fails validation, add to validation errors
                if (componentValidationErrors.length > 0) {
                  const error = {
                    productid: productId,
                    productname: product.name,
                    quantity: requestedQuantity,
                    productType: "combo",
                    error: `Combo product has insufficient component stock. ${componentValidationErrors.join("; ")}`,
                    error_code: "INSUFFICIENT_COMBO_COMPONENT_STOCK",
                    componentErrors: componentValidationErrors,
                    componentStockInfo: componentStockInfo,
                  };

                  logger.error(
                    {
                      productId,
                      productname: product.name,
                      requestedQuantity,
                      componentValidationErrors,
                      componentStockInfo,
                    },
                    "Combo product component validation failed - payment blocked"
                  );

                  validationErrors.push(error);
                  continue;
                }

                logger.info(
                  {
                    productId,
                    productname: product.name,
                    componentCount: components.length,
                    requestedQuantity,
                    status: "COMBO_COMPONENTS_VALIDATED",
                  },
                  "All combo components have sufficient stock"
                );

                // Skip the single product quantity validation for combo products
                // Component validation is sufficient
                logger.info(
                  {
                    productId,
                    productname: product.name,
                    platform: PLATFORM_NAME,
                    requestedQuantity,
                    status: "COMBO_VALIDATION_PASSED",
                  },
                  "Combo product validation passed - skipping to platformstock check"
                );
              } catch (comboValidationError: any) {
                logger.error(
                  {
                    productId,
                    error: comboValidationError.message,
                    stack: comboValidationError.stack,
                  },
                  "Error during combo product validation"
                );

                validationErrors.push({
                  productid: productId,
                  productname: product.name,
                  quantity: requestedQuantity,
                  error: `Combo validation error: ${comboValidationError.message}`,
                  error_code: "COMBO_VALIDATION_ERROR",
                  productType: "combo",
                });
                continue;
              }

              logger.info(
                {
                  productId,
                  productname: product.name,
                  platform: PLATFORM_NAME,
                  requestedQuantity,
                  status: "COMBO_VALIDATION_PASSED",
                },
                "Combo product validation passed - skipping platformstock check (combo products are virtual)"
              );

              // ✅ SKIP platformstock check for combo products
              // Combo products don't have their own stock - only components do
              continue;
            }

            // ========================================
            // STEP 2A.2: SINGLE PRODUCT QUANTITY VALIDATION
            // ========================================
            // Check if product has sufficient overall available quantity
            const productAvailableQty = product.availablequantity || 0;
            if (productAvailableQty < requestedQuantity) {
              const error = {
                productid: productId,
                productname: product.name,
                puc: product.puc,
                quantity: requestedQuantity,
                available: productAvailableQty,
                shortage: requestedQuantity - productAvailableQty,
                error: `Insufficient overall product quantity. Available: ${productAvailableQty}, Requested: ${requestedQuantity}`,
                error_code: "INSUFFICIENT_PRODUCT_QUANTITY",
              };

              logger.error(
                {
                  productId,
                  productname: product.name,
                  requestedQuantity,
                  productAvailableQty,
                  shortage: requestedQuantity - productAvailableQty,
                },
                "Insufficient product overall quantity - payment blocked"
              );

              validationErrors.push(error);
              continue;
            }

            logger.info(
              {
                productId,
                productname: product.name,
                requestedQuantity,
                productAvailableQty,
                status: "PRODUCT_VALIDATED",
              },
              "Product overall quantity validation passed"
            );

            // STEP 2B: Validate PlatformStock for NIVAPP
            const platformStock = await prisma.platformStock.findUnique({
              where: {
                productid_platform: {
                  productid: BigInt(productId),
                  platform: PLATFORM_NAME,
                },
              },
              select: {
                availableqty: true,
                lockqty: true,
                orderedqty: true,
                platformstatus: true,
              },
            });

            // If platformstock doesn't exist, it's an error
            if (!platformStock) {
              const error = {
                productid: productId,
                productname: product.name,
                puc: product.puc,
                quantity: requestedQuantity,
                error: `PlatformStock record not found for product on ${PLATFORM_NAME} platform`,
                error_code: "PLATFORMSTOCK_NOT_FOUND",
              };

              logger.error(
                {
                  productId,
                  platform: PLATFORM_NAME,
                  productname: product.name,
                  requestedQuantity,
                },
                "PlatformStock record not found - payment blocked"
              );

              validationErrors.push(error);
              continue;
            }

            // Validate sufficient platform-specific quantity
            // availableqty already represents available stock (after accounting for lockqty)
            // So we check: availableqty >= requestedQuantity
            const currentAvailableQty = platformStock.availableqty || 0;
            const currentLockQty = platformStock.lockqty || 0;

            // Validate sufficient platform-specific quantity
            // Note: availableqty is the actual available stock, so we check it directly
            if (currentAvailableQty < requestedQuantity) {
              const error = {
                productid: productId,
                productname: product.name,
                puc: product.puc,
                quantity: requestedQuantity,
                available: currentAvailableQty,
                availableqty: currentAvailableQty,
                lockqty: currentLockQty,
                shortage: requestedQuantity - currentAvailableQty,
                error: `Insufficient stock on ${PLATFORM_NAME}. Available: ${currentAvailableQty}, Requested: ${requestedQuantity}`,
                error_code: "INSUFFICIENT_PLATFORMSTOCK",
              };

              logger.error(
                {
                  productId,
                  productname: product.name,
                  platform: PLATFORM_NAME,
                  requestedQuantity,
                  currentAvailableQty,
                  currentLockQty,
                  shortage: requestedQuantity - currentAvailableQty,
                },
                "Insufficient platformstock - payment blocked"
              );

              validationErrors.push(error);
              continue;
            }

            // Product and PlatformStock both pass validation
            logger.info(
              {
                productId,
                productname: product.name,
                platform: PLATFORM_NAME,
                requestedQuantity,
                productType: product.iscombo ? "combo" : "single",
                platformAvailableQty: currentAvailableQty,
                platformLockQty: currentLockQty,
                status: "ALL_VALIDATIONS_PASSED",
              },
              product.iscombo
                ? "Combo product and component PlatformStock validation passed"
                : "Product and PlatformStock validation passed"
            );
          } catch (validationError: any) {
            logger.error(
              {
                productId: orderItem.productid,
                error: validationError.message,
                stack: validationError.stack,
              },
              "Error during product/platformstock validation"
            );

            validationErrors.push({
              productid: orderItem.productid,
              productname: orderItem.productname,
              quantity: orderItem.quantity,
              error: `Validation error: ${validationError.message}`,
              error_code: "VALIDATION_ERROR",
            });
          }
        }

        // If any validation errors, block payment
        if (validationErrors.length > 0) {
          logger.error(
            {
              platform: PLATFORM_NAME,
              totalProducts: requestBody.order.length,
              failedProducts: validationErrors.length,
              errors: validationErrors,
            },
            "Product/PlatformStock validation failed - blocking payment"
          );

          return reply.code(400).send({
            success: false,
            message: `Cannot process payment. ${validationErrors.length} product(s) have validation issues`,
            error_code: "PRODUCT_VALIDATION_FAILED",
            platform: PLATFORM_NAME,
            validation_errors: validationErrors,
            action_required: "remove_out_of_stock_items_or_reduce_quantity",
            statusCode: 400,
          });
        }

        logger.info(
          {
            platform: PLATFORM_NAME,
            totalProducts: requestBody.order.length,
            allProductsValidated: true,
          },
          "All products passed validation (Product + PlatformStock) - proceeding with payment"
        );

        // STEP 3: Lock stock for order (for BOTH phonepe and cod modes)
        // This prevents race conditions where multiple users try to buy same product
        logger.info(
          {
            platform: PLATFORM_NAME,
            totalProducts: requestBody.order.length,
            mode: requestBody.mode,
          },
          "Starting stock locking for order items"
        );

        const lockResults: Array<{
          productId: number;
          productName: string;
          quantity: number;
          oldAvailableQty: number;
          newAvailableQty: number;
          oldLockQty: number;
          newLockQty: number;
          success: boolean;
        }> = [];

        const lockErrors: Array<{
          productId: number;
          productName: string;
          error: string;
        }> = [];

        try {
          // Use transaction to ensure all locks are atomic
          await prisma.$transaction(async (tx) => {
            for (const orderItem of requestBody.order) {
              try {
                const productId = orderItem.productid;
                const requestedQuantity = orderItem.quantity;

                // ========================================
                // STEP 1: CHECK IF PRODUCT IS COMBO
                // ========================================
                const product = await tx.product.findUnique({
                  where: { id: BigInt(productId) },
                  select: {
                    id: true,
                    name: true,
                    iscombo: true,
                  },
                });

                if (!product) {
                  throw new Error(
                    `Product ${productId} not found (should have been caught in validation)`
                  );
                }

                // ========================================
                // STEP 2: BRANCH - COMBO OR SINGLE PRODUCT
                // ========================================
                if (product.iscombo) {
                  // ✅ COMBO PRODUCT: Lock all components
                  logger.info(
                    {
                      productId,
                      productName: product.name,
                      quantity: requestedQuantity,
                      productType: "combo",
                    },
                    "Detected combo product - locking component stock"
                  );

                  const comboLockResults = await this.lockComboComponents(
                    tx,
                    productId,
                    requestedQuantity,
                    orderItem
                  );

                  // Add combo lock results to response
                  lockResults.push({
                    productId,
                    productName: product.name,
                    quantity: requestedQuantity,
                    productType: "combo",
                    componentsLocked: comboLockResults.length,
                    componentDetails: comboLockResults,
                    success: true,
                    oldAvailableQty: 0, // Not applicable for combo
                    newAvailableQty: 0, // Not applicable for combo
                    oldLockQty: 0, // Not applicable for combo
                    newLockQty: 0, // Not applicable for combo
                  } as any);

                  logger.info(
                    {
                      productId,
                      productName: product.name,
                      quantity: requestedQuantity,
                      componentsLocked: comboLockResults.length,
                    },
                    "Combo product components locked successfully"
                  );
                } else {
                  // ✅ SINGLE PRODUCT: Existing logic
                  logger.info(
                    {
                      productId,
                      productName: product.name,
                      quantity: requestedQuantity,
                      productType: "single",
                    },
                    "Detected single product - locking product stock"
                  );

                  // ========================================
                  // FIX: Use SELECT FOR UPDATE to acquire row lock
                  // ========================================
                  // This prevents concurrent transactions from reading stale data
                  // Ensures that only one transaction can lock stock at a time
                  // Second transaction will wait and read fresh data after first commits

                  const platformStockResult = await tx.$queryRaw<Array<{
                    id: bigint;
                    productid: bigint;
                    platform: string;
                    availableqty: number;
                    lockqty: number;
                    orderedqty: number;
                    platformstatus: string | null;
                    modifieddate: bigint;
                  }>>`
                    SELECT * FROM "platformstock"
                    WHERE "productid" = ${BigInt(productId)}
                      AND "platform" = ${PLATFORM_NAME}
                    FOR UPDATE
                  `;

                  if (!platformStockResult || platformStockResult.length === 0) {
                    throw new Error(
                      `PlatformStock not found for product ${productId} (should have been caught in validation)`
                    );
                  }

                  const platformStock = platformStockResult[0];

                  if (!platformStock) {
                    throw new Error(
                      `PlatformStock data is empty for product ${productId}`
                    );
                  }

                  // Convert to numbers for calculations (raw query returns numbers)
                  const currentAvailableQty = Number(platformStock.availableqty) || 0;
                  const currentLockQty = Number(platformStock.lockqty) || 0;
                  // availableqty already represents available stock, so check it directly
                  const actualAvailable = currentAvailableQty;

                  logger.info(
                    {
                      productId,
                      productName: product.name,
                      platform: PLATFORM_NAME,
                      currentAvailableQty,
                      currentLockQty,
                      actualAvailable,
                      requestedQuantity,
                      lockAcquired: true, // ← Important: Row lock acquired
                    },
                    "Row lock acquired for platformStock - reading fresh data"
                  );

                  // Double-check availability (with FRESH data from row lock)
                  // Note: availableqty is the actual available stock, so we check it directly
                  if (actualAvailable < requestedQuantity) {
                    logger.error(
                      {
                        productId,
                        productName: product.name,
                        platform: PLATFORM_NAME,
                        actualAvailable,
                        requestedQuantity,
                        shortage: requestedQuantity - actualAvailable,
                      },
                      "Insufficient stock during locking WITH row lock - another transaction consumed stock"
                    );

                    throw new Error(
                      `Insufficient stock during locking: Available ${actualAvailable}, Requested ${requestedQuantity}`
                    );
                  }

                  // Calculate new quantities
                  const newAvailableQty = currentAvailableQty - requestedQuantity;
                  const newLockQty = currentLockQty + requestedQuantity;

                  // Update platformstock - lock the quantity
                  await tx.platformStock.update({
                    where: {
                      productid_platform: {
                        productid: BigInt(productId),
                        platform: PLATFORM_NAME,
                      },
                    },
                    data: {
                      availableqty: newAvailableQty,
                      lockqty: newLockQty,
                      modifieddate: BigInt(Date.now()),
                    },
                  });

                  lockResults.push({
                    productId,
                    productName: product.name,
                    quantity: requestedQuantity,
                    productType: "single",
                    oldAvailableQty: currentAvailableQty,
                    newAvailableQty: newAvailableQty,
                    oldLockQty: currentLockQty,
                    newLockQty: newLockQty,
                    success: true,
                  } as any);

                  logger.info(
                    {
                      productId,
                      productName: product.name,
                      platform: PLATFORM_NAME,
                      requestedQuantity,
                      oldAvailableQty: currentAvailableQty,
                      newAvailableQty: newAvailableQty,
                      oldLockQty: currentLockQty,
                      newLockQty: newLockQty,
                    },
                    "Stock locked successfully for single product"
                  );
                }
              } catch (itemError: any) {
                // Enhanced error logging with product type context
                const errorContext = {
                  productId: orderItem.productid,
                  productName: orderItem.productname,
                  error: itemError.message,
                  errorCode: itemError.code || "STOCK_LOCKING_ERROR",
                };

                // Check if it's a combo product error
                if (itemError.code === "INSUFFICIENT_COMBO_STOCK") {
                  logger.error(
                    {
                      ...errorContext,
                      productType: "combo",
                      details: itemError.details,
                    },
                    "Failed to lock combo product component stock"
                  );

                  lockErrors.push({
                    productId: orderItem.productid,
                    productName: orderItem.productname,
                    error: itemError.message,
                    productType: "combo",
                    details: itemError.details,
                  } as any);
                } else {
                  logger.error(
                    errorContext,
                    "Failed to lock stock for product"
                  );

                  lockErrors.push({
                    productId: orderItem.productid,
                    productName: orderItem.productname,
                    error: itemError.message,
                  });
                }

                // Rollback transaction by throwing error
                throw itemError;
              }
            }
          });

          logger.info(
            {
              platform: PLATFORM_NAME,
              mode: requestBody.mode,
              totalProducts: requestBody.order.length,
              successfulLocks: lockResults.length,
              lockResults: lockResults,
            },
            "Stock locking completed successfully for all products"
          );
        } catch (lockError: any) {
          logger.error(
            {
              platform: PLATFORM_NAME,
              mode: requestBody.mode,
              error: lockError.message,
              lockErrors: lockErrors,
            },
            "Stock locking failed - rolling back all locks"
          );

          // Return error response - stock locking failed
          return reply.code(400).send({
            success: false,
            message: "Failed to lock stock for order",
            error_code: "STOCK_LOCKING_FAILED",
            platform: PLATFORM_NAME,
            errors: lockErrors,
            statusCode: 400,
          });
        }

        console.log(request.body, "request body");
        // Generate unique transaction ID for both modes
        const merchantTransactionId =
          PhonePeService.generateMerchantTransactionId();

        // ========================================
        // CREATE GCP CLOUD TASK FOR LOCK CLEANUP
        // ========================================
        // Schedule lock cleanup task for PhonePe mode
        // COD mode doesn't need cleanup as lock is converted immediately to order
        if (requestBody.mode === "phonepe" && lockResults.length > 0) {
          try {
            const { createLockCleanupTask } = await import(
              "../services/gcpTasks.service.js"
            );

            // Get delay from env (default: 120 seconds = 2 minutes)
            const cleanupDelaySeconds = parseInt(
              process.env.LOCK_CLEANUP_DELAY_SECONDS || "120"
            );

            const taskResult = await createLockCleanupTask(
              merchantTransactionId,
              cleanupDelaySeconds
            );

            if (taskResult.success) {
              logger.info(
                {
                  merchantTransactionId,
                  taskName: taskResult.taskName,
                  delaySeconds: cleanupDelaySeconds,
                  scheduledTime: new Date(
                    Date.now() + cleanupDelaySeconds * 1000
                  ).toISOString(),
                },
                "GCP Cloud Task created successfully for lock cleanup"
              );
            } else {
              logger.warn(
                {
                  merchantTransactionId,
                  error: taskResult.error,
                  delaySeconds: cleanupDelaySeconds,
                },
                "Failed to create GCP Cloud Task for lock cleanup (non-critical)"
              );
            }
          } catch (taskError: any) {
            // Log but don't fail the request - lock cleanup is a safety mechanism
            logger.warn(
              {
                merchantTransactionId,
                error: taskError.message,
                stack: taskError.stack,
              },
              "Error creating GCP Cloud Task for lock cleanup (non-critical)"
            );
          }
        } else if (requestBody.mode === "cod") {
          logger.info(
            {
              merchantTransactionId,
              mode: "cod",
            },
            "Skipping GCP Cloud Task creation - COD mode converts locks immediately"
          );
        }

        let result: any;
        let paymentRequest: any;

        if (requestBody.mode === "phonepe") {
          // Create PhonePe payment request
          paymentRequest = {
            merchantTransactionId,
            amount: requestBody.transaction.amount,
            name: requestBody.transaction.name,
            mobileNumber: requestBody.transaction.mobilenumber,
            userId: requestBody.transaction.userId,
            productIds: requestBody.transaction.productid,
            transactionFor: requestBody.transaction.transactionfor,
          };

          logger.info(
            {
              merchantTransactionId: paymentRequest.merchantTransactionId,
              amount: paymentRequest.amount,
              userId: paymentRequest.userId,
              productIds: paymentRequest.productIds,
            },
            "Converted payload to PhonePe payment request"
          );

          // Call PhonePe service for online payment
          result = await this.phonePeService.initiatePayment(paymentRequest);
          console.log(result, "for  phone pe");
        } else if (requestBody.mode === "cod") {
          // For COD, create a mock successful result
          paymentRequest = {
            merchantTransactionId,
            amount: requestBody.transaction.amount,
            name: requestBody.transaction.name,
            mobileNumber: requestBody.transaction.mobilenumber,
            userId: requestBody.transaction.userId,
            productIds: requestBody.transaction.productid,
            transactionFor: requestBody.transaction.transactionfor,
          };

          logger.info(
            {
              merchantTransactionId: paymentRequest.merchantTransactionId,
              amount: paymentRequest.amount,
              userId: paymentRequest.userId,
              productIds: paymentRequest.productIds,
            },
            "COD payment request created"
          );

          // Mock successful result for COD
          result = {
            success: true,
            message: "COD order created successfully",
            redirectUrl: null, // No redirect for COD
            transactionId: merchantTransactionId,
          };
        } else {
          throw new Error(`Invalid payment mode: ${requestBody.mode}`);
        }

        if (result.success) {
          // Store the complete payload in transaction data for later use in order creation
          const transactionData = {
            status:
              requestBody.mode === "phonepe"
                ? "INITIATED"
                : "COD_ORDER_CREATED",
            mode: requestBody.mode,
            evaluation_ids: validEvaluations, // Only use valid evaluations
            invalid_evaluations: invalidEvaluations, // Track invalid ones for user info
            limit_reached_evaluations: limitReachedEvaluations, // Track limit-reached promotions
            originalPayload: requestBody,
            paymentRequest: paymentRequest,
            initiatedAt: new Date().toISOString(),
            phonePeResponses:
              requestBody.mode === "phonepe"
                ? {
                  initiation: {
                    timestamp: new Date().toISOString(),
                    response: result,
                    status: "INITIATED",
                    redirectUrl: result.redirectUrl,
                  },
                }
                : null,
            codData:
              requestBody.mode === "cod"
                ? {
                  timestamp: new Date().toISOString(),
                  status: "COD_ORDER_CREATED",
                  message: "Cash on Delivery order created successfully",
                }
                : null,
          };

          console.log(transactionData, "transactionData");
          // Store transaction with complete data (single transaction record) - includes status column
          // For PhonePe: INITIATED, For COD: COD_INITIATED
          const initialStatus =
            requestBody.mode === "cod" ? "COD_INITIATED" : "INITIATED";
          await this.storeTransactionDataWithStatus(
            paymentRequest,
            transactionData,
            initialStatus
          );

          // For COD, create order and orderlines immediately
          let orderData: any = null;
          if (requestBody.mode === "cod") {
            try {
              logger.info(
                {
                  merchantTransactionId: paymentRequest.merchantTransactionId,
                  mode: "cod",
                },
                "Creating COD order and orderlines immediately"
              );

              // Create order and orderlines for COD
              // Force mode to "cod" since this is COD order
              orderData = await this.createOrderAfterPayment(
                paymentRequest.merchantTransactionId,
                "cod",
                evaluationsToProcess
              );

              logger.info(
                {
                  merchantTransactionId: paymentRequest.merchantTransactionId,
                  orderId: orderData?.id,
                  mode: "cod",
                },
                "COD order and orderlines created successfully"
              );

              // Update transaction status to COD_SUCCESS after successful order creation
              try {
                const transactions = await this.transactionService.findMany(
                  {
                    merchanttransactionid: paymentRequest.merchantTransactionId,
                  },
                  1,
                  1
                );

                if (transactions.data && transactions.data.length > 0) {
                  const transaction = transactions.data[0];
                  const transactionId =
                    typeof transaction.id === "bigint"
                      ? transaction.id.toString()
                      : String(transaction.id);

                  await this.transactionService.update(transactionId, {
                    status: "COD_SUCCESS", // Update status to success
                    modifieddate: Date.now(),
                  });

                  logger.info(
                    {
                      merchantTransactionId:
                        paymentRequest.merchantTransactionId,
                      transactionId,
                      status: "COD_SUCCESS",
                    },
                    "Transaction status updated to COD_SUCCESS"
                  );
                }
              } catch (statusUpdateError: any) {
                logger.warn(
                  {
                    error: statusUpdateError.message,
                    merchantTransactionId: paymentRequest.merchantTransactionId,
                  },
                  "Failed to update transaction status to COD_SUCCESS (non-critical)"
                );
              }

              // Update product quantities after successful order creation
              if (
                orderData &&
                requestBody.order &&
                Array.isArray(requestBody.order)
              ) {
                try {
                  logger.info(
                    {
                      merchantTransactionId:
                        paymentRequest.merchantTransactionId,
                      orderId: orderData.id,
                      mode: "cod",
                      orderItemsCount: requestBody.order.length,
                      orderItems: requestBody.order.map((item) => ({
                        productid: item.productid,
                        quantity: item.quantity,
                        productname: item.productname,
                      })),
                    },
                    "Starting product quantity updates for COD order"
                  );

                  const quantityUpdateResult =
                    await this.updateProductQuantitiesAfterOrder(
                      orderData,
                      requestBody.order,
                      "cod"
                    );

                  logger.info(
                    {
                      merchantTransactionId:
                        paymentRequest.merchantTransactionId,
                      orderId: orderData.id,
                      mode: "cod",
                      quantityUpdateResult,
                    },
                    "Product quantity updates completed for COD order"
                  );

                  // If quantity update failed, log it as a warning but don't fail the order
                  if (!quantityUpdateResult.success) {
                    logger.warn(
                      {
                        merchantTransactionId:
                          paymentRequest.merchantTransactionId,
                        orderId: orderData.id,
                        mode: "cod",
                        quantityUpdateResult,
                      },
                      "Product quantity update failed for COD order - order was still created successfully"
                    );
                  }
                } catch (quantityUpdateError: any) {
                  logger.error(
                    {
                      error: quantityUpdateError.message,
                      stack: quantityUpdateError.stack,
                      merchantTransactionId:
                        paymentRequest.merchantTransactionId,
                      orderId: orderData.id,
                      mode: "cod",
                      orderItems: requestBody.order,
                    },
                    "Error updating product quantities for COD order"
                  );

                  // Don't fail the order creation if quantity update fails
                  // The order is already created successfully
                }
              } else {
                logger.warn(
                  {
                    merchantTransactionId: paymentRequest.merchantTransactionId,
                    orderId: orderData?.id,
                    mode: "cod",
                    hasOrderData: !!orderData,
                    hasRequestBodyOrder: !!requestBody.order,
                    isRequestBodyOrderArray: Array.isArray(requestBody.order),
                    requestBodyOrderLength: requestBody.order?.length,
                  },
                  "Cannot update product quantities - missing or invalid order data"
                );
              }
            } catch (orderError: any) {
              logger.error(
                {
                  error: orderError.message,
                  merchantTransactionId: paymentRequest.merchantTransactionId,
                  mode: "cod",
                },
                "Error creating COD order and orderlines"
              );

              // Even if order creation fails, we still return success for transaction
              // The order can be created later using the stored transaction data
            }
          }

          // Prepare response message based on evaluation status
          let responseMessage =
            requestBody.mode === "phonepe"
              ? "Payment initiated successfully"
              : "COD order created successfully";
          let userMessage =
            requestBody.mode === "phonepe"
              ? "Redirect to PhonePe for payment"
              : "Order created for cash on delivery";

          // Add information about limit-reached promotions
          if (limitReachedEvaluations.length > 0) {
            const limitReachedCount = limitReachedEvaluations.length;
            responseMessage += ` (${limitReachedCount} promotion(s) reached usage limit and were not applied)`;
            userMessage += ` Note: ${limitReachedCount} promotion(s) reached usage limit. Please apply another coupon for discount.`;
          }

          // Add information about other invalid evaluations
          if (invalidEvaluations.length > limitReachedEvaluations.length) {
            const otherInvalid = invalidEvaluations.filter(
              (e) => e.type !== "limit_reached"
            );
            if (otherInvalid.length > 0) {
              userMessage += ` Some promotions could not be applied due to other restrictions.`;
            }
          }

          const response = createSuccessResponse(responseMessage, {
            // Transaction & Payment Info
            merchantTransactionId: result.transactionId,
            redirectUrl: result.redirectUrl,
            amount: paymentRequest.amount,
            status:
              requestBody.mode === "phonepe"
                ? "INITIATED"
                : "COD_ORDER_CREATED",
            mode: requestBody.mode,
            message: userMessage,

            // Validation Summary
            validation_summary: {
              promotions_validated: evaluationsToProcess.length,
              products_validated: requestBody.order.length,
              stock_validated: requestBody.order.length,
              all_validations_passed: true,
            },

            // Promotion Status
            promotion_status: {
              valid_evaluations: validEvaluations,
              limit_reached_evaluations: limitReachedEvaluations,
              action_required:
                limitReachedEvaluations.length > 0
                  ? "apply_another_coupon"
                  : null,
              invalid_evaluations: invalidEvaluations,
              total_applied: validEvaluations.length,
              total_attempted: evaluationsToProcess.length,
            },

            // Stock Locking Summary
            stock_locking: {
              platform: PLATFORM_NAME,
              total_products_locked: lockResults.length,
              lock_status: "success",
              products: lockResults.map((lock) => ({
                productId: lock.productId,
                productName: lock.productName,
                quantity_locked: lock.quantity,
                before: {
                  availableqty: lock.oldAvailableQty,
                  lockqty: lock.oldLockQty,
                },
                after: {
                  availableqty: lock.newAvailableQty,
                  lockqty: lock.newLockQty,
                },
                note: "Stock locked and reserved for this order",
              })),
              message: `${lockResults.length} product(s) locked successfully for ${requestBody.mode} order`,
            },

            // Order Data (COD only)
            orderData:
              requestBody.mode === "cod"
                ? {
                  orderId: orderData?.id,
                  orderid: orderData?.orderid,
                  status: orderData?.orderstatus,
                  created_at: orderData?.createddate,
                  order_created: true,
                }
                : null,

            // Next Steps for Frontend
            next_steps: {
              phonepe:
                requestBody.mode === "phonepe"
                  ? {
                    action: "redirect_to_payment",
                    redirectUrl: result.redirectUrl,
                    instructions: "Redirect user to PhonePe payment page",
                    stock_status: "locked_until_payment_complete",
                    lock_duration: "Until payment success/failure",
                  }
                  : null,
              cod:
                requestBody.mode === "cod"
                  ? {
                    action: "show_order_confirmation",
                    order_id: orderData?.id,
                    instructions: "Show order confirmation to user",
                    stock_status: "converted_to_order",
                    lockqty_status: "reset_to_0",
                  }
                  : null,
            },
          });
          console.log(response, "response FInal ");
          return reply.code(200).send(response);
        } else {
          const errorResponse = createErrorResponse(
            result.message ||
            `${requestBody.mode === "phonepe" ? "Payment" : "COD order"} ${requestBody.mode === "phonepe" ? "initiation" : "creation"
            } failed`,
            result.error,
            400
          );
          return reply.code(400).send(errorResponse);
        }
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            stack: error.stack,
            body: request.body,
          },
          "Error in payment initiation"
        );

        if (error instanceof ValidationError) {
          const response = createErrorResponse(
            error.message,
            error.details,
            400
          );
          return reply.code(400).send(response);
        }

        const response = createErrorResponse(
          "Payment initiation failed",
          "An unexpected error occurred while initiating payment",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Handle payment callback from PhonePe
   */
  handlePaymentCallback = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { merchantTransactionId: string };
        Querystring: { token?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { merchantTransactionId } = request.params;
        const { token } = request.query;
        console.log("inside Payment Confirmaion ");
        logger.info(
          {
            merchantTransactionId,
            hasToken: !!token,
            method: request.method,
            headers: request.headers,
          },
          "Payment callback received"
        );

        logger.info(
          {
            merchantTransactionId,
            step: "callback_method_started",
          },
          "DEBUG: Callback method started - about to call PhonePe service"
        );

        const result = await this.phonePeService.handlePaymentCallback(
          merchantTransactionId,
          token
        );

        // If payment is successful, create order and orderlines
        if (result.success) {
          try {
            logger.info(
              {
                merchantTransactionId,
                redirectUrl: result.redirectUrl,
                mode: "phonepe",
              },
              "Payment successful, creating order and orderlines with mode: phonepe"
            );

            logger.info(
              {
                merchantTransactionId,
                step: "about_to_retrieve_evaluation_ids",
              },
              "DEBUG: About to retrieve evaluation IDs from transaction data"
            );

            // Get evaluation IDs from transaction data for promotion redemption
            const transactions = await this.transactionService.findMany(
              { merchanttransactionid: merchantTransactionId },
              1,
              1
            );

            let evaluationIds: string[] = [];
            logger.info(
              {
                merchantTransactionId,
                transactionDataLength: transactions.data
                  ? transactions.data.length
                  : 0,
                hasTransactionData: !!(
                  transactions.data && transactions.data.length > 0
                ),
              },
              "DEBUG: Transaction data retrieval result"
            );

            if (transactions.data && transactions.data.length > 0) {
              const transaction = transactions.data[0];
              evaluationIds = transaction.transactiondata?.evaluation_ids || [];

              logger.info(
                {
                  merchantTransactionId,
                  evaluationIds,
                  evaluationCount: evaluationIds.length,
                  rawTransactionData: transaction.transactiondata
                    ? Object.keys(transaction.transactiondata)
                    : null,
                },
                "Retrieved evaluation IDs from transaction for promotion redemption"
              );
            } else {
              logger.warn(
                {
                  merchantTransactionId,
                  transactionDataLength: transactions.data
                    ? transactions.data.length
                    : 0,
                },
                "DEBUG: No transaction data found - evaluation IDs cannot be retrieved"
              );
            }

            // Create order and orderlines for successful PhonePe payment
            // Force mode to "phonepe" since this is PhonePe callback
            const orderData = await this.createOrderAfterPayment(
              merchantTransactionId,
              "phonepe",
              evaluationIds
            );

            logger.info(
              {
                merchantTransactionId,
                orderId: orderData?.id,
                orderid: orderData?.orderid,
                mode: "phonepe",
              },
              "Order and orderlines created successfully for PhonePe payment"
            );

            // Update product quantities after successful order creation for PhonePe
            try {
              // Get the original order data from transaction
              const transactions = await this.transactionService.findMany(
                { merchanttransactionid: merchantTransactionId },
                1,
                1
              );

              if (transactions.data && transactions.data.length > 0) {
                const transaction = transactions.data[0];
                const originalOrderItems =
                  transaction.transactiondata?.originalPayload?.order || [];

                if (originalOrderItems.length > 0) {
                  logger.info(
                    {
                      merchantTransactionId,
                      orderId: orderData.id,
                      mode: "phonepe",
                    },
                    "Starting product quantity updates for PhonePe order"
                  );

                  const quantityUpdateResult =
                    await this.updateProductQuantitiesAfterOrder(
                      orderData,
                      originalOrderItems,
                      "phonepe"
                    );

                  logger.info(
                    {
                      merchantTransactionId,
                      orderId: orderData.id,
                      mode: "phonepe",
                      quantityUpdateResult,
                    },
                    "Product quantity updates completed for PhonePe order"
                  );
                }
              }
            } catch (quantityUpdateError: any) {
              logger.error(
                {
                  error: quantityUpdateError.message,
                  merchantTransactionId,
                  orderId: orderData?.id,
                  mode: "phonepe",
                },
                "Error updating product quantities for PhonePe order"
              );

              // Don't fail the order creation if quantity update fails
              // The order is already created successfully
            }
          } catch (orderError: any) {
            logger.error(
              {
                error: orderError.message,
                merchantTransactionId,
                mode: "phonepe",
              },
              "Error creating order after PhonePe payment success"
            );

            // Even if order creation fails, we still redirect to success page
            // The order can be created later using the stored transaction data
          }
        } else {
          logger.warn(
            {
              merchantTransactionId,
              message: result.message,
              redirectUrl: result.redirectUrl,
            },
            "Payment failed, redirecting to failure page"
          );
        }

        // Perform redirect
        return reply.redirect(result.redirectUrl);
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            merchantTransactionId: request.params?.merchantTransactionId,
          },
          "Error in payment callback"
        );

        // Redirect to failure page on error
        const failureUrl =
          process.env.REDIRECT_URL_FAILURE ||
          "com.Nivaana.app://profile/orders";
        return reply.redirect(failureUrl);
      }
    }
  );

  /**
   * Check payment status
   */
  checkPaymentStatus = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { merchantTransactionId: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { merchantTransactionId } = request.params;

        logger.info(
          { merchantTransactionId },
          "Payment status check requested"
        );

        const paymentStatus = await this.phonePeService.checkPaymentStatus(
          merchantTransactionId
        );

        const response = createSuccessResponse(
          "Payment status retrieved successfully",
          {
            merchantTransactionId,
            status: paymentStatus.code,
            success: paymentStatus.success,
            message: paymentStatus.message,
            paymentData: paymentStatus.data,
          }
        );

        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            merchantTransactionId: request.params?.merchantTransactionId,
          },
          "Error checking payment status"
        );

        if (error instanceof DatabaseError) {
          const response = createErrorResponse(
            error.message,
            error.details,
            error.statusCode
          );
          return reply.code(error.statusCode).send(response);
        }

        const response = createErrorResponse(
          "Failed to check payment status",
          "An error occurred while checking payment status",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Process refund
   */
  processRefund = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { merchantTransactionId: string };
        Body: { refundAmount?: number; reason?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { merchantTransactionId } = request.params;
        const { refundAmount, reason } = request.body as {
          refundAmount?: number;
          reason?: string;
        };

        logger.info(
          {
            merchantTransactionId,
            refundAmount,
            reason,
          },
          "Refund request received"
        );

        const result = await this.phonePeService.refundPayment(
          merchantTransactionId,
          refundAmount,
          reason
        );

        if (result.success) {
          const response = createSuccessResponse(
            "Refund initiated successfully",
            {
              merchantTransactionId,
              refundId: result.refundId,
              refundAmount,
              reason,
              status: "REFUND_INITIATED",
            }
          );
          return reply.code(200).send(response);
        } else {
          const errorResponse = createErrorResponse(
            result.message || "Refund initiation failed",
            undefined,
            400
          );
          return reply.code(400).send(errorResponse);
        }
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            merchantTransactionId: request.params?.merchantTransactionId,
          },
          "Error processing refund"
        );

        if (error instanceof ValidationError) {
          const response = createErrorResponse(
            error.message,
            error.details,
            400
          );
          return reply.code(400).send(response);
        }

        const response = createErrorResponse(
          "Refund processing failed",
          "An unexpected error occurred while processing refund",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Get user transaction history
   */
  getUserTransactionHistory = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { userId: string };
        Querystring: { page?: string; limit?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = parseInt(request.params.userId);
        const page = parseInt(request.query.page || "1");
        const limit = parseInt(request.query.limit || "10");

        if (isNaN(userId)) {
          const response = createErrorResponse(
            "Invalid user ID",
            "User ID must be a valid number",
            400
          );
          return reply.code(400).send(response);
        }

        logger.debug(
          { userId, page, limit },
          "User transaction history requested"
        );

        const result = await this.phonePeService.getUserTransactionHistory(
          userId,
          page,
          limit
        );

        return reply.code(200).send({
          ...result,
          meta: {
            userId,
            page,
            limit,
          },
        });
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            userId: request.params?.userId,
          },
          "Error getting user transaction history"
        );

        if (error instanceof DatabaseError) {
          const response = createErrorResponse(
            error.message,
            error.details,
            error.statusCode
          );
          return reply.code(error.statusCode).send(response);
        }

        const response = createErrorResponse(
          "Failed to retrieve transaction history",
          "An error occurred while retrieving transaction history",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Get transaction statistics
   */
  getTransactionStats = asyncHandler(
    async (
      request: FastifyRequest<{
        Querystring: { userId?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const userIdParam = request.query.userId;
        const userId = userIdParam ? parseInt(userIdParam) : undefined;

        if (userIdParam && isNaN(userId!)) {
          const response = createErrorResponse(
            "Invalid user ID",
            "User ID must be a valid number",
            400
          );
          return reply.code(400).send(response);
        }

        logger.debug({ userId }, "Transaction statistics requested");

        const result = await this.phonePeService.getTransactionStats(userId);

        return reply.code(200).send({
          ...result,
          meta: {
            userId,
            generatedAt: new Date().toISOString(),
          },
        });
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            userId: request.query?.userId,
          },
          "Error getting transaction statistics"
        );

        if (error instanceof DatabaseError) {
          const response = createErrorResponse(
            error.message,
            error.details,
            error.statusCode
          );
          return reply.code(error.statusCode).send(response);
        }

        const response = createErrorResponse(
          "Failed to retrieve transaction statistics",
          "An error occurred while retrieving transaction statistics",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Generate merchant transaction ID
   */
  generateTransactionId = asyncHandler(
    async (
      request: FastifyRequest<{
        Querystring: { prefix?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const prefix = request.query.prefix || "TXN";
        const transactionId =
          PhonePeService.generateMerchantTransactionId(prefix);

        logger.debug(
          { prefix, transactionId },
          "Generated merchant transaction ID"
        );

        const response = createSuccessResponse(
          "Transaction ID generated successfully",
          {
            merchantTransactionId: transactionId,
            prefix,
            timestamp: Date.now(),
          }
        );

        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error(
          { error: error.message },
          "Error generating transaction ID"
        );

        const response = createErrorResponse(
          "Transaction ID generation failed",
          "An error occurred while generating transaction ID",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Manually update product quantities for an existing order
   * This is useful for fixing orders where quantity updates failed
   */
  updateOrderQuantities = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { orderId: Number };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { orderId } = request.params;

        logger.info({ orderId }, "Manual product quantity update requested");

        // Get order data
        const order = await this.ordersService.findById(orderId);
        if (!order) {
          const response = createErrorResponse(
            "Order not found",
            `Order with ID ${orderId} does not exist`,
            404
          );
          return reply.code(404).send(response);
        }

        // Get orderlines for this order
        const orderlines = await prisma.orderline.findMany({
          where: { orderid: Number(orderId) },
          select: {
            id: true,
            productid: true,
            quantity: true,
          },
        });

        if (orderlines.length === 0) {
          const response = createErrorResponse(
            "No orderlines found",
            `No orderlines found for order ${orderId}`,
            404
          );
          return reply.code(404).send(response);
        }

        // Convert orderlines to the format expected by updateProductQuantitiesAfterOrder
        const orderItems = orderlines.map((orderline: any) => ({
          productid: Number(orderline.productid),
          quantity: orderline.quantity || 1,
          productname: null, // We'll get the product name from the product table if needed
        }));

        // Update product quantities
        const quantityUpdateResult =
          await this.updateProductQuantitiesAfterOrder(
            order,
            orderItems,
            order.mode || "unknown"
          );

        const response = createSuccessResponse(
          "Product quantities updated successfully",
          {
            orderId: orderId,
            orderlines: orderlines.length,
            quantityUpdateResult,
          }
        );

        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            orderId: request.params?.orderId,
          },
          "Error in manual product quantity update"
        );

        const response = createErrorResponse(
          "Failed to update product quantities",
          "An error occurred while updating product quantities",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Health check for PhonePe service
   */
  healthCheck = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const healthData = {
          service: "PhonePe Payment Gateway",
          status: "healthy",
          timestamp: new Date().toISOString(),
          version: "1.0.0",
          environment: process.env.NODE_ENV || "development",
          configuration: {
            merchantId: process.env.PHONEPE_MERCHANT_ID
              ? "configured"
              : "not configured",
            saltKey: process.env.PHONEPE_SALT_KEY
              ? "configured"
              : "not configured",
            baseUrl: process.env.PHONEPE_BASE_URL || "default (sandbox)",
            redirectUrls: {
              success: process.env.REDIRECT_URL_SUCCESS || "default",
              failure: process.env.REDIRECT_URL_FAILURE || "default",
              status: process.env.REDIRECT_URL_PAYMENT_STATUS || "default",
            },
          },
        };

        const response = createSuccessResponse(
          "PhonePe service is healthy",
          healthData
        );
        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error({ error: error.message }, "Error in PhonePe health check");

        const response = createErrorResponse(
          "PhonePe service health check failed",
          "An error occurred during health check",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Update transaction status in database
   */
  async updateTransactionStatus(
    transactionId: string,
    status: string,
    paymentData: any
  ) {
    try {
      logger.info({ transactionId, status }, "Updating transaction status");

      // Find transaction by merchanttransactionid
      const transactions = await this.transactionService.findMany(
        { merchanttransactionid: transactionId },
        1,
        1
      );

      if (!transactions.data || transactions.data.length === 0) {
        throw new Error(
          `Transaction not found with merchanttransactionid: ${transactionId}`
        );
      }

      const transaction = transactions.data[0];

      // Get existing transaction data or create new structure
      const existingTransactionData = transaction.transactiondata || {};

      // Ensure phonePeResponses object exists
      if (!existingTransactionData.phonePeResponses) {
        existingTransactionData.phonePeResponses = {};
      }

      // Add the new status response
      const statusKey = status.toLowerCase();
      existingTransactionData.phonePeResponses[statusKey] = {
        timestamp: new Date().toISOString(),
        response: paymentData,
        status: status,
      };

      // Update the main status fields for backward compatibility
      existingTransactionData.status = status;
      existingTransactionData.paymentCompleteAt = new Date().toISOString();
      existingTransactionData.updatedAt = new Date().toISOString();

      // If there's an error, store it in the phonePeResponse field for backward compatibility
      if (status === "ERROR" || status === "FAILED") {
        existingTransactionData.phonePeResponse = {
          error: paymentData.error || paymentData.message || "Payment failed",
        };
      } else {
        existingTransactionData.phonePeResponse = paymentData;
      }

      // Update transaction data with enhanced structure
      // Map PhonePe status to our status values
      let mappedStatus = status;
      if (status === "PAYMENT_SUCCESS") {
        mappedStatus = "SUCCESS";
      } else if (status === "PAYMENT_ERROR" || status === "PAYMENT_FAILED") {
        mappedStatus = "FAILED";
      }

      const updateData = {
        status: mappedStatus, // NEW: Update dedicated status column
        transactiondata: existingTransactionData,
        modifieddate: Date.now(),
      };

      // Use TransactionService to update transaction by database ID
      const result = await this.transactionService.update(
        transaction.id.toString(),
        updateData
      );
      logger.info(
        {
          transactionId,
          status,
          statusKey,
          hasExistingData: !!transaction.transactiondata,
          responseCount: Object.keys(existingTransactionData.phonePeResponses)
            .length,
        },
        "Transaction status updated successfully with enhanced data structure"
      );

      return result;
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          transactionId,
          status,
        },
        "Error updating transaction status"
      );
      throw error;
    }
  }

  /**
   * Create order and orderline records after successful payment
   */
  async createOrderAfterPayment(
    transactionId: string,
    forceMode?: string,
    evaluationIds?: string[]
  ) {
    try {
      logger.info(
        { transactionId, evaluationIds },
        "Creating order after successful payment"
      );
      logger.info({ forceMode }, "forceMode createOrderAfterPayment");
      // Find transaction by merchanttransactionid
      const transactions = await this.transactionService.findMany(
        { merchanttransactionid: transactionId },
        1,
        1
      );

      if (!transactions.data || transactions.data.length === 0) {
        throw new Error(
          `Transaction not found with merchanttransactionid: ${transactionId}`
        );
      }

      const transaction = transactions.data[0];
      logger.info(
        {
          transactionId,
          mode: transaction.transactiondata?.mode || "unknown",
          foundTransaction: {
            id: transaction.id,
            userid: transaction.userid,
            productid: transaction.productid,
            amount: transaction.amount,
          },
        },
        "Transaction found for order creation"
      );

      // Validate products BEFORE creating order
      if (
        !transaction.productid ||
        !Array.isArray(transaction.productid) ||
        transaction.productid.length === 0
      ) {
        logger.warn(
          {
            transactionId,
            productid: transaction.productid,
          },
          "No product IDs found in transaction, cannot create order"
        );
        throw new Error(
          "No product IDs found in transaction - cannot create order"
        );
      }

      // Validate all products at once using Prisma
      const validProducts = await this.validateProductsBatch(
        transaction.productid
      );
      const validProductIds = validProducts.map((p) => p.id);
      const invalidProductIds = transaction.productid.filter(
        (id: number) => !validProductIds.includes(id)
      );

      logger.info(
        {
          transactionId,
          totalProducts: transaction.productid.length,
          validProductIds,
          invalidProductIds,
          validCount: validProductIds.length,
          invalidCount: invalidProductIds.length,
        },
        "Product validation completed before order creation"
      );

      // Prevent order creation if no valid products exist
      if (validProductIds.length === 0) {
        const errorMsg = `Cannot create order - no valid products found. Invalid product IDs: ${JSON.stringify(
          invalidProductIds
        )}`;
        logger.error(
          {
            transactionId,
            invalidProductIds,
            totalRequested: transaction.productid.length,
          },
          errorMsg
        );
        throw new Error(errorMsg);
      }

      // Log warnings for invalid products but continue with valid ones
      if (invalidProductIds.length > 0) {
        logger.warn(
          {
            transactionId,
            invalidProductIds,
            validProductIds,
            message:
              "Some products are invalid but order will be created with valid products only",
          },
          "Invalid products detected - will skip these during orderline creation"
        );
      }

      const currentTime = Date.now();
      const orderid = `ORDER_${transactionId}_${currentTime}`;

      // Get mode from transaction data or use forced mode
      const mode = forceMode || transaction.transactiondata?.mode || "unknown";

      logger.info(
        {
          transactionId,
          forceMode,
          originalMode: transaction.transactiondata?.mode,
          finalMode: mode,
        },
        "Mode determination for order creation"
      );

      // Get original order data from transaction for detailed orderline creation
      const originalOrderData =
        transaction.transactiondata?.originalPayload?.order || [];

      // Calculate total quantity from order items (BUG FIX #1)
      const filteredOrderData = originalOrderData.filter((item: any) =>
        validProductIds.includes(item.productid)
      );
      const totalQuantity = filteredOrderData.reduce(
        (sum: number, item: any) => sum + parseInt(item.quantity?.toString() || "1"),
        0
      );

      // Extract addressid from the first order item (BUG FIX: addressid was null in orders table)
      // All items in an order typically go to the same address
      const orderAddressId = filteredOrderData.length > 0
        ? parseInt(filteredOrderData[0].addressid?.toString() || "0") || undefined
        : undefined;

      // Extract evaluation IDs from transaction data for primary evaluation
      const transactionEvaluationIds =
        transaction.transactiondata?.evaluation_ids || [];
      const primaryEvaluationId =
        evaluationIds?.[0] || transactionEvaluationIds?.[0] || null;

      // Initialize promotion-related values
      let evaluationData = null;
      let promotionDiscountTotal = 0;
      let originalTotal = 0;
      let productDiscountTotal = 0; // Add product discount total
      let shippingCost = 0;
      let taxAmount = 0;

      // Calculate original total and product discounts from cart items in original payload
      const cartItems =
        transaction.transactiondata?.originalPayload?.cartItems || [];

      // Calculate original total (base_price * quantity for all items)
      originalTotal = cartItems.reduce((total: number, item: any) => {
        const basePrice = parseFloat(item.base_price?.toString() || "0");
        const quantity = parseInt(item.quantity?.toString() || "1");
        return total + basePrice * quantity;
      }, 0);

      // Calculate product discount total using product_discount field from cart_data
      productDiscountTotal = cartItems.reduce((total: number, item: any) => {
        const productDiscount = parseFloat(
          item.product_discount?.toString() || "0"
        );
        const quantity = parseInt(item.quantity?.toString() || "1");
        const itemDiscount = productDiscount * quantity;
        return total + itemDiscount;
      }, 0);

      // If no cart items in originalPayload, calculate from order data
      // ✅ FIX: productamount in request is ORIGINAL price per unit (before discount)
      // discountamount in request is TOTAL discount for the line item
      if (originalTotal === 0 && originalOrderData.length > 0) {
        originalTotal = originalOrderData.reduce((total: number, item: any) => {
          const prodAmt = parseFloat(item.productamount?.toString() || "0");
          const qty = parseInt(item.quantity?.toString() || "1");
          // productamount is original price per-unit, so multiply by quantity to get total
          return total + (prodAmt * qty);
        }, 0);

        // ✅ FIX: Extract product discount from order data
        productDiscountTotal = originalOrderData.reduce((total: number, item: any) => {
          const disc = parseFloat(item.discountamount?.toString() || "0");
          // discountamount is already total for the line item
          return total + disc;
        }, 0);
      }

      // Get shipping and tax from original payload
      shippingCost = parseFloat(
        transaction.transactiondata?.originalPayload?.shippingCost?.toString() ||
        "0"
      );
      taxAmount = parseFloat(
        transaction.transactiondata?.originalPayload?.taxAmount?.toString() ||
        "0"
      );

      // If primary evaluation ID exists, fetch evaluation data for promotion discounts
      if (primaryEvaluationId) {
        try {
          const { PromotionEvaluationService } = await import(
            "../services/promotion-evaluation.service.js"
          );
          const evaluationService = new PromotionEvaluationService();
          evaluationData = await evaluationService.getEvaluation(
            primaryEvaluationId
          );

          if (evaluationData) {
            // Use cart_data from evaluation if available (more accurate)
            const evaluationCartData =
              (evaluationData.cart_data as any[]) || [];
            if (evaluationCartData.length > 0) {
              // Recalculate using evaluation's cart_data
              originalTotal = evaluationCartData.reduce(
                (total: number, item: any) => {
                  const basePrice = parseFloat(
                    item.base_price?.toString() || "0"
                  );
                  const quantity = parseInt(item.quantity?.toString() || "1");
                  return total + basePrice * quantity;
                },
                0
              );

              // Calculate product discount total using product_discount field from evaluation cart_data
              productDiscountTotal = evaluationCartData.reduce(
                (total: number, item: any) => {
                  const productDiscount = parseFloat(
                    item.product_discount?.toString() || "0"
                  );
                  const quantity = parseInt(item.quantity?.toString() || "1");
                  const itemDiscount = productDiscount * quantity;
                  return total + itemDiscount;
                },
                0
              );
            }

            // Calculate promotion discount total from applied promotions
            const appliedPromotions =
              (evaluationData.applied_promotions as any[]) || [];
            promotionDiscountTotal = appliedPromotions.reduce(
              (total: number, promo: any) => {
                return (
                  total + parseFloat(promo.discount_amount?.toString() || "0")
                );
              },
              0
            );

            logger.info(
              {
                transactionId,
                evaluationId: primaryEvaluationId,
                promotionDiscountTotal,
                productDiscountTotal,
                originalTotal: evaluationData.original_total,
                discountedTotal: evaluationData.discounted_total,
                cartItemsCount: cartItems.length,
                evaluationCartDataCount: evaluationCartData.length,
                evaluationCartData: evaluationCartData, // Log the cart data for debugging
              },
              "Evaluation data retrieved for order creation"
            );
          }
        } catch (error) {
          logger.warn(
            {
              transactionId,
              evaluationId: primaryEvaluationId,
              error: error instanceof Error ? error.message : "Unknown error",
            },
            "Failed to fetch evaluation data - continuing without promotion data"
          );
        }
      }

      // Calculate product amount (after product discounts, before promotion discounts)
      const productAmount = originalTotal - productDiscountTotal;

      // ============================================
      // BUGFIX: Enrich orderItems with per-line discount data
      // Issue: PHONEPE-ORDERLINE-001
      // Date: 2025-11-05
      // ============================================
      logger.info(
        {
          transactionId,
          hasEvaluationData: !!evaluationData,
          primaryEvaluationId,
          originalOrderDataCount: originalOrderData.length,
          validProductIdsCount: validProductIds.length,
          orderLevelTotals: {
            originalTotal,
            productDiscountTotal,
            promotionDiscountTotal,
            shippingCost
          },
          evaluationDataStructure: evaluationData ? {
            hasCartData: !!(evaluationData.cart_data),
            cartDataLength: (evaluationData.cart_data as any[])?.length || 0,
            hasAppliedPromotions: !!(evaluationData.applied_promotions),
            appliedPromotionsLength: (evaluationData.applied_promotions as any[])?.length || 0
          } : null
        },
        "Starting orderItems enrichment with per-line discount data"
      );

      const enrichedOrderItems = originalOrderData
        .filter((item: any) => validProductIds.includes(item.productid))
        .map((item: any, index: number) => {
          const productId = item.productid;
          const quantity = parseInt(item.quantity?.toString() || '1');
          const rawProductAmount = parseFloat(item.productamount?.toString() || '0');
          const rawDiscountAmount = parseFloat(item.discountamount?.toString() || '0');  // ✅ FIX: Extract discount from request

          // Initialize discount values
          let productDiscountAmount = 0;
          let promotionDiscountAmount = 0;
          // ⚠️ IMPORTANT: Determine if rawProductAmount is per-unit or total
          // Based on user's expected values, it appears productamount might be per-unit
          // We'll calculate originalPrice and orderamount correctly based on evaluationData availability
          let originalPrice = rawProductAmount; // Will be recalculated if evaluationData exists
          let itemProductAmount = rawProductAmount; // Will be recalculated based on whether it's per-unit or total

          logger.debug({
            transactionId,
            productId,
            index,
            quantity,
            hasEvaluationData: !!evaluationData,
            rawProductAmount,
            initialState: {
              productDiscountAmount,
              promotionDiscountAmount,
              originalPrice,
              itemProductAmount
            }
          }, "Starting enrichment for product");

          // Try to get accurate data from evaluationData
          if (evaluationData) {
            // Get from evaluation cart_data (most accurate source)
            const evaluationCartData = (evaluationData.cart_data as any[]) || [];
            const cartItem = evaluationCartData.find(
              (ci: any) => parseInt(ci.product_id?.toString() || '0') === productId
            );

            if (cartItem) {
              const basePrice = parseFloat(cartItem.base_price?.toString() || '0');
              const productDiscount = parseFloat(cartItem.product_discount?.toString() || '0');

              // ✅ FIX: original_price is PER-UNIT (not multiplied by quantity)
              // This matches the master reference: original_price = base_price (per-unit)
              originalPrice = basePrice; // Per-unit price (stored as-is in orderline)

              // Calculate totals (multiply by quantity)
              productDiscountAmount = productDiscount * quantity; // Total discount for line item

              // ✅ FIX: Calculate itemProductAmount as total ((basePrice × quantity) - productDiscountAmount)
              // This ensures itemProductAmount is always the TOTAL for the line item, not per-unit
              itemProductAmount = (basePrice * quantity) - productDiscountAmount;

              logger.debug({
                transactionId,
                productId,
                basePrice,
                productDiscount,
                quantity,
                calculatedOriginalPrice: originalPrice,
                calculatedProductDiscount: productDiscountAmount,
                calculatedItemProductAmount: itemProductAmount,
                note: 'itemProductAmount is total for line item (includes quantity)'
              }, "Extracted product discount from evaluation cart_data");
            }

            // Get promotion discount from applied_promotions breakdown
            const appliedPromotions = (evaluationData.applied_promotions as any[]) || [];
            let foundPromotionBreakdown = false;

            for (const promo of appliedPromotions) {
              if (promo.breakdown && Array.isArray(promo.breakdown)) {
                const promoItem = promo.breakdown.find(
                  (b: any) => parseInt(b.product_id?.toString() || '0') === productId
                );
                if (promoItem) {
                  const itemPromoDiscount = parseFloat(promoItem.total_discount?.toString() || '0');
                  promotionDiscountAmount += itemPromoDiscount;
                  foundPromotionBreakdown = true;

                  logger.debug({
                    transactionId,
                    productId,
                    promotionId: promo.promotion_id,
                    promotionDiscount: itemPromoDiscount,
                    totalPromotionDiscount: promotionDiscountAmount
                  }, "Extracted promotion discount from applied_promotions breakdown");
                }
              }
            }


            // If no breakdown found but we have promotionDiscountTotal, use pro-rata distribution
            if (!foundPromotionBreakdown && promotionDiscountTotal > 0) {
              // Calculate total product amount across all items for pro-rata calculation
              // ⚠️ CRITICAL FIX: item.productamount from REQUEST is PER-UNIT, need to multiply by quantity
              const totalProductAmountForProRata = originalOrderData
                .filter((i: any) => validProductIds.includes(i.productid))
                .reduce((sum: number, i: any) => {
                  const prodAmt = parseFloat(i.productamount?.toString() || '0');
                  const qty = parseInt(i.quantity?.toString() || '1');
                  // ✅ FIX: productamount from request is PER-UNIT, multiply by quantity to get TOTAL
                  return sum + (prodAmt * qty);
                }, 0);

              if (totalProductAmountForProRata > 0) {
                promotionDiscountAmount = (promotionDiscountTotal * itemProductAmount) / totalProductAmountForProRata;

                logger.warn({
                  transactionId,
                  productId,
                  promotionDiscountTotal,
                  itemProductAmount,
                  totalProductAmountForProRata,
                  calculatedPromotionDiscount: promotionDiscountAmount,
                  reason: "applied_promotions has no per-product breakdown"
                }, "Using pro-rata distribution for promotion discount (evaluationData exists but no breakdown)");
              }
            }
          } else {
            // Fallback: Use values from request when evaluationData not available
            logger.warn({
              transactionId,
              productId,
              message: "No evaluationData - using values from request payload"
            }, "Falling back to request payload values");

            // ✅ FIX: When no evaluationData, request provides:
            // - productamount: ORIGINAL price per unit (before discount)
            // - discountamount: Product discount amount (already total for line item)
            // - quantity: Quantity

            // Example from user's request:
            // productamount: 150, discountamount: 10, quantity: 1
            // → original_price = 150 (per-unit)
            // → product_discount_amount = 10 (total)
            // → itemProductAmount = (150 × 1) - 10 = 140 (total after discount)

            // Calculate values for the line item
            const perUnitPrice = rawProductAmount; // Original price per unit (before discount)
            originalPrice = perUnitPrice; // original_price = per-unit price
            productDiscountAmount = rawDiscountAmount; // ✅ FIX: Use discount from request (already total)
            const totalProductAmountForLineItem = (perUnitPrice * quantity) - productDiscountAmount; // Total after product discount
            itemProductAmount = totalProductAmountForLineItem; // Total product amount for this line

            // For pro-rata promotion discount (if any at order level)
            // Calculate total product amount across all items
            const totalProductAmountForProRata = originalOrderData
              .filter((i: any) => validProductIds.includes(i.productid))
              .reduce((sum: number, i: any) => {
                const origPrice = parseFloat(i.productamount?.toString() || '0');
                const disc = parseFloat(i.discountamount?.toString() || '0');
                const qty = parseInt(i.quantity?.toString() || '1');
                // Total after discount for each item
                return sum + ((origPrice * qty) - disc);
              }, 0);

            if (totalProductAmountForProRata > 0 && promotionDiscountTotal > 0) {
              const proRataFactor = totalProductAmountForLineItem / totalProductAmountForProRata;
              promotionDiscountAmount = promotionDiscountTotal * proRataFactor;

              logger.debug({
                transactionId,
                productId,
                perUnitPrice,
                quantity,
                rawDiscountAmount,
                calculatedProductDiscount: productDiscountAmount,
                totalProductAmountForLineItem,
                promotionDiscountTotal,
                totalProductAmountForProRata,
                proRataFactor,
                calculatedPromotionDiscount: promotionDiscountAmount,
                calculatedOriginalPrice: originalPrice,
                note: 'Using request values: productamount=original price, discountamount=product discount'
              }, "Calculated discounts using request payload (no evaluationData)");
            }
          }

          // Calculate pro-rata shipping cost based on product amount (after discount)
          // ✅ FIX: Use amount after product discount for fair pro-rata distribution
          const totalProductAmountForShipping = originalOrderData
            .filter((i: any) => validProductIds.includes(i.productid))
            .reduce((sum: number, i: any) => {
              const origPrice = parseFloat(i.productamount?.toString() || '0');
              const disc = parseFloat(i.discountamount?.toString() || '0');
              const qty = parseInt(i.quantity?.toString() || '1');
              // ✅ FIX: Use amount after discount
              return sum + ((origPrice * qty) - disc);
            }, 0);

          const shippingCostForItem = totalProductAmountForShipping > 0
            ? (shippingCost * itemProductAmount) / totalProductAmountForShipping
            : 0;

          // ✅ FIX: Calculate finalOrderAmount as total for the line item
          // Correct understanding:
          // - productamount from request = TOTAL (productamount × quantity)
          // - original_price = productamount / quantity (per-unit, NOT multiplied by quantity)
          // - itemProductAmount = productamount (total for line item, already includes quantity)
          const totalDiscountAmount = productDiscountAmount + promotionDiscountAmount;
          // finalOrderAmount = total product amount - promotion discount
          // itemProductAmount is already total, promotionDiscountAmount is total
          const finalOrderAmount = itemProductAmount - promotionDiscountAmount;

          logger.debug({
            transactionId,
            productId,
            index,
            quantity,
            enrichment: {
              original_price: originalPrice,
              product_discount_amount: productDiscountAmount,
              promotion_discount_amount: promotionDiscountAmount,
              shipping_cost: shippingCostForItem,
              evaluation_id: primaryEvaluationId
            },
            recalculated: {
              discountamount: totalDiscountAmount,
              orderamount: finalOrderAmount,
              calculation: `${itemProductAmount} - ${promotionDiscountAmount} = ${finalOrderAmount}`,
              verification: {
                itemProductAmount_is_total: itemProductAmount,
                quantity: quantity,
                orderamount_is_total: finalOrderAmount,
                note: 'orderamount is TOTAL for line item (includes quantity), not per-unit'
              }
            }
          }, "Order item enriched with discount data and recalculated amounts");

          return {
            ...item,
            productamount: itemProductAmount,  // ✅ FIX: Use calculated TOTAL, not request's per-unit value
            original_price: originalPrice,
            product_discount_amount: productDiscountAmount,
            promotion_discount_amount: promotionDiscountAmount,
            shipping_cost: shippingCostForItem,
            evaluation_id: primaryEvaluationId,
            // ✅ CRITICAL: Recalculate discountamount and orderamount
            discountamount: totalDiscountAmount,
            orderamount: finalOrderAmount
          };
        });

      // Validation: Log enrichment results
      const enrichmentSummary = {
        totalItems: enrichedOrderItems.length,
        totalOriginalPrice: enrichedOrderItems.reduce((sum: number, i: any) => sum + (i.original_price || 0), 0),
        totalProductAmount: enrichedOrderItems.reduce((sum: number, i: any) => sum + (parseFloat(i.productamount?.toString() || '0') || 0), 0),
        totalProductDiscount: enrichedOrderItems.reduce((sum: number, i: any) => sum + (i.product_discount_amount || 0), 0),
        totalPromotionDiscount: enrichedOrderItems.reduce((sum: number, i: any) => sum + (i.promotion_discount_amount || 0), 0),
        totalDiscountAmount: enrichedOrderItems.reduce((sum: number, i: any) => sum + (parseFloat(i.discountamount?.toString() || '0') || 0), 0),
        totalOrderAmount: enrichedOrderItems.reduce((sum: number, i: any) => sum + (parseFloat(i.orderamount?.toString() || '0') || 0), 0),
        totalShipping: enrichedOrderItems.reduce((sum: number, i: any) => sum + (i.shipping_cost || 0), 0),
        totalQuantity: enrichedOrderItems.reduce((sum: number, i: any) => sum + (parseInt(i.quantity?.toString() || '0') || 0), 0)
      };

      // Calculate expected order-level orderamount (productAmount - promotionDiscountTotal)
      const expectedOrderAmount = productAmount - promotionDiscountTotal;

      logger.info(
        {
          transactionId,
          enrichmentSummary,
          expectedOrderLevelTotals: {
            quantity: totalQuantity,
            productamount: productAmount,
            discountamount: productDiscountTotal + promotionDiscountTotal,
            orderamount: expectedOrderAmount,
            promotion_discount_total: promotionDiscountTotal,
            original_total: originalTotal,
            shipping_cost: shippingCost
          },
          discrepancies: {
            quantity: Math.abs(enrichmentSummary.totalQuantity - totalQuantity),
            productAmount: Math.abs(enrichmentSummary.totalProductAmount - productAmount),
            productDiscount: Math.abs(enrichmentSummary.totalProductDiscount - productDiscountTotal),
            promotionDiscount: Math.abs(enrichmentSummary.totalPromotionDiscount - promotionDiscountTotal),
            discountAmount: Math.abs(enrichmentSummary.totalDiscountAmount - (productDiscountTotal + promotionDiscountTotal)),
            orderAmount: Math.abs(enrichmentSummary.totalOrderAmount - expectedOrderAmount),
            shipping: Math.abs(enrichmentSummary.totalShipping - shippingCost)
          },
          validations: {
            quantityMatch: Math.abs(enrichmentSummary.totalQuantity - totalQuantity) < 0.01,
            productAmountMatch: Math.abs(enrichmentSummary.totalProductAmount - productAmount) < 0.01,
            promotionDiscountMatch: Math.abs(enrichmentSummary.totalPromotionDiscount - promotionDiscountTotal) < 0.01,
            orderAmountMatch: Math.abs(enrichmentSummary.totalOrderAmount - expectedOrderAmount) < 0.01,
            allValid:
              Math.abs(enrichmentSummary.totalQuantity - totalQuantity) < 0.01 &&
              Math.abs(enrichmentSummary.totalProductAmount - productAmount) < 0.01 &&
              Math.abs(enrichmentSummary.totalPromotionDiscount - promotionDiscountTotal) < 0.01 &&
              Math.abs(enrichmentSummary.totalOrderAmount - expectedOrderAmount) < 0.01
          }
        },
        "Order items enrichment completed - validating orderline totals match order totals"
      );
      // ============================================
      // END BUGFIX
      // ============================================

      logger.info(
        {
          transactionId,
          mode: mode,
          originalOrderData: originalOrderData.length,
          validProductIds,
          totalQuantity: totalQuantity,
          productCount: validProductIds.length,
          promotionFields: {
            evaluation_id: primaryEvaluationId,
            original_total: originalTotal,
            product_discount_total: productDiscountTotal,
            promotion_discount_total: promotionDiscountTotal,
            shipping_cost: shippingCost,
            tax_amount: taxAmount,
            productamount: productAmount,
          },
          step: "preparing_order_with_detailed_items",
        },
        "Preparing order creation with detailed product and promotion information"
      );

      // Create order record with productid to enable automatic orderline creation
      // ✅ FIX: COD orders should start with order_confirmed and ispaymentsucceed: false
      // Prepaid orders start with payment_completed and ispaymentsucceed: true
      const isCodOrder = mode === "cod";
      const initialOrderStatus = isCodOrder ? "order_confirmed" : "payment_completed";

      // Initialize status_history with first entry (JSON.stringify for JSONB column)
      // is_active: true for the current/latest entry, false for all previous entries
      const initialStatusHistory = JSON.stringify([{
        previous_status: "order_placed",
        new_status: initialOrderStatus,
        changed_date: currentTime,
        source: isCodOrder ? "system" : "phonepe",
        is_active: true
      }]);

      const orderData = {
        userid: transaction.userid,
        addressid: orderAddressId, // BUG FIX: was null before, now extracted from first order item
        orderamount: parseFloat(transaction.amount?.toString() || "0"),
        orderid: orderid,
        orderstatus: initialOrderStatus, // ✅ COD: order_confirmed, Prepaid: payment_completed
        quantity: totalQuantity || validProductIds.length, // FIX #1: Sum of line item quantities, not product count
        transactionid: transaction.transactionid,
        productamount:
          productAmount > 0
            ? productAmount
            : parseFloat(transaction.amount?.toString() || "0"),
        discountamount: productDiscountTotal + promotionDiscountTotal, // Total discounts (product + promotion)
        ispaymentsucceed: !isCodOrder, // ✅ COD: false (payment pending), Prepaid: true
        merchanttransactionid: transaction.merchanttransactionid,
        productid: validProductIds, // Include product IDs for automatic orderline creation
        mode: mode, // Add mode field: 'phonepe' or 'cod'
        createddate: currentTime,
        modifieddate: currentTime,
        // Add new promotion-related fields
        evaluation_id: primaryEvaluationId,
        promotion_discount_total: promotionDiscountTotal, // Coupon/promotion discounts
        original_total: originalTotal,
        shipping_cost: shippingCost,
        tax_amount: taxAmount,
        // Add enriched order items with discount data for detailed orderline creation
        orderItems: enrichedOrderItems,  // BUGFIX: Use enriched items with per-line discount data
        // ✅ Initialize status history for order tracking
        status_history: initialStatusHistory,
      };

      console.log(orderData, "orderData-final");
      // Log the orderData being sent to OrdersService
      logger.info(
        {
          transactionId,
          mode: mode,
          orderDataKeys: Object.keys(orderData),
          orderDataMode: orderData.mode,
          orderDataFull: JSON.stringify(orderData, null, 2),
          step: "sending_to_orders_service",
        },
        "Order data being sent to OrdersService"
      );

      // Add a test to see if mode field is being filtered out
      logger.info(
        {
          transactionId,
          hasModeInOrderData: "mode" in orderData,
          modeValue: orderData.mode,
          modeType: typeof orderData.mode,
          step: "mode_field_verification",
        },
        "Mode field verification before OrdersService.create"
      );

      // Create order using OrdersService (with automatic orderline creation)
      const order = await this.ordersService.create(orderData);

      // Log the created order to see if mode was saved
      logger.info(
        {
          transactionId,
          orderId: order.id,
          orderidString: order.orderid,
          orderMode: order.mode,
          orderFull: JSON.stringify(order, null, 2),
          validProductCount: validProductIds.length,
          invalidProductCount: invalidProductIds.length,
          step: "order_created_with_automatic_orderlines",
        },
        "Order created successfully with automatic orderline creation"
      );

      console.log(evaluationIds, "evaluationIds after order create");
      // Step: Try to redeem all promotions if evaluations provided
      if (evaluationIds && evaluationIds.length > 0) {
        logger.info(
          {
            transactionId,
            orderId: order.id,
            evaluationIds,
            evaluationCount: evaluationIds.length,
          },
          "Starting promotion redemption process for multiple evaluations"
        );

        const { PromotionRedemptionService } = await import(
          "../services/promotion-redemption.service.js"
        );
        const redemptionService = new PromotionRedemptionService();

        const redemptionResults = [];

        for (const evaluationId of evaluationIds) {
          try {
            logger.info(
              {
                transactionId,
                orderId: order.id,
                evaluationId,
              },
              "Attempting to redeem promotion"
            );

            await redemptionService.redeemPromotion({
              evaluation_id: evaluationId,
              order_id: order.id.toString(),
              user_id: transaction.userid.toString(),
            });

            redemptionResults.push({
              evaluationId,
              status: "success",
              message: "Promotion redeemed successfully",
            });

            logger.info(
              {
                transactionId,
                orderId: order.id,
                evaluationId,
              },
              "Promotion redeemed successfully"
            );
          } catch (error) {
            // FIX #3: Fail order creation if promotion redemption fails (critical operation)
            logger.error(
              {
                transactionId,
                orderId: order.id,
                evaluationId,
                error: error instanceof Error ? error.message : "Unknown error",
              },
              "Promotion redemption CRITICAL ERROR - order will be marked as needs verification"
            );

            // Store failed redemption for later investigation
            redemptionResults.push({
              evaluationId,
              status: "failed",
              message: error instanceof Error ? error.message : "Unknown error",
            });

            // Don't throw error immediately, but log it for tracking
            // The order is already created, so we can't rollback easily
            // In production, you might want to mark the order with a flag for manual review
          }
        }

        // Log summary of all redemptions
        const successCount = redemptionResults.filter(
          (r) => r.status === "success"
        ).length;
        const failureCount = redemptionResults.filter(
          (r) => r.status === "failed"
        ).length;

        logger.info(
          {
            transactionId,
            orderId: order.id,
            totalEvaluations: evaluationIds.length,
            successCount,
            failureCount,
            results: redemptionResults,
          },
          "Promotion redemption summary"
        );
      }

      // Check if orderlines were created automatically
      const createdOrderlines = await prisma.orderline.findMany({
        where: { orderid: order.id },
        select: {
          id: true,
          productid: true,
          orderlinenumber: true,
          quantity: true,
          orderamount: true,
          productamount: true,
          product_discount_amount: true,
          promotion_discount_amount: true,
          discountamount: true,
        },
      });

      logger.info(
        {
          transactionId,
          orderId: order.id,
          automaticOrderlines: createdOrderlines.length,
          orderlineIds: createdOrderlines.map((ol: any) => ol.id),
          step: "automatic_orderlines_verified",
        },
        "Automatic orderline creation completed and verified"
      );

      // Update orderlines with promotion data
      // Always run this if we have orderlines, regardless of evaluation data
      if (createdOrderlines.length > 0) {
        try {
          const roundToTwo = (value: number) =>
            Math.round((Number(value) + Number.EPSILON) * 100) / 100;

          const evaluationCartData = evaluationData ? ((evaluationData as any).cart_data as any[]) || [] : [];
          const appliedPromotions =
            evaluationData ? ((evaluationData as any).applied_promotions as any[]) || [] : [];

          // Create maps for promotion data
          const originalPriceMap = new Map<number, number>();
          const productDiscountMap = new Map<number, number>();

          // Map product data from evaluation cart data (if available)
          // IMPORTANT: Store PER-ITEM values in maps, multiply by quantity later
          if (evaluationCartData && evaluationCartData.length > 0) {
            evaluationCartData.forEach((cartItem: any) => {
              const productId = parseInt(cartItem.product_id?.toString() || "0");
              if (productId > 0) {
                const basePrice = parseFloat(
                  cartItem.base_price?.toString() || "0"
                );
                const productDiscount = parseFloat(
                  cartItem.product_discount?.toString() || "0"
                );

                // Store PER-ITEM prices and discounts in maps
                originalPriceMap.set(productId, basePrice);
                productDiscountMap.set(productId, productDiscount); // Store per-item discount
              }
            });
          } else {
            // ✅ FIX: When no evaluationData, populate maps from originalOrderData (request payload)
            const originalOrderData = transaction.transactiondata?.originalPayload?.order || [];
            originalOrderData.forEach((orderItem: any) => {
              const productId = parseInt(orderItem.productid?.toString() || "0");
              if (productId > 0) {
                const productAmount = parseFloat(orderItem.productamount?.toString() || "0");
                const discountAmount = parseFloat(orderItem.discountamount?.toString() || "0");
                const quantity = parseInt(orderItem.quantity?.toString() || "1");

                // productamount in request is ORIGINAL price per unit (before discount)
                // discountamount in request is TOTAL discount for line item
                originalPriceMap.set(productId, productAmount);  // Per-unit original price
                productDiscountMap.set(productId, discountAmount / quantity);  // Per-unit discount

                logger.debug({
                  transactionId,
                  productId,
                  productAmount,
                  discountAmount,
                  quantity,
                  mappedOriginalPrice: productAmount,
                  mappedProductDiscount: discountAmount / quantity,
                  note: 'Populated maps from request payload (no evaluationData)'
                }, 'Using request values for orderline update');
              }
            });
          }

          // Calculate shipping cost per item
          const totalShippingCost = roundToTwo(
            parseFloat(
              transaction.transactiondata?.originalPayload?.shippingCost?.toString() ||
              "0"
            )
          );

          // Get order-level promotion discount total for proportional distribution
          const orderPromotionDiscountTotal = roundToTwo(
            parseFloat(order.promotion_discount_total?.toString() || "0")
          );
          const orderProductDiscountTotal = roundToTwo(
            Number(productDiscountTotal) || 0
          );
          const orderTotalDiscountAmount = roundToTwo(
            parseFloat(order.discountamount?.toString() || "0")
          );
          const orderProductAmountTotal = roundToTwo(
            parseFloat(order.productamount?.toString() || "0")
          );
          const orderOrderAmountTotal = roundToTwo(
            parseFloat(order.orderamount?.toString() || "0")
          );
          const orderShippingTotal = roundToTwo(
            parseFloat(order.shipping_cost?.toString() || "0")
          );

          // Calculate total order amount from all orderlines (for proportional distribution)
          let totalOrderAmount = 0;
          let totalProductAmountFromLines = 0;
          const orderlineAmounts: Array<{
            id: any;
            productId: number;
            orderamount: number;
            productamount: number;
            quantity: number;
            shipping: number;
          }> = [];

          for (const orderline of createdOrderlines) {
            const lineOrderAmount = roundToTwo(
              parseFloat((orderline as any).orderamount?.toString() || "0")
            );
            const lineProductAmount = roundToTwo(
              parseFloat((orderline as any).productamount?.toString() || "0")
            );
            const lineQuantity = parseFloat((orderline as any).quantity?.toString() || "1");
            const lineShipping = roundToTwo(
              parseFloat((orderline as any).shipping_cost?.toString() || "0")
            );
            totalOrderAmount = roundToTwo(totalOrderAmount + lineOrderAmount);
            totalProductAmountFromLines = roundToTwo(
              totalProductAmountFromLines + lineProductAmount
            );
            orderlineAmounts.push({
              id: orderline.id,
              productId: Number(orderline.productid),
              orderamount: lineOrderAmount,
              productamount: lineProductAmount,
              quantity: lineQuantity,
              shipping: lineShipping,
            });
          }

          logger.info(
            {
              transactionId,
              orderId: order.id,
              originalPriceMap: Object.fromEntries(originalPriceMap),
              productDiscountMap: Object.fromEntries(productDiscountMap),
              orderlineAmounts,
              totalOrderAmount,
              orderPromotionDiscountTotal,
              orderProductDiscountTotal,
              orderTotalDiscountAmount,
              orderProductAmountTotal,
              orderlinesCount: createdOrderlines.length,
            },
            "Orderline promotion data mapping completed with order-level totals"
          );

          // FIX: Distribute promotion discount proportionally across orderlines
          let allocatedPromoDiscount = 0;
          const promoDiscounts: Array<{ lineId: any; discount: number }> = [];
          const promotionDistributionBasis =
            orderPromotionDiscountTotal > 0
              ? totalOrderAmount > 0
                ? totalOrderAmount
                : totalProductAmountFromLines
              : 0;

          // If there's a promotion discount and we have a basis, distribute it proportionally
          if (orderPromotionDiscountTotal > 0 && promotionDistributionBasis > 0) {
            for (let i = 0; i < orderlineAmounts.length; i++) {
              const line = orderlineAmounts[i];

              if (!line) continue;

              // Calculate proportional discount for this line
              const basisValue = totalOrderAmount > 0 ? line.orderamount : line.productamount;
              const proportion = basisValue / promotionDistributionBasis;
              let linePromoDiscount = roundToTwo(proportion * orderPromotionDiscountTotal);

              // Round to 2 decimal places to avoid floating point issues
              // For the last line, ensure total allocated equals order promotion_discount_total
              if (i === orderlineAmounts.length - 1) {
                linePromoDiscount = roundToTwo(
                  orderPromotionDiscountTotal - allocatedPromoDiscount
                );
              }

              allocatedPromoDiscount = roundToTwo(allocatedPromoDiscount + linePromoDiscount);
              promoDiscounts.push({ lineId: line.id, discount: linePromoDiscount });
            }
          }

          logger.info(
            {
              transactionId,
              orderId: order.id,
              totalOrderAmount,
              orderPromotionDiscountTotal,
              allocatedPromoDiscount,
              promoDiscounts,
              match: Math.abs(allocatedPromoDiscount - orderPromotionDiscountTotal) < 0.01
            },
            "Promotion discount distribution calculated"
          );

          // Update each orderline with promotion data using Prisma
          let accumulatedPromotion = 0;
          let accumulatedProductDiscount = 0;
          let accumulatedDiscountAmount = 0;
          let accumulatedOrderAmount = 0;
          let accumulatedProductAmount = 0;
          let accumulatedShippingAmount = 0;

          for (let i = 0; i < createdOrderlines.length; i++) {
            const orderline = createdOrderlines[i];

            if (!orderline) continue;

            const productId = Number(orderline.productid);
            const lineQuantity = parseFloat((orderline as any).quantity?.toString() || "1");
            const isLastLine = i === createdOrderlines.length - 1;

            const originalPricePerItem = roundToTwo(
              originalPriceMap.get(productId) ||
              (lineQuantity > 0
                ? (orderlineAmounts[i]?.productamount || 0) / lineQuantity
                : 0)
            );
            const productDiscountPerItem = roundToTwo(
              productDiscountMap.get(productId) || 0
            );
            let productDiscountAmount = roundToTwo(
              productDiscountPerItem * lineQuantity
            );
            let promotionDiscountAmount = roundToTwo(
              promoDiscounts[i]?.discount || 0
            );
            const originalPriceTotal = roundToTwo(
              originalPricePerItem * lineQuantity
            );
            let productAmountOnly = roundToTwo(
              originalPriceTotal - productDiscountAmount
            );
            let totalDiscountForLine = roundToTwo(
              productDiscountAmount + promotionDiscountAmount
            );
            let finalPriceTotal = roundToTwo(
              productAmountOnly - promotionDiscountAmount
            );
            let lineShippingCost = roundToTwo(
              orderProductAmountTotal > 0
                ? totalShippingCost * (productAmountOnly / orderProductAmountTotal)
                : 0
            );

            if (isLastLine) {
              promotionDiscountAmount = roundToTwo(
                orderPromotionDiscountTotal - accumulatedPromotion
              );
              productDiscountAmount = roundToTwo(
                orderProductDiscountTotal - accumulatedProductDiscount
              );
              totalDiscountForLine = roundToTwo(
                orderTotalDiscountAmount - accumulatedDiscountAmount
              );
              productAmountOnly = roundToTwo(
                orderProductAmountTotal - accumulatedProductAmount
              );
              // ✅ FIX: orderline.orderamount should NOT include shipping
              // Use productAmountOnly - promotionDiscountAmount (same formula as non-last lines)
              // NOT orderOrderAmountTotal which includes shipping
              finalPriceTotal = roundToTwo(
                productAmountOnly - promotionDiscountAmount
              );
              lineShippingCost = roundToTwo(
                orderShippingTotal - accumulatedShippingAmount
              );
            }

            // SAFEGUARD: Prevent negative amounts due to very large promotions
            if (finalPriceTotal < 0) {
              logger.warn(
                {
                  transactionId,
                  orderId: order.id,
                  productId,
                  lineQuantity,
                  originalPriceTotal,
                  productDiscountAmount,
                  promotionDiscountAmount,
                  calculatedAmount: finalPriceTotal,
                  action: "capping_promotion_to_prevent_negative",
                },
                "Promotion discount exceeds product value - capping promotion discount"
              );
              promotionDiscountAmount = roundToTwo(
                Math.max(0, productAmountOnly)
              );
              totalDiscountForLine = roundToTwo(
                productDiscountAmount + promotionDiscountAmount
              );
              finalPriceTotal = 0;
            }

            const updateData: any = {
              evaluation_id: primaryEvaluationId,
              promotion_discount_amount: promotionDiscountAmount,
              discountamount: totalDiscountForLine,
              modifieddate: BigInt(currentTime),
              orderamount: Math.max(0, finalPriceTotal),
            };

            // Persist detailed fields (including when evaluationData is not available for rounding consistency)
            updateData.original_price = originalPricePerItem;
            updateData.product_discount_amount = productDiscountAmount;
            updateData.shipping_cost = lineShippingCost;
            updateData.productamount = productAmountOnly;

            // Use Prisma to update the orderline
            await prisma.orderline.update({
              where: { id: orderline.id },
              data: updateData,
            });

            accumulatedPromotion = roundToTwo(
              accumulatedPromotion + promotionDiscountAmount
            );
            accumulatedProductDiscount = roundToTwo(
              accumulatedProductDiscount + productDiscountAmount
            );
            accumulatedDiscountAmount = roundToTwo(
              accumulatedDiscountAmount + totalDiscountForLine
            );
            accumulatedOrderAmount = roundToTwo(
              accumulatedOrderAmount + finalPriceTotal
            );
            accumulatedProductAmount = roundToTwo(
              accumulatedProductAmount + productAmountOnly
            );
            accumulatedShippingAmount = roundToTwo(
              accumulatedShippingAmount + lineShippingCost
            );
          }
        } catch (updateError: any) {
          logger.warn(
            {
              transactionId,
              orderId: order.id,
              error: updateError.message,
            },
            "Failed to update orderlines with promotion data - orderlines created without promotion details"
          );
        }
      } else {
        logger.warn(
          {
            transactionId,
            orderId: order.id,
            orderlinesCount: createdOrderlines.length,
          },
          "No orderlines to update with promotion data"
        );
      }

      // Use the automatically created orderlines
      const orderlineResults = createdOrderlines.map((ol: any) => ({
        success: true,
        productId: Number(ol.productid),
        orderline: ol,
      }));

      const successfulOrderlines = orderlineResults.filter(
        (result: any) => result.success
      );
      const failedOrderlines: any = orderlineResults.filter(
        (result: any) => !result.success
      );

      logger.info(
        {
          transactionId,
          orderId: order.id,
          totalOrderlines: orderlineResults.length,
          successfulCount: successfulOrderlines.length,
          failedCount: failedOrderlines.length,
          successfulOrderlineIds: successfulOrderlines
            .map((r: any) => r.orderline?.id)
            .filter(Boolean),
          failedProductIds: failedOrderlines.map((r: any) => r.productId),
          invalidProductsSkipped: invalidProductIds,
        },
        "Orderline creation completed"
      );

      // If all orderlines failed, throw an error
      if (successfulOrderlines.length === 0) {
        const errorMsg = `Failed to create any orderlines for order ${order.id
          }. Errors: ${failedOrderlines.map((r: any) => r.error).join(", ")}`;
        logger.error(
          {
            transactionId,
            orderId: order.id,
            failedOrderlines: failedOrderlines.map((r: any) => ({
              productId: r.productId,
              error: r.error,
            })),
          },
          errorMsg
        );
        throw new Error(errorMsg);
      }

      // Log warnings for partial failures
      if (failedOrderlines.length > 0) {
        logger.warn(
          {
            transactionId,
            orderId: order.id,
            failedOrderlines: failedOrderlines.map((r: any) => ({
              productId: r.productId,
              error: r.error,
            })),
          },
          "Some orderlines failed to create but order has partial success"
        );
      }

      // Final success log with comprehensive summary
      logger.info(
        {
          transactionId,
          orderId: order.id,
          mode: mode,
          summary: {
            totalProductsRequested: transaction.productid.length,
            validProducts: validProductIds.length,
            invalidProducts: invalidProductIds.length,
            successfulOrderlines: successfulOrderlines.length,
            failedOrderlines: failedOrderlines.length,
            orderAmount: order.orderamount,
            orderStatus: order.orderstatus,
          },
        },
        "Order and orderlines created successfully after payment"
      );

      // ✅ Clear cart after successful order creation
      // Cart is cleared ONLY when order is confirmed (not on payment initiation or failure)
      // This ensures cart remains intact if payment fails or is cancelled
      try {
        const { CartService } = await import('../services/cart.service.js');
        const cartService = new CartService();

        const cartClearResult = await cartService.clearCartByUserId(
          transaction.userid.toString()
        );

        logger.info({
          transactionId,
          orderId: order.id,
          userId: transaction.userid,
          deletedCount: cartClearResult.deletedCount,
          orderStatus: order.orderstatus,
          note: 'Cart cleared after successful order confirmation (backend only)'
        }, 'Cart cleared successfully after order confirmation');
      } catch (cartError) {
        // Non-critical: Log but don't fail order creation
        // Order is already created successfully, cart clearing failure should not affect order
        logger.warn({
          transactionId,
          orderId: order.id,
          userId: transaction.userid,
          error: cartError instanceof Error ? cartError.message : 'Unknown error',
          note: 'Cart clear failed after order creation (non-critical - order still created)'
        }, 'Failed to clear cart after order creation (non-critical)');
      }

      return order;
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          transactionId,
        },
        "Error creating order after payment"
      );
      throw error;
    }
  }

  /**
   * Validate products in batch using Prisma
   */
  private async validateProductsBatch(
    productIds: number[]
  ): Promise<Array<{ id: number; name?: string }>> {
    try {
      logger.debug({ productIds }, "Validating products in batch");

      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds.map((id: number) => BigInt(id)) },
        },
        select: {
          id: true,
          name: true,
        },
      });

      const formattedProducts = products
        .map((p: any) => ({
          id: Number(p.id),
          name: p.name || undefined,
        }))
        .filter((p: any) => p.id && !isNaN(p.id)) as Array<{
          id: number;
          name?: string;
        }>;

      logger.debug(
        {
          requestedIds: productIds,
          foundProducts: formattedProducts.map((p) => ({
            id: p.id,
            name: p.name,
          })),
        },
        "Batch product validation completed"
      );

      return formattedProducts;
    } catch (error: any) {
      logger.error(
        {
          productIds,
          error: error.message,
          stack: error.stack,
        },
        "Error in batch product validation"
      );
      return [];
    }
  }

  /**
   * Validate and clean orderline data before creation
   */
  private validateOrderlineData(orderlineData: any): {
    isValid: boolean;
    errors: string[];
    cleanedData?: any;
  } {
    const errors: string[] = [];
    const cleanedData = { ...orderlineData };

    // Validate required ID fields (all should be Int)
    if (!cleanedData.orderid || typeof cleanedData.orderid !== "number") {
      errors.push("orderid must be a valid number (Int)");
    }

    if (!cleanedData.productid || typeof cleanedData.productid !== "number") {
      errors.push("productid must be a valid number (Int)");
    }

    if (!cleanedData.userid || typeof cleanedData.userid !== "number") {
      errors.push("userid must be a valid number (Int)");
    }

    // Optional ID fields (should be Int or null)
    if (cleanedData.addressid !== undefined && cleanedData.addressid !== null) {
      const addressId = Number(cleanedData.addressid);
      if (isNaN(addressId)) {
        errors.push("addressid must be a valid number (Int) or null");
      } else {
        cleanedData.addressid = addressId;
      }
    }

    // Validate and clean numeric fields (Decimal in DB, Number in JS)
    const numericFields = ["productamount", "discountamount", "orderamount"];
    numericFields.forEach((field) => {
      if (cleanedData[field] !== undefined && cleanedData[field] !== null) {
        const numValue = Number(cleanedData[field]);
        if (isNaN(numValue)) {
          errors.push(`${field} must be a valid number (Decimal)`);
        } else {
          cleanedData[field] = numValue;
        }
      }
    });

    // Validate quantity (should be Int)
    if (cleanedData.quantity !== undefined && cleanedData.quantity !== null) {
      const quantityValue = Number(cleanedData.quantity);
      if (isNaN(quantityValue) || !Number.isInteger(quantityValue)) {
        errors.push("quantity must be a valid integer (Int)");
      } else {
        cleanedData.quantity = quantityValue;
      }
    }

    // Validate and clean timestamp fields (should be BigInt)
    const timestampFields = [
      "createddate",
      "modifieddate",
      "ordereddate",
      "readytodispatchdate",
      "delivereddate",
      "cancelleddate",
      "returneddate",
      "dispatcheddate",
      "paymentfaileddate",
    ];
    timestampFields.forEach((field) => {
      if (cleanedData[field] !== undefined && cleanedData[field] !== null) {
        try {
          // Convert to BigInt for date fields
          const timestampValue = BigInt(cleanedData[field]);
          cleanedData[field] = timestampValue;
        } catch (error) {
          errors.push(`${field} must be a valid timestamp (BigInt)`);
        }
      }
    });

    // Validate string fields length
    const stringFields = [
      { field: "merchanttransactionid", maxLength: 250 },
      { field: "productname", maxLength: 500 },
      { field: "productcategory", maxLength: 500 },
      { field: "productcolour", maxLength: 500 },
      { field: "orderstatus", maxLength: 500 },
      { field: "uniqueordderid", maxLength: 500 },
      { field: "orderlinenumber", maxLength: 500 },
      { field: "deliveryfrom", maxLength: 500 },
      { field: "location", maxLength: 500 },
    ];

    stringFields.forEach(({ field, maxLength }) => {
      if (cleanedData[field] && typeof cleanedData[field] === "string") {
        if (cleanedData[field].length > maxLength) {
          errors.push(`${field} must be ${maxLength} characters or less`);
        }
      }
    });

    // Ensure null values for optional fields that might be undefined
    const optionalFields = [
      "addressid",
      "productcategory",
      "productcolour",
      "deliveryfrom",
      "location",
    ];
    optionalFields.forEach((field) => {
      if (cleanedData[field] === undefined) {
        cleanedData[field] = null;
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      cleanedData: errors.length === 0 ? cleanedData : undefined,
    };
  }

  /**
   * Create orderlines for validated products
   */
  private async createOrderlinesForProducts(
    orderId: number,
    validProducts: Array<{ id: number; name?: string }>,
    transaction: any,
    orderid: string,
    currentTime: number,
    transactionId: string,
    evaluationData?: any, // Add evaluation data parameter
    primaryEvaluationId?: string // Add evaluation ID parameter
  ): Promise<
    Array<{
      success: boolean;
      productId: number;
      orderline?: any;
      error?: string;
    }>
  > {
    const results: Array<{
      success: boolean;
      productId: number;
      orderline?: any;
      error?: string;
    }> = [];

    // Get original order data from transaction to retrieve individual product amounts
    const originalOrderData =
      transaction.transactiondata?.originalPayload?.order || [];

    // Get cart data from evaluation if available
    const evaluationCartData = evaluationData
      ? (evaluationData.cart_data as any[]) || []
      : [];
    const appliedPromotions = evaluationData
      ? (evaluationData.applied_promotions as any[]) || []
      : [];

    // Create maps for product data
    const productAmountMap = new Map<number, number>();
    const productDiscountMap = new Map<number, number>();
    const originalPriceMap = new Map<number, number>();
    const promotionDiscountMap = new Map<number, number>();

    // Map product data from original order data
    originalOrderData.forEach((orderItem: any) => {
      if (orderItem.productid && orderItem.productamount !== undefined) {
        productAmountMap.set(
          orderItem.productid,
          parseFloat(orderItem.productamount.toString()) || 0
        );
      }
    });

    // Map product data from evaluation cart data (more accurate)
    evaluationCartData.forEach((cartItem: any) => {
      const productId = parseInt(cartItem.product_id?.toString() || "0");
      if (productId > 0) {
        const basePrice = parseFloat(cartItem.base_price?.toString() || "0");
        const productDiscount = parseFloat(
          cartItem.product_discount?.toString() || "0"
        );
        const quantity = parseInt(cartItem.quantity?.toString() || "1");

        originalPriceMap.set(productId, basePrice);
        productDiscountMap.set(productId, productDiscount * quantity); // product_discount * quantity
      }
    });

    // Map promotion discounts from applied promotions breakdown
    appliedPromotions.forEach((promotion: any) => {
      if (promotion.breakdown && Array.isArray(promotion.breakdown)) {
        promotion.breakdown.forEach((item: any) => {
          const productId = parseInt(item.product_id?.toString() || "0");
          if (productId > 0) {
            const discountAmount = parseFloat(
              item.total_discount?.toString() || "0"
            );
            promotionDiscountMap.set(productId, discountAmount); // total_discount directly
          }
        });
      }
    });

    // Calculate shipping cost per item
    const totalShippingCost = parseFloat(
      transaction.transactiondata?.originalPayload?.shippingCost?.toString() ||
      "0"
    );
    const shippingCostPerItem =
      validProducts.length > 0 ? totalShippingCost / validProducts.length : 0;

    logger.debug(
      {
        transactionId,
        originalOrderData: originalOrderData.length,
        evaluationCartData: evaluationCartData.length,
        productAmountMap: Object.fromEntries(productAmountMap),
        productDiscountMap: Object.fromEntries(productDiscountMap),
        originalPriceMap: Object.fromEntries(originalPriceMap),
        promotionDiscountMap: Object.fromEntries(promotionDiscountMap),
        shippingCostPerItem,
        validProductIds: validProducts.map((p) => p.id),
      },
      "Product data mapping for orderline creation"
    );

    for (let index = 0; index < validProducts.length; index++) {
      const product = validProducts[index];

      if (!product) {
        logger.warn({ transactionId, index }, "Skipping undefined product");
        continue;
      }

      try {
        // Get individual product data
        const individualProductAmount =
          productAmountMap.get(product.id) ??
          (validProducts.length > 0
            ? parseFloat(transaction.amount?.toString() || "0") /
            validProducts.length
            : 0);

        const originalPrice = originalPriceMap.get(product.id) || 0;
        const productDiscountAmount = productDiscountMap.get(product.id) || 0;
        const promotionDiscountAmount =
          promotionDiscountMap.get(product.id) || 0;

        // Calculate final order amount for this line
        const finalOrderAmount =
          originalPrice - productDiscountAmount - promotionDiscountAmount;

        const orderlineData = {
          orderid: orderId, // Int - correct
          productid: product.id, // Int - correct (not BigInt)
          userid: transaction.userid, // Int - correct
          productamount: Number(individualProductAmount),
          discountamount: productDiscountAmount + promotionDiscountAmount, // Total discounts for this line
          orderamount: Number(finalOrderAmount),
          quantity: 1, // Int - correct
          merchanttransactionid: transaction.merchanttransactionid,
          orderstatus: "payment_completed",
          orderlinenumber: `${orderid}_LINE_${index + 1}`,
          productname: product.name || null,
          ordereddate: BigInt(currentTime), // BigInt - correct for date fields
          createddate: BigInt(currentTime), // BigInt - correct for date fields
          modifieddate: BigInt(currentTime), // BigInt - correct for date fields
          // Add new promotion-related fields
          evaluation_id: primaryEvaluationId,
          original_price: originalPrice,
          product_discount_amount: productDiscountAmount,
          promotion_discount_amount: promotionDiscountAmount,
          shipping_cost: shippingCostPerItem,
        };

        // Validate orderline data before creation
        const validation = this.validateOrderlineData(orderlineData);
        if (!validation.isValid) {
          throw new Error(
            `Orderline data validation failed: ${validation.errors.join(", ")}`
          );
        }

        logger.debug(
          {
            transactionId,
            productId: product.id,
            individualAmount: individualProductAmount,
            originalPrice,
            productDiscountAmount,
            promotionDiscountAmount,
            finalOrderAmount,
            shippingCostPerItem,
            orderlineData: {
              ...validation.cleanedData,
              productname: product.name ? "***" : null,
            },
          },
          "Creating orderline with promotion data"
        );

        const orderline = await this.orderlineService.create(
          validation.cleanedData!
        );

        logger.info(
          {
            transactionId,
            productId: product.id,
            orderlineId: orderline.id,
            orderlinenumber: orderline.orderlinenumber,
            originalPrice,
            productDiscountAmount,
            promotionDiscountAmount,
            finalOrderAmount,
            shippingCostPerItem,
          },
          "Orderline created successfully with promotion data"
        );

        results.push({
          success: true,
          productId: product.id,
          orderline,
        });
      } catch (error: any) {
        logger.error(
          {
            transactionId,
            productId: product.id,
            error: error.message,
            stack: error.stack,
            errorType: error.constructor.name,
          },
          "Failed to create orderline for product"
        );

        results.push({
          success: false,
          productId: product.id,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Check if product exists in product table
   */
  private async checkProductExists(productId: number): Promise<boolean> {
    try {
      logger.debug({ productId }, "Checking if product exists in database");

      // Use Prisma's findUnique instead of raw SQL for better reliability
      const product = await prisma.product.findUnique({
        where: { id: BigInt(productId) },
        select: { id: true },
      });

      const exists = !!product;
      logger.debug({ productId, exists }, "Product existence check completed");

      return exists;
    } catch (error: any) {
      logger.error(
        {
          productId,
          error: error.message,
          stack: error.stack,
        },
        "Error checking product existence"
      );
      return false;
    }
  }

  /**
   * Store transaction data in database
   */
  private async storeTransactionData(
    paymentRequest: any,
    transactionData: any
  ) {
    try {
      logger.info(
        {
          merchantTransactionId: paymentRequest.merchantTransactionId,
          amount: paymentRequest.amount,
          userId: paymentRequest.userId,
          mode: transactionData.mode,
        },
        "Storing transaction data"
      );

      const transactionRecord = {
        transactionid: paymentRequest.merchantTransactionId,
        merchanttransactionid: paymentRequest.merchantTransactionId,
        userid: paymentRequest.userId,
        amount: paymentRequest.amount,
        mobilenumber: parseInt(paymentRequest.mobileNumber),
        name: paymentRequest.name,
        productid: paymentRequest.productIds || [],
        transactionfor: paymentRequest.transactionFor,
        transactiondata: transactionData,
        createddate: Date.now(),
        modifieddate: Date.now(),
      };

      const result = await this.transactionService.create(transactionRecord);
      logger.info(
        {
          merchantTransactionId: paymentRequest.merchantTransactionId,
          transactionId: result.id,
        },
        "Transaction data stored successfully"
      );

      return result;
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          merchantTransactionId: paymentRequest.merchantTransactionId,
        },
        "Error storing transaction data"
      );
      throw error;
    }
  }

  /**
   * Store transaction data with dedicated status column (NEW METHOD)
   * This method includes the new status column for better performance and consistency
   */
  private async storeTransactionDataWithStatus(
    paymentRequest: any,
    transactionData: any,
    status: string
  ) {
    try {
      logger.info(
        {
          merchantTransactionId: paymentRequest.merchantTransactionId,
          amount: paymentRequest.amount,
          userId: paymentRequest.userId,
          mode: transactionData.mode,
          status,
        },
        "Storing transaction data with status column"
      );

      const transactionRecord = {
        transactionid: paymentRequest.merchantTransactionId,
        merchanttransactionid: paymentRequest.merchantTransactionId,
        userid: paymentRequest.userId,
        amount: paymentRequest.amount,
        mobilenumber: parseInt(paymentRequest.mobileNumber),
        name: paymentRequest.name,
        productid: paymentRequest.productIds || [],
        transactionfor: paymentRequest.transactionFor,
        transactiondata: transactionData,
        status: status, // NEW: Dedicated status column
        createddate: Date.now(),
        modifieddate: Date.now(),
      };

      const result = await this.transactionService.create(transactionRecord);
      logger.info(
        {
          merchantTransactionId: paymentRequest.merchantTransactionId,
          transactionId: result.id,
          status,
        },
        "Transaction data stored successfully with status"
      );

      return result;
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          merchantTransactionId: paymentRequest.merchantTransactionId,
          status,
        },
        "Error storing transaction data with status"
      );
      throw error;
    }
  }

  /**
   * Update product quantities and status after successful order creation
   * NEW: Now includes platform-specific stock updates for nivapp
   *
   * Flow:
   * 1. Check platformstock for nivapp (availableqty - lockqty >= ordered quantity)
   * 2. Update platformstock (availableqty, lockqty, orderedqty, platformstatus)
   * 3. Update overall product quantities and status
   *
   * Product status rules:
   * - availablequantity <= 0: "out_of_stock"
   * - availablequantity 1-5: "low_stock"
   * - availablequantity > 5: "in_stock"
   */
  public async updateProductQuantitiesAfterOrder(
    orderData: any,
    originalOrderItems: any[],
    mode: string
  ) {
    console.log(orderData, "orderData");
    const PLATFORM_NAME = "nivapp"; // Platform name for nivapp - defined at function level

    try {
      logger.info(
        {
          orderId: orderData.id,
          mode: mode,
          orderItemsCount: originalOrderItems.length,
          orderItemsStructure: originalOrderItems.map((item) => ({
            productid: item.productid,
            quantity: item.quantity,
            productname: item.productname,
          })),
        },
        "Starting product quantity updates after order creation (with platformstock support)"
      );

      // Validate input data
      if (
        !originalOrderItems ||
        !Array.isArray(originalOrderItems) ||
        originalOrderItems.length === 0
      ) {
        logger.warn(
          {
            orderId: orderData.id,
            mode: mode,
            originalOrderItems: originalOrderItems,
          },
          "No valid order items provided for quantity update"
        );
        return {
          success: false,
          totalProducts: 0,
          successfulUpdates: 0,
          failedUpdates: 0,
          updateResults: [],
          error: "No valid order items provided",
        };
      }

      const updateResults = [];

      for (const orderItem of originalOrderItems) {
        try {
          // Validate order item structure
          if (!orderItem || typeof orderItem !== "object") {
            logger.warn(
              {
                orderId: orderData.id,
                orderItem: orderItem,
              },
              "Invalid order item structure"
            );
            updateResults.push({
              productId: null,
              success: false,
              error: "Invalid order item structure",
            });
            continue;
          }

          const productId = orderItem.productid;
          const requestedQuantity = orderItem.quantity || 1;
          console.log(productId, "productId");
          console.log(requestedQuantity, "requestedQuantity");
          // Validate product ID
          if (!productId || isNaN(Number(productId))) {
            logger.warn(
              {
                orderId: orderData.id,
                productId: productId,
                orderItem: orderItem,
              },
              "Invalid product ID in order item"
            );
            updateResults.push({
              productId: productId,
              success: false,
              error: "Invalid product ID",
            });
            continue;
          }

          logger.info(
            {
              orderId: orderData.id,
              productId: productId,
              requestedQuantity: requestedQuantity,
              mode: mode,
              platform: PLATFORM_NAME,
            },
            "Processing product quantity update with platformstock"
          );

          // ========================================
          // STEP 1: CHECK IF PRODUCT IS COMBO
          // ========================================
          const productCheck = await prisma.product.findUnique({
            where: { id: BigInt(productId) },
            select: {
              id: true,
              name: true,
              iscombo: true,
            },
          });

          if (!productCheck) {
            logger.error(
              {
                productId,
                orderId: orderData.id,
              },
              "Product not found during callback - critical error"
            );
            updateResults.push({
              productId: productId,
              success: false,
              error: "Product not found",
              error_code: "PRODUCT_NOT_FOUND",
            });
            continue;
          }

          // ========================================
          // STEP 2: BRANCH - COMBO OR SINGLE PRODUCT
          // ========================================
          if (productCheck.iscombo) {
            // ✅ COMBO PRODUCT: Convert component locks to orders
            logger.info(
              {
                productId,
                productName: productCheck.name,
                quantity: requestedQuantity,
                productType: "combo",
                orderId: orderData.id,
              },
              "Detected combo product in callback - converting component locks to orders"
            );

            try {
              const conversionResult = await this.convertComboComponentLocksToOrders(
                productId,
                requestedQuantity,
                orderData,
                orderItem,
                PLATFORM_NAME
              );

              updateResults.push({
                productId: productId,
                productName: productCheck.name,
                productType: "combo",
                quantity: requestedQuantity,
                success: true,
                componentsUpdated: conversionResult.componentsUpdated,
                componentDetails: conversionResult.componentDetails,
                note: "Combo product - component locks converted to orders",
              });

              logger.info(
                {
                  productId,
                  productName: productCheck.name,
                  componentsUpdated: conversionResult.componentsUpdated,
                  orderId: orderData.id,
                },
                "Combo product component locks converted successfully"
              );
            } catch (comboError: any) {
              logger.error(
                {
                  productId,
                  productName: productCheck.name,
                  error: comboError.message,
                  stack: comboError.stack,
                  orderId: orderData.id,
                },
                "Failed to convert combo component locks to orders"
              );

              updateResults.push({
                productId: productId,
                productName: productCheck.name,
                productType: "combo",
                quantity: requestedQuantity,
                success: false,
                error: `Combo conversion failed: ${comboError.message}`,
                error_code: "COMBO_CONVERSION_FAILED",
              });
            }
            continue; // Skip to next order item
          }

          // ========================================
          // STEP 3: SINGLE PRODUCT - EXISTING LOGIC
          // ========================================
          logger.info(
            {
              productId,
              productName: productCheck.name,
              quantity: requestedQuantity,
              productType: "single",
              orderId: orderData.id,
            },
            "Processing single product lock-to-order conversion"
          );

          // STEP 1: Get and validate platformstock for nivapp
          let platformStock = await prisma.platformStock.findUnique({
            where: {
              productid_platform: {
                productid: BigInt(productId),
                platform: PLATFORM_NAME,
              },
            },
            select: {
              id: true,
              availableqty: true,
              lockqty: true,
              orderedqty: true,
              soldqty: true,
              totalqty: true,
              platformstatus: true,
            },
          });

          // If platformstock doesn't exist, it's an error (should have been validated at initiation)
          if (!platformStock) {
            logger.error(
              {
                productId,
                platform: PLATFORM_NAME,
                orderId: orderData.id,
                productName: orderItem.productname,
              },
              "PlatformStock record not found - this should have been caught during payment initiation validation"
            );

            updateResults.push({
              productId: productId,
              productName: orderItem.productname,
              success: false,
              error: `PlatformStock record not found for product on ${PLATFORM_NAME} platform. Payment initiation validation should have prevented this.`,
              error_code: "PLATFORMSTOCK_NOT_FOUND",
              critical: true, // This indicates a validation bypass
            });
            continue;
          }

          // STEP 2: Get current platformstock quantities
          // NOTE: NO availability check here - stock was already validated and locked during initiation
          // This is a CONVERSION step (lockqty → orderedqty), not a new lock
          const currentAvailableQty = platformStock.availableqty || 0;
          const currentLockQty = platformStock.lockqty || 0;
          const currentOrderedQty = platformStock.orderedqty || 0;

          logger.info(
            {
              productId,
              platform: PLATFORM_NAME,
              orderId: orderData.id,
              requestedQuantity,
              currentPlatformStock: {
                availableqty: currentAvailableQty,
                lockqty: currentLockQty,
                orderedqty: currentOrderedQty,
              },
              note: "Stock was already locked during initiation - now converting to order",
            },
            "Retrieved platformstock for lock-to-order conversion"
          );

          // STEP 3: Convert locked quantity to ordered quantity
          // NOTE: Stock was already locked during payment initiation
          // availableqty: NO CHANGE (already reduced during locking)
          // lockqty: DECREASE to 0 (unlock - convert to order)
          // orderedqty: INCREASE (confirm order)

          // Calculate quantity to convert (minimum of locked qty and requested qty)
          const quantityToConvert = Math.min(requestedQuantity, currentLockQty);

          // Warn if trying to unlock more than locked
          if (requestedQuantity > currentLockQty) {
            logger.warn(
              {
                productId,
                orderId: orderData.id,
                requestedQuantity,
                currentLockQty,
                quantityToConvert,
                warning:
                  "Requested quantity exceeds locked quantity - using locked quantity only",
              },
              "Lock quantity mismatch detected"
            );
          }

          // Ensure no negative values - CRITICAL for data integrity
          // availableqty: NO CHANGE (already reduced during locking)
          const newPlatformAvailableQty = Math.max(0, currentAvailableQty);
          // lockqty: DECREASE to 0 (unlock - convert to order)
          const newPlatformLockQty = Math.max(
            0,
            currentLockQty - quantityToConvert
          ); // Unlock, NEVER negative
          // orderedqty: INCREASE (confirm order)
          const newPlatformOrderedQty = currentOrderedQty + quantityToConvert;

          // Determine platform status based on available quantity
          let newPlatformStatus: string;
          if (newPlatformAvailableQty <= 0) {
            newPlatformStatus = "out_of_stock";
          } else if (
            newPlatformAvailableQty >= 1 &&
            newPlatformAvailableQty <= 5
          ) {
            newPlatformStatus = "low_stock";
          } else {
            newPlatformStatus = "in_stock";
          }

          logger.info(
            {
              orderId: orderData.id,
              productId: productId,
              platform: PLATFORM_NAME,
              beforePlatformUpdate: {
                availableqty: currentAvailableQty,
                lockqty: currentLockQty,
                orderedqty: currentOrderedQty,
                platformstatus: platformStock.platformstatus,
              },
              afterPlatformUpdate: {
                availableqty: newPlatformAvailableQty,
                lockqty: newPlatformLockQty,
                orderedqty: newPlatformOrderedQty,
                platformstatus: newPlatformStatus,
              },
              requestedQuantity: requestedQuantity,
              quantityToConvert: quantityToConvert,
              operation: "CONVERT_LOCK_TO_ORDER",
              note: "lockqty will be reset to 0 or reduced, never negative",
            },
            "About to convert locked quantity to ordered quantity (lockqty → orderedqty)"
          );

          // STEP 4: Update platformstock
          const updatedPlatformStock = await prisma.platformStock.update({
            where: {
              productid_platform: {
                productid: BigInt(productId),
                platform: PLATFORM_NAME,
              },
            },
            data: {
              availableqty: newPlatformAvailableQty,
              lockqty: newPlatformLockQty,
              orderedqty: newPlatformOrderedQty,
              platformstatus: newPlatformStatus,
              modifieddate: BigInt(Date.now()),
            },
          });

          // STEP 4A: Verify no negative values after update
          if (
            newPlatformLockQty < 0 ||
            newPlatformAvailableQty < 0 ||
            newPlatformOrderedQty < 0
          ) {
            logger.error(
              {
                productId,
                platform: PLATFORM_NAME,
                orderId: orderData.id,
                values: {
                  newPlatformAvailableQty,
                  newPlatformLockQty,
                  newPlatformOrderedQty,
                },
                error:
                  "CRITICAL: Negative quantity detected - this should never happen!",
              },
              "Negative quantity detected in platformstock update"
            );
          }

          logger.info(
            {
              productId,
              platform: PLATFORM_NAME,
              platformStockId: updatedPlatformStock.id,
              platformQuantityUpdate: {
                requestedQuantity,
                quantityToConvert,
                oldAvailableQty: currentAvailableQty,
                newAvailableQty: newPlatformAvailableQty,
                oldLockQty: currentLockQty,
                newLockQty: newPlatformLockQty,
                oldOrderedQty: currentOrderedQty,
                newOrderedQty: newPlatformOrderedQty,
                newPlatformStatus,
                lockQtyResetto0:
                  newPlatformLockQty === 0
                    ? "YES ✅"
                    : `NO (${newPlatformLockQty} remaining)`,
              },
            },
            "PlatformStock updated successfully - lockqty converted to orderedqty"
          );

          // STEP 5: Get current product data
          const product = await prisma.product.findUnique({
            where: { id: BigInt(productId) },
            select: {
              id: true,
              name: true,
              orderedquantity: true,
              availablequantity: true,
              quantity: true,
            },
          });
          console.log(product, "final product");
          if (!product) {
            logger.warn(
              {
                productId,
                orderId: orderData.id,
              },
              "Product not found for quantity update"
            );
            updateResults.push({
              productId: productId,
              success: false,
              error: "Product not found",
            });
            continue;
          }

          // STEP 6: Update overall product quantities
          // NOTE: Product table tracks overall quantities across all platforms
          // PlatformStock was already updated above (lock → order conversion)
          // Now update overall product quantities - ensure no negative values
          const currentProductOrderedQuantity = product.orderedquantity || 0;
          const currentProductAvailableQuantity =
            product.availablequantity || 0;

          // Ensure no negative values
          const newProductOrderedQuantity =
            currentProductOrderedQuantity + requestedQuantity;
          const newProductAvailableQuantity = Math.max(
            0,
            currentProductAvailableQuantity - requestedQuantity
          );

          // Determine product status based on new available quantity
          let newProductStatus: string;
          if (newProductAvailableQuantity <= 0) {
            newProductStatus = "out_of_stock";
          } else if (
            newProductAvailableQuantity >= 1 &&
            newProductAvailableQuantity <= 5
          ) {
            newProductStatus = "low_stock";
          } else {
            newProductStatus = "in_stock";
          }

          logger.info(
            {
              orderId: orderData.id,
              productId: productId,
              productName: product.name,
              mode: mode,
              beforeProductUpdate: {
                orderedquantity: currentProductOrderedQuantity,
                availablequantity: currentProductAvailableQuantity,
              },
              afterProductUpdate: {
                orderedquantity: newProductOrderedQuantity,
                availablequantity: newProductAvailableQuantity,
                productstatus: newProductStatus,
              },
              requestedQuantity: requestedQuantity,
            },
            "About to update product quantities and status"
          );

          // STEP 7: Update product quantities and status
          const updatedProduct = await prisma.product.update({
            where: { id: BigInt(productId) },
            data: {
              orderedquantity: newProductOrderedQuantity,
              availablequantity: newProductAvailableQuantity,
              productstatus: newProductStatus,
              modifieddate: BigInt(Date.now()),
            },
          });

          // STEP 8: Verify the updates were successful
          const verificationProduct = await prisma.product.findUnique({
            where: { id: BigInt(productId) },
            select: {
              id: true,
              name: true,
              orderedquantity: true,
              availablequantity: true,
              productstatus: true,
            },
          });

          const verificationPlatformStock =
            await prisma.platformStock.findUnique({
              where: {
                productid_platform: {
                  productid: BigInt(productId),
                  platform: PLATFORM_NAME,
                },
              },
              select: {
                availableqty: true,
                lockqty: true,
                orderedqty: true,
                platformstatus: true,
              },
            });

          logger.info(
            {
              productId,
              productName: product.name,
              orderId: orderData.id,
              mode: mode,
              platform: PLATFORM_NAME,
              productQuantityUpdate: {
                requestedQuantity,
                oldOrderedQuantity: currentProductOrderedQuantity,
                newOrderedQuantity: newProductOrderedQuantity,
                oldAvailableQuantity: currentProductAvailableQuantity,
                newAvailableQuantity: newProductAvailableQuantity,
                newProductStatus,
              },
              platformQuantityUpdate: {
                oldAvailableQty: currentAvailableQty,
                newAvailableQty: newPlatformAvailableQty,
                oldLockQty: currentLockQty,
                newLockQty: newPlatformLockQty,
                oldOrderedQty: currentOrderedQty,
                newOrderedQty: newPlatformOrderedQty,
                newPlatformStatus,
              },
              verification: {
                product: {
                  actualOrderedQuantity: verificationProduct?.orderedquantity,
                  actualAvailableQuantity:
                    verificationProduct?.availablequantity,
                  actualProductStatus: verificationProduct?.productstatus,
                },
                platformStock: {
                  actualAvailableQty: verificationPlatformStock?.availableqty,
                  actualLockQty: verificationPlatformStock?.lockqty,
                  actualOrderedQty: verificationPlatformStock?.orderedqty,
                  actualPlatformStatus:
                    verificationPlatformStock?.platformstatus,
                },
              },
            },
            "Product and PlatformStock quantities updated successfully"
          );

          updateResults.push({
            productId,
            productName: product.name,
            success: true,
            productQuantityUpdate: {
              requestedQuantity,
              oldOrderedQuantity: currentProductOrderedQuantity,
              newOrderedQuantity: newProductOrderedQuantity,
              oldAvailableQuantity: currentProductAvailableQuantity,
              newAvailableQuantity: newProductAvailableQuantity,
              newProductStatus,
            },
            platformQuantityUpdate: {
              platform: PLATFORM_NAME,
              oldAvailableQty: currentAvailableQty,
              newAvailableQty: newPlatformAvailableQty,
              oldLockQty: currentLockQty,
              newLockQty: newPlatformLockQty,
              oldOrderedQty: currentOrderedQty,
              newOrderedQty: newPlatformOrderedQty,
              newPlatformStatus,
            },
            verification: {
              actualOrderedQuantity: verificationProduct?.orderedquantity,
              actualAvailableQuantity: verificationProduct?.availablequantity,
              actualProductStatus: verificationProduct?.productstatus,
            },
          });
        } catch (productError: any) {
          logger.error(
            {
              productId: orderItem?.productid,
              orderId: orderData.id,
              error: productError.message,
              stack: productError.stack,
              orderItem: orderItem,
              platform: PLATFORM_NAME,
            },
            "Error updating product and platformstock quantities"
          );

          updateResults.push({
            productId: orderItem?.productid,
            success: false,
            error: productError.message,
            isPlatformStockError:
              productError.message.includes("platformstock"),
          });
        }
      }

      const successfulUpdates = updateResults.filter((r) => r.success);
      const failedUpdates = updateResults.filter((r) => !r.success);

      logger.info(
        {
          orderId: orderData.id,
          mode: mode,
          platform: PLATFORM_NAME,
          totalProducts: originalOrderItems.length,
          successfulUpdates: successfulUpdates.length,
          failedUpdates: failedUpdates.length,
          updateResults: updateResults.map((r) => ({
            productId: r.productId,
            success: r.success,
            error: r.error,
            hasPlatformUpdate: r.platformQuantityUpdate !== undefined,
          })),
        },
        "Product and PlatformStock quantity update process completed"
      );

      return {
        success: successfulUpdates.length > 0,
        totalProducts: originalOrderItems.length,
        successfulUpdates: successfulUpdates.length,
        failedUpdates: failedUpdates.length,
        updateResults,
        platform: PLATFORM_NAME,
      };
    } catch (error: any) {
      logger.error(
        {
          orderId: orderData.id,
          mode: mode,
          platform: PLATFORM_NAME,
          error: error.message,
          stack: error.stack,
        },
        "Error in product and platformstock quantity update process"
      );

      throw error;
    }
  }

  /**
   * Cleanup expired lock (called by GCP Cloud Task)
   * POST /v1/phonepe/cleanup-lock
   *
   * This endpoint is triggered by GCP Cloud Tasks after 15 minutes of payment initiation.
   * It checks payment status and releases stock locks for abandoned/failed payments.
   */
  cleanupExpiredLock = asyncHandler(
    async (
      request: FastifyRequest<{
        Body: {
          merchantTransactionId?: string;
          merchantid?: string; // Legacy support
          createdAt?: string;
          action?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const PLATFORM_NAME = "nivapp"; // Platform name for nivapp stock management

        // Support both new and legacy payload formats
        const merchantTransactionId =
          request.body.merchantTransactionId || request.body.merchantid;

        if (!merchantTransactionId) {
          logger.error(
            { body: request.body },
            "merchantTransactionId missing in cleanup request"
          );
          return reply.code(400).send({
            success: false,
            message: "merchantTransactionId is required",
            error: "MISSING_TRANSACTION_ID",
          });
        }

        logger.info(
          {
            merchantTransactionId,
            triggeredAt: new Date().toISOString(),
            source: "GCP_CLOUD_TASK",
          },
          "Lock cleanup check triggered"
        );

        // Step 1: Check current payment status from PhonePe
        const paymentStatus = await this.phonePeService.checkPaymentStatus(
          merchantTransactionId
        );

        logger.info(
          {
            merchantTransactionId,
            paymentCode: paymentStatus.code,
            paymentMessage: paymentStatus.message,
          },
          "Payment status retrieved for cleanup check"
        );

        // Step 2: If payment successful or COD success, do nothing (lock already converted to order)
        if (
          paymentStatus.code === "PAYMENT_SUCCESS" ||
          paymentStatus.code === "SUCCESS" ||
          paymentStatus.code === "COMPLETED"
        ) {
          logger.info(
            { merchantTransactionId },
            "Payment already successful - no cleanup needed"
          );
          return reply.code(200).send({
            success: true,
            message: "Payment successful - no cleanup needed",
            action: "none",
            data: {
              merchantTransactionId,
              paymentStatus: "SUCCESS",
              lockStatus: "already_converted_to_order",
            },
          });
        }

        // Step 3: If payment still pending/initiated/failed, release locks
        if (
          paymentStatus.code === "PAYMENT_INITIATED" ||
          paymentStatus.code === "PAYMENT_PENDING" ||
          paymentStatus.code === "PAYMENT_ERROR" ||
          paymentStatus.code === "PAYMENT_DECLINED" ||
          paymentStatus.code === "PAYMENT_FAILED" ||
          paymentStatus.code === "PENDING" ||
          paymentStatus.code === "FAILED" ||
          paymentStatus.code === "CANCELLED" ||
          paymentStatus.code === "EXPIRED"
        ) {
          logger.info(
            {
              merchantTransactionId,
              paymentCode: paymentStatus.code,
            },
            "Payment not successful - releasing locks"
          );

          // Get transaction details - now using dedicated status column for better performance
          const transactions = await this.transactionService.findMany(
            { merchanttransactionid: merchantTransactionId },
            1,
            1
          );

          if (!transactions.data || transactions.data.length === 0) {
            logger.warn(
              { merchantTransactionId },
              "Transaction not found for cleanup"
            );
            return reply.code(404).send({
              success: false,
              message: "Transaction not found",
              error: "TRANSACTION_NOT_FOUND",
            });
          }

          const transaction = transactions.data[0];
          const originalPayload = transaction.transactiondata?.originalPayload;
          const orderItems = originalPayload?.order || [];

          if (orderItems.length === 0) {
            logger.warn(
              { merchantTransactionId },
              "No order items found in transaction"
            );
            return reply.code(400).send({
              success: false,
              message: "No order items found",
              error: "NO_ORDER_ITEMS",
            });
          }

          logger.info(
            {
              merchantTransactionId,
              orderItemsCount: orderItems.length,
            },
            "Starting lock release for order items"
          );

          // Step 4: Release locks atomically for all products
          const releaseResults: any[] = [];

          await prisma.$transaction(async (tx) => {
            for (const item of orderItems) {
              try {
                // Get current platformstock state
                const platformStock = await tx.platformStock.findUnique({
                  where: {
                    productid_platform: {
                      productid: BigInt(item.productid),
                      platform: PLATFORM_NAME,
                    },
                  },
                });

                if (!platformStock) {
                  logger.warn(
                    {
                      productId: item.productid,
                      merchantTransactionId,
                    },
                    "PlatformStock not found - skipping"
                  );

                  releaseResults.push({
                    productId: item.productid,
                    status: "skipped",
                    reason: "platformstock_not_found",
                  });
                  continue;
                }

                // Calculate quantity to release
                const currentLockQty = platformStock.lockqty || 0;
                const requestedQty = item.quantity;
                const quantityToRelease = Math.min(
                  requestedQty,
                  currentLockQty
                );

                if (quantityToRelease <= 0) {
                  logger.info(
                    {
                      productId: item.productid,
                      currentLockQty,
                      requestedQty,
                      merchantTransactionId,
                    },
                    "No quantity to release - lock already 0 or insufficient"
                  );

                  releaseResults.push({
                    productId: item.productid,
                    productName: item.productname || "Unknown",
                    status: "skipped",
                    reason: "no_lock_to_release",
                    currentLockQty,
                  });
                  continue;
                }

                // Calculate new quantities
                const newAvailableQty =
                  platformStock.availableqty + quantityToRelease;
                const newLockQty = Math.max(
                  0,
                  currentLockQty - quantityToRelease
                );

                // Update platformstock - release lock back to available
                await tx.platformStock.update({
                  where: {
                    productid_platform: {
                      productid: BigInt(item.productid),
                      platform: PLATFORM_NAME,
                    },
                  },
                  data: {
                    availableqty: newAvailableQty,
                    lockqty: newLockQty,
                    modifieddate: BigInt(Date.now()),
                  },
                });

                logger.info(
                  {
                    productId: item.productid,
                    productName: item.productname,
                    quantityReleased: quantityToRelease,
                    before: {
                      availableqty: platformStock.availableqty,
                      lockqty: currentLockQty,
                    },
                    after: {
                      availableqty: newAvailableQty,
                      lockqty: newLockQty,
                    },
                    merchantTransactionId,
                  },
                  "Lock released successfully for product"
                );

                releaseResults.push({
                  productId: item.productid,
                  productName: item.productname || "Unknown",
                  status: "released",
                  quantityReleased: quantityToRelease,
                  before: {
                    availableqty: platformStock.availableqty,
                    lockqty: currentLockQty,
                  },
                  after: {
                    availableqty: newAvailableQty,
                    lockqty: newLockQty,
                  },
                });
              } catch (itemError: any) {
                logger.error(
                  {
                    error: itemError.message,
                    productId: item.productid,
                    merchantTransactionId,
                  },
                  "Error releasing lock for product"
                );

                releaseResults.push({
                  productId: item.productid,
                  status: "error",
                  error: itemError.message,
                });
              }
            }
          });

          // Step 5: Update transaction status to EXPIRED (both dedicated column and JSON)
          const transactionId =
            typeof transaction.id === "bigint"
              ? transaction.id.toString()
              : String(transaction.id);

          await this.transactionService.update(transactionId, {
            status: "EXPIRED", // NEW: Update dedicated status column
            transactiondata: {
              ...transaction.transactiondata,
              status: "EXPIRED", // Keep in JSON for backward compatibility
              expiredAt: new Date().toISOString(),
              reason: "payment_timeout_or_failure",
              paymentStatusCode: paymentStatus.code,
              cleanupExecutedAt: new Date().toISOString(),
              lockReleaseResults: releaseResults,
            },
            modifieddate: Date.now(),
          });

          logger.info(
            {
              merchantTransactionId,
              productsProcessed: orderItems.length,
              productsReleased: releaseResults.filter(
                (r: any) => r.status === "released"
              ).length,
              productsSkipped: releaseResults.filter(
                (r: any) => r.status === "skipped"
              ).length,
              productsErrored: releaseResults.filter(
                (r: any) => r.status === "error"
              ).length,
            },
            "Lock cleanup completed successfully"
          );

          return reply.code(200).send({
            success: true,
            message: "Locks released successfully",
            action: "locks_released",
            data: {
              merchantTransactionId,
              paymentStatus: paymentStatus.code,
              productsProcessed: orderItems.length,
              productsReleased: releaseResults.filter(
                (r: any) => r.status === "released"
              ).length,
              releaseDetails: releaseResults,
              transactionStatus: "EXPIRED",
            },
          });
        }

        // Step 6: Unknown payment status
        logger.warn(
          {
            merchantTransactionId,
            paymentCode: paymentStatus.code,
            paymentMessage: paymentStatus.message,
          },
          "Unknown payment status - no action taken"
        );

        return reply.code(200).send({
          success: true,
          message: "No action needed - unknown payment status",
          action: "none",
          data: {
            merchantTransactionId,
            paymentStatus: paymentStatus.code,
            paymentMessage: paymentStatus.message,
          },
        });
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            stack: error.stack,
            body: request.body,
          },
          "Error in lock cleanup endpoint"
        );

        return reply.code(500).send({
          success: false,
          message: "Lock cleanup failed",
          error: error.message,
        });
      }
    }
  );

  /**
   * Check refund status
   */
  checkRefundStatus = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = request.params as { refundId: string };
        const { refundId } = params;

        logger.info({ refundId }, "Checking refund status");

        const result = await this.phonePeService.checkRefundStatus(refundId);

        if (result.success) {
          return reply.status(200).send({
            success: true,
            message: result.message,
            data: result.refundData,
          });
        } else {
          return reply.status(404).send({
            success: false,
            message: result.message,
          });
        }
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            stack: error.stack,
            params: request.params,
          },
          "Error checking refund status"
        );

        return reply.status(500).send({
          success: false,
          message: "Failed to check refund status",
          error: error.message,
        });
      }
    }
  );

  /**
   * Create SDK Order for mobile app integration
   */
  createSdkOrder = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const requestBody = request.body as {
          merchantOrderId: string;
          amount: number;
          redirectUrl: string;
          userId?: number;
          productIds?: number[];
          transactionFor?: string;
        };

        logger.info(
          {
            merchantOrderId: requestBody.merchantOrderId,
            amount: requestBody.amount,
            userId: requestBody.userId,
          },
          "Creating SDK order"
        );

        const result = await this.phonePeService.createSdkOrder(requestBody);

        if (result.success) {
          logger.info(
            {
              merchantOrderId: requestBody.merchantOrderId,
              hasOrderToken: !!result.orderToken,
              tokenLength: result.orderToken?.length || 0,
            },
            "SDK order created successfully"
          );

          return reply.status(200).send({
            success: true,
            message: result.message,
            data: {
              orderToken: result.orderToken, // ✅ JWT token for React Native SDK
              orderId: requestBody.merchantOrderId,
            },
          });
        } else {
          logger.error(
            {
              merchantOrderId: requestBody.merchantOrderId,
              error: result.error,
            },
            "Failed to create SDK order"
          );

          return reply.status(400).send({
            success: false,
            message: result.message,
            error: result.error,
          });
        }
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            stack: error.stack,
            requestBody: request.body,
          },
          "Error creating SDK order"
        );

        return reply.status(500).send({
          success: false,
          message: "Failed to create SDK order",
          error: error.message,
        });
      }
    }
  );

  /**
   * Handle PhonePe webhook notifications
   */
  handleWebhook = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const webhookPayload = request.body as any;
        const authHeader = request.headers["authorization"] as string;
        const xVerifyHeader = request.headers["x-verify"] as string;

        logger.info(
          {
            webhookPayload,
            headers: {
              authorization: authHeader ? "present" : "missing",
              xVerify: xVerifyHeader ? "present" : "missing",
            },
          },
          "PhonePe webhook received"
        );

        // Validate webhook signature using SDK
        const validationResult =
          await this.phonePeService.validateWebhookSignature(
            JSON.stringify(webhookPayload),
            authHeader || xVerifyHeader || ""
          );

        if (!validationResult.isValid) {
          logger.warn(
            {
              validationError: validationResult.error,
              webhookPayload,
            },
            "Invalid PhonePe webhook signature"
          );

          return reply.status(401).send({
            success: false,
            message: "Invalid signature",
            statusCode: 401,
          });
        }

        // Log webhook validation details
        if (validationResult.callbackResponse) {
          logger.info(
            {
              callbackResponse: {
                eventType: validationResult.callbackResponse.eventType,
                state: validationResult.callbackResponse.state,
                orderId: validationResult.callbackResponse.orderId,
                refundId: validationResult.callbackResponse.refundId,
              },
            },
            "PhonePe webhook validation successful"
          );
        }

        // Process webhook based on event type
        const eventType =
          validationResult.callbackResponse?.eventType || "PAYMENT";

        switch (eventType) {
          case "PAYMENT":
            // Handle payment webhook
            await this.handlePaymentWebhook(
              webhookPayload,
              validationResult.callbackResponse
            );
            break;
          case "REFUND":
            // Handle refund webhook
            await this.handleRefundWebhook(
              webhookPayload,
              validationResult.callbackResponse
            );
            break;
          default:
            logger.warn({ eventType }, "Unknown webhook event type");
        }

        return reply.status(200).send({
          success: true,
          message: "Webhook processed successfully",
        });
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            stack: error.stack,
            webhookPayload: request.body,
          },
          "Error processing PhonePe webhook"
        );

        return reply.status(500).send({
          success: false,
          message: "Internal server error",
          statusCode: 500,
        });
      }
    }
  );

  /**
   * Handle payment webhook
   */
  private async handlePaymentWebhook(payload: any, callbackResponse?: any) {
    try {
      const transactionId =
        payload.merchantTransactionId || callbackResponse?.orderId;

      if (!transactionId) {
        logger.warn({ payload }, "No transaction ID found in payment webhook");
        return;
      }

      logger.info(
        {
          transactionId,
          payload,
          callbackResponse,
        },
        "Processing payment webhook"
      );

      // Update transaction status
      await this.updateTransactionStatus(
        transactionId,
        callbackResponse?.state || payload.state || "PROCESSING",
        {
          ...payload,
          webhookReceived: true,
          callbackResponse,
          webhookTimestamp: new Date().toISOString(),
        }
      );
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          payload,
        },
        "Error handling payment webhook"
      );
    }
  }

  /**
   * Handle refund webhook
   */
  private async handleRefundWebhook(payload: any, callbackResponse?: any) {
    try {
      const refundId =
        payload.merchantTransactionId || callbackResponse?.refundId;

      if (!refundId) {
        logger.warn({ payload }, "No refund ID found in refund webhook");
        return;
      }

      logger.info(
        {
          refundId,
          payload,
          callbackResponse,
        },
        "Processing refund webhook"
      );

      // Update refund transaction status
      await this.updateTransactionStatus(
        refundId,
        callbackResponse?.state || payload.state || "PROCESSING",
        {
          ...payload,
          webhookReceived: true,
          callbackResponse,
          webhookTimestamp: new Date().toISOString(),
          transactionType: "refund",
        }
      );
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          payload,
        },
        "Error handling refund webhook"
      );
    }
  }

  /**
   * Convert locked component stock to ordered stock for combo products
   * Called during payment callback when payment succeeds
   * @param combo ProductId - ID of the combo product being ordered
   * @param comboQuantity - Number of combo packs ordered
   * @param orderData - Order data from callback
   * @param orderItem - Original order item
   * @param platformName - Platform name (nivapp)
   * @returns Conversion results with component details
   */
  private async convertComboComponentLocksToOrders(
    comboProductId: number,
    comboQuantity: number,
    orderData: any,
    orderItem: any,
    platformName: string
  ): Promise<{
    success: boolean;
    componentsUpdated: number;
    componentDetails: any[];
  }> {
    logger.info(
      {
        comboProductId,
        comboQuantity,
        orderId: orderData.id,
        platform: platformName,
      },
      "Converting combo component locks to orders"
    );

    // 1. Get all active components for this combo
    const components = await prisma.productBundleMap.findMany({
      where: {
        bundleproductid: BigInt(comboProductId),
        isactive: true,
      },
      include: {
        componentproduct: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!components || components.length === 0) {
      throw new Error(
        `No active components found for combo product ${comboProductId}`
      );
    }

    logger.info(
      {
        comboProductId,
        componentCount: components.length,
        components: components.map((c: any) => ({
          componentproductid: c.componentproductid,
          requiredqty: c.requiredqty,
          productname: c.componentproduct?.name,
        })),
      },
      "Retrieved combo components for lock-to-order conversion"
    );

    const componentResults = [];

    // 2. For each component, convert locks to orders
    for (const component of components) {
      const componentProductId = Number(component.componentproductid);
      const requiredQty = component.requiredqty || 1;
      const totalNeeded = requiredQty * comboQuantity;

      logger.info(
        {
          componentProductId,
          componentName: component.componentproduct?.name,
          requiredQty,
          totalNeeded,
          orderId: orderData.id,
        },
        "Processing component lock-to-order conversion"
      );

      // 2a. Get component platformstock
      const platformStock = await prisma.platformStock.findUnique({
        where: {
          productid_platform: {
            productid: BigInt(componentProductId),
            platform: platformName,
          },
        },
        select: {
          id: true,
          availableqty: true,
          lockqty: true,
          orderedqty: true,
          platformstatus: true,
        },
      });

      if (!platformStock) {
        throw new Error(
          `PlatformStock not found for component ${componentProductId} (${component.componentproduct?.name})`
        );
      }

      const currentLockQty = platformStock.lockqty || 0;
      const currentOrderedQty = platformStock.orderedqty || 0;
      const currentAvailableQty = platformStock.availableqty || 0;

      // 2b. Convert lockqty → orderedqty
      // NOTE: availableqty already reduced during initiation, so NO CHANGE here
      const quantityToConvert = Math.min(totalNeeded, currentLockQty);
      const newLockQty = Math.max(0, currentLockQty - quantityToConvert);
      const newOrderedQty = currentOrderedQty + quantityToConvert;

      // Warn if locked quantity doesn't match expected
      if (quantityToConvert < totalNeeded) {
        logger.warn(
          {
            componentProductId,
            totalNeeded,
            currentLockQty,
            quantityToConvert,
            warning:
              "Locked quantity less than expected - using available lock only",
          },
          "Component lock quantity mismatch"
        );
      }

      logger.info(
        {
          componentProductId,
          componentName: component.componentproduct?.name,
          beforeUpdate: {
            availableqty: currentAvailableQty,
            lockqty: currentLockQty,
            orderedqty: currentOrderedQty,
          },
          afterUpdate: {
            availableqty: currentAvailableQty, // NO CHANGE
            lockqty: newLockQty,
            orderedqty: newOrderedQty,
          },
          quantityToConvert,
        },
        "About to update component platformstock (lock → order)"
      );

      // 2c. Update component platformstock
      await prisma.platformStock.update({
        where: {
          productid_platform: {
            productid: BigInt(componentProductId),
            platform: platformName,
          },
        },
        data: {
          lockqty: newLockQty,
          orderedqty: newOrderedQty,
          modifieddate: BigInt(Date.now()),
        },
      });

      // 2d. Update component product.orderedquantity
      const componentProduct = await prisma.product.findUnique({
        where: { id: BigInt(componentProductId) },
        select: {
          orderedquantity: true,
          availablequantity: true,
        },
      });

      if (!componentProduct) {
        throw new Error(
          `Component product ${componentProductId} not found`
        );
      }

      const currentComponentOrderedQty = componentProduct.orderedquantity || 0;
      const newComponentOrderedQty = currentComponentOrderedQty + quantityToConvert;

      // Also update availablequantity
      const currentComponentAvailableQty = componentProduct.availablequantity || 0;
      const newComponentAvailableQty = Math.max(
        0,
        currentComponentAvailableQty - quantityToConvert
      );

      await prisma.product.update({
        where: { id: BigInt(componentProductId) },
        data: {
          orderedquantity: newComponentOrderedQty,
          availablequantity: newComponentAvailableQty,
          modifieddate: BigInt(Date.now()),
        },
      });

      componentResults.push({
        componentproductid: componentProductId,
        componentname: component.componentproduct?.name,
        requiredqty: requiredQty,
        totalConverted: quantityToConvert,
        platformStock: {
          before: {
            lockqty: currentLockQty,
            orderedqty: currentOrderedQty,
            availableqty: currentAvailableQty,
          },
          after: {
            lockqty: newLockQty,
            orderedqty: newOrderedQty,
            availableqty: currentAvailableQty, // NO CHANGE
          },
        },
        product: {
          before: {
            orderedquantity: currentComponentOrderedQty,
            availablequantity: currentComponentAvailableQty,
          },
          after: {
            orderedquantity: newComponentOrderedQty,
            availablequantity: newComponentAvailableQty,
          },
        },
      });

      logger.info(
        {
          componentProductId,
          componentName: component.componentproduct?.name,
          quantityToConvert,
          platformStockUpdate: {
            oldLockQty: currentLockQty,
            newLockQty,
            oldOrderedQty: currentOrderedQty,
            newOrderedQty,
          },
          productUpdate: {
            oldOrderedQty: currentComponentOrderedQty,
            newOrderedQty: newComponentOrderedQty,
            oldAvailableQty: currentComponentAvailableQty,
            newAvailableQty: newComponentAvailableQty,
          },
        },
        "Component lock converted to order successfully"
      );
    }

    logger.info(
      {
        comboProductId,
        componentsUpdated: componentResults.length,
        orderId: orderData.id,
      },
      "All combo component locks converted to orders successfully"
    );

    return {
      success: true,
      componentsUpdated: componentResults.length,
      componentDetails: componentResults,
    };
  }

  /**
   * Lock stock for all components of a combo product
   * @param tx - Prisma transaction client
   * @param comboProductId - Combo product ID
   * @param comboQuantity - Number of combo packs ordered
   * @param orderItem - Original order item (for logging)
   * @returns Array of lock results for each component
   */
  private async lockComboComponents(
    tx: any,
    comboProductId: number,
    comboQuantity: number,
    orderItem: any
  ): Promise<Array<{
    componentproductid: number;
    productname: string;
    requiredqty: number;
    totalNeeded: number;
    before: { availableqty: number; lockqty: number };
    after: { availableqty: number; lockqty: number };
  }>> {
    const PLATFORM_NAME = "nivapp";

    logger.info(
      {
        comboProductId,
        comboQuantity,
        orderItem: {
          productid: orderItem.productid,
          productname: orderItem.productname,
          quantity: orderItem.quantity,
        },
      },
      "Starting combo component stock locking"
    );

    // Step 1: Get all active components for this combo
    const components = await tx.productBundleMap.findMany({
      where: {
        bundleproductid: BigInt(comboProductId),
        isactive: true,
      },
      include: {
        componentproduct: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!components || components.length === 0) {
      throw new Error(
        `No active components found for combo product ${comboProductId}`
      );
    }

    logger.info(
      {
        comboProductId,
        componentCount: components.length,
        components: components.map((c: any) => ({
          componentproductid: c.componentproductid,
          requiredqty: c.requiredqty,
          productname: c.componentproduct?.name,
        })),
      },
      "Retrieved combo components for stock locking"
    );

    // Step 2: Validate ALL components have enough stock
    const validationErrors: string[] = [];
    const componentStockInfo: Array<{
      componentproductid: number;
      requiredqty: number;
      totalNeeded: number;
      available: number;
      lockqty: number;
    }> = [];

    for (const component of components) {
      const componentProductId = Number(component.componentproductid);
      const requiredQty = component.requiredqty || 1;
      const totalNeeded = requiredQty * comboQuantity;

      // Use SELECT FOR UPDATE to acquire row lock (prevents race conditions)
      const platformStockResult = await tx.$queryRaw<Array<{
        id: bigint;
        productid: bigint;
        platform: string;
        availableqty: number;
        lockqty: number;
        orderedqty: number;
      }>>`
        SELECT * FROM "platformstock"
        WHERE "productid" = ${BigInt(componentProductId)}
          AND "platform" = ${PLATFORM_NAME}
        FOR UPDATE
      `;

      if (!platformStockResult || platformStockResult.length === 0) {
        validationErrors.push(
          `PlatformStock not found for component ${componentProductId} (${component.componentproduct?.name || "Unknown"})`
        );
        continue;
      }

      const platformStock = platformStockResult[0];
      const currentAvailableQty = Number(platformStock.availableqty) || 0;
      const currentLockQty = Number(platformStock.lockqty) || 0;
      // availableqty already represents available stock, so check it directly
      const actualAvailable = currentAvailableQty;

      componentStockInfo.push({
        componentproductid: componentProductId,
        requiredqty: requiredQty,
        totalNeeded: totalNeeded,
        available: actualAvailable,
        lockqty: currentLockQty,
      });

      // Validate availability
      // Note: availableqty is the actual available stock, so we check it directly
      if (actualAvailable < totalNeeded) {
        validationErrors.push(
          `Insufficient stock for component ${componentProductId} (${component.componentproduct?.name || "Unknown"}). ` +
          `Need ${totalNeeded} units (${requiredQty} per combo × ${comboQuantity} combos), ` +
          `but only ${actualAvailable} available`
        );
      }
    }

    // If any component fails validation, throw error (rollback transaction)
    if (validationErrors.length > 0) {
      logger.error(
        {
          comboProductId,
          comboQuantity,
          validationErrors,
          componentStockInfo,
        },
        "Combo component stock validation failed"
      );

      throw new ValidationError(
        `Insufficient stock for combo product ${comboProductId}. ` +
        `Components with insufficient stock: ${validationErrors.join("; ")}`,
        `INSUFFICIENT_COMBO_STOCK - Combo Product ID: ${comboProductId}, Quantity: ${comboQuantity}`,
        validationErrors
      );
    }

    // Step 3: Lock ALL components atomically (already in transaction)
    const lockResults: Array<{
      componentproductid: number;
      productname: string;
      requiredqty: number;
      totalNeeded: number;
      before: { availableqty: number; lockqty: number };
      after: { availableqty: number; lockqty: number };
    }> = [];

    for (const component of components) {
      const componentProductId = Number(component.componentproductid);
      const requiredQty = component.requiredqty || 1;
      const totalNeeded = requiredQty * comboQuantity;

      // Get platform stock (already locked by SELECT FOR UPDATE above)
      const platformStockResult = await tx.$queryRaw<Array<{
        id: bigint;
        productid: bigint;
        platform: string;
        availableqty: number;
        lockqty: number;
        orderedqty: number;
      }>>`
        SELECT * FROM "platformstock"
        WHERE "productid" = ${BigInt(componentProductId)}
          AND "platform" = ${PLATFORM_NAME}
        FOR UPDATE
      `;

      const platformStock = platformStockResult[0];
      const currentAvailableQty = Number(platformStock.availableqty) || 0;
      const currentLockQty = Number(platformStock.lockqty) || 0;

      // Calculate new quantities
      const newAvailableQty = Math.max(0, currentAvailableQty - totalNeeded);
      const newLockQty = currentLockQty + totalNeeded;

      // Update platformstock
      await tx.platformStock.update({
        where: {
          productid_platform: {
            productid: BigInt(componentProductId),
            platform: PLATFORM_NAME,
          },
        },
        data: {
          availableqty: newAvailableQty,
          lockqty: newLockQty,
          modifieddate: BigInt(Date.now()),
        },
      });

      lockResults.push({
        componentproductid: componentProductId,
        productname: component.componentproduct?.name || "Unknown",
        requiredqty: requiredQty,
        totalNeeded: totalNeeded,
        before: {
          availableqty: currentAvailableQty,
          lockqty: currentLockQty,
        },
        after: {
          availableqty: newAvailableQty,
          lockqty: newLockQty,
        },
      });

      logger.info(
        {
          comboProductId,
          componentProductId,
          componentName: component.componentproduct?.name,
          requiredQty,
          comboQuantity,
          totalNeeded,
          before: {
            availableqty: currentAvailableQty,
            lockqty: currentLockQty,
          },
          after: {
            availableqty: newAvailableQty,
            lockqty: newLockQty,
          },
        },
        "Locked stock for combo component"
      );
    }

    logger.info(
      {
        comboProductId,
        comboQuantity,
        componentsLocked: lockResults.length,
        lockResults,
      },
      "Successfully locked stock for all combo components"
    );

    return lockResults;
  }
}
