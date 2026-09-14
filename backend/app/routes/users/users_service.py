from supabase_auth.errors import AuthRetryableError

from app.utils.db import get_cursor
from app.utils.supabase_admin import get_supabase_admin_client

UNSET = object()


class AccountDeletionUnavailableError(RuntimeError):
    """Raised when account deletion cannot be completed due to an upstream dependency."""


def get_self_info(user_id):
    with get_cursor() as cur:
        cur.execute(
            """
                SELECT * FROM users WHERE id = %s
            """,
            (user_id,)
        )
        user = cur.fetchone()
    return {
        "id": user[0],
        "email": user[1],
        "name": user[2],
        "created_at": user[3],
        "bio": user[4],
        "avatar_url": user[5],
    }


def get_user_info(user_id):
    with get_cursor() as cur:
        cur.execute(
            """
                SELECT id, name, created_at, bio, avatar_url FROM users WHERE id = %s
            """,
            (user_id,)
        )
        user = cur.fetchone()
    return {
        "id": user[0],
        "name": user[1],
        "created_at": user[2],
        "bio": user[3],
        "avatar_url": user[4],
    }


def update_self_info(user_id, name=UNSET, bio=UNSET, avatar_url=UNSET):
    fields = []
    values = []

    if name is not UNSET:
        fields.append("name = %s")
        values.append(name)

    if bio is not UNSET:
        fields.append("bio = %s")
        values.append(bio)

    if avatar_url is not UNSET:
        fields.append("avatar_url = %s")
        values.append(avatar_url)

    if not fields:
        return 0

    values.append(user_id)

    query = f"""
        UPDATE public.users
        SET {', '.join(fields)}
        WHERE id = %s
    """

    with get_cursor() as cur:
        cur.execute(query, values)


def _delete_supabase_auth_user(user_id):
    supabase_admin = get_supabase_admin_client()
    try:
        supabase_admin.auth.admin.delete_user(user_id)
    except AuthRetryableError as exc:
        raise AccountDeletionUnavailableError(
            "Supabase Auth did not finish deleting the user before the timeout."
        ) from exc


def _get_next_group_owner_for_deleted_user(cur, group_id, user_id):
    cur.execute(
        """
            SELECT user_id
            FROM group_members
            WHERE group_id = %s
                AND user_id <> %s
                AND role = 'admin'
            ORDER BY joined_at ASC
            LIMIT 1;
        """,
        (group_id, user_id)
    )
    next_owner = cur.fetchone()
    if next_owner:
        return next_owner[0]

    cur.execute(
        """
            SELECT user_id
            FROM group_members
            WHERE group_id = %s
                AND user_id <> %s
                AND role = 'member'
            ORDER BY joined_at ASC
            LIMIT 1;
        """,
        (group_id, user_id)
    )
    next_owner = cur.fetchone()
    if next_owner:
        return next_owner[0]

    return None


def _prepare_owned_groups_for_account_deletion(user_id):
    with get_cursor() as cur:
        cur.execute(
            """
                SELECT id
                FROM groups
                WHERE created_by = %s
                ORDER BY created_at ASC, id ASC;
            """,
            (user_id,)
        )
        owned_groups = cur.fetchall() or []

        for row in owned_groups:
            group_id = row[0]
            next_owner_id = _get_next_group_owner_for_deleted_user(cur, group_id, user_id)
            if next_owner_id:
                cur.execute(
                    """
                        UPDATE group_members
                        SET role = 'admin'
                        WHERE group_id = %s AND user_id = %s AND role = 'owner';
                    """,
                    (group_id, user_id)
                )
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
            else:
                cur.execute(
                    """
                        DELETE FROM groups
                        WHERE id = %s;
                    """,
                    (group_id,)
                )


def delete_self_account(user_id):
    _prepare_owned_groups_for_account_deletion(user_id)
    _delete_supabase_auth_user(user_id)
