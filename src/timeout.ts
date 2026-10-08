/**
 * Extra time granted to the native layer beyond the requested timeout before
 * the JavaScript guard gives up. Native timeouts should always fire first;
 * the guard only protects against a native promise that never settles.
 */
export const JS_TIMEOUT_GRACE_MS = 2000;

/**
 * Resolves with the promise's value, or with `onTimeout()` if it does not
 * settle within `ms`. Rejections of `promise` are passed through.
 * The timer is always cleared, so no handle is leaked.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => T
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(onTimeout());
      }
    }, ms);
    promise.then(
      (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }
      },
      (error: unknown) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      }
    );
  });
}
