from flask_cors import CORS
from psycopg2 import pool
from .config import Config

cors = CORS()

db_pool = None

def init_db_pool():
    global db_pool
    db_pool = pool.SimpleConnectionPool(
        minconn=1,
        maxconn=10,
        dsn=Config.DATABASE_URL,
        sslmode=Config.DB_SSLMODE
    )
    return db_pool
