import { act, renderHook, waitFor } from '@testing-library/react-native';
import { __getActiveListenerCount } from '../diagnostics';
import type { NativeProbeResult } from '../NativeNetworkDiagnostics';
import { useNetworkDiagnostics } from '../hooks/useNetworkDiagnostics';
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
  nativeMock.probeEndpoint.mockResolvedValue({
    responded: true,
    statusCode: 200,
    totalMs: 250,
  });
});

describe('useNetworkDiagnostics', () => {
  it('runs once on mount and exposes the result', async () => {
    const { result } = await renderHook(() =>
      useNetworkDiagnostics({ endpoint: ENDPOINT })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.diagnostics?.quality).toBe('good');
    expect(result.current.error).toBeUndefined();
    expect(nativeMock.probeEndpoint).toHaveBeenCalledTimes(1);
  });

  it('does not poll and does not monitor by default', async () => {
    jest.useFakeTimers();
    try {
      const { result } = await renderHook(() =>
        useNetworkDiagnostics({ endpoint: ENDPOINT })
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
      });
      expect(nativeMock.probeEndpoint).toHaveBeenCalledTimes(1);
      expect(nativeMock.startMonitoring).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports loading while a run is in progress', async () => {
    let resolveProbe: (v: NativeProbeResult) => void = () => {};
    nativeMock.probeEndpoint.mockReturnValue(
      new Promise((r) => {
        resolveProbe = r;
      })
    );
    const { result } = await renderHook(() =>
      useNetworkDiagnostics({ endpoint: ENDPOINT })
    );
    expect(result.current.loading).toBe(true);
    expect(result.current.diagnostics).toBeUndefined();
    await act(async () => {
      resolveProbe({ responded: true, statusCode: 200, totalMs: 100 });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.diagnostics?.quality).toBe('excellent');
  });

  it('runOnMount=false waits for refresh()', async () => {
    const { result } = await renderHook(() =>
      useNetworkDiagnostics({ endpoint: ENDPOINT, runOnMount: false })
    );
    expect(result.current.loading).toBe(false);
    expect(nativeMock.getNetworkState).not.toHaveBeenCalled();
    let value: unknown;
    await act(async () => {
      value = await result.current.refresh();
    });
    expect(value).toBeDefined();
    expect(result.current.diagnostics?.endpoint?.reachable).toBe(true);
  });

  it('does not re-run when re-rendered with an equal inline options object', async () => {
    const { result, rerender } = await renderHook(
      (props: { timeoutMs: number }) =>
        useNetworkDiagnostics({
          endpoint: ENDPOINT,
          timeoutMs: props.timeoutMs,
          qualityThresholds: { excellentMs: 100 },
        }),
      { initialProps: { timeoutMs: 3000 } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await rerender({ timeoutMs: 3000 });
    await rerender({ timeoutMs: 3000 });
    expect(nativeMock.probeEndpoint).toHaveBeenCalledTimes(1);
    await rerender({ timeoutMs: 4000 });
    await waitFor(() =>
      expect(nativeMock.probeEndpoint).toHaveBeenCalledTimes(2)
    );
  });

  it('exposes INVALID_OPTIONS as error', async () => {
    const { result } = await renderHook(() =>
      useNetworkDiagnostics({ timeoutMs: 1 })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.code).toBe('INVALID_OPTIONS');
    expect(result.current.diagnostics).toBeUndefined();
  });

  it('monitor: re-runs after a network change (debounced) and cleans up', async () => {
    jest.useFakeTimers();
    try {
      const { result, unmount } = await renderHook(() =>
        useNetworkDiagnostics({
          endpoint: ENDPOINT,
          monitor: true,
          monitorDebounceMs: 500,
        })
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(nativeMock.startMonitoring).toHaveBeenCalledTimes(1);
      expect(nativeMock.probeEndpoint).toHaveBeenCalledTimes(1);

      // Same state as the current result: ignored.
      await act(async () => {
        emitNativeState(WIFI_STATE);
        await jest.advanceTimersByTimeAsync(1000);
      });
      expect(nativeMock.probeEndpoint).toHaveBeenCalledTimes(1);

      // A burst of changes leads to exactly one new run.
      nativeMock.getNetworkState.mockResolvedValue({
        ...WIFI_STATE,
        type: 'cellular',
        metered: true,
      });
      await act(async () => {
        emitNativeState(OFFLINE_STATE);
        emitNativeState({ ...WIFI_STATE, type: 'cellular', metered: true });
        await jest.advanceTimersByTimeAsync(499);
      });
      expect(nativeMock.probeEndpoint).toHaveBeenCalledTimes(1);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1);
      });
      await waitFor(() =>
        expect(result.current.diagnostics?.type).toBe('cellular')
      );
      expect(nativeMock.probeEndpoint).toHaveBeenCalledTimes(2);

      await unmount();
      expect(nativeMock.stopMonitoring).toHaveBeenCalledTimes(1);
      expect(__getActiveListenerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('pending debounce timer is cleared on unmount', async () => {
    jest.useFakeTimers();
    try {
      const { result, unmount } = await renderHook(() =>
        useNetworkDiagnostics({ monitor: true })
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        emitNativeState(OFFLINE_STATE);
      });
      await unmount();
      const calls = nativeMock.getNetworkState.mock.calls.length;
      await jest.advanceTimersByTimeAsync(5000);
      expect(nativeMock.getNetworkState.mock.calls.length).toBe(calls);
    } finally {
      jest.useRealTimers();
    }
  });

  it('discards a result that arrives after unmount', async () => {
    let resolveProbe: (v: { responded: boolean }) => void = () => {};
    nativeMock.probeEndpoint.mockReturnValue(
      new Promise((r) => {
        resolveProbe = r;
      })
    );
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result, unmount } = await renderHook(() =>
      useNetworkDiagnostics({ endpoint: ENDPOINT })
    );
    await waitFor(() =>
      expect(nativeMock.probeEndpoint).toHaveBeenCalledTimes(1)
    );
    await unmount();
    await act(async () => {
      resolveProbe({ responded: true });
    });
    expect(result.current.diagnostics).toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('only the latest of overlapping refreshes is applied', async () => {
    const resolvers: Array<(v: NativeProbeResult) => void> = [];
    nativeMock.probeEndpoint.mockImplementation(
      () =>
        new Promise((r) => {
          resolvers.push(r);
        })
    );
    const { result } = await renderHook(() =>
      useNetworkDiagnostics({ endpoint: ENDPOINT, runOnMount: false })
    );
    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    await act(async () => {
      first = result.current.refresh();
      second = result.current.refresh();
    });
    await waitFor(() => expect(resolvers.length).toBe(2));
    await act(async () => {
      resolvers[1]?.({ responded: true, statusCode: 200, totalMs: 50 });
      await second;
      resolvers[0]?.({ responded: true, statusCode: 200, totalMs: 900 });
      await first;
    });
    expect(result.current.diagnostics?.latency.httpsMs).toBe(50);
    await expect(first).resolves.toBeUndefined();
  });
});
