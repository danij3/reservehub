# ReserveHub

Sistema de reservas de recursos universitarios — proyecto final ATSWM.

**Grupo:** Arnau Oller · Sergi Adrià · Daniel Jan Lanero

---

## Índice

1. [Estructura del proyecto](#1-estructura-del-proyecto)
2. [Ejecución local — MySQL ya instalado](#2-ejecución-local--mysql-ya-instalado)
3. [Instalación desde cero](#3-instalación-desde-cero)
4. [Verificar las tablas en MySQL](#4-verificar-las-tablas-en-mysql)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Endpoints de la API](#6-endpoints-de-la-api)
7. [Autenticación](#7-autenticación)
8. [Despliegue en Azure](#8-despliegue-en-azure)

---

## 1. Estructura del proyecto

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
├── requirements.txt     ← dependencias Python
├── .env.example         ← plantilla de variables de entorno
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

## 2. Ejecución local — MySQL ya instalado

Si ya tienes MySQL instalado y la base de datos `reservehub` creada con el schema aplicado, sigue estos pasos:

**Paso 1 — Crear el entorno virtual**

```bash
cd reservehub/
python -m venv venv
```

**Paso 2 — Activar el entorno e instalar dependencias**

```bash
# Windows
venv\Scripts\activate

# Linux / Mac
source venv/bin/activate
```

```bash
pip install -r requirements.txt
```

**Paso 3 — Crear el fichero `.env`**

```bash
# Windows
copy .env.example .env

# Linux / Mac
cp .env.example .env
```

Abre `.env` y rellena tus credenciales:

```
FLASK_ENV=development
SECRET_KEY=una-clave-secreta-larga
DB_HOST=localhost
DB_USER=root
DB_PASS=tu_contraseña_mysql
DB_NAME=reservehub
```

**Paso 4 — Cargar datos de prueba**

```bash
python scripts/seed.py
```

Crea automáticamente estas cuentas:

| Email                | Contraseña | Rol   |
| -------------------- | ---------- | ----- |
| admin@reservehub.com | admin123   | admin |
| user@example.com     | user123    | user  |

**Paso 5 — Arrancar el servidor**

```bash
python app.py
```

Abrir en el navegador: `http://localhost:5000`

---

## 3. Instalación desde cero

Si todavía no tienes la base de datos creada, añade este bloque **antes** del Paso 4 anterior.

**Abrir el cliente MySQL**

```bash
mysql -u root -p
```

**Crear la base de datos y aplicar el schema**

```sql
CREATE DATABASE IF NOT EXISTS reservehub;
USE reservehub;
SOURCE scripts/schema.sql;
exit
```

Después de esto, continúa desde el **Paso 4** de la sección anterior.

---

## 4. Verificar las tablas en MySQL

Una vez aplicado el schema y el seed, puedes comprobar que todo está bien entrando al cliente MySQL (`mysql -u root -p`) y ejecutando:

**Ver las tablas creadas**

```sql
USE reservehub;
SHOW TABLES;
```

Resultado esperado:

```
+----------------------+
| Tables_in_reservehub |
+----------------------+
| categorias           |
| recursos             |
| reservas             |
| sesiones             |
| usuarios             |
+----------------------+
```

**Ver la estructura de cada tabla**

```sql
DESCRIBE usuarios;
DESCRIBE categorias;
DESCRIBE recursos;
DESCRIBE reservas;
DESCRIBE sesiones;
```

**Ver el contenido tras ejecutar el seed**

```sql
-- usuarios de prueba (deben salir 2 filas)
SELECT id, nombre, email, rol FROM usuarios;

-- categorías (deben salir 4 filas)
SELECT * FROM categorias;

-- recursos (deben salir 5 filas)
SELECT id, nombre, disponible, capacidad FROM recursos;

-- reservas de ejemplo
SELECT id, recurso_id, fecha_reserva, hora_inicio, hora_fin, estado FROM reservas;
```

**Ver datos en formato vertical** (más cómodo con muchas columnas)

```sql
SELECT * FROM reservas\G
SELECT * FROM usuarios\G
```

---

## 5. Modelo de datos

```
┌──────────────┐        ┌──────────────────┐        ┌──────────────┐
│   Usuario    │──1:N──▶│     Reserva      │◀──N:1──│   Recurso    │
│──────────────│        │──────────────────│        │──────────────│
│ id           │        │ id               │        │ id           │
│ nombre       │        │ usuario_id (FK)  │        │ nombre       │
│ email        │        │ recurso_id (FK)  │        │ descripcion  │
│ password     │        │ fecha_reserva    │        │ disponible   │
│ rol          │        │ hora_inicio      │        │ capacidad    │
└──────────────┘        │ hora_fin         │        │ categoria_id │
        │               │ estado           │        └──────┬───────┘
       1:N              └──────────────────┘               │ N:1
┌──────┴────────┐                                  ┌───────┴───────┐
│    Sesion     │                                  │   Categoria   │
│───────────────│                                  │───────────────│
│ id            │                                  │ id            │
│ usuario_id FK │                                  │ nombre        │
│ token         │                                  │ descripcion   │
│ fecha_expiration                                 └───────────────┘
└───────────────┘
```

---

## 6. Endpoints de la API

Todos los endpoints van con el prefijo `/api`. Los protegidos requieren el header `Authorization: Bearer <token>`.

### /api/auth

| Método | Ruta               | Auth  |
| ------ | ------------------ | ----- |
| POST   | /api/auth/register | —     |
| POST   | /api/auth/login    | —     |
| POST   | /api/auth/logout   | Token |
| GET    | /api/auth/me       | Token |

### /api/usuarios

| Método | Ruta                   | Auth           |
| ------ | ---------------------- | -------------- |
| GET    | /api/usuarios          | Admin          |
| GET    | /api/usuarios/{id}     | Admin o propio |
| PUT    | /api/usuarios/{id}     | Admin o propio |
| DELETE | /api/usuarios/{id}     | Admin          |
| PATCH  | /api/usuarios/{id}/rol | Admin          |

### /api/categorias

| Método | Ruta                 | Auth  |
| ------ | -------------------- | ----- |
| GET    | /api/categorias      | —     |
| GET    | /api/categorias/{id} | —     |
| POST   | /api/categorias      | Admin |
| PUT    | /api/categorias/{id} | Admin |
| DELETE | /api/categorias/{id} | Admin |

### /api/recursos

| Método | Ruta                              | Auth  |
| ------ | --------------------------------- | ----- |
| GET    | /api/recursos                     | —     |
| GET    | /api/recursos/{id}                | —     |
| POST   | /api/recursos                     | Admin |
| PUT    | /api/recursos/{id}                | Admin |
| DELETE | /api/recursos/{id}                | Admin |
| PATCH  | /api/recursos/{id}/disponible     | Admin |
| GET    | /api/recursos/{id}/disponibilidad | Token |

Filtros en la lista: `?categoria_id=1&disponible=true`

### /api/reservas

| Método | Ruta                       | Auth  |
| ------ | -------------------------- | ----- |
| GET    | /api/reservas              | Token |
| GET    | /api/reservas/mis-reservas | Token |
| GET    | /api/reservas/{id}         | Token |
| POST   | /api/reservas              | Token |
| PATCH  | /api/reservas/{id}/estado  | Token |
| DELETE | /api/reservas/{id}         | Admin |

Body del POST: `{ recurso_id, fecha_reserva, hora_inicio, hora_fin }`  
Estados: `pendiente` · `confirmada` · `cancelada`

### /api/sesiones

| Método | Ruta                        | Auth  |
| ------ | --------------------------- | ----- |
| GET    | /api/sesiones               | Admin |
| DELETE | /api/sesiones/{id}          | Admin |
| DELETE | /api/sesiones/usuario/{uid} | Admin |

---

## 7. Autenticación

Al hacer login, el servidor genera un token aleatorio con `secrets.token_urlsafe(32)` y lo guarda en la tabla `sesiones` con expiración de 24 horas. El frontend lo almacena en `localStorage` y lo envía en cada petición protegida como `Bearer <token>`. Al hacer logout, la fila de `sesiones` se elimina directamente, invalidando el token.

Las contraseñas se almacenan hasheadas con PBKDF2-SHA256 y nunca se devuelven en ninguna respuesta de la API.

---

## 8. Despliegue en Azure

### Requisitos previos

- Tener instalado [Azure CLI](https://aka.ms/installazurecli)
- Haber iniciado sesión: `az login`

### Paso 1 — Crear el grupo de recursos y el App Service

```bash
az group create --name rg-reservehub --location westeurope

az appservice plan create \
  --name plan-reservehub \
  --resource-group rg-reservehub \
  --sku B1 --is-linux

az webapp create \
  --resource-group rg-reservehub \
  --plan plan-reservehub \
  --name reservehub-app \
  --runtime "PYTHON:3.11"
```

### Paso 2 — Crear la base de datos MySQL en Azure

```bash
az mysql flexible-server create \
  --resource-group rg-reservehub \
  --name mysql-reservehub \
  --admin-user adminuser \
  --admin-password "MiPassword123!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 8.0

az mysql flexible-server db create \
  --resource-group rg-reservehub \
  --server-name mysql-reservehub \
  --database-name reservehub
```

### Paso 3 — Configurar las variables de entorno

```bash
az webapp config appsettings set \
  --resource-group rg-reservehub \
  --name reservehub-app \
  --settings \
    FLASK_ENV=production \
    SECRET_KEY="clave-muy-larga-y-secreta" \
    DB_HOST="mysql-reservehub.mysql.database.azure.com" \
    DB_USER="adminuser" \
    DB_PASS="MiPassword123!" \
    DB_NAME="reservehub" \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

### Paso 4 — Configurar el comando de arranque

Este comando le indica a Azure que use gunicorn para servir la app automáticamente, sin necesidad de ejecutar nada manualmente:

```bash
az webapp config set \
  --resource-group rg-reservehub \
  --name reservehub-app \
  --startup-file "gunicorn --bind=0.0.0.0:8000 --workers=2 --timeout=120 app:app"
```

### Paso 5 — Aplicar el schema y seed en la BD de Azure

Antes de este paso, permite tu IP en el firewall del servidor MySQL desde el portal de Azure (MySQL → Networking → Add current client IP).

```bash
# Aplicar el schema
mysql -h mysql-reservehub.mysql.database.azure.com \
      -u adminuser -p reservehub < scripts/schema.sql

# Cargar datos de prueba
DB_HOST=mysql-reservehub.mysql.database.azure.com \
DB_USER=adminuser \
DB_PASS=MiPassword123! \
DB_NAME=reservehub \
python scripts/seed.py
```

### Paso 6 — Subir el código

```bash
# Desde la carpeta reservehub/
zip -r deploy.zip . -x "venv/*" ".git/*" "__pycache__/*" "*.pyc"

az webapp deployment source config-zip \
  --resource-group rg-reservehub \
  --name reservehub-app \
  --src deploy.zip
```

### Resultado

Una vez completado el deploy, la aplicación está disponible en:

```
https://reservehub-app.azurewebsites.net
```

Azure gestiona HTTPS automáticamente.
