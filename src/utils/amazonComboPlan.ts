/**
 * Plan for creating the Inventory combos that Amazon combo listings need (AMZ-PLAN-27 P5).
 * Input: the reviewed listing comparison CSV (docs/Amazon/Amazon_Listings_vs_Inventory_UAT_2026-10-27.csv)
 * and the target database's products. Output: one entry per distinct combo — create, already exists,
 * or skip with the reason. Used by scripts/create-amazon-combos.ts; no database access here.
 */

export type ComboCsvRow = {
  group: string;
  family: string;
  sku: string;
  asin: string;
  price: string;
  scents: string;
  inventory_puc: string;
  title: string;
};

export type ComboPlanProduct = {
  id: bigint;
  puc: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  fragnancetype: string | null;
  hsn_code: string;
  gst_rate: string | number;
  iscombo: boolean | null;
};

export type ComboPlanEntry = {
  action: 'CREATE' | 'EXISTS' | 'SKIP';
  reason?: string;
  family: string;
  scents: string;
  componentPucs: string[];
  listings: Array<{ sku: string; asin: string; price: number | null }>;
  existingPuc?: string;
  /** ProductService.create input (CREATE only) */
  input?: Record<string, unknown>;
};

/** RFC 4180 CSV (quoted fields with commas, "" escapes, CRLF or LF) → objects keyed by the header */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((value) => value !== '')) rows.push(row);
  const [header = [], ...data] = rows;
  return data.map((values) => Object.fromEntries(header.map((name, index) => [name, values[index] ?? ''])));
}

const FAMILY_LABEL: Record<string, string> = {
  'Incense sticks': 'Incense Sticks',
  'Wardrobe sachet (AUORA)': 'Wardrobe Fragrance Sachets',
  Soap: 'Premium Glycerine Bathing Bar',
  'Dhoop sticks': 'Dhoop Sticks',
  'Diffuser oil 10 ml': 'Diffuser Oil',
};

const sameValue = (values: Array<string | null>) => {
  const unique = [...new Set(values.map((value) => value ?? ''))];
  return unique.length === 1 && unique[0] !== '' ? unique[0] : null;
};

const componentKey = (ids: Array<bigint | string>) => ids.map(String).sort().join(',');

/** Combo entries for the "Combo needed" (group 4) and "Combo exists" (group 3) rows of the CSV */
export function buildComboPlan(
  rows: ComboCsvRow[],
  productsByPuc: Map<string, ComboPlanProduct>,
  /** Component-set key (sorted product IDs) → PUC of an existing combo with exactly those components */
  existingCombos: Map<string, string>,
): ComboPlanEntry[] {
  const byComponents = new Map<string, ComboCsvRow[]>();
  for (const row of rows) {
    if (!row.group.startsWith('4.') && !row.group.startsWith('3.')) continue;
    // Group 3 rows list the existing combo first; its components follow
    const pucs = row.inventory_puc.split('+').map((puc) => puc.trim()).filter(Boolean).slice(row.group.startsWith('3.') ? 1 : 0);
    const key = [...pucs].sort().join('+');
    byComponents.set(key, [...(byComponents.get(key) ?? []), row]);
  }

  const plan: ComboPlanEntry[] = [];
  for (const [key, group] of byComponents) {
    const first = group[0]!;
    const componentPucs = key.split('+');
    const listings = group.map((row) => ({ sku: row.sku, asin: row.asin, price: Number(row.price) > 0 ? Number(row.price) : null }));
    const base = { family: first.family, scents: first.scents, componentPucs, listings };
    const skip = (reason: string): ComboPlanEntry => ({ ...base, action: 'SKIP', reason });

    const missing = componentPucs.filter((puc) => !productsByPuc.has(puc));
    if (missing.length > 0) { plan.push(skip(`Component not in this database: ${missing.join(', ')}`)); continue; }
    const components = componentPucs.map((puc) => productsByPuc.get(puc)!);
    const nested = components.filter((product) => product.iscombo);
    if (nested.length > 0) { plan.push(skip(`A combo cannot contain another combo: ${nested.map((p) => p.puc).join(', ')}`)); continue; }
    if (components.length < 2) { plan.push(skip('A combo needs at least 2 different products')); continue; }

    const existing = existingCombos.get(componentKey(components.map((product) => product.id)));
    if (existing) { plan.push({ ...base, action: 'EXISTS', existingPuc: existing }); continue; }

    const brand = sameValue(components.map((product) => product.brand));
    const category = sameValue(components.map((product) => product.category));
    const subcategory = sameValue(components.map((product) => product.subcategory));
    const hsn = sameValue(components.map((product) => product.hsn_code));
    const gst = sameValue(components.map((product) => String(Number(product.gst_rate))));
    if (!brand || !category || !subcategory) { plan.push(skip('Components differ in brand, category or subcategory: create this combo by hand')); continue; }
    if (!hsn || gst === null) { plan.push(skip('Components have different HSN code or GST rate: decide the combo tax by hand')); continue; }
    const price = listings.map((listing) => listing.price).find((value) => value !== null) ?? null;
    if (price === null) { plan.push(skip('No Amazon price to use as the combo price')); continue; }

    const scentNames = first.scents.split('+').map((scent) => scent.trim()).filter(Boolean);
    const label = FAMILY_LABEL[first.family] ?? first.family;
    const scentText = scentNames.length > 0 ? scentNames.join(' & ') : componentPucs.join(' & ');
    const fragrances = components.map((product) => product.fragnancetype).filter((value): value is string => Boolean(value));
    const input: Record<string, unknown> = {
      // ProductService.create builds the full name as "<Brand label> - <remarks>"
      name: `${label} Combo Pack | ${scentText}`,
      remarks: `${label} Combo Pack | ${scentText}`,
      shortname: `${brand.toUpperCase()} ${label} Combo - ${scentText}`.slice(0, 160),
      brand,
      category,
      subcategory,
      pack: `pack_of_${components.length}`,
      ...(fragrances.length === components.length ? { fragnancetype: [...new Set(fragrances)].join(',') } : {}),
      hsn_code: hsn,
      gst_rate: Number(gst),
      price,
      ...(listings[0]!.asin ? { asin: listings[0]!.asin } : {}),
      iscombo: true,
      combotype: 'fixed',
      components: components.map((product) => ({ productid: String(product.id), requiredqty: 1 })),
    };
    plan.push({ ...base, action: 'CREATE', input });
  }
  return plan.sort((left, right) => left.action.localeCompare(right.action) || left.family.localeCompare(right.family) || left.scents.localeCompare(right.scents));
}

export { componentKey as amazonComboComponentKey };
