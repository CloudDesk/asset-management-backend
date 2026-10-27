import { prisma } from '../models/prisma.js';

/**
 * Amazon combo listings (AMZ-PLAN-27): a combo product has no stock of its own, so its Amazon
 * stock comes from its components (`productbundlemap`) and its orders reserve / sell / release
 * each component. Single products are unchanged. Plan: docs/Amazon/Amazon_Master.md AMZ-PLAN-27.
 */

type PrismaReader = Pick<typeof prisma, 'product' | 'productBundleMap' | 'platformStock'>;

export type AmazonComboComponent = { productId: bigint; requiredQty: number };

export class AmazonComboStockError extends Error {
  constructor(message: string, readonly code = 'AMAZON_COMBO_NO_COMPONENTS') {
    super(message);
    this.name = 'AmazonComboStockError';
  }
}

/** Sets a combo can make: the lowest of (component stock ÷ quantity per combo); 0 without components */
export const calculateComboAvailable = (components: Array<{ available: number; requiredQty: number }>) =>
  components.length === 0
    ? 0
    : Math.min(...components.map((component) =>
      Math.floor(Math.max(0, Math.trunc(component.available)) / Math.max(1, Math.trunc(component.requiredQty)))));

/** Active components of the combos among `productIds`; products that are not combos are absent */
export async function loadComboComponents(productIds: bigint[], client: PrismaReader = prisma) {
  const combos = new Map<string, AmazonComboComponent[]>();
  const unique = [...new Set(productIds.map(String))].map(BigInt);
  if (unique.length === 0) return combos;
  const comboProducts = await client.product.findMany({
    where: { id: { in: unique }, iscombo: true },
    select: { id: true },
  });
  if (comboProducts.length === 0) return combos;
  const maps = await client.productBundleMap.findMany({
    where: { bundleproductid: { in: comboProducts.map((product) => product.id) }, isactive: true },
    select: { bundleproductid: true, componentproductid: true, requiredqty: true },
    orderBy: { id: 'asc' },
  });
  for (const product of comboProducts) combos.set(String(product.id), []);
  for (const map of maps) {
    combos.get(String(map.bundleproductid))!.push({ productId: map.componentproductid, requiredQty: Math.max(1, map.requiredqty) });
  }
  return combos;
}

/**
 * Nivaana Amazon stock per product: the product's own Amazon platform stock, or for a combo the
 * sets its components allow. A product without Amazon platform stock (and not a combo) is absent.
 */
export async function amazonAvailableByProduct(productIds: bigint[], client: PrismaReader = prisma) {
  const combos = await loadComboComponents(productIds, client);
  const componentIds = [...combos.values()].flat().map((component) => component.productId);
  const stockIds = [...new Set([...productIds, ...componentIds].map(String))].map(BigInt);
  const stocks = stockIds.length === 0 ? [] : await client.platformStock.findMany({
    where: { productid: { in: stockIds }, platform: { equals: 'amazon', mode: 'insensitive' } },
    select: { productid: true, availableqty: true },
  });
  const own = new Map(stocks.map((stock) => [String(stock.productid), Math.max(0, Math.trunc(stock.availableqty))]));
  const available = new Map<string, number>();
  for (const productId of productIds) {
    const key = String(productId);
    const components = combos.get(key);
    if (components) {
      available.set(key, calculateComboAvailable(components.map((component) => ({
        available: own.get(String(component.productId)) ?? 0,
        requiredQty: component.requiredQty,
      }))));
    } else if (own.has(key)) {
      available.set(key, own.get(key)!);
    }
  }
  return { available, combos };
}

/**
 * Stock lines one order item moves: the mapped product itself, or each combo component with
 * quantity × its required quantity. `comboProductId` is the mapped combo (null for single products).
 */
export function expandAmazonStockLines(
  productId: bigint,
  quantity: number,
  combos: Map<string, AmazonComboComponent[]>
): Array<{ productId: bigint; quantity: number; comboProductId: bigint | null }> {
  const components = combos.get(String(productId));
  if (!components) return [{ productId, quantity, comboProductId: null }];
  if (components.length === 0) {
    throw new AmazonComboStockError(`Combo product ${productId} has no active components; map its components in Inventory first`);
  }
  return components.map((component) => ({
    productId: component.productId,
    quantity: quantity * component.requiredQty,
    comboProductId: productId,
  }));
}
