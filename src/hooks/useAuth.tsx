/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type Role = "admin" | "branch_manager" | "accountant" | "cashier" | "viewer" | "branch_user";

interface Profile {
  id: string;
  full_name: string | null;
  branch_id: string | null;
  avatar_url: string | null;
  business_name: string | null;
  business_phone: string | null;
  business_address: string | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  // RBAC Helpers
  canManageUsers: boolean;
  canWriteTransactions: boolean;
  canDeleteTransactions: boolean;
  canAccessReports: boolean;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const loadExtras = async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, branch_id, avatar_url, business_name, business_phone, business_address")
        .eq("id", uid)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(p as Profile | null);

    const roles = ((r ?? []) as Array<{ role?: string }>).map((x) => x.role ?? "");
    let finalRole: Role | null = null;
    
    // Priority assignment
    if (roles.includes("admin")) finalRole = "admin";
    else if (roles.includes("branch_manager")) finalRole = "branch_manager";
    else if (roles.includes("accountant")) finalRole = "accountant";
    else if (roles.includes("cashier")) finalRole = "cashier";
    else if (roles.includes("viewer")) finalRole = "viewer";
    else if (roles.includes("branch_user")) finalRole = "branch_user"; // legacy
    
    setRole(finalRole);
  };

  const refresh = async () => {
    if (user) await loadExtras(user.id);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadExtras(s.user.id);
      } else {
        setProfile(null);
        setRole(null);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadExtras(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
  };

  // RBAC Helpers
  const canManageUsers = role === "admin" || role === "branch_manager";
  const canWriteTransactions = role === "admin" || role === "branch_manager" || role === "accountant" || role === "branch_user" || role === "cashier";
  const canDeleteTransactions = role === "admin" || role === "branch_manager";
  const canAccessReports = role === "admin" || role === "branch_manager" || role === "accountant" || role === "branch_user";

  return (
    <Ctx.Provider value={{ 
      user, session, profile, role, loading, signOut, refresh,
      canManageUsers, canWriteTransactions, canDeleteTransactions, canAccessReports
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
};
