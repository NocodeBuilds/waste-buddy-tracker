import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAppServiceWorker } from "./pwa/registerSW";

// Protect against browser extensions / Google Translate mutating DOM nodes out of React's sync
if (typeof window !== "undefined") {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return this.appendChild(newNode) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

// Global error handlers — capture unhandled exceptions and promise rejections
// for forensic debugging without leaking sensitive data to external services.
if (typeof window !== "undefined") {
  const logSecurityEvent = (type: string, detail: unknown) => {
    console.error(`[${type}]`, detail);
  };

  window.addEventListener("error", (evt) => {
    logSecurityEvent("GlobalError", {
      message: evt.message,
      source: evt.filename,
      lineno: evt.lineno,
      colno: evt.colno,
    });
  });

  window.addEventListener("unhandledrejection", (evt) => {
    const reason = evt.reason instanceof Error ? evt.reason.message : String(evt.reason);
    logSecurityEvent("UnhandledRejection", { reason });
    evt.preventDefault();
  });
}

createRoot(document.getElementById("root")!).render(<App />);

registerAppServiceWorker();

// Listen for SW updates and prompt reload
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}
