// Guarded service worker registration.
// Never registers in dev or iframe. Supports ?sw=off kill switch.

const APP_SW_PATH = "/sw.js";
const CACHE_VERSION = "wastebuddy-v2";

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
  const shouldSkip = !import.meta.env.PROD || inIframe || disabled;

  if (shouldSkip) {
    void unregisterAppSW();
    return;
  }

  // Force-clear any stale service worker from a previous deployment
  if ("caches" in window) {
    caches.keys().then((names) => {
      const stale = names.filter((n) => n !== CACHE_VERSION);
      if (stale.length > 0) {
        console.log("[PWA] Clearing stale caches:", stale);
        stale.forEach((n) => caches.delete(n));
      }
    }).catch(() => {});
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(APP_SW_PATH, { scope: "/" }).catch(() => {
      /* noop */
    });
  });
}
