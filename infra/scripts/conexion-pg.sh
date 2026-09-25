#!/usr/bin/env bash
# ============================================================================
#  conexion-pg.sh - de `DATABASE_URL` a `pg_dump`, SIN pasar por `argv`.
# ----------------------------------------------------------------------------
#  Se SOURCEA. No hace nada por si solo y no tiene subcomandos: solo define
#  funciones. Hoy lo sourcea `infra/scripts/respaldo-diario.sh`.
#
#  --- QUE RESUELVE ---------------------------------------------------------
#  Cualquier cosa que quiera hablar con la base de una instancia tiene una
#  `DATABASE_URL` y necesita llamar a `pg_dump`. La forma obvia --
#  `pg_dump --dbname="$DATABASE_URL"` -- deja la contrasena en la linea de
#  comandos, o sea visible con `ps` para CUALQUIER usuario del droplet. Este
#  archivo la separa: a `argv` van cuatro banderas estructurales (`-h`, `-p`,
#  `-U`, `-d`) y todo lo demas viaja por variables `PG*` del entorno.
#
#  El invariante con el que se audita esto, copiado de `update.sh:1630`:
#  **en `argv` no aparece nada que venga del `userinfo` ni de la consulta, bajo
#  ninguna codificacion.**
#
# ============================================================================
#  /!\ /!\  ESTE ARCHIVO ES HOY UNA SEGUNDA COPIA. LEE ESTO ANTES DE TOCARLO.
# ============================================================================
#
#  Las seis funciones de abajo --`env_de_parametro`, `clasificar_consulta`,
#  `partir_url`, `destino_de_url`, `decodificar_porciento` y `correr_pg`-- estan
#  DUPLICADAS: viven tambien dentro de `update.sh`, entre sus lineas 1381 y
#  1737, y aqui estan copiadas LETRA POR LETRA.
#
#  --- Por que se duplica, que es una decision y no un descuido --------------
#  Habia tres caminos y los tres cuestan algo:
#
#    1. SOURCEAR `update.sh` para usar sus funciones. **Imposible, medido:**
#       `update.sh` no tiene guarda `[ "${BASH_SOURCE[0]}" = "$0" ]` por ningun
#       lado --`respaldo.sh:330` si la tiene--, asi que sourcearlo no importa
#       funciones: EJECUTA UN UPDATE. Pone `set -Eeuo pipefail` en su `:427` y
#       sigue de frente al `docker pull`, al respaldo, a las migraciones y al
#       reinicio del contenedor. Un guion de respaldo que actualiza la instancia
#       de madrugada es exactamente lo contrario de lo que se pedia.
#
#    2. EXTRAER la derivacion a este archivo Y QUE `update.sh` LO SOURCEE.
#       **Es el final bueno, y es el que NO se puede hacer hoy**: `update.sh`
#       esta desplegado en produccion en g500 y en DEMO ahora mismo, y su arnes
#       (`pruebas-update.sh`, 3776 lineas) tarda **15 minutos**. Ese cambio lo
#       tiene que hacer alguien que pueda correr ese arnes entero y mirar el
#       resultado, no de paso.
#
#    3. COPIAR. Es lo que hay aqui. El coste es real y es este: **hay dos
#       copias de la logica que separa una contrasena de una URL**, que es de
#       lo mas delicado del repositorio --le hicieron falta TRES ciclos de
#       arreglos para cerrarla, cada uno con otra codificacion del mismo nombre
#       (`update.sh:1613-1624`)--.
#
#  --- Y por eso la deuda NO es silenciosa ----------------------------------
#  El riesgo de una copia no es tenerla: es que se pudra sin que nadie lo vea.
#  Alguien arregla un cuarto ciclo en `update.sh` y esta copia se queda con el
#  fallo, cada noche, en la unica instancia con datos de cliente.
#
#  `pruebas-respaldo-diario.sh`, escenario **R7**, compara las seis funciones de
#  este archivo contra las de `update.sh` LETRA POR LETRA y se pone **ROJO** si
#  dejan de ser iguales. Corre en segundos.
#
#  >>> SI CAMBIAS UNA DE LAS DOS COPIAS, CAMBIA LA OTRA. O, mejor, cierra la
#  >>> deuda por el camino 2 y borra este aviso.
#
#  Lo que R7 **NO** cubre, y conviene saberlo: `pg_derivar_conexion`, al final
#  de este archivo. En `update.sh` esa logica no es una funcion sino codigo
#  suelto (su `:1644-1713`), asi que no hay nada contra lo que diferenciarla.
#  Es una adaptacion a mano y se revisa a mano.
#
#  --- La otra diferencia deliberada con `update.sh` -------------------------
#  Alli los errores llaman a `salir` y los avisos a `registrar`. Aqui no: este
#  archivo no sabe como registra ni con que codigo sale quien lo sourcea, asi
#  que `pg_derivar_conexion` devuelve != 0 y deja el texto en `PG_ERROR` /
#  `PG_AVISO`. Quien llama decide.
# ============================================================================

# --- env_de_parametro ----------------------------------------------------
env_de_parametro() {
  case "$1" in
    sslmode)              printf '%s' 'PGSSLMODE' ;;
    sslrootcert)          printf '%s' 'PGSSLROOTCERT' ;;
    sslcert)              printf '%s' 'PGSSLCERT' ;;
    sslkey)               printf '%s' 'PGSSLKEY' ;;
    application_name)     printf '%s' 'PGAPPNAME' ;;
    options)              printf '%s' 'PGOPTIONS' ;;
    connect_timeout)      printf '%s' 'PGCONNECT_TIMEOUT' ;;
    target_session_attrs) printf '%s' 'PGTARGETSESSIONATTRS' ;;
    *) return 1 ;;
  esac
}

# --- clasificar_consulta -------------------------------------------------
clasificar_consulta() {
  local completo="$1" consulta par nombre valor resto variable nombre_publicable
  URL_CONSULTA_CLAVE=''; URL_HAY_CONSULTA_CLAVE=0
  URL_CONSULTA_SSLCLAVE=''; URL_HAY_CONSULTA_SSLCLAVE=0
  URL_CONSULTA_ENV=(); URL_CONSULTA_NO_SOPORTADO=''
  case "$completo" in *'?'*) ;; *) return 0 ;; esac
  consulta="${completo#*'?'}"
  # El fragmento no es parte de la consulta y libpq no lo mira.
  consulta="${consulta%%'#'*}"
  resto="$consulta"
  while [ -n "$resto" ]; do
    par="${resto%%&*}"
    case "$resto" in *'&'*) resto="${resto#*&}" ;; *) resto='' ;; esac
    [ -n "$par" ] || continue
    nombre="$par"; valor=''
    case "$par" in *=*) nombre="${par%%=*}"; valor="${par#*=}" ;; esac
    # AQUI. Sin esta linea, `?%70assword=` es un parametro desconocido y la
    # contrasena acaba donde no debe. Con ella es `password`, igual que para
    # libpq. Y el VALOR se decodifica tambien: una variable de entorno no lleva
    # percent-encoding, asi que `options=-c%20statement_timeout%3D0` tiene que
    # llegar a `PGOPTIONS` como `-c statement_timeout=0` o Postgres recibe un
    # `-c` que no entiende.
    nombre="$(decodificar_porciento "$nombre")"
    valor="$(decodificar_porciento "$valor")"
    # Los nombres van en minusculas y sin tolerancia, como los escribe libpq:
    # `?PASSWORD=` no es un parametro de conexion —lo rechaza con «invalid URI
    # query parameter», medido—, asi que esa URL no ha funcionado nunca en
    # ninguna instancia y aqui no se le inventa un significado. Hasta el 19/08
    # ese era un "limite conocido" que dejaba el valor en argv; ahora cae por el
    # camino de abajo y el update se para antes de tocar nada.
    case "$nombre" in
      password)    URL_HAY_CONSULTA_CLAVE=1;    URL_CONSULTA_CLAVE="$valor";    continue ;;
      sslpassword) URL_HAY_CONSULTA_SSLCLAVE=1; URL_CONSULTA_SSLCLAVE="$valor"; continue ;;
    esac
    if variable="$(env_de_parametro "$nombre")"; then
      URL_CONSULTA_ENV+=("$variable=$valor")
    else
      # Se publica SOLO la tirada inicial de `[A-Za-z_0-9]`, que es la forma que
      # tiene un parametro de libpq. Todo lo demas se corta. Y esa poda no es
      # cosmetica: es lo unico que impide que una contrasena salga del droplet.
      #
      # Cuando el `=` que separa nombre y valor va PERCENT-ENCODED
      # (`?password%3DSECRETO`) no hay separador que partir arriba: `nombre` se
      # queda con el par entero y `decodificar_porciento` lo convierte en
      # `password=SECRETO`. Ese token acababa entero en el mensaje de `:944`,
      # que va al log PUBLICABLE — el que sube al bucket de la flota, donde dura
      # 90 dias y lo lee quien tenga la llave de logs, no la de la base.
      #
      # ⚠️ El primer arreglo (20/08) podaba por un `=` LITERAL, y duro una
      # auditoria: `decodificar_porciento` corre ANTES, asi que `%253D` llegaba
      # como `password%3DSECRETO` y no habia `=` que podar. Era una LISTA NEGRA
      # de una codificacion del separador — exactamente lo que este archivo ya
      # advertia en `:901-903`: «una lista negra sobre un espacio de nombres que
      # se decodifica no se puede demostrar completa. Siempre queda otra
      # codificacion». La leccion de M3, repetida por tercera vez.
      #
      # Por eso ahora es lista BLANCA sobre la FORMA del nombre: da igual
      # cuantas veces este codificado el separador, porque no se busca el
      # separador. Lo fijan E96-E101; E98 y E99 son los que impiden podar de mas.
      nombre_publicable="${nombre%%[!A-Za-z_0-9]*}"
      [ -n "$nombre_publicable" ] || nombre_publicable='(nombre no imprimible)'
      [ -n "$URL_CONSULTA_NO_SOPORTADO" ] || URL_CONSULTA_NO_SOPORTADO="$nombre_publicable"
    fi
  done
  return 0
}

# --- partir_url ----------------------------------------------------------
partir_url() {
  local url="$1" resto credencial usuario destino hostpuerto host_claro base_clara
  URL_ESQUEMA=''; URL_USUARIO=''; URL_CLAVE_CRUDA=''; URL_HAY_CLAVE=0
  URL_DESTINO=''; URL_DESTINO_COMPLETO=''
  URL_HOST=''; URL_PUERTO=''; URL_BASE_NOMBRE=''
  clasificar_consulta ''
  # Sin `esquema://` no es una URL: puede ser una cadena `clave=valor` de libpq,
  # que lleva la contrasena en mitad del texto y no tiene nada que recortar.
  case "$url" in *://*) ;; *) return 1 ;; esac
  URL_ESQUEMA="${url%%://*}"
  case "$URL_ESQUEMA" in ''|*[!a-zA-Z0-9+.-]*) URL_ESQUEMA=''; return 1 ;; esac
  resto="${url#*://}"
  case "$resto" in
    *@*)
      # `%@*` quita el sufijo MAS CORTO que casa con `@*`: corta por el ULTIMO
      # `@`. `##*@` se queda con lo que va detras de ese mismo `@`.
      credencial="${resto%@*}"
      URL_DESTINO_COMPLETO="${resto##*@}"
      usuario="${credencial%%:*}"
      case "$credencial" in *:*) URL_HAY_CLAVE=1; URL_CLAVE_CRUDA="${credencial#*:}" ;; esac
      # Un usuario con `/`, `?` o `#` significa que ese `@` no separaba ninguna
      # credencial, asi que no se sabe donde empieza el host ni si lo que se
      # tomo por clave lo es. No se adivina: no se publica.
      case "$usuario" in ''|*[!a-zA-Z0-9._~%+-]*) URL_ESQUEMA=''; URL_CLAVE_CRUDA=''; URL_HAY_CLAVE=0; URL_DESTINO_COMPLETO=''; return 1 ;; esac
      URL_USUARIO="$usuario"
      ;;
    *) URL_DESTINO_COMPLETO="$resto" ;;
  esac
  # `host[:puerto][/base]`, ya sin consulta ni fragmento: esto es lo unico de la
  # cadena que se puede publicar.
  destino="${URL_DESTINO_COMPLETO%%[?#]*}"
  if ! printf '%s' "$destino" | grep -Eq '^(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9._~%+-]+)(:[0-9]+)?(/[^/?#]*)?$'; then
    URL_ESQUEMA=''; URL_USUARIO=''; URL_CLAVE_CRUDA=''; URL_HAY_CLAVE=0; URL_DESTINO_COMPLETO=''
    return 1
  fi
  URL_DESTINO="$destino"
  # Y `host[:puerto][/base]` desarmado, porque desde el 19/08 esas tres piezas
  # van SUELTAS a `pg_dump` (`-h`, `-p`, `-d`) en vez de pegadas en una URL. El
  # host IPv6 pierde los corchetes: en la URL son sintaxis, en `-h` estorban.
  case "$destino" in
    */*) hostpuerto="${destino%%/*}"; URL_BASE_NOMBRE="${destino#*/}" ;;
    *)   hostpuerto="$destino"; URL_BASE_NOMBRE='' ;;
  esac
  case "$hostpuerto" in
    '['*']'*) URL_HOST="${hostpuerto%%']'*}"; URL_HOST="${URL_HOST#'['}"
              URL_PUERTO="${hostpuerto##*']'}"; URL_PUERTO="${URL_PUERTO#:}" ;;
    *:*)      URL_HOST="${hostpuerto%%:*}"; URL_PUERTO="${hostpuerto#*:}" ;;
    *)        URL_HOST="$hostpuerto"; URL_PUERTO='' ;;
  esac
  # ─── Segunda vuelta, sobre lo YA desarmado y DECODIFICADO ────────────────
  #
  # El recorte de arriba parte por un `?` CRUDO. Un `?` puede llegar como `%3F`,
  # y entonces la consulta entera se queda dentro del destino: `URL_BASE_NOMBRE`
  # acaba siendo `spaces?password=SECRETO`, que va a `-d` en el argv de
  # `pg_dump` —la fuga que M3 existe para cerrar— y a `base=` en la PRIMERA
  # LINEA de todo log que viaja al bucket, en la corrida NORMAL. Medido; es el
  # hallazgo H2 de la auditoria de `8f81c3e`.
  #
  # No se recorta mejor —eso seria otra lista negra, y `%253F` la volveria a
  # burlar—: se comprueba que las piezas decodificadas tengan FORMA de host y de
  # nombre de base, y si no la tienen se rechaza la URL entera. Fail-closed.
  # Un `?`, un `=` o un `%` ahi dentro no es un nombre de base: es otra cosa
  # escondida, y no se adivina lo que quiso decir quien la escribio.
  host_claro="$(decodificar_porciento "$URL_HOST")"
  base_clara="$(decodificar_porciento "$URL_BASE_NOMBRE")"
  case "$host_claro" in
    ''|*[!A-Za-z0-9._:-]*)
      URL_ESQUEMA=''; URL_USUARIO=''; URL_CLAVE_CRUDA=''; URL_HAY_CLAVE=0
      URL_DESTINO=''; URL_DESTINO_COMPLETO=''; URL_HOST=''; URL_BASE_NOMBRE=''
      return 1 ;;
  esac
  case "$base_clara" in
    *[!A-Za-z0-9._-]*)
      URL_ESQUEMA=''; URL_USUARIO=''; URL_CLAVE_CRUDA=''; URL_HAY_CLAVE=0
      URL_DESTINO=''; URL_DESTINO_COMPLETO=''; URL_HOST=''; URL_BASE_NOMBRE=''
      return 1 ;;
  esac

  # La credencial tambien puede venir en la consulta, y se separa AQUI: en el
  # unico parseo, para que no vuelvan a existir dos recortes que se
  # desincronizan al siguiente cambio.
  clasificar_consulta "$URL_DESTINO_COMPLETO"
  return 0
}

# --- destino_de_url ------------------------------------------------------
destino_de_url() {
  if partir_url "$1"; then printf '%s' "$URL_DESTINO"; else printf '%s' '(url no parseable)'; fi
}

# --- decodificar_porciento -----------------------------------------------
decodificar_porciento() {
  local s
  case "$1" in
    *%*) s="${1//\\/\\\\}"; printf '%b' "${s//%/\\x}" ;;
    *)   printf '%s' "$1" ;;
  esac
}

# --- correr_pg -----------------------------------------------------------
correr_pg() {
  local binario="$1" asignacion
  shift
  (
    for asignacion in ${PG_ENV[@]+"${PG_ENV[@]}"}; do export "$asignacion"; done
    exec "$binario" ${PG_BANDERAS[@]+"${PG_BANDERAS[@]}"} "$@"
  )
}

# --- La derivacion ---------------------------------------------------------
#  ADAPTADA de `update.sh:1644-1713`. NO la cubre el guard R7 (ver la cabecera).
#
#  Rellena `PG_BANDERAS`, `PG_ENV` y `PG_CLAVE`, que es lo que `correr_pg`
#  consume. Devuelve 0 si se pudo; si no, devuelve 1 y deja el motivo en
#  `PG_ERROR`, SIN publicar ni un trozo de la URL --lo que no se entiende puede
#  ser la contrasena--.
pg_derivar_conexion() {
  local url="$1"
  PG_BANDERAS=()
  PG_ENV=()
  PG_CLAVE=""
  PG_ERROR=""
  PG_AVISO=""

  if ! partir_url "$url"; then
    # Falla CERRADO, igual que `update.sh:1709-1712`. La alternativa --pasarla
    # entera a `--dbname`-- es la fuga que todo esto existe para cerrar, y encima
    # no funcionaria: si aqui no se pudo separar la clave, libpq tampoco va a
    # poder.
    PG_ERROR="no se puede interpretar DATABASE_URL como URL de conexion; base=(url no parseable). No se publica ni un trozo de esa cadena -lo que no se entiende puede ser la contrasena- y sin separarla no se puede respaldar sin dejarla en argv, visible con \`ps\` para cualquier proceso del droplet. La forma esperada es esquema://[usuario[:clave]@]host[:puerto]/base con la clave PERCENT-ENCODED: %40 por @, %2F por /, %3F por ? y %5C por la barra invertida."
    return 1
  fi

  # Lo unico que puede ir en argv: la parte ESTRUCTURAL. Ni es secreta ni sale
  # de la consulta. Se percent-decodifica porque una bandera de linea de
  # comandos no lleva percent-encoding: `-h` quiere el host, no su codificacion.
  PG_BANDERAS+=(-h "$(decodificar_porciento "$URL_HOST")")
  if [ -n "$URL_PUERTO" ]; then PG_BANDERAS+=(-p "$URL_PUERTO"); fi
  # Sin usuario NO se pasa `-U`, y sin base no se pasa `-d`: una bandera con el
  # valor vacio no es lo mismo que no pasarla --libpq cae al usuario del sistema
  # y a la base con su nombre--, y ahi se pierden las instancias que se
  # autentican por `peer`.
  if [ -n "$URL_USUARIO" ]; then PG_BANDERAS+=(-U "$(decodificar_porciento "$URL_USUARIO")"); fi
  if [ -n "$URL_BASE_NOMBRE" ]; then PG_BANDERAS+=(-d "$(decodificar_porciento "$URL_BASE_NOMBRE")"); fi

  # Un parametro de la consulta sin variable `PG*` por la que reenviarlo. Se
  # para: dejarlo pasar a argv es la fuga, y tragarselo en silencio cambia como
  # se conecta la instancia sin decirlo. El mensaje nombra el PARAMETRO, nunca
  # su valor --`clasificar_consulta` ya lo poda a la forma de un nombre de libpq.
  if [ -n "$URL_CONSULTA_NO_SOPORTADO" ]; then
    PG_ERROR="DATABASE_URL trae \`$URL_CONSULTA_NO_SOPORTADO\` en la consulta y no hay variable de entorno PG* por la que reenviarlo. Los que si viajan: sslmode, sslrootcert, sslcert, sslkey, application_name, options, connect_timeout y target_session_attrs."
    return 1
  fi

  if [ "$URL_HAY_CLAVE" = 1 ] && [ -n "$URL_CLAVE_CRUDA" ]; then
    PG_CLAVE="$(decodificar_porciento "$URL_CLAVE_CRUDA")"
  fi
  # La de la consulta manda sobre la del `userinfo`, que es lo que hace libpq
  # --medido el 19/08 contra un Postgres con `scram-sha-256` forzado--. Ojo: con
  # el valor VACIO libpq y `pg-connection-string` se SEPARAN; aqui se sigue a
  # libpq, que es quien va a conectar.
  if [ "$URL_HAY_CONSULTA_CLAVE" = 1 ]; then
    PG_CLAVE="$URL_CONSULTA_CLAVE"
  fi
  # `sslpassword` no se puede reenviar: `PGSSLPASSWORD` NO existe en libpq 16
  # (medido sobre `libpq.so.5` en `postgres:16-alpine`). Se descarta y se avisa,
  # sin decir el valor. Si la llave del certificado de cliente esta cifrada,
  # `pg_dump` la pedira por una consola que no existe y el respaldo morira en
  # BACKUP VACIO -- que es el lado bueno de equivocarse.
  if [ "$URL_HAY_CONSULTA_SSLCLAVE" = 1 ]; then
    PG_AVISO="DATABASE_URL trae \`sslpassword\` en la consulta. Se quita -en argv seria visible con \`ps\`- y NO se puede reenviar: PGSSLPASSWORD no existe en libpq 16. Si esa llave esta cifrada, el respaldo va a fallar."
  fi
  # Un `PGPASSWORD` incondicional "por si acaso" seria un error: una variable
  # VACIA no es lo mismo que no definirla --libpq leeria una contrasena vacia en
  # vez de caer a `.pgpass`-- y ahi se pierden las instancias que se autentican
  # por `peer`, `trust` o `.pgpass`.
  if [ -n "$PG_CLAVE" ]; then PG_ENV+=("PGPASSWORD=$PG_CLAVE"); fi
  if [ "${#URL_CONSULTA_ENV[@]}" -gt 0 ]; then PG_ENV+=("${URL_CONSULTA_ENV[@]}"); fi
  return 0
}
