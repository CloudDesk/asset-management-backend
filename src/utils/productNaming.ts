type NamingProduct = {
  brand?: string | null | undefined;
  subcategory?: string | null | undefined;
  fragnancetype?: string | null | undefined;
  remarks?: string | null | undefined;
};

type NamingPicklist = {
  fieldname: string | null;
  value: string | null;
  label: string | null;
  parent: string | null;
};

const clean = (value: unknown) =>
  typeof value === 'string' && value.trim().toLowerCase() !== 'false'
    ? value.trim()
    : '';

const normalize = (value: string) =>
  value.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

export const toProductNameTitleCase = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const values = (value?: string | null) =>
  clean(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const labelFor = (
  picklists: NamingPicklist[],
  fieldname: string,
  value: string,
  parent?: string,
  preserveFallbackCasing = false,
) => {
  const exact = picklists.find(
    (row) =>
      row.fieldname === fieldname &&
      row.value === value &&
      (!parent || row.parent === parent),
  );
  const caseInsensitive = picklists.find(
    (row) =>
      row.fieldname === fieldname &&
      normalize(row.value || '') === normalize(value) &&
      (!parent || normalize(row.parent || '') === normalize(parent)),
  );
  const unscoped = picklists.find(
    (row) =>
      row.fieldname === fieldname &&
      normalize(row.value || '') === normalize(value),
  );
  return (
    exact?.label ||
    caseInsensitive?.label ||
    unscoped?.label ||
    (preserveFallbackCasing ? value : toProductNameTitleCase(value))
  );
};

const removeLeadingPrefix = (remarks: string, prefix: string) => {
  if (!prefix) return remarks;
  const normalizedRemarks = normalize(remarks);
  const normalizedPrefix = normalize(prefix);
  if (normalizedRemarks === normalizedPrefix) return '';

  const delimiterIndex = remarks.indexOf(' - ');
  if (
    delimiterIndex < 0 ||
    normalize(remarks.slice(0, delimiterIndex)) !== normalizedPrefix
  ) {
    return remarks;
  }
  return remarks.slice(delimiterIndex + 3).trim();
};

export const buildProductNaming = ({
  product,
  previousProduct,
  picklists,
}: {
  product: NamingProduct;
  previousProduct?: NamingProduct;
  picklists: NamingPicklist[];
}) => {
  const brandValue = clean(product.brand);
  const subcategoryValue = clean(product.subcategory);
  if (!brandValue || !subcategoryValue) {
    throw new Error('Brand and subcategory are required to generate the product name.');
  }

  const brand = labelFor(picklists, 'brand', brandValue, undefined, true);
  const subcategory = labelFor(
    picklists,
    'subcategory',
    subcategoryValue,
  );
  const fragranceLabels = values(product.fragnancetype).map((value) =>
    labelFor(picklists, 'fragnancetype', value, subcategoryValue),
  );
  const previousFragranceLabels = values(previousProduct?.fragnancetype).map(
    (value) =>
      labelFor(
        picklists,
        'fragnancetype',
        value,
        clean(previousProduct?.subcategory),
      ),
  );
  const fragrancePrefix = fragranceLabels.join(', ');
  const previousFragrancePrefix = previousFragranceLabels.join(', ');

  let descriptor = clean(product.remarks);
  descriptor = removeLeadingPrefix(descriptor, fragrancePrefix);
  descriptor = removeLeadingPrefix(descriptor, previousFragrancePrefix);
  const remarks = [fragrancePrefix, descriptor].filter(Boolean).join(' - ');
  if (!remarks) {
    throw new Error('Remarks are required to generate the product name.');
  }
  if (remarks.length > 255) {
    throw new Error('Generated remarks exceed 255 characters.');
  }

  const name = [brand, subcategory, remarks].join(' - ');
  if (name.length > 500) {
    throw new Error('Generated product name exceeds 500 characters.');
  }

  return { name, remarks };
};
