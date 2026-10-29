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

/** Combo label from the components' subcategory (combos picked by hand in the mapping dialog) */
const SUBCATEGORY_LABEL: Record<string, string> = {
  incense_sticks: 'Incense Sticks',
  wardrobe_fragrance: 'Wardrobe Fragrance Sachets',
  bath_body: 'Premium Glycerine Bathing Bar',
  dhoop_sticks: 'Dhoop Sticks',
  dhoop_cones: 'Dhoop Cones',
  fragrance_oils: 'Diffuser Oil',
  air_fresheners: 'Room Mist',
};

/** Pack picklist values (same in Dev/SIT, UAT and Prod on 2026-10-27); other counts leave pack empty */
const PACK_SIZES = new Set([2, 3, 4, 5, 6, 9, 12]);

const sameValue = (values: Array<string | null>) => {
  const unique = [...new Set(values.map((value) => value ?? ''))];
  return unique.length === 1 && unique[0] !== '' ? unique[0] : null;
};

/** Key of a combo's component set: product IDs with their quantity per combo (1 when not given) */
const componentKey = (ids: Array<bigint | string>, quantities: number[] = []) =>
  ids.map((id, index) => `${String(id)}x${quantities[index] ?? 1}`).sort().join(',');

const titleCase = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export type ComboInputComponent = ComboPlanProduct & { requiredQty: number; shortname?: string | null };

/**
 * ProductService.create input for a combo of `components` (shared by the combo script and "Map as combo").
 * Tax must be the same on every component; with `allowMixedTaxonomy` (picked by hand) brand / category /
 * subcategory come from the first component, otherwise they must match too.
 */
export function buildComboProductInput(options: {
  components: ComboInputComponent[];
  label?: string;
  scentText?: string;
  price: number | null;
  asin: string | null;
  /** Flipkart FSN of the listing the combo is made for (FKT-PLAN-02b) */
  fsn?: string | null;
  allowMixedTaxonomy?: boolean;
}): { input: Record<string, unknown> } | { reason: string } {
  const { components } = options;
  if (components.length < 2) return { reason: 'A combo needs at least 2 different products' };
  const nested = components.filter((product) => product.iscombo);
  if (nested.length > 0) return { reason: `A combo cannot contain another combo: ${nested.map((product) => product.puc).join(', ')}` };
  const hsn = sameValue(components.map((product) => product.hsn_code || null));
  const gst = sameValue(components.map((product) => (product.gst_rate === '' || product.gst_rate === null ? null : String(Number(product.gst_rate)))));
  const brand = sameValue(components.map((product) => product.brand));
  const category = sameValue(components.map((product) => product.category));
  const subcategory = sameValue(components.map((product) => product.subcategory));
  if (!options.allowMixedTaxonomy && (!brand || !category || !subcategory)) {
    return { reason: 'Components differ in brand, category or subcategory: create this combo by hand' };
  }
  if (!hsn || gst === null) return { reason: 'Components have different HSN code or GST rate: decide the combo tax by hand' };
  const first = components[0]!;
  const comboBrand = brand ?? first.brand;
  if (!comboBrand) return { reason: 'The first product has no brand' };

  const label = options.label ?? (subcategory ? SUBCATEGORY_LABEL[subcategory] ?? titleCase(subcategory) : 'Gift');
  const names = components.map((product) => (product.fragnancetype && !product.fragnancetype.includes(',')
    ? titleCase(product.fragnancetype) : product.shortname || product.puc));
  const scentText = options.scentText || [...new Set(names)].join(' & ');
  const units = components.reduce((sum, product) => sum + product.requiredQty, 0);
  const fragrances = components.map((product) => product.fragnancetype).filter((value): value is string => Boolean(value));
  return {
    input: {
      // ProductService.create builds the full name as "<Brand label> - <remarks>"
      name: `${label} Combo Pack | ${scentText}`.slice(0, 1000),
      remarks: `${label} Combo Pack | ${scentText}`.slice(0, 1000),
      shortname: `${comboBrand.toUpperCase()} ${label} Combo - ${scentText}`.slice(0, 160),
      brand: comboBrand,
      ...(first.category ? { category: category ?? first.category } : {}),
      ...(first.subcategory ? { subcategory: subcategory ?? first.subcategory } : {}),
      ...(PACK_SIZES.has(units) ? { pack: `pack_of_${units}` } : {}),
      ...(fragrances.length === components.length ? { fragnancetype: [...new Set(fragrances)].join(',') } : {}),
      hsn_code: hsn,
      gst_rate: Number(gst),
      ...(options.price !== null && options.price > 0 ? { price: options.price } : {}),
      ...(options.asin ? { asin: options.asin } : {}),
      ...(options.fsn ? { fsn: options.fsn } : {}),
      iscombo: true,
      combotype: 'fixed',
      components: components.map((product) => ({ productid: String(product.id), requiredqty: product.requiredQty })),
    },
  };
}

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

    const price = listings.map((listing) => listing.price).find((value) => value !== null) ?? null;
    if (price === null) { plan.push(skip('No Amazon price to use as the combo price')); continue; }
    const scentNames = first.scents.split('+').map((scent) => scent.trim()).filter(Boolean);
    const built = buildComboProductInput({
      components: components.map((product) => ({ ...product, requiredQty: 1 })),
      label: FAMILY_LABEL[first.family] ?? first.family,
      scentText: scentNames.length > 0 ? scentNames.join(' & ') : componentPucs.join(' & '),
      price,
      asin: listings[0]!.asin || null,
    });
    if ('reason' in built) { plan.push(skip(built.reason)); continue; }
    const { input } = built;
    plan.push({ ...base, action: 'CREATE', input });
  }
  return plan.sort((left, right) => left.action.localeCompare(right.action) || left.family.localeCompare(right.family) || left.scents.localeCompare(right.scents));
}

export { componentKey as amazonComboComponentKey };
