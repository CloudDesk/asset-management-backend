/**
 * Courier → Amazon carrier code for shipment confirmation.
 *
 * Amazon accepts only carrier codes from its own list; a courier it does not know is sent as
 * `Other` with the courier's name (always accepted, but Amazon may not show live tracking).
 * Ekart stays `Other` until its code is checked against the list in Seller Central
 * (docs/Amazon/Amazon_Order_Fulfillment.md section 5).
 */
export const AMAZON_CARRIERS = [
  { code: 'Delhivery', match: ['delhivery'] },
  { code: 'Blue Dart', match: ['blue dart', 'bluedart'] },
  { code: 'DTDC', match: ['dtdc'] },
  { code: 'Xpressbees', match: ['xpressbees', 'xpress bees'] },
  { code: 'Ecom Express', match: ['ecom express', 'ecomexpress'] },
  { code: 'India Post', match: ['india post', 'speed post', 'indiapost'] },
  { code: 'Shadowfax', match: ['shadowfax'] },
  { code: 'Gati', match: ['gati'] },
] as const;

export const AMAZON_OTHER_CARRIER = 'Other';

/** Amazon carrier code and name for a courier name as a courier / aggregator reports it */
export function amazonCarrierFor(courierName: string): { carrierCode: string; carrierName: string } {
  const name = courierName.trim();
  const normalized = name.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const carrier = AMAZON_CARRIERS.find((entry) => entry.match.some((word) => normalized.includes(word)));
  return carrier
    ? { carrierCode: carrier.code, carrierName: carrier.code }
    : { carrierCode: AMAZON_OTHER_CARRIER, carrierName: name || 'Other' };
}

export const isKnownAmazonCarrierCode = (code: string) =>
  code === AMAZON_OTHER_CARRIER || AMAZON_CARRIERS.some((entry) => entry.code === code);
