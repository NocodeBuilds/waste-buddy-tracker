import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Include at least one uppercase letter")
    .regex(/[a-z]/, "Include at least one lowercase letter")
    .regex(/[0-9]/, "Include at least one number"),
});

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(100),
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Include at least one uppercase letter")
    .regex(/[a-z]/, "Include at least one lowercase letter")
    .regex(/[0-9]/, "Include at least one number")
    .max(72, "Password must be at most 72 characters"),
});

type Mode = "login" | "reset";

export default function Auth() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [mode, setMode] = useState<Mode>("login");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/icons/icon-192x192.png"
            alt="WasteBuddy"
            className="h-12 w-12 rounded-2xl shadow-sm object-cover border border-primary/20 animate-pulse"
          />
          <p className="text-xs font-medium text-muted-foreground">
            Initializing Waste<span className="text-primary font-bold">Buddy</span>…
          </p>
        </div>
      </div>
    );
  }

  if (!loading && session) return <Navigate to="/app" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
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
    if (!z.string().email().safeParse(email).success) return toast.error("Please enter a valid email address");
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset instructions sent to your email");
    setMode("login");
  };

  const titles: Record<Mode, string> = {
    login: "Sign In",
    reset: "Reset Password",
  };

  const onSubmit = mode === "reset" ? handleReset : handleLogin;

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-gradient-to-b from-background via-background to-secondary/30">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <img
            src="/icons/icon-192x192.png"
            alt="WasteBuddy"
            className="h-14 w-14 mx-auto rounded-2xl shadow-md object-cover border border-primary/20 mb-1"
          />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Waste<span className="text-primary font-bold">Buddy</span>
          </h1>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Hazardous & Non-Hazardous Waste Management Portal
          </p>
        </div>

        {/* Auth card */}
        <Card className="rounded-2xl border border-border/90 shadow-md bg-card/95 backdrop-blur-xs">
          <CardContent className="p-6 sm:p-7 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">{titles[mode]}</h2>
              <p className="text-xs text-muted-foreground">
                {mode === "reset"
                  ? "Enter your email to receive recovery instructions"
                  : "Sign in with your authorized site credentials"}
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-3.5 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="technician@windpower.com"
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
                    <button
                      type="button"
                      onClick={() => setMode("reset")}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
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
                disabled={submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {mode === "reset" ? "Send Password Reset Link" : "Sign In"}
              </Button>
            </form>

            {/* Mode switch & Enterprise Notice */}
            <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground space-y-2">
              {mode === "reset" ? (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="text-primary font-semibold hover:underline"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-center border border-border/40 space-y-0.5">
                  <p className="font-semibold text-foreground">Restricted Enterprise Access</p>
                  <p className="text-muted-foreground text-[10.5px]">
                    User accounts are provisioned directly by facility administrators. Contact your EHS site manager for credentials.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
