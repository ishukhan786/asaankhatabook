// Deno global type declarations for VS Code IntelliSense
declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    get(key: string, defaultValue: string): string;
  }
  export const env: Env;

  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
    options?: {
      port?: number;
      hostname?: string;
      onListen?: (params: { hostname: string; port: number }) => void;
    }
  ): void;
}

// Allow esm.sh and deno.land URL imports in type checking
declare module "https://esm.sh/@supabase/supabase-js@2.45.0" {
  export * from "@supabase/supabase-js";
}
declare module "https://esm.sh/@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}
declare module "https://deno.land/x/cors/mod.ts" {
  const cors: any;
  export default cors;
}
