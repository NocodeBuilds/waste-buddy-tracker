import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";
export function registerAppServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || window.self !== window.top) return;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return;
  if ("caches" in window) void caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("signed-photos-")).map(k => caches.delete(k))));
  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast("An update is ready. Save your work before reloading.", {
        duration: Infinity,
        action: { label: "Reload", onClick: () => { void update(true); } },
      });
    },
    onRegisterError() { console.warn("Offline installation failed. Online access remains available."); },
  });
}
