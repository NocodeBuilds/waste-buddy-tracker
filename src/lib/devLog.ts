/**
 * Console helpers gated behind development mode.
 * In production, these are no-ops so no internal state leaks into the browser console.
 */
const isDev = import.meta.env.DEV;

export function devLog(...args: unknown[]) {
  if (isDev) console.log(...args);
}

export function devWarn(...args: unknown[]) {
  if (isDev) console.warn(...args);
}

export function devError(...args: unknown[]) {
  if (isDev) console.error(...args);
}
