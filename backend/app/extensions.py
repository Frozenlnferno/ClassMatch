from flask_cors import CORS
from psycopg2 import pool
from redis import Redis
from .config import Config

cors = CORS()

db_pool = None
redis_client = None

def init_db_pool():
    global db_pool
    db_pool = pool.SimpleConnectionPool(
        minconn=1,
        maxconn=10,
        dsn=Config.DATABASE_URL,
        sslmode=Config.DB_SSLMODE
    )
    return db_pool


def init_redis():
    global redis_client
    redis_client = Redis.from_url(Config.REDIS_URL, decode_responses=True)
    return redis_client
