#!/usr/bin/env bash
# ============================================================================
#  entorno-instancia.sh — la configuracion de una instancia, escrita UNA vez.
# ----------------------------------------------------------------------------
#  QUE ES
#  Lo que decide COMO se escriben `app.env` e `instancia.env` en la maquina de
#  un cliente, y QUE valores se niega uno a escribir. Nada mas. Este archivo se
#  SOURCEA; no se ejecuta y no hace nada por si solo.
#
#    infra/scripts/provision-instancia.sh   nosotros creamos el servidor del
#                                           cliente y empujamos por ssh
#    infra/scripts/instalar-hijo.sh         el cliente pone su droplet y corre
#                                           el instalador DENTRO de la maquina
#
#  POR QUE EXISTE — el fallo que lo motivo, medido
#  Esto estuvo escrito UNA vez y en el guion equivocado. `instalar-hijo.sh`
#  (2026-09-11) entrecomillaba y validaba; `provision-instancia.sh` --el camino
#  por el que se dio de alta a los clientes que HAY-- escribia los dos archivos
#  con `sed` crudo: sin comillas y sin rechazar nada. Es la zona R7 de
#  `vault/06-Operacion/zonas-de-riesgo.md`.
#
#  El modo de fallo, que es lo que lo hace ROJO: `update.sh` hace `. "$CONF"`
#  sobre `instancia.env` (`update.sh:750`) como root, por cron, cada noche. Ese
#  archivo no es texto: es bash. Un valor con un espacio dentro y sin comillas
#  --`REGISTRY_TOKEN=tok canario`-- no es una asignacion, es `canario`
#  EJECUTADO con `REGISTRY_TOKEN=tok` en su entorno. No da error, no lo dice
#  nadie, y pasa en el servidor de un cliente. Medido el 2026-09-14: el arnes
#  puso un canario en el PATH y sourcear el archivo que el alta habia escrito
#  lo ejecuto.
#
#  Escrito una sola vez, un arreglo aqui llega a los dos caminos o a ninguno.
#  Es el mismo patron, y por el mismo motivo, que `base-instancia.sh` con los
#  privilegios de los roles de Postgres.
#
#  COMO ESTA ESCRITO — las dos reglas que no se rompen
#   1. SON DOS FUNCIONES DE ESCRITURA, NO UNA CON UN `if`. `instancia.env` lo
#      SOURCEA bash y sus valores van ENTRECOMILLADOS; `app.env` lo lee Docker
#      como `--env-file` y van TAL CUAL, porque Docker no interpreta las
#      comillas: se las queda DENTRO del valor. Unirlas "para simplificar" es
#      exactamente como nacio el defecto que dejaba una instancia servida y sin
#      poder actualizarse jamas. NO SE VUELVAN A UNIR.
#   2. LAS COMILLAS Y LA VALIDACION SON COMPLEMENTARIAS, no alternativas. Las
#      comillas atrapan el espacio; no atrapan una comilla doble (que las
#      cierra) ni `$`/backtick (que se expanden DENTRO de ellas). Por eso todo
#      lo que llega a estas funciones tiene que haber pasado antes por
#      `validar_valor_seguro()` en el llamador.
#
#  Quien lo sourcea le pone nombre a sus mensajes con `ENTORNO_GUION`, para que
#  el operador lea el nombre del guion que corrio y no el de este archivo.
# ============================================================================

ENTORNO_GUION="${ENTORNO_GUION:-alta}"

# Rechaza un valor que un archivo SOURCEADO por bash (`instancia.env`,
# `app.env`, via `update.sh`) no puede llevar sin riesgo: comillas dobles,
# `$`, un backtick o una barra invertida bastan para que una asignacion se
# convierta en codigo que se ejecuta como root la proxima vez que el cron
# corra `update.sh` a las 4:17. Documentado en CLAUDE.md, y ya paso una vez
# con un espacio sin comillas -- esto va mas lejos que comillas: rechaza en
# vez de intentar escapar, porque escapar a mano este conjunto es como se
# llega al defecto de `sed` que esta misma ronda encontro (M1).
validar_valor_seguro() {
  local etiqueta="$1" valor="$2"
  case "$valor" in
    *'"'*|*'$'*|*'`'*|*'\'*)
      echo "$ENTORNO_GUION: $etiqueta trae un caracter que no se puede escribir con seguridad" >&2
      echo "  en un archivo que \`update.sh\` sourcea (comillas dobles, \$," >&2
      echo "  backtick o barra invertida). No se adivina que se quiso decir:" >&2
      echo "  se rechaza." >&2
      exit "${EX_USO:-64}"
      ;;
  esac
  if [[ "$valor" == *$'\n'* ]]; then
    echo "$ENTORNO_GUION: $etiqueta trae un salto de linea. No se escribe." >&2
    exit "${EX_USO:-64}"
  fi
}


# Reescribe una plantilla de entorno linea por linea, EN BASH -- nunca con
# `sed`. Dos razones, las dos de esta ronda de correccion:
#   1. `sed -e "s#...#$VALOR#"` pasa el VALOR como parte del propio programa
#      de `sed`, y ese programa es un argumento de linea de comandos: un
#      token queda en el `ps` de esta maquina mientras `sed` corre (I6).
#   2. Un valor con `&`, `/` o una barra invertida CORROMPE la sustitucion
#      -- son caracteres especiales del lado derecho de un `s///` -- y un
#      token de DigitalOcean o de Spaces puede traer cualquiera de los tres
#      sin que nadie lo note hasta que la instancia no arranca (M1, medido
#      por el revisor: `ab&cd` quedaba escrito como `abREGISTRY_TOKEN=cd`).
# Una funcion de bash no genera un proceso nuevo (no hay `exec` de por
# medio), asi que los valores tampoco aparecen en NINGUN `ps` al pasarlos
# como argumentos de esta funcion, y la comparacion de cadenas no interpreta
# nada del valor: es texto literal, siempre.
#
# HASTA la tarea 11 esto era UNA sola funcion para los DOS archivos que se
# escriben abajo, y siempre ENTRECOMILLABA el valor. Eso rompia `app.env`:
# nadie lo sourcea, lo lee Docker como `--env-file`, y `update.sh` ya traia
# escrito por que se lee asi (`update.sh:1427-1430`): *"Formato --env-file de
# docker: CLAVE=valor, sin comillas ni export. Por eso se lee con grep y no
# con '.': sourcearlo interpretaria las comillas de otra manera que docker, y
# ahi es donde nacen las diferencias invisibles."* Docker no las quita: se
# las queda DENTRO del valor. Con eso, `url_de_env_app()` (grep+cut, sin
# sourcear -- el mismo motivo de arriba) leia el `DATABASE_URL` de `app.env`
# CON las comillas puestas, `update.sh:1440-1443` lo comparaba contra el de
# `instancia.env` (que si se sourcea, y sale SIN comillas), los dos destinos
# no coincidian nunca, y el cron paraba con `EX_CONFIG` en su primera corrida:
# la instancia quedaba servida pero sin poder actualizarse jamas.
#
# La regla, en una frase: UN archivo, UN parser. Por eso hay DOS funciones, no
# una con un `if`: `instancia.env` la SOURCEA bash (`update.sh` hace
# `. "$CONF"`) y sus valores TIENEN que ir entrecomillados, o un valor con un
# espacio ejecuta su segunda palabra como root cada noche (I7, documentado en
# CLAUDE.md). `app.env` lo lee Docker y sus valores van TAL CUAL: Docker no
# interpreta comillas, las conserva como parte del dato. NO SE VUELVAN A
# UNIR "para simplificar" -- es exactamente asi como nacio este defecto.
#
# Las dos siguen recibiendo solo valores que ya pasaron por
# `validar_valor_seguro()` en el llamador: que un valor vaya sin comillas en
# `app.env` no lo hace seguro por si mismo -- lo hace seguro que ya se haya
# rechazado antes lo que no puede llevar. Y el peligro cambia de FORMA en un
# `--env-file`: no hay ejecucion de palabras (no lo sourcea nadie), pero un
# SALTO DE LINEA dentro de un valor inventa una variable nueva -- por eso
# `validar_valor_seguro()` lo rechaza tambien, antes de que el valor llegue
# a cualquiera de las dos funciones.
reescribir_env_sourceado() {
  local plantilla="$1"; shift
  local linea clave valor par encontrado
  while IFS= read -r linea || [[ -n "$linea" ]]; do
    # Si la plantilla trae CRLF (medido: un checkout de Windows con
    # `core.autocrlf=true` deja `infra/env/*.example` asi, aunque el
    # repositorio guarda LF), `read -r` solo quita el `\n` y el `\r` se queda
    # pegado al final de la linea. Sin esto, la comparacion de clave sigue
    # funcionando (el `\r` cae DESPUES del `=`), pero el VALOR que se
    # preserva de una linea sin reemplazo arrastraria el `\r`, y quien lea el
    # archivo instalado veria un caracter invisible al final de cada linea
    # asi. Se quita aqui, una sola vez, en vez de en cada sitio que use esta
    # funcion.
    linea="${linea%$'\r'}"
    if [[ "$linea" =~ ^([A-Z_][A-Z0-9_]*)= ]]; then
      clave="${BASH_REMATCH[1]}"
      encontrado=0
      for par in "$@"; do
        if [[ "$par" == "$clave="* ]]; then
          valor="${par#*=}"
          encontrado=1
          break
        fi
      done
      if [[ "$encontrado" -eq 1 ]]; then
        printf '%s="%s"\n' "$clave" "$valor"
        continue
      fi
    fi
    printf '%s\n' "$linea"
  done < "$plantilla"
}

# Hermana de la de arriba, para `app.env`. MISMO recorrido linea por linea,
# MISMA plantilla, MISMA razon para estar escrita en bash y no con `sed` --
# la unica diferencia, y la que tiene que quedarse asi, es que el valor
# sustituido va SIN comillas: son dos parsers de dos formatos distintos, y
# unificarlos es el defecto que esta funcion existe para no repetir (ver el
# comentario de arriba).
reescribir_env_docker() {
  local plantilla="$1"; shift
  local linea clave valor par encontrado
  while IFS= read -r linea || [[ -n "$linea" ]]; do
    linea="${linea%$'\r'}"
    if [[ "$linea" =~ ^([A-Z_][A-Z0-9_]*)= ]]; then
      clave="${BASH_REMATCH[1]}"
      encontrado=0
      for par in "$@"; do
        if [[ "$par" == "$clave="* ]]; then
          valor="${par#*=}"
          encontrado=1
          break
        fi
      done
      if [[ "$encontrado" -eq 1 ]]; then
        printf '%s=%s\n' "$clave" "$valor"
        continue
      fi
    fi
    printf '%s\n' "$linea"
  done < "$plantilla"
}
