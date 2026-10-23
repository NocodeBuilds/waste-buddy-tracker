import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X, Share2, PlusSquare } from "lucide-react";
import { STORAGE_KEYS } from "@/lib/storageKeys";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = STORAGE_KEYS.installPromptDismissed;
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
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

// Global reference for manual installation trigger from Settings
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(canInstall: boolean) => void>();

export function getCanInstall(): boolean {
  return !isStandalone() && (globalDeferredPrompt !== null || isIOS());
}

export function subscribeInstallState(callback: (canInstall: boolean) => void): () => void {
  promptListeners.add(callback);
  callback(getCanInstall());
  return () => {
    promptListeners.delete(callback);
  };
}

export async function triggerManualInstall(onOpenIOSGuide?: () => void): Promise<"accepted" | "dismissed" | "ios_guide" | "unavailable"> {
  if (isStandalone()) return "unavailable";
  if (globalDeferredPrompt) {
    await globalDeferredPrompt.prompt();
    const choice = await globalDeferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      globalDeferredPrompt = null;
      promptListeners.forEach((l) => l(false));
    }
    return choice.outcome;
  }
  if (isIOS()) {
    onOpenIOSGuide?.();
    return "ios_guide";
  }
  return "unavailable";
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(() => globalDeferredPrompt);
  const [visible, setVisible] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    if (isStandalone()) return;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    if (isIOS()) {
      setPlatform("ios");
      // Delay prompt slightly so user first sees the interface
      const t = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(t);
    }

    if (isAndroid()) {
      setPlatform("android");
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      const ev = e as BeforeInstallPromptEvent;
      globalDeferredPrompt = ev;
      setDeferred(ev);
      setVisible(true);
      promptListeners.forEach((l) => l(true));
    };

    const onInstalled = () => {
      setVisible(false);
      globalDeferredPrompt = null;
      promptListeners.forEach((l) => l(false));
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const handleInstallClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
      } else {
        dismiss();
      }
      globalDeferredPrompt = null;
      setDeferred(null);
      promptListeners.forEach((l) => l(false));
    } else if (platform === "ios") {
      setShowIOSGuide(true);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-3 right-3 z-40 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-4">
      <Card className="border-primary/40 shadow-xl bg-card/95 backdrop-blur-md">
        <CardContent className="p-3.5 flex items-start gap-3">
          <img
            src="/icons/icon-192x192.png"
            alt="WasteBuddy"
            className="h-10 w-10 rounded-xl shadow-xs object-cover border border-primary/20 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">
              Install Waste<span className="text-primary font-bold">Buddy</span> app
            </p>
            {platform === "ios" ? (
              showIOSGuide ? (
                <div className="text-[11px] text-muted-foreground mt-1.5 space-y-1 bg-muted/60 p-2 rounded-lg border border-border/50">
                  <p className="flex items-center gap-1.5 font-medium text-foreground">
                    <Share2 className="h-3.5 w-3.5 text-primary shrink-0" /> 1. Tap the Share button in Safari
                  </p>
                  <p className="flex items-center gap-1.5 font-medium text-foreground">
                    <PlusSquare className="h-3.5 w-3.5 text-primary shrink-0" /> 2. Select &ldquo;Add to Home Screen&rdquo;
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Install on your iPhone or iPad for fast offline logging and full-screen compliance tracking.
                </p>
              )
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                Install for offline-ready access, fast generation entry, and home screen convenience.
              </p>
            )}

            <div className="flex gap-2 mt-2.5">
              {platform === "ios" ? (
                showIOSGuide ? (
                  <Button size="sm" variant="default" className="h-7 text-xs" onClick={dismiss}>
                    Got it
                  </Button>
                ) : (
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setShowIOSGuide(true)}>
                    <Download className="h-3.5 w-3.5" /> How to install
                  </Button>
                )
              ) : (
                <Button size="sm" className="h-7 text-xs gap-1" onClick={handleInstallClick}>
                  <Download className="h-3.5 w-3.5" /> Install
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={dismiss}>
                Not now
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="p-1 rounded hover:bg-muted shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
