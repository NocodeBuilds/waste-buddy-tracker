import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Loader2, Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";

// Whitelist of allowed origins for auth redirects (prevents open redirect)
const ALLOWED_REDIRECT_ORIGINS = [window.location.origin];

const getSafeRedirect = (path: string) => {
  const origin = window.location.origin;
  if (ALLOWED_REDIRECT_ORIGINS.includes(origin)) {
    return `${origin}${path}`;
  }
  return `${ALLOWED_REDIRECT_ORIGINS[0]}${path}`;
};

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(12, "Password must be at least 12 characters")
    .max(72, "Password must be at most 72 characters")
    .regex(/[A-Z]/, "Include at least one uppercase letter")
    .regex(/[a-z]/, "Include at least one lowercase letter")
    .regex(/[0-9]/, "Include at least one number"),
});

type Mode = "login" | "bootstrap" | "reset";

export default function AdminAuth() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);

  // Lazily check admin_exists only when bootstrap mode is requested
  const checkAdminExists = async () => {
    if (adminExists !== null) return;
    setCheckingAdmin(true);
    const { data } = await supabase.rpc("admin_exists");
    setAdminExists(!!data);
    setCheckingAdmin(false);
  };

  // Redirect authenticated users to the app
  if (!authLoading && session) {
    return <Navigate to="/app" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back, Administrator");
    navigate("/app");
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setSubmitting(true);

    // Gate: only allow bootstrap if truly no admin exists
    if (adminExists) {
      setSubmitting(false);
      return toast.error("An administrator already exists. Contact them for access.");
    }

    const { error: suErr } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    if (suErr && !suErr.message.toLowerCase().includes("already")) {
      setSubmitting(false);
      return toast.error(suErr.message);
    }
    const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
    if (siErr) {
      setSubmitting(false);
      return toast.error(
        suErr
          ? "This email already has an account but the password doesn't match."
          : siErr.message
      );
    }
    const { error: bErr, data } = await supabase.functions.invoke("bootstrap-admin", {});
    setSubmitting(false);
    if (bErr || (data as any)?.error) {
      return toast.error((data as any)?.error ?? bErr?.message ?? "Bootstrap failed — admin already exists.");
    }
    toast.success("Primary Administrator configured successfully!");
    navigate("/app");
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!z.string().email().safeParse(email).success) return toast.error("Please enter a valid email address");
    setSubmitting(true);
    setResetCooldown(60);
    const timer = setInterval(() => setResetCooldown(c => c - 1), 1000);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getSafeRedirect("/reset-password"),
    });
    setSubmitting(false);
    clearInterval(timer);
    if (error) { toast.error(error.message); return; }
    toast.success("Password reset instructions sent to your email");
    setMode("login");
  };

  const onSubmit =
    mode === "login" ? handleLogin : mode === "bootstrap" ? handleBootstrap : handleReset;

  const title =
    mode === "login" ? "Admin Sign In" : mode === "bootstrap" ? "Claim Primary Admin" : "Reset Password";

  const handleRequestBootstrap = async () => {
    await checkAdminExists();
    setMode("bootstrap");
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-gradient-to-b from-background via-background to-secondary/30">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="relative inline-flex items-center justify-center mb-1">
            <img
              src="/icons/icon-192x192.png"
              alt="WasteBuddy"
              className="h-14 w-14 rounded-2xl shadow-md object-cover border border-primary/20"
            />
            <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
              <Shield className="h-3.5 w-3.5" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Waste<span className="text-primary font-bold">Buddy</span> Admin
          </h1>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 font-medium">
            <Lock className="h-3.5 w-3.5 text-primary" />
            Restricted Facility Governance Console
          </p>
        </div>

        <Card className="rounded-2xl border border-border/90 shadow-md bg-card/95 backdrop-blur-xs">
          <CardContent className="p-6 sm:p-7 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">{title}</h2>
              <p className="text-xs text-muted-foreground">
                {mode === "login"
                  ? "Restricted area — credentials verified against site admin records"
                  : mode === "bootstrap"
                  ? "Initial setup: configure root administrative privileges"
                  : "Enter your admin email to receive recovery instructions"}
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-3.5 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">
                  Administrator Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@windpower.com"
                  className="h-10 text-xs rounded-lg"
                  required
                />
              </div>

              {mode !== "reset" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-semibold">
                      Password
                    </Label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => setMode("reset")}
                        className="text-[11px] text-primary hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPw ? "text" : "password"}
                      autoComplete={mode === "bootstrap" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="h-10 text-xs rounded-lg pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-10 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm rounded-lg mt-2"
                disabled={submitting || (mode === "bootstrap" && checkingAdmin) || (mode === "reset" && resetCooldown > 0)}
              >
                {(submitting || checkingAdmin) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {mode === "bootstrap"
                  ? "Claim Admin Account"
                  : mode === "reset"
                  ? `Send Password Reset Link${resetCooldown > 0 ? ` (${resetCooldown}s)` : ""}`
                  : "Sign In as Admin"}
              </Button>
            </form>

            <div className="pt-2 border-t border-border/60 text-center text-xs text-muted-foreground space-y-1.5">
              {mode === "login" && (
                <p>
                  No admin configured yet?{" "}
                  <button
                    type="button"
                    onClick={handleRequestBootstrap}
                    className="text-primary font-semibold hover:underline"
                  >
                    Claim primary admin
                  </button>
                </p>
              )}
              {mode !== "login" && (
                <p>
                  {mode === "bootstrap" ? "Remember your password?" : "Remember your password?"}{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("login"); setAdminExists(null); }}
                    className="text-primary font-semibold hover:underline"
                  >
                    Back to sign in
                  </button>
                </p>
              )}
              <p>
                <button
                  type="button"
                  onClick={() => navigate("/auth")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Return to regular operator portal
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
