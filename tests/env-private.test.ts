import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readEnvFile, writeEnvVars } from '../src/env.js';

let directory: string;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'warden-env-test-'));
  vi.spyOn(process, 'cwd').mockReturnValue(directory);
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe('private runtime environment writes', () => {
  it('never overwrites the repository .env fallback', () => {
    fs.writeFileSync(path.join(directory, '.env'), 'PLACEHOLDER=untouched\n');
    writeEnvVars({ ASSISTANT_NAME: 'Synthetic' });
    expect(fs.readFileSync(path.join(directory, '.env'), 'utf8')).toBe('PLACEHOLDER=untouched\n');
    const actual = path.join(directory, 'data', 'env', 'env');
    expect(fs.readFileSync(actual, 'utf8')).toContain('ASSISTANT_NAME=Synthetic');
    expect(fs.statSync(actual).mode & 0o777).toBe(0o600);
    expect(readEnvFile(['ASSISTANT_NAME'])).toEqual({ ASSISTANT_NAME: 'Synthetic' });
  });

  it('corrects pre-existing permissive env files', () => {
    const dir = path.join(directory, 'data', 'env');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'env');
    fs.writeFileSync(file, 'EXISTING=legacy\n', { mode: 0o666 });
    fs.chmodSync(file, 0o644);
    writeEnvVars({ EXISTING: 'replacement', NEW_KEY: 'safe' });
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(readEnvFile(['EXISTING', 'NEW_KEY'])).toEqual({
      EXISTING: 'replacement', NEW_KEY: 'safe',
    });
  });

  it('does not follow a symlink to another file', () => {
    const dir = path.join(directory, 'data', 'env');
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(directory, 'outside');
    fs.writeFileSync(target, 'UNCHANGED');
    fs.symlinkSync(target, path.join(dir, 'env'));
    expect(() => writeEnvVars({ API_KEY: 'synthetic' })).toThrow();
    expect(fs.readFileSync(target, 'utf8')).toBe('UNCHANGED');
  });

  it('rejects invalid names and newline-based config injection', () => {
    for (const input of [
      { 'BAD\nKEY': 'token' },
      { 'VALID': 'token\nUNSAFE=1' },
      { 'VALID': 'token\rUNSAFE=1' },
      { 'BAD-KEY': 'value' },
    ]) {
      expect(() => writeEnvVars(input)).toThrow('Invalid runtime environment assignment');
    }
    expect(fs.existsSync(path.join(directory, 'data', 'env', 'env'))).toBe(false);
  });
});
