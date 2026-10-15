import { useQuery } from "@tanstack/react-query";
import { loadTeam, DisplayRequest } from "@/lib/adminData";
import { errorMessage } from "@/lib/validation";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  UserPlus,
  UserMinus,
  Plus,
  CheckCircle,
  X,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Shield,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Role, Member } from "@/types";
import { formatDateDDMMYYYY } from "@/lib/wasteTypes";
import EmptyState from "@/components/ui/empty-state";

interface Props {
  siteId: string;
  siteName: string;
  callerId: string;
}

function generateRandomPassword() {
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowers = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const specials = "!@#$%^&*";
  const all = uppers + lowers + digits + specials;

  const getRand = (charset: string) => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return charset[arr[0] % charset.length];
  };

  // Guarantee at least 1 of each required character type
  const passChars = [
    getRand(uppers),
    getRand(lowers),
    getRand(digits),
    getRand(specials),
  ];

  // Fill remaining 10 characters to reach 14 characters total
  for (let i = 0; i < 10; i++) {
    passChars.push(getRand(all));
  }

  // Shuffle securely
  for (let i = passChars.length - 1; i > 0; i--) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const j = arr[0] % (i + 1);
    [passChars[i], passChars[j]] = [passChars[j], passChars[i]];
  }

  return passChars.join("");
}

export default function UserManagementView({ siteId, siteName, callerId }: Props) {
  const team = useQuery({ queryKey: ["members", callerId, siteId], queryFn: () => loadTeam(siteId), enabled: siteId !== "ALL_SITES" });
  const members = team.data?.members ?? [];
  const requests = team.data?.requests ?? [];
  const loading = team.isLoading;
  const load = async () => { await team.refetch(); };
  const [busy, setBusy] = useState(false);
  const [approveRoles, setApproveRoles] = useState<Record<string, Role>>({});

  // Account creation form state
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [showPw, setShowPw] = useState(false);

  // Success credentials dialog state
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password?: string;
    name: string;
    role: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const setReqRole = (reqId: string, r: Role) => setApproveRoles((prev) => ({ ...prev, [reqId]: r }));

  const call = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ok?: boolean; error?: string}>("admin-manage-user", { body });
      if (error && "context" in error && error.context instanceof Response) {
        const response = await error.context.clone().json().catch(() => null) as {error?: string} | null;
        if (response?.error) throw new Error(response.error);
      }
      if (error || data?.error) throw new Error(data?.error ?? error?.message ?? "Operation failed");
      toast.success(success); await load(); return true;
    } catch (error) { toast.error(errorMessage(error)); return false; }
    finally { setBusy(false); }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 12) {
      toast.error("Password must be at least 12 characters long");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      toast.error("Password must include at least one uppercase letter");
      return;
    }
    if (!/[a-z]/.test(password)) {
      toast.error("Password must include at least one lowercase letter");
      return;
    }
    if (!/[0-9]/.test(password)) {
      toast.error("Password must include at least one number");
      return;
    }

    const ok = await call(
      {
        action: "create_user",
        email,
        password,
        full_name: fullName.trim() || email,
        site_id: siteId,
        role,
      },
      `Account created for ${email}`
    );

    if (ok) {
      setCreatedCredentials({
        email,
        password,
        name: fullName || email,
        role,
      });
      setEmail("");
      setPassword("");
      setFullName("");
      setShowCreateUser(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = [
      `WasteBuddy Portal Credentials`,
      `Site: ${siteName}`,
      `Role: ${createdCredentials.role}`,
      `Email: ${createdCredentials.email}`,
      `Password: ${createdCredentials.password}`,
      `Portal: ${window.location.origin}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Credentials copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const approveReq = async (r: DisplayRequest) => {
    const chosenRole = approveRoles[r.id] ?? "member";
    await call({ action: "approve_request", request_id: r.id, site_id: siteId, role: chosenRole }, "Access approved");
    setApproveRoles((prev) => {
      const next = { ...prev };
      delete next[r.id];
      return next;
    });
  };

  const rejectReq = async (r: DisplayRequest) => {
    await call({ action: "reject_request", request_id: r.id, site_id: siteId }, "Access rejected");
  };

  return (
    <div className="space-y-3">
      {team.error && <p role="alert" className="text-destructive">{team.error.message}</p>}
      {/* Pending site access requests banner */}
      {requests.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/[0.03] shadow-xs">
          <CardContent className="p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" /> Pending Access Requests ({requests.length})
              </h3>
            </div>
            <div className="divide-y divide-border/60">
              {requests.map((r) => (
                <div key={r.id} className="py-2 space-y-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {r.profile?.full_name ?? r.profile?.email ?? r.user_id}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {r.profile?.email} · {formatDateDDMMYYYY(r.created_at)}
                    </p>
                    {r.note && (
                      <p className="text-[11px] italic text-muted-foreground mt-0.5 bg-muted/40 p-1.5 rounded">
                        "{r.note}"
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <Select
                      value={approveRoles[r.id] ?? "member"}
                      onValueChange={(v) => setReqRole(r.id, v as Role)}
                    >
                      <SelectTrigger className="h-7 text-xs w-24 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-7 text-xs flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
                      disabled={busy}
                      onClick={() => approveReq(r)}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-destructive hover:bg-destructive/10 rounded-lg"
                      disabled={busy}
                      onClick={() => rejectReq(r)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members Directory */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-3.5 sm:p-4 space-y-2.5 sm:space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Site Operators & Credentials ({members.length})
              </h3>
            </div>
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1 px-2 sm:px-2.5 rounded-lg shadow-2xs"
              onClick={() => {
                setShowCreateUser(!showCreateUser);
                if (!password) setPassword(generateRandomPassword());
              }}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="sm:hidden">{showCreateUser ? "Cancel" : "Add User"}</span>
              <span className="hidden sm:inline">{showCreateUser ? "Cancel" : "Add User Account"}</span>
            </Button>
          </div>

          {/* Direct Credential Provisioning Drawer */}
          {showCreateUser && (
            <form onSubmit={handleCreateAccount} className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-primary" /> Create User & Provision Credentials
                </h4>
                <span className="text-[10px] text-muted-foreground font-medium">Instant Active Login</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Full Name</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Kumar"
                    className="h-8 text-xs rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Email Address (Login ID)</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="colleague@domain.com"
                    className="h-8 text-xs rounded-lg"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-semibold">Initial Password</Label>
                    <button
                      type="button"
                      onClick={() => setPassword(generateRandomPassword())}
                      className="text-[10px] text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <Sparkles className="h-2.5 w-2.5" /> Generate
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 12 characters"
                      className="h-8 text-xs rounded-lg pr-8 font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Assigned Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                    <SelectTrigger className="h-8 text-xs rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member (Log & View)</SelectItem>
                      <SelectItem value="manager">Manager (Approve Disposals)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  className="flex-1 h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
                  disabled={busy || !email || !password}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <KeyRound className="h-3.5 w-3.5 mr-1.5" />}
                  Create Account & Hand Over
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setShowCreateUser(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Members High-Density Rows */}
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Team Members"
              description="No operator accounts are assigned to this facility yet."
              compact
            />
          ) : (
            <div className="divide-y divide-border/60 text-xs rounded-lg border border-border/60 overflow-hidden bg-background">
              {members.map((m) => (
                <div key={m.user_id} className="p-2.5 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 border border-border/60">
                      {m.email?.charAt(0).toUpperCase() ?? "U"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {m.email ?? m.full_name ?? m.user_id}
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {m.roles.join(", ") || "no role"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Admin status is non-transferable: read-only badge for the Admin user */}
                    {m.roles.includes("admin") && (
                      <span className="h-6 px-2 text-[10px] font-bold uppercase tracking-wider rounded-md bg-primary text-primary-foreground flex items-center justify-center shadow-2xs">
                        Admin
                      </span>
                    )}

                    {/* Operational roles available for delegation */}
                    {(["manager", "member"] as Role[]).map((r) => {
                      const has = m.roles.includes(r);
                      return (
                        <Button
                          key={r}
                          size="sm"
                          variant={has ? "default" : "outline"}
                          className={`h-6 px-2 text-[10px] capitalize rounded-md ${
                            has ? "bg-secondary text-secondary-foreground font-semibold border-border" : ""
                          }`}
                          disabled={busy || m.user_id === callerId}
                          onClick={() =>
                            call(
                              has
                                ? { action: "revoke_role", user_id: m.user_id, site_id: siteId, role: r }
                                : { action: "assign", user_id: m.user_id, site_id: siteId, role: r },
                              has ? `Revoked ${r}` : `Granted ${r}`
                            )
                          }
                        >
                          {r}
                        </Button>
                      );
                    })}

                    {m.user_id !== callerId && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive hover:bg-destructive/10 rounded-md shrink-0 ml-1"
                        disabled={busy}
                        onClick={() =>
                          call({ action: "remove_from_site", user_id: m.user_id, site_id: siteId }, "Member removed")
                        }
                        aria-label="Remove member"
                      >
                        <UserMinus className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credentials Created Dialog for Admin to Copy/Handover */}
      <Dialog open={!!createdCredentials} onOpenChange={(o) => !o && setCreatedCredentials(null)}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" /> User Credentials Ready
            </DialogTitle>
            <DialogDescription className="text-xs">
              The user account has been provisioned and is active immediately. You can hand over these credentials to the user.
            </DialogDescription>
          </DialogHeader>

          {createdCredentials && (
            <div className="space-y-2.5 p-3.5 rounded-lg border border-border/80 bg-muted/30 text-xs font-mono">
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground font-sans">Facility:</span>
                <span className="font-semibold text-foreground">{siteName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground font-sans">Email:</span>
                <span className="font-semibold text-foreground">{createdCredentials.email}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground font-sans">Password:</span>
                <span className="font-semibold text-foreground text-emerald-700 dark:text-emerald-400 bg-background px-1.5 py-0.5 rounded border border-border/60">
                  {createdCredentials.password}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground font-sans">Role:</span>
                <span className="capitalize font-semibold text-foreground">{createdCredentials.role}</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs gap-1.5 flex-1"
              onClick={handleCopyCredentials}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied to Clipboard!" : "Copy Credentials"}
            </Button>
            <Button
              size="sm"
              className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              onClick={() => setCreatedCredentials(null)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
