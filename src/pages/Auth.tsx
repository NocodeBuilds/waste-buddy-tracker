import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Leaf, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Min 6 characters"),
});

export default function Auth() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showReset, setShowReset] = useState(false);

  if (!loading && session) return <Navigate to="/app" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate("/app");
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!z.string().email().safeParse(email).success) {
      toast.error("Enter a valid email");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password reset email sent");
    setShowReset(false);
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
                <Leaf className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold">
                {showReset ? "Reset Password" : "Sign in"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {showReset
                  ? "We'll email you a reset link"
                  : "Hazardous Waste Tracker"}
              </p>
            </div>

            <form onSubmit={showReset ? handleReset : handleLogin} className="space-y-3">
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
              {!showReset && (
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {showReset ? "Send reset email" : "Sign in"}
              </Button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowReset((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                {showReset ? "Back to sign in" : "Forgot password?"}
              </button>
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
