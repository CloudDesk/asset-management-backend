/**
 * Run the release SQL scripts in scripts/migrations against one environment's database.
 *
 * Only scripts not yet recorded in that database run (log table release_ops.sql_script_log,
 * outside Prisma's "public" schema so prisma migrate / db push never see it). Files run in
 * name (date) order; each file keeps its own BEGIN / COMMIT.
 *
 * Environment (default sit): sit → .env.sit, uat → .env.uat, prod → .env.prod. The script stops
 * unless the connected database is the expected one for that environment.
 *
 * Status only (default, changes nothing):
 *   npm run db:sql                      (sit)
 *   npm run db:sql -- uat
 * Run pending scripts:
 *   npm run db:sql -- sit --apply
 *   npm run db:sql -- uat --apply
 *   npm run db:sql -- prod --apply --confirm=NIVAANA_PROD_SQL      (backup Prod first)
 * Only one file:            add --file=20261022_add_product_asin.sql
 * Ran by hand earlier:      npm run db:sql -- uat --mark-applied=<file>   (records it, runs nothing)
 *
 * Superseded scripts live in scripts/migrations/superseded and are never picked up.
 * Release tracker: docs/RELEASE_SCRIPTS_CHECKLIST.md section 4b.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(backendRoot, 'scripts/migrations');
const PROD_CONFIRMATION = 'NIVAANA_PROD_SQL';

const ENVIRONMENTS = {
  sit: { envFile: '.env.sit', database: 'assetmanagement_dev' }, // Dev and SIT share this DB
  uat: { envFile: '.env.uat', database: 'assetmanagement_uat' },
  prod: { envFile: '.env.prod', database: 'railway' },
} as const;
type EnvName = keyof typeof ENVIRONMENTS;

const LOG_TABLE = 'release_ops.sql_script_log';

function parseArgs(argv: string[]) {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flag = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  const env = (positional[0] ?? 'sit').toLowerCase();
  if (!(env in ENVIRONMENTS)) throw new Error(`Unknown environment "${env}". Use sit, uat or prod.`);
  return {
    env: env as EnvName,
    apply: argv.includes('--apply'),
    confirm: flag('confirm'),
    file: flag('file'),
    markApplied: flag('mark-applied'),
  };
}

function readDatabaseUrl(envFile: string): string {
  const content = fs.readFileSync(path.resolve(backendRoot, envFile), 'utf8');
  const match = content.match(/^DATABASE_URL\s*[:=]\s*"?([^"\n]+)"?/m);
  if (!match) throw new Error(`DATABASE_URL not found in ${envFile}`);
  return match[1]
    .trim()
    .replace(/&?(connection_limit|pool_timeout)=\d+/g, '')
    .replace('sslmode=require', 'sslmode=no-verify');
}

const checksum = (text: string) => crypto.createHash('sha256').update(text).digest('hex');

function listScripts() {
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => /^\d{8}_[\w-]+\.sql$/.test(name))
    .sort()
    .map((name) => {
      const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8');
      return { name, sql, checksum: checksum(sql) };
    });
}

async function readLog(client: pg.Client) {
  const exists = await client.query<{ t: string | null }>(`SELECT to_regclass('${LOG_TABLE}')::text AS t`);
  if (!exists.rows[0].t) return new Map<string, { checksum: string; applied_at: Date }>();
  const rows = await client.query<{ filename: string; checksum: string; applied_at: Date }>(
    `SELECT filename, checksum, applied_at FROM ${LOG_TABLE}`
  );
  return new Map(rows.rows.map((r) => [r.filename, r]));
}

async function ensureLogTable(client: pg.Client) {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS release_ops;
    CREATE TABLE IF NOT EXISTS ${LOG_TABLE} (
      filename    TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      applied_by  TEXT NOT NULL,
      note        TEXT
    );`);
}

async function record(client: pg.Client, file: { name: string; checksum: string }, note: string) {
  await client.query(
    `INSERT INTO ${LOG_TABLE} (filename, checksum, applied_by, note) VALUES ($1, $2, $3, $4)
     ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = now(),
       applied_by = EXCLUDED.applied_by, note = EXCLUDED.note`,
    [file.name, file.checksum, os.userInfo().username, note]
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = ENVIRONMENTS[args.env];
  const writes = args.apply || Boolean(args.markApplied);
  if (args.env === 'prod' && writes && args.confirm !== PROD_CONFIRMATION) {
    throw new Error(`Prod needs --confirm=${PROD_CONFIRMATION} (take a Prod backup first).`);
  }

  let scripts = listScripts();
  if (args.file) {
    scripts = scripts.filter((s) => s.name === args.file);
    if (!scripts.length) throw new Error(`No script named ${args.file} in scripts/migrations`);
  }

  const client = new pg.Client({ connectionString: readDatabaseUrl(target.envFile) });
  await client.connect();
  try {
    const db = (await client.query<{ db: string }>('SELECT current_database() AS db')).rows[0].db;
    console.log(`Environment: ${args.env}  (${target.envFile})  →  database: ${db}`);
    if (db !== target.database) {
      throw new Error(`Expected database ${target.database} for ${args.env}, connected to ${db}. Stopped.`);
    }

    const log = await readLog(client);

    if (args.markApplied) {
      const file = listScripts().find((s) => s.name === args.markApplied);
      if (!file) throw new Error(`No script named ${args.markApplied} in scripts/migrations`);
      await ensureLogTable(client);
      await record(client, file, 'marked applied (ran outside this runner)');
      console.log(`Recorded ${file.name} as applied. Nothing was executed.`);
      return;
    }

    const pending = scripts.filter((s) => !log.has(s.name));
    for (const s of scripts) {
      const entry = log.get(s.name);
      if (!entry) console.log(`  ⬜ pending   ${s.name}`);
      else if (entry.checksum !== s.checksum) console.log(`  ⚠️  applied ${entry.applied_at.toISOString()} but the file changed since: ${s.name}`);
      else console.log(`  ✅ applied   ${entry.applied_at.toISOString()}  ${s.name}`);
    }

    if (!pending.length) {
      console.log('Nothing to run.');
      return;
    }
    if (!args.apply) {
      console.log(`\n${pending.length} pending. Status only — add --apply to run them${args.env === 'prod' ? ` (with --confirm=${PROD_CONFIRMATION})` : ''}.`);
      return;
    }

    await ensureLogTable(client);
    for (const s of pending) {
      console.log(`\n▶ Running ${s.name}`);
      try {
        await client.query(s.sql);
      } catch (error) {
        // A script's own BEGIN may still be open; roll it back so nothing half-applied stays
        await client.query('ROLLBACK').catch(() => undefined);
        console.error(`✖ ${s.name} failed; it and later scripts were not recorded.`);
        throw error;
      }
      await record(client, s, `run by run-sql-migrations (${args.env})`);
      console.log(`✔ ${s.name} applied and recorded`);
    }
    console.log('\nNow run the verification queries at the end of each file and mark the rows in docs/RELEASE_SCRIPTS_CHECKLIST.md 4b.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
