import { describe, expect, it } from 'vitest';
import { isAllowedDashboardHost, isAllowedDashboardOrigin } from '../src/dashboard-boundary.js';

describe('single-user dashboard host boundary', () => {
  it('accepts only loopback HTTP Host names', () => {
    for (const host of ['localhost', 'localhost:3200', '127.0.0.1:3200', '[::1]:3200']) {
      expect(isAllowedDashboardHost(host)).toBe(true);
    }
    for (const host of ['warden.example.com:3200', 'localhost.evil.test',
      '10.0.0.5:3200', '192.168.1.2:3200', 'evil@localhost:3200',
      'localhost:3200/path', 'localhost:3200?x=y', undefined,
      'localhost\\evil.test', 'localhost example.test']) {
      expect(isAllowedDashboardHost(host)).toBe(false);
    }
  });

  it('permits same-origin requests or local non-browser clients', () => {
    expect(isAllowedDashboardOrigin('localhost:3200', 'http://localhost:3200', 'same-origin')).toBe(true);
    expect(isAllowedDashboardOrigin('127.0.0.1:3200', 'http://127.0.0.1:3200')).toBe(true);
    expect(isAllowedDashboardOrigin('[::1]:3200', 'http://[::1]:3200')).toBe(true);
    expect(isAllowedDashboardOrigin('localhost:3200', undefined)).toBe(true);
  });

  it('rejects cross-origin browser access, DNS rebinding and null origin', () => {
    for (const origin of ['https://evil.example', 'null',
      'http://localhost:3201', 'http://127.0.0.1:3200',
      'http://localhost:3200.evil.example', 'http://localhost:3200/path',
      'http://localhost:3200?query', 'https://localhost:3200']) {
      expect(isAllowedDashboardOrigin('localhost:3200', origin)).toBe(false);
    }
    expect(isAllowedDashboardOrigin('evil.example:3200', 'http://evil.example:3200')).toBe(false);
    expect(isAllowedDashboardOrigin('localhost:3200', undefined, 'cross-site')).toBe(false);
    expect(isAllowedDashboardOrigin('localhost:3200', undefined, 'same-site')).toBe(false);
  });
});
