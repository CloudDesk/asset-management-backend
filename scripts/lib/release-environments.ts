// Shared by release scripts that pick a database by environment name (db:sql, amazon:mappings).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const ENVIRONMENTS = {
  sit: { envFile: '.env.sit', database: 'assetmanagement_dev' }, // Dev and SIT share this DB
  uat: { envFile: '.env.uat', database: 'assetmanagement_uat' },
  prod: { envFile: '.env.prod', database: 'railway' },
} as const;
export type EnvName = keyof typeof ENVIRONMENTS;

export const parseEnvName = (value: string | undefined): EnvName => {
  const env = (value ?? 'sit').toLowerCase();
  if (!(env in ENVIRONMENTS)) throw new Error(`Unknown environment "${env}". Use sit, uat or prod.`);
  return env as EnvName;
};

/** DATABASE_URL exactly as written in the environment's file (for Prisma) */
export function readRawDatabaseUrl(envFile: string): string {
  const content = fs.readFileSync(path.resolve(backendRoot, envFile), 'utf8');
  const match = content.match(/^DATABASE_URL\s*[:=]\s*"?([^"\n]+)"?/m);
  if (!match) throw new Error(`DATABASE_URL not found in ${envFile}`);
  return match[1].trim();
}

/** The same URL for node-postgres: Prisma-only parameters removed, TLS without certificate check */
export function readDatabaseUrl(envFile: string): string {
  return readRawDatabaseUrl(envFile)
    .replace(/&?(connection_limit|pool_timeout)=\d+/g, '')
    .replace('sslmode=require', 'sslmode=no-verify');
}

export function assertExpectedDatabase(env: EnvName, connected: string) {
  const expected = ENVIRONMENTS[env].database;
  if (connected !== expected) {
    throw new Error(`Expected database ${expected} for ${env}, connected to ${connected}. Stopped.`);
  }
}
