import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAppServiceWorker } from "./pwa/registerSW";

createRoot(document.getElementById("root")!).render(<App />);

registerAppServiceWorker();

// Prompt user before reloading when a new service worker takes control.
// Prevents silent data loss if the user has unsaved form input.
if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    const ok = confirm("A new version of WasteBuddy is available. Reload now?");
    if (ok) window.location.reload();
    // If user declines, keep using the current SW; they can reload manually.
  });
}
