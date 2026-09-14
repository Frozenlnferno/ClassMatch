import { supabase } from "../../supabase.js";

export async function getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error("No active session");
    }
    return session.access_token;
}