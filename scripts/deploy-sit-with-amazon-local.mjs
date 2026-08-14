#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(".env.amazon.local");
const requiredKeys = [
  "AMAZON_CLIENT_ID",
  "AMAZON_CLIENT_SECRET",
  "AMAZON_REFRESH_TOKEN",
];

function parseEnvFile(path) {
  const values = {};
  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    values[key] = value.replace(/^["']|["']$/g, "");
  }

  return values;
}

function chooseDelimiter(values) {
  const candidates = ["@", "~", "%", "^", "#", "|", ";"];
  const delimiter = candidates.find((candidate) =>
    values.every((value) => !value.includes(candidate)),
  );

  if (!delimiter) {
    throw new Error("Could not find a safe gcloud substitutions delimiter.");
  }

  return delimiter;
}

const amazonEnv = parseEnvFile(envPath);
const missingKeys = requiredKeys.filter((key) => !amazonEnv[key]);

if (missingKeys.length > 0) {
  console.error(`Missing ${missingKeys.join(", ")} in ${envPath}`);
  process.exit(1);
}

const delimiter = chooseDelimiter(requiredKeys.map((key) => amazonEnv[key]));
const substitutions = [
  `_${requiredKeys[0]}=${amazonEnv[requiredKeys[0]]}`,
  `_${requiredKeys[1]}=${amazonEnv[requiredKeys[1]]}`,
  `_${requiredKeys[2]}=${amazonEnv[requiredKeys[2]]}`,
].join(delimiter);

const result = spawnSync(
  "gcloud",
  [
    "builds",
    "submit",
    ".",
    "--config",
    "cloudbuildsit.yaml",
    "--project",
    "nivaana",
    `--substitutions=^${delimiter}^${substitutions}`,
  ],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
