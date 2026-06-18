-- ============================================================
--  Migración: añade 'imagen' y 'numero_sala' a recursos
--  Usar SOLO si la base de datos ya existía antes de este cambio
--  (en una BD nueva, schema.sql ya crea la tabla con estas columnas).
--
--  Cómo ejecutarla en Azure Database for MySQL:
--    mysql -h <host> -u <usuario> -p reservehub < scripts/migration_imagen_numero_sala.sql
--  o pegando el contenido en una sesión `mysql -u ... -p reservehub`.
--
--  Es segura de ejecutar una sola vez. Si se ejecuta dos veces dará
--  un error "Duplicate column name" (no hace daño, simplemente no
--  hace falta repetirla).
-- ============================================================

USE reservehub;

ALTER TABLE recursos
  ADD COLUMN imagen      VARCHAR(255) NOT NULL DEFAULT '2.jpg',
  ADD COLUMN numero_sala VARCHAR(20)  NULL;
