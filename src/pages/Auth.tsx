import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Leaf, Loader2, Recycle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const ALLOWED_DOMAIN = "renew.com";

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(6, "Min 6 characters"),
});

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Name required").max(100),
  email: z.string().trim().email("Invalid email")
    .refine((e) => e.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`), {
      message: `Only @${ALLOWED_DOMAIN} emails are allowed`,
    }),
  password: z.string().min(8, "Min 8 characters").max(72),
});

type Mode = "login" | "signup" | "reset";

export default function Auth() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [mode, setMode] = useState<Mode>("login");

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ full_name: fullName, email, password });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { full_name: fullName },
      },
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      toast.success("Account created — choose a site to request access");
      navigate("/app");
    } else {
      toast.success("Check your inbox to confirm your email");
      setMode("login");
    }
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

  const titles: Record<Mode, string> = {
    login: "Sign in",
    signup: "Create account",
    reset: "Reset password",
  };

  const onSubmit =
    mode === "signup" ? handleSignup : mode === "reset" ? handleReset : handleLogin;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-secondary/40">
      <header className="px-4 pt-5 flex items-center justify-between max-w-md mx-auto w-full">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-semibold tracking-wide border border-primary/20">
          <Recycle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Renew</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Hazardous Waste</span>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="p-6 space-y-5">
            <div className="text-center space-y-1">
              <div className="bg-primary text-primary-foreground rounded-xl p-3 w-fit mx-auto mb-2">
                <Leaf className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold">{titles[mode]}</h1>
              <p className="text-xs text-muted-foreground">
                {mode === "reset"
                  ? "We'll email you a reset link"
                  : mode === "signup"
                  ? `Sign up with your @${ALLOWED_DOMAIN} email`
                  : "Hazardous Waste Tracker"}
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input
                    id="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={100}
                    required
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === "signup" ? `you@${ALLOWED_DOMAIN}` : undefined}
                  required
                />
              </div>
              {mode !== "reset" && (
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPw ? "text" : "password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={mode === "signup" ? 8 : 6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {mode === "reset" ? "Send reset email" : mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>

            <div className="flex flex-col items-center gap-2 text-xs">
              {mode === "login" && (
                <>
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="text-primary hover:underline font-medium"
                  >
                    New here? Create an account
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("reset")}
                    className="text-muted-foreground hover:text-foreground underline"
                  >
                    Forgot password?
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
              Sign-ups are restricted to <span className="font-mono">@{ALLOWED_DOMAIN}</span> emails. After signup, request access to a site — an admin will approve you.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
