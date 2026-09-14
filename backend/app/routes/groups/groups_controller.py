import math
from uuid import uuid4

from flask import request, jsonify, g, Blueprint
from app.config import Config
from app.utils.auth import require_auth
from app.utils.logger import get_logger
from werkzeug.utils import secure_filename

from app.utils.supabase_admin import delete_public_file_from_url, upload_public_file
from .groups_service import (
    GROUP_NOT_FOUND_ERROR,
    UNSET,
    change_group_info,
    change_group_role,
    create_group,
    get_group_details,
    get_group_members,
    get_user_groups,
    join_group,
    kick_member,
    leave_group,
)

bp = Blueprint("groups", __name__)
logger = get_logger(__name__)
ALLOWED_IMAGE_MIME_TYPES = {
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
ALLOWED_IMAGE_EXTENSIONS = {
    "gif": "image/gif",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}


def _get_image_upload(*field_names):
    for field_name in field_names:
        uploaded_file = request.files.get(field_name)
        if uploaded_file and uploaded_file.filename:
            return uploaded_file
    raise ValueError("No image file uploaded")
def _format_size_limit(max_bytes):
    if max_bytes < 1024 * 1024:
        return f"{max_bytes} bytes"
    return f"{math.ceil(max_bytes / (1024 * 1024))} MB"


def _normalize_image_type(uploaded_file):
    raw_content_type = (uploaded_file.content_type or "").split(";", 1)[0].strip().lower()
    if raw_content_type in ALLOWED_IMAGE_MIME_TYPES:
        return raw_content_type, ALLOWED_IMAGE_MIME_TYPES[raw_content_type]

    filename = secure_filename(uploaded_file.filename or "")
    if "." in filename:
        extension = filename.rsplit(".", 1)[1].lower()
        if extension in ALLOWED_IMAGE_EXTENSIONS:
            return ALLOWED_IMAGE_EXTENSIONS[extension], "jpg" if extension == "jpeg" else extension

    raise ValueError("File must be a PNG, JPEG, GIF, or WEBP image")


def _read_validated_image(*field_names):
    uploaded_file = _get_image_upload(*field_names)
    max_image_size_bytes = Config.MAX_IMAGE_UPLOAD_BYTES
    content_type, extension = _normalize_image_type(uploaded_file)
    uploaded_file.stream.seek(0)
    file_bytes = uploaded_file.read(max_image_size_bytes + 1)
    if not file_bytes:
        raise ValueError("Image file is empty")
    if len(file_bytes) > max_image_size_bytes:
        raise ValueError(f"Image file must be smaller than {_format_size_limit(max_image_size_bytes)}")
    return file_bytes, content_type, extension


def _delete_previous_image(public_url, context):
    if not public_url:
        return
    try:
        delete_public_file_from_url(public_url)
    except Exception as exc:
        logger.warning("Failed to delete previous image", extra={"context": context, "error": str(exc)})

@bp.route("/", methods=["GET"])
@require_auth
def get_groups_route():
    # Get all groups the user is a member of
    user_id = g.user["sub"]
    try:
        groups = get_user_groups(user_id)
    except Exception as e:
        logger.warning("Failed to fetch groups", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 400
    return jsonify(groups), 200


@bp.route("/create", methods=["POST"])
@require_auth
def create_group_route():
    # Create a new group; user becomes owner
    user_id = g.user["sub"]
    try:
        # accept joinable flag from client (default True)
        data = request.get_json(silent=True) or {}
        joinable = data["joinable"] if "joinable" in data else None
        group_icon_url = data["group_icon_url"] if "group_icon_url" in data else None
        if joinable is None:
            joinable = True
        create_group(
            user_id,
            data["groupName"] if "groupName" in data else None,
            data["description"] if "description" in data else None,
            joinable,
            group_icon_url,
        )
    except Exception as e:
        logger.warning("Failed to create group", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 400
    return jsonify({"status": "Group created successfully"}), 201


@bp.route("/join", methods=["POST"])
@require_auth
def join_group_route():
    # Join a group using a join code
    user_id = g.user["sub"]
    data = request.get_json(silent=True) or {}
    join_code = data["join_code"] if "join_code" in data else None

    try:
        result = join_group(user_id, join_code)
    except Exception as e:
        logger.warning("Failed to join group", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 400
    return jsonify({
        "status": "User is already a member" if result["already_member"] else "Group joined successfully",
        "group_id": result["group_id"],
        "already_member": result["already_member"],
    }), 200


@bp.route("/join", methods=["GET"])
def reject_get_join_group_route():
    return jsonify({"error": "Method not allowed. Use POST to join a group."}), 405, {"Allow": "POST"}


@bp.route("/leave", methods=["POST"])
@require_auth
def leave_group_route():
    # Remove user from a group
    user_id = g.user["sub"]
    data = request.get_json(silent=True) or {}
    group_id = data["group_id"] if "group_id" in data else None

    try:
        leave_group(user_id, group_id)
    except Exception as e:
        logger.warning("Failed to leave group", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 400
    return jsonify({"status": "Left group successfully"}), 200


@bp.route("/<group_id>", methods=["GET"])
@require_auth
def get_group_details_route(group_id):
    user_id = g.user["sub"]
    try:
        group = get_group_details(user_id, group_id)
    except ValueError as e:
        logger.warning("Failed to fetch group details", extra={"error": str(e), "group_id": group_id})
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.exception("Error getting group details", extra={"error": str(e), "group_id": group_id})
        return jsonify({"error": "Failed to retrieve group details"}), 500
    return jsonify(group), 200


@bp.route("/<group_id>", methods=["PATCH"])
@require_auth
def update_group_info(group_id):
    # Change a group's joinable status (admin/owner only)
    admin_id = g.user["sub"]
    data = request.get_json(silent=True) or {}

    name = data["name"] if "name" in data else None
    description = data["description"] if "description" in data else None
    joinable = data["joinable"] if "joinable" in data else None
    group_icon_url = data["group_icon_url"] if "group_icon_url" in data else UNSET

    try:
        previous_icon_url = None
        if group_icon_url is not UNSET:
            previous_icon_url = get_group_details(admin_id, group_id).get("group_icon_url")
        change_group_info(admin_id, group_id, name, description, joinable, group_icon_url)
        if group_icon_url is not UNSET and previous_icon_url and previous_icon_url != group_icon_url:
            _delete_previous_image(previous_icon_url, "group_icon_update")
    except PermissionError as e:
        logger.warning("Permission denied updating group info", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 403
    except Exception as e:
        logger.warning("Failed to update group info", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 400
    return jsonify({"status": "Group info changed successfully"}), 200


@bp.route("/<group_id>/members", methods=["GET"])
@require_auth
def get_members_route(group_id):
    # Get all members in a group
    user_id = g.user["sub"]
    try:
        members = get_group_members(user_id, group_id)
    except PermissionError:
        logger.warning("Group members lookup denied", extra={"group_id": group_id, "error": GROUP_NOT_FOUND_ERROR})
        return jsonify({"error": GROUP_NOT_FOUND_ERROR}), 404
    except Exception as e:
        logger.warning("Failed to fetch group members", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 400
    return jsonify(members), 200


@bp.route("/<group_id>/kick", methods=["POST"])
@require_auth
def kick_member_route(group_id):
    # Remove a member from group (admin/owner only)
    # group_id comes from the URL path
    admin_id = g.user["sub"]
    data = request.get_json(silent=True) or {}
    member_id = data["member_id"] if "member_id" in data else None

    try:
        kick_member(admin_id, member_id, group_id)
    except PermissionError as e:
        logger.warning("Permission denied kicking group member", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 403
    except Exception as e:
        logger.warning("Failed to kick group member", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 400
    return jsonify({"status": "Member kicked successfully"}), 200


@bp.route("/<group_id>/change-role", methods=["POST"])
@require_auth
def change_role_route(group_id):
    # Change a member's role (admin/owner only)
    admin_id = g.user["sub"]
    data = request.get_json(silent=True) or {}
    member_id = data["member_id"] if "member_id" in data else None
    new_role = data["new_role"] if "new_role" in data else None

    try:
        change_group_role(admin_id, member_id, group_id, new_role)
    except PermissionError as e:
        logger.warning("Permission denied changing member role", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 403
    except Exception as e:
        logger.warning("Failed to change group role", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 400
    return jsonify({"status": "Role changed successfully"}), 200


@bp.route("/join/<join_code>", methods=["POST"])
@require_auth
def join_group_by_url_route(join_code):
    # Join a group using a join code
    user_id = g.user["sub"]

    try:
        result = join_group(user_id, join_code)
    except Exception as e:
        logger.warning("Failed to join group by URL", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 400
    return jsonify({
        "status": "User is already a member" if result["already_member"] else "Group joined successfully",
        "group_id": result["group_id"],
        "already_member": result["already_member"],
    }), 200


@bp.route("/<group_id>/icon", methods=["POST"])
@require_auth
def upload_group_icon_route(group_id):
    admin_id = g.user["sub"]

    try:
        file_bytes, content_type, extension = _read_validated_image("image", "icon")
        previous_icon_url = get_group_details(admin_id, group_id).get("group_icon_url")
        object_path = f"groups/{group_id}/{uuid4().hex}.{extension}"
        public_url = upload_public_file(object_path, file_bytes, content_type)
        change_group_info(admin_id, group_id, None, None, None, public_url)
        if previous_icon_url and previous_icon_url != public_url:
            _delete_previous_image(previous_icon_url, "group_icon_upload")
    except PermissionError as e:
        logger.warning("Permission denied uploading group icon", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        logger.warning("Invalid group icon upload", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.exception("Failed to upload group icon", extra={"error": str(e)})
        return jsonify({"error": "Failed to upload group icon"}), 500

    return jsonify({"group_icon_url": public_url}), 200
