import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { toast } from "sonner";
import type { Site, Member, AccessRequest, AuditLogRow } from "@/types";

// ── Sites ──────────────────────────────────────────────────────────

export function useSites() {
  const { user } = useAuth();
  return useQuery({
    // C2 fix: aligned query key with mutations' invalidation
    queryKey: ["sites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, location")
        .order("name");
      if (error) throw new Error(error.message);
      return data as Site[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}

// ── Members ────────────────────────────────────────────────────────

export function useMembers(siteId: string) {
  return useQuery({
    queryKey: ["members", siteId],
    queryFn: async () => {
      const { data: memberships, error: mErr } = await supabase
        .from("user_sites")
        .select("user_id, user_roles (role)")
        .eq("site_id", siteId);
      if (mErr) throw new Error(mErr.message);

      const userIds = (memberships as any[]).map((m: any) => m.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      if (pErr) throw new Error(pErr.message);

      const profileMap = new Map((profiles as any[]).map((p: any) => [p.id, p]));

      return (memberships as any[]).map((m: any) => {
        const roles = (m.user_roles as { role: string }[] | null | undefined)?.map((r) => r.role as "admin" | "manager" | "member") ?? [];
        const profile: any = profileMap.get(m.user_id);
        return {
          user_id: m.user_id,
          email: profile?.email ?? null,
          full_name: profile?.full_name ?? null,
          roles,
        } as Member;
      });
    },
    enabled: !!siteId,
    staleTime: 30_000,
  });
}

// ── Access requests ────────────────────────────────────────────────

export function useRequests(siteId: string) {
  return useQuery({
    queryKey: ["requests", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_access_requests")
        .select("*")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as AccessRequest[];
    },
    enabled: !!siteId,
    staleTime: 30_000,
  });
}

// ── Audit log ──────────────────────────────────────────────────────

export function useAuditLog(siteId: string) {
  return useQuery({
    queryKey: ["audit_log", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return data as AuditLogRow[];
    },
    enabled: !!siteId,
    staleTime: 30_000,
  });
}

// ── Mutations ──────────────────────────────────────────────────────

export function useCreateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("sites")
        .insert({ name })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Site created");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      toast.error(msg || "Site creation failed");
    },
  });
}

export function useApproveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, siteId }: { requestId: string; siteId: string }) => {
      const { data, error } = await supabase
        .from("site_access_requests")
        .update({ status: "approved" })
        .eq("id", requestId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["requests", vars.siteId] });
      toast.success("Request approved");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      toast.error(msg || "Approval failed");
    },
  });
}

export function useRejectRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, siteId }: { requestId: string; siteId: string }) => {
      const { data, error } = await supabase
        .from("site_access_requests")
        .update({ status: "rejected" })
        .eq("id", requestId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["requests", vars.siteId] });
      toast.success("Request rejected");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      toast.error(msg || "Rejection failed");
    },
  });
}
