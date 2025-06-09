// This is a fixed portion of the dynamicUpdate function
// for correct handling of the 'items' field as JSONB

// Main part of the function:
// Filter data to only include existing columns
const rawData: Record<string, any> = {};
for (const [key, value] of Object.entries(filteredData)) {
  if (availableColumns.includes(key)) {
    // Handle JSON fields properly for PostgreSQL
    if ((key === 'paymentdata' || key === 'items') && value !== null && value !== undefined) {
      // For JSONB fields with explicit casting, stringify the JSON
      rawData[key] = typeof value === 'string' ? value : JSON.stringify(value);
      if (key === 'paymentdata') {
        writeFileSync('debug_raw_sql_paymentdata.txt', `Converted paymentdata: ${rawData[key]}\n`, { flag: 'a' });
      } else if (key === 'items') {
        writeFileSync('debug_raw_sql_items.txt', `Converted items: ${rawData[key]}\n`, { flag: 'a' });
      }
    } else {
      rawData[key] = value;
    }
  }
}

// Build dynamic UPDATE query
const setClause = Object.keys(rawData)
  .map((key, index) => {
    if (key === 'paymentdata' || key === 'items') {
      return `"${key}" = $${index + 2}::jsonb`; // Cast to JSONB for JSON fields
    }
    return `"${key}" = $${index + 2}`;
  }) // Start from $2 since $1 is for WHERE
  .join(', ');

// Fallback part of the function:
// Filter data to only include existing columns
const rawData: Record<string, any> = {};
for (const [key, value] of Object.entries(filteredData)) {
  if (availableColumns.includes(key)) {
    // Handle JSON fields properly for PostgreSQL
    if ((key === 'paymentdata' || key === 'items') && value !== null && value !== undefined) {
      // For JSONB fields with explicit casting, stringify the JSON
      rawData[key] = typeof value === 'string' ? value : JSON.stringify(value);
    } else {
      rawData[key] = value;
    }
  }
}

// Build dynamic UPDATE query
const setClause = Object.keys(rawData)
  .map((key, index) => {
    if (key === 'paymentdata' || key === 'items') {
      return `"${key}" = $${index + 2}::jsonb`; // Cast to JSONB for JSON fields
    }
    return `"${key}" = $${index + 2}`;
  }) // Start from $2 since $1 is for WHERE
  .join(', '); 