#!/usr/bin/env bash
# ============================================================================
#  revisar.sh — lo que hay que comprobar ANTES de subir nada al droplet.
# ----------------------------------------------------------------------------
#    bash infra/revisar.sh
#
#  No es una bateria de pruebas: es la lista de las cosas que YA se rompieron
#  una vez. Cada comprobacion esta aqui porque costo una tarde encontrarla.
#
#    1. Dialogos del navegador. Chrome encabeza `alert`/`confirm`/`prompt` con
#       la direccion del servidor -«159.203.188.58:4200 dice»-: al operador se
#       le ensenaba una IP con un puerto. Se migraron a los dialogos de la casa
#       y esto impide que vuelvan por descuido.
#    2. Sintaxis del JavaScript del panel. No hay compilador que lo cace: un
#       parentesis de mas se descubre con la pagina en blanco, en produccion.
#    3. El CSS cuadra. Un `*/` de mas dejo de recortar el visor del vivo y la
#       pagina siguio pintando como si nada.
#    4. Ningun puerto de anfitrion se repite entre pilas. Si dos pelean un
#       puerto, la segunda no levanta y la primera -la que usa la gente- ya no
#       vuelve si alguien la reinicia.
#    5. El vhost apunta a donde V2 publica de verdad, no a donde publicaba.
#    6. No hay ningun .env con secretos versionado.
#
#  Devuelve 0 si todo esta bien, 1 si algo no lo esta. No toca ningun archivo.
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."

FALLOS=0
rojo()  { printf '  \033[31m%s\033[0m\n' "$*"; FALLOS=$((FALLOS+1)); }
verde() { printf '  \033[32m%s\033[0m\n' "$*"; }
paso()  { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ─── 1. Dialogos del navegador ──────────────────────────────────────────────
paso "1) Dialogos del navegador en el panel"
# Se ignoran los comentarios: en varios sitios se explica POR QUE ya no se usan.
SUCIOS=$(grep -rnE '(^|[^.[:alnum:]_])(alert|confirm|prompt)[[:space:]]*\(' \
           frontend/src/js frontend/public --include=*.js --include=*.html 2>/dev/null \
         | grep -vE ':[0-9]+:[[:space:]]*(//|\*|<!--)' \
         | grep -vE 'window\.(confirmar|pedirTexto|confirmarEscribiendo)')
if [[ -n "$SUCIOS" ]]; then
  rojo "Volvio un dialogo del navegador. Usa window.confirmar / window.pedirTexto:"
  echo "$SUCIOS" | sed 's/^/     /'
else
  verde "ninguno: todos los avisos son de la casa"
fi

# ─── 2. Sintaxis del JavaScript ─────────────────────────────────────────────
paso "2) Sintaxis del JavaScript del panel"
MALOS=0
while IFS= read -r f; do
  node --check "$f" 2>/dev/null || { rojo "no compila: $f"; MALOS=$((MALOS+1)); }
done < <(find frontend/src/js -name '*.js')
[[ "$MALOS" -eq 0 ]] && verde "$(find frontend/src/js -name '*.js' | wc -l | tr -d ' ') archivos, todos bien"

# ─── 3. El CSS cuadra ───────────────────────────────────────────────────────
paso "3) Llaves y comentarios del CSS"
node -e '
  const fs = require("fs");
  const css = fs.readFileSync("frontend/src/css/styles.css", "utf8");
  const abren = (css.match(/\/\*/g) || []).length, cierran = (css.match(/\*\//g) || []).length;
  const sin = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const a = (sin.match(/{/g) || []).length, c = (sin.match(/}/g) || []).length;
  if (abren !== cierran) { console.log(`comentarios descuadrados: ${abren} /* y ${cierran} */`); process.exit(1); }
  if (a !== c) { console.log(`llaves descuadradas: ${a} { y ${c} }`); process.exit(1); }
' && verde "comentarios y llaves cuadran" || rojo "el CSS no cuadra (ver arriba)"

# ─── 4. Puertos de anfitrion repetidos ──────────────────────────────────────
paso "4) Puertos de anfitrion, entre todas las pilas"
python - <<'PY' || FALLOS=$((FALLOS+1))
import io, re, sys, collections

# Solo se comparan las pilas que CONVIVEN en el droplet. `ip.yml` y `prod.yml`
# son dos formas alternativas de levantar LA MISMA instancia -por IP o por
# dominio-, asi que comparten puertos a proposito y nunca corren juntas; y
# `dev.yml` vive en la maquina de quien programa, no en el servidor.
JUNTAS = {
    'produccion': 'infra/docker-compose.prod.yml',
    'pruebas':    'infra/docker-compose.pruebas.yml',
    'V2':         'infra/deploy/v2/docker-compose.v2.yml',
}

usados = collections.defaultdict(list)
for nombre, f in JUNTAS.items():
    for n, linea in enumerate(io.open(f, encoding='utf-8'), 1):
        m = re.search(r'^\s*-\s*"?(\d+):\d+(/udp|/tcp)?"?\s*(#.*)?$', linea)
        if m:
            usados[m.group(1)].append('%s (%s:%d)' % (nombre, f, n))

mal = {p: d for p, d in usados.items() if len(d) > 1}
for p, d in sorted(mal.items(), key=lambda x: int(x[0])):
    print('  \033[31mel puerto %s lo pelean %d pilas:\033[0m' % (p, len(d)))
    for x in d:
        print('     ' + x)
if not mal:
    print('  \033[32m%s / %s / %s: %d puertos, ninguno repetido\033[0m'
          % tuple(list(JUNTAS) + [len(usados)]))
    print('     ' + ' '.join(sorted(usados, key=int)))
sys.exit(1 if mal else 0)
PY

# ─── 5. El vhost apunta a donde V2 publica ──────────────────────────────────
paso "5) El vhost de Apache contra los puertos reales de V2"
V2_HTTP=$(grep -oE '"[0-9]+:4000"' infra/deploy/v2/docker-compose.v2.yml | tr -d '"' | cut -d: -f1)
V2_WHEP=$(grep -oE '"[0-9]+:8889"' infra/deploy/v2/docker-compose.v2.yml | tr -d '"' | cut -d: -f1)
VH=infra/apache/eyes.g500.space-os.io.conf
for par in "$V2_HTTP:ProxyPass        / http://127.0.0.1" "$V2_WHEP:ProxyPass        /whep/ http://127.0.0.1"; do
  P="${par%%:*}"; AGUJA="${par#*:}"
  grep -qF "$AGUJA:$P/" "$VH" \
    && verde "$(echo "$AGUJA" | awk '{print $2}') -> $P, como publica el compose" \
    || rojo "el vhost NO apunta al $P para $(echo "$AGUJA" | awk '{print $2}')"
done
grep -qE "ws://127\.0\.0\.1:$V2_HTTP/socket\.io/" "$VH" \
  && verde "socket.io -> $V2_HTTP" || rojo "el socket.io del vhost no apunta al $V2_HTTP"

# ─── 6. Secretos versionados ────────────────────────────────────────────────
paso "6) Archivos con secretos que se hayan colado a git"
COLADOS=$(git ls-files | grep -E '(^|/)\.env' | grep -vE '\.example$' || true)
if [[ -n "$COLADOS" ]]; then
  rojo "hay .env versionados:"; echo "$COLADOS" | sed 's/^/     /'
else
  verde "ninguno (solo los .example, que no llevan secretos)"
fi

# ─── Resultado ──────────────────────────────────────────────────────────────
paso "RESULTADO"
if [[ "$FALLOS" -eq 0 ]]; then
  printf '\033[32mTodo bien. Se puede subir.\033[0m\n'
else
  printf '\033[31m%s comprobacion(es) fallaron. NO subas hasta arreglarlas.\033[0m\n' "$FALLOS"
  exit 1
fi
