"""sesiones.py - Blueprint /api/sesiones (admin)"""
from datetime import datetime
from flask import Blueprint, jsonify
from db import query_db
from auth import admin_required

sesiones_bp = Blueprint("sesiones", __name__)

@sesiones_bp.route("", methods=["GET"])
@admin_required
def list_sesiones():
    now = datetime.utcnow()
    rows = query_db(
        "SELECT s.id, s.token, s.fecha_expiration, s.created_at,"
        " u.id AS usuario_id, u.nombre, u.email"
        " FROM sesiones s JOIN usuarios u ON s.usuario_id = u.id"
        " WHERE s.fecha_expiration > %s ORDER BY s.fecha_expiration DESC",
        (now,)
    )
    return jsonify(rows), 200

@sesiones_bp.route("/<int:sid>", methods=["DELETE"])
@admin_required
def delete_sesion(sid):
    if not query_db("SELECT id FROM sesiones WHERE id=%s", (sid,), one=True):
        return jsonify({"error": "Sesion no encontrada"}), 404
    query_db("DELETE FROM sesiones WHERE id=%s", (sid,))
    return jsonify({"message": "Sesion invalidada"}), 200

@sesiones_bp.route("/usuario/<int:uid>", methods=["DELETE"])
@admin_required
def delete_sesiones_usuario(uid):
    if not query_db("SELECT id FROM usuarios WHERE id=%s", (uid,), one=True):
        return jsonify({"error": "Usuario no encontrado"}), 404
    query_db("DELETE FROM sesiones WHERE usuario_id=%s", (uid,))
    msg = "Sesiones del usuario invalidadas"
    return jsonify({"message": msg}), 200
