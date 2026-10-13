import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

/**
 * Resolve the real env file path.
 * The project .env is /dev/null (to prevent leaking secrets to containers).
 * The actual env file lives at data/env/env.
 */
function getEnvFilePath(): string {
  const real = path.join(process.cwd(), 'data', 'env', 'env');
  if (fs.existsSync(real)) return real;
  // Fallback (shouldn't happen in production)
  return path.join(process.cwd(), '.env');
}

/**
 * Update or insert key=value pairs in the env file.
 */
export function writeEnvVars(vars: Record<string, string>): void {
  // Never write secrets into the repo-root .env fallback (it may be a
  // tracked placeholder or a /dev/null symlink). The runtime file is private.
  const envFile = path.join(process.cwd(), 'data', 'env', 'env');
  fs.mkdirSync(path.dirname(envFile), { recursive: true, mode: 0o700 });
  // Fail closed on symlink targets, including a deliberately planted file.
  if (fs.existsSync(envFile) && fs.lstatSync(envFile).isSymbolicLink()) {
    throw new Error('Refusing symlinked runtime env file');
  }
  for (const [key, value] of Object.entries(vars)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) ||
        typeof value !== 'string' || /[\r\n\0]/.test(value)) {
      throw new Error('Invalid runtime environment assignment');
    }
  }
  let lines: string[] = [];
  try {
    lines = fs.readFileSync(envFile, 'utf-8').split('\n');
  } catch {
    /* file doesn't exist yet */
  }

  const remaining = new Set(Object.keys(vars));

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    if (remaining.has(key)) {
      lines[i] = `${key}=${vars[key]}`;
      remaining.delete(key);
    }
  }

  // Append any keys not already in file
  for (const key of remaining) {
    lines.push(`${key}=${vars[key]}`);
  }

  // Opening with O_NOFOLLOW avoids following a replaced symlink on POSIX.
  // fchmod protects pre-existing files that were created with loose umasks.
  const fd = fs.openSync(envFile,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC |
    fs.constants.O_NOFOLLOW, 0o600);
  try {
    fs.fchmodSync(fd, 0o600);
    fs.writeFileSync(fd, lines.join('\n'), 'utf8');
  } finally {
    fs.closeSync(fd);
  }
}

export function readEnvFile(keys: string[]): Record<string, string> {
  const envFile = getEnvFilePath();
  let content: string;
  try {
    content = fs.readFileSync(envFile, 'utf-8');
  } catch (err) {
    logger.debug({ err }, '.env file not found, using defaults');
    return {};
  }

  const result: Record<string, string> = {};
  const wanted = new Set(keys);

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    if (!wanted.has(key)) continue;
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) result[key] = value;
  }

  return result;
}
