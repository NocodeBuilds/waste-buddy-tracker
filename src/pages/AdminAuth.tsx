import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Min 6 characters"),
});

type Mode = "login" | "bootstrap";

export default function AdminAuth() {
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
    toast.success("Welcome, admin");
    navigate("/app");
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setSubmitting(true);
    const { error: suErr } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    const alreadyExists = suErr && suErr.message.toLowerCase().includes("already");
    if (suErr && !alreadyExists) {
      setSubmitting(false);
      return toast.error(suErr.message);
    }
    const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
    if (siErr) {
      setSubmitting(false);
      return toast.error(
        alreadyExists
          ? "This email already has an account but the password doesn't match. Use the correct password or a new email."
          : siErr.message
      );
    }
    const { error: bErr, data } = await supabase.functions.invoke("bootstrap-admin", {});
    setSubmitting(false);
    if (bErr || (data as any)?.error) {
      return toast.error((data as any)?.error ?? bErr?.message ?? "Bootstrap failed — admin already exists.");
    }
    toast.success("You're the site admin. Welcome!");
    navigate("/app");
  };


  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-b from-background to-secondary/40">
      <Card className="w-full max-w-md shadow-lg border-primary/30">
        <CardContent className="p-6 space-y-5">
          <div className="text-center space-y-1">
            <div className="bg-primary text-primary-foreground rounded-xl p-3 w-fit mx-auto mb-2">
              <Shield className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">
              {mode === "login" ? "Admin Sign In" : "Claim First Admin"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {mode === "login"
                ? "Restricted area — administrators only"
                : "First-time setup: become the admin of Main Site"}
            </p>
          </div>

          <form onSubmit={mode === "login" ? handleLogin : handleBootstrap} className="space-y-3">
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
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {mode === "login" ? "Sign in as admin" : "Create admin account"}
            </Button>
          </form>

          <div className="flex flex-col items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "bootstrap" : "login")}
              className="text-muted-foreground hover:text-foreground underline"
            >
              {mode === "login" ? "First-time setup (claim admin)" : "Back to admin sign in"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="text-muted-foreground hover:text-foreground underline"
            >
              Not an admin? User sign in
            </button>
          </div>

          <p className="text-[11px] text-center text-muted-foreground border-t pt-3">
            This page is for site administrators only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
