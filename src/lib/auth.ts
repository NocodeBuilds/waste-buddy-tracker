import { z } from "zod";

/**
 * Canonical redirect targets for auth-related deep links (e.g. password recovery).
 *
 * A single, build-time-derived allowlist shared by every auth page. Previously
 * `Auth.tsx` and `AdminAuth.tsx` each defined an identical, tautological
 * `[window.location.origin]` whitelist (which always "validates" the current
 * origin against itself, so it actually blocked nothing). This version adds the
 * configured production origin (VITE_APP_URL) to the allowlist so a redirect
 * target pointing at a different, untrusted origin is genuinely rejected.
 */
const VITE_APP_URL = import.meta.env.VITE_APP_URL as string | undefined;

const ALLOWED_REDIRECT_ORIGINS: string[] = [window.location.origin, ...(VITE_APP_URL ? [new URL(VITE_APP_URL).origin] : [])];

export function getSafeRedirect(path: string): string {
  const fallback = ALLOWED_REDIRECT_ORIGINS[0];
  const target = `${fallback}${path}`;
  try {
    const origin = new URL(target).origin;
    if (!ALLOWED_REDIRECT_ORIGINS.includes(origin)) return fallback + "/auth";
    return target;
  } catch {
    return fallback + "/auth";
  }
}

export const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
