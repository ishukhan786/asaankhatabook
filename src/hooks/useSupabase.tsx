import { useAuth } from "@clerk/clerk-react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useMemo, useState, useEffect } from "react";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function useSupabase() {
  const { getToken } = useAuth();
  const [client, setClient] = useState<SupabaseClient<Database> | null>(null);

  useEffect(() => {
    const initClient = async () => {
      const clerkToken = await getToken({ template: "supabase" });
      
      const supabase = createClient<Database>(
        SUPABASE_URL || "https://placeholder.supabase.co",
        SUPABASE_PUBLISHABLE_KEY || "placeholder",
        {
          global: {
            headers: clerkToken ? {
              Authorization: `Bearer ${clerkToken}`,
            } : undefined,
          },
        }
      );
      setClient(supabase);
    };

    initClient();
  }, [getToken]);

  return client;
}
