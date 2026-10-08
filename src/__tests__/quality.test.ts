import {
  classifyLatency,
  classifyNetworkQuality,
  DEFAULT_QUALITY_THRESHOLDS,
  resolveQualityThresholds,
} from '../quality';

describe('classifyLatency (default thresholds 150 / 400 / 1000 ms)', () => {
  it.each([
    [0, 'excellent'],
    [20, 'excellent'],
    [149, 'excellent'],
    [150, 'good'],
    [100 + 100, 'good'],
    [399, 'good'],
    [400, 'fair'],
    [999, 'fair'],
    [1000, 'poor'],
    [5000, 'poor'],
  ] as const)('%d ms -> %s', (ms, expected) => {
    expect(classifyLatency(ms)).toBe(expected);
  });

  it('uses custom thresholds', () => {
    const t = { excellentMs: 50, goodMs: 100, fairMs: 200 };
    expect(classifyLatency(49, t)).toBe('excellent');
    expect(classifyLatency(50, t)).toBe('good');
    expect(classifyLatency(150, t)).toBe('fair');
    expect(classifyLatency(200, t)).toBe('poor');
  });
});

describe('classifyNetworkQuality', () => {
  it('offline when not connected, regardless of other inputs', () => {
    expect(
      classifyNetworkQuality({
        connected: false,
        reachable: true,
        latencyMs: 10,
      })
    ).toBe('offline');
  });

  it('offline when the OS reports a captive portal', () => {
    expect(
      classifyNetworkQuality({
        connected: true,
        captivePortal: true,
        reachable: true,
        latencyMs: 10,
      })
    ).toBe('offline');
  });

  it('poor when a probe was made and the endpoint was unreachable', () => {
    expect(
      classifyNetworkQuality({
        connected: true,
        validated: true,
        reachable: false,
      })
    ).toBe('poor');
  });

  it('classifies by latency when reachable', () => {
    expect(
      classifyNetworkQuality({
        connected: true,
        reachable: true,
        latencyMs: 85,
      })
    ).toBe('excellent');
    expect(
      classifyNetworkQuality({
        connected: true,
        reachable: true,
        latencyMs: 250,
      })
    ).toBe('good');
    expect(
      classifyNetworkQuality({
        connected: true,
        reachable: true,
        latencyMs: 700,
      })
    ).toBe('fair');
    expect(
      classifyNetworkQuality({
        connected: true,
        reachable: true,
        latencyMs: 1500,
      })
    ).toBe('poor');
  });

  it('latency wins over validated=false when the probe succeeded', () => {
    expect(
      classifyNetworkQuality({
        connected: true,
        validated: false,
        reachable: true,
        latencyMs: 85,
      })
    ).toBe('excellent');
  });

  it('poor when no probe and the OS says internet is not validated', () => {
    expect(classifyNetworkQuality({ connected: true, validated: false })).toBe(
      'poor'
    );
  });

  it('unknown when nothing was measured', () => {
    expect(classifyNetworkQuality({ connected: true })).toBe('unknown');
    expect(classifyNetworkQuality({ connected: true, validated: true })).toBe(
      'unknown'
    );
  });

  it('unknown when reachable but latency is missing or invalid', () => {
    expect(classifyNetworkQuality({ connected: true, reachable: true })).toBe(
      'unknown'
    );
    expect(
      classifyNetworkQuality({
        connected: true,
        reachable: true,
        latencyMs: Number.NaN,
      })
    ).toBe('unknown');
    expect(
      classifyNetworkQuality({
        connected: true,
        reachable: true,
        latencyMs: -1,
      })
    ).toBe('unknown');
  });
});

describe('resolveQualityThresholds', () => {
  it('returns defaults without overrides', () => {
    expect(resolveQualityThresholds()).toEqual(DEFAULT_QUALITY_THRESHOLDS);
  });

  it('merges partial overrides and ignores undefined values', () => {
    expect(
      resolveQualityThresholds({ excellentMs: 100, goodMs: undefined })
    ).toEqual({ excellentMs: 100, goodMs: 400, fairMs: 1000 });
  });

  it.each([
    [{ excellentMs: 0 }],
    [{ excellentMs: -5 }],
    [{ goodMs: 100, excellentMs: 200 }],
    [{ fairMs: 300 }],
    [{ fairMs: Number.POSITIVE_INFINITY }],
  ])('rejects invalid thresholds %j', (overrides) => {
    expect(() => resolveQualityThresholds(overrides)).toThrow(RangeError);
  });

  it('defaults are frozen', () => {
    expect(Object.isFrozen(DEFAULT_QUALITY_THRESHOLDS)).toBe(true);
  });
});
