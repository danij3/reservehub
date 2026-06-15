# seed.py - Inserta datos de prueba en la BD
# Usar desde la carpeta reservehub/: python scripts/seed.py
# El schema tiene que estar aplicado antes: mysql -u root -p < scripts/schema.sql
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from dotenv import load_dotenv
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

import mysql.connector
from werkzeug.security import generate_password_hash

DB_CONFIG = {
    'host':     os.environ.get('DB_HOST', 'localhost'),
    'user':     os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASS', ''),
    'database': os.environ.get('DB_NAME', 'reservehub'),
    'charset':  'utf8mb4',
}
print('DB_CONFIG =', DB_CONFIG)

conn = mysql.connector.connect(**DB_CONFIG)
cur  = conn.cursor()

# categorías
cur.executemany(
    'INSERT IGNORE INTO categorias (nombre, descripcion) VALUES (%s, %s)',
    [
        ('Aulas',            'Aulas de clase con proyectores'),
        ('Salas de Estudio', 'Salas para trabajo en grupo'),
        ('Laboratorios',     'Laboratorios informáticos o de ciencias'),
        ('Material',         'Equipamiento portátil (proyectores, cámaras, etc.)'),
    ]
)

# usuarios de prueba con contraseñas hasheadas
admin_hash = generate_password_hash('admin123')
user_hash  = generate_password_hash('user123')

cur.execute(
    'INSERT IGNORE INTO usuarios (nombre, email, password, rol) VALUES (%s,%s,%s,%s)',
    ('Administrador', 'admin@reservehub.com', admin_hash, 'admin')
)
cur.execute(
    'INSERT IGNORE INTO usuarios (nombre, email, password, rol) VALUES (%s,%s,%s,%s)',
    ('Usuario Prueba', 'user@example.com', user_hash, 'user')
)

# recursos de ejemplo, asignados a las categorías por nombre
recursos = [
    ('Sala de Estudio A',   'Mesa redonda, pizarra, 4 sillas',    True,  4,   'Salas de Estudio'),
    ('Laboratorio Cisco',   'Racks con routers y switches',        True,  15,  'Laboratorios'),
    ('Aula Magna',          'Proyector 4K, sistema de audio',      False, 100, 'Aulas'),
    ('Sala de Reuniones B', 'Pantalla interactiva, videollamada',  True,  8,   'Salas de Estudio'),
    ('Proyector Portátil',  'Conexión HDMI y USB-C',               True,  1,   'Material'),
]

for nombre, desc, disponible, capacidad, cat_nombre in recursos:
    cur.execute(
        'INSERT IGNORE INTO recursos '
        '(nombre, descripcion, disponible, capacidad, categoria_id) '
        'VALUES (%s, %s, %s, %s, (SELECT id FROM categorias WHERE nombre=%s))',
        (nombre, desc, disponible, capacidad, cat_nombre)
    )

# reserva de ejemplo para el usuario de prueba
cur.execute(
    'INSERT IGNORE INTO reservas '
    '(usuario_id, recurso_id, fecha_reserva, hora_inicio, hora_fin, estado) '
    'VALUES (2, 1, CURDATE(), "10:00:00", "12:00:00", "confirmada")'
)

conn.commit()
cur.close()
conn.close()

print('Seed completado.')
print('   admin@reservehub.com  / admin123  (rol: admin)')
print('   user@example.com      / user123   (rol: user)')
