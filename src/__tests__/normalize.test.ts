import {
  aggregateSamples,
  median,
  normalizeNetworkState,
  normalizeNetworkType,
  normalizeProbeResult,
} from '../normalize';

describe('normalizeNetworkType', () => {
  it.each(['wifi', 'cellular', 'ethernet', 'vpn', 'other', 'unknown', 'none'])(
    'keeps %s',
    (t) => {
      expect(normalizeNetworkType(t)).toBe(t);
    }
  );

  it.each(['bluetooth', 'WIFI', '', 3, undefined])(
    'maps %p to unknown',
    (t) => {
      expect(normalizeNetworkType(t)).toBe('unknown');
    }
  );
});

describe('normalizeNetworkState', () => {
  it('maps a full Android-style payload', () => {
    expect(
      normalizeNetworkState({
        connected: true,
        type: 'cellular',
        vpn: true,
        validated: true,
        captivePortal: false,
        metered: true,
        constrained: false,
      })
    ).toEqual({
      connected: true,
      type: 'cellular',
      vpn: true,
      internet: { validated: true, captivePortal: false },
      conditions: { metered: true, constrained: false },
    });
  });

  it('leaves iOS-unavailable fields undefined instead of inventing them', () => {
    const s = normalizeNetworkState({
      connected: true,
      type: 'wifi',
      metered: false,
      constrained: true,
    });
    expect(s.vpn).toBeUndefined();
    expect(s.internet.validated).toBeUndefined();
    expect(s.internet.captivePortal).toBeUndefined();
    expect(s.conditions).toEqual({ metered: false, constrained: true });
  });

  it('forces type none when disconnected', () => {
    expect(normalizeNetworkState({ connected: false, type: 'wifi' }).type).toBe(
      'none'
    );
  });

  it('forces type unknown when connected but type none', () => {
    expect(normalizeNetworkState({ connected: true, type: 'none' }).type).toBe(
      'unknown'
    );
  });

  it('treats garbage as disconnected', () => {
    for (const raw of [null, undefined, 'x', 1, {}]) {
      const s = normalizeNetworkState(raw);
      expect(s.connected).toBe(false);
      expect(s.type).toBe('none');
    }
  });

  it('drops non-boolean optional values', () => {
    const s = normalizeNetworkState({
      connected: true,
      type: 'wifi',
      validated: 'yes',
      metered: 1,
    });
    expect(s.internet.validated).toBeUndefined();
    expect(s.conditions.metered).toBeUndefined();
  });
});

describe('normalizeProbeResult', () => {
  it('maps a successful probe and rounds durations', () => {
    expect(
      normalizeProbeResult({
        responded: true,
        statusCode: 204,
        totalMs: 84.6,
        dnsMs: 3.2,
        tcpConnectMs: 20,
        tlsHandshakeMs: 30,
      })
    ).toEqual({
      responded: true,
      statusCode: 204,
      totalMs: 85,
      dnsMs: 3,
      tcpConnectMs: 20,
      tlsHandshakeMs: 30,
    });
  });

  it('maps a failed probe to a structured error', () => {
    expect(
      normalizeProbeResult({
        responded: false,
        errorCode: 'DNS_FAILURE',
        errorMessage: 'Unable to resolve host',
      })
    ).toEqual({
      responded: false,
      statusCode: undefined,
      totalMs: undefined,
      dnsMs: undefined,
      tcpConnectMs: undefined,
      tlsHandshakeMs: undefined,
      error: { code: 'DNS_FAILURE', message: 'Unable to resolve host' },
    });
  });

  it('normalizes unknown error codes and missing messages', () => {
    const r = normalizeProbeResult({ responded: false, errorCode: 'E_X' });
    expect(r.error?.code).toBe('UNKNOWN');
    expect(r.error?.message.length).toBeGreaterThan(0);
  });

  it('drops invalid numbers and status codes', () => {
    const r = normalizeProbeResult({
      responded: true,
      statusCode: 42,
      totalMs: -1,
      dnsMs: Number.NaN,
      tlsHandshakeMs: Number.POSITIVE_INFINITY,
    });
    expect(r.statusCode).toBeUndefined();
    expect(r.totalMs).toBeUndefined();
    expect(r.dnsMs).toBeUndefined();
    expect(r.tlsHandshakeMs).toBeUndefined();
  });

  it('treats garbage as a failed probe', () => {
    expect(normalizeProbeResult(null).responded).toBe(false);
  });
});

describe('median', () => {
  it.each([
    [[], undefined],
    [[5], 5],
    [[3, 1, 2], 2],
    [[1, 2, 3, 10], 3],
    [[1, 2], 2],
    [[100, 80, 300], 100],
  ])('median(%j) = %p', (values, expected) => {
    expect(median(values)).toBe(expected);
  });
});

describe('aggregateSamples', () => {
  const url = 'https://api.example.com/health';

  it('reports medians of successful samples', () => {
    const { endpoint, latency } = aggregateSamples(url, [
      { responded: true, statusCode: 200, totalMs: 100, dnsMs: 10 },
      { responded: true, statusCode: 200, totalMs: 300, dnsMs: 2 },
      { responded: true, statusCode: 204, totalMs: 80, dnsMs: 1 },
    ]);
    expect(endpoint).toEqual({
      url,
      reachable: true,
      statusCode: 204,
      latencyMs: 100,
      samples: 3,
      successfulSamples: 3,
    });
    expect(latency).toEqual({
      httpsMs: 100,
      dnsMs: 2,
      tcpConnectMs: undefined,
      tlsHandshakeMs: undefined,
    });
  });

  it('reports the last error when nothing succeeded', () => {
    const { endpoint, latency } = aggregateSamples(url, [
      { responded: false, error: { code: 'TIMEOUT', message: 't' } },
    ]);
    expect(endpoint.reachable).toBe(false);
    expect(endpoint.error).toEqual({ code: 'TIMEOUT', message: 't' });
    expect(endpoint.latencyMs).toBeUndefined();
    expect(latency.httpsMs).toBeUndefined();
  });

  it('is reachable if any sample succeeded', () => {
    const { endpoint } = aggregateSamples(url, [
      { responded: true, statusCode: 503, totalMs: 120 },
      { responded: false, error: { code: 'TIMEOUT', message: 't' } },
    ]);
    expect(endpoint.reachable).toBe(true);
    expect(endpoint.statusCode).toBe(503);
    expect(endpoint.error).toBeUndefined();
    expect(endpoint.successfulSamples).toBe(1);
  });
});
