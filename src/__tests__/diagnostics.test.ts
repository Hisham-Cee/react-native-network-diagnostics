import {
  __getActiveListenerCount,
  addNetworkStateListener,
  getNetworkDiagnostics,
  getNetworkState,
} from '../diagnostics';
import { NetworkDiagnosticsError } from '../errors';
import {
  emitNativeState,
  nativeMock,
  OFFLINE_STATE,
  resetNativeMock,
  WIFI_STATE,
} from './nativeMock';

jest.mock('../NativeNetworkDiagnostics', () => ({
  __esModule: true,
  default: require('./nativeMock').nativeMock,
}));

const ENDPOINT = 'https://api.example.com/health';

beforeEach(() => {
  resetNativeMock();
});

describe('getNetworkState', () => {
  it('returns the normalized OS state', async () => {
    await expect(getNetworkState()).resolves.toEqual({
      connected: true,
      type: 'wifi',
      vpn: false,
      internet: { validated: true, captivePortal: false },
      conditions: { metered: false, constrained: false },
    });
    expect(nativeMock.probeEndpoint).not.toHaveBeenCalled();
  });

  it('wraps a native rejection in NetworkDiagnosticsError', async () => {
    nativeMock.getNetworkState.mockRejectedValue(
      Object.assign(new Error('no service'), { code: 'DIAGNOSTIC_UNAVAILABLE' })
    );
    const error = await getNetworkState().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkDiagnosticsError);
    expect((error as NetworkDiagnosticsError).code).toBe(
      'DIAGNOSTIC_UNAVAILABLE'
    );
  });

  it('rejects with TIMEOUT if the native call never settles', async () => {
    jest.useFakeTimers();
    try {
      nativeMock.getNetworkState.mockReturnValue(new Promise(() => {}));
      const p = getNetworkState().catch((e: unknown) => e);
      jest.advanceTimersByTime(5000);
      const error = await p;
      expect((error as NetworkDiagnosticsError).code).toBe('TIMEOUT');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('getNetworkDiagnostics', () => {
  it('makes no network request without an endpoint', async () => {
    const d = await getNetworkDiagnostics();
    expect(nativeMock.probeEndpoint).not.toHaveBeenCalled();
    expect(d.endpoint).toBeUndefined();
    expect(d.latency).toEqual({});
    expect(d.quality).toBe('unknown');
    expect(typeof d.timestamp).toBe('number');
  });

  it('is offline without probing when disconnected', async () => {
    nativeMock.getNetworkState.mockResolvedValue(OFFLINE_STATE);
    const d = await getNetworkDiagnostics({ endpoint: ENDPOINT });
    expect(nativeMock.probeEndpoint).not.toHaveBeenCalled();
    expect(d.quality).toBe('offline');
    expect(d.endpoint).toMatchObject({
      reachable: false,
      samples: 0,
      error: { code: 'CONNECTION_FAILURE' },
    });
  });

  it('probes the endpoint and classifies latency', async () => {
    nativeMock.probeEndpoint.mockResolvedValue({
      responded: true,
      statusCode: 200,
      totalMs: 82,
      dnsMs: 4,
      tcpConnectMs: 20,
      tlsHandshakeMs: 35,
    });
    const d = await getNetworkDiagnostics({
      endpoint: ENDPOINT,
      timeoutMs: 3000,
    });
    expect(nativeMock.probeEndpoint).toHaveBeenCalledWith(
      ENDPOINT,
      'HEAD',
      3000
    );
    expect(d.endpoint).toEqual({
      url: ENDPOINT,
      reachable: true,
      statusCode: 200,
      latencyMs: 82,
      samples: 1,
      successfulSamples: 1,
    });
    expect(d.latency).toEqual({
      httpsMs: 82,
      dnsMs: 4,
      tcpConnectMs: 20,
      tlsHandshakeMs: 35,
    });
    expect(d.quality).toBe('excellent');
  });

  it('takes the median of several samples', async () => {
    for (const ms of [500, 90, 120]) {
      nativeMock.probeEndpoint.mockResolvedValueOnce({
        responded: true,
        statusCode: 204,
        totalMs: ms,
      });
    }
    const d = await getNetworkDiagnostics({ endpoint: ENDPOINT, samples: 3 });
    expect(nativeMock.probeEndpoint).toHaveBeenCalledTimes(3);
    expect(d.latency.httpsMs).toBe(120);
    expect(d.quality).toBe('excellent');
  });

  it('stops sampling after the first failure', async () => {
    nativeMock.probeEndpoint.mockResolvedValue({
      responded: false,
      errorCode: 'DNS_FAILURE',
      errorMessage: 'Unable to resolve host',
    });
    const d = await getNetworkDiagnostics({ endpoint: ENDPOINT, samples: 5 });
    expect(nativeMock.probeEndpoint).toHaveBeenCalledTimes(1);
    expect(d.endpoint?.error?.code).toBe('DNS_FAILURE');
    expect(d.quality).toBe('poor');
  });

  it.each([
    'TIMEOUT',
    'DNS_FAILURE',
    'CONNECTION_FAILURE',
    'TLS_FAILURE',
    'INVALID_ENDPOINT',
    'UNKNOWN',
  ])('reports native %s without rejecting', async (code) => {
    nativeMock.probeEndpoint.mockResolvedValue({
      responded: false,
      errorCode: code,
      errorMessage: 'native message',
    });
    const d = await getNetworkDiagnostics({ endpoint: ENDPOINT });
    expect(d.endpoint?.reachable).toBe(false);
    expect(d.endpoint?.error).toEqual({ code, message: 'native message' });
  });

  it('treats an HTTP error status as reachable (network works)', async () => {
    nativeMock.probeEndpoint.mockResolvedValue({
      responded: true,
      statusCode: 503,
      totalMs: 250,
    });
    const d = await getNetworkDiagnostics({ endpoint: ENDPOINT });
    expect(d.endpoint?.reachable).toBe(true);
    expect(d.endpoint?.statusCode).toBe(503);
    expect(d.quality).toBe('good');
  });

  it('converts an unexpected native rejection into a failed sample', async () => {
    nativeMock.probeEndpoint.mockRejectedValue(new Error('bridge exploded'));
    const d = await getNetworkDiagnostics({ endpoint: ENDPOINT });
    expect(d.endpoint?.error).toEqual({
      code: 'UNKNOWN',
      message: 'bridge exploded',
    });
  });

  it('reports a malformed endpoint without calling native code', async () => {
    const d = await getNetworkDiagnostics({ endpoint: 'not a url' });
    expect(nativeMock.probeEndpoint).not.toHaveBeenCalled();
    expect(d.endpoint?.error?.code).toBe('INVALID_ENDPOINT');
    expect(d.quality).toBe('unknown');
  });

  it('rejects invalid options with INVALID_OPTIONS', async () => {
    const error = await getNetworkDiagnostics({ timeoutMs: 1 }).catch(
      (e: unknown) => e
    );
    expect((error as NetworkDiagnosticsError).code).toBe('INVALID_OPTIONS');
    expect(nativeMock.getNetworkState).not.toHaveBeenCalled();
  });

  it('is offline when the OS reports a captive portal', async () => {
    nativeMock.getNetworkState.mockResolvedValue({
      ...WIFI_STATE,
      validated: false,
      captivePortal: true,
    });
    nativeMock.probeEndpoint.mockResolvedValue({
      responded: false,
      errorCode: 'TLS_FAILURE',
    });
    const d = await getNetworkDiagnostics({ endpoint: ENDPOINT });
    expect(d.internet.captivePortal).toBe(true);
    expect(d.quality).toBe('offline');
  });

  it('applies custom thresholds', async () => {
    nativeMock.probeEndpoint.mockResolvedValue({
      responded: true,
      statusCode: 200,
      totalMs: 120,
    });
    const d = await getNetworkDiagnostics({
      endpoint: ENDPOINT,
      qualityThresholds: { excellentMs: 50, goodMs: 100, fairMs: 200 },
    });
    expect(d.quality).toBe('fair');
  });

  it('times out on the JS side if native never answers', async () => {
    jest.useFakeTimers();
    try {
      nativeMock.probeEndpoint.mockReturnValue(new Promise(() => {}));
      const p = getNetworkDiagnostics({ endpoint: ENDPOINT, timeoutMs: 1000 });
      // Let getNetworkState resolve, then pass timeout + grace.
      await Promise.resolve();
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(3000);
      const d = await p;
      expect(d.endpoint?.error?.code).toBe('TIMEOUT');
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('addNetworkStateListener', () => {
  it('starts monitoring once and stops after the last listener', () => {
    const a = addNetworkStateListener(() => {});
    const b = addNetworkStateListener(() => {});
    expect(nativeMock.startMonitoring).toHaveBeenCalledTimes(1);
    expect(__getActiveListenerCount()).toBe(2);
    a();
    expect(nativeMock.stopMonitoring).not.toHaveBeenCalled();
    b();
    expect(nativeMock.stopMonitoring).toHaveBeenCalledTimes(1);
    expect(__getActiveListenerCount()).toBe(0);
  });

  it('unsubscribe is idempotent', () => {
    const off = addNetworkStateListener(() => {});
    off();
    off();
    expect(nativeMock.stopMonitoring).toHaveBeenCalledTimes(1);
    expect(__getActiveListenerCount()).toBe(0);
  });

  it('delivers normalized states and skips duplicates', () => {
    const listener = jest.fn();
    const off = addNetworkStateListener(listener);
    emitNativeState(WIFI_STATE);
    emitNativeState(WIFI_STATE);
    emitNativeState(OFFLINE_STATE);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1]?.[0]).toMatchObject({
      connected: false,
      type: 'none',
    });
    off();
    emitNativeState(WIFI_STATE);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('rejects a non-function listener', () => {
    expect(() => addNetworkStateListener(undefined as never)).toThrow(
      NetworkDiagnosticsError
    );
  });
});
