#!/usr/bin/env bash
# ============================================================================
#  Ensayo de la vigilancia de la pantalla en la Raspberry, sin Pi y sin sitio.
# ----------------------------------------------------------------------------
#  Requiere la Pi simulada ya en 0.7.0 (ensayar-actualizacion.sh) y, en
#  datos-locales/pi/feed/, fotos de UNA pantalla desde el mismo encuadre con
#  contenido distinto (las del telefono de pruebas del 1-oct: su monitor de
#  5x3 "gabinetes", con el marco ya medido en el panel).
#
#  Lo que se comprueba, igual que se probo el telefono el 28-sep:
#    1. Con la pantalla sana, la primera vuelta aprende y no avisa.
#    2. Se "apaga" la columna izquierda (5 gabinetes) en la camara: tras dos
#       vueltas separadas, llega UNA alerta agrupada con su foto de evidencia.
#    3. Se "enciende" de nuevo: tras dos vueltas sanas la falla se cierra sola.
#
#  Las vueltas van cada 5 min (el minimo), asi que tarda ~30 min. Uso:
#    bash infra/ensayo-pi/ensayar-vigilancia.sh
# ============================================================================
set -uo pipefail
export MSYS_NO_PATHCONV=1
API=http://127.0.0.1:4200
PI=pi-simulada-1
WSL() { wsl.exe -d Ubuntu -- bash -lc "$1"; }
LLAVE="$(WSL 'sed -n "s/^INSTANCIA_LLAVE=//p" ~/hijo/etc/eyes.env' | tr -d '\r')"
se() { curl -s -H "Authorization: Bearer $LLAVE" -H 'Content-Type: application/json' "$@"; }
jq_() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log(eval(process.argv[1]))})' "$1"; }
fallos=0
afirmar() { if eval "$1"; then echo "  ok     $2"; else echo "  FALLA  $2"; fallos=$((fallos+1)); fi; }
ID="$(docker exec $PI cat /home/pi/pi-agent/state.json | jq_ 'o.device_id')"
fallas() { se "$API/api/fallas?device_id=$ID&limit=20"; }
esperar() {  # $1 condicion sobre `o` (lista de fallas), $2 minutos
  for _ in $(seq 1 $(( $2 * 6 ))); do
    [ "$(fallas | jq_ "$1")" = "true" ] && return 0; sleep 10
  done; return 1
}

echo "Pi simulada: equipo #$ID"
afirmar "docker exec $PI python3 -c 'import cv2' 2>/dev/null" "tiene OpenCV (viene de la actualizacion)"

echo; echo "0) La camara de ensayo: el monitor del telefono de pruebas con un loop de anuncios"
# Un espectacular cambia de anuncio cada pocos segundos. Cuatro fotos casi
# iguales del monitor no bastan: la vigilancia ve tan poco movimiento que no da
# la pantalla por funcionando y se queda aprendiendo (asi paso el 5-oct). Se
# monta un anuncio distinto en el marco de la pantalla (fotos de otros sitios en
# datos-locales/pi/anuncios), y la variante con falla apaga la columna izquierda
# con el mismo marco que vigila el equipo.
docker exec $PI sh -c 'rm -rf /camara/sana /camara/falla; mkdir -p /camara/sana /camara/falla'
docker exec -i $PI python3 - <<'PY'
import cv2, glob, numpy as np
esq = np.float32([[0.274, 0.165], [0.76, 0.192], [0.773, 0.386], [0.309, 0.413]])
filas, cols = 5, 3
base = cv2.imread('/ensayo/feed/a.jpg', cv2.IMREAD_IGNORE_ORIENTATION | cv2.IMREAD_COLOR)
h, w = base.shape[:2]
quad = np.float32(esq * [w, h])
anuncios = sorted(glob.glob('/ensayo/anuncios/*.jpg'))[:10]
for n, f in enumerate(anuncios):
    an = cv2.imread(f, cv2.IMREAD_IGNORE_ORIENTATION | cv2.IMREAD_COLOR)
    ah, aw = an.shape[:2]
    H = cv2.getPerspectiveTransform(np.float32([[0, 0], [aw, 0], [aw, ah], [0, ah]]), quad)
    pegado = cv2.warpPerspective(an, H, (w, h))
    mascara = cv2.warpPerspective(np.full((ah, aw), 255, np.uint8), H, (w, h))
    im = base.copy()
    im[mascara > 0] = pegado[mascara > 0]
    cv2.imwrite('/camara/sana/%02d.jpg' % n, im, [cv2.IMWRITE_JPEG_QUALITY, 90])
    U = cv2.getPerspectiveTransform(np.float32([[0, 0], [1, 0], [1, 1], [0, 1]]), quad)
    for fila in range(filas):
        celda = np.float32([[[0, fila / filas], [1 / cols, fila / filas], [1 / cols, (fila + 1) / filas], [0, (fila + 1) / filas]]])
        cv2.fillPoly(im, cv2.perspectiveTransform(celda, U).astype(np.int32), (8, 8, 8))
    cv2.imwrite('/camara/falla/%02d.jpg' % n, im, [cv2.IMWRITE_JPEG_QUALITY, 90])
print('   %d anuncios en el loop (sana y con la columna 1 apagada)' % len(anuncios))
PY
# Cambia de anuncio cada 4 s; /camara/modo dice si se ve sana o con falla.
# `docker exec -d`: un proceso en segundo plano lanzado con `&` dentro de un exec
# normal muere al terminar el exec, y la camara se queda en una sola imagen (la
# vigilancia lo ve, con razon, como pantalla congelada). Tambien muere al
# reiniciar el contenedor: por eso se lanza despues del restart.
alimentar() {
  docker exec $PI sh -c 'pkill -f alimentar-camara 2>/dev/null; true'
  docker exec -d $PI bash -c 'exec -a alimentar-camara bash -c "while :; do for f in \$(ls /camara/sana); do m=\$(cat /camara/modo); cp /camara/\$m/\$f /camara/.t.jpg && mv /camara/.t.jpg /camara/actual.jpg; sleep 4; done; done"'
}
docker exec $PI sh -c 'echo sana > /camara/modo'

echo; echo "1) Marcar la pantalla y encender la vigilancia (cada 5 min, sin aprendizaje largo)"
se -X PUT "$API/api/devices/$ID/pantalla" -d '{"esquinas":[[0.274,0.165],[0.76,0.192],[0.773,0.386],[0.309,0.413]],"filas":5,"columnas":3,"excluir":[],"horario":{"inicio":"00:00","fin":"24:00"}}' >/dev/null
se -X PUT "$API/api/devices/$ID/salud" -d '{"vigilar":true,"cada_min":5,"confirmaciones":2,"aprendizaje_min":0}' >/dev/null
# Cierra las fallas que dejo un ensayo anterior (p. ej. la pantalla negra del de
# envio y apagon): si no, "pantalla sana: ninguna alerta" ve la de antes.
echo "UPDATE pantalla_fallas SET estado='recuperada', recuperada_en=NOW(), cerrada_por='usuario', nota='ensayo' WHERE device_id=$ID AND estado='abierta'" | wsl.exe -d Ubuntu -- bash /mnt/c/Users/hm284/Space_eye/infra/ensayo-pi/sql.sh >/dev/null
# Empieza de cero (sin lo aprendido en un ensayo anterior) y pide la configuracion al arrancar.
docker exec $PI sh -c 'rm -rf /home/pi/pi-agent/pantalla'
docker restart $PI >/dev/null
alimentar
sleep 10
afirmar "docker exec $PI sh -c 'a=\$(md5sum < /camara/actual.jpg); sleep 5; [ \"\$a\" != \"\$(md5sum < /camara/actual.jpg)\" ]'" "la camara de ensayo cambia de contenido"
echo "   esperando la primera vuelta (aprende)..."; sleep 330
afirmar "docker logs --since 6m $PI 2>&1 | grep -q '\[vision\]'" "monitor.py dio su vuelta"
afirmar "[ \"\$(fallas | jq_ 'o.fallas.filter(f=>f.estado===\"abierta\").length')\" = 0 ]" "pantalla sana: ninguna alerta"

echo; echo "2) Se apaga la columna izquierda"
docker exec $PI sh -c 'echo falla > /camara/modo'
afirmar "esperar 'o.fallas.some(f=>f.estado===\"abierta\" && /zona_apagada/.test(f.tipo))' 20" "llego la alerta de gabinetes apagados"
fallas | jq_ 'o.fallas.filter(f=>f.estado==="abierta").map(f=>`   #${f.id} ${f.tipo} ${JSON.stringify(f.detalle?.gabinetes||[f.fila,f.columna])} evidencia=${!!f.evidencia}`).join("\n")'
afirmar "[ \"\$(fallas | jq_ 'o.fallas.filter(f=>f.estado===\"abierta\").length')\" = 1 ]" "una sola alerta para los 5 gabinetes (agrupada)"

echo; echo "3) Se enciende otra vez"
docker exec $PI sh -c 'echo sana > /camara/modo'
afirmar "esperar 'o.fallas.some(f=>f.estado===\"recuperada\" && f.cerrada_por===\"equipo\")' 20" "la falla se cerro sola (cerrada por el equipo)"

echo
[ "$fallos" -eq 0 ] && echo "TODO BIEN." || echo "$fallos FALLAS."
exit "$fallos"
