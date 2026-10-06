#!/usr/bin/env bash
# ============================================================================
#  Ensayo: mudar una Raspberry de un Space Eye a otro, a distancia.
# ----------------------------------------------------------------------------
#  A = el Space Eye de la instancia (127.0.0.1:4200), donde vive la Pi hoy.
#  B = el segundo Space Eye (servidor-b.sh, 127.0.0.1:4300), el "nuevo".
#  La orden es UPDATE_CONFIG {mudanza:{servidor, codigo?}}: la que el Space Eye
#  central ya acepta, asi la mudanza de la flota sale de :4000 sin tocarlo.
#
#    0. La Pi se actualiza a la version que sabe mudarse (desde el panel).
#    1. MIGRACION: la Pi ya existe en B (su fila se copio) y se muda sin codigo,
#       con su misma identidad.
#    2. De vuelta a A, igual.
#    3. A un servidor que no existe: NO se mueve, y A recibe el motivo.
#    4. A un servidor donde no existe: sin codigo la rechaza; con un codigo de
#       B entra como equipo nuevo de B.
#    5. B se cae justo despues de la mudanza: la Pi REGRESA SOLA a A.
#
#  Uso (Git Bash, con servidor-b.sh ya corriendo):
#    bash infra/ensayo-pi/ensayar-mudanza.sh
# ============================================================================
set -uo pipefail
export MSYS_NO_PATHCONV=1
A=http://127.0.0.1:4200; B=http://127.0.0.1:4300
A_PI=http://host.docker.internal:4200; B_PI=http://host.docker.internal:4300
PI=pi-simulada-1
WSL() { wsl.exe -d Ubuntu -- bash -lc "$1"; }
LLAVE="$(WSL 'sed -n "s/^INSTANCIA_LLAVE=//p" ~/hijo/etc/eyes.env' | tr -d '\r')"
# SQL contra el MySQL del ensayo (las dos bases viven ahi). Lee la consulta de stdin.
sql() { wsl.exe -d Ubuntu -- bash /mnt/c/Users/hm284/Space_eye/infra/ensayo-pi/sql.sh | tr -d '\r'; }
api() { curl -s -H "Authorization: Bearer $LLAVE" -H 'Content-Type: application/json' "$@"; }
json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const o=JSON.parse(s);console.log(eval(process.argv[1]))}catch{console.log("")}})' "$1"; }
fallos=0
afirmar() { if eval "$1"; then echo "  ok     $2"; else echo "  FALLA  $2"; fallos=$((fallos+1)); fi; }
servidor_de_la_pi() { docker exec $PI sh -c 'cat /home/pi/pi-agent/config.json' | json 'o.server_url'; }
esperar_servidor() { for _ in $(seq 1 "$2"); do [ "$(servidor_de_la_pi)" = "$1" ] && return 0; sleep 2; done; return 1; }
version_en() { api "$1/api/devices/$2" | json 'o.device.app_version'; }
# Manda la mudanza desde el servidor $1 y devuelve el id de la orden.
mudar() { api -X POST "$1/api/devices/$2/command" -d "{\"command_type\":\"UPDATE_CONFIG\",\"payload\":{\"mudanza\":$3}}" | json 'o.command?.id ?? o.id ?? ""'; }
# Estado y error de la ultima UPDATE_CONFIG de un equipo en una base.
ultima_orden() { echo "SELECT status, IFNULL(error_message,''), IFNULL(result,'') FROM $1.commands WHERE device_id=$2 AND command_type='UPDATE_CONFIG' ORDER BY id DESC LIMIT 1" | sql; }
esperar_orden() { for _ in $(seq 1 30); do o="$(ultima_orden "$1" "$2")"; case "$o" in done*|failed*) echo "$o"; return 0;; esac; sleep 2; done; echo "$o"; }

ID="$(docker exec $PI cat /home/pi/pi-agent/state.json | json 'o.device_id')"
echo "Pi simulada: equipo #$ID en A, $(version_en $A $ID)"

echo; echo "0) Se actualiza a la version que sabe mudarse"
api -X POST "$A/api/devices/$ID/command" -d '{"command_type":"UPDATE_APP"}' >/dev/null
for _ in $(seq 1 60); do [ "$(version_en $A $ID)" = "pi-agent 0.7.2" ] && break; sleep 3; done
afirmar "[ \"$(version_en $A $ID)\" = 'pi-agent 0.7.2' ]" "reporta pi-agent 0.7.2"

echo; echo "1) MIGRACION a B: la Pi ya existe alla (su fila se copio), sin codigo"
# Las dos bases no tienen las columnas en el mismo orden (A viene de la base de
# produccion adoptada): se copian por NOMBRE las que tienen en comun.
COLS="$(echo "SELECT GROUP_CONCAT(CONCAT('\`',a.column_name,'\`')) FROM information_schema.columns a
  JOIN information_schema.columns b ON b.table_schema='space_eye_b' AND b.table_name='devices' AND b.column_name=a.column_name
  WHERE a.table_schema='space_eye' AND a.table_name='devices'" | sql)"
echo "DELETE FROM space_eye_b.devices WHERE device_uid=(SELECT device_uid FROM space_eye.devices WHERE id=$ID);
      INSERT INTO space_eye_b.devices ($COLS) SELECT $COLS FROM space_eye.devices WHERE id=$ID;" | sql
afirmar "[ \"\$(echo \"SELECT COUNT(*) FROM space_eye_b.devices WHERE id=$ID\" | sql)\" = 1 ]" "la fila de la Pi esta en B (como al copiar la base)"
mudar "$A" "$ID" "{\"servidor\":\"$B_PI\"}" >/dev/null
afirmar "esperar_servidor '$B_PI' 30" "la Pi apunta a B"
O="$(esperar_orden space_eye "$ID")"
afirmar "[[ \"$O\" == done* ]]" "A recibio 'me mudo' (${O%%	*})"
sleep 20
afirmar "docker logs --since 60s $PI 2>&1 | grep -q 'MUDANZA: confirmada'" "el primer reporte en B confirmo la mudanza"
afirmar "[ \"$(version_en $B $ID)\" = 'pi-agent 0.7.2' ]" "B la ve como el MISMO equipo #$ID"
VISTA_B="$(echo "SELECT TIMESTAMPDIFF(SECOND, last_seen_at, NOW()) FROM space_eye_b.devices WHERE id=$ID" | sql)"
afirmar "[ -n \"$VISTA_B\" ] && [ \"$VISTA_B\" -lt 120 ]" "y reportando (hace ${VISTA_B}s)"

echo; echo "2) De vuelta a A (tambien existe alla): desde B, sin codigo"
mudar "$B" "$ID" "{\"servidor\":\"$A_PI\"}" >/dev/null
afirmar "esperar_servidor '$A_PI' 30" "la Pi regreso a A"
sleep 20

echo; echo "3) A un servidor que no existe: NO se mueve"
mudar "$A" "$ID" "{\"servidor\":\"http://host.docker.internal:4999\"}" >/dev/null
O="$(esperar_orden space_eye "$ID")"
afirmar "[[ \"$O\" == failed*'no pude hablar con el servidor nuevo'* ]]" "A recibio el motivo"
afirmar "[ \"$(servidor_de_la_pi)\" = '$A_PI' ]" "y la Pi sigue en A"

echo; echo "4) A un servidor donde NO existe"
echo "DELETE FROM space_eye_b.devices WHERE id=$ID" | sql
mudar "$A" "$ID" "{\"servidor\":\"$B_PI\"}" >/dev/null
O="$(esperar_orden space_eye "$ID")"
afirmar "[[ \"$O\" == failed*'no conoce este equipo'* ]]" "sin codigo, B la rechaza y A recibe el motivo"
afirmar "[ \"$(servidor_de_la_pi)\" = '$A_PI' ]" "la Pi sigue en A"
CODIGO="$(api -X POST "$B/api/vinculaciones" -d '{"tipo":"raspberry","nota":"mudanza con codigo"}' | json 'o.codigo')"
mudar "$A" "$ID" "{\"servidor\":\"$B_PI\",\"codigo\":\"$CODIGO\"}" >/dev/null
afirmar "esperar_servidor '$B_PI' 30" "con un codigo de B ($CODIGO) se muda"
sleep 20
NUEVO="$(docker exec $PI cat /home/pi/pi-agent/state.json | json 'o.device_id')"
ESTADO="$(api "$B/api/vinculaciones" | json "o.vinculaciones.find(v=>v.codigo==='$CODIGO')?.estado")"
afirmar "[ \"$ESTADO\" = usado ] && [ -n \"$NUEVO\" ]" "entra a B como equipo #$NUEVO y el codigo queda usado"
mudar "$B" "$NUEVO" "{\"servidor\":\"$A_PI\"}" >/dev/null
afirmar "esperar_servidor '$A_PI' 30" "y regresa a A"
sleep 20

echo; echo "5) B se cae justo despues de la mudanza: la Pi regresa SOLA (plazo de 2 min)"
mudar "$A" "$ID" "{\"servidor\":\"$B_PI\",\"mudanza_espera_min\":2}" >/dev/null
for _ in $(seq 1 100); do docker logs --since 20s $PI 2>&1 | grep -q 'MUDANZA: listo para' && break; sleep 0.3; done
docker pause eyes-b >/dev/null
echo "   B en pausa (no contesta); esperando el plazo..."
afirmar "esperar_servidor '$A_PI' 120" "la Pi volvio sola a A"
docker unpause eyes-b >/dev/null
sleep 25
afirmar "docker logs --since 5m $PI 2>&1 | grep -q 'regreso a $A_PI'" "su registro dice por que regreso"
LOG_A="$(echo "SELECT COUNT(*) FROM space_eye.device_logs WHERE device_id=$ID AND category='mudanza' AND message LIKE '%regreso solo%' AND logged_at > NOW() - INTERVAL 10 MINUTE" | sql)"
afirmar "[ \"${LOG_A:-0}\" -ge 1 ]" "y A lo muestra en el registro del equipo"

echo
[ "$fallos" -eq 0 ] && echo "TODO BIEN." || echo "$fallos FALLAS."
exit "$fallos"
