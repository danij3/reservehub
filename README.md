# ReserveHub

Sistema de reservas de recursos universitarios desarrollado como proyecto final de la asignatura ATSWM.

**Grupo:** Arnau Oller · Sergi Adrià · Daniel Jan Lanero

---

## Estructura del proyecto

```
reservehub/
├── app.py               ← punto de entrada Flask
├── db.py                ← conexión a MySQL y helper query_db
├── auth.py              ← login, registro, logout y decoradores de auth
├── usuarios.py          ← CRUD de usuarios
├── categorias.py        ← CRUD de categorías
├── recursos.py          ← CRUD de recursos
├── reservas.py          ← CRUD de reservas
├── sesiones.py          ← gestión de sesiones activas (admin)
├── requirements.txt
├── .env.example
├── static/
│   ├── css/styles.css
│   └── js/app.js
├── templates/
│   └── index.html
└── scripts/
    ├── schema.sql       ← DDL de la base de datos
    └── seed.py          ← datos de prueba
```

---

## Requisitos

- Python 3.10+
- MySQL 8.x (o MariaDB 10.6+)

---

## Cómo ejecutarlo en local

**1. Crear entorno virtual e instalar dependencias**

```bash
cd reservehub/
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
```

**2. Crear la base de datos**

```bash
mysql -u root -p
```

```sql
CREATE DATABASE reservehub;
USE reservehub;
SOURCE scripts/schema.sql;
```

**3. Configurar variables de entorno**

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:

```
FLASK_ENV=development
SECRET_KEY=una-clave-secreta
DB_HOST=localhost
DB_USER=root
DB_PASS=tu_password
DB_NAME=reservehub
```

**4. Cargar datos de prueba**

```bash
python scripts/seed.py
```

Esto crea dos usuarios:
- `admin@reservehub.com` / `admin123` (rol: admin)
- `user@example.com` / `user123` (rol: user)

**5. Arrancar el servidor**

```bash
python app.py
```

Abrir `http://localhost:5000`.

---

## Modelo de datos

```
┌──────────────┐        ┌──────────────────┐        ┌──────────────┐
│   Usuario    │──1:N──▶│     Reserva      │◀──N:1──│   Recurso    │
│──────────────│        │──────────────────│        │──────────────│
│ id           │        │ id               │        │ id           │
│ nombre       │        │ usuario_id (FK)  │        │ nombre       │
│ email        │        │ recurso_id (FK)  │        │ descripcion  │
│ password     │        │ fecha_reserva    │        │ disponible   │
│ rol          │        │ hora_inicio      │        │ capacidad    │
│ fecha_creacion        │ hora_fin         │        │ categoria_id │
└──────────────┘        │ estado           │        └──────┬───────┘
        │               └──────────────────┘               │ N:1
       1:N                                          ┌───────┴───────┐
┌──────┴────────┐                                   │   Categoria   │
│    Sesion     │                                   │───────────────│
│───────────────│                                   │ id            │
│ id            │                                   │ nombre        │
│ usuario_id FK │                                   │ descripcion   │
│ token         │                                   └───────────────┘
│ fecha_expiration
└───────────────┘
```

---

## Endpoints de la API

Todos van con el prefijo `/api`. Las rutas protegidas necesitan el header `Authorization: Bearer <token>`.

### /api/auth

| Método | Ruta | Auth |
|--------|------|------|
| POST | /api/auth/register | — |
| POST | /api/auth/login | — |
| POST | /api/auth/logout | Token |
| GET | /api/auth/me | Token |

### /api/usuarios

| Método | Ruta | Auth |
|--------|------|------|
| GET | /api/usuarios | Admin |
| GET | /api/usuarios/{id} | Admin o propio |
| PUT | /api/usuarios/{id} | Admin o propio |
| DELETE | /api/usuarios/{id} | Admin |
| PATCH | /api/usuarios/{id}/rol | Admin |

### /api/categorias

| Método | Ruta | Auth |
|--------|------|------|
| GET | /api/categorias | — |
| GET | /api/categorias/{id} | — |
| POST | /api/categorias | Admin |
| PUT | /api/categorias/{id} | Admin |
| DELETE | /api/categorias/{id} | Admin |

### /api/recursos

| Método | Ruta | Auth |
|--------|------|------|
| GET | /api/recursos | — |
| GET | /api/recursos/{id} | — |
| POST | /api/recursos | Admin |
| PUT | /api/recursos/{id} | Admin |
| DELETE | /api/recursos/{id} | Admin |
| PATCH | /api/recursos/{id}/disponible | Admin |
| GET | /api/recursos/{id}/disponibilidad | Token |

Filtros disponibles en la lista: `?categoria_id=&disponible=`

### /api/reservas

| Método | Ruta | Auth |
|--------|------|------|
| GET | /api/reservas | Token |
| GET | /api/reservas/mis-reservas | Token |
| GET | /api/reservas/{id} | Token |
| POST | /api/reservas | Token |
| PATCH | /api/reservas/{id}/estado | Token |
| DELETE | /api/reservas/{id} | Admin |

Body del POST: `{ recurso_id, fecha_reserva, hora_inicio, hora_fin }`  
Estados posibles: `pendiente`, `confirmada`, `cancelada`

### /api/sesiones

| Método | Ruta | Auth |
|--------|------|------|
| GET | /api/sesiones | Admin |
| DELETE | /api/sesiones/{id} | Admin |
| DELETE | /api/sesiones/usuario/{uid} | Admin |

---

## Autenticación

Al hacer login se genera un token aleatorio con `secrets.token_urlsafe(32)` que se guarda en la tabla `sesiones` con una expiración de 24 horas. El frontend lo almacena en `localStorage` y lo envía en cada petición como `Bearer <token>`. Al hacer logout, el token se elimina directamente de la base de datos.

Las contraseñas se guardan hasheadas con PBKDF2-SHA256 (werkzeug) y nunca se devuelven en ninguna respuesta.

---

## Despliegue en Azure

La forma más sencilla es usar **Azure App Service** con **Azure Database for MySQL**.

```bash
az group create --name rg-reservehub --location westeurope

az appservice plan create --name plan-reservehub \
  --resource-group rg-reservehub --sku B1 --is-linux

az webapp create --resource-group rg-reservehub \
  --plan plan-reservehub --name reservehub-app \
  --runtime "PYTHON:3.11"

az mysql flexible-server create --resource-group rg-reservehub \
  --name mysql-reservehub --admin-user adminuser \
  --admin-password "MiPassword123!" --sku-name Standard_B1ms \
  --tier Burstable --version 8.0
```

Configurar las variables de entorno en el App Service y usar como startup command:

```
gunicorn --bind=0.0.0.0:8000 app:app
```

Azure proporciona HTTPS automáticamente en el dominio `*.azurewebsites.net`.
