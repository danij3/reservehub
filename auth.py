# auth.py - Login, registro y logout. Los tokens se guardan en la tabla sesiones.
import re
import secrets
import functools
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash

from db import query_db

auth_bp = Blueprint('auth', __name__)

TOKEN_EXPIRY_HOURS = 24


# helpers de autenticación

def get_token_from_header():
    header = request.headers.get('Authorization', '')
    if header.startswith('Bearer '):
        return header[7:].strip()
    return None


def get_current_user():
    """Devuelve el dict del usuario si el token es válido, o None."""
    token = get_token_from_header()
    if not token:
        return None
    now = datetime.utcnow()
    row = query_db(
        'SELECT u.id, u.nombre, u.email, u.rol '
        'FROM sesiones s JOIN usuarios u ON s.usuario_id = u.id '
        'WHERE s.token = %s AND s.fecha_expiration > %s',
        (token, now), one=True
    )
    return row  # None si no hay sesión válida


def login_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Token ausente o expirado'}), 401
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Token ausente o expirado'}), 401
        if user['rol'] != 'admin':
            return jsonify({'error': 'Rol insuficiente para esta acción'}), 403
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


# endpoints

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}

    nombre   = str(data.get('nombre',   '')).strip()
    email    = str(data.get('email',    '')).strip().lower()
    password = str(data.get('password', ''))

    if not nombre or not email or not password:
        return jsonify({'error': 'nombre, email y password son obligatorios'}), 400

    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        return jsonify({'error': 'Formato de email inválido'}), 400

    if len(password) < 6:
        return jsonify({'error': 'La contraseña debe tener al menos 6 caracteres'}), 400

    if query_db('SELECT id FROM usuarios WHERE email = %s', (email,), one=True):
        return jsonify({'error': 'El email ya está registrado'}), 409

    hashed = generate_password_hash(password, method='pbkdf2:sha256')
    query_db(
        'INSERT INTO usuarios (nombre, email, password, rol) VALUES (%s, %s, %s, %s)',
        (nombre, email, hashed, 'user')
    )
    return jsonify({'message': 'Usuario registrado correctamente'}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}

    email    = str(data.get('email',    '')).strip().lower()
    password = str(data.get('password', ''))

    if not email or not password:
        return jsonify({'error': 'email y password son obligatorios'}), 400

    user = query_db('SELECT * FROM usuarios WHERE email = %s', (email,), one=True)
    if not user or not check_password_hash(user['password'], password):
        return jsonify({'error': 'Credenciales incorrectas'}), 401

    token  = secrets.token_urlsafe(32)
    expiry = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS)
    query_db(
        'INSERT INTO sesiones (usuario_id, token, fecha_expiration) VALUES (%s, %s, %s)',
        (user['id'], token, expiry)
    )

    return jsonify({
        'token': token,
        'usuario': {
            'id':     user['id'],
            'nombre': user['nombre'],
            'rol':    user['rol'],
        }
    }), 200


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    token = get_token_from_header()
    query_db('DELETE FROM sesiones WHERE token = %s', (token,))
    return jsonify({'message': 'Sesión cerrada correctamente'}), 200


@auth_bp.route('/me', methods=['GET'])
@login_required
def me():
    u = g.current_user
    return jsonify({'id': u['id'], 'nombre': u['nombre'],
                    'email': u['email'], 'rol': u['rol']}), 200
