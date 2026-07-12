import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "hazwaste_install_dismissed_at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    if (isStandalone()) return;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    if (isIOS()) {
      setPlatform("ios");
      setVisible(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
      if (isAndroid()) setPlatform("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);

    const timer = setTimeout(() => {
      setVisible(true);
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
      } else {
        dismiss();
      }
      setDeferred(null);
    } else {
      // Desktop: instructions for browser menu install
      dismiss();
    }
  };

  if (!visible) return null;

  const getInstructions = () => {
    if (platform === "ios") {
      return "Tap the Share icon in Safari, then Add to Home Screen to install.";
    }
    if (platform === "android" && deferred) {
      return "Install for faster, offline-ready access.";
    }
    return "Add to home screen for faster access. Use your browser menu to install this app.";
  };

  return (
    <div className="fixed bottom-24 left-3 right-3 z-40 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-4">
      <Card className="border-primary/40 shadow-lg bg-card/95 backdrop-blur">
        <CardContent className="p-3 flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Install HazWaste app</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              {getInstructions()}
            </p>
            <div className="flex gap-2 mt-2">
              <Button size="sm" className="h-7 text-xs gap-1" onClick={install}>
                <Download className="h-3.5 w-3.5" /> Install
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={dismiss}>
                Not now
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="p-1 rounded hover:bg-muted shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
