import { useState, useCallback } from "react";
import { WasteEntry } from "@/lib/wasteTypes";

const STORAGE_KEY = "hazwaste-entries";

function loadEntries(): WasteEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: WasteEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function useWasteStore() {
  const [entries, setEntries] = useState<WasteEntry[]>(loadEntries);

  const addEntry = useCallback((entry: Omit<WasteEntry, "id" | "disposed">) => {
    setEntries((prev) => {
      const next = [...prev, { ...entry, id: crypto.randomUUID(), disposed: false }];
      saveEntries(next);
      return next;
    });
  }, []);

  const disposeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.map((e) =>
        e.id === id ? { ...e, disposed: true, disposedDate: new Date().toISOString().split("T")[0] } : e
      );
      saveEntries(next);
      return next;
    });
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveEntries(next);
      return next;
    });
  }, []);

  return { entries, addEntry, disposeEntry, deleteEntry };
}
