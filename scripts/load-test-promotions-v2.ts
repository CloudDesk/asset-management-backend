import { PromotionRuleV2Schema } from '../src/schemas/promotions-v2.schema.js';
import { evaluatePromotionQuote, type PromotionCampaign, type PromotionCartLine } from '../src/services/promotion-v2-engine.js';

const lines: PromotionCartLine[] = Array.from({ length: 20 }, (_, index) => ({
  id: String(index + 1), quantity: 5, unitPricePaise: 10_000 + index * 100, stock: 100,
  facets: { CATEGORY: [`category-${index % 5}`], SUBCATEGORY: [`subcategory-${index % 10}`] },
}));
const campaigns: PromotionCampaign[] = Array.from({ length: 120 }, (_, index) => ({
  promotionId: index + 1, ruleVersion: 1, name: `Load offer ${index + 1}`,
  rule: PromotionRuleV2Schema.parse({
    schema_version: 2,
    qualifier: { scope: { include: [{ facet: 'CATEGORY', values: [`category-${index % 5}`] }], exclude: [], group_operator: 'OR' }, metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 2 },
    benefit: { type: 'PERCENT_OFF', value: (index % 30) + 1, target: 'ALL_QUALIFYING_UNITS' },
    stacking: { stackable: false, exclusive_group: 'MERCHANDISE_DISCOUNT', item_reuse: 'DISALLOW', selection_strategy: 'BEST_CUSTOMER_VALUE', priority: index % 10 },
  }),
}));

const samples: number[] = [];
for (let iteration = 0; iteration < 100; iteration += 1) {
  const start = performance.now();
  evaluatePromotionQuote(lines, campaigns, lines);
  samples.push(performance.now() - start);
}
samples.sort((left, right) => left - right);
console.log(JSON.stringify({
  iterations: samples.length,
  active_promotions: campaigns.length,
  cart_units: lines.reduce((sum, line) => sum + line.quantity, 0),
  p50_ms: Number(samples[Math.floor(samples.length * 0.5)]!.toFixed(2)),
  p95_ms: Number(samples[Math.floor(samples.length * 0.95)]!.toFixed(2)),
  p99_ms: Number(samples[Math.floor(samples.length * 0.99)]!.toFixed(2)),
}, null, 2));
