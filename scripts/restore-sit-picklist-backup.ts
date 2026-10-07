/**
 * Restore SIT picklist, category images, GST/HSN mappings, LOVs and product taxonomy from a backup JSON
 * written by scripts/sync-sit-picklist-from-uat.ts (or docs/backups/SIT_PICKLIST_BACKUP_*.json).
 *
 * Dry-run (default): restores inside one transaction, verifies every table equals the backup, then rolls back.
 *   npx tsx scripts/restore-sit-picklist-backup.ts --backup=<file>
 * Apply:
 *   npx tsx scripts/restore-sit-picklist-backup.ts --backup=<file> --apply --confirm=NIVAANA_SIT_PICKLIST_RESTORE
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const CONFIRMATION = 'NIVAANA_SIT_PICKLIST_RESTORE';
const TARGET_DATABASE = 'assetmanagement_dev';
const PRODUCT_TAXONOMY = ['category', 'subcategory', 'subsubcategory', 'fragnancetype'] as const;

type Row = Record<string, unknown> & { id: number };
type Backup = {
  picklist: Row[];
  category_images: Row[];
  gst_hsn_mapping: Row[];
  lovs: Row[];
  product_taxonomy: Row[];
};

const apply = process.argv.includes('--apply');
const argValue = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
const backendRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function readDatabaseUrl(envFile: string): string {
  const content = fs.readFileSync(path.resolve(backendRoot, envFile), 'utf8');
  const match = content.match(/^DATABASE_URL\s*[:=]\s*"?([^"\n]+)"?/m);
  if (!match) throw new Error(`DATABASE_URL not found in ${envFile}`);
  return match[1]
    .trim()
    .replace(/&?(connection_limit|pool_timeout)=\d+/g, '')
    .replace('sslmode=require', 'sslmode=no-verify');
}

const same = (a: unknown, b: unknown) => String(a ?? '') === String(b ?? '');

async function upsertById(client: pg.Client, table: string, rows: Row[]) {
  for (const row of rows) {
    const cols = Object.keys(row);
    await client.query(
      `insert into ${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})
       on conflict (id) do update set ${cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')}`,
      cols.map((c) => row[c]),
    );
  }
}

async function diffTable(client: pg.Client, table: string, expected: Row[], columns?: readonly string[]) {
  const actual = (await client.query<Row>(`select * from ${table}`)).rows;
  const actualById = new Map(actual.map((r) => [Number(r.id), r]));
  const errors: string[] = [];
  if (!columns && actual.length !== expected.length) errors.push(`${table}: ${actual.length} rows, backup ${expected.length}`);
  for (const row of expected) {
    const current = actualById.get(Number(row.id));
    if (!current) {
      errors.push(`${table} ${row.id} missing`);
      continue;
    }
    for (const c of columns ?? Object.keys(row)) {
      if (!same(current[c], row[c])) errors.push(`${table} ${row.id}.${c} = ${current[c]}, backup ${row[c]}`);
    }
  }
  return errors;
}

async function main() {
  const backupFile = argValue('backup');
  if (!backupFile) throw new Error('--backup=<file> is required');
  if (apply && argValue('confirm') !== CONFIRMATION) throw new Error(`--apply requires --confirm=${CONFIRMATION}`);
  const backup = JSON.parse(fs.readFileSync(path.resolve(backendRoot, backupFile), 'utf8')) as Backup;
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN (rolled back)'}  Backup: ${backupFile}`);

  const client = new pg.Client({ connectionString: readDatabaseUrl(argValue('target-env') ?? '.env.sit') });
  await client.connect();
  try {
    const { rows } = await client.query<{ db: string }>('select current_database() as db');
    if (rows[0].db !== TARGET_DATABASE) throw new Error(`Target is ${rows[0].db}, expected ${TARGET_DATABASE}`);

    await client.query('BEGIN');
    await client.query('LOCK TABLE picklist, gst_hsn_mapping, category_images, lovs IN SHARE ROW EXCLUSIVE MODE');

    const keep = (rows: Row[]) => rows.map((r) => Number(r.id));

    // Picklist first so images and HSN rows can point at restored ids.
    await upsertById(client, 'picklist', backup.picklist);
    await upsertById(client, 'category_images', backup.category_images);
    await client.query('delete from category_images where not (id = any($1::int[]))', [keep(backup.category_images)]);
    await client.query('delete from gst_hsn_mapping where not (id = any($1::int[]))', [keep(backup.gst_hsn_mapping)]);
    await upsertById(client, 'gst_hsn_mapping', backup.gst_hsn_mapping);
    await client.query('delete from picklist where not (id = any($1::int[]))', [keep(backup.picklist)]);
    await upsertById(client, 'lovs', backup.lovs);

    for (const product of backup.product_taxonomy) {
      await client.query(
        `update product set ${PRODUCT_TAXONOMY.map((c, i) => `${c} = $${i + 1}`).join(', ')}
         where id = $${PRODUCT_TAXONOMY.length + 1} and (${PRODUCT_TAXONOMY.map((c, i) => `${c} is distinct from $${i + 1}`).join(' or ')})`,
        [...PRODUCT_TAXONOMY.map((c) => product[c]), product.id],
      );
    }

    for (const table of ['picklist', 'category_images', 'gst_hsn_mapping', 'lovs']) {
      await client.query(`select setval('${table}_id_seq', (select coalesce(max(id), 1) from ${table}))`);
    }

    const errors = [
      ...(await diffTable(client, 'picklist', backup.picklist)),
      ...(await diffTable(client, 'category_images', backup.category_images)),
      ...(await diffTable(client, 'gst_hsn_mapping', backup.gst_hsn_mapping)),
      ...(await diffTable(client, 'lovs', backup.lovs)),
      ...(await diffTable(client, 'product', backup.product_taxonomy, PRODUCT_TAXONOMY)),
    ];
    if (errors.length) {
      errors.slice(0, 50).forEach((e) => console.log(`ERROR ${e}`));
      throw new Error(`Restore verification failed with ${errors.length} difference(s); rolled back`);
    }
    console.log(
      `Verified equal to backup: picklist ${backup.picklist.length}, category_images ${backup.category_images.length}, ` +
        `gst_hsn_mapping ${backup.gst_hsn_mapping.length}, lovs ${backup.lovs.length}, products ${backup.product_taxonomy.length}`,
    );

    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    console.log(apply ? 'COMMITTED' : 'Dry-run complete; ROLLED BACK');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
