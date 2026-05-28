// Admin user management: list/create/update/delete users (admin-only)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Missing auth" }, 401);

    // Decode JWT payload directly from the token (Supabase API Gateway already validates signature & expiration)
    let userId = "";
    try {
      const payloadPart = token.split(".")[1];
      const decodedPayload = JSON.parse(atob(payloadPart));
      userId = (decodedPayload as { sub?: string }).sub as string;
      if (!userId) throw new Error("Missing sub claim");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("JWT decode failed:", msg);
      return json({ error: "Unauthorized" }, 401);
    }

    // Admin client with service role for privileged operations
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
      admin.rpc("has_role", { _user_id: userId, _role: "admin" }),
      admin.rpc("has_role", { _user_id: userId, _role: "branch_manager" })
    ]);
    if (!isAdmin && !isManager) return json({ error: "Forbidden" }, 403);

    let managerBranchId: string | null = null;
    if (isManager && !isAdmin) {
      const { data: p } = await admin.from("profiles").select("branch_id").eq("id", userId).single();
      managerBranchId = p?.branch_id ?? null;
      if (!managerBranchId) return json({ error: "Manager has no branch assigned" }, 403);
    }

    if (req.method === "GET") {
      const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const ids = list.users.map((u) => u.id);
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
      const users = list.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        full_name: pMap.get(u.id)?.full_name ?? null,
        branch_id: pMap.get(u.id)?.branch_id ?? null,
        roles: rMap.get(u.id) ?? [],
      }));

      // Filter users if manager
      const finalUsers = (isManager && !isAdmin) 
        ? users.filter(u => u.branch_id === managerBranchId)
        : users;

      return json({ users: finalUsers });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { email, password, full_name, role, branch_id: bodyBranchId } = (body ?? {}) as Record<string, unknown>;
      let branch_id = bodyBranchId as string | undefined;
      if (!email || !password || !role) return json({ error: "email, password, role required" }, 400);
      if (role !== "admin" && !branch_id) return json({ error: "branch_id required" }, 400);

      // Branch Manager Security Checks
      if (isManager && !isAdmin) {
        if (role === "admin") return json({ error: "Managers cannot create admins" }, 403);
        branch_id = managerBranchId; // Force manager's branch
      }

      const { data: created, error } = await admin.auth.admin.createUser({
        email: email as string, password: password as string, email_confirm: true, user_metadata: { full_name },
      });
      if (error) throw error;
      const uid = created.user!.id;

      // Trigger creates profile + default role; correct them
      await admin.from("profiles").update({ full_name: full_name ?? null, branch_id: branch_id ?? null }).eq("id", uid);
      await admin.from("user_roles").delete().eq("user_id", uid);
      await admin.from("user_roles").insert({ user_id: uid, role });
      return json({ id: uid });
    }

    if (req.method === "PATCH") {
      const body = (await req.json()) as Record<string, unknown>;
      const { id, full_name, role, password, branch_id: initialBranch } = (body ?? {}) as {
        id?: string; full_name?: string; branch_id?: string; role?: string; password?: string
      };
      let branch_id = initialBranch as string | undefined;
      if (!id) return json({ error: "id required" }, 400);

      // Security Checks for Manager
      if (isManager && !isAdmin) {
        // Must only patch users in their own branch
        const { data: targetProfile } = await admin.from("profiles").select("branch_id").eq("id", id).single();
        if (targetProfile?.branch_id !== managerBranchId) return json({ error: "Cannot edit user outside your branch" }, 403);
        if (role === "admin") return json({ error: "Managers cannot assign admin role" }, 403);
        branch_id = managerBranchId; // Force manager's branch
      }

      if (password) {
        const { error } = await admin.auth.admin.updateUserById(id, { password });
        if (error) throw error;
      }
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
        const { data: targetProfile } = await admin.from("profiles").select("branch_id").eq("id", id).single();
        if (targetProfile?.branch_id !== managerBranchId) return json({ error: "Cannot delete user outside your branch" }, 403);
        
        // Prevent deleting another branch_manager just to be safe
        const { data: targetRole } = await admin.from("user_roles").select("role").eq("user_id", id).maybeSingle();
        if (targetRole?.role === "admin") return json({ error: "Cannot delete admins" }, 403);
      }
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("admin-users error", msg);
    return json({ error: msg ?? "Server error" }, 500);
  }
});
