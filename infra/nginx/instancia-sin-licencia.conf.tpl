# ============================================================================
#  instancia-sin-licencia.conf.tpl — nginx cuando la licencia esta vencida.
#  (ADR 0032, tarea 5)
# ----------------------------------------------------------------------------
#  PLANTILLA. `__DOMINIO__` se sustituye igual que en `instancia.conf.tpl` —
#  ningun dominio real se queda quemado en un archivo versionado.
#
#  `update.sh` (`nginx_sitio()`) reemplaza el sitio ENTERO con este cuando la
#  licencia esta vencida o invalida, y lo devuelve al normal en cuanto vuelve a
#  ser valida. Por eso este archivo tiene que sostenerse solo: sirve una pagina
#  estatica, sin depender de que la app (que esta detenida) responda nada.
#
#  Tres decisiones, cada una porque su ausencia costaria algo:
#
#   1. El MISMO certificado que el sitio normal. Si esta plantilla usara uno
#      propio (o ninguno), el navegador mostraria una alerta de seguridad
#      ENCIMA del aviso de licencia vencida, y el cliente dejaria de leer el
#      mensaje real por miedo al candado roto.
#   2. El hueco de ACME sigue aqui, igual que en `instancia.conf.tpl`. Una
#      licencia vencida puede durar semanas (o para siempre); si este sitio no
#      sirviera `/.well-known/acme-challenge/`, el certificado caducaria
#      MIENTRAS la instancia esta apagada, y el dia que el cliente pague, la
#      pagina de bienvenida de vuelta seria un error de TLS.
#   3. TODA ruta responde **503**, nunca 200 (ronda 2, I-6). `promover.yml`
#      exige 200 en `/login/` y `/api/auth/metodos/` para dar por buena una
#      promocion -- si esta pagina contestara 200, el smoke de promocion
#      contra una instancia APAGADA pasaria como si la app respondiera. 503
#      es ademas lo semanticamente correcto: el servicio no esta disponible.
#      Por eso `location /` ya NO es un `try_files` directo: entrega 503
#      SIEMPRE, y el cuerpo lo pone `error_page` sin forzar el codigo
#      (`error_page 503 ...`, sin `=200`), asi que la respuesta conserva el
#      503 con el HTML dentro.
#   4. Si el archivo real llegara a faltar en disco, la `location` interna
#      cae en un ultimo recurso EN LINEA (ronda 2, m-4): sin eso, un
#      `try_files` sin adonde caer termina en un 500 que no dice nada.
# ============================================================================

server {
  # `default_server` por consistencia con `instancia.conf.tpl` (ronda 2,
  # m-2): cuando este archivo esta activo, reemplaza al sitio normal
  # ENTERO, asi que su propio catch-all tambien esta fuera -- sin esto, una
  # peticion por IP o por un host que no es __DOMINIO__ quedaria a merced de
  # cual sea el primer server block que nginx cargue.
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name __DOMINIO__;

  location ^~ /.well-known/acme-challenge/ {
    root /var/www/html;
  }

  location / {
    return 301 https://__DOMINIO__$request_uri;
  }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name __DOMINIO__;

  # LITERAL: el mismo par que el sitio normal. No se emite ni se referencia
  # ningun certificado propio de este sitio.
  ssl_certificate     /etc/letsencrypt/live/__DOMINIO__/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/__DOMINIO__/privkey.pem;

  ssl_protocols             TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers off;
  ssl_ciphers               ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
  ssl_session_cache         shared:SSL:10m;
  ssl_session_timeout       1d;
  ssl_session_tickets       off;

  root /var/www/space-os-licencia/;

  # CUALQUIER ruta -- la pagina misma incluida -- entrega 503. `error_page`
  # SIN `=200` conserva el codigo del error original (503), asi que la
  # respuesta trae el cuerpo de la pagina Y el codigo correcto a la vez.
  location / {
    return 503;
  }

  error_page 503 /licencia-vencida.html;
  location = /licencia-vencida.html {
    internal;
    # Si el archivo faltara en disco, esto NO puede caer en otro
    # `try_files` sin destino: eso es exactamente lo que entra en ciclo y
    # termina en un 500 que no explica nada (m-4). El ultimo recurso es un
    # 503 con un texto minimo escrito aqui mismo, sin depender de ningun
    # archivo.
    try_files /licencia-vencida.html @licencia_ultimo_recurso;
  }

  location @licencia_ultimo_recurso {
    internal;
    default_type text/html;
    return 503 '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Licencia vencida</title></head><body><h1>Esta instancia esta suspendida por falta de licencia</h1><p>Contacta a __CONTACTO__ para renovarla.</p></body></html>';
  }
}
