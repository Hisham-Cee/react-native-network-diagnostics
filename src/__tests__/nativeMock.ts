import type {
  NativeNetworkState,
  NativeProbeResult,
} from '../NativeNetworkDiagnostics';

type Listener = (state: NativeNetworkState) => void;

export const listeners = new Set<Listener>();

export const nativeMock = {
  getNetworkState: jest.fn<Promise<NativeNetworkState>, []>(),
  probeEndpoint: jest.fn<
    Promise<NativeProbeResult>,
    [string, string, number]
  >(),
  startMonitoring: jest.fn<void, []>(),
  stopMonitoring: jest.fn<void, []>(),
  onNetworkStateChange: jest.fn((listener: Listener) => {
    listeners.add(listener);
    return {
      remove: jest.fn(() => {
        listeners.delete(listener);
      }),
    };
  }),
};

export function emitNativeState(state: NativeNetworkState): void {
  for (const listener of [...listeners]) {
    listener(state);
  }
}

export const WIFI_STATE: NativeNetworkState = {
  connected: true,
  type: 'wifi',
  vpn: false,
  validated: true,
  captivePortal: false,
  metered: false,
  constrained: false,
};

export const OFFLINE_STATE: NativeNetworkState = {
  connected: false,
  type: 'none',
};

export function resetNativeMock(): void {
  listeners.clear();
  nativeMock.getNetworkState.mockReset();
  nativeMock.probeEndpoint.mockReset();
  nativeMock.startMonitoring.mockReset();
  nativeMock.stopMonitoring.mockReset();
  nativeMock.onNetworkStateChange.mockClear();
  nativeMock.getNetworkState.mockResolvedValue(WIFI_STATE);
}
