# Agregar Space Eye a una instancia que YA existe (ej. g500)

Las altas nuevas lo traen con `instalar-hijo.sh --con-eyes`. Una instancia
creada antes no lo tiene, y su módulo Space Eyes no puede dar de alta equipos.
`infra/scripts/agregar-eyes.sh` se lo agrega sin tocar su base ni sus datos.
Si se corre otra vez, no cambia nada: conserva las llaves y los equipos.

## Sin subdominio: cada empresa habla solo con su droplet

Los equipos de la empresa entran por **el mismo dominio de su SPACE OS**, por
ejemplo `https://g500.space-os.io`, que es su droplet. No existe `eyes.<dominio>`
ni nada compartido entre empresas. nginx manda a Space Eye solo estas rutas
(`infra/nginx/space-eyes.conf`):

- `/api/`, `/socket.io/`, `/storage/` y `/whep/`;
- las descargas: `/space-eye*.apk|json|tar.gz`, `/SpaceEyeAgente.exe` e
  `/instalar-pi.sh`.

No chocan con la app, que vive entera bajo `/spaces-dooh`. El panel propio de
Space Eye (sus `.html`) **no** se publica.

El video (RTSP 8554, UDP 8189 y TURN 3478) va a la **IP** del droplet, que el
servidor les dice a los equipos cada vez. Así funciona aunque el dominio esté
detrás del proxy de Cloudflare.

**No hace falta tocar el DNS ni el certificado.**

## Antes

En el droplet, en `/root/eyes-entrega/`:

- la imagen `space-eye.tar`;
- el APK, compilado con `-PserverUrl=https://<dominio>`;
- una copia de esta rama (`git archive`).

## Correr (root, en el droplet)

```bash
bash infra/scripts/agregar-eyes.sh --dominio g500.space-os.io --owner g500 \
  --imagen-tar /root/eyes-entrega/space-eye.tar --apk /root/eyes-entrega/space-eye.apk
```

El script hace seis pasos:

1. Revisa la app, la IP y los puertos.
2. Respalda en `/root/respaldos/agregar-eyes-*`.
3. Carga la imagen, crea las credenciales, `eyes.env` y el fragmento de nginx.
4. Levanta la pila con `update-eyes.sh` y publica el APK.
5. Agrega **una línea** al sitio del dominio: `include /etc/nginx/snippets/space-eyes*.conf;`.
   - Si el sitio venía de la plantilla vieja, quita sus bloques `eyes.<dominio>`.
   - Corre `nginx -t`; si falla, regresa al sitio de antes.
   - Comprueba que `https://<dominio>/api/` llegue a Space Eye.
6. Escribe `SPACE_EYE_*` en `app.env` y recrea la app. Si la app no responde, regresa a la anterior.

Si la licencia trae el módulo apagado, actívalo desde el padre:
`node apps/flota/modulo.mjs --instancia g500 --activar space-eyes`.

## Después

En la instancia ve a Space Eyes › Agregar dispositivo › Teléfono, y se muestra
un QR. En el celular instala `https://<dominio>/space-eye.apk` y escanea el QR.
El equipo queda a nombre de la instancia.

**Mudar de droplet**:

1. Corre el script en el droplet nuevo.
2. Lleva la base MySQL (`/var/backups/space-os/eyes`).
3. Mueve el registro A del dominio.

Los equipos no se tocan.

## Ensayado (08-oct)

Docker-in-docker con nginx real, un certificado de una CA propia y el sitio
hecho con la plantilla VIEJA.

- Se quitaron los bloques `eyes.` y se agregó el `include`.
- `/api/` respondió 401: llega a Space Eye.
- `/spaces-dooh/` siguió en 200.
- `/index.html` dio 404: el panel no se publica.
- El código QR trae `servidor: https://<dominio>`.
- El teléfono se registró **por el dominio**, con dueño g500.
- socket.io dio 200 y el APK se sirvió.
- El video y TURN apuntan a la IP.
- Un `eyes.env` viejo (`EYES_DOMINIO=eyes.…`) se corrige solo.
- Correrlo otra vez deja nginx idéntico.

Pruebas de las altas:

- `pruebas-instalar-hijo.sh`: 57/57.
- `pruebas-provision.sh`: 130/130.
- `apps/flota`: 401/401.
