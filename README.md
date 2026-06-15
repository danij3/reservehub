# ReserveHub — Backend Flask + MySQL

> Grupo 1 · Arnau Oller – Sergi Adrià – Daniel Jan Lanero

---

## Índice

1. [Estructura del proyecto](#estructura)
2. [Requisitos previos](#requisitos)
3. [Instalación y ejecución local](#local)
4. [Diagrama de clases](#diagrama)
5. [Endpoints de la API](#endpoints)
6. [Gestión de la autenticación por token](#auth)
7. [Despliegue en Azure con HTTPS](#azure)

---

## 1. Estructura del proyecto <a name="estructura"></a>

```
reservehub/
├── app.py               ← Punto de entrada Flask
├── db.py                ← Conexión MySQL + helper query_db
├── auth.py              ← Blueprint /api/auth + decoradores
├── usuarios.py          ← Blueprint /api/usuarios
├── categorias.py        ← Blueprint /api/categorias
├── recursos.py          ← Blueprint /api/recursos
├── reservas.py          ← Blueprint /api/reservas
├── sesiones.py          ← Blueprint /api/sesiones
├── requirements.txt
├── .env.example
├── static/
│   ├── css/styles.css
│   └── js/app.js
├── templates/
│   └── index.html
└── scripts/
    ├── schema.sql       ← DDL de la base de datos
    └── seed.py          ← Datos iniciales + usuarios de prueba
```

---

## 2. Requisitos previos <a name="requisitos"></a>

- Python 3.10 o superior
- MySQL 8.x (o MariaDB 10.6+)
- pip

---

## 3. Instalación y ejecución local <a name="local"></a>

### 3.1 Clonar/descargar el proyecto

```bash
cd reservehub/
```

### 3.2 Crear entorno virtual e instalar dependencias

```bash
python -m venv venv
# Linux/Mac
source venv/bin/activate
# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

### 3.3 Configurar la base de datos

```bash
# Acceder a MySQL
mysql -u root -p
```

Dentro del cliente MySQL, ejecuta los siguientes comandos **en orden**:

```sql
-- 1. Seleccionar (o crear) la base de datos
USE reservehub;

-- 2. Aplicar el schema (tablas, índices, claves foráneas)
SOURCE scripts/schema.sql;

-- 3. Verificar que las tablas se han creado
SHOW TABLES;
```

Deberías ver:

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

```sql
exit
```

### 3.3.1 Verificar que los datos del seed se han cargado

Después de ejecutar `python scripts/seed.py` (paso 3.5), comprueba en MySQL:

```sql
USE reservehub;

-- Usuarios de prueba (deben aparecer 2 filas)
SELECT id, nombre, email, rol FROM usuarios;

-- Categorías (deben aparecer 4 filas)
SELECT * FROM categorias;

-- Recursos (deben aparecer 5 filas)
SELECT id, nombre, disponible, capacidad FROM recursos;
```

Si las tablas están vacías, vuelve a ejecutar `python scripts/seed.py`.

### 3.4 Crear el fichero .env

```bash
cp .env.example .env
# Editar con tus credenciales de MySQL
```

Contenido mínimo de `.env`:

```
FLASK_ENV=development
SECRET_KEY=una-clave-secreta-larga
DB_HOST=localhost
DB_USER=root
DB_PASS=tu_password
DB_NAME=reservehub
```

### 3.5 Poblar con datos de prueba

```bash
python scripts/seed.py
```

Crea dos usuarios:
- `admin@reservehub.com` / `admin123` (rol: **admin**)
- `demo@reservehub.com`  / `user123`  (rol: **user**)

### 3.6 Arrancar el servidor

```bash
python app.py
```

Abre `http://localhost:5000` en el navegador.

---

## 4. Diagrama de clases <a name="diagrama"></a>

```
┌──────────────┐   1    N  ┌──────────────────┐   N    1  ┌──────────────┐
│   Usuario    │──────────→│     Reserva      │←──────────│   Recurso    │
│──────────────│           │──────────────────│           │──────────────│
│ id           │           │ id               │           │ id           │
│ nombre       │           │ usuario_id (FK)  │           │ nombre       │
│ email        │           │ recurso_id (FK)  │           │ descripcion  │
│ password     │           │ fecha_reserva    │           │ disponible   │
│ rol          │           │ hora_inicio      │           │ capacidad    │
│ fecha_creacion│          │ hora_fin         │           │ categoria_id │
└──────────────┘           │ estado           │           └──────┬───────┘
        │                  └──────────────────┘                  │ N
        │ 1                                                       │ 1
        │                                                ┌────────┴──────┐
   ┌────┴──────────┐                                     │   Categoría   │
   │   Sesión      │                                     │───────────────│
   │───────────────│                                     │ id            │
   │ id            │                                     │ nombre        │
   │ usuario_id FK │                                     │ descripcion   │
   │ token         │                                     └───────────────┘
   │ fecha_expiration│
   └───────────────┘
```

---

## 5. Endpoints de la API <a name="endpoints"></a>

Todos los endpoints están prefijados con `/api`.
Autenticación mediante cabecera `Authorization: Bearer <token>`.

### Autenticación `/api/auth`

| Método | Endpoint              | Auth  | Respuestas       |
|--------|-----------------------|-------|------------------|
| POST   | /api/auth/register    | —     | 201, 400, 409    |
| POST   | /api/auth/login       | —     | 200, 401         |
| POST   | /api/auth/logout      | Token | 200, 401         |
| GET    | /api/auth/me          | Token | 200, 401         |

### Usuarios `/api/usuarios`

| Método | Endpoint                   | Auth         | Respuestas            |
|--------|----------------------------|--------------|-----------------------|
| GET    | /api/usuarios              | Admin        | 200, 403              |
| GET    | /api/usuarios/{id}         | Admin/Propio | 200, 403, 404         |
| PUT    | /api/usuarios/{id}         | Admin/Propio | 200, 400, 403, 404    |
| DELETE | /api/usuarios/{id}         | Admin        | 200, 403, 404         |
| PATCH  | /api/usuarios/{id}/rol     | Admin        | 200, 400, 403         |

### Categorías `/api/categorias`

| Método | Endpoint               | Auth  | Respuestas            |
|--------|------------------------|-------|-----------------------|
| GET    | /api/categorias        | —     | 200                   |
| GET    | /api/categorias/{id}   | —     | 200, 404              |
| POST   | /api/categorias        | Admin | 201, 400, 403         |
| PUT    | /api/categorias/{id}   | Admin | 200, 400, 403, 404    |
| DELETE | /api/categorias/{id}   | Admin | 200, 403, 404, 409    |

### Recursos `/api/recursos`

| Método | Endpoint                            | Auth  | Respuestas            |
|--------|-------------------------------------|-------|-----------------------|
| GET    | /api/recursos                       | —     | 200                   |
| GET    | /api/recursos/{id}                  | —     | 200, 404              |
| POST   | /api/recursos                       | Admin | 201, 400, 403         |
| PUT    | /api/recursos/{id}                  | Admin | 200, 400, 403, 404    |
| DELETE | /api/recursos/{id}                  | Admin | 200, 403, 404         |
| PATCH  | /api/recursos/{id}/disponible       | Admin | 200, 403, 404         |
| GET    | /api/recursos/{id}/disponibilidad   | Token | 200, 404              |

Query params de GET lista: `?categoria_id=&disponible=&fecha=`

### Reservas `/api/reservas`

| Método | Endpoint                      | Auth        | Respuestas               |
|--------|-------------------------------|-------------|--------------------------|
| GET    | /api/reservas                 | Token       | 200, 401                 |
| GET    | /api/reservas/mis-reservas    | Token       | 200, 401                 |
| GET    | /api/reservas/{id}            | Token/Admin | 200, 401, 403, 404       |
| POST   | /api/reservas                 | Token       | 201, 400, 401, 409       |
| PATCH  | /api/reservas/{id}/estado     | Token/Admin | 200, 400, 401, 403       |
| DELETE | /api/reservas/{id}            | Admin       | 200, 403, 404            |

Body POST: `{ recurso_id, fecha_reserva, hora_inicio, hora_fin }`
Estados válidos: `pendiente` | `confirmada` | `cancelada`

### Sesiones `/api/sesiones`

| Método | Endpoint                        | Auth  | Respuestas    |
|--------|---------------------------------|-------|---------------|
| GET    | /api/sesiones                   | Admin | 200, 403      |
| DELETE | /api/sesiones/{id}              | Admin | 200, 403, 404 |
| DELETE | /api/sesiones/usuario/{uid}     | Admin | 200, 403      |

---

## 6. Gestión de la autenticación por token <a name="auth"></a>

1. **Login** → `POST /api/auth/login` devuelve `{ token, usuario }`.
2. El token es un string opaco generado con `secrets.token_urlsafe(32)` (sin JWT), guardado en la tabla `sesiones` junto a su fecha de expiración (24 h).
3. El frontend lo almacena en `localStorage` como `reservehub_token`.
4. Todas las peticiones protegidas incluyen la cabecera:
   ```
   Authorization: Bearer <token>
   ```
5. Cada petición valida que el token exista en BD **y** que `fecha_expiration > NOW()`.
6. **Logout** elimina físicamente la fila de `sesiones`, invalidando el token.
7. Las contraseñas se almacenan con `werkzeug.security.generate_password_hash` (PBKDF2-SHA256). Nunca se devuelven en ninguna respuesta (Regla R7).

---

## 7. Despliegue en Azure con HTTPS <a name="azure"></a>

### Opción A — Azure App Service (recomendada)

#### Paso 1 — Crear el App Service

```bash
# Instalar Azure CLI: https://aka.ms/installazurecli
az login

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

#### Paso 2 — Crear Azure Database for MySQL

```bash
az mysql flexible-server create \
  --resource-group rg-reservehub \
  --name mysql-reservehub \
  --admin-user adminuser \
  --admin-password "MiPassword123!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 8.0
```

Crea la base de datos `reservehub` desde el portal o con:

```bash
az mysql flexible-server db create \
  --resource-group rg-reservehub \
  --server-name mysql-reservehub \
  --database-name reservehub
```

#### Paso 3 — Configurar variables de entorno en App Service

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

#### Paso 4 — Añadir startup command

En el portal de Azure → App Service → Configuración → Comandos de inicio:

```
gunicorn --bind=0.0.0.0:8000 app:app
```

O bien crea `startup.txt` en la raíz con ese contenido.

#### Paso 5 — Desplegar el código

Desde el directorio `reservehub/`:

```bash
# Primera vez: zip deploy
zip -r deploy.zip . -x "venv/*" ".git/*" "__pycache__/*"

az webapp deployment source config-zip \
  --resource-group rg-reservehub \
  --name reservehub-app \
  --src deploy.zip
```

Para deploys continuos con GitHub Actions, usa:

```bash
az webapp deployment source config \
  --name reservehub-app \
  --resource-group rg-reservehub \
  --repo-url https://github.com/tu-org/reservehub \
  --branch main --manual-integration
```

#### Paso 6 — Aplicar el schema y seed

Conéctate a la BD de Azure desde tu máquina (permite tu IP en el firewall del servidor MySQL) y ejecuta:

```bash
mysql -h mysql-reservehub.mysql.database.azure.com \
      -u adminuser -p reservehub < scripts/schema.sql

# Variables de entorno apuntando a Azure:
DB_HOST=mysql-reservehub.mysql.database.azure.com \
DB_USER=adminuser DB_PASS=MiPassword123! DB_NAME=reservehub \
python scripts/seed.py
```

#### Paso 7 — HTTPS (automático en App Service)

Azure App Service proporciona HTTPS **de forma automática** en el dominio
`https://reservehub-app.azurewebsites.net` sin ninguna configuración adicional.

Para un **dominio personalizado** con HTTPS gratuito (Let's Encrypt gestionado por Azure):

```bash
# 1. Añade el dominio personalizado
az webapp config hostname add \
  --webapp-name reservehub-app \
  --resource-group rg-reservehub \
  --hostname www.tudominio.com

# 2. Crea el certificado administrado (gratuito)
az webapp config ssl create \
  --resource-group rg-reservehub \
  --name reservehub-app \
  --hostname www.tudominio.com

# 3. Enlaza el certificado al dominio
az webapp config ssl bind \
  --resource-group rg-reservehub \
  --name reservehub-app \
  --certificate-thumbprint <THUMBPRINT-del-paso-anterior> \
  --ssl-type SNI
```

#### Paso 8 — Forzar HTTPS

En el portal: App Service → TLS/SSL settings → HTTPS Only → **On**.

O con CLI:

```bash
az webapp update \
  --resource-group rg-reservehub \
  --name reservehub-app \
  --https-only true
```

---

### Verificación final

```
https://reservehub-app.azurewebsites.net/          → Carga el frontend
https://reservehub-app.azurewebsites.net/api/recursos → Devuelve JSON
```

---

### Opción B — Azure VM + Nginx + Certbot

Si prefieres control total sobre el servidor:

1. Crear VM Ubuntu 22.04 en Azure.
2. Instalar `nginx`, `python3-pip`, `gunicorn`, `mysql-server`.
3. Clonar el repo en `/var/www/reservehub`.
4. Configurar Nginx como proxy inverso hacia `gunicorn` en el puerto 8000.
5. Obtener certificado SSL con `certbot --nginx -d tudominio.com`.
6. Registrar `gunicorn` como servicio systemd.

Consulta la documentación de Certbot en https://certbot.eff.org para los detalles específicos.

---

*Documento generado automáticamente para el Proyecto Final ATSWM — Grupo 1.*
