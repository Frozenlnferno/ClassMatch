import { createClient } from "@supabase/supabase-js";
import { requirePublicEnv, requirePublicUrlEnv } from "./src/config/env.js";

const supabaseUrl = requirePublicUrlEnv("VITE_SUPABASE_URL");
const supabasePublishableKey = requirePublicEnv("VITE_SUPABASE_PUBLISHABLE_KEY");

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
