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
    queryKey: ["sites", user?.id],
    queryKeyHash: ["sites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, location")
        .order("name");
      if (error) throw error;
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
      if (mErr) throw mErr;

      const userIds = memberships.map((m) => m.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      if (pErr) throw pErr;

      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      return memberships.map((m) => {
        const roles = (m.user_roles as { role: string }[] | null | undefined)?.map((r) => r.role as "admin" | "manager" | "member") ?? [];
        const profile = profileMap.get(m.user_id);
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
      if (error) throw error;
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
      if (error) throw error;
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
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Site created");
    },
    onError: (e: Error) => toast.error(e.message),
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
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["requests", vars.siteId] });
      toast.success("Request approved");
    },
    onError: (e: Error) => toast.error(e.message),
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
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["requests", vars.siteId] });
      toast.success("Request rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
