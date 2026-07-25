import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabaseKey } from "@lib/const";

export const createClient = () =>
  createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
  );
