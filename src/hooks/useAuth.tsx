/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";

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

type ClerkUser = {
  id: string;
  email?: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};

interface AuthCtx {
  user: ClerkUser | null | undefined; // Clerk User object
  session: null;
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
  const { user, isLoaded: userLoaded } = useUser();
  const { signOut: clerkSignOut, isLoaded: authLoaded } = useClerkAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loadingExtras, setLoadingExtras] = useState(false);

  const loadExtras = useCallback(async (uid: string, clerkUser?: ClerkUser) => {
    setLoadingExtras(true);

    // Auto-upsert profile so it always exists for logged-in Clerk users
    const fullName = clerkUser
      ? [
          typeof clerkUser.firstName === "string" ? clerkUser.firstName : "",
          typeof clerkUser.lastName === "string" ? clerkUser.lastName : "",
        ].filter(Boolean).join(" ") || (typeof clerkUser.username === "string" ? clerkUser.username : null) || null
      : null;

    await supabase.from("profiles").upsert(
      { id: uid, full_name: fullName },
      { onConflict: "id", ignoreDuplicates: true }
    );

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
    setLoadingExtras(false);
  }, []);

  const refresh = async () => {
    if (user) await loadExtras(user.id);
  };

  useEffect(() => {
    if (userLoaded && user) {
      loadExtras(user.id, user);
    } else if (userLoaded && !user) {
      setProfile(null);
      setRole(null);
    }
  }, [user, userLoaded, loadExtras]);

  const signOut = async () => {
    await clerkSignOut();
    setProfile(null);
    setRole(null);
  };

  const loading = !userLoaded || !authLoaded || (user ? loadingExtras : false);

  // RBAC Helpers
  const canManageUsers = role === "admin" || role === "branch_manager";
  const canWriteTransactions = role === "admin" || role === "branch_manager" || role === "accountant" || role === "branch_user" || role === "cashier";
  const canDeleteTransactions = role === "admin" || role === "branch_manager";
  const canAccessReports = role === "admin" || role === "branch_manager" || role === "accountant" || role === "branch_user";

  return (
    <Ctx.Provider value={{ 
      user, session: null, profile, role, loading, signOut, refresh,
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
