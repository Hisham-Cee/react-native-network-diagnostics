import {
  isNetworkDiagnosticErrorCode,
  isNetworkDiagnosticsError,
  NETWORK_DIAGNOSTIC_ERROR_CODES,
  NetworkDiagnosticsError,
  normalizeErrorCode,
  toNetworkDiagnosticsError,
} from '../errors';

describe('error codes', () => {
  it('exposes the documented codes', () => {
    expect(NETWORK_DIAGNOSTIC_ERROR_CODES).toEqual([
      'TIMEOUT',
      'DNS_FAILURE',
      'CONNECTION_FAILURE',
      'TLS_FAILURE',
      'INVALID_ENDPOINT',
      'INVALID_OPTIONS',
      'DIAGNOSTIC_UNAVAILABLE',
      'UNKNOWN',
    ]);
  });

  it.each(NETWORK_DIAGNOSTIC_ERROR_CODES)('%s is preserved', (code) => {
    expect(isNetworkDiagnosticErrorCode(code)).toBe(true);
    expect(normalizeErrorCode(code)).toBe(code);
  });

  it.each([
    'NSURLErrorDomain',
    'java.net.UnknownHostException',
    'timeout',
    '',
    undefined,
    null,
    42,
  ])('unknown native value %p becomes UNKNOWN', (value) => {
    expect(normalizeErrorCode(value)).toBe('UNKNOWN');
  });
});

describe('toNetworkDiagnosticsError', () => {
  it('returns the same instance for NetworkDiagnosticsError', () => {
    const e = new NetworkDiagnosticsError('TIMEOUT', 'x');
    expect(toNetworkDiagnosticsError(e)).toBe(e);
  });

  it('keeps a known code from a native promise rejection', () => {
    const native = Object.assign(new Error('no module'), {
      code: 'DIAGNOSTIC_UNAVAILABLE',
    });
    const e = toNetworkDiagnosticsError(native);
    expect(e.code).toBe('DIAGNOSTIC_UNAVAILABLE');
    expect(e.message).toBe('no module');
    expect(isNetworkDiagnosticsError(e)).toBe(true);
  });

  it('maps unknown native codes and non-errors to UNKNOWN', () => {
    const native = Object.assign(new Error('boom'), { code: 'E_WEIRD' });
    expect(toNetworkDiagnosticsError(native).code).toBe('UNKNOWN');
    expect(toNetworkDiagnosticsError('text').message).toBe('text');
    expect(toNetworkDiagnosticsError(undefined).code).toBe('UNKNOWN');
  });

  it('sets the error name', () => {
    expect(new NetworkDiagnosticsError('UNKNOWN', 'x').name).toBe(
      'NetworkDiagnosticsError'
    );
  });
});
