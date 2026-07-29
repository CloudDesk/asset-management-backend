#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env}"
SERVICE_NAME="nivaana-dev"
REGION="asia-south1"
PLATFORM="managed"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

TMP_ENV_FILE="$(mktemp).json"
trap 'rm -f "$TMP_ENV_FILE"' EXIT

CLOUD_RUN_PORT="$(ENV_FILE="$ENV_FILE" node --input-type=module <<'NODE'
import fs from 'node:fs';
import dotenv from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
const parsed = dotenv.parse(fs.readFileSync(envFile));
console.log(parsed.PORT || '5600');
NODE
)"

if [[ ! "$CLOUD_RUN_PORT" =~ ^[0-9]+$ ]]; then
  echo "Invalid PORT in $ENV_FILE: $CLOUD_RUN_PORT" >&2
  exit 1
fi

ENV_FILE="$ENV_FILE" node --input-type=module > "$TMP_ENV_FILE" <<'NODE'
import fs from 'node:fs';
import dotenv from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
const parsed = dotenv.parse(fs.readFileSync(envFile));

const required = [
  'DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'APNS_AUTH_KEY',
  'APNS_KEY_ID',
  'APNS_TEAM_ID',
  'APNS_BUNDLE_ID',
];

const missing = required.filter((key) => !parsed[key]);
if (missing.length > 0) {
  console.error(`Missing required deploy env vars in ${envFile}: ${missing.join(', ')}`);
  process.exit(1);
}

if (parsed.STORAGE_API_KEY && parsed.STORAGE_API_KEY.length < 16) {
  console.error('STORAGE_API_KEY must be at least 16 characters for Cloud Run deploys.');
  process.exit(1);
}

const excluded = new Set([
  'PORT',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'FIREBASE_SERVICE_ACCOUNT_PATH',
  'APNS_AUTH_KEY_PATH',
  'GOOGLE_APPLICATION_CREDENTIALS',
]);

const pemKeys = new Set(['FIREBASE_PRIVATE_KEY', 'APNS_AUTH_KEY']);
const cloudRunEnv = {};

for (const [key, rawValue] of Object.entries(parsed)) {
  if (excluded.has(key)) {
    continue;
  }

  if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
    continue;
  }

  let value = String(rawValue);
  if (pemKeys.has(key)) {
    value = value
      .replace(/\\\r?\n/g, '\n')
      .replace(/\\n/g, '\n')
      .trim();
  }

  cloudRunEnv[key] = value;
}

console.log(JSON.stringify(cloudRunEnv, null, 2));
NODE

gcloud run deploy "$SERVICE_NAME" \
  --image gcr.io/nivaana/nivaana:latest \
  --platform "$PLATFORM" \
  --region "$REGION" \
  --allow-unauthenticated \
  --service-account nivaana-dev@nivaana.iam.gserviceaccount.com \
  --memory 256Mi \
  --port="$CLOUD_RUN_PORT" \
  --env-vars-file="$TMP_ENV_FILE"
