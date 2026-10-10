import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check if recovery session is already established or delivered via URL hash
    supabase.auth.getSession().then(({ data }: any) => {
      if (data?.session) {
        setReady(true);
      }
    });

    // Also listen for PASSWORD_RECOVERY or SIGNED_IN event from magic link
    const { data: sub } = supabase.auth.onAuthStateChange((evt: string, session: any) => {
      if (evt === "PASSWORD_RECOVERY" || (evt === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 12) return toast.error("Password must be at least 12 characters");
    if (!/[A-Z]/.test(password)) return toast.error("Include at least one uppercase letter");
    if (!/[a-z]/.test(password)) return toast.error("Include at least one lowercase letter");
    if (!/[0-9]/.test(password)) return toast.error("Include at least one number");
    if (password !== confirm) return toast.error("Passwords do not match");
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated successfully");
    navigate("/app");
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-gradient-to-b from-background via-background to-secondary/30">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25 mb-1">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reset Password</h1>
          <p className="text-xs text-muted-foreground">
            Configure a new secure password for your Waste<span className="text-primary font-bold">Buddy</span> account
          </p>
        </div>

        <Card className="rounded-2xl border border-border/90 shadow-md bg-card/95 backdrop-blur-xs">
          <CardContent className="p-6 sm:p-7 space-y-4">
            {!ready ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Invalid or expired password reset link. Please request a new recovery link from the sign-in screen.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs rounded-lg mt-2"
                  onClick={() => navigate("/auth")}
                >
                  Return to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="pw" className="text-xs font-semibold">
                    New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="pw"
                      type={showPw ? "text" : "password"}
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

                <div className="space-y-1.5">
                  <Label htmlFor="pw2" className="text-xs font-semibold">
                    Confirm New Password
                  </Label>
                  <Input
                    id="pw2"
                    type={showPw ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 text-xs rounded-lg"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm rounded-lg mt-2"
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Update & Authenticate
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
