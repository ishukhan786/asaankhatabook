import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Lock, Mail, ShieldCheck, Sparkles, User, XCircle, Loader } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

// Validation schema for sign‑in / sign‑up form
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
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 px-4 py-8 text-foreground">
      {/* Decorative animated blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-primary/15 blur-3xl"
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-0 top-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
      </div>

      <motion.div
        className="relative w-full max-w-md rounded-2xl bg-card/90 backdrop-blur-xl border border-border/30 shadow-xl p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-6 text-center">
          <h2 className="font-display text-3xl font-bold text-primary">{isSignIn ? "Welcome back" : "Create your account"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignIn ? "Sign in to continue to your workspace" : "Get started in under a minute"}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <AnimatePresence>
            {authError && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <Alert variant="destructive" className="rounded-xl px-4 py-3 mb-4">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{authError}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Full name for signup */}
          <AnimatePresence mode="popLayout">
            {mode === "signup" && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-1.5">
                <Label htmlFor="fullName" className="text-sm font-semibold">
                  Full name <span className="text-destructive">*</span>
                </Label>
                <div className="relative group">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input id="fullName" placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} className="pl-10" aria-label="Full name" required />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-semibold">
              Email address <span className="text-destructive">*</span>
            </Label>
            <div className="relative group">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input id="email" placeholder="you@example.com" type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" aria-label="Email address" required />
            </div>
          </div>
          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-semibold">
              Password <span className="text-destructive">*</span>
            </Label>
            <div className="relative group">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input id="password" placeholder="••••••••" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="pl-10" aria-label="Password" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-primary transition-colors" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {/* Remember me & forgot */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" aria-label="Remember me" />
              <span className="text-muted-foreground">Remember me</span>
            </label>
            <Link to="/forgot-password" className="font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" disabled={busy} className="w-full flex items-center justify-center">
            {busy && <Loader className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {isSignIn ? "Sign In" : "Create Account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {isSignIn ? "Don’t have an account?" : "Already have an account?"}
            <button type="button" onClick={() => setMode(isSignIn ? "signup" : "signin")} className="ml-1 font-medium text-primary hover:underline">
              {isSignIn ? "Sign up" : "Sign in"}
            </button>
          </p>
        </form>
      </motion.div>
    </div>
  );
                  <Button type="submit" disabled={busy} className="w-full flex items-center justify-center">
