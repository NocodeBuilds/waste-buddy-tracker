import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "hazwaste_install_dismissed_at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS
    (window.navigator as any).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari doesn't fire beforeinstallprompt — show manual instructions.
    if (isIOS()) {
      setShowIOSHint(true);
      setVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    } else {
      dismiss();
    }
    setDeferred(null);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-40 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-4">
      <Card className="border-primary/40 shadow-lg bg-card/95 backdrop-blur">
        <CardContent className="p-3 flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Install HazWaste app</p>
            {showIOSHint ? (
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                Tap the Share icon in Safari, then <strong>Add to Home Screen</strong> to install.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                Add to your home screen for faster, offline-ready access.
              </p>
            )}
            {!showIOSHint && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" className="h-7 text-xs gap-1" onClick={install}>
                  <Download className="h-3.5 w-3.5" /> Install
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={dismiss}>
                  Not now
                </Button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="p-1 rounded hover:bg-muted shrink-0"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
