import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Copy the convertBigIntToNumber function from the API
function convertBigIntToNumber(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle BigInt
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  }
  
  // Handle specific object types that need special conversion
  if (typeof obj === 'object') {
    // Handle Prisma Decimal objects
    if (obj.constructor && obj.constructor.name === 'Decimal') {
      return Number(obj.toString());
    }
    
    // Handle Buffer objects (convert to string or number if numeric)
    if (Buffer.isBuffer(obj)) {
      const str = obj.toString();
      // If it's a numeric string, convert to number
      if (/^\d+$/.test(str)) {
        return Number(str);
      }
      return str;
    }
    
    // Handle Date objects
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    
    // Handle objects with valueOf method (like some database types)
    if (typeof obj.valueOf === 'function' && obj.valueOf() !== obj) {
      const value = obj.valueOf();
      if (typeof value === 'bigint') {
        return Number(value);
      }
      if (typeof value !== 'object') {
        return value;
      }
    }
    
    // Handle objects with toString method that returns a numeric value
    if (typeof obj.toString === 'function') {
      const str = obj.toString();
      // Check if toString returns something other than "[object Object]"
      if (str !== '[object Object]' && str !== obj) {
        // If it's a numeric string, convert to number
        if (/^\d+(\.\d+)?$/.test(str)) {
          return Number(str);
        }
        // If it's not the default object string, use it
        if (!str.startsWith('[object ')) {
          return str;
        }
      }
    }
    
    // Handle objects with toNumber method
    if (typeof obj.toNumber === 'function') {
      return obj.toNumber();
    }
    
    // Handle objects with toJSON method
    if (typeof obj.toJSON === 'function') {
      return convertBigIntToNumber(obj.toJSON());
    }
    
    // For plain objects, recursively convert properties
    if (obj.constructor === Object || obj.constructor === undefined) {
      const converted = {};
      for (const [key, value] of Object.entries(obj)) {
        converted[key] = convertBigIntToNumber(value);
      }
      return converted;
    }
    
    // IMPORTANT FIX: For other objects that look like plain JSON objects,
    // try to preserve them instead of converting to null
    try {
      // Check if the object can be JSON stringified and parsed
      const jsonString = JSON.stringify(obj);
      const parsed = JSON.parse(jsonString);
      
      // If successful, recursively convert the parsed object
      if (typeof parsed === 'object' && parsed !== null) {
        return convertBigIntToNumber(parsed);
      }
    } catch (e) {
      // JSON stringify/parse failed, continue with other methods
    }
    
    // For other objects, try to extract a meaningful value
    // This is a fallback for unknown object types
    if (obj.constructor && obj.constructor.name) {
      console.log('Unknown object type:', obj.constructor.name, 'toString:', obj.toString(), 'keys:', Object.keys(obj));
      
      // If it has enumerable properties, try to preserve them
      const keys = Object.keys(obj);
      if (keys.length > 0) {
        const converted = {};
        for (const key of keys) {
          converted[key] = convertBigIntToNumber(obj[key]);
        }
        return converted;
      }
    }
    
    // Last resort: try to convert to string if it's not the default object representation
    const str = String(obj);
    if (str !== '[object Object]') {
      // If it's a numeric string, convert to number
      if (/^\d+(\.\d+)?$/.test(str)) {
        return Number(str);
      }
      return str;
    }
    
    // If all else fails, return the original object instead of null
    // This preserves JSON data that might be in an unknown format
    return obj;
  }
  
  return obj;
}

async function debugPoinvoiceColumns() {
  try {
    console.log('=== Testing Dynamic Query Path ===');
    
    // Simulate the exact query that the API uses
    const result = await prisma.$queryRawUnsafe(`
      SELECT * FROM poinvoice WHERE id = 20 LIMIT 1
    `);
    
    console.log('Raw query result (with BigInt handling):');
    console.log(JSON.stringify(result, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2));
    
    if (result.length > 0) {
      const record = result[0];
      console.log('\n=== Before convertBigIntToNumber ===');
      console.log('paymentdata type:', typeof record.paymentdata);
      console.log('paymentdata constructor:', record.paymentdata?.constructor?.name);
      console.log('paymentdata value:', JSON.stringify(record.paymentdata, null, 2));
      
      console.log('\n=== After convertBigIntToNumber ===');
      const converted = convertBigIntToNumber(record);
      console.log('converted paymentdata type:', typeof converted.paymentdata);
      console.log('converted paymentdata constructor:', converted.paymentdata?.constructor?.name);
      console.log('converted paymentdata value:', JSON.stringify(converted.paymentdata, null, 2));
      
      console.log('\n=== Full converted record ===');
      console.log(JSON.stringify(converted, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPoinvoiceColumns(); 