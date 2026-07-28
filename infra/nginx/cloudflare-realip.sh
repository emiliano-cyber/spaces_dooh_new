#!/usr/bin/env bash
# ============================================================================
#  Restaura la IP real del visitante cuando Cloudflare hace de proxy (nube
#  naranja). Genera /etc/nginx/conf.d/cloudflare-realip.conf desde las listas
#  oficiales de rangos de Cloudflare.
#
#  POR QUÉ IMPORTA, y no es un adorno:
#  Con el proxy activo, para nginx TODAS las peticiones vienen de una IP de
#  Cloudflare. La app limita los intentos de login a 10 por IP cada 5 minutos
#  (lib/server/rate-limit.ts). Sin esto, el décimo intento fallido de CUALQUIER
#  usuario bloquea el login de TODOS los demás durante 5 minutos.
#
#  Uso:
#    sudo bash infra/nginx/cloudflare-realip.sh && sudo nginx -t && sudo systemctl reload nginx
#
#  Cloudflare cambia sus rangos de vez en cuando. Conviene un cron mensual:
#    0 4 1 * * root bash /var/www/Spaces/infra/nginx/cloudflare-realip.sh && nginx -t && systemctl reload nginx
# ============================================================================
set -euo pipefail

DESTINO=/etc/nginx/conf.d/cloudflare-realip.conf
TMP=$(mktemp)

{
  echo "# Generado por infra/nginx/cloudflare-realip.sh — no editar a mano."
  echo "# Fecha: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo

  for url in https://www.cloudflare.com/ips-v4 https://www.cloudflare.com/ips-v6; do
    curl -fsS --max-time 20 "$url" | while read -r rango; do
      [ -n "$rango" ] && echo "set_real_ip_from $rango;"
    done
  done

  echo
  # CF-Connecting-IP siempre trae la IP real del visitante y Cloudflare la
  # sobrescribe, así que un cliente no la puede falsificar a través del proxy.
  echo "real_ip_header CF-Connecting-IP;"
  echo "real_ip_recursive on;"
} > "$TMP"

# Si la descarga falló a medias, no pisamos una config buena con una vacía.
if [ "$(grep -c set_real_ip_from "$TMP")" -lt 10 ]; then
  echo "ERROR: se obtuvieron muy pocos rangos; no se toca $DESTINO" >&2
  rm -f "$TMP"
  exit 1
fi

mv "$TMP" "$DESTINO"
chmod 644 "$DESTINO"
echo "✓ $DESTINO actualizado con $(grep -c set_real_ip_from "$DESTINO") rangos"
echo "  Ahora: nginx -t && systemctl reload nginx"
