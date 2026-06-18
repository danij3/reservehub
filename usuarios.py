# usuarios.py - CRUD de usuarios. Admin tiene acceso total; cada usuario puede editar su propio perfil.
from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash

from db import query_db
from auth import login_required, admin_required, get_current_user

usuarios_bp = Blueprint('usuarios', __name__)


def _own_or_admin(user_id):
    """Devuelve (user, error_response). user es None si no autenticado."""
    current = get_current_user()
    if not current:
        return None, (jsonify({'error': 'Token ausente o expirado'}), 401)
    if current['rol'] != 'admin' and current['id'] != user_id:
        return None, (jsonify({'error': 'Acceso denegado'}), 403)
    return current, None


# lista todos los usuarios (solo admin)

@usuarios_bp.route('', methods=['GET'])
@admin_required
def list_usuarios():
    rows = query_db(
        'SELECT id, nombre, email, rol FROM usuarios ORDER BY id'
    )
    return jsonify(rows), 200


# devuelve un usuario por id

@usuarios_bp.route('/<int:uid>', methods=['GET'])
def get_usuario(uid):
    _, err = _own_or_admin(uid)
    if err:
        return err
    row = query_db(
        'SELECT id, nombre, email, rol FROM usuarios WHERE id = %s',
        (uid,), one=True
    )
    if not row:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    return jsonify(row), 200


# actualiza nombre, email o contraseña de un usuario

@usuarios_bp.route('/<int:uid>', methods=['PUT'])
def update_usuario(uid):
    current, err = _own_or_admin(uid)
    if err:
        return err

    row = query_db('SELECT * FROM usuarios WHERE id = %s', (uid,), one=True)
    if not row:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    data    = request.get_json(silent=True) or {}
    nombre  = str(data.get('nombre',   row['nombre'])).strip()
    email   = str(data.get('email',    row['email'])).strip().lower()
    new_pass = data.get('password')

    if not nombre or not email:
        return jsonify({'error': 'nombre y email son obligatorios'}), 400

    # Comprobar unicidad del email si cambia
    dup = query_db(
        'SELECT id FROM usuarios WHERE email = %s AND id != %s', (email, uid), one=True
    )
    if dup:
        return jsonify({'error': 'El email ya está en uso'}), 409

    if new_pass:
        hashed = generate_password_hash(new_pass)
        query_db(
            'UPDATE usuarios SET nombre=%s, email=%s, password=%s WHERE id=%s',
            (nombre, email, hashed, uid)
        )
    else:
        query_db(
            'UPDATE usuarios SET nombre=%s, email=%s WHERE id=%s',
            (nombre, email, uid)
        )

    updated = query_db(
        'SELECT id, nombre, email, rol FROM usuarios WHERE id = %s',
        (uid,), one=True
    )
    return jsonify(updated), 200


# elimina un usuario (solo admin)
# Protecciones: un admin no puede borrarse a sí mismo (evita que se quede sin
# acceso a su propia gestión a media operación) ni borrar al último admin
# restante (evitaría que el sistema se quede sin ningún administrador).

@usuarios_bp.route('/<int:uid>', methods=['DELETE'])
@admin_required
def delete_usuario(uid):
    row = query_db('SELECT id, rol FROM usuarios WHERE id = %s', (uid,), one=True)
    if not row:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    current = get_current_user()
    if current and current['id'] == uid:
        return jsonify({'error': 'No puedes eliminar tu propia cuenta'}), 403

    if row['rol'] == 'admin':
        total_admins = query_db(
            "SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin'", one=True
        )['n']
        if total_admins <= 1:
            return jsonify({'error': 'No se puede eliminar al único administrador'}), 409

    query_db('DELETE FROM usuarios WHERE id = %s', (uid,))
    return jsonify({'message': 'Usuario eliminado'}), 200


# cambia el rol de un usuario (solo admin)

@usuarios_bp.route('/<int:uid>/rol', methods=['PATCH'])
@admin_required
def change_rol(uid):
    row = query_db('SELECT id, rol FROM usuarios WHERE id = %s', (uid,), one=True)
    if not row:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    data = request.get_json(silent=True) or {}
    new_rol = str(data.get('rol', '')).strip()

    if new_rol not in ('user', 'admin'):
        return jsonify({'error': 'rol debe ser "user" o "admin"'}), 400

    query_db('UPDATE usuarios SET rol = %s WHERE id = %s', (new_rol, uid))
    return jsonify({'id': uid, 'rol': new_rol}), 200
