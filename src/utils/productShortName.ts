export const PRODUCT_SHORT_NAME_MAX_LENGTH = 160;

type ShortNameProduct = {
  name: string;
  remarks?: string | null;
  puc?: string | null;
};

const clean = (value: unknown) =>
  typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : '';

const clipAtWordBoundary = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;

  const clipped = value.slice(0, maxLength + 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return (lastSpace >= Math.floor(maxLength * 0.6)
    ? clipped.slice(0, lastSpace)
    : value.slice(0, maxLength)).trim();
};

const withoutLeadingBrand = (name: string) => {
  const separatorIndex = name.indexOf(' - ');
  return separatorIndex >= 0 ? name.slice(separatorIndex + 3).trim() : name;
};

const simplifyMarketingTitle = (source: string) => {
  const segments = source.split('|').map(clean).filter(Boolean);
  if (segments.length < 2) return source;

  const headline = segments[0] || source;
  const quantity = [...segments]
    .reverse()
    .find((segment) => /^\d+(?:\.\d+)?\s*(?:g|kg|ml|l|sticks?|pcs?|pieces?)$/i.test(segment));

  return quantity ? `${headline} - ${quantity}` : headline;
};

export const buildProductShortName = (product: ShortNameProduct) => {
  const source = clean(product.remarks) || withoutLeadingBrand(clean(product.name));
  if (!source) {
    throw new Error('A product name or remarks value is required to generate a short name.');
  }

  const simplified = simplifyMarketingTitle(source);
  if (simplified.length <= PRODUCT_SHORT_NAME_MAX_LENGTH) return simplified;

  const firstSentence = clean(simplified.split(/[.!?]/, 1)[0]) || simplified;
  const puc = clean(product.puc);
  const suffix = puc ? ` - ${puc}` : '';
  const availableLength = PRODUCT_SHORT_NAME_MAX_LENGTH - suffix.length;
  return `${clipAtWordBoundary(firstSentence, availableLength)}${suffix}`;
};
