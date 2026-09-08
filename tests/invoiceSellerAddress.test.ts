import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_INVOICE_SELLER_ADDRESS,
  normalizeInvoiceSellerAddress,
  validateInvoiceSellerAddress,
} from '../src/utils/invoice-seller-address.js';

test('uses the established Nivaana seller address when an order has no snapshot', () => {
  assert.deepEqual(normalizeInvoiceSellerAddress(null), DEFAULT_INVOICE_SELLER_ADDRESS);
});

test('normalizes an editable seller address snapshot', () => {
  const address = validateInvoiceSellerAddress({
    alias: ' Updated Sales Office ',
    phone: '9003879665',
    address_line1: ' New address ',
    address_line2: '',
    pincode: '600042',
    city: ' Chennai ',
    state: ' Tamil Nadu ',
    country: ' India ',
    gstin: '33AABCU9603R1ZX',
  });

  assert.equal(address.alias, 'Updated Sales Office');
  assert.equal(address.address_line1, 'New address');
  assert.equal(address.city, 'Chennai');
});

test('rejects incomplete seller details', () => {
  assert.throws(
    () => validateInvoiceSellerAddress({ alias: 'Sales Office' }),
    /Seller address fields are required/
  );
});
