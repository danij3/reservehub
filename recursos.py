# recursos.py - CRUD de recursos. Lectura pública; escritura y borrado solo para admin.
import os
from uuid import uuid4

from flask import Blueprint, request, jsonify, g
from werkzeug.utils import secure_filename

from db import query_db
from auth import admin_required, login_required

recursos_bp = Blueprint('recursos', __name__)

# consulta base con JOIN para incluir el nombre de la categoría

_SELECT = (
    'SELECT r.id, r.nombre, r.descripcion, r.disponible, r.capacidad, '
    '       r.categoria_id, c.nombre AS categoria, r.imagen, r.numero_sala '
    'FROM recursos r '
    'JOIN categorias c ON r.categoria_id = c.id '
)

# carpeta donde viven las imágenes de las salas (misma que sirve app.py en /imgs/)
_IMGS_DIR = os.path.join(os.path.dirname(__file__), 'imgs')
_IMAGEN_POR_DEFECTO = '2.jpg'
_EXTENSIONES_PERMITIDAS = {'jpg', 'jpeg', 'png', 'gif', 'webp'}


def _extension_permitida(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in _EXTENSIONES_PERMITIDAS


def _guardar_imagen(file_obj):
    """Guarda la imagen subida (si la hay) en /imgs con un nombre único y seguro.

    Devuelve el nombre de archivo a guardar en BD. Si no se proporcionó archivo,
    devuelve la imagen por defecto. Devuelve None si el archivo no tiene una
    extensión de imagen permitida (el caller debe tratarlo como error 400).
    """
    if not file_obj or not file_obj.filename:
        return _IMAGEN_POR_DEFECTO

    filename = secure_filename(file_obj.filename)
    if not filename or not _extension_permitida(filename):
        return None

    ext = filename.rsplit('.', 1)[1].lower()
    nombre_final = f'{uuid4().hex}.{ext}'
    file_obj.save(os.path.join(_IMGS_DIR, nombre_final))
    return nombre_final


def _parse_bool(value, default):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ('1', 'true', 'on', 'yes')


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
    # Acepta multipart/form-data (cuando se sube una imagen desde el panel
    # admin) o JSON (uso programático/API). En ambos casos los campos se
    # leen igual gracias a que request.form también soporta .get().
    is_multipart = 'multipart/form-data' in (request.content_type or '')
    data        = request.form if is_multipart else (request.get_json(silent=True) or {})
    imagen_file = request.files.get('imagen') if is_multipart else None

    nombre       = str(data.get('nombre',      '')).strip()
    descripcion  = str(data.get('descripcion', '')).strip()
    numero_sala  = str(data.get('numero_sala', '')).strip()
    disponible   = _parse_bool(data.get('disponible'), True)
    categoria_id = data.get('categoria_id')

    try:
        capacidad = int(data.get('capacidad', 1))
    except (TypeError, ValueError):
        return jsonify({'error': 'capacidad debe ser un número'}), 400

    if not nombre or not categoria_id or not numero_sala:
        return jsonify({'error': 'nombre, categoria_id y numero_sala son obligatorios'}), 400

    try:
        categoria_id = int(categoria_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'categoria_id no válido'}), 400

    if not query_db('SELECT id FROM categorias WHERE id=%s', (categoria_id,), one=True):
        return jsonify({'error': 'Categoría no encontrada'}), 400

    imagen = _guardar_imagen(imagen_file)
    if imagen is None:
        return jsonify({
            'error': 'Formato de imagen no permitido (usa jpg, jpeg, png, gif o webp)'
        }), 400

    new_id = query_db(
        'INSERT INTO recursos '
        '(nombre, descripcion, disponible, capacidad, categoria_id, imagen, numero_sala) '
        'VALUES (%s, %s, %s, %s, %s, %s, %s)',
        (nombre, descripcion, disponible, capacidad, categoria_id, imagen, numero_sala)
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

    is_multipart = 'multipart/form-data' in (request.content_type or '')
    data        = request.form if is_multipart else (request.get_json(silent=True) or {})
    imagen_file = request.files.get('imagen') if is_multipart else None

    nombre       = str(data.get('nombre',       row['nombre'])).strip()
    descripcion  = str(data.get('descripcion',  row['descripcion'] or '')).strip()
    numero_sala  = str(data.get('numero_sala',  row['numero_sala'] or '')).strip()
    disponible   = _parse_bool(data.get('disponible'), row['disponible'])
    categoria_id = data.get('categoria_id', row['categoria_id'])

    try:
        capacidad = int(data.get('capacidad', row['capacidad']))
    except (TypeError, ValueError):
        return jsonify({'error': 'capacidad debe ser un número'}), 400

    if not nombre:
        return jsonify({'error': 'nombre es obligatorio'}), 400

    try:
        categoria_id = int(categoria_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'categoria_id no válido'}), 400

    if not query_db('SELECT id FROM categorias WHERE id=%s', (categoria_id,), one=True):
        return jsonify({'error': 'Categoría no encontrada'}), 400

    imagen = row['imagen']
    if imagen_file and imagen_file.filename:
        nuevo_nombre = _guardar_imagen(imagen_file)
        if nuevo_nombre is None:
            return jsonify({
                'error': 'Formato de imagen no permitido (usa jpg, jpeg, png, gif o webp)'
            }), 400
        imagen = nuevo_nombre

    query_db(
        'UPDATE recursos SET nombre=%s, descripcion=%s, disponible=%s, '
        'capacidad=%s, categoria_id=%s, imagen=%s, numero_sala=%s WHERE id=%s',
        (nombre, descripcion, disponible, capacidad, categoria_id, imagen, numero_sala, rid)
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
