-- ============================================================
--  ReserveHub – Schema MySQL
--  Compatible con Azure Database for MySQL Flexible Server 8.x
-- ============================================================

CREATE DATABASE IF NOT EXISTS reservehub
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE reservehub;

-- ------------------------------------------------------------
-- Tabla: usuarios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    nombre         VARCHAR(100)  NOT NULL,
    email          VARCHAR(150)  NOT NULL UNIQUE,
    password       VARCHAR(255)  NOT NULL,
    rol            VARCHAR(30)   NOT NULL DEFAULT 'user',
    fecha_creacion DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Tabla: categorias
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
);

-- ------------------------------------------------------------
-- Tabla: recursos
-- Nota: 'capacidad' añadido para mostrar aforo en el frontend
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recursos (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL,
    descripcion  TEXT,
    disponible   BOOLEAN      NOT NULL DEFAULT TRUE,
    capacidad    INT          NOT NULL DEFAULT 1,
    categoria_id INT,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT
);

-- ------------------------------------------------------------
-- Tabla: reservas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservas (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id    INT         NOT NULL,
    recurso_id    INT         NOT NULL,
    fecha_reserva DATE        NOT NULL,
    hora_inicio   TIME        NOT NULL,
    hora_fin      TIME        NOT NULL,
    estado        VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (recurso_id) REFERENCES recursos(id) ON DELETE CASCADE,
    INDEX idx_fecha_recurso (fecha_reserva, recurso_id)
);

-- ------------------------------------------------------------
-- Tabla: sesiones (tokens opacos, sin JWT)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sesiones (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id       INT          NOT NULL,
    token            VARCHAR(255) NOT NULL UNIQUE,
    fecha_expiration DATETIME     NOT NULL,
    created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_token      (token),
    INDEX idx_expiration (fecha_expiration)
);
