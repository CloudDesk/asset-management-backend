import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('secret updater rejects command-line secrets and confirms custom targets before writes', () => {
  const script = fileURLToPath(new URL('../scripts/update-amazon-secrets.mjs', import.meta.url));
  const directory = mkdtempSync(join(tmpdir(), 'amazon-secret-test-'));
  const config = join(directory, 'config.json');
  const values = join(directory, 'values.env');
  const marker = join(directory, 'cloud-called');
  const loader = join(directory, 'guard.mjs');
  writeFileSync(config, JSON.stringify({ projectId: 'test-project', environment: 'production',
    cloudRunService: 'test-service', serviceAccount: 'test@example.invalid', secrets: {
      AMAZON_CLIENT_ID: 'test-id', AMAZON_CLIENT_SECRET: 'test-secret', AMAZON_REFRESH_TOKEN: 'test-refresh',
    } }));
  writeFileSync(values, 'AMAZON_CLIENT_ID=test-id\nAMAZON_CLIENT_SECRET=test-secret\nAMAZON_REFRESH_TOKEN=test-refresh\n');
  writeFileSync(loader, `import cp from 'node:child_process'; import {syncBuiltinESMExports} from 'node:module';
    import {writeFileSync} from 'node:fs'; cp.execFileSync = () => { writeFileSync(process.env.AMAZON_TEST_MARKER, 'called'); throw Error('Cloud command forbidden in test'); }; syncBuiltinESMExports();`);
  const run = (args: string[]) => spawnSync(process.execPath, ['--import', pathToFileURL(loader).href, script, ...args], {
    encoding: 'utf8', env: { ...process.env, AMAZON_TEST_MARKER: marker },
  });
  const unsafe = run(['--client-secret', 'secret-must-not-appear']);
  assert.equal(unsafe.status, 1);
  assert.match(unsafe.stderr, /Command-line credentials are disabled/);
  assert.ok(!unsafe.stderr.includes('secret-must-not-appear'));
  const unconfirmed = run(['--config', config, '--values-file', values]);
  assert.equal(unconfirmed.status, 1);
  assert.match(unconfirmed.stderr, /--confirm-target test-project\/test-service/);
  assert.equal(existsSync(marker), false);
  const dryRun = run(['--config', config, '--values-file', values, '--dry-run']);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.equal(existsSync(marker), false);
  assert.ok(!dryRun.stdout.includes('AMAZON_CLIENT_SECRET=test-secret'));
});
