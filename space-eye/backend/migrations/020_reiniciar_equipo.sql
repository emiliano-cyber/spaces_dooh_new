-- migrations/020_reiniciar_equipo.sql
-- Reiniciar el EQUIPO entero a distancia, no solo la app (REBOOT_APP).
--
-- En una Raspberry, reiniciar el agente no arregla una camara que libcamera dejo
-- trabada, ni una red que se quedo sin ruta tras un corte del modem: eso se
-- arreglaba yendo al sitio a desconectarla. El agente (pi-agent 0.7.0+) lo hace
-- con `sudo systemctl reboot`, el unico permiso de root que le deja instalar.sh
-- ademas de apt.
--
-- Aditiva: solo agrega un valor al final del enum.
ALTER TABLE commands MODIFY COLUMN command_type
  ENUM('TAKE_PHOTO','START_STREAM','STOP_STREAM','UPDATE_CONFIG','REBOOT_APP',
       'SYNC_SCHEDULE','CHANGE_QUALITY','UPDATE_APP','REBOOT_DEVICE') NOT NULL;
