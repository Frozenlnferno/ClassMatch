import { supabase } from "../../../supabase.js";
import { buildPublicAppUrl } from "../../config/site.js";

/**
 * Sign up a user with email and password.
 * @params {string} email of user
 * @params {string} password of user
 * @params {string} name of user
 * @returns {Promise<object>} object containing "user" and "session".
 * @throws {Error} if sign up fails.
**/
export async function signUpWithEmail(email, password, name) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name
            }
        }
    })
    if (error) { throw error; }
    return data;
}

/**
 * Login a user with email and password.
 * @params {string} email of user
 * @params {string} password of user
 * @returns {Promise<object>} object containing "user" and "session".
 * @throws {Error} if login fails.
**/
export async function loginWithEmail(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })
    if (error) { throw error; }
    return data;
}

/**
 * Sign in with Google OAuth.
 * Redirects the user to Google's OAuth consent screen.
 * @returns {Promise<object>} OAuth response data
 * @throws {Error} if OAuth fails
 */
export async function signInWithGoogle() {
    return signInWithGoogleTo("/mygroups");
}

export async function signInWithGoogleTo(redirectPath = "/mygroups") {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: buildPublicAppUrl(redirectPath),
        },
    });
    if (error) { throw error; }
    return data;
}

/**
 * Log outs the current user.
 * @returns {Promise<void>}
 * @throws {Error} if logout fails.
**/
export async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) { throw error; }
    return;
}

/**
 * Update the current user's password.
 * @param {string} newPassword - The new password
 * @returns {Promise<object>} Updated user data
 * @throws {Error} if update fails
 */
export async function updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
    });
    if (error) { throw error; }
    return data;
}

/**
 * Send a password reset email via Supabase.
 * @param {string} email - User email
 * @returns {Promise<object>} Supabase response data
 * @throws {Error} if request fails
 */
export async function requestPasswordReset(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: buildPublicAppUrl("/reset-password"),
    });
    if (error) { throw error; }
    return data;
}
