import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Leaf, ArrowLeft, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Min 6 characters"),
});

type Mode = "login" | "reset" | "bootstrap";

export default function Auth() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<Mode>("login");

  if (!loading && session) return <Navigate to="/app" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate("/app");
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!z.string().email().safeParse(email).success) return toast.error("Enter a valid email");
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset email sent");
    setMode("login");
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setSubmitting(true);
    // Sign up
    const { error: suErr } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    if (suErr) {
      setSubmitting(false);
      return toast.error(suErr.message);
    }
    // Sign in immediately (auto-confirm is on)
    const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
    if (siErr) {
      setSubmitting(false);
      return toast.error("Account created — please sign in.");
    }
    // Try to claim Main Site as admin
    const { error: bErr, data } = await supabase.functions.invoke("bootstrap-admin", {});
    setSubmitting(false);
    if (bErr || (data as any)?.error) {
      toast.error((data as any)?.error ?? bErr?.message ?? "Bootstrap failed — site already initialized.");
    } else {
      toast.success("You're the site admin. Welcome!");
    }
    navigate("/app");
  };

  const titles: Record<Mode, string> = {
    login: "Sign in",
    reset: "Reset Password",
    bootstrap: "Claim First Admin",
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-secondary/40">
      <header className="px-4 py-4 max-w-md mx-auto w-full">
        <Link to="/" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 pb-10">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="p-6 space-y-5">
            <div className="text-center space-y-1">
              <div className="bg-primary text-primary-foreground rounded-xl p-3 w-fit mx-auto mb-2">
                {mode === "bootstrap" ? <Shield className="h-6 w-6" /> : <Leaf className="h-6 w-6" />}
              </div>
              <h1 className="text-xl font-bold">{titles[mode]}</h1>
              <p className="text-xs text-muted-foreground">
                {mode === "bootstrap"
                  ? "First-time setup: become the admin of Main Site"
                  : mode === "reset"
                    ? "We'll email you a reset link"
                    : "Hazardous Waste Tracker"}
              </p>
            </div>

            <form
              onSubmit={
                mode === "reset" ? handleReset : mode === "bootstrap" ? handleBootstrap : handleLogin
              }
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {mode !== "reset" && (
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "bootstrap" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {mode === "reset" ? "Send reset email" : mode === "bootstrap" ? "Create admin account" : "Sign in"}
              </Button>
            </form>

            <div className="flex flex-col items-center gap-2 text-xs">
              {mode === "login" && (
                <>
                  <button
                    type="button"
                    onClick={() => setMode("reset")}
                    className="text-muted-foreground hover:text-foreground underline"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("bootstrap")}
                    className="text-muted-foreground hover:text-foreground underline"
                  >
                    First-time setup (claim admin)
                  </button>
                </>
              )}
              {mode !== "login" && (
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-muted-foreground hover:text-foreground underline"
                >
                  Back to sign in
                </button>
              )}
            </div>

            <p className="text-[11px] text-center text-muted-foreground border-t pt-3">
              Access is invite-only. Contact your site admin if you need an account.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
