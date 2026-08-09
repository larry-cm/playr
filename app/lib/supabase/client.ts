import { createBrowserClient } from "@supabase/ssr"
import { supabaseUrl, supabaseKey } from "@lib/const"

export const supabase = createBrowserClient(
  supabaseUrl!,
  supabaseKey!,
)