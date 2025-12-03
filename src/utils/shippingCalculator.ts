/**
 * Shipping Calculator Utility
 * 
 * Calculates shipping dimensions and weight for Ekart shipments
 * based on product data, pack size, and order quantity.
 */

export interface ProductShippingData {
  // Base dimensions (single unit) in cm
  length?: number;
  width?: number;
  height?: number;
  // Base weight (single unit) in grams
  weight?: number;
  // Pack information (picklist value - can be any string from picklist table)
  pack?: string; // e.g., 'single', 'pack_of_2', 'pack_of_3', etc.
  numberofitems?: number; // Alternative: number of items in pack
}

export interface ShippingCalculationResult {
  length: number;
  width: number;
  height: number;
  weight: number;
  calculationMethod: 'calculated' | 'default';
  notes: string[];
}

/**
 * Extract pack size from pack picklist value
 * Handles various formats: 'single', 'pack_of_2', 'pack_of_3', 'pack_of_X', etc.
 * Since picklist values can be added dynamically, this function is flexible
 */
function extractPackSize(pack?: string, numberofitems?: number): number {
  // If numberofitems is provided, use it (most reliable)
  if (numberofitems && numberofitems > 0) {
    return numberofitems;
  }

  // Handle picklist values
  if (!pack || typeof pack !== 'string') {
    return 1; // Default to single item
  }

  const packLower = pack.toLowerCase().trim();
  
  // Handle common picklist patterns
  // Pattern 1: "pack_of_X" (e.g., "pack_of_2", "pack_of_3")
  const packOfMatch = packLower.match(/pack_of_(\d+)/);
  if (packOfMatch && packOfMatch[1]) {
    return parseInt(packOfMatch[1], 10);
  }

  // Pattern 2: "pack of X" (legacy format with spaces)
  const legacyMatch = packLower.match(/pack\s+of\s+(\d+)/);
  if (legacyMatch && legacyMatch[1]) {
    return parseInt(legacyMatch[1], 10);
  }

  // Pattern 3: "single" or "1"
  if (packLower === 'single' || packLower === '1' || packLower.includes('single')) {
    return 1;
  }

  // Pattern 4: Extract any number from the string
  const numberMatch = packLower.match(/(\d+)/);
  if (numberMatch && numberMatch[1]) {
    const extracted = parseInt(numberMatch[1], 10);
    if (extracted > 0) {
      return extracted;
    }
  }

  // Default to 1 if can't parse
  return 1;
}

/**
 * Calculate shipping dimensions and weight for a shipment
 * 
 * @param productData - Product shipping data (base dimensions/weight)
 * @param orderQuantity - Quantity ordered (number of packs/units)
 * @param useTemplate - Whether to use Ekart packaging template if available
 * @returns Calculated shipping dimensions and weight
 */
export function calculateShippingDimensions(
  productData: ProductShippingData,
  orderQuantity: number
): ShippingCalculationResult {
  const notes: string[] = [];
  
  // Extract pack size
  const packSize = extractPackSize(productData.pack || undefined, productData.numberofitems);
  const totalItems = orderQuantity * packSize;
  
  notes.push(`Pack size: ${packSize} item(s) per pack`);
  notes.push(`Order quantity: ${orderQuantity} pack(s)`);
  notes.push(`Total items: ${totalItems}`);

  // Get base dimensions (single unit)
  const baseLength = productData.length || 0;
  const baseWidth = productData.width || 0;
  const baseHeight = productData.height || 0;
  const baseWeight = productData.weight || 0;

  // If no base dimensions provided, use defaults
  if (!baseLength || !baseWidth || !baseHeight) {
    notes.push('⚠️ No product dimensions found - using default dimensions');
    return {
      length: 20, // Default: 20cm
      width: 15,  // Default: 15cm
      height: 10, // Default: 10cm
      weight: baseWeight * totalItems || 100 * totalItems, // Use base weight or default 100g per item
      calculationMethod: 'default',
      notes
    };
  }

  // Calculate total weight
  const totalWeight = baseWeight * totalItems;
  notes.push(`Base weight per item: ${baseWeight}g`);
  notes.push(`Total weight: ${totalWeight}g`);

  // Calculate dimensions based on quantity
  // Strategy: Stack items vertically (increase height) for small quantities
  // For larger quantities, arrange in a grid (increase length/width)
  
  let finalLength = baseLength;
  let finalWidth = baseWidth;
  let finalHeight = baseHeight;

  if (totalItems === 1) {
    // Single item - use base dimensions
    finalLength = baseLength;
    finalWidth = baseWidth;
    finalHeight = baseHeight;
    notes.push('Single item - using base dimensions');
  } else if (totalItems <= 4) {
    // Small quantity - stack vertically
    finalLength = baseLength;
    finalWidth = baseWidth;
    finalHeight = baseHeight * totalItems;
    notes.push(`Stacking ${totalItems} items vertically`);
  } else if (totalItems <= 8) {
    // Medium quantity - 2x2 grid, stacked
    const itemsPerLayer = 4;
    const layers = Math.ceil(totalItems / itemsPerLayer);
    finalLength = baseLength * 2;
    finalWidth = baseWidth * 2;
    finalHeight = baseHeight * layers;
    notes.push(`Arranging ${totalItems} items in 2x2 grid, ${layers} layer(s)`);
  } else {
    // Large quantity - 3x3 grid, stacked
    const itemsPerLayer = 9;
    const layers = Math.ceil(totalItems / itemsPerLayer);
    finalLength = baseLength * 3;
    finalWidth = baseWidth * 3;
    finalHeight = baseHeight * layers;
    notes.push(`Arranging ${totalItems} items in 3x3 grid, ${layers} layer(s)`);
  }

  // Ensure minimum dimensions (Ekart requirements)
  const minDimension = 1; // 1cm minimum
  finalLength = Math.max(finalLength, minDimension);
  finalWidth = Math.max(finalWidth, minDimension);
  finalHeight = Math.max(finalHeight, minDimension);

  // Round to nearest integer (Ekart expects integers)
  finalLength = Math.round(finalLength);
  finalWidth = Math.round(finalWidth);
  finalHeight = Math.round(finalHeight);

  notes.push(`Final dimensions: ${finalLength}cm x ${finalWidth}cm x ${finalHeight}cm`);

  return {
    length: finalLength,
    width: finalWidth,
    height: finalHeight,
    weight: Math.round(totalWeight),
    calculationMethod: 'calculated',
    notes
  };
}

/**
 * Calculate shipping for multiple products in a single shipment
 * Combines dimensions and weights of multiple products
 */
export function calculateMultiProductShipping(
  products: Array<{ data: ProductShippingData; quantity: number }>
): ShippingCalculationResult {
  const notes: string[] = [];
  notes.push(`Calculating shipping for ${products.length} product(s)`);

  // Calculate total weight
  let totalWeight = 0;
  const allCalculations: ShippingCalculationResult[] = [];

  for (const product of products) {
    const calc = calculateShippingDimensions(product.data, product.quantity);
    allCalculations.push(calc);
    totalWeight += calc.weight;
    notes.push(`Product: ${product.quantity}x - ${calc.weight}g`);
  }

  // Calculate combined dimensions
  // Strategy: Find the largest dimensions and add volumes
  const maxLength = Math.max(...allCalculations.map(c => c.length));
  const maxWidth = Math.max(...allCalculations.map(c => c.width));
  
  // Calculate total volume
  let totalVolume = 0;
  for (const calc of allCalculations) {
    totalVolume += calc.length * calc.width * calc.height;
  }

  // Calculate height needed for total volume
  const baseArea = maxLength * maxWidth;
  const combinedHeight = baseArea > 0 ? Math.ceil(totalVolume / baseArea) : Math.max(...allCalculations.map(c => c.height));

  notes.push(`Combined dimensions: ${maxLength}cm x ${maxWidth}cm x ${combinedHeight}cm`);

  return {
    length: maxLength,
    width: maxWidth,
    height: combinedHeight,
    weight: Math.round(totalWeight),
    calculationMethod: 'calculated',
    notes
  };
}

/**
 * Validate shipping data before creating shipment
 */
export function validateShippingData(result: ShippingCalculationResult): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate all fields
  if (!result.length || result.length <= 0) {
    errors.push('Length must be greater than 0');
  }
  if (!result.width || result.width <= 0) {
    errors.push('Width must be greater than 0');
  }
  if (!result.height || result.height <= 0) {
    errors.push('Height must be greater than 0');
  }
  if (!result.weight || result.weight <= 0) {
    errors.push('Weight must be greater than 0');
  }

  // Ekart maximum limits (adjust based on actual limits)
  if (result.length > 150) {
    errors.push(`Length (${result.length}cm) exceeds maximum allowed (150cm)`);
  }
  if (result.width > 150) {
    errors.push(`Width (${result.width}cm) exceeds maximum allowed (150cm)`);
  }
  if (result.height > 150) {
    errors.push(`Height (${result.height}cm) exceeds maximum allowed (150cm)`);
  }
  if (result.weight > 30000) { // 30kg
    errors.push(`Weight (${result.weight}g) exceeds maximum allowed (30000g)`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

