const PRIVATE_KEY_BEGIN = '-----BEGIN PRIVATE KEY-----';
const PRIVATE_KEY_END = '-----END PRIVATE KEY-----';

export function normalizePemPrivateKey(value: string) {
  const trimmedValue = value.trim();
  const escapedNewlineValue = trimmedValue.replace(/\\n/g, '\n').trim();

  if (escapedNewlineValue.includes('\n')) {
    return escapedNewlineValue;
  }

  const beginIndex = escapedNewlineValue.indexOf(PRIVATE_KEY_BEGIN);
  const endIndex = escapedNewlineValue.indexOf(PRIVATE_KEY_END);

  if (beginIndex === -1 || endIndex === -1 || endIndex <= beginIndex) {
    return escapedNewlineValue;
  }

  const keyBody = escapedNewlineValue
    .slice(beginIndex + PRIVATE_KEY_BEGIN.length, endIndex)
    .replace(/\s+/g, '');

  return `${PRIVATE_KEY_BEGIN}\n${keyBody}\n${PRIVATE_KEY_END}`;
}

export function validatePemPrivateKey(key: string, value: string) {
  const errors: string[] = [];
  const normalizedValue = normalizePemPrivateKey(value);

  if (value.includes('/n')) {
    errors.push(`${key} contains /n; use escaped newlines as \\n or a valid PEM value`);
  }

  if (!normalizedValue.includes('\n')) {
    errors.push(`${key} must be a valid PEM private key`);
  }

  if (
    !normalizedValue.startsWith(PRIVATE_KEY_BEGIN) ||
    !normalizedValue.endsWith(PRIVATE_KEY_END)
  ) {
    errors.push(`${key} must be a PEM private key`);
  }

  return errors;
}
