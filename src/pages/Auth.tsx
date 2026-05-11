import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Lock,
  Mail,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
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

const overviewItems = [
  { label: "Receivable", value: "318k", icon: ReceiptText },
  { label: "Branches", value: "06", icon: Building2 },
  { label: "Cleared", value: "94%", icon: CheckCircle2 },
];

export default function Auth() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
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
    } catch (err: any) {
      const message = err.message ?? "Authentication failed";
      setAuthError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(135deg,hsl(184_80%_13%)_0%,hsl(195_58%_18%)_42%,hsl(38_95%_50%)_140%)] px-4 py-4 text-foreground sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,hsl(180_40%_98%/0.16)_1px,transparent_0)] bg-[length:26px_26px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,hsl(0_0%_100%/0.07)_1px,transparent_1px),linear-gradient(0deg,hsl(0_0%_100%/0.05)_1px,transparent_1px)] bg-[size:120px_120px]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-[640px] flex-col justify-between overflow-hidden rounded-md border border-white/12 bg-white/[0.08] p-8 text-primary-foreground shadow-lift backdrop-blur-xl lg:flex">
          <Link to="/" className="flex w-fit items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-white/15 bg-accent text-accent-foreground shadow-amber">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-normal">AsaanKhata</h1>
              <p className="text-sm text-primary-foreground/68">Multi-branch accounting</p>
            </div>
          </Link>

          <div className="max-w-xl space-y-7">
            <div className="inline-flex items-center gap-2 rounded-md border border-white/12 bg-white/10 px-3 py-2 text-sm text-primary-foreground/84">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Secure ledger access for growing businesses
            </div>
            <div className="space-y-4">
              <h2 className="max-w-lg font-display text-5xl font-bold leading-[1.05] tracking-normal">
                Your accounts, branches, and cashflow in one calm workspace.
              </h2>
              <p className="max-w-md text-base leading-7 text-primary-foreground/72">
                Sign in to manage customers, transactions, reports, expenses, and branch ledgers with a faster daily workflow.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-white/12 bg-white/[0.09] p-5 shadow-lift backdrop-blur">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-foreground/62">Today's overview</p>
                <p className="font-display text-2xl font-semibold tracking-normal">PKR 842,500</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {overviewItems.map((item) => (
                <div key={item.label} className="rounded-md border border-white/10 bg-white/[0.08] p-3">
                  <item.icon className="mb-3 h-4 w-4 text-accent" />
                  <p className="text-xs text-primary-foreground/58">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-md border border-white/18 bg-white/95 p-4 shadow-lift backdrop-blur-xl sm:p-6">
          <Link to="/" className="mb-4 flex items-center gap-3 sm:mb-5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-md gradient-accent shadow-amber sm:h-11 sm:w-11">
              <Wallet className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-normal text-foreground sm:text-xl">AsaanKhata</h1>
              <p className="text-xs text-muted-foreground">Multi-branch accounting</p>
            </div>
          </Link>

          <div className="mb-4 sm:mb-5">
            <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold text-primary sm:mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              {isSignIn ? "Welcome back" : "Start your workspace"}
            </div>
            <h2 className="font-display text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
              {isSignIn ? "Sign in to AsaanKhata" : "Create your account"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground sm:mt-1.5">
              {isSignIn ? "Access your branch ledger and daily cashflow." : "Set up your secure business ledger in minutes."}
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 rounded-md bg-muted p-1 sm:mb-5">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`h-9 rounded-md text-sm font-semibold transition sm:h-10 ${
                isSignIn ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`h-9 rounded-md text-sm font-semibold transition sm:h-10 ${
                !isSignIn ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3 sm:space-y-3.5">
            {authError && (
              <Alert variant="destructive" className="rounded-md px-3 py-3">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}

            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-semibold">
                  Full name
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="h-10 rounded-md bg-background pl-10 sm:h-11"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">
                Email address
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-10 rounded-md bg-background pl-10 sm:h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">
                Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-10 rounded-md bg-background pl-10 sm:h-11"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="h-10 w-full rounded-md gradient-primary text-primary-foreground shadow-soft hover:opacity-95 sm:h-11"
            >
              {busy ? "Please wait..." : isSignIn ? "Sign in" : "Create account"}
              {!busy && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground sm:mt-5">
            {isSignIn ? "Need a new workspace?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(isSignIn ? "signup" : "signin")}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {isSignIn ? "Create account" : "Sign in"}
            </button>
          </p>
        </section>
      </div>
    </div>
  );
}
