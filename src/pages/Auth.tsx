import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, Lock, Mail, Sparkles, User, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(72),
  fullName: z.string().trim().min(2).max(80).optional(),
});


export default function Auth() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const isSignIn = mode === "signin";

  useEffect(() => {
    if (!loading && user) nav("/", { replace: true });
  }, [user, loading, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const parsed = schema.safeParse({ email, password, fullName: mode === "signup" ? fullName : undefined });
    if (!parsed.success) {
      const message = parsed.error.issues[0].message;
      setAuthError(message);
      toast.error(message);
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error("Sign in failed. Please check your email and password.");
        toast.success("Welcome back");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;

        if (data.session) {
          toast.success("Account created");
        } else {
          toast.success("Account created. Please check your email to confirm it, then sign in.");
          setMode("signin");
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err ?? "Authentication failed");
      setAuthError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-amber-700 px-4 py-10 text-foreground">
      <div className="absolute inset-0 overflow-hidden">
        <div className="pointer-events-none absolute -left-32 -top-24 h-96 w-96 rounded-full bg-gradient-to-r from-emerald-400/20 via-sky-400/10 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-20 h-96 w-96 rounded-full bg-gradient-to-l from-rose-400/16 via-amber-300/8 to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-md">
        <div className="mx-auto w-full rounded-2xl border border-white/12 bg-white/10 backdrop-blur-md backdrop-saturate-150 p-6 shadow-xl ring-1 ring-white/6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-2xl font-bold text-foreground">{isSignIn ? "Welcome back" : "Create your account"}</h3>
              <p className="text-sm text-muted-foreground mt-1">{isSignIn ? "Sign in to your workspace" : "Get started — it only takes a minute"}</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-foreground/60">
              <Sparkles className="h-4 w-4" /> Premium
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {authError && (
              <Alert variant="destructive" className="rounded-md px-3 py-3">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}

            {mode === "signup" && (
              <div className="space-y-1">
                <Label htmlFor="fullName" className="text-sm font-semibold">Full name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className="h-11 pl-10" />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-11 pl-10" />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="h-11 pl-10 pr-10" />
                <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground hover:text-foreground">
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border" />
                Remember me
              </label>
              <Link to="/forgot" className="text-sm text-primary font-semibold">Forgot?</Link>
            </div>

            <Button type="submit" disabled={busy} className="w-full h-11 rounded-lg gradient-primary text-primary-foreground shadow-soft flex items-center justify-center gap-2">
              {busy ? 'Please wait...' : isSignIn ? 'Sign in' : 'Create account'}
              {!busy && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {isSignIn ? "New here?" : "Already have an account?"}{' '}
            <button type="button" onClick={() => setMode(isSignIn ? 'signup' : 'signin')} className="font-semibold text-primary hover:underline">
              {isSignIn ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
