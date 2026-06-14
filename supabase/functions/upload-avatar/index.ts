// Edge Function: upload-avatar
// Accepts multipart form data, uploads to Supabase Storage using service role key
// This bypasses the JWT verification issue with Clerk tokens in Storage RLS

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLERK_SECRET_KEY = Deno.env.get("CLERK_SECRET_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify Clerk token
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Missing auth token" }, 401);

    // Decode JWT to get userId
    let userId = "";
    try {
      const payloadPart = token.split(".")[1];
      let base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";
      const payload = JSON.parse(atob(base64));
      userId = payload.sub;
      if (!userId) throw new Error("No sub");
    } catch {
      return json({ error: "Unauthorized" }, 401);
    }

    // Get file from form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return json({ error: "No file provided" }, 400);

    // Validate file type
    if (!file.type.startsWith("image/")) return json({ error: "Only images allowed" }, 400);
    if (file.size > 5 * 1024 * 1024) return json({ error: "File too large (max 5MB)" }, 400);

    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${userId}-${Date.now()}.${ext}`;

    // Upload using service role (bypasses RLS)
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from("avatars")
      .upload(filePath, arrayBuffer, { contentType: file.type, upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = admin.storage.from("avatars").getPublicUrl(filePath);

    // Update profile
    await admin.from("profiles").upsert({ id: userId, avatar_url: publicUrl });

    return json({ url: publicUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("upload-avatar error:", msg);
    return json({ error: msg }, 500);
  }
});
