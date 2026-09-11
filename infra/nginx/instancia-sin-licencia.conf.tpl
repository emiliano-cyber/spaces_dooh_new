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
#   3. `try_files` + `error_page 404 =200` en vez de `location /`: asi
#      CUALQUIER ruta que pida el navegador (incluida una que Next.js dejo en
#      el historial, o un bookmark a `/spaces-dooh/algo`) cae en la misma
#      pagina, en vez de un 404 desnudo que no dice nada.
# ============================================================================

server {
  listen 80;
  listen [::]:80;
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

  location / {
    try_files $uri /licencia-vencida.html;
  }

  error_page 404 =200 /licencia-vencida.html;
}
