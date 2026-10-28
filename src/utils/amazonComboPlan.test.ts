import assert from 'node:assert/strict';
import test from 'node:test';
import { amazonComboComponentKey, buildComboPlan, parseCsv, type ComboCsvRow, type ComboPlanProduct } from './amazonComboPlan.js';

const product = (id: bigint, puc: string, extra: Partial<ComboPlanProduct> = {}): ComboPlanProduct => ({
  id, puc, brand: 'nivaana', category: 'pooja_essentials', subcategory: 'incense_sticks', fragnancetype: puc.toLowerCase(),
  hsn_code: '33074100', gst_rate: '5.00', iscombo: false, ...extra,
});
const row = (sku: string, pucs: string, extra: Partial<ComboCsvRow> = {}): ComboCsvRow => ({
  group: '4. Combo needed (components exist)', family: 'Incense sticks', sku, asin: `ASIN-${sku}`, price: '299',
  scents: 'Kasturi + Black Oudh', inventory_puc: pucs, title: 'Title', ...extra,
});
const products = new Map([
  ['NIV-0004', product(4n, 'NIV-0004')],
  ['NIV-0012', product(12n, 'NIV-0012')],
  ['NIV-0005', product(5n, 'NIV-0005')],
  ['NIV-0079', product(79n, 'NIV-0079', { subcategory: 'bath_body', category: 'bath_body', hsn_code: '34011190', gst_rate: '18.00' })],
  ['NIV-0034', product(34n, 'NIV-0034', { hsn_code: '34011190' })],
  ['AUO-0098', product(98n, 'AUO-0098', { iscombo: true, brand: 'auora' })],
]);

test('CSV parser keeps quoted commas, escaped quotes and CRLF rows', () => {
  const rows = parseCsv('group,title\r\n"4. Combo","Kasturi, Black Oudh ""Premium"""\r\n1. Map,Plain\r\n');
  assert.deepEqual(rows, [{ group: '4. Combo', title: 'Kasturi, Black Oudh "Premium"' }, { group: '1. Map', title: 'Plain' }]);
});

test('plans one combo per component set, with the ProductService input', () => {
  const plan = buildComboPlan([
    row('A1', 'NIV-0004 + NIV-0012'),
    row('A2', 'NIV-0012 + NIV-0004', { price: '0' }), // same combo listed twice on Amazon
    row('SINGLE', 'NIV-0004', { group: '1. Map to one product' }), // not a combo row: ignored
  ], products, new Map());
  assert.equal(plan.length, 1);
  const [entry] = plan;
  assert.equal(entry!.action, 'CREATE');
  assert.deepEqual(entry!.listings.map((listing) => listing.sku), ['A1', 'A2']);
  assert.deepEqual(entry!.input, {
    name: 'Incense Sticks Combo Pack | Kasturi & Black Oudh',
    remarks: 'Incense Sticks Combo Pack | Kasturi & Black Oudh',
    shortname: 'NIVAANA Incense Sticks Combo - Kasturi & Black Oudh',
    brand: 'nivaana',
    category: 'pooja_essentials',
    subcategory: 'incense_sticks',
    pack: 'pack_of_2',
    fragnancetype: 'niv-0004,niv-0012',
    hsn_code: '33074100',
    gst_rate: 5,
    price: 299,
    asin: 'ASIN-A1',
    iscombo: true,
    combotype: 'fixed',
    components: [{ productid: '4', requiredqty: 1 }, { productid: '12', requiredqty: 1 }],
  });
});

test('an existing combo with the same components is reported, not created again', () => {
  const existing = new Map([[amazonComboComponentKey([12n, 4n]), 'NIV-0200']]);
  const [entry] = buildComboPlan([row('A1', 'NIV-0004 + NIV-0012')], products, existing);
  assert.equal(entry!.action, 'EXISTS');
  assert.equal(entry!.existingPuc, 'NIV-0200');
});

test('group 3 rows drop the listed combo PUC and match its components', () => {
  const existing = new Map([[amazonComboComponentKey([4n, 12n]), 'AUO-0098']]);
  const [entry] = buildComboPlan([row('Pack6', 'AUO-0098 + NIV-0004 + NIV-0012', { group: '3. Combo exists in Inventory' })], products, existing);
  assert.equal(entry!.action, 'EXISTS');
  assert.deepEqual(entry!.componentPucs, ['NIV-0004', 'NIV-0012']);
});

test('skips what cannot be created safely, with the reason', () => {
  const reasons = buildComboPlan([
    row('MISSING', 'NIV-0004 + NIV-9999'),
    row('MIXED', 'NIV-0004 + NIV-0079'),
    row('TAX', 'NIV-0004 + NIV-0034'),
    row('NESTED', 'NIV-0004 + AUO-0098'),
    row('NOPRICE', 'NIV-0005 + NIV-0012', { price: '' }),
  ], products, new Map()).map((entry) => [entry.action, entry.listings[0]!.sku, entry.reason]);
  assert.deepEqual(reasons.map(([action]) => action), ['SKIP', 'SKIP', 'SKIP', 'SKIP', 'SKIP']);
  const bySku = Object.fromEntries(reasons.map(([, sku, reason]) => [sku, reason]));
  assert.match(bySku.MISSING!, /not in this database: NIV-9999/);
  assert.match(bySku.MIXED!, /differ in brand, category or subcategory/);
  assert.match(bySku.TAX!, /different HSN code or GST rate/);
  assert.match(bySku.NESTED!, /cannot contain another combo/);
  assert.match(bySku.NOPRICE!, /No Amazon price/);
});
