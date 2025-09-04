/**
 * Performs a dynamic create operation
 */
export async function dynamicCreate(
  modelName: string,
  data: Record<string, any>,
  include?: any
): Promise<any | null> {
  try {
    const filteredData = await filterInputDataBySchema(
      data,
      modelName,
      "create"
    );

    if (Object.keys(filteredData).length === 0) {
      logger.warn(
        { modelName, originalData: data },
        "No valid fields for create operation"
      );
      throw new Error(`No valid fields provided for ${modelName} creation`);
    }

    // Use raw SQL for all models to ensure consistency
    const tableName = getTableName(modelName);
    const availableColumns = await discoverTableColumns(tableName);

    // Filter data to only include existing columns
    const rawData: Record<string, any> = {};
    for (const [key, value] of Object.entries(filteredData)) {
      if (availableColumns.includes(key)) {
        // Handle JSON fields properly for PostgreSQL
        if (
          (key === "paymentdata" || key === "items") &&
          value !== null &&
          value !== undefined
        ) {
          // For JSONB fields with explicit casting, stringify the JSON
          rawData[key] =
            typeof value === "string" ? value : JSON.stringify(value);
        } else {
          rawData[key] = value;
        }
      }
    }

    if (Object.keys(rawData).length === 0) {
      logger.warn(
        { modelName, tableName },
        "No valid columns for create operation"
      );
      throw new Error(`No valid columns found for ${modelName} creation`);
    }

    // Add timestamps if not present
    const now = Math.floor(Date.now() / 1000);
    if (!rawData.createddate && availableColumns.includes("createddate")) {
      rawData.createddate = now;
    }
    if (!rawData.modifieddate && availableColumns.includes("modifieddate")) {
      rawData.modifieddate = now;
    }

    // Build dynamic INSERT query
    const columns = Object.keys(rawData);
    const values = Object.values(rawData);

    // Build placeholders with special handling for JSON fields
    const placeholders = columns
      .map((col, index) => {
        if (col === "paymentdata" || col === "items") {
          return `$${index + 1}::jsonb`;
        }
        return `$${index + 1}`;
      })
      .join(", ");

    const columnsList = columns.map((col) => `"${col}"`).join(", ");

    const insertQuery = `
      INSERT INTO "${tableName}" (${columnsList}) 
      VALUES (${placeholders}) 
      RETURNING *
    `;

    logger.debug(
      {
        modelName,
        tableName,
        columns,
        query: insertQuery,
        hasItems: !!rawData.items,
        itemsDataType: rawData.items ? typeof rawData.items : "undefined",
        hasPaymentData: !!rawData.paymentdata,
        paymentDataType: rawData.paymentdata
          ? typeof rawData.paymentdata
          : "undefined",
      },
      "Executing dynamic create query"
    );

    const result = await prisma.$queryRawUnsafe(insertQuery, ...values);
    const records = Array.isArray(result) ? result : [];
    const createdRecord = records.length > 0 ? records[0] : null;

    if (createdRecord) {
      // logger.info({
      //   modelName,
      //   createdId: createdRecord.id,
      //   fieldsUsed: columns
      // }, 'Dynamic create completed successfully');
      return convertBigIntToNumber(createdRecord);
    } else {
      throw new Error(`Failed to create ${modelName} record`);
    }
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        modelName,
        data,
      },
      "Error in dynamic create operation"
    );
    throw error; // Re-throw instead of returning null
  }
}
