type NamingProduct = {
  brand?: string | null | undefined;
  subcategory?: string | null | undefined;
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

export const buildProductNaming = ({
  product,
  picklists,
}: {
  product: NamingProduct;
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
  const remarks = clean(product.remarks);
  if (!remarks) {
    throw new Error('Remarks are required to generate the product name.');
  }
  if (remarks.length > 1000) {
    throw new Error('Generated remarks exceed 1000 characters.');
  }

  const name = [brand, subcategory, remarks].join(' - ');
  if (name.length > 1516) {
    throw new Error('Generated product name exceeds 1516 characters.');
  }

  return { name, remarks };
};
