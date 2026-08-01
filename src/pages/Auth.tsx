import { useState, useEffect } from "react";
import { useSignIn, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, User, Lock, Loader2, ArrowRight, ShieldCheck, Zap, Globe2, CheckCircle2 } from "lucide-react";
import { AsaanKhataLogo } from "@/components/Logo";

export default function Auth() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signIn, setActive } = useSignIn();
  const { userId } = useClerkAuth();
  const navigate = useNavigate();

  // If user is already authenticated, redirect straight to dashboard
  useEffect(() => {
    if (userId) {
      navigate("/");
    }
  }, [userId, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) {
      alert("Authentication system is initializing. Please wait a moment or refresh.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: username,
        password,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        navigate("/");
      } else {
        setError("Authentication failed. Please check credentials.");
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ code?: string; message?: string }> };
      const errCode = clerkErr?.errors?.[0]?.code;
      if (errCode === "session_exists") {
        navigate("/");
      } else {
        const msg = clerkErr?.errors?.[0]?.message || "Invalid username or password.";
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground overflow-hidden selection:bg-emerald-500/20 selection:text-emerald-500">

      {/* Background Decorative Ambient Mesh & Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[45vw] h-[45vw] rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 blur-[130px]" />
        <div className="absolute top-[30%] left-[40%] w-[35vw] h-[35vw] rounded-full bg-teal-500/5 blur-[100px]" />
      </div>

      {/* Main Layout Container */}
      <div className="relative z-10 w-full min-h-screen grid grid-cols-1 lg:grid-cols-12">

        {/* LEFT COLUMN: Modern Branding & Feature Showcase (Hidden on small mobile, visible on LG) */}
        <div className="hidden lg:flex lg:col-span-7 flex-col justify-between p-12 lg:p-16 border-r border-border/40 bg-gradient-to-b from-muted/30 via-background/40 to-muted/20 backdrop-blur-md relative overflow-hidden">
          
          {/* Subtle Grid Lines Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

          {/* Top Brand Header */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-xs">
                <AsaanKhataLogo size={32} />
              </div>
              <span className="text-xl font-bold tracking-tight font-display text-foreground">AsaanKhata</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Enterprise v2.0
            </div>
          </div>

          {/* Hero Content Showcase */}
          <div className="relative z-10 my-auto py-12 max-w-xl space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15] font-display">
                Smart Accounting, <br />
                <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-indigo-600 dark:from-emerald-400 dark:via-teal-300 dark:to-indigo-400 bg-clip-text text-transparent">
                  Simplified For Growth.
                </span>
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Empower your business with multi-branch ledger management, real-time multi-currency tracking (PKR, AED, USD), and automated financial reporting.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md space-y-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-foreground">Instant Ledger Sync</h3>
                <p className="text-xs text-muted-foreground">Real-time debit & credit reconciliation across branches.</p>
              </div>

              <div className="p-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md space-y-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Globe2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-foreground">Multi-Currency</h3>
                <p className="text-xs text-muted-foreground">Full support for PKR, AED, and USD transactions.</p>
              </div>
            </div>

            {/* Trust Banner */}
            <div className="flex items-center gap-6 pt-4 text-xs text-muted-foreground font-medium border-t border-border/40">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> End-to-End Encryption</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Multi-Branch Support</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Instant PDF Statements</span>
            </div>
          </div>

          {/* Bottom Footer Quote */}
          <div className="relative z-10 text-xs text-muted-foreground flex items-center justify-between pt-6 border-t border-border/30">
            <span>© {new Date().getFullYear()} AsaanKhata Inc. All rights reserved.</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> 256-Bit SSL Secured</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Modern Glassmorphic Login Card */}
        <div className="lg:col-span-5 flex flex-col justify-center items-center p-6 sm:p-12 relative">
          
          {/* Mobile Only Header Logo */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-xs mb-3">
              <AsaanKhataLogo size={48} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">AsaanKhata</h1>
            <p className="text-muted-foreground text-xs mt-1">Smart accounting, simplified</p>
          </div>

          {/* Login Card Container */}
          <div className="w-full max-w-md space-y-6">
            
            {/* Card Form Wrapper */}
            <div className="p-8 sm:p-10 rounded-3xl border border-border/80 bg-card/80 backdrop-blur-xl shadow-2xl relative overflow-hidden">
              
              {/* Iridescent Top Accent Line */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500" />

              <div className="space-y-2 mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-foreground font-display">Welcome Back</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Enter your system credentials to access your account.
                </p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-5">
                
                {/* Username Input */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Username
                  </label>
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border/80 bg-background/50 backdrop-blur-md text-foreground placeholder:text-muted-foreground/60 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all duration-200 shadow-xs"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Password
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                    <input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full pl-10 pr-10 py-3 rounded-xl border border-border/80 bg-background/50 backdrop-blur-md text-foreground placeholder:text-muted-foreground/60 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all duration-200 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-3.5 rounded-xl text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 animate-in fade-in slide-in-from-top-1 duration-200">
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2 group"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Account</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Security Assurance Note */}
              <div className="mt-8 pt-6 border-t border-border/50 text-center">
                <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Protected by Clerk Authentication & Supabase RBAC
                </p>
              </div>
            </div>

            {/* Mobile Footer Credit */}
            <p className="text-center text-[11px] text-muted-foreground lg:hidden">
              © {new Date().getFullYear()} AsaanKhata · Enterprise Ledger Management
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

