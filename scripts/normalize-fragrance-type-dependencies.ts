/**
 * Normalize Product -> Fragrance Type dependencies to the two-level taxonomy.
 *
 * Every Fragrance Type row must use:
 *   controlledfieldname = subcategory
 *   controlledvalue     = parent
 *   controlledlabel     = current Subcategory label
 *
 * Dry-run against SIT (default; transaction is rolled back):
 *   npx tsx scripts/normalize-fragrance-type-dependencies.ts
 *
 * Apply to SIT:
 *   npx tsx scripts/normalize-fragrance-type-dependencies.ts \
 *     --apply --confirm=NIVAANA_NORMALIZE_FRAGRANCE_DEPENDENCIES
 *
 * For UAT/production, explicitly provide both the environment file and the
 * expected database name. The database-name check prevents targeting the wrong
 * environment accidentally.
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const CONFIRMATION = 'NIVAANA_NORMALIZE_FRAGRANCE_DEPENDENCIES';
const DEFAULT_ENV_FILE = '.env.sit';
const DEFAULT_EXPECTED_DATABASE = 'assetmanagement_dev';

type DependencyRow = {
  id: number;
  label: string | null;
  value: string | null;
  parent: string | null;
  controlledfieldname: string | null;
  controlledvalue: string | null;
  controlledlabel: string | null;
  subcategory_label: string | null;
};

const apply = process.argv.includes('--apply');
const argValue = (name: string, fallback: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const confirmation = argValue('confirm', '');
const envFile = argValue('target-env', DEFAULT_ENV_FILE);
const expectedDatabase = argValue('expected-db', DEFAULT_EXPECTED_DATABASE);
const backendRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function readDatabaseUrl(file: string): string {
  const content = fs.readFileSync(path.resolve(backendRoot, file), 'utf8');
  const match = content.match(/^DATABASE_URL\s*[:=]\s*"?([^"\n]+)"?/m);
  if (!match) throw new Error(`DATABASE_URL not found in ${file}`);
  return match[1]
    .trim()
    .replace(/&?(connection_limit|pool_timeout)=\d+/g, '')
    .replace('sslmode=require', 'sslmode=no-verify');
}

async function loadDependencies(client: pg.Client): Promise<DependencyRow[]> {
  return (
    await client.query<DependencyRow>(
      `select f.id, f.label, f.value, f.parent,
              f.controlledfieldname, f.controlledvalue, f.controlledlabel,
              s.label as subcategory_label
         from picklist f
         left join lateral (
           select label
             from picklist
            where object = 'product'
              and fieldname = 'subcategory'
              and value = f.parent
              and isactive is true
            order by id
            limit 1
         ) s on true
        where f.object = 'product'
          and f.fieldname = 'fragnancetype'
        order by f.id`,
    )
  ).rows;
}

const isNormalized = (row: DependencyRow) =>
  row.parent !== null &&
  row.subcategory_label !== null &&
  row.controlledfieldname === 'subcategory' &&
  row.controlledvalue === row.parent &&
  row.controlledlabel === row.subcategory_label;

async function main() {
  if (apply && confirmation !== CONFIRMATION) {
    throw new Error(`--apply requires --confirm=${CONFIRMATION}`);
  }
  if (!expectedDatabase.trim()) throw new Error('--expected-db must not be empty');

  const client = new pg.Client({ connectionString: readDatabaseUrl(envFile) });
  await client.connect();
  try {
    const database = (await client.query<{ name: string }>('select current_database() as name')).rows[0].name;
    if (database !== expectedDatabase) {
      throw new Error(`${envFile} points to ${database}, expected ${expectedDatabase}`);
    }

    await client.query('BEGIN');
    await client.query('LOCK TABLE picklist IN SHARE ROW EXCLUSIVE MODE');

    const before = await loadDependencies(client);
    const missingParent = before.filter((row) => !row.parent || !row.subcategory_label);
    if (missingParent.length) {
      throw new Error(
        `Cannot normalize ${missingParent.length} Fragrance Type row(s) because their parent does not resolve ` +
          `to an active Product Subcategory: ${missingParent.map((row) => `${row.id}:${row.parent ?? 'null'}`).join(', ')}`,
      );
    }

    const pending = before.filter((row) => !isNormalized(row));
    console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN (rolled back)'}`);
    console.log(`Target: ${database} (${envFile})`);
    console.log(`Fragrance Type rows: ${before.length}; pending normalization: ${pending.length}`);
    for (const row of pending) {
      console.log(
        `  ${row.id}:${row.value} -> controller=subcategory, value=${row.parent}, label=${row.subcategory_label}`,
      );
    }

    if (apply && pending.length) {
      const backupDir = path.resolve(backendRoot, 'docs/backups');
      fs.mkdirSync(backupDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `FRAGRANCE_DEPENDENCY_BACKUP_${database}_${stamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(before, null, 2));
      console.log(`Backup: ${backupPath}`);
    }

    const result = await client.query(
      `with dependency_labels as (
         select f.id, f.parent, s.label
           from picklist f
           join lateral (
             select label
               from picklist
              where object = 'product'
                and fieldname = 'subcategory'
                and value = f.parent
                and isactive is true
              order by id
              limit 1
           ) s on true
          where f.object = 'product'
            and f.fieldname = 'fragnancetype'
       )
       update picklist f
          set controlledfieldname = 'subcategory',
              controlledvalue = d.parent,
              controlledlabel = d.label,
              modifieddate = $1
         from dependency_labels d
        where f.id = d.id
          and (f.controlledfieldname, f.controlledvalue, f.controlledlabel)
              is distinct from ('subcategory', d.parent, d.label)`,
      [Math.floor(Date.now() / 1000)],
    );

    const after = await loadDependencies(client);
    const invalid = after.filter((row) => !isNormalized(row));
    if (invalid.length) {
      throw new Error(`Verification failed: ${invalid.length} Fragrance Type dependency row(s) are not normalized`);
    }
    if (result.rowCount !== pending.length) {
      throw new Error(`Verification failed: expected ${pending.length} updates, database reported ${result.rowCount ?? 0}`);
    }

    console.log(`Verified: all ${after.length} Fragrance Type rows depend only on Subcategory`);
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
