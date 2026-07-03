// Guarded service worker registration.
// Never registers in dev, iframe, or Lovable preview hosts.
// Supports ?sw=off kill switch to force-unregister.

const APP_SW_PATH = "/sw.js";

function isPreviewHost(hostname: string) {
  if (hostname.startsWith("id-preview--") || hostname.startsWith("preview--")) return true;
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return true;
  if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com")) return true;
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return true;
  return false;
}

async function unregisterAppSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith(APP_SW_PATH);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    /* noop */
  }
}

export function registerAppServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const inIframe = window.self !== window.top;
  const disabled = new URLSearchParams(window.location.search).get("sw") === "off";
  const shouldSkip =
    !import.meta.env.PROD ||
    inIframe ||
    isPreviewHost(window.location.hostname) ||
    disabled;

  if (shouldSkip) {
    void unregisterAppSW();
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(APP_SW_PATH, { scope: "/" }).catch(() => {
      /* noop */
    });
  });
}
