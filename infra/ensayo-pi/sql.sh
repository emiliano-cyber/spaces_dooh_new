#!/usr/bin/env bash
# SQL contra el MySQL del ensayo de la instancia (bases space_eye y space_eye_b).
# Lee la consulta de la entrada estandar; la clave sale de eyes.env y no se imprime.
#   echo "SELECT 1" | wsl.exe -d Ubuntu -- bash /mnt/c/Users/hm284/Space_eye/infra/ensayo-pi/sql.sh
CL="$(sed -n 's/^DB_PASSWORD=//p' "$HOME/hijo/etc/eyes.env")"
exec docker exec -i space-eyes-mysql-1 mysql -N -h127.0.0.1 -uroot -p"$CL" "${1:-space_eye}" 2>/dev/null
