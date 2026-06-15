# categorias.py - Gestión de categorías. Cualquiera puede leerlas; solo admin puede crearlas, editarlas o borrarlas.
from flask import Blueprint, request, jsonify

from db import query_db
from auth import admin_required

categorias_bp = Blueprint('categorias', __name__)


@categorias_bp.route('', methods=['GET'])
def list_categorias():
    rows = query_db('SELECT id, nombre, descripcion FROM categorias ORDER BY nombre')
    return jsonify(rows), 200


@categorias_bp.route('/<int:cid>', methods=['GET'])
def get_categoria(cid):
    row = query_db(
        'SELECT id, nombre, descripcion FROM categorias WHERE id = %s', (cid,), one=True
    )
    if not row:
        return jsonify({'error': 'Categoría no encontrada'}), 404
    return jsonify(row), 200


@categorias_bp.route('', methods=['POST'])
@admin_required
def create_categoria():
    data = request.get_json(silent=True) or {}
    nombre      = str(data.get('nombre',      '')).strip()
    descripcion = str(data.get('descripcion', '')).strip()

    if not nombre:
        return jsonify({'error': 'El campo nombre es obligatorio'}), 400

    new_id = query_db(
        'INSERT INTO categorias (nombre, descripcion) VALUES (%s, %s)',
        (nombre, descripcion)
    )
    created = query_db(
        'SELECT id, nombre, descripcion FROM categorias WHERE id = %s',
        (new_id,), one=True
    )
    return jsonify(created), 201


@categorias_bp.route('/<int:cid>', methods=['PUT'])
@admin_required
def update_categoria(cid):
    row = query_db('SELECT * FROM categorias WHERE id = %s', (cid,), one=True)
    if not row:
        return jsonify({'error': 'Categoría no encontrada'}), 404

    data = request.get_json(silent=True) or {}
    nombre      = str(data.get('nombre',      row['nombre'])).strip()
    descripcion = str(data.get('descripcion', row['descripcion'] or '')).strip()

    if not nombre:
        return jsonify({'error': 'El campo nombre es obligatorio'}), 400

    query_db(
        'UPDATE categorias SET nombre=%s, descripcion=%s WHERE id=%s',
        (nombre, descripcion, cid)
    )
    updated = query_db(
        'SELECT id, nombre, descripcion FROM categorias WHERE id = %s', (cid,), one=True
    )
    return jsonify(updated), 200


@categorias_bp.route('/<int:cid>', methods=['DELETE'])
@admin_required
def delete_categoria(cid):
    if not query_db('SELECT id FROM categorias WHERE id = %s', (cid,), one=True):
        return jsonify({'error': 'Categoría no encontrada'}), 404

    # Comprobar que no haya recursos asociados
    if query_db('SELECT id FROM recursos WHERE categoria_id = %s LIMIT 1', (cid,), one=True):
        return jsonify({'error': 'No se puede eliminar: hay recursos en esta categoría'}), 409

    query_db('DELETE FROM categorias WHERE id = %s', (cid,))
    return jsonify({'message': 'Categoría eliminada'}), 200
