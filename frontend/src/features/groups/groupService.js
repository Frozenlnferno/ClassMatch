import { API_ROUTES } from "../../config/api.js";
import { getAccessToken } from "../../utils/authToken.js";

async function getToken() {
    return getAccessToken();
}

/**
 * Get all groups the user is a member of
 * @returns {Promise<Array>} List of user's groups
 */
export async function getUserGroups() {
    const token = await getToken();

    const response = await fetch(`${API_ROUTES.groups}/`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch groups: ${response.status}`);
    }

    return await response.json();
}

/**
 * Get details for a specific group the user belongs to
 * @param {string} groupId - Group identifier
 * @returns {Promise<object>} Group details
 */
export async function getGroupDetails(groupId) {
    const token = await getToken();

    const response = await fetch(`${API_ROUTES.groups}/${encodeURIComponent(groupId)}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch group details: ${response.status}`);
    }

    return await response.json();
}

/**
 * Create a new group
 * @param {object} groupData - Group creation data
 * @param {string} groupData.groupName - Name of the group
 * @param {string} groupData.description - Description of the group
 * @param {boolean} groupData.joinable - Whether the group is joinable
 * @returns {Promise<object>} Success response
 */
export async function createGroup(groupData) {
    const token = await getToken();

    const response = await fetch(`${API_ROUTES.groups}/create`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(groupData),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create group: ${response.status}`);
    }

    return await response.json();
}

/**
 * Join a group using join code
 * @param {string} joinCode - The join code for the group
 * @returns {Promise<object>} Success response
 */
export async function joinGroup(joinCode) {
    const token = await getToken();

    const response = await fetch(`${API_ROUTES.groups}/join`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ join_code: joinCode }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to join group: ${response.status}`);
    }

    return await response.json();
}

/**
 * Leave a group
 * @param {string} groupId - ID of the group to leave
 * @returns {Promise<object>} Success response
 */
export async function leaveGroup(groupId) {
    const token = await getToken();

    const response = await fetch(`${API_ROUTES.groups}/leave`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ group_id: groupId }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to leave group: ${response.status}`);
    }

    return await response.json();
}

/**
 * Get group members
 * @param {string} groupId - ID of the group
 * @returns {Promise<Array>} List of group members
 */
export async function getGroupMembers(groupId) {
    const token = await getToken();

    const response = await fetch(`${API_ROUTES.groups}/${groupId}/members`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch members: ${response.status}`);
    }

    return await response.json();
}

/**
 * Kick a member from group (admin/owner only)
 * @param {string} groupId - ID of the group
 * @param {string} memberId - ID of the member to kick
 * @returns {Promise<object>} Success response
 */
export async function kickMember(groupId, memberId) {
    const token = await getToken();

    const response = await fetch(`${API_ROUTES.groups}/${groupId}/kick`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ member_id: memberId }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to kick member: ${response.status}`);
    }

    return await response.json();
}

/**
 * Change a member's role (admin/owner only)
 * @param {string} groupId - ID of the group
 * @param {string} memberId - ID of the member
 * @param {string} newRole - New role ('admin', 'member')
 * @returns {Promise<object>} Success response
 */
export async function changeMemberRole(groupId, memberId, newRole) {
    const token = await getToken();

    const response = await fetch(`${API_ROUTES.groups}/${groupId}/change-role`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ member_id: memberId, new_role: newRole }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to change role: ${response.status}`);
    }

    return await response.json();
}

/**
 * Update group info (admin/owner only)
 * @param {string} groupId - ID of the group
 * @param {object} updates - Updates to apply
 * @param {string} updates.name - New name
 * @param {string} updates.description - New description
 * @param {boolean} updates.joinable - New joinable status
 * @returns {Promise<object>} Success response
 */
export async function updateGroupInfo(groupId, updates) {
    const token = await getToken();

    const response = await fetch(`${API_ROUTES.groups}/${groupId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update group: ${response.status}`);
    }

    return await response.json();
}

/**
 * Get matching classmates for a group and schedule
 * @param {string} groupId - ID of the group
 * @param {string} year - Year of the schedule
 * @param {string} term - Term of the schedule
 * @returns {Promise<Array>} List of matching classmates
 */
export async function getMatchingClassmates(groupId, year, term) {
    const token = await getToken();

    const params = new URLSearchParams({ group_id: groupId, year, term });
    const response = await fetch(`${API_ROUTES.schedules}/matching-classmates?${params}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch matching classmates: ${response.status}`);
    }

    return await response.json();
}

/**
 * Get past classmates for a group and schedule
 * @param {string} groupId - ID of the group
 * @param {string|number} year - Year of the schedule
 * @param {string} term - Term of the schedule
 * @returns {Promise<Array>} List of past classmates
 */
export async function getPastClassmates(groupId, year, term) {
    const token = await getToken();

    const params = new URLSearchParams({ group_id: String(groupId), year: String(year), term });
    const response = await fetch(`${API_ROUTES.schedules}/past-classmates?${params}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch past classmates: ${response.status}`);
    }

    return await response.json();
}

export async function joinGroupByInviteCodeURL(inviteCode) {
    const token = await getToken();

    const response = await fetch(`${API_ROUTES.groups}/join/${encodeURIComponent(inviteCode)}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to join group: ${response.status}`);
    }

    return await response.json();
}

/**
 * Upload a group icon (admin/owner only)
 * @param {string} groupId - ID of the group
 * @param {File|Blob} file - Image file to upload
 * @returns {Promise<object>} Response containing group_icon_url
 */
export async function uploadGroupIcon(groupId, file) {
    const token = await getToken();

    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_ROUTES.groups}/${encodeURIComponent(groupId)}/icon`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to upload group icon: ${response.status}`);
    }

    return await response.json();
}

/**
 * Remove a group icon (admin/owner only)
 * @param {string} groupId - ID of the group
 * @returns {Promise<object>} Success response
 */
export async function removeGroupIcon(groupId) {
    return updateGroupInfo(groupId, { group_icon_url: null });
}
