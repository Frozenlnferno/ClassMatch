import secrets
import string

from app.utils.db import get_cursor

ALPHABET = string.ascii_uppercase  # A-Z
UNSET = object()
GROUP_NOT_FOUND_ERROR = "Group not found"


def generate_join_code(length=10):
    return ''.join(secrets.choice(ALPHABET) for _ in range(length))


def _get_next_group_owner(cur, group_id):
    cur.execute(
        """
            SELECT user_id
            FROM group_members
            WHERE group_id = %s
                AND role = 'admin'
            ORDER BY joined_at ASC
            LIMIT 1;
        """,
        (group_id,)
    )
    next_owner = cur.fetchone()
    if next_owner:
        return next_owner[0]

    cur.execute(
        """
            SELECT user_id
            FROM group_members
            WHERE group_id = %s
                AND role = 'member'
            ORDER BY joined_at ASC
            LIMIT 1;
        """,
        (group_id,)
    )
    next_owner = cur.fetchone()
    if next_owner:
        return next_owner[0]

    return None


def reassign_or_delete_group(cur, group_id):
    next_owner_id = _get_next_group_owner(cur, group_id)
    if next_owner_id:
        cur.execute(
            """
                UPDATE group_members
                SET role = 'owner'
                WHERE group_id = %s AND user_id = %s;
            """,
            (group_id, next_owner_id)
        )
        cur.execute(
            """
                UPDATE groups
                SET created_by = %s
                WHERE id = %s;
            """,
            (next_owner_id, group_id)
        )
        return True

    cur.execute(
        """
            DELETE FROM groups
            WHERE id = %s;
        """,
        (group_id,)
    )
    return True


def remove_group_member(cur, uid, group_id):
    if not uid or not group_id:
        raise ValueError("Invalid input: uid and group_id are required")

    cur.execute(
        """
            SELECT role
            FROM group_members
            WHERE group_id = %s AND user_id = %s;
        """,
        (group_id, uid)
    )
    membership = cur.fetchone()
    if not membership:
        raise ValueError("User is not a member of the group")

    role = membership[0]

    cur.execute(
        """
            DELETE FROM group_members
            WHERE group_id = %s AND user_id = %s;
        """,
        (group_id, uid)
    )

    if role != 'owner':
        return True

    return reassign_or_delete_group(cur, group_id)


def _require_group_admin_or_owner(cur, group_id, user_id):
    cur.execute(
        """
            SELECT role FROM group_members
            WHERE group_id = %s AND user_id = %s;
        """,
        (group_id, user_id)
    )
    membership = cur.fetchone()
    if not membership or membership[0] not in ('admin', 'owner'):
        raise PermissionError("User does not have permission to change group settings")
    return membership[0]


def create_group(uid, groupName, description, joinable=True, group_icon_url=None):
    if not uid or not groupName:
        raise ValueError("Invalid input: uid and groupName are required")

    with get_cursor() as cur:
        cur.execute(
            """
                INSERT INTO groups (name, description, created_by, join_code, joinable, group_icon_url)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id;
            """,
            (groupName, description, uid, generate_join_code(), joinable, group_icon_url)
        )
        group_id = cur.fetchone()[0]
        cur.execute(
            """
                INSERT INTO group_members (group_id, user_id, role)
                VALUES (%s, %s, %s)
            """,
            (group_id, uid, 'owner')
        )
    return True


def join_group(uid, join_code):
    if not uid or not join_code:
        raise ValueError("Invalid input: uid and join_code are required")

    with get_cursor() as cur:
        cur.execute(
            """
                SELECT id, joinable FROM groups WHERE join_code = %s;
            """,
            (join_code,)
        )
        group_data = cur.fetchone()
        if not group_data:
            raise ValueError("Invalid join code")

        group_id = group_data[0]
        is_joinable = group_data[1]
        if not is_joinable:
            raise ValueError("Group is not joinable")

        cur.execute(
            """
                INSERT INTO group_members (group_id, user_id, role)
                VALUES (%s, %s, %s)
                ON CONFLICT (group_id, user_id) DO NOTHING
                RETURNING group_id;
            """,
            (group_id, uid, 'member')
        )
        result = cur.fetchone()
        if not result:
            return {
                "group_id": group_id,
                "already_member": True,
            }
    return {
        "group_id": group_id,
        "already_member": False,
    }


def leave_group(uid, group_id):
    if not uid or not group_id:
        raise ValueError("Invalid input: uid and group_id are required")

    with get_cursor() as cur:
        remove_group_member(cur, uid, group_id)
    return True


def change_group_info(admin_uid, group_id, name, description, joinable, group_icon_url=UNSET):
    if not admin_uid or not group_id:
        raise ValueError("Invalid input: admin_uid and group_id are required")

    fields = []
    values = []

    if name is not None:
        fields.append("name = %s")
        values.append(name)

    if description is not None:
        fields.append("description = %s")
        values.append(description)

    if joinable is not None and joinable == True or joinable == False:
        fields.append("joinable = %s")
        values.append(joinable)

    if group_icon_url is not UNSET:
        fields.append("group_icon_url = %s")
        values.append(group_icon_url)

    if not fields:
        return 0

    values.append(group_id)

    query = f"""
        UPDATE groups
        SET {', '.join(fields)}
        WHERE id = %s
    """

    with get_cursor() as cur:
        _require_group_admin_or_owner(cur, group_id, admin_uid)
        cur.execute(query, values)
    return True


def kick_member(admin_uid, member_uid, group_id):
    if not admin_uid or not member_uid or not group_id:
        raise ValueError("Invalid input: admin_uid, member_uid, and group_id are required")

    with get_cursor() as cur:
        cur.execute(
            """
                SELECT role FROM group_members
                WHERE group_id = %s AND user_id = %s;
            """,
            (group_id, admin_uid)
        )
        admin_data = cur.fetchone()
        if not admin_data or (admin_data[0] != 'admin' and admin_data[0] != 'owner'):
            raise PermissionError("User does not have permission to kick members")

        cur.execute(
            """
                SELECT role FROM group_members
                WHERE group_id = %s AND user_id = %s;
            """,
            (group_id, member_uid)
        )
        member_data = cur.fetchone()
        if not member_data or member_data[0] == 'owner' or (admin_data[0] != 'owner' and member_data[0] == 'admin'):
            raise PermissionError("Cannot kick this member")

        cur.execute(
            """
                DELETE FROM group_members
                WHERE group_id = %s AND user_id = %s;
            """,
            (group_id, member_uid)
        )
    return True


def get_user_groups(uid):
    if not uid:
        raise ValueError("Invalid input: uid is required")

    with get_cursor() as cur:
        cur.execute(
            """
                SELECT
                g.id,
                g.name,
                g.join_code,
                gm.role,
                (
                    SELECT COUNT(*)
                    FROM group_members gm2
                    WHERE gm2.group_id = g.id
                ) AS member_count,
                g.joinable,
                g.group_icon_url
                FROM groups g
                JOIN group_members gm ON g.id = gm.group_id
                WHERE gm.user_id = %s;
            """,
            (uid,)
        )
        rows = cur.fetchall() or []

    return [
        {
            "id": row[0],
            "name": row[1],
            "join_code": row[2],
            "role": row[3],
            "member_count": row[4],
            "joinable": row[5],
            "group_icon_url": row[6],
        }
        for row in rows
    ]


def get_group_details(uid, group_id):
    if not uid or not group_id:
        raise ValueError("Invalid input: uid and group_id are required")

    with get_cursor() as cur:
        cur.execute(
            """
                SELECT
                    g.id,
                    g.name,
                    g.description,
                    g.join_code,
                    g.joinable,
                    g.group_icon_url,
                    gm.role,
                    (
                        SELECT COUNT(*)
                        FROM group_members gm2
                        WHERE gm2.group_id = g.id
                    ) AS member_count
                FROM groups g
                JOIN group_members gm
                    ON gm.group_id = g.id
                WHERE g.id = %s
                    AND gm.user_id = %s
                LIMIT 1;
            """,
            (group_id, uid)
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("Group not found")

    return {
        "id": row[0],
        "name": row[1],
        "description": row[2],
        "join_code": row[3],
        "joinable": row[4],
        "group_icon_url": row[5],
        "my_role": row[6],
        "member_count": row[7],
    }


def _assert_group_member(cur, uid, group_id):
    cur.execute(
        """
            SELECT 1
            FROM group_members
            WHERE group_id = %s AND user_id = %s
            LIMIT 1;
        """,
        (group_id, uid)
    )
    if not cur.fetchone():
        raise PermissionError(GROUP_NOT_FOUND_ERROR)


def get_group_members(requester_uid, group_id):
    if not requester_uid or not group_id:
        raise ValueError("Invalid input: requester_uid and group_id are required")

    with get_cursor() as cur:
        _assert_group_member(cur, requester_uid, group_id)
        cur.execute(
            """
                SELECT u.id, u.name, gm.role, gm.joined_at, u.avatar_url
                FROM users u
                JOIN group_members gm ON u.id = gm.user_id
                WHERE gm.group_id = %s
                ORDER BY gm.joined_at ASC;
            """,
            (group_id,)
        )
        rows = cur.fetchall() or []

    return [
        {
            "user_id": row[0],
            "name": row[1],
            "role": row[2],
            "joined_at": row[3].isoformat().replace("+00:00", "Z") if row[3] else None,
            "avatar_url": row[4],
        }
        for row in rows
    ]


def change_group_role(admin_uid, member_uid, group_id, new_role):
    if not admin_uid or not member_uid or not group_id or not new_role:
        raise ValueError("Invalid input: admin_uid, member_uid, group_id, and new_role are required")

    valid_roles = ['member', 'admin']
    if new_role not in valid_roles:
        raise ValueError("Invalid role specified")

    with get_cursor() as cur:
        cur.execute(
            """
                SELECT role FROM group_members
                WHERE group_id = %s AND user_id = %s;
            """,
            (group_id, admin_uid)
        )
        admin_data = cur.fetchone()
        if not admin_data or (admin_data[0] != 'admin' and admin_data[0] != 'owner'):
            raise PermissionError("User does not have permission to change roles")

        cur.execute(
            """
                SELECT role FROM group_members
                WHERE group_id = %s AND user_id = %s;
            """,
            (group_id, member_uid)
        )
        member_data = cur.fetchone()
        if not member_data:
            raise ValueError("Member not found in the group")
        if member_data[0] == 'owner' or (admin_data[0] != 'owner' and member_data[0] == 'admin'):
            raise PermissionError("Cannot change this member's role")

        cur.execute(
            """
                UPDATE group_members
                SET role = %s
                WHERE group_id = %s AND user_id = %s;
            """,
            (new_role, group_id, member_uid)
        )
    return True
