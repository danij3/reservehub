# reservas.py - Gestión de reservas. Usuarios pueden crear y cancelar las suyas; admin tiene acceso total.
from flask import Blueprint, request, jsonify, g

from db import query_db
from auth import login_required, admin_required, get_current_user

reservas_bp = Blueprint('reservas', __name__)

_SELECT = (
    'SELECT rv.id, rv.usuario_id, rv.recurso_id, rv.fecha_reserva, '
    '       rv.hora_inicio, rv.hora_fin, rv.estado, rv.fecha_creacion, '
    '       u.nombre AS usuario_nombre, '
    '       r.nombre AS recurso_nombre '
    'FROM reservas rv '
    'JOIN usuarios u ON rv.usuario_id  = u.id '
    'JOIN recursos r ON rv.recurso_id = r.id '
)


# admin ve todas las reservas; usuario normal solo ve las suyas

@reservas_bp.route('', methods=['GET'])
@login_required
def list_reservas():
    u = g.current_user
    if u['rol'] == 'admin':
        rows = query_db(_SELECT + 'ORDER BY rv.fecha_reserva DESC, rv.hora_inicio')
    else:
        rows = query_db(
            _SELECT + 'WHERE rv.usuario_id=%s ORDER BY rv.fecha_reserva DESC, rv.hora_inicio',
            (u['id'],)
        )
    return jsonify(rows), 200


# devuelve solo las reservas del usuario autenticado

@reservas_bp.route('/mis-reservas', methods=['GET'])
@login_required
def mis_reservas():
    u = g.current_user
    rows = query_db(
        _SELECT + 'WHERE rv.usuario_id=%s ORDER BY rv.fecha_reserva DESC, rv.hora_inicio',
        (u['id'],)
    )
    return jsonify(rows), 200


# devuelve una reserva por id

@reservas_bp.route('/<int:rid>', methods=['GET'])
@login_required
def get_reserva(rid):
    u   = g.current_user
    row = query_db(_SELECT + 'WHERE rv.id=%s', (rid,), one=True)
    if not row:
        return jsonify({'error': 'Reserva no encontrada'}), 404
    if u['rol'] != 'admin' and row['usuario_id'] != u['id']:
        return jsonify({'error': 'Acceso denegado'}), 403
    return jsonify(row), 200


# crea una nueva reserva

@reservas_bp.route('', methods=['POST'])
@login_required
def create_reserva():
    u    = g.current_user
    data = request.get_json(silent=True) or {}

    recurso_id    = data.get('recurso_id')
    fecha_reserva = data.get('fecha_reserva')
    hora_inicio   = data.get('hora_inicio')
    hora_fin      = data.get('hora_fin')

    # comprobar campos obligatorios
    if not all([recurso_id, fecha_reserva, hora_inicio, hora_fin]):
        return jsonify({'error': 'recurso_id, fecha_reserva, hora_inicio y hora_fin son obligatorios'}), 400

    # Validar formato básico de hora
    import re
    if not re.match(r'^\d{2}:\d{2}$', hora_inicio) or not re.match(r'^\d{2}:\d{2}$', hora_fin):
        return jsonify({'error': 'Formato de hora inválido (HH:MM)'}), 400

    if hora_inicio >= hora_fin:
        return jsonify({'error': 'hora_fin debe ser posterior a hora_inicio'}), 400

    # Verificar existencia del recurso
    recurso = query_db('SELECT id, disponible FROM recursos WHERE id=%s', (recurso_id,), one=True)
    if not recurso:
        return jsonify({'error': 'Recurso no encontrado'}), 404

    # verificar que el recurso esté disponible para reservas
    if not recurso['disponible']:
        return jsonify({'error': 'El recurso no está disponible para reservas'}), 400

    # comprobar que no haya otra reserva en ese mismo horario
    solapamiento = query_db(
        'SELECT id FROM reservas '
        'WHERE recurso_id=%s AND fecha_reserva=%s AND estado != "cancelada" '
        'AND hora_inicio < %s AND hora_fin > %s',
        (recurso_id, fecha_reserva, hora_fin, hora_inicio),
        one=True
    )
    if solapamiento:
        return jsonify({'error': 'Ya existe una reserva en esa franja horaria (solapamiento)'}), 409

    new_id = query_db(
        'INSERT INTO reservas (usuario_id, recurso_id, fecha_reserva, hora_inicio, hora_fin, estado) '
        'VALUES (%s, %s, %s, %s, %s, %s)',
        (u['id'], recurso_id, fecha_reserva, hora_inicio, hora_fin, 'pendiente')
    )
    row = query_db(_SELECT + 'WHERE rv.id=%s', (new_id,), one=True)
    return jsonify(row), 201


# cambia el estado de una reserva (pendiente / confirmada / cancelada)

@reservas_bp.route('/<int:rid>/estado', methods=['PATCH'])
@login_required
def cambiar_estado(rid):
    u   = g.current_user
    row = query_db('SELECT * FROM reservas WHERE id=%s', (rid,), one=True)
    if not row:
        return jsonify({'error': 'Reserva no encontrada'}), 404

    # los usuarios solo pueden modificar sus propias reservas
    if u['rol'] != 'admin' and row['usuario_id'] != u['id']:
        return jsonify({'error': 'Acceso denegado'}), 403

    data        = request.get_json(silent=True) or {}
    nuevo_estado = str(data.get('estado', '')).strip()

    estados_validos = {'pendiente', 'confirmada', 'cancelada'}
    if nuevo_estado not in estados_validos:
        return jsonify({'error': f'Estado inválido. Valores permitidos: {", ".join(estados_validos)}'}), 400

    # un usuario normal no puede confirmar, solo cancelar
    if u['rol'] != 'admin' and nuevo_estado != 'cancelada':
        return jsonify({'error': 'Solo puedes cancelar tu propia reserva'}), 403

    query_db('UPDATE reservas SET estado=%s WHERE id=%s', (nuevo_estado, rid))
    updated = query_db(_SELECT + 'WHERE rv.id=%s', (rid,), one=True)
    return jsonify(updated), 200


# borra una reserva (solo admin)

@reservas_bp.route('/<int:rid>', methods=['DELETE'])
@admin_required
def delete_reserva(rid):
    if not query_db('SELECT id FROM reservas WHERE id=%s', (rid,), one=True):
        return jsonify({'error': 'Reserva no encontrada'}), 404
    query_db('DELETE FROM reservas WHERE id=%s', (rid,))
    return jsonify({'message': 'Reserva eliminada'}), 200
