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
      userId = decodedPayload.sub;
      if (!userId) throw new Error("Missing sub claim");
    } catch (err: any) {
      console.error("JWT decode failed:", err?.message);
      return json({ error: "Unauthorized" }, 401);
    }

    // Admin client with service role for privileged operations
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    if (req.method === "GET") {
      const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) throw error;
      const ids = list.users.map((u) => u.id);
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        admin.from("profiles").select("id, full_name, branch_id").in("id", ids),
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const rMap = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = rMap.get(r.user_id) ?? [];
        arr.push(r.role);
        rMap.set(r.user_id, arr);
      });
      const users = list.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        full_name: (pMap.get(u.id) as any)?.full_name ?? null,
        branch_id: (pMap.get(u.id) as any)?.branch_id ?? null,
        roles: rMap.get(u.id) ?? [],
      }));
      return json({ users });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { email, password, full_name, role, branch_id } = body ?? {};
      if (!email || !password || !role) return json({ error: "email, password, role required" }, 400);
      if (role === "branch_user" && !branch_id) return json({ error: "branch_id required for branch_user" }, 400);

      const { data: created, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
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
      const body = await req.json();
      const { id, full_name, branch_id, role, password } = body ?? {};
      if (!id) return json({ error: "id required" }, 400);
      if (password) {
        const { error } = await admin.auth.admin.updateUserById(id, { password });
        if (error) throw error;
      }
      if (full_name !== undefined || branch_id !== undefined) {
        const patch: any = {};
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
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e: any) {
    console.error("admin-users error", e);
    return json({ error: e?.message ?? "Server error" }, 500);
  }
});
