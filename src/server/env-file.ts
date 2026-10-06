import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Loads `.env` from the project root without overriding variables already set in the process. */
export function loadEnvFile(): void {
  const path = join(process.cwd(), '.env');
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!key || !value || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = value;
  }
}
