import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addNetworkStateListener, getNetworkDiagnostics } from '../diagnostics';
import { NetworkDiagnosticsError, toNetworkDiagnosticsError } from '../errors';
import type {
  NetworkDiagnostics,
  NetworkDiagnosticsOptions,
  NetworkState,
} from '../types';

export interface UseNetworkDiagnosticsOptions extends NetworkDiagnosticsOptions {
  /**
   * Run diagnostics once when the component mounts (and again when the
   * diagnostic options change). Default `true`.
   */
  runOnMount?: boolean;
  /**
   * Opt in to re-running diagnostics when the OS reports a network change
   * (Wi-Fi to cellular, connection lost, VPN up, and so on). Changes are
   * observed passively; at most one diagnostic run follows each burst of
   * changes. Default `false`.
   */
  monitor?: boolean;
  /** Quiet period after the last network change before re-running. Default 1000 ms. */
  monitorDebounceMs?: number;
}

export interface UseNetworkDiagnosticsResult {
  /** Latest result, or `undefined` before the first run completes. */
  diagnostics: NetworkDiagnostics | undefined;
  /** `true` while a diagnostic run is in progress. */
  loading: boolean;
  /** Set when the last run rejected (invalid options or missing native module). */
  error: NetworkDiagnosticsError | undefined;
  /** Runs diagnostics now. Resolves with the result, or `undefined` on error or unmount. */
  refresh: () => Promise<NetworkDiagnostics | undefined>;
}

const DEFAULT_MONITOR_DEBOUNCE_MS = 1000;

function stateKey(state: NetworkState): string {
  return JSON.stringify({
    connected: state.connected,
    type: state.type,
    vpn: state.vpn,
    internet: state.internet,
    conditions: state.conditions,
  });
}

/**
 * React hook around `getNetworkDiagnostics`.
 *
 * By default it runs once on mount and then only when `refresh()` is called.
 * It never polls. With `monitor: true` it also re-runs after OS network
 * changes. All listeners and timers are released on unmount, and results that
 * arrive after unmount or after a newer run started are discarded.
 */
export function useNetworkDiagnostics(
  options: UseNetworkDiagnosticsOptions = {}
): UseNetworkDiagnosticsResult {
  const {
    endpoint,
    timeoutMs,
    method,
    samples,
    qualityThresholds,
    runOnMount = true,
    monitor = false,
    monitorDebounceMs = DEFAULT_MONITOR_DEBOUNCE_MS,
  } = options;

  const [diagnostics, setDiagnostics] = useState<NetworkDiagnostics>();
  const [loading, setLoading] = useState<boolean>(runOnMount);
  const [error, setError] = useState<NetworkDiagnosticsError>();

  const mountedRef = useRef(true);
  const runIdRef = useRef(0);
  const lastStateKeyRef = useRef<string | undefined>(undefined);

  // Depend on values, not on object identity, so an inline options object
  // does not trigger a new run on every render.
  const thresholdsKey = JSON.stringify(qualityThresholds ?? null);
  const diagnosticOptions = useMemo<NetworkDiagnosticsOptions>(
    () => ({
      endpoint,
      timeoutMs,
      method,
      samples,
      qualityThresholds: JSON.parse(thresholdsKey) ?? undefined,
    }),
    [endpoint, timeoutMs, method, samples, thresholdsKey]
  );

  const refresh = useCallback(async () => {
    const runId = ++runIdRef.current;
    setLoading(true);
    try {
      const result = await getNetworkDiagnostics(diagnosticOptions);
      if (!mountedRef.current || runId !== runIdRef.current) {
        return undefined;
      }
      lastStateKeyRef.current = stateKey(result);
      setDiagnostics(result);
      setError(undefined);
      setLoading(false);
      return result;
    } catch (e) {
      if (mountedRef.current && runId === runIdRef.current) {
        setError(toNetworkDiagnosticsError(e));
        setLoading(false);
      }
      return undefined;
    }
  }, [diagnosticOptions]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (runOnMount) {
      refresh();
    }
  }, [runOnMount, refresh]);

  useEffect(() => {
    if (!monitor) {
      return undefined;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = addNetworkStateListener((state) => {
        const key = stateKey(state);
        if (key === lastStateKeyRef.current) {
          // Same state as the latest result (for example the initial event
          // Android sends on registration). Nothing to re-measure.
          return;
        }
        lastStateKeyRef.current = key;
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          timer = undefined;
          refresh();
        }, monitorDebounceMs);
      });
    } catch (e) {
      setError(toNetworkDiagnosticsError(e));
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      unsubscribe?.();
    };
  }, [monitor, monitorDebounceMs, refresh]);

  return { diagnostics, loading, error, refresh };
}
