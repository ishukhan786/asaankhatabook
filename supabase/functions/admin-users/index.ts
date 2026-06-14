// Admin user management: list/create/update/delete users using Clerk API (admin-only)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLERK_SECRET_KEY = Deno.env.get("CLERK_SECRET_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Helper to interact with Clerk Backend API
async function fetchClerk(path: string, method = "GET", body?: any) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.errors?.[0]?.message || "Clerk API Error");
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Missing auth token" }, 401);

    if (!CLERK_SECRET_KEY) return json({ error: "Clerk API Key not configured" }, 500);

    // Decode JWT payload to get user ID
    let userId = "";
    try {
      const payloadPart = token.split(".")[1];
      let base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) {
        base64 += "=";
      }
      const decodedPayload = JSON.parse(atob(base64));
      userId = (decodedPayload as { sub?: string }).sub as string;
      if (!userId) throw new Error("Missing sub claim");
    } catch (err: unknown) {
      console.error("JWT decode failed:", err);
      return json({ error: "Unauthorized" }, 401);
    }

    // Admin client with service role for privileged database operations
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    
    // Replace ambiguous has_role RPC call with direct table query
    const { data: userRoles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const rolesArray = userRoles?.map(r => r.role) || [];
    const isAdmin = rolesArray.includes("admin");
    const isManager = rolesArray.includes("branch_manager");

    if (!isAdmin && !isManager) return json({ error: "Forbidden - Requires Admin role" }, 403);

    let managerBranchId: string | null = null;
    if (isManager && !isAdmin) {
      const { data: p } = await admin.from("profiles").select("branch_id").eq("id", userId).single();
      managerBranchId = p?.branch_id ?? null;
      if (!managerBranchId) return json({ error: "Manager has no branch assigned" }, 403);
    }

    if (req.method === "GET") {
      // 1. Fetch users from Clerk
      const clerkUsers = await fetchClerk("/users?limit=500&order_by=-created_at");
      
      const ids = clerkUsers.map((u: any) => u.id);
      
      // 2. Fetch profiles and roles from Supabase
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        admin.from("profiles").select("id, full_name, branch_id").in("id", ids),
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      
      type ProfileRow = { id: string; full_name?: string | null; branch_id?: string | null };
      type RoleRow = { user_id: string; role: string };
      
      const pMap = new Map<string, ProfileRow>((profiles ?? []).map((p: ProfileRow) => [p.id, p]));
      const rMap = new Map<string, string[]>();
      (roles ?? []).forEach((r: RoleRow) => {
        const arr = rMap.get(r.user_id) ?? [];
        arr.push(r.role);
        rMap.set(r.user_id, arr);
      });

      // 3. Map Clerk user object to AdminUser expected by frontend
      const users = clerkUsers.map((u: any) => {
        // Find email or fallback to username
        const primaryEmail = u.email_addresses?.find((e: any) => e.id === u.primary_email_address_id)?.email_address;
        const email = primaryEmail || `${u.username || 'user'}@no-email.com`;
        
        return {
          id: u.id,
          username: u.username || 'unknown',
          created_at: new Date(u.created_at).toISOString(),
          last_sign_in_at: u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString() : null,
          full_name: pMap.get(u.id)?.full_name ?? null,
          branch_id: pMap.get(u.id)?.branch_id ?? null,
          roles: rMap.get(u.id) ?? [],
        };
      });

      // 4. Filter users if manager
      const finalUsers = (isManager && !isAdmin) 
        ? users.filter((u: any) => u.branch_id === managerBranchId)
        : users;

      return json({ users: finalUsers });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { username, password, full_name, role, branch_id: bodyBranchId } = (body ?? {}) as Record<string, unknown>;
      let branch_id = bodyBranchId as string | undefined;
      
      if (!username || !password || !role) return json({ error: "username, password, role required" }, 400);
      if (role !== "admin" && !branch_id) return json({ error: "branch_id required" }, 400);

      if (isManager && !isAdmin) {
        if (role === "admin") return json({ error: "Managers cannot create admins" }, 403);
        branch_id = managerBranchId ?? undefined; // Force manager's branch
      }

      // 1. Create user in Clerk
      const usernameStr = String(username);
      const clerkUser = await fetchClerk("/users", "POST", {
        password: String(password),
        username: usernameStr,
        skip_password_checks: true,
      });const uid = clerkUser.id;

      // 2. Insert profile & role in Supabase
      await admin.from("profiles").upsert({ id: uid, full_name: full_name ?? null, branch_id: branch_id ?? null });
      await admin.from("user_roles").delete().eq("user_id", uid);
      await admin.from("user_roles").insert({ user_id: uid, role });
      
      return json({ id: uid });
    }

    if (req.method === "PATCH") {
      const body = await req.json();
      const { id, full_name, role, password, branch_id: initialBranch } = (body ?? {}) as {
        id?: string; full_name?: string; branch_id?: string; role?: string; password?: string
      };
      let branch_id = initialBranch as string | undefined;
      if (!id) return json({ error: "id required" }, 400);

      if (isManager && !isAdmin) {
        const { data: targetProfile, error: profileError } = await admin.from("profiles").select("branch_id").eq("id", id).maybeSingle();
        if (profileError || !targetProfile || targetProfile.branch_id !== managerBranchId) return json({ error: "Cannot edit user outside your branch" }, 403);
        if (role === "admin") return json({ error: "Managers cannot assign admin role" }, 403);
        branch_id = managerBranchId ?? undefined; // Force manager's branch
      }

      // 1. Update password in Clerk if provided
      if (password) {
        await fetchClerk(`/users/${id}`, "PATCH", { password });
      }

      // 2. Update Supabase Profile & Role
      if (full_name !== undefined || branch_id !== undefined) {
        const patch: Record<string, unknown> = {};
        if (full_name !== undefined) patch.full_name = full_name;
        if (branch_id !== undefined) patch.branch_id = branch_id;
        await admin.from("profiles").update(patch).eq("id", id);
      }
      if (role) {
        await admin.from("user_roles").delete().eq("user_id", id);
        await admin.from("user_roles").insert({ user_id: id, role });
      }
      return json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { id } = await req.json();
      if (!id) return json({ error: "id required" }, 400);
      if (id === userId) return json({ error: "Cannot delete yourself" }, 400);

      if (isManager && !isAdmin) {
        const { data: targetProfile, error: profileError } = await admin.from("profiles").select("branch_id").eq("id", id).maybeSingle();
        if (profileError || !targetProfile || targetProfile.branch_id !== managerBranchId) return json({ error: "Cannot delete user outside your branch" }, 403);
        
        const { data: targetRole } = await admin.from("user_roles").select("role").eq("user_id", id).maybeSingle();
        if (targetRole?.role === "admin") return json({ error: "Cannot delete admins" }, 403);
      }

      // 1. Delete user from Clerk
      try {
        await fetchClerk(`/users/${id}`, "DELETE");
      } catch (err: any) {
        // Clerk returns 404/not found if it's a legacy Supabase user. We can safely ignore it to clean up local DB.
        if (!err.message?.includes("not found") && !err.message?.includes("User not found")) {
          throw err;
        }
      }

      // 2. Delete Supabase Profile & Roles to maintain clean state
      await admin.from("user_roles").delete().eq("user_id", id);
      await admin.from("profiles").delete().eq("id", id);

      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("admin-users error:", msg);
    return json({ error: msg ?? "Server error" }, 500);
  }
});
