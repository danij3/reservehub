"""
app.py – Punto de entrada de ReserveHub.

Lanza con:
    python app.py                  (desarrollo)
    gunicorn app:app               (producción)
"""
import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

from db       import close_db
from auth      import auth_bp
from usuarios  import usuarios_bp
from categorias import categorias_bp
from recursos  import recursos_bp
from reservas  import reservas_bp
from sesiones  import sesiones_bp


def create_app():
    app = Flask(
        __name__,
        static_folder='static',
        template_folder='templates',
    )
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-inseguro')

    # CORS: necesario si frontend y backend están en puertos distintos en local.
    # En producción (servidos juntos) no hace falta, pero no perjudica.
    CORS(app, resources={r'/api/*': {'origins': '*'}})

    # Cerrar conexión BD al terminar cada petición
    app.teardown_appcontext(close_db)

    # Registrar blueprints
    app.register_blueprint(auth_bp,       url_prefix='/api/auth')
    app.register_blueprint(usuarios_bp,   url_prefix='/api/usuarios')
    app.register_blueprint(categorias_bp, url_prefix='/api/categorias')
    app.register_blueprint(recursos_bp,   url_prefix='/api/recursos')
    app.register_blueprint(reservas_bp,   url_prefix='/api/reservas')
    app.register_blueprint(sesiones_bp,   url_prefix='/api/sesiones')

    # Servir el frontend desde /templates
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        # Archivos estáticos (css, js, imágenes)
        if path and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.template_folder, 'index.html')

    return app


app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=os.environ.get('FLASK_ENV') == 'development',
            host='0.0.0.0', port=port)
