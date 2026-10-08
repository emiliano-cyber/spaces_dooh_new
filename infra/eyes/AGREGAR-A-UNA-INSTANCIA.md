# Agregar Space Eye a una instancia que YA existe (ej. g500)

`instalar-hijo.sh --con-eyes` lo pone en las altas nuevas. Una instancia que se
dio de alta antes no lo tiene, y su módulo Space Eyes no puede dar de alta
equipos. `infra/scripts/agregar-eyes.sh` se lo agrega sin tocar su base ni sus
datos. Si se corre otra vez, no cambia nada: conserva las llaves y los equipos.

## Antes

1. **DNS**: `eyes.<dominio>` → IP del droplet, tipo A, **solo DNS (nube gris)**
   en Cloudflare. RTSP, TURN y WebRTC no pasan por el proxy. Si el registro no
   resuelve a la IP del droplet, el script se detiene.
2. **En el droplet** (`/root/eyes-entrega/`):
   - la imagen `space-eye-<versión>.tar`;
   - el APK, compilado con `-PserverUrl=https://eyes.<dominio>`.
3. **Una copia del repo** en el droplet (`git archive` de esta rama).

## Correr (root, en el droplet)

```bash
bash infra/scripts/agregar-eyes.sh \
  --dominio g500.space-os.io --owner g500 --contacto <correo para Let's Encrypt> \
  --imagen-tar /root/eyes-entrega/space-eye.tar --apk /root/eyes-entrega/space-eye.apk
```

El script hace seis pasos:

1. Revisa la salud de la app, el DNS y los puertos.
2. Respalda en `/root/respaldos/agregar-eyes-*`.
3. Carga la imagen y crea las credenciales y `eyes.env`.
4. Levanta la pila con `update-eyes.sh` y publica el APK.
5. Amplía el certificado a `eyes.<dominio>` y agrega el bloque nginx (`nginx -t`; si falla, lo deshace).
6. Escribe `SPACE_EYE_*` en `app.env` y recrea el contenedor de la app. Si la app no responde, regresa a la anterior.

Si la licencia trae el módulo apagado, actívalo desde el padre:
`node apps/flota/modulo.mjs --instancia g500 --activar space-eyes`.

## Después

En la instancia ve a Space Eyes › Agregar dispositivo › Teléfono, y se muestra
un QR. En el celular instala la app desde `https://eyes.<dominio>/space-eye.apk`
y escanea el QR. El equipo queda a nombre de la instancia.

**Cambiar de droplet**: el teléfono apunta al *dominio*, no a la IP. Al mudarse
basta con correr el script en el droplet nuevo, llevar la base MySQL
(`/var/backups/space-os/eyes`) y mover los registros DNS.

## Ensayado (08-oct, docker-in-docker con una app falsa)

- 26 migraciones.
- La llave lista los códigos (200) y genera uno de teléfono.
- Un teléfono **sin** código se rechaza (`vinculacion_requerida`).
- **Con** código entra con dueño `g500`.
- El código no sirve dos veces (`codigo_invalido`).
- El APK se sirve (200).
- Correrlo otra vez deja `app.env` y `eyes.env` idénticos.
