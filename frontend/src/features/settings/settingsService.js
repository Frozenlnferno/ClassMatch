import { API_ROUTES } from "../../config/api.js";
import { getAccessToken } from "../../utils/authToken.js";

const API_BASE = API_ROUTES.users;

async function getToken() {
    return getAccessToken();
}

export async function getUserProfile() {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
    return res.json();
}

export async function updateUserProfile(updates) {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/me`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update profile: ${res.status}`);
    return res.json();
}

/**
 * Upload current user's avatar image
 * @param {File|Blob} file - Avatar image
 * @returns {Promise<object>} Response containing avatar_url
 */
export async function uploadUserAvatar(file) {
    const token = await getToken();
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(`${API_BASE}/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to upload avatar: ${res.status}`);
    }
    return res.json();
}

/**
 * Remove current user's avatar image
 * @returns {Promise<object>} API response payload
 */
export async function removeUserAvatar() {
    return updateUserProfile({ avatar_url: null });
}

/**
 * Delete current user's account
 * @returns {Promise<object>} API response payload
 */
export async function deleteUserAccount() {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to delete account: ${res.status}`);
    }
    return res.json();
}

export async function getPublicProfile(userId) {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch user profile: ${res.status}`);
    return res.json();
}
