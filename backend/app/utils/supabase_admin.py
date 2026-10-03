from typing import Union
from urllib.parse import quote, unquote, urlparse

from httpx import Client as HttpxClient
from httpx import Timeout
from supabase import create_client
from supabase.lib.client_options import SyncClientOptions

from app.config import Config

_supabase_admin_client = None
DEFAULT_STORAGE_BUCKET = "images"


def get_supabase_admin_client():
    global _supabase_admin_client

    if _supabase_admin_client is None:
        if not Config.SUPABASE_URL or not Config.SUPABASE_SECRET_KEY:
            raise RuntimeError("Supabase admin client is not configured")

        http_client = HttpxClient(
            timeout=Timeout(Config.SUPABASE_HTTP_TIMEOUT_SECONDS),
            follow_redirects=True,
            http2=True,
        )
        _supabase_admin_client = create_client(
            Config.SUPABASE_URL,
            Config.SUPABASE_SECRET_KEY,
            options=SyncClientOptions(httpx_client=http_client),
        )

    return _supabase_admin_client


def upload_public_file(
    object_path: str,
    file_data: Union[bytes, bytearray],
    content_type: str,
    bucket_name: str = DEFAULT_STORAGE_BUCKET,
) -> str:
    if not object_path:
        raise ValueError("object_path is required")
    if not file_data:
        raise ValueError("file_data is required")
    if not content_type:
        raise ValueError("content_type is required")

    bucket = get_supabase_admin_client().storage.from_(bucket_name)
    bucket.upload(
        object_path,
        bytes(file_data),
        file_options={
            "content-type": content_type,
            "cache-control": "3600",
            "upsert": "false",
        },
    )
    return (
        f"{Config.SUPABASE_PUBLIC_URL.rstrip('/')}"
        f"/storage/v1/object/public/{quote(bucket_name, safe='')}/{quote(object_path, safe='/')}"
    )


def upload_private_file(
    object_path: str,
    file_data: Union[bytes, bytearray],
    content_type: str,
    bucket_name: str,
) -> None:
    if not object_path:
        raise ValueError("object_path is required")
    if not file_data:
        raise ValueError("file_data is required")
    if not content_type:
        raise ValueError("content_type is required")
    if not bucket_name:
        raise ValueError("bucket_name is required")

    bucket = get_supabase_admin_client().storage.from_(bucket_name)
    bucket.upload(
        object_path,
        bytes(file_data),
        file_options={
            "content-type": content_type,
            "cache-control": "3600",
            "upsert": "true",
        },
    )


def download_private_file(object_path: str, bucket_name: str) -> bytes:
    if not object_path:
        raise ValueError("object_path is required")
    if not bucket_name:
        raise ValueError("bucket_name is required")

    bucket = get_supabase_admin_client().storage.from_(bucket_name)
    return bucket.download(object_path)


def delete_file(object_path: str, bucket_name: str) -> None:
    if not object_path or not bucket_name:
        return
    bucket = get_supabase_admin_client().storage.from_(bucket_name)
    bucket.remove([object_path])


def get_public_file_object_path(public_url: str, bucket_name: str = DEFAULT_STORAGE_BUCKET) -> str | None:
    if (
        not isinstance(public_url, str)
        or not public_url
        or not bucket_name
        or any(ord(char) <= 32 or ord(char) == 127 for char in public_url)
    ):
        return None

    try:
        parsed = urlparse(public_url)
        base = urlparse(Config.SUPABASE_PUBLIC_URL.rstrip("/"))
        if (
            base.scheme not in ("http", "https")
            or not base.netloc
            or parsed.scheme != base.scheme
            or parsed.netloc != base.netloc
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
        ):
            return None
    except (TypeError, ValueError):
        return None

    marker = f"{base.path}/storage/v1/object/public/{quote(bucket_name, safe='')}/"
    if not parsed.path.startswith(marker):
        return None

    encoded_path = parsed.path[len(marker):]
    object_path = unquote(encoded_path)
    if (
        not object_path
        or any(part in ("", ".", "..") for part in object_path.split("/"))
        or any(char in object_path for char in ("\\", "%"))
        or any(ord(char) < 32 or ord(char) == 127 for char in object_path)
        or quote(object_path, safe="/") != encoded_path
    ):
        return None
    return object_path


def delete_public_file_from_url(
    public_url: str,
    bucket_name: str = DEFAULT_STORAGE_BUCKET,
    *,
    expected_prefix: str,
) -> None:
    """Delete only canonical URLs inside the caller's server-controlled folder."""
    object_path = get_public_file_object_path(public_url, bucket_name)
    if expected_prefix and expected_prefix.endswith("/") and object_path and object_path.startswith(expected_prefix):
        delete_file(object_path, bucket_name)
