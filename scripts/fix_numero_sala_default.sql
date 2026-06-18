-- ============================================================
--  Fix puntual: asigna numero_sala a las 5 salas de ejemplo que
--  insertó seed.py antes de que ese script incluyera numero_sala.
--  Por eso aparecían como "Sin número" en el panel de admin.
--
--  Cómo ejecutarla en Azure Database for MySQL (o en local):
--    mysql -h <host> -u <usuario> -p reservehub < scripts/fix_numero_sala_default.sql
--
--  Segura de ejecutar varias veces: el WHERE numero_sala IS NULL
--  hace que no se sobrescriba un número ya asignado manualmente.
-- ============================================================

USE reservehub;

UPDATE recursos SET numero_sala = '101'  WHERE nombre = 'Sala de Estudio A'   AND numero_sala IS NULL;
UPDATE recursos SET numero_sala = '102'  WHERE nombre = 'Sala de Reuniones B' AND numero_sala IS NULL;
UPDATE recursos SET numero_sala = '201'  WHERE nombre = 'Laboratorio Cisco'   AND numero_sala IS NULL;
UPDATE recursos SET numero_sala = '301'  WHERE nombre = 'Aula Magna'          AND numero_sala IS NULL;
UPDATE recursos SET numero_sala = '204' WHERE nombre = 'Proyector Portátil'  AND numero_sala IS NULL;
