import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Lock, Mail, ShieldCheck, Sparkles, User, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_hsl(var(--primary)/0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_hsl(var(--accent)/0.16),_transparent_28%),linear-gradient(135deg,_hsl(var(--background))_0%,_hsl(var(--secondary))_100%)] px-4 py-8 text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <motion.div 
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }} 
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-28 top-10 h-72 w-72 rounded-full bg-primary/15 blur-3xl" 
        />
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.7, 0.4] }} 
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute right-0 top-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" 
        />
        <motion.div 
          animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }} 
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" 
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <motion.div 
          initial={{ opacity: 0, y: 40 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="grid w-full overflow-hidden rounded-[2rem] border border-border/60 bg-card/80 shadow-[0_32px_100px_-24px_hsl(var(--primary)/0.35)] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]"
        >
          <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-8 text-white lg:flex">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.14),_transparent_22%),radial-gradient(circle_at_bottom_left,_rgba(250,204,21,0.14),_transparent_26%)]" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                  <Sparkles className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/55">Asaan Khata</p>
                  <p className="font-display text-lg font-semibold">Finance workspace</p>
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur-md">
                Secure access
              </div>
            </div>

            <div className="relative max-w-md space-y-6">
              <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="text-sm uppercase tracking-[0.28em] text-white/50">Built for daily operations</motion.p>
              <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="font-display text-4xl font-bold leading-tight">
                One login for accounts, transactions, and branch control.
              </motion.h1>
              <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="text-sm leading-6 text-white/72">
                Keep your ledger, teams, and reporting workflow in one place with a cleaner sign-in experience.
              </motion.p>
            </div>

            <div className="relative grid gap-3">
              {[
                "Fast access with Supabase authentication",
                "Designed for desktop and mobile",
                "Clear separation between sign in and sign up",
              ].map((item, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: 0.6 + i * 0.1 }}
                  key={item} 
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/82 backdrop-blur-md hover:bg-white/10 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{item}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center relative">
            <motion.div 
              key={mode} 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ duration: 0.4 }}
            >
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">Welcome</p>
                  <h3 className="font-display text-3xl font-bold tracking-tight mt-1">{isSignIn ? "Welcome back" : "Create your account"}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{isSignIn ? "Sign in to continue to your workspace" : "Get started in under a minute"}</p>
                </div>
                <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-secondary/60 px-3 py-2 text-xs font-medium text-muted-foreground sm:flex shadow-sm">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Protected
                </div>
              </div>

              <form onSubmit={submit} className="space-y-5">
              <AnimatePresence>
                {authError && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <Alert variant="destructive" className="rounded-xl px-4 py-3 mb-4">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>{authError}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="popLayout">
                {mode === "signup" && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-1.5"
                  >
                    <Label htmlFor="fullName" className="text-sm font-semibold">Full name</Label>
                    <div className="relative group">
                      <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className="h-12 rounded-xl pl-10 focus-visible:ring-primary/30 focus-visible:ring-4 transition-all" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
                <div className="relative group">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-12 rounded-xl pl-10 focus-visible:ring-primary/30 focus-visible:ring-4 transition-all" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
                <div className="relative group">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="h-12 rounded-xl pl-10 pr-16 focus-visible:ring-primary/30 focus-visible:ring-4 transition-all" />
                  <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 text-sm mt-2">
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30 focus:ring-4 transition-all cursor-pointer" />
                  Remember me
                </label>
                <Link to="/forgot" className="text-sm text-primary font-semibold hover:underline">Forgot password?</Link>
              </div>

              <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
                {busy ? 'Please wait...' : isSignIn ? 'Sign in to workspace' : 'Create account'}
                {!busy && <ArrowRight className="h-4 w-4" />}
              </Button>
              </form>

              <div className="mt-6 rounded-2xl border border-border/70 bg-secondary/40 px-4 py-4 text-center text-sm text-muted-foreground backdrop-blur-sm">
                {isSignIn ? "New here?" : "Already have an account?"}{' '}
                <button type="button" onClick={() => setMode(isSignIn ? 'signup' : 'signin')} className="font-semibold text-primary hover:underline transition-all">
                  {isSignIn ? 'Create an account' : 'Sign in instead'}
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
