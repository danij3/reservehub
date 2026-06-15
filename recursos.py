# recursos.py - CRUD de recursos. Lectura pública; escritura y borrado solo para admin.
from flask import Blueprint, request, jsonify, g

from db import query_db
from auth import admin_required, login_required

recursos_bp = Blueprint('recursos', __name__)

# consulta base con JOIN para incluir el nombre de la categoría

_SELECT = (
    'SELECT r.id, r.nombre, r.descripcion, r.disponible, r.capacidad, '
    '       r.categoria_id, c.nombre AS categoria '
    'FROM recursos r '
    'JOIN categorias c ON r.categoria_id = c.id '
)


# devuelve la lista de recursos, con filtros opcionales por categoría y disponibilidad

@recursos_bp.route('', methods=['GET'])
def list_recursos():
    conditions, params = [], []

    cat = request.args.get('categoria_id')
    if cat:
        conditions.append('r.categoria_id = %s')
        params.append(int(cat))

    disp = request.args.get('disponible')
    if disp is not None:
        conditions.append('r.disponible = %s')
        params.append(disp.lower() == 'true')

    sql = _SELECT
    if conditions:
        sql += 'WHERE ' + ' AND '.join(conditions)
    sql += ' ORDER BY r.id'

    rows = query_db(sql, tuple(params))
    return jsonify({'data': rows, 'total': len(rows)}), 200


# devuelve un recurso por id

@recursos_bp.route('/<int:rid>', methods=['GET'])
def get_recurso(rid):
    row = query_db(_SELECT + 'WHERE r.id = %s', (rid,), one=True)
    if not row:
        return jsonify({'error': 'Recurso no encontrado'}), 404
    return jsonify(row), 200


# crea un nuevo recurso

@recursos_bp.route('', methods=['POST'])
@admin_required
def create_recurso():
    data = request.get_json(silent=True) or {}
    nombre       = str(data.get('nombre',       '')).strip()
    descripcion  = str(data.get('descripcion',  '')).strip()
    disponible   = bool(data.get('disponible',  True))
    capacidad    = int(data.get('capacidad',    1))
    categoria_id = data.get('categoria_id')

    if not nombre or not categoria_id:
        return jsonify({'error': 'nombre y categoria_id son obligatorios'}), 400

    if not query_db('SELECT id FROM categorias WHERE id=%s', (categoria_id,), one=True):
        return jsonify({'error': 'Categoría no encontrada'}), 400

    new_id = query_db(
        'INSERT INTO recursos (nombre, descripcion, disponible, capacidad, categoria_id) '
        'VALUES (%s, %s, %s, %s, %s)',
        (nombre, descripcion, disponible, capacidad, categoria_id)
    )
    row = query_db(_SELECT + 'WHERE r.id = %s', (new_id,), one=True)
    return jsonify(row), 201


# actualiza los datos de un recurso

@recursos_bp.route('/<int:rid>', methods=['PUT'])
@admin_required
def update_recurso(rid):
    row = query_db('SELECT * FROM recursos WHERE id = %s', (rid,), one=True)
    if not row:
        return jsonify({'error': 'Recurso no encontrado'}), 404

    data = request.get_json(silent=True) or {}
    nombre       = str(data.get('nombre',       row['nombre'])).strip()
    descripcion  = str(data.get('descripcion',  row['descripcion'] or '')).strip()
    disponible   = bool(data.get('disponible',  row['disponible']))
    capacidad    = int(data.get('capacidad',    row['capacidad']))
    categoria_id = data.get('categoria_id', row['categoria_id'])

    if not nombre:
        return jsonify({'error': 'nombre es obligatorio'}), 400

    if not query_db('SELECT id FROM categorias WHERE id=%s', (categoria_id,), one=True):
        return jsonify({'error': 'Categoría no encontrada'}), 400

    query_db(
        'UPDATE recursos SET nombre=%s, descripcion=%s, disponible=%s, '
        'capacidad=%s, categoria_id=%s WHERE id=%s',
        (nombre, descripcion, disponible, capacidad, categoria_id, rid)
    )
    updated = query_db(_SELECT + 'WHERE r.id = %s', (rid,), one=True)
    return jsonify(updated), 200


# borra un recurso

@recursos_bp.route('/<int:rid>', methods=['DELETE'])
@admin_required
def delete_recurso(rid):
    if not query_db('SELECT id FROM recursos WHERE id=%s', (rid,), one=True):
        return jsonify({'error': 'Recurso no encontrado'}), 404
    query_db('DELETE FROM recursos WHERE id = %s', (rid,))
    return jsonify({'message': 'Recurso eliminado'}), 200


# activa o desactiva la disponibilidad de un recurso

@recursos_bp.route('/<int:rid>/disponible', methods=['PATCH'])
@admin_required
def patch_disponible(rid):
    if not query_db('SELECT id FROM recursos WHERE id=%s', (rid,), one=True):
        return jsonify({'error': 'Recurso no encontrado'}), 404

    data = request.get_json(silent=True) or {}
    if 'disponible' not in data:
        return jsonify({'error': 'Campo disponible requerido'}), 400

    disponible = bool(data['disponible'])
    query_db('UPDATE recursos SET disponible=%s WHERE id=%s', (disponible, rid))
    updated = query_db(_SELECT + 'WHERE r.id = %s', (rid,), one=True)
    return jsonify(updated), 200


# devuelve los horarios ocupados de un recurso en una fecha concreta

@recursos_bp.route('/<int:rid>/disponibilidad', methods=['GET'])
@login_required
def get_disponibilidad(rid):
    if not query_db('SELECT id FROM recursos WHERE id=%s', (rid,), one=True):
        return jsonify({'error': 'Recurso no encontrado'}), 404

    fecha = request.args.get('fecha')
    if not fecha:
        return jsonify({'error': 'Parámetro fecha requerido (YYYY-MM-DD)'}), 400

    reservas = query_db(
        'SELECT hora_inicio, hora_fin FROM reservas '
        'WHERE recurso_id=%s AND fecha_reserva=%s AND estado != "cancelada"',
        (rid, fecha)
    )
    return jsonify({
        'recurso_id':     rid,
        'fecha':          fecha,
        'franjas_ocupadas': [
            {'hora_inicio': r['hora_inicio'], 'hora_fin': r['hora_fin']}
            for r in reservas
        ]
    }), 200
