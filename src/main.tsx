import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAppServiceWorker } from "./pwa/registerSW";

createRoot(document.getElementById("root")!).render(<App />);

registerAppServiceWorker();

// Listen for SW updates and prompt reload
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}
