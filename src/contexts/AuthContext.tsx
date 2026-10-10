import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Derive admin status from session metadata.
  // bootstrap-admin sets the role flag in app_metadata (server-side); fall back to
  // user_metadata for any client-side role assignments.
  const appRoles: string[] = (session as any)?.user?.app_metadata?.roles ?? [];
  const userRoles: string[] = (session as any)?.user?.user_metadata?.roles ?? [];
  const isAdmin = appRoles.includes("admin") || userRoles.includes("admin");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt: any, s: Session | null) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }: any) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Purge Service Worker caches on logout to prevent credential leakage
    if ("caches" in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch { /* non-critical */ }
    }
    // Purge application localStorage (offline queue, cached entries/batches)
    if (typeof window !== "undefined") {
      try {
        const APP_PREFIX = "wastebuddy_";
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(APP_PREFIX)) toRemove.push(key);
        }
        toRemove.forEach((k) => localStorage.removeItem(k));
      } catch { /* non-critical */ }
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
