import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const usage = `Update Amazon credentials in Google Cloud Secret Manager (SIT).

Options:
  --config <path>       Secret config JSON (default: config/amazon-secrets.sit.json)
  --from-env <path>     Read AMAZON_* values from a dotenv/YAML env file
  --values-file <path>  Local secrets file (default: .env.amazon.local)
  --client-id <value>   Override AMAZON_CLIENT_ID
  --client-secret <value>
                        Override AMAZON_CLIENT_SECRET
  --refresh-token <value>
                        Override AMAZON_REFRESH_TOKEN
  --redeploy            Redeploy nivaana-dev Cloud Run after updating secrets
  --dry-run             Print actions without calling gcloud
  -h, --help            Show this help

Examples:
  npm run secrets:amazon:update
  node scripts/update-amazon-secrets.mjs --from-env .env
  node scripts/update-amazon-secrets.mjs --redeploy
`;

function parseArgs(argv) {
  const options = {
    configFile: path.join(rootDir, 'config/amazon-secrets.sit.json'),
    valuesFile: path.join(rootDir, '.env.amazon.local'),
    fromEnvFile: '',
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    redeploy: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--config':
        options.configFile = path.resolve(rootDir, argv[++index]);
        break;
      case '--from-env':
        options.fromEnvFile = path.resolve(rootDir, argv[++index]);
        break;
      case '--values-file':
        options.valuesFile = path.resolve(rootDir, argv[++index]);
        break;
      case '--client-id':
        options.clientId = argv[++index] ?? '';
        break;
      case '--client-secret':
        options.clientSecret = argv[++index] ?? '';
        break;
      case '--refresh-token':
        options.refreshToken = argv[++index] ?? '';
        break;
      case '--redeploy':
        options.redeploy = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '-h':
      case '--help':
        console.log(usage);
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        console.error(usage);
        process.exit(1);
    }
  }

  return options;
}

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = line.match(/^([A-Z_][A-Z0-9_]*)[\s:=]+(?:"([^"]*)"|'([^']*)'|(.+))$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    const value = (match[2] ?? match[3] ?? match[4] ?? '').trim();
    values[key] = value;
  }

  return values;
}

function runGcloud(args, { dryRun = false, input } = {}) {
  if (dryRun) {
    console.log(`[dry-run] gcloud ${args.join(' ')}`);
    return;
  }

  execFileSync('gcloud', args, {
    stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    input,
  });
}

function secretExists(secretName, projectId) {
  try {
    execFileSync('gcloud', ['secrets', 'describe', secretName, '--project', projectId], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

const options = parseArgs(process.argv.slice(2));

if (!fs.existsSync(options.configFile)) {
  console.error(`Missing config file: ${options.configFile}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(options.configFile, 'utf8'));
if (!config.projectId || !config.serviceAccount || !config.secrets) {
  console.error('Invalid config: projectId, serviceAccount, and secrets are required.');
  process.exit(1);
}

const sourceFile = options.fromEnvFile || (fs.existsSync(options.valuesFile) ? options.valuesFile : '');
const fileValues = sourceFile ? parseEnvFile(sourceFile) : {};

const resolvedValues = {
  AMAZON_CLIENT_ID: options.clientId || fileValues.AMAZON_CLIENT_ID || '',
  AMAZON_CLIENT_SECRET: options.clientSecret || fileValues.AMAZON_CLIENT_SECRET || '',
  AMAZON_REFRESH_TOKEN: options.refreshToken || fileValues.AMAZON_REFRESH_TOKEN || '',
};

const missing = Object.entries(resolvedValues)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`Missing required values: ${missing.join(', ')}`);
  console.error('Provide CLI flags, create .env.amazon.local, or pass --from-env <file>.');
  process.exit(1);
}

console.log(`Using GCP project: ${config.projectId}`);
runGcloud(['config', 'set', 'project', config.projectId], { dryRun: options.dryRun });

for (const [envName, secretName] of Object.entries(config.secrets)) {
  const secretValue = resolvedValues[envName];
  console.log(`Updating secret: ${secretName} (${envName})`);

  if (!secretExists(secretName, config.projectId)) {
    runGcloud(
      [
        'secrets',
        'create',
        secretName,
        '--project',
        config.projectId,
        '--replication-policy',
        'automatic',
        '--labels',
        'environment=sit,app=nivaana,credential=amazon',
      ],
      { dryRun: options.dryRun }
    );
  }

  if (options.dryRun) {
    console.log(`[dry-run] add secret version for ${secretName}`);
  } else {
    runGcloud(
      ['secrets', 'versions', 'add', secretName, '--project', config.projectId, '--data-file=-'],
      { input: secretValue }
    );
  }

  runGcloud(
    [
      'secrets',
      'add-iam-policy-binding',
      secretName,
      '--project',
      config.projectId,
      '--member',
      `serviceAccount:${config.serviceAccount}`,
      '--role',
      'roles/secretmanager.secretAccessor',
      '--quiet',
    ],
    { dryRun: options.dryRun }
  );
}

console.log('Amazon SIT secrets updated successfully.');

if (options.redeploy) {
  if (!config.cloudRunService) {
    console.error('cloudRunService missing in config; skipping redeploy.');
    process.exit(0);
  }

  const setSecrets = Object.entries(config.secrets)
    .map(([envName, secretName]) => `${envName}=${secretName}:latest`)
    .join(',');

  console.log(`Redeploying Cloud Run service: ${config.cloudRunService}`);
  runGcloud(
    [
      'run',
      'services',
      'update',
      config.cloudRunService,
      '--project',
      config.projectId,
      '--region',
      config.region || 'asia-south1',
      '--set-secrets',
      setSecrets,
    ],
    { dryRun: options.dryRun }
  );
}
