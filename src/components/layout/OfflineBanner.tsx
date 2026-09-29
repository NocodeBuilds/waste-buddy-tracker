import { useOnlineStatus } from "@/lib/offlineSync";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflineBanner() {
  const { isOnline, pendingCount, syncNow } = useOnlineStatus();

  if (isOnline && pendingCount === 0) return null;

  return (
    <aside aria-label="Network status" className="w-full bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-500/30 text-amber-800 dark:text-amber-300 px-3 py-1.5 text-xs transition-all">
      <div className="max-w-[1680px] mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <>
              <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="font-medium">
                Offline Mode — entries are saved locally on this device and will sync automatically when reconnected.
              </span>
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
              <span className="font-medium">
                Connected. {pendingCount} {pendingCount === 1 ? "record" : "records"} queued for cloud sync.
              </span>
            </>
          )}
        </div>

        {isOnline && pendingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={syncNow}
            className="h-6 px-2 text-[11px] gap-1 font-semibold border-amber-500/40 bg-card hover:bg-muted text-amber-900 dark:text-amber-200"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Sync Now</span>
          </Button>
        )}
      </div>
    </aside>
  );
}
