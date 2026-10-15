import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

let swRegistration: ServiceWorkerRegistration | undefined;

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
      if (registration) {
        // Periodically check for service worker updates every 60 minutes
        setInterval(() => {
          void registration.update().catch(() => {});
        }, 60 * 60 * 1000);

        // Check for updates whenever the tab becomes visible or gains focus
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            void registration.update().catch(() => {});
          }
        });
        window.addEventListener("focus", () => {
          void registration.update().catch(() => {});
        });
      }
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
