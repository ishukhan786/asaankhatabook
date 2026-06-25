import { useState, useEffect } from "react";
import { useSignIn, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, User, Lock, Loader2 } from "lucide-react";

export default function Auth() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signIn, setActive } = useSignIn();
  const { userId, signOut } = useClerkAuth();
  const navigate = useNavigate();

  // Agar user pehle se logged in hai toh usay seedha dashboard pe bhej dein
  useEffect(() => {
    if (userId) {
      navigate("/");
    }
  }, [userId, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) {
      alert("Clerk is not fully loaded yet (signIn is undefined). Please check your internet or Adblocker.");
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
        setError("Login mein masla hua. Dobara try karein.");
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ code?: string; message?: string }> };
      const errCode = clerkErr?.errors?.[0]?.code;
      if (errCode === "session_exists") {
        navigate("/"); // Agar pehle se session hai toh seedha andar le jayen
      } else {
        const msg = clerkErr?.errors?.[0]?.message || "Username ya password ghalat hai.";
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/8 via-background to-secondary/10 px-4 py-8 text-foreground">

      <motion.div
        className="relative w-full max-w-sm"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* App Name */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow shadow-lg mb-4 ring-1 ring-white/20">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-display">آسان کھاتہ بک</h1>
          <p className="text-muted-foreground text-sm mt-1">اپنے اکاؤنٹ میں لاگ ان کریں</p>
        </div>

        {/* Glass Login Card */}
        <div className="glass-hero rounded-2xl p-7 overflow-hidden">
          {/* iridescent top line already in glass-hero::before */}
          <form onSubmit={handleSignIn} className="space-y-5 relative z-10">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="apna username dalein"
                  required
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-background/40 backdrop-blur text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  style={{ borderColor: "var(--glass-border)" }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="password dalein"
                  required
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border bg-background/40 backdrop-blur text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  style={{ borderColor: "var(--glass-border)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition disabled:opacity-60 flex items-center justify-center gap-2 shadow-md"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Please wait..." : "Login"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
