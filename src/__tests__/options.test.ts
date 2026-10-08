import { NetworkDiagnosticsError } from '../errors';
import {
  DEFAULT_TIMEOUT_MS,
  resolveOptions,
  validateEndpoint,
} from '../options';

describe('resolveOptions', () => {
  it('fills in defaults', () => {
    expect(resolveOptions()).toEqual({
      endpoint: undefined,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      method: 'HEAD',
      samples: 1,
      thresholds: { excellentMs: 150, goodMs: 400, fairMs: 1000 },
    });
  });

  it('accepts valid options', () => {
    const r = resolveOptions({
      endpoint: 'https://api.example.com/health',
      timeoutMs: 2500.4,
      method: 'GET',
      samples: 3,
      qualityThresholds: { excellentMs: 100 },
    });
    expect(r.timeoutMs).toBe(2500);
    expect(r.method).toBe('GET');
    expect(r.samples).toBe(3);
    expect(r.thresholds.excellentMs).toBe(100);
  });

  it.each([
    [{ timeoutMs: 100 }],
    [{ timeoutMs: 60001 }],
    [{ timeoutMs: Number.NaN }],
    [{ timeoutMs: '5000' }],
    [{ samples: 0 }],
    [{ samples: 6 }],
    [{ samples: 1.5 }],
    [{ method: 'POST' }],
    [{ endpoint: 42 }],
    [{ qualityThresholds: { excellentMs: 500, goodMs: 100 } }],
  ])('rejects %j with INVALID_OPTIONS', (options) => {
    let thrown: unknown;
    try {
      resolveOptions(options as never);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(NetworkDiagnosticsError);
    expect((thrown as NetworkDiagnosticsError).code).toBe('INVALID_OPTIONS');
  });

  it('rejects a non-object', () => {
    expect(() => resolveOptions(null as never)).toThrow(
      NetworkDiagnosticsError
    );
  });
});

describe('validateEndpoint', () => {
  it.each([
    'https://api.example.com/health',
    'https://api.example.com',
    'HTTPS://API.EXAMPLE.COM/x',
    'https://api.example.com:8443/health?x=1#frag',
    'https://10.0.0.1/health',
    'https://[::1]:443/health',
    '  https://api.example.com/health  ',
  ])('accepts %s', (url) => {
    const r = validateEndpoint(url);
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.url).toBe(url.trim());
    }
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['http://api.example.com/health', 'https'],
    ['ftp://example.com', 'https'],
    ['api.example.com/health', 'https'],
    ['https://', 'host'],
    ['https:///path', 'host'],
    ['https://user:pass@example.com', 'credentials'],
    ['https://exa mple.com', 'whitespace'],
    ['https://example.com:0', 'port'],
    ['https://example.com:70000', 'port'],
    ['https://example.com:/x', 'port'],
    ['https://.example.com', 'host'],
    [`https://example.com/${'a'.repeat(2100)}`, 'longer'],
  ])('rejects %s (%s)', (url, reason) => {
    const r = validateEndpoint(url);
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.error.code).toBe('INVALID_ENDPOINT');
      expect(r.error.message).toContain(reason);
    }
  });
});
