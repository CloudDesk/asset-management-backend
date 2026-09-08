export interface InvoiceSellerAddress {
  alias: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  pincode: string;
  city: string;
  state: string;
  country: string;
  gstin: string;
}

export const DEFAULT_INVOICE_SELLER_ADDRESS: Readonly<InvoiceSellerAddress> = Object.freeze({
  alias: 'VIP98 - SALES OFFICE',
  phone: '9003879665',
  address_line1: '968, 1ST FLOOR 4TH HOUSE, TNHB 1ST MAIN ROAD, VELACHERY',
  address_line2: 'OPP. TO PURPLE PHARMACY',
  pincode: '600042',
  city: 'Chennai',
  state: 'Tamil Nadu',
  country: 'India',
  gstin: '33AABCU9603R1ZX',
});

const clean = (value: unknown) => typeof value === 'string' || typeof value === 'number'
  ? String(value).trim()
  : '';

export function normalizeInvoiceSellerAddress(value: unknown): InvoiceSellerAddress {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    alias: clean(source.alias) || DEFAULT_INVOICE_SELLER_ADDRESS.alias,
    phone: clean(source.phone) || DEFAULT_INVOICE_SELLER_ADDRESS.phone,
    address_line1: clean(source.address_line1) || DEFAULT_INVOICE_SELLER_ADDRESS.address_line1,
    address_line2: Object.prototype.hasOwnProperty.call(source, 'address_line2')
      ? clean(source.address_line2)
      : DEFAULT_INVOICE_SELLER_ADDRESS.address_line2,
    pincode: clean(source.pincode) || DEFAULT_INVOICE_SELLER_ADDRESS.pincode,
    city: clean(source.city) || DEFAULT_INVOICE_SELLER_ADDRESS.city,
    state: clean(source.state) || DEFAULT_INVOICE_SELLER_ADDRESS.state,
    country: clean(source.country) || DEFAULT_INVOICE_SELLER_ADDRESS.country,
    gstin: clean(source.gstin) || DEFAULT_INVOICE_SELLER_ADDRESS.gstin,
  };
}

export function validateInvoiceSellerAddress(value: unknown): InvoiceSellerAddress {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const requiredFields = ['alias', 'phone', 'address_line1', 'pincode', 'city', 'state', 'country', 'gstin'] as const;
  const missingFields = requiredFields.filter((field) => !clean(source[field]));

  if (missingFields.length > 0) {
    throw new Error(`Seller address fields are required: ${missingFields.join(', ')}`);
  }

  const normalized = normalizeInvoiceSellerAddress(source);
  if (!/^\d{6}$/.test(normalized.pincode)) {
    throw new Error('Seller pincode must contain exactly 6 digits');
  }
  if (!/^\+?[0-9]{10,15}$/.test(normalized.phone.replace(/[\s-]/g, ''))) {
    throw new Error('Seller phone must contain 10 to 15 digits');
  }
  if (!/^[0-9A-Z]{15}$/i.test(normalized.gstin)) {
    throw new Error('Seller GSTIN must contain exactly 15 letters and digits');
  }

  return normalized;
}
