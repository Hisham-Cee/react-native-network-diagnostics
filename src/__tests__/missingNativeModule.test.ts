import {
  addNetworkStateListener,
  getNetworkDiagnostics,
  getNetworkState,
  NetworkDiagnosticsError,
} from '../index';

jest.mock('../NativeNetworkDiagnostics', () => ({
  __esModule: true,
  default: null,
}));

describe('when the native module is not linked', () => {
  it('importing the package does not throw', () => {
    expect(typeof getNetworkState).toBe('function');
  });

  it('getNetworkState rejects with DIAGNOSTIC_UNAVAILABLE', async () => {
    const e = await getNetworkState().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(NetworkDiagnosticsError);
    expect((e as NetworkDiagnosticsError).code).toBe('DIAGNOSTIC_UNAVAILABLE');
    expect((e as NetworkDiagnosticsError).message).toContain('pod install');
  });

  it('getNetworkDiagnostics rejects with DIAGNOSTIC_UNAVAILABLE', async () => {
    const e = await getNetworkDiagnostics().catch((x: unknown) => x);
    expect((e as NetworkDiagnosticsError).code).toBe('DIAGNOSTIC_UNAVAILABLE');
  });

  it('addNetworkStateListener throws DIAGNOSTIC_UNAVAILABLE', () => {
    expect(() => addNetworkStateListener(() => {})).toThrow(
      NetworkDiagnosticsError
    );
  });
});
