import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";

const QUEUE_KEY = "wastebuddy_offline_pending_entries";

async function signPayload(payload: string): Promise<string> {
  try {
    const keyData = new Uint8Array(32);
    crypto.getRandomValues(keyData);
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payload));
    const sigBytes = new Uint8Array(signature);
    return btoa(String.fromCharCode(...sigBytes));
  } catch {
    return "";
  }
}

export interface PendingEntry {
  tempId: string;
  siteId: string;
  userId: string;
  timestamp: number;
  signature?: string;
  payload?: string;
  data: {
    waste_type_id: string;
    waste_category: "hazardous" | "non_hazardous" | "e_waste" | "other_wastes";
    weight_kg: number;
    piece_count?: number | null;
    generated_date: string;
    activity_type: "breakdown" | "preventive" | "5s" | "others";
    location?: string | null;
    notes?: string | null;
  };
}

export function getPendingQueue(): PendingEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveToPendingQueue(entry: PendingEntry) {
  if (typeof window === "undefined") return;
  try {
    const queue = getPendingQueue();
    queue.push(entry);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("[OfflineSync] Failed to save entry to offline queue:", err);
  }
}

export function removeFromPendingQueue(tempId: string) {
  if (typeof window === "undefined") return;
  try {
    const queue = getPendingQueue().filter((item) => item.tempId !== tempId);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("[OfflineSync] Failed to remove item from offline queue:", err);
  }
}

export function clearPendingQueue() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {}
}

export async function createPendingEntry(
  siteId: string,
  userId: string,
  data: PendingEntry["data"]
): Promise<PendingEntry | null> {
  if (typeof window === "undefined") return null;
  const tempId = crypto.randomUUID();
  const timestamp = Date.now();
  const payloadObj = { tempId, data, timestamp, userId, siteId };
  const payload = JSON.stringify(payloadObj);
  const signature = await signPayload(payload);
  return { tempId, siteId, userId, timestamp, signature, payload, data };
}

let isSyncing = false;

export async function syncPendingEntries(queryClient?: QueryClient): Promise<number> {
  if (isSyncing || typeof window === "undefined" || !navigator.onLine) return 0;
  const queue = getPendingQueue();
  if (queue.length === 0) return 0;

  isSyncing = true;
  let syncedCount = 0;
  const sitesToInvalidate = new Set<string>();

  try {
    for (const item of queue) {
      const reconstructedPayload = JSON.stringify({
        tempId: item.tempId,
        data: item.data,
        timestamp: item.timestamp,
        userId: item.userId,
        siteId: item.siteId,
      });

      if (item.signature) {
        const expectedSignature = await signPayload(reconstructedPayload);
        if (item.signature !== expectedSignature) {
          console.warn("[OfflineSync] Signature mismatch for entry, skipping:", item.tempId);
          removeFromPendingQueue(item.tempId);
          continue;
        }
      }

      const { data, error } = await supabase
        .from("waste_entries")
        .insert({
          ...item.data,
          quantity: item.data.weight_kg,
          site_id: item.siteId,
          created_by: item.userId,
        })
        .select("id")
        .single();

      if (!error && data?.id) {
        removeFromPendingQueue(item.tempId);
        syncedCount++;
        sitesToInvalidate.add(item.siteId);
      }
    }

    if (syncedCount > 0) {
      toast.success(`Synced ${syncedCount} offline ${syncedCount === 1 ? "entry" : "entries"} to server`);
      if (queryClient) {
        for (const sId of sitesToInvalidate) {
          queryClient.invalidateQueries({ queryKey: ["waste_entries", sId] });
        }
        queryClient.invalidateQueries({ queryKey: ["waste_entries"] });
      }
    }
  } catch (err) {
    console.error("[OfflineSync] Error during sync:", err);
  } finally {
    isSyncing = false;
  }

  return syncedCount;
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [pendingCount, setPendingCount] = useState(() => getPendingQueue().length);

  const refreshPending = useCallback(() => {
    setPendingCount(getPendingQueue().length);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncPendingEntries().then(refreshPending);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = setInterval(refreshPending, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [refreshPending]);

  return {
    isOnline,
    pendingCount,
    syncNow: async () => {
      await syncPendingEntries();
      refreshPending();
    },
  };
}
