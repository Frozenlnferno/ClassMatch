import math
from uuid import uuid4

from flask import Blueprint, request, jsonify, g
from app.config import Config
from app.utils.auth import require_auth
from app.utils.logger import get_logger
from werkzeug.utils import secure_filename

from app.utils.supabase_admin import delete_public_file_from_url, upload_public_file
from .users_service import (
    AccountDeletionUnavailableError,
    UNSET,
    delete_self_account,
    get_self_info,
    get_user_info,
    update_self_info,
)

bp = Blueprint("users", __name__)
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

@bp.route("/me", methods=["GET"])
@require_auth
def get_current_user_info():
    try:
        user_id = g.user["sub"]
        user_info = get_self_info(user_id)
    except Exception as e:
        logger.exception("Error getting self info", extra={"error": str(e)})
        return jsonify({"error": "Failed to retrieve self info"}), 500
    return jsonify(user_info)

@bp.route("/me", methods=["PATCH"])
@require_auth
def update_current_user_info():
    try:
        user_id = g.user["sub"]
        data = request.get_json(silent=True) or {}

        name = data["name"] if "name" in data else UNSET
        bio = data["bio"] if "bio" in data else UNSET
        avatar_url = data["avatar_url"] if "avatar_url" in data else UNSET
        previous_avatar_url = None
        if avatar_url is not UNSET:
            previous_avatar_url = get_self_info(user_id).get("avatar_url")
        update_self_info(user_id, name, bio, avatar_url)
        if avatar_url is not UNSET and previous_avatar_url and previous_avatar_url != avatar_url:
            _delete_previous_image(previous_avatar_url, "profile_avatar_update")
    except Exception as e:
        logger.exception("Error updating self info", extra={"error": str(e)})
        return jsonify({"error": "Failed to update self info"}), 500
    return jsonify({"status": "Successfully updated self info"}), 200


@bp.route("/me/avatar", methods=["POST"])
@require_auth
def upload_current_user_avatar():
    user_id = g.user["sub"]

    try:
        file_bytes, content_type, extension = _read_validated_image("image", "avatar")
        previous_avatar_url = get_self_info(user_id).get("avatar_url")
        object_path = f"avatars/{user_id}/{uuid4().hex}.{extension}"
        avatar_url = upload_public_file(object_path, file_bytes, content_type)
        update_self_info(user_id, avatar_url=avatar_url)
        if previous_avatar_url and previous_avatar_url != avatar_url:
            _delete_previous_image(previous_avatar_url, "profile_avatar_upload")
    except ValueError as e:
        logger.warning("Invalid avatar upload", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.exception("Error uploading avatar", extra={"error": str(e)})
        return jsonify({"error": "Failed to upload avatar"}), 500

    return jsonify({"avatar_url": avatar_url}), 200


@bp.route("/me", methods=["DELETE"])
@require_auth
def delete_current_user_account():
    try:
        user_id = g.user["sub"]
        delete_self_account(user_id)
    except AccountDeletionUnavailableError as e:
        logger.warning("Account deletion timed out upstream", extra={"error": str(e)})
        return jsonify({"error": "Account deletion timed out while contacting Supabase Auth. Please try again."}), 503
    except Exception as e:
        logger.exception("Error deleting self account", extra={"error": str(e)})
        return jsonify({"error": "Failed to delete account"}), 500
    return jsonify({"status": "Account deleted successfully"}), 200

@bp.route("/<user_id>", methods=["GET"])
@require_auth
def get_public_user_info(user_id):
    try:
        user_info = get_user_info(user_id)
    except Exception as e:
        logger.exception("Error getting user info", extra={"error": str(e)})
        return jsonify({"error": "Failed to retrieve user info"}), 500
    return jsonify(user_info)

