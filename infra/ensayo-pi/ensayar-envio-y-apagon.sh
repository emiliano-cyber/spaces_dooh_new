#!/usr/bin/env bash
# ============================================================================
#  Ensayo de lo que pidio el dueno el 6-oct, en la Raspberry simulada:
#    · un creativo que sale UNA sola vez tiene que llegar en foto;
#    · "juntas cada N": las fotos nuevas NO salen al momento, llegan juntas
#      al cumplirse el plazo, una por creativo, y uno repetido no se reenvia;
#    · la pantalla COMPLETA apagada avisa en menos de ~1 minuto, una sola vez,
#      y la falla se cierra sola cuando vuelve.
#
#  Requiere: Space Eye local en :4200 con las migraciones 023 y 024 (space-eye
#  0.16.11-local o posterior), la Pi simulada y, en datos-locales/pi/,
#  feed/a.jpg (el encuadre) y anuncios/*.jpg (12 anuncios: los 9 primeros son
#  el loop, los 3 ultimos los que salen una sola vez).
#
#  Tarda ~35 min (la falla se cierra con la revision de siempre). Uso:
#    bash infra/ensayo-pi/ensayar-envio-y-apagon.sh
# ============================================================================
set -uo pipefail
export MSYS_NO_PATHCONV=1
API=http://127.0.0.1:4200
PI=pi-simulada-1
VERSION="pi-agent 0.7.5"
WSL() { wsl.exe -d Ubuntu -- bash -lc "$1"; }
LLAVE="$(WSL 'sed -n "s/^INSTANCIA_LLAVE=//p" ~/hijo/etc/eyes.env' | tr -d '\r')"
se() { curl -s -H "Authorization: Bearer $LLAVE" -H 'Content-Type: application/json' "$@"; }
jq_() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log(eval(process.argv[1]))})' "$1"; }
fallos=0
afirmar() { if eval "$1"; then echo "  ok     $2"; else echo "  FALLA  $2"; fallos=$((fallos+1)); fi; }
ID="$(docker exec $PI cat /home/pi/pi-agent/state.json | jq_ 'o.device_id')"
version() { se "$API/api/devices/$ID" | jq_ 'o.device.app_version'; }
# Creativos con foto (los hallazgos que vio el cliente).
con_foto() { se "$API/api/devices/$ID/creativos" | jq_ '(o.creativos||[]).filter(c=>c.photo_id).length'; }
fallas() { se "$API/api/fallas?device_id=$ID&limit=20"; }
apagadas_abiertas() { fallas | jq_ 'o.fallas.filter(f=>f.tipo==="pantalla_apagada" && f.estado==="abierta").length'; }
esperar() {  # $1 comando que imprime true, $2 segundos
  local t0=$SECONDS
  while [ $((SECONDS - t0)) -lt "$2" ]; do [ "$(eval "$1")" = "true" ] && return 0; sleep 5; done; return 1
}

echo "Pi simulada: equipo #$ID ($(version))"

echo; echo "0) Se actualiza a $VERSION por la red"
se -X POST "$API/api/devices/$ID/command" -d '{"command_type":"UPDATE_APP"}' >/dev/null
esperar '[ "$(version)" = "$VERSION" ] && echo true' 300
afirmar "[ \"\$(version)\" = '$VERSION' ]" "reporta $VERSION"

echo; echo "1) La camara de ensayo: 9 anuncios en loop, 3 que salen una vez, y la pantalla negra"
docker exec $PI sh -c 'rm -rf /camara/sana /camara/negra /camara/unicos; mkdir -p /camara/sana /camara/negra /camara/unicos'
docker exec -i $PI python3 - <<'PY'
import cv2, glob, numpy as np
esq = np.float32([[0.274, 0.165], [0.76, 0.192], [0.773, 0.386], [0.309, 0.413]])
base = cv2.imread('/ensayo/feed/a.jpg', cv2.IMREAD_IGNORE_ORIENTATION | cv2.IMREAD_COLOR)
h, w = base.shape[:2]
quad = np.float32(esq * [w, h])
def montar(f):
    an = cv2.imread(f, cv2.IMREAD_IGNORE_ORIENTATION | cv2.IMREAD_COLOR)
    ah, aw = an.shape[:2]
    H = cv2.getPerspectiveTransform(np.float32([[0, 0], [aw, 0], [aw, ah], [0, ah]]), quad)
    pegado = cv2.warpPerspective(an, H, (w, h))
    mascara = cv2.warpPerspective(np.full((ah, aw), 255, np.uint8), H, (w, h))
    im = base.copy()
    im[mascara > 0] = pegado[mascara > 0]
    return im
anuncios = sorted(glob.glob('/ensayo/anuncios/*.jpg'))
assert len(anuncios) >= 12, len(anuncios)
for n, f in enumerate(anuncios[:9]):
    cv2.imwrite('/camara/sana/%02d.jpg' % n, montar(f), [cv2.IMWRITE_JPEG_QUALITY, 90])
    # Apagada: la pantalla entera negra, lo de alrededor igual de iluminado.
    im = base.copy()
    cv2.fillPoly(im, [quad.astype(np.int32)], (6, 6, 6))
    cv2.imwrite('/camara/negra/%02d.jpg' % n, im, [cv2.IMWRITE_JPEG_QUALITY, 90])
for n, f in enumerate(anuncios[9:12]):
    cv2.imwrite('/camara/unicos/%d.jpg' % n, montar(f), [cv2.IMWRITE_JPEG_QUALITY, 90])
# Los anuncios 8 y 9 son el MISMO creativo fotografiado en dos sitios: el
# equipo los ve, con razon, como uno solo. Para dos creativos distintos de una
# sola vez, el 7 espejeado (otro dibujo para el reconocedor).
espejo = cv2.flip(cv2.imread(anuncios[9], cv2.IMREAD_IGNORE_ORIENTATION | cv2.IMREAD_COLOR), 1)
cv2.imwrite('/tmp/espejo.jpg', espejo)
cv2.imwrite('/camara/unicos/3.jpg', montar('/tmp/espejo.jpg'), [cv2.IMWRITE_JPEG_QUALITY, 90])
print('   9 en el loop, 4 de una sola vez')
PY
# Cambia de anuncio cada 12 s, como un spot real (10-20 s): el equipo confirma
# un creativo al verlo en dos miradas seguidas (cada 5 s), y con anuncios de 4 s
# casi nunca lo lograba. Si aparece /camara/una.jpg, sale UNA vez durante 15 s
# y se borra. `docker exec -d`: un `&` dentro
# de un exec normal muere al terminar el exec.
alimentar() {
  docker exec $PI sh -c 'pkill -f alimentar-camara 2>/dev/null; true'
  docker exec -d $PI bash -c 'exec -a alimentar-camara bash -c "while :; do for f in \$(ls /camara/sana); do if [ -f /camara/una.jpg ]; then mv /camara/una.jpg /camara/.t.jpg && mv /camara/.t.jpg /camara/actual.jpg; sleep 15; fi; m=\$(cat /camara/modo); cp /camara/\$m/\$f /camara/.t.jpg && mv /camara/.t.jpg /camara/actual.jpg; sleep 12; done; done"'
}
una_vez() { docker exec $PI sh -c "cp /camara/unicos/$1.jpg /camara/.u.jpg && mv /camara/.u.jpg /camara/una.jpg"; }
docker exec $PI sh -c 'echo sana > /camara/modo; rm -f /camara/una.jpg'

echo; echo "2) Pantalla marcada, fallas y creativos en continuo, 5 min aprendiendo el loop, envio AL MOMENTO"
se -X PUT "$API/api/devices/$ID/pantalla" -d '{"esquinas":[[0.274,0.165],[0.76,0.192],[0.773,0.386],[0.309,0.413]],"filas":5,"columnas":3,"excluir":[],"horario":{"inicio":"00:00","fin":"24:00"}}' >/dev/null
se -X PUT "$API/api/devices/$ID/salud" -d '{"vigilar":true,"cada_min":5,"confirmaciones":2,"aprendizaje_min":5,"aviso_rapido":true}' >/dev/null
se -X PUT "$API/api/devices/$ID/creativos" -d '{"vigilar":true,"cada_min":0,"envio_min":0,"max_dia":20,"recorrido_seg":60,"paso_seg":5}' >/dev/null
afirmar "[ \"\$(se $API/api/devices/$ID/pantalla | jq_ 'o.salud.aviso_rapido')\" = true ]" "el servidor guarda aviso_rapido"
# Cierra las fallas de un ensayo anterior y empieza de cero: catalogo, lo aprendido y el lote.
echo "UPDATE pantalla_fallas SET estado='recuperada', recuperada_en=NOW(), cerrada_por='usuario', nota='ensayo' WHERE device_id=$ID AND estado='abierta'" | wsl.exe -d Ubuntu -- bash /mnt/c/Users/hm284/Space_eye/infra/ensayo-pi/sql.sh >/dev/null
se -X POST "$API/api/devices/$ID/creativos/reaprender" -d '{}' >/dev/null
docker exec $PI sh -c 'rm -rf /home/pi/pi-agent/pantalla'
docker restart $PI >/dev/null
alimentar
echo "   aprendiendo el loop (5 min, el loop dura 108 s)..."; sleep 400
afirmar "[ \"\$(con_foto)\" = 0 ]" "el loop aprendido no genera fotos"
BASE=$(con_foto)

echo; echo "3) Un creativo sale UNA sola vez (15 s) con envio al momento"
una_vez 0
afirmar "esperar '[ \$(con_foto) -gt $BASE ] && echo true' 150" "llego su foto"
N1=$(con_foto); echo "   creativos con foto: $N1"
sleep 60
afirmar "[ \"\$(con_foto)\" = \"$N1\" ]" "el loop de siempre no agrega nada mas"

echo; echo "4) Envio JUNTAS cada 3 min: dos que salen una vez no viajan al momento"
se -X PUT "$API/api/devices/$ID/creativos" -d '{"envio_min":3}' >/dev/null
# Que la Pi lo sepa: la huella de su configuracion viaja en el reporte de
# estado (cada 3 min) y la pide en la vuelta siguiente (1 min).
sleep 260
T0=$SECONDS
una_vez 1; sleep 30; una_vez 3; sleep 40
afirmar "[ \"\$(con_foto)\" = \"$N1\" ]" "a los ~60 s todavia no sube ninguna"
afirmar "docker exec $PI sh -c 'test -f /home/pi/pi-agent/pantalla/lote/lote.json'" "esperan en disco (lote.json)"
afirmar "esperar '[ \$(con_foto) -ge $((N1 + 2)) ] && echo true' 330" "llegaron juntas al cumplirse el plazo"
echo "   desde la primera: $((SECONDS - T0)) s"
afirmar "docker logs --since 10m $PI 2>&1 | grep -q 'Envio agrupado: 2 foto'" "en un solo envio de 2"
N2=$(con_foto)
una_vez 1; sleep 240
afirmar "[ \"\$(con_foto)\" = \"$N2\" ]" "uno que se repite no se vuelve a mandar"

echo; echo "5) Se apaga la pantalla COMPLETA"
docker exec $PI sh -c 'echo negra > /camara/modo'
T0=$SECONDS
afirmar "esperar '[ \$(apagadas_abiertas) -ge 1 ] && echo true' 180" "llego la alerta de pantalla apagada"
T_AVISO=$((SECONDS - T0)); echo "   tardo $T_AVISO s"
afirmar "[ $T_AVISO -le 90 ]" "en menos de 90 s (sin esperar la revision de cada 5 min)"
afirmar "[ \"\$(fallas | jq_ 'o.fallas.filter(f=>f.tipo===\"pantalla_apagada\" && f.estado===\"abierta\").every(f=>f.evidencia)')\" = true ]" "con su foto de evidencia"
sleep 240
afirmar "[ \"\$(apagadas_abiertas)\" = 1 ]" "sigue siendo UNA alerta (no una por vuelta)"
afirmar "[ \"\$(fallas | jq_ 'o.fallas.filter(f=>f.estado===\"abierta\" && f.tipo!==\"pantalla_apagada\").length')\" = 0 ]" "y no la duplica como gabinetes apagados"

echo; echo "6) Se enciende otra vez"
docker exec $PI sh -c 'echo sana > /camara/modo'
afirmar "esperar '[ \"\$(fallas | jq_ \"o.fallas.some(f=>f.tipo===\\\"pantalla_apagada\\\" && f.estado===\\\"recuperada\\\" && f.cerrada_por===\\\"equipo\\\")\")\" = true ] && echo true' 1500" "la falla se cerro sola (cerrada por el equipo)"

# Deja el envio al momento, como viene por omision.
se -X PUT "$API/api/devices/$ID/creativos" -d '{"envio_min":0}' >/dev/null
echo
[ "$fallos" -eq 0 ] && echo "TODO BIEN." || echo "$fallos FALLAS."
exit "$fallos"
