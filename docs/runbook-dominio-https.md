# Runbook — demo.space-os.io con HTTPS

Poner SPACE OS detrás de `https://demo.space-os.io` y dejar de exponer la IP.

**Todo lo de aquí necesita `sudo`.** El estado de partida se verificó contra el
servidor el 2026-07-28.

---

## Estado encontrado

| Cosa | Estado |
|---|---|
| DNS `demo.space-os.io` | ✅ resuelve a `209.97.146.136` |
| Nameservers de `space-os.io` | Cloudflare (`ryleigh` / `gabe.ns.cloudflare.com`) |
| Proxy de Cloudflare | ❌ **apagado** (nube gris): el DNS devuelve la IP del origen |
| HTTPS | ❌ nada escuchando en el 443 |
| certbot | ✅ 2.9.0 instalado |
| nginx | 1.24.0 con `http_ssl`, `http_v2`, `realip` |
| App | Next.js en `127.0.0.1:3000`, basePath `/spaces-dooh` |
| `APP_URL` | ❌ `http://209.97.146.136` |
| `COOKIE_SECURE` | ❌ `0` (fuerza cookies sin `Secure`) |

Que el proxy esté en gris es lo que hace viable emitir el certificado por HTTP-01
sin pasos extra. **Emitir primero, encender el proxy después.**

---

## Orden de ejecución

El orden importa: encender el proxy naranja antes de tener certificado en el
origen deja el sitio en bucle de error con *Full (Strict)*.

### 1. Configuración de nginx

```bash
cd /var/www/Spaces
sudo cp /etc/nginx/sites-available/spaces /root/spaces.conf.bak.$(date +%F)   # respaldo
sudo cp infra/nginx/demo.space-os.io.conf /etc/nginx/sites-available/spaces
```

El vhost referencia certificados que aún no existen, así que **todavía no
recargues**. Certbot los crea en el paso siguiente.

### 2. Certificado

```bash
sudo mkdir -p /var/www/html
sudo certbot certonly --webroot -w /var/www/html \
     -d demo.space-os.io \
     --agree-tos -m TU_CORREO --no-eff-email
sudo nginx -t && sudo systemctl reload nginx
```

`certonly` y no `--nginx` a propósito: el plugin de nginx reescribe el vhost por
su cuenta y deshace los ajustes de esta configuración.

Renovación automática: `certbot.timer` ya viene con el paquete. Comprobar:

```bash
systemctl list-timers certbot.timer
sudo certbot renew --dry-run
```

Añadir el hook para que nginx tome el certificado nuevo:

```bash
echo -e '#!/bin/sh\nsystemctl reload nginx' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

### 3. Variables de la app

Dos valores quedan mal bajo HTTPS. `.env.production` pertenece a `emiliano`, así
que **este paso no necesita sudo**:

```bash
cd /var/www/Spaces/apps/web
cp .env.production .env.production.bak.$(date +%s)
sed -i 's#^APP_URL=.*#APP_URL=https://demo.space-os.io#' .env.production
sed -i 's#^COOKIE_SECURE=.*#COOKIE_SECURE=1#' .env.production
grep -E '^(APP_URL|COOKIE_SECURE)' .env.production
cd /var/www/Spaces && pm2 reload ecosystem.config.js --update-env
```

- `APP_URL` arma los enlaces de **recuperar contraseña**. Con la IP, el correo
  manda al usuario a una URL sin HTTPS y con aviso del navegador.
- `COOKIE_SECURE=1` hace que la cookie de sesión viaje solo por HTTPS. Está
  explícitamente en `0`, y `cookieSecure()` (lib/server/auth.ts:119) respeta ese
  `0` incluso en producción.

### 4. Cloudflare

Ya con HTTPS funcionando en el origen:

1. **SSL/TLS → Overview → Full (Strict)**. Con certificado válido de Let's
   Encrypt en el origen es la opción correcta. *Flexible* dejaría el tramo
   Cloudflare→origen en HTTP plano.
2. **DNS**: pasar `demo.space-os.io` a **nube naranja** (proxied).
3. **SSL/TLS → Edge Certificates**: activar *Always Use HTTPS* y
   *Automatic HTTPS Rewrites*.
4. Ejecutar el snippet de IP real, **imprescindible** (ver abajo):
   ```bash
   sudo bash /var/www/Spaces/infra/nginx/cloudflare-realip.sh
   sudo nginx -t && sudo systemctl reload nginx
   ```

> **Por qué el paso 4 no es opcional.** Con el proxy activo, para nginx todas las
> peticiones vienen de una IP de Cloudflare. La app limita el login a 10 intentos
> por IP cada 5 minutos (`lib/server/rate-limit.ts`). Sin restaurar la IP real,
> el décimo intento fallido de cualquiera **bloquea el login de todos** durante 5
> minutos. Y los registros de la bitácora guardarían la IP de Cloudflare en vez
> de la del usuario.

### 5. Cerrar el origen (recomendado)

Con el proxy activo, nada debería llegar al origen salvo desde Cloudflare:

```bash
sudo ufw allow from 173.245.48.0/20 to any port 443 proto tcp   # …y el resto de rangos
sudo ufw deny 80/tcp
```

Alternativa más simple y sin mantener rangos: activar **Cloudflare Tunnel** y
cerrar 80/443 por completo. Vale la pena si el demo va a estar expuesto tiempo.

---

## Validación

```bash
# 1. HTTPS válido, sin advertencias
curl -sSI https://demo.space-os.io/spaces-dooh/login/ | head -3

# 2. La IP y el HTTP redirigen permanentemente al dominio
curl -sI http://209.97.146.136/spaces-dooh/ | grep -E "^HTTP|^Location"   # 301
curl -sI http://demo.space-os.io/ | grep -E "^HTTP|^Location"            # 301

# 3. Cookie de sesión con Secure (hacer login antes)
curl -sI https://demo.space-os.io/spaces-dooh/api/auth/me/ | grep -i set-cookie

# 4. Cabeceras de seguridad, sin duplicados
curl -sI https://demo.space-os.io/spaces-dooh/login/ | grep -iE "strict-transport|x-frame|x-content|referrer"

# 5. Estáticos cacheados
curl -sI https://demo.space-os.io/spaces-dooh/_next/static/  | grep -i cache-control

# 6. Renovación
sudo certbot renew --dry-run
```

Checklist manual: login, carga del dashboard, subir un creativo, abrir una liga
pública de propuesta y comprobar que el mapa carga por HTTPS (los tiles vienen
de `basemaps.cartocdn.com`, que ya es HTTPS — no habrá *mixed content*).

---

## El basePath `/spaces-dooh`

**Se puede quitar, pero NO en el mismo cambio que el dominio.**

Medido: **43 referencias literales a `/spaces-dooh` en 35 archivos**, además de
`next.config.mjs` y `middleware.ts` (`BASE_PATH`). No es un cambio de una línea:
son rutas de `fetch` (`const API = '/spaces-dooh/api'`), enlaces absolutos, la
normalización de ruta activa del sidebar y el `AuthGate`.

Juntarlo con la migración de dominio es mala idea: si algo se rompe, no se sabe
si fue el TLS, el proxy o el basePath.

**Plan en dos fases.**

*Fase 1 — preparar (sin cambio funcional).* Centralizar el valor en un módulo:

```ts
// lib/base-path.ts
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
export const api = (ruta: string) => `${BASE_PATH}/api${ruta}`
```

y sustituir las 43 literales por ese helper. El comportamiento no cambia
mientras `NEXT_PUBLIC_BASE_PATH=/spaces-dooh`; deja de haber literales sueltas.

*Fase 2 — quitarlo.* Poner `NEXT_PUBLIC_BASE_PATH=` vacío, quitar `basePath` de
`next.config.mjs`, recompilar y cambiar en el vhost:

```nginx
location = / { return 302 /login/; }
```

Y una redirección de cortesía para las URLs viejas:

```nginx
location ^~ /spaces-dooh/ {
  return 301 https://demo.space-os.io$request_uri;   # requiere quitar el prefijo
}
```

**Solución temporal, ya incluida en el vhost:** la raíz `/` redirige a
`/spaces-dooh/login/`, así que nadie tiene que escribir el prefijo. Se entra a
`https://demo.space-os.io` y el prefijo solo aparece después, en la barra de
direcciones.

> No intentar reescribir `/login` → `/spaces-dooh/login` desde nginx: Next genera
> todos sus enlaces internos y sus chunks con el basePath incluido, así que
> haría falta reescribir también el HTML y el JS de respuesta. Frágil y peor que
> el prefijo visible.

---

## Rollback

```bash
sudo cp /root/spaces.conf.bak.AAAA-MM-DD /etc/nginx/sites-available/spaces
sudo nginx -t && sudo systemctl reload nginx
cd /var/www/Spaces/apps/web && cp .env.production.bak.XXXX .env.production
cd /var/www/Spaces && pm2 reload ecosystem.config.js --update-env
```

En Cloudflare: volver el registro a nube gris.

**Cuidado con HSTS.** Una vez que un navegador cachea
`Strict-Transport-Security` con `max-age=63072000`, ese navegador **exige HTTPS
durante 2 años** aunque se revierta el servidor. Si hay dudas sobre la
estabilidad del certificado, arrancar con `max-age=300`, confirmar la renovación
y subirlo después. No se añadió `preload` justamente por eso: entrar en la lista
de precarga de los navegadores es prácticamente irreversible.
