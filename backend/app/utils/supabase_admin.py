from typing import Union
from urllib.parse import unquote, urlparse

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
    public_url = bucket.get_public_url(object_path)
    if not public_url:
        raise RuntimeError("Failed to generate public URL for uploaded file")
    return public_url


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
    if not public_url or not bucket_name:
        return None

    parsed = urlparse(public_url)
    path = unquote(parsed.path or "")
    marker = f"/storage/v1/object/public/{bucket_name}/"
    if marker not in path:
        return None

    object_path = path.split(marker, 1)[1].strip("/")
    return object_path or None


def delete_public_file_from_url(public_url: str, bucket_name: str = DEFAULT_STORAGE_BUCKET) -> None:
    object_path = get_public_file_object_path(public_url, bucket_name)
    if object_path:
        delete_file(object_path, bucket_name)
