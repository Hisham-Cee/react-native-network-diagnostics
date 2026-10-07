import { withTimeout } from '../timeout';

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves with the value when the promise settles first', async () => {
    const p = withTimeout(Promise.resolve('ok'), 1000, () => 'timeout');
    await expect(p).resolves.toBe('ok');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('resolves with the fallback when the promise never settles', async () => {
    const never = new Promise<string>(() => {});
    const p = withTimeout(never, 1000, () => 'timeout');
    jest.advanceTimersByTime(999);
    let settled = false;
    p.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    jest.advanceTimersByTime(1);
    await expect(p).resolves.toBe('timeout');
  });

  it('passes rejections through and clears the timer', async () => {
    const p = withTimeout(
      Promise.reject(new Error('boom')),
      1000,
      () => 'timeout'
    );
    await expect(p).rejects.toThrow('boom');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('ignores a late result after the timeout fired', async () => {
    let resolveLate: (v: string) => void = () => {};
    const late = new Promise<string>((r) => {
      resolveLate = r;
    });
    const p = withTimeout(late, 10, () => 'timeout');
    jest.advanceTimersByTime(10);
    resolveLate('late');
    await expect(p).resolves.toBe('timeout');
  });
});
