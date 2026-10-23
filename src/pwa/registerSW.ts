import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

let swRegistration: ServiceWorkerRegistration | undefined;
let updateCheckInterval: ReturnType<typeof setInterval> | undefined;
let visibilityHandler: (() => void) | undefined;
let focusHandler: (() => void) | undefined;

function attachUpdateWatchers(registration: ServiceWorkerRegistration) {
  // onRegisteredSW can fire more than once (every time registration.update() resolves a
  // re-registration). Guard so we never stack up a new setInterval / event listener on top
  // of the previous ones and leak them unboundedly over a long-lived SPA session.
  if (updateCheckInterval) clearInterval(updateCheckInterval);
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    window.removeEventListener("focus", visibilityHandler);
  }

  updateCheckInterval = setInterval(() => {
    void registration.update().catch(() => {});
  }, 60 * 60 * 1000);

  visibilityHandler = () => {
    if (document.visibilityState === "visible") {
      void registration.update().catch(() => {});
    }
  };
  document.addEventListener("visibilitychange", visibilityHandler);
  focusHandler = () => {
    void registration.update().catch(() => {});
  };
  window.addEventListener("focus", focusHandler);
}

export function registerAppServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || window.self !== window.top) return;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return;
  if ("caches" in window) {
    void caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("signed-photos-")).map((k) => caches.delete(k)))
    );
  }

  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast("An update is ready. Save your work before reloading.", {
        duration: Infinity,
        action: { label: "Reload", onClick: () => { void update(true); } },
      });
    },
    onRegisteredSW(_swScriptUrl, registration) {
      swRegistration = registration;
      if (registration) attachUpdateWatchers(registration);
    },
    onRegisterError() {
      console.warn("Offline installation failed. Online access remains available.");
    },
  });
}

export async function checkPWAUpdate(): Promise<boolean> {
  if (!swRegistration) return false;
  try {
    await swRegistration.update();
    return true;
  } catch {
    return false;
  }
}

export function disposeServiceWorkerWatchers() {
  if (updateCheckInterval) clearInterval(updateCheckInterval);
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    window.removeEventListener("focus", focusHandler!);
  }
  updateCheckInterval = undefined;
  visibilityHandler = undefined;
  focusHandler = undefined;
}
