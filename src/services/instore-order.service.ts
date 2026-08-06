import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { ValidationError } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';
import { OrdersService } from './orders.service.js';
import { gstService } from './gst.service.js';
import type { InstoreOrderInput, InstoreSearchInput } from '../schemas/instore-order.schema.js';

type DbClient = Prisma.TransactionClient | typeof prisma;

interface Availability {
  nonEcomAvailable: number;
  ecomPhysicalAvailable: number;
  ecomFallbackAvailable: number;
  totalSellable: number;
}

interface LockedStock {
  id: bigint;
  ecompublish: boolean | null;
}

interface PricedItem {
  product: {
    id: bigint;
    name: string;
    puc: string;
    price: Prisma.Decimal | null;
    discount: number | null;
    category: string | null;
    subcategory: string | null;
    iscombo: boolean | null;
  };
  quantity: number;
  originalTotal: number;
  productDiscount: number;
  subtotal: number;
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export class InstoreOrderService {
  private ordersService = new OrdersService();

  async searchCustomers({ search, limit }: InstoreSearchInput) {
    const pattern = `%${search}%`;
    const customers = await prisma.$queryRaw<Array<{
      id: number;
      firstname: string | null;
      lastname: string | null;
      useremail: string | null;
      usermobilenumber: bigint | null;
      isguest: boolean | null;
    }>>(Prisma.sql`
      SELECT id, firstname, lastname, useremail, usermobilenumber, isguest
      FROM users
      WHERE isactive IS DISTINCT FROM FALSE
        AND (
          ${search === ''}
          OR CONCAT_WS(' ', firstname, lastname) ILIKE ${pattern}
          OR COALESCE(useremail, '') ILIKE ${pattern}
          OR COALESCE(usermobilenumber::text, '') ILIKE ${pattern}
          OR id::text = ${search}
        )
      ORDER BY createddate DESC NULLS LAST, id DESC
      LIMIT ${limit}
    `);

    return customers.map((customer) => ({
      ...customer,
      usermobilenumber: customer.usermobilenumber?.toString() || null,
      name: `${customer.firstname || ''} ${customer.lastname || ''}`.trim(),
    }));
  }

  async searchProducts({ search, limit }: InstoreSearchInput) {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { puc: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {};

    const products = await prisma.product.findMany({
      where,
      take: limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        puc: true,
        price: true,
        discount: true,
        category: true,
        subcategory: true,
        iscombo: true,
      },
    });

    return Promise.all(products.map(async (product) => {
      const availability = product.iscombo
        ? await this.getComboAvailability(prisma, product.id)
        : await this.getAvailability(prisma, product.id, product.puc);

      return {
        id: Number(product.id),
        name: product.name,
        puc: product.puc,
        price: Number(product.price || 0),
        discount: Number(product.discount || 0),
        category: product.category,
        subcategory: product.subcategory,
        iscombo: Boolean(product.iscombo),
        non_ecom_available: availability.nonEcomAvailable,
        ecom_fallback_available: availability.ecomFallbackAvailable,
        total_sellable: availability.totalSellable,
      };
    }));
  }

  async createOrder(input: InstoreOrderInput, inventoryUser: { id: number; location?: string }) {
    const merchantTransactionId = `INSTORE-${input.client_reference}`;
    const existing = await prisma.orders.findUnique({
      where: { merchanttransactionid: merchantTransactionId },
      include: { orderline: true, users: true },
    });

    if (existing) {
      if (existing.order_type !== 'instore') {
        throw new ValidationError('This checkout reference is already in use');
      }
      return this.finishOrderResponse(existing, false);
    }

    const created = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.orders.findUnique({
        where: { merchanttransactionid: merchantTransactionId },
        include: { orderline: true, users: true },
      });
      if (duplicate) return duplicate;

      const customer = await this.resolveCustomer(tx, input.customer);
      const productIds = input.items.map((item) => BigInt(item.product_id));
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          puc: true,
          price: true,
          discount: true,
          category: true,
          subcategory: true,
          iscombo: true,
        },
      });
      const productsById = new Map(products.map((product) => [Number(product.id), product]));

      const pricedItems: PricedItem[] = input.items
        .map((item) => {
          const product = productsById.get(item.product_id);
          if (!product) throw new ValidationError(`Product ${item.product_id} was not found`);
          const unitPrice = Number(product.price || 0);
          if (unitPrice <= 0) throw new ValidationError(`${product.name} does not have a valid selling price`);
          const unitDiscount = Math.min(Math.max(Number(product.discount || 0), 0), unitPrice);
          const originalTotal = roundMoney(unitPrice * item.quantity);
          const productDiscount = roundMoney(unitDiscount * item.quantity);
          return {
            product,
            quantity: item.quantity,
            originalTotal,
            productDiscount,
            subtotal: roundMoney(originalTotal - productDiscount),
          };
        })
        .sort((left, right) => Number(left.product.id - right.product.id));

      const originalTotal = roundMoney(pricedItems.reduce((sum, item) => sum + item.originalTotal, 0));
      const productDiscountTotal = roundMoney(pricedItems.reduce((sum, item) => sum + item.productDiscount, 0));
      const discountedSubtotal = roundMoney(originalTotal - productDiscountTotal);
      const manualDiscountTotal = this.calculateManualDiscount(input, discountedSubtotal);
      const orderAmount = roundMoney(discountedSubtotal - manualDiscountTotal);
      const totalQuantity = pricedItems.reduce((sum, item) => sum + item.quantity, 0);
      const now = Date.now();
      const orderNumber = `INS-${now}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const transactionId = `INST-${randomUUID()}`;
      const location = input.store_location || inventoryUser.location || 'In-store';
      const statusHistory = [{
        previous_status: 'order_placed',
        new_status: 'delivered',
        changed_date: now,
        source: 'inventory_user',
        inventory_user_id: inventoryUser.id,
        is_active: true,
      }];

      const createdTransaction = await tx.transaction.create({
        data: {
          transactionid: transactionId,
          merchanttransactionid: merchantTransactionId,
          userid: customer.id,
          productid: pricedItems.map((item) => Number(item.product.id)),
          name: `${customer.firstname || ''} ${customer.lastname || ''}`.trim(),
          mobilenumber: customer.usermobilenumber,
          amount: orderAmount,
          transactionfor: 'instore_order',
          transactiondata: {
            payment_method: input.payment_method,
            payment_reference: input.payment_reference || null,
            manual_discount: input.manual_discount,
            created_by_inventory_user_id: inventoryUser.id,
            store_location: location,
          },
          createddate: now,
          modifieddate: now,
        },
      });

      const order = await tx.orders.create({
        data: {
          userid: customer.id,
          orderamount: orderAmount,
          orderid: orderNumber,
          orderstatus: 'delivered',
          quantity: totalQuantity,
          transactionid: createdTransaction.transactionid,
          productamount: discountedSubtotal,
          discountamount: roundMoney(productDiscountTotal + manualDiscountTotal),
          deliveryfrom: location,
          ispaymentsucceed: true,
          merchanttransactionid: merchantTransactionId,
          productid: pricedItems.map((item) => Number(item.product.id)),
          mode: input.payment_method,
          vendor: 'INSTORE',
          order_type: 'instore',
          created_by_inventory_user_id: inventoryUser.id,
          manual_discount_total: manualDiscountTotal,
          manual_discount_reason: manualDiscountTotal > 0 ? input.manual_discount.reason || null : null,
          delivereddate: now,
          createddate: now,
          modifieddate: now,
          promotion_discount_total: 0,
          wallet_discount_total: 0,
          original_total: originalTotal,
          shipping_cost: 0,
          status_history: statusHistory,
        },
      });

      const affectedProducts = new Map<number, string>();
      let allocatedManualDiscount = 0;

      for (let index = 0; index < pricedItems.length; index += 1) {
        const item = pricedItems[index]!;
        const isLast = index === pricedItems.length - 1;
        const lineManualDiscount = isLast
          ? roundMoney(manualDiscountTotal - allocatedManualDiscount)
          : roundMoney(manualDiscountTotal * (item.subtotal / discountedSubtotal || 0));
        allocatedManualDiscount = roundMoney(allocatedManualDiscount + lineManualDiscount);
        const lineAmount = roundMoney(item.subtotal - lineManualDiscount);
        const lineNumber = `INSL-${now}-${index + 1}-${randomUUID().slice(0, 6).toUpperCase()}`;

        const orderline = await tx.orderline.create({
          data: {
            orderid: order.id,
            orderlinenumber: lineNumber,
            productid: item.product.id,
            quantity: item.quantity,
            userid: customer.id,
            productamount: item.subtotal,
            discountamount: roundMoney(item.productDiscount + lineManualDiscount),
            orderamount: lineAmount,
            merchanttransactionid: merchantTransactionId,
            productname: item.product.name,
            productcategory: item.product.category || item.product.subcategory,
            delivereddate: now,
            orderstatus: 'delivered',
            uniqueordderid: order.orderid,
            deliveryfrom: location,
            location,
            ordereddate: now,
            original_price: Number(item.product.price || 0),
            product_discount_amount: item.productDiscount,
            promotion_discount_amount: 0,
            manual_discount_amount: lineManualDiscount,
            shipping_cost: 0,
            createddate: now,
            modifieddate: now,
            status_history: statusHistory,
          },
        });

        if (item.product.iscombo) {
          const components = await tx.productBundleMap.findMany({
            where: { bundleproductid: item.product.id, isactive: true },
            include: { componentproduct: { select: { id: true, puc: true, name: true } } },
            orderBy: { componentproductid: 'asc' },
          });
          if (components.length === 0) throw new ValidationError(`${item.product.name} has no active combo components`);

          for (const component of components) {
            const required = component.requiredqty * item.quantity;
            await this.allocateStock(
              tx,
              component.componentproduct.id,
              component.componentproduct.puc,
              component.componentproduct.name,
              required,
              order.orderid!,
              orderline.orderlinenumber!,
              now,
            );
            affectedProducts.set(Number(component.componentproduct.id), component.componentproduct.puc);
          }
        } else {
          await this.allocateStock(
            tx,
            item.product.id,
            item.product.puc,
            item.product.name,
            item.quantity,
            order.orderid!,
            orderline.orderlinenumber!,
            now,
          );
          affectedProducts.set(Number(item.product.id), item.product.puc);
        }
      }

      for (const [productId, puc] of affectedProducts) {
        await this.refreshInventoryCounters(tx, productId, puc, now);
      }

      return tx.orders.findUniqueOrThrow({
        where: { id: order.id },
        include: { orderline: true, users: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 90000 });

    return this.finishOrderResponse(created, true);
  }

  private async finishOrderResponse(order: any, generateInvoice: boolean) {
    let invoiceUrl = order.order_invoice_url || null;
    if (generateInvoice) {
      try {
        const storePincode = await gstService.getWarehousePincode();
        if (storePincode && order.orderline?.length) {
          const gst = await gstService.calculateGstForOrder(
            order.orderline.map((line: any) => ({
              id: line.id,
              productid: Number(line.productid),
              orderamount: Number(line.orderamount || 0),
            })),
            0,
            Number(order.orderamount || 0),
            storePincode,
            storePincode,
          );
          await gstService.updateOrderlinesWithGst(gst.orderlineGst);
          await gstService.updateOrderWithGst(order.id, gst.orderTotals);
        }
        invoiceUrl = await this.ordersService.generateInvoice(order.id);
      } catch (error) {
        logger.warn({ error, orderId: order.id }, 'In-store order completed but invoice/GST generation could not finish');
      }
    }

    return {
      id: order.id,
      orderid: order.orderid,
      order_type: order.order_type,
      orderstatus: order.orderstatus,
      orderamount: Number(order.orderamount || 0),
      discountamount: Number(order.discountamount || 0),
      manual_discount_total: Number(order.manual_discount_total || 0),
      mode: order.mode,
      userid: order.userid,
      customer_name: order.users
        ? `${order.users.firstname || ''} ${order.users.lastname || ''}`.trim()
        : '',
      customer_mobile: order.users?.usermobilenumber?.toString() || '',
      order_invoice_url: invoiceUrl,
      created: generateInvoice,
    };
  }

  private calculateManualDiscount(input: InstoreOrderInput, subtotal: number) {
    const discount = input.manual_discount;
    if (discount.type === 'none' || discount.value === 0) return 0;
    const amount = discount.type === 'percentage'
      ? roundMoney(subtotal * discount.value / 100)
      : roundMoney(discount.value);
    if (amount > subtotal) throw new ValidationError('Manual discount cannot exceed the merchandise subtotal');
    return amount;
  }

  private async resolveCustomer(tx: Prisma.TransactionClient, input: InstoreOrderInput['customer']) {
    if ('customer_id' in input) {
      const customer = await tx.users.findFirst({ where: { id: input.customer_id, isactive: { not: false } } });
      if (!customer) throw new ValidationError('The selected customer is no longer available');
      return customer;
    }

    await tx.$queryRaw(Prisma.sql`
      SELECT 1 AS acquired
      FROM pg_advisory_xact_lock(hashtext(${input.mobile}))
    `);
    const mobile = BigInt(input.mobile);
    const existing = await tx.users.findFirst({ where: { usermobilenumber: mobile, isactive: { not: false } }, orderBy: { id: 'asc' } });
    if (existing) {
      if (!existing.firstname?.trim()) {
        return tx.users.update({ where: { id: existing.id }, data: { firstname: input.name, modifieddate: Date.now() } });
      }
      return existing;
    }

    return tx.users.create({
      data: {
        firstname: input.name,
        usermobilenumber: mobile,
        isguest: true,
        isactive: true,
        createddate: Date.now(),
        modifieddate: Date.now(),
      },
    });
  }

  private async getAvailability(client: DbClient, productId: bigint, puc: string): Promise<Availability> {
    const [counts, platformStock] = await Promise.all([
      client.stock.groupBy({
        by: ['ecompublish'],
        where: {
          puc,
          platform: { equals: 'nivapp', mode: Prisma.QueryMode.insensitive },
          stockstatus: { equals: 'available', mode: Prisma.QueryMode.insensitive },
          isdeleted: { not: true },
          isarchive: { not: true },
        },
        _count: { _all: true },
      }),
      client.platformStock.findUnique({
        where: { productid_platform: { productid: productId, platform: 'nivapp' } },
        select: { orderedqty: true, lockqty: true },
      }),
    ]);
    const nonEcom = counts.find((row) => row.ecompublish !== true)?._count._all || 0;
    const ecom = counts.find((row) => row.ecompublish === true)?._count._all || 0;
    const protectedQuantity = Number(platformStock?.orderedqty || 0) + Number(platformStock?.lockqty || 0);
    const fallback = Math.max(0, ecom - protectedQuantity);
    return {
      nonEcomAvailable: nonEcom,
      ecomPhysicalAvailable: ecom,
      ecomFallbackAvailable: fallback,
      totalSellable: nonEcom + fallback,
    };
  }

  private async getComboAvailability(client: DbClient, comboProductId: bigint): Promise<Availability> {
    const components = await client.productBundleMap.findMany({
      where: { bundleproductid: comboProductId, isactive: true },
      include: { componentproduct: { select: { id: true, puc: true } } },
    });
    if (!components.length) return { nonEcomAvailable: 0, ecomPhysicalAvailable: 0, ecomFallbackAvailable: 0, totalSellable: 0 };
    const availability = await Promise.all(components.map(async (component) => ({
      required: component.requiredqty,
      stock: await this.getAvailability(client, component.componentproduct.id, component.componentproduct.puc),
    })));
    const nonEcom = Math.min(...availability.map(({ required, stock }) => Math.floor(stock.nonEcomAvailable / required)));
    const total = Math.min(...availability.map(({ required, stock }) => Math.floor(stock.totalSellable / required)));
    return {
      nonEcomAvailable: nonEcom,
      ecomPhysicalAvailable: Math.max(0, total - nonEcom),
      ecomFallbackAvailable: Math.max(0, total - nonEcom),
      totalSellable: total,
    };
  }

  private async allocateStock(
    tx: Prisma.TransactionClient,
    productId: bigint,
    puc: string,
    productName: string,
    quantity: number,
    orderNumber: string,
    orderlineNumber: string,
    now: number,
  ) {
    const platformRows = await tx.$queryRaw<Array<{ id: bigint; orderedqty: number; lockqty: number | null }>>(Prisma.sql`
      SELECT id, orderedqty, lockqty
      FROM platformstock
      WHERE productid = ${productId} AND LOWER(platform) = 'nivapp'
      FOR UPDATE
    `);
    const platformStock = platformRows[0];

    const candidates = await tx.$queryRaw<LockedStock[]>(Prisma.sql`
      SELECT id, ecompublish
      FROM stock
      WHERE puc = ${puc}
        AND LOWER(platform) = 'nivapp'
        AND LOWER(stockstatus) = 'available'
        AND isdeleted IS DISTINCT FROM TRUE
        AND isarchive IS DISTINCT FROM TRUE
      ORDER BY ecompublish ASC, createddate ASC NULLS LAST, id ASC
      FOR UPDATE
    `);
    const nonEcom = candidates.filter((stock) => stock.ecompublish !== true);
    const ecom = candidates.filter((stock) => stock.ecompublish === true);
    const protectedQuantity = Number(platformStock?.orderedqty || 0) + Number(platformStock?.lockqty || 0);
    const freeEcom = Math.max(0, ecom.length - protectedQuantity);
    const selected = [
      ...nonEcom.slice(0, quantity),
      ...ecom.slice(0, Math.max(0, quantity - nonEcom.length)).slice(0, freeEcom),
    ];

    if (selected.length < quantity) {
      throw new ValidationError(
        `${productName} has insufficient NIVAPP stock. Available now: ${nonEcom.length + freeEcom}, requested: ${quantity}`,
      );
    }

    await tx.stock.updateMany({
      where: { id: { in: selected.map((stock) => stock.id) } },
      data: {
        stockstatus: 'sold',
        orderid: orderNumber,
        orderlinenumber: orderlineNumber,
        solddate: now,
        modifieddate: now,
      },
    });
  }

  private async refreshInventoryCounters(
    tx: Prisma.TransactionClient,
    productId: number,
    puc: string,
    now: number,
  ) {
    const grouped = await tx.stock.groupBy({
      by: ['stockstatus', 'ecompublish'],
      where: { puc, isdeleted: { not: true }, isarchive: { not: true } },
      _count: { _all: true },
    });
    const count = (predicate: (row: typeof grouped[number]) => boolean) =>
      grouped.filter(predicate).reduce((sum, row) => sum + row._count._all, 0);
    const totalActive = count(() => true);
    const physicalAvailable = count((row) => row.stockstatus.toLowerCase() !== 'sold');
    const sold = count((row) => row.stockstatus.toLowerCase() === 'sold');
    const ecomAvailable = count((row) => row.stockstatus.toLowerCase() === 'available' && row.ecompublish === true);
    const product = await tx.product.findUniqueOrThrow({ where: { id: BigInt(productId) }, select: { orderedquantity: true } });
    const productAvailable = Math.max(0, ecomAvailable - Number(product.orderedquantity || 0));

    await tx.product.update({
      where: { id: BigInt(productId) },
      data: {
        quantity: physicalAvailable,
        soldquantity: sold,
        ecompublishedquantity: ecomAvailable,
        availablequantity: productAvailable,
        productstatus: productAvailable === 0 ? 'out_of_stock' : productAvailable <= 5 ? 'low_stock' : 'in_stock',
        modifieddate: now,
      },
    });

    const nivappGrouped = await tx.stock.groupBy({
      by: ['stockstatus', 'ecompublish'],
      where: {
        puc,
        platform: { equals: 'nivapp', mode: Prisma.QueryMode.insensitive },
        isdeleted: { not: true },
        isarchive: { not: true },
      },
      _count: { _all: true },
    });
    const nivappCount = (predicate: (row: typeof nivappGrouped[number]) => boolean) =>
      nivappGrouped.filter(predicate).reduce((sum, row) => sum + row._count._all, 0);
    const nivappTotal = nivappCount(() => true);
    const nivappSold = nivappCount((row) => row.stockstatus.toLowerCase() === 'sold');
    const nivappEcom = nivappCount((row) => row.stockstatus.toLowerCase() === 'available' && row.ecompublish === true);
    const current = await tx.platformStock.findUnique({
      where: { productid_platform: { productid: BigInt(productId), platform: 'nivapp' } },
    });
    const ordered = Number(current?.orderedqty || 0);
    const locked = Number(current?.lockqty || 0);
    const available = Math.max(0, nivappEcom - ordered - locked);

    await tx.platformStock.upsert({
      where: { productid_platform: { productid: BigInt(productId), platform: 'nivapp' } },
      create: {
        productid: BigInt(productId),
        platform: 'nivapp',
        totalqty: nivappTotal,
        soldqty: nivappSold,
        ecomqty: nivappEcom,
        orderedqty: ordered,
        lockqty: locked,
        availableqty: available,
        platformstatus: available === 0 ? 'out_of_stock' : available <= 5 ? 'low_stock' : 'in_stock',
        createddate: now,
        modifieddate: now,
      },
      update: {
        totalqty: nivappTotal,
        soldqty: nivappSold,
        ecomqty: nivappEcom,
        availableqty: available,
        platformstatus: available === 0 ? 'out_of_stock' : available <= 5 ? 'low_stock' : 'in_stock',
        modifieddate: now,
      },
    });
  }
}
