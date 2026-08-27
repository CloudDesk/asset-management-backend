/// <reference types="node" />

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { Prisma, PrismaClient } from '@prisma/client';

const DEV_DATABASE_NAME = 'assetmanagement_dev';
const DEV_CONFIRMATION = 'NIVAANA_PRODUCT_SHORTNAMES_XLSX_DEV';
const PROD_CONFIRMATION = 'NIVAANA_PRODUCT_SHORTNAMES_XLSX_PROD_78';
const applyRequested = process.argv.includes('--apply');
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm='))?.slice('--confirm='.length);
const fileArgument = process.argv.find((arg) => arg.startsWith('--file='))?.slice('--file='.length);
const target = process.argv.find((arg) => arg.startsWith('--target='))?.slice('--target='.length) || 'dev';

if (!['dev', 'prod'].includes(target)) {
  throw new Error('Target must be either dev or prod.');
}
if (target === 'prod') {
  if (!process.env.DATABASE_URL_PROD) throw new Error('DATABASE_URL_PROD is not configured.');
  process.env.DATABASE_URL = process.env.DATABASE_URL_PROD;
}

const prisma = new PrismaClient();

type WorkbookRow = {
  row: number;
  id: bigint;
  name: string;
  puc: string;
  shortname: string;
};

type ProductRow = {
  id: bigint;
  name: string;
  puc: string;
  shortname: string | null;
};

const text = (value: ExcelJS.CellValue) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text).trim();
    if ('result' in value) return String(value.result ?? '').trim();
    if ('richText' in value) return value.richText.map((part) => part.text).join('').trim();
  }
  return String(value).trim();
};

const databaseNameFromUrl = (databaseUrl: string) => {
  try {
    return decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  } catch {
    return '';
  }
};

const readWorkbookRows = async (filePath: string): Promise<WorkbookRow[]> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.getWorksheet('Products') || workbook.worksheets[0];
  if (!sheet) throw new Error('The workbook does not contain a worksheet.');

  const headers = [1, 2, 3, 4].map((column) => text(sheet.getCell(1, column).value).toLowerCase());
  if (headers.join('|') !== 'id|product name|puc|short name') {
    throw new Error(`Unexpected headers in ${sheet.name}: ${headers.join(', ')}`);
  }

  const rows: WorkbookRow[] = [];
  sheet.eachRow((worksheetRow, rowNumber) => {
    if (rowNumber === 1) return;
    const idText = text(worksheetRow.getCell(1).value);
    const name = text(worksheetRow.getCell(2).value);
    const puc = text(worksheetRow.getCell(3).value);
    const shortname = text(worksheetRow.getCell(4).value);
    if (![idText, name, puc, shortname].some(Boolean)) return;
    if (!/^\d+$/.test(idText)) throw new Error(`Row ${rowNumber}: invalid product ID "${idText}".`);
    if (!name || !puc || !shortname) throw new Error(`Row ${rowNumber}: ID, Product name, PUC, and Short Name are required.`);
    if (shortname.length > 160) throw new Error(`Row ${rowNumber}: Short Name exceeds 160 characters.`);
    rows.push({ row: rowNumber, id: BigInt(idText), name, puc, shortname });
  });

  const duplicateIds = rows.filter((row, index) => rows.findIndex((candidate) => candidate.id === row.id) !== index);
  const duplicatePucs = rows.filter((row, index) => rows.findIndex((candidate) => candidate.puc === row.puc) !== index);
  if (duplicateIds.length) throw new Error(`Duplicate product IDs: ${duplicateIds.map((row) => row.id).join(', ')}`);
  if (duplicatePucs.length) throw new Error(`Duplicate PUCs: ${duplicatePucs.map((row) => row.puc).join(', ')}`);
  if (!rows.length) throw new Error('No product mappings were found in the workbook.');
  return rows;
};

const main = async () => {
  if (!fileArgument) throw new Error('Pass the workbook path as --file=<path>.');
  const filePath = path.resolve(fileArgument);
  if (!fs.existsSync(filePath)) throw new Error(`Workbook not found: ${filePath}`);

  const databaseUrl = process.env.DATABASE_URL || '';
  const databaseName = databaseNameFromUrl(databaseUrl);
  if (target === 'dev' && databaseName !== DEV_DATABASE_NAME) {
    throw new Error(`Blocked: dev mode requires ${DEV_DATABASE_NAME}; DATABASE_URL targets ${databaseName || 'an unknown database'}.`);
  }
  if (target === 'dev' && process.env.DATABASE_URL_PROD && databaseUrl === process.env.DATABASE_URL_PROD) {
    throw new Error('Blocked: dev mode DATABASE_URL matches DATABASE_URL_PROD.');
  }
  if (target === 'prod' && databaseUrl !== process.env.DATABASE_URL_PROD) {
    throw new Error('Blocked: prod mode is not using the configured DATABASE_URL_PROD.');
  }
  const requiredConfirmation = target === 'prod' ? PROD_CONFIRMATION : DEV_CONFIRMATION;
  if (applyRequested && confirmation !== requiredConfirmation) {
    throw new Error(`Apply blocked. Pass --apply --confirm=${requiredConfirmation}.`);
  }

  const workbookRows = await readWorkbookRows(filePath);
  const ids = workbookRows.map((row) => row.id);
  const products = await prisma.$queryRaw<ProductRow[]>`
    SELECT "id", "name", "puc", "shortname"
    FROM "product"
    WHERE "id" IN (${Prisma.join(ids)})
  `;
  const productsById = new Map(products.map((product) => [product.id.toString(), product]));
  const missing = workbookRows.filter((row) => !productsById.has(row.id.toString()));
  const pucMismatches = workbookRows.filter((row) => {
    const product = productsById.get(row.id.toString());
    return product && product.puc !== row.puc;
  });
  const nameMismatches = workbookRows.filter((row) => {
    const product = productsById.get(row.id.toString());
    return product && product.name.trim() !== row.name;
  });
  const updates = workbookRows.filter((row) => {
    const product = productsById.get(row.id.toString());
    return product && product.puc === row.puc && product.shortname !== row.shortname;
  });
  const unchanged = workbookRows.length - missing.length - pucMismatches.length - updates.length;

  console.log(JSON.stringify({
    mode: applyRequested ? 'APPLY' : 'DRY_RUN',
    target,
    database: databaseName,
    workbook: filePath,
    workbookRows: workbookRows.length,
    matchedByIdAndPuc: workbookRows.length - missing.length - pucMismatches.length,
    updates: updates.length,
    unchanged,
    missing: missing.map((row) => ({ row: row.row, id: row.id.toString(), puc: row.puc })),
    pucMismatches: pucMismatches.map((row) => ({
      row: row.row,
      id: row.id.toString(),
      workbookPuc: row.puc,
      databasePuc: productsById.get(row.id.toString())?.puc,
    })),
    nameMismatches: nameMismatches.map((row) => ({
      row: row.row,
      id: row.id.toString(),
      puc: row.puc,
      workbookName: row.name,
      databaseName: productsById.get(row.id.toString())?.name,
    })),
    sampleUpdates: updates.slice(0, 15).map((row) => ({
      id: row.id.toString(),
      puc: row.puc,
      currentShortName: productsById.get(row.id.toString())?.shortname,
      proposedShortName: row.shortname,
    })),
  }, null, 2));

  if (pucMismatches.length) {
    throw new Error('Validation failed. No rows were updated. Resolve ID/PUC mismatches first.');
  }
  if (!applyRequested) {
    console.log(target === 'prod'
      ? `Production dry run complete. Apply requires --apply --confirm=${PROD_CONFIRMATION}.`
      : `Dry run complete. Dev apply requires --apply --confirm=${DEV_CONFIRMATION}.`);
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve(
    'scripts',
    'dryrun-logs',
    `product-shortname-xlsx-${target}-backup-${timestamp}.json`,
  );
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(updates.map((row) => {
    const product = productsById.get(row.id.toString())!;
    return { id: row.id.toString(), puc: row.puc, shortname: product.shortname };
  }), null, 2));

  await prisma.$transaction(async (transaction) => {
    const modifieddate = BigInt(Date.now());
    for (const row of updates) {
      const result = await transaction.$executeRaw`
        UPDATE "product"
        SET "shortname" = ${row.shortname}, "modifieddate" = ${modifieddate}
        WHERE "id" = ${row.id} AND "puc" = ${row.puc}
      `;
      if (result !== 1) throw new Error(`Update failed for row ${row.row}, product ${row.id}/${row.puc}.`);
    }
  });

  const verified = await prisma.$queryRaw<Array<{ id: bigint; puc: string; shortname: string | null }>>`
    SELECT "id", "puc", "shortname" FROM "product" WHERE "id" IN (${Prisma.join(ids)})
  `;
  const verifiedById = new Map(verified.map((product) => [product.id.toString(), product]));
  const verificationFailures = workbookRows.filter((row) => verifiedById.get(row.id.toString())?.shortname !== row.shortname);
  const existingVerificationFailures = verificationFailures.filter((row) => productsById.has(row.id.toString()));
  if (existingVerificationFailures.length) {
    throw new Error(`Verification failed for ${existingVerificationFailures.length} existing products.`);
  }

  const reportPath = path.resolve(
    'scripts',
    'dryrun-logs',
    `product-shortname-xlsx-${target}-updated-${timestamp}.json`,
  );
  fs.writeFileSync(reportPath, JSON.stringify(updates.map((row) => ({
    id: row.id.toString(),
    puc: row.puc,
    productName: productsById.get(row.id.toString())!.name,
    previousShortName: productsById.get(row.id.toString())!.shortname,
    updatedShortName: row.shortname,
  })), null, 2));
  console.log(`Updated and verified ${updates.length} ${target} product short names. Skipped ${missing.length} missing products.`);
  console.log(`Backup: ${backupPath}`);
  console.log(`Updated list: ${reportPath}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
