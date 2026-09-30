from functools import wraps

import jwt
from flask import g, jsonify, request
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError, PyJWKClientError, PyJWTError

from app.config import Config
from app.utils.logger import get_logger

logger = get_logger(__name__)

jwks_client = None


def _get_jwks_client():
    global jwks_client
    if jwks_client is None:
        if not Config.JWKS_URL:
            raise InvalidTokenError("JWT verification is not configured")
        jwks_client = PyJWKClient(Config.JWKS_URL)
    return jwks_client

def verify_supabase_jwt(token: str):
    try:
        algorithm = jwt.get_unverified_header(token).get("alg")
    except PyJWTError as exc:
        raise InvalidTokenError("Malformed token header") from exc

    decode_options = {"require": ["exp", "iat", "sub", "aud", "iss"]}
    if algorithm == "HS256":
        if not Config.SUPABASE_JWT_SECRET:
            raise InvalidTokenError("HS256 JWT verification is not configured")
        return jwt.decode(
            token,
            Config.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience=Config.SUPABASE_JWT_AUDIENCE,
            issuer=Config.SUPABASE_JWT_ISSUER,
            options=decode_options,
            leeway=5,
        )

    if algorithm != "ES256":
        raise InvalidTokenError("Unsupported JWT signing algorithm")

    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token).key
    except PyJWKClientError as exc:
        raise InvalidTokenError(f"Unable to resolve signing key for token: {exc}") from exc

    decoded = jwt.decode(
        token,
        signing_key,
        algorithms=["ES256"],
        audience=Config.SUPABASE_JWT_AUDIENCE,
        issuer=Config.SUPABASE_JWT_ISSUER,
        options=decode_options,
        leeway=5,
    )
    return decoded

def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ", 1)[1]
        try:
            claims = verify_supabase_jwt(token)
        except InvalidTokenError as exc:
            logger.warning(
                "Auth verification failed",
                extra={"error": str(exc)},
            )
            return jsonify({"error": "Unauthorized"}), 401

        g.user = claims
        return f(*args, **kwargs)

    return wrapper
