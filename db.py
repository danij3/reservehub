# db.py - Conexión a MySQL y función query_db para hacer consultas
import os
from datetime import timedelta, date, datetime

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

import mysql.connector
from flask import g


def _db_config():
    return {
        'host':     os.environ.get('DB_HOST', 'localhost'),
        'user':     os.environ.get('DB_USER', 'root'),
        'password': os.environ.get('DB_PASS', ''),
        'database': os.environ.get('DB_NAME', 'reservehub'),
        'charset':  'utf8mb4',
    }


def get_db():
    """Devuelve (y cachea en g) la conexión para la petición actual."""
    if 'db' not in g:
        g.db = mysql.connector.connect(**_db_config())
    else:
        # Reconectar si la conexión se cayó
        try:
            g.db.ping(reconnect=True, attempts=3, delay=1)
        except mysql.connector.Error:
            g.db = mysql.connector.connect(**_db_config())
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def _serialize(obj):
    """Convierte tipos MySQL no serializables por defecto."""
    if isinstance(obj, timedelta):
        total = int(obj.total_seconds())
        h, m = divmod(total // 60, 60)
        return f'{h:02d}:{m:02d}'
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    return obj


def _serialize_row(row):
    if row is None:
        return None
    return {k: _serialize(v) for k, v in row.items()}


def query_db(sql, args=(), one=False):
    """
    Ejecuta una sentencia SQL.
    - SELECT: devuelve lista de dicts (o dict si one=True).
    - INSERT/UPDATE/DELETE: hace commit y devuelve lastrowid (int).
    """
    db  = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute(sql, args)

    verb = sql.strip().upper()[:6]
    if verb == 'SELECT':
        rows = cur.fetchall()
        result = _serialize_row(rows[0]) if (one and rows) else \
                 None                    if (one and not rows) else \
                 [_serialize_row(r) for r in rows]
    else:
        db.commit()
        result = cur.lastrowid

    cur.close()
    return result
