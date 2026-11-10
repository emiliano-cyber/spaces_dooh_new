# Desplegar el servidor de Space Eye en g500

Para Emiliano. Es lo que faltó en la actualización del 9 de noviembre: la parte
web quedó arriba, pero **el servidor de Space Eye sigue en la versión vieja**.
Por eso en Fallas no aparece la tarjeta «Avisos por correo».

## Por qué no bastó con fusionar y desplegar

SPACE OS y Space Eye son dos programas distintos en el mismo droplet:

| Qué | De dónde sale | Cómo se actualiza |
| --- | --- | --- |
| La web de SPACE OS (`apps/web`) | el despliegue normal de SPACE OS | ya quedó ✅ |
| El servidor de Space Eye (`space-eye/`) | una **imagen de Docker local**, la que diga `EYES_IMAGEN` en `/etc/space-os/eyes.env` | **falta** ❌ |

`/opt/space-os/update-eyes.sh` **no construye nada** desde la carpeta
`space-eye/` del repo: solo arranca la imagen que diga `EYES_IMAGEN`. Si nadie
construye una imagen nueva, Space Eye se queda como estaba aunque el repo esté
al día.

La web nueva pide `/api/avisos`, y el Space Eye viejo no tiene esa ruta. Además,
en la versión vieja una ruta `/api/` que no existe no contesta nada: la petición
se queda abierta y la tarjeta no aparece, sin error en pantalla ni en la
consola. Esa segunda parte ya está arreglada en esta rama (`space-eye/backend/src/app.ts`
ahora contesta 404).

Tampoco están arriba los otros cambios de servidor de la rama, aunque no se
noten: que una pantalla apagada no entre al catálogo como creativo nuevo, el
renglón de la bitácora del aviso rápido, la puesta al día del catálogo y el
portero de creativos.

## Pasos

Todo en g500 (142.93.113.106), como root.

### 1. Ver qué imagen corre hoy

```bash
grep EYES_IMAGEN /etc/space-os/eyes.env
docker images | grep space-eye
```

**Anota la imagen actual**: es a la que se regresa si algo sale mal. Para la
nueva usa una versión **mayor** que esa. Por ejemplo, si hoy es
`space-eye:0.16.24-local`, la nueva puede ser `space-eye:0.17.0-local`.

### 2. Tener el código de esta rama en el droplet

En la copia del repo con `fix/space-eyes-fotos-rapidas` ya fusionada y con
**esta punta** (la que trae este documento). Lo que importa es la carpeta
`space-eye/`.

Comprueba que estén los tres archivos del agente de Raspberry 0.7.10. Van en el
repo a propósito, aunque `dist/` esté en `.gitignore`: el Dockerfile los pide y
sin ellos el build falla en la línea 39.

```bash
cd <repo>/space-eye
ls -la pi-agent/dist/
#   instalar-pi.sh
#   space-eye-pi-agent.json      ← debe decir "version": "0.7.10"
#   space-eye-pi-agent.tar.gz    ← 741986 bytes
sha256sum pi-agent/dist/space-eye-pi-agent.tar.gz
#   8bca639b6f378a5aaad5f16791bc7e45860a1cb4364d1273c94864a5a3f6bb06
```

### 3. Construir la imagen

Desde `space-eye/`:

```bash
docker build -f Dockerfile.instancia \
  -t space-eye:<nueva-versión>-local \
  --build-arg VERSION=<nueva-versión> .
```

El nombre **sin `/`** es a propósito: así `update-eyes.sh` la toma como imagen
local y no intenta bajarla de un registro.

El `.dockerignore` deja fuera `frontend/public/*.apk` y `*.exe`. Está bien: esa
APK está compilada contra otro servidor y no debe servirse desde g500.

### 4. Apuntar `EYES_IMAGEN` a la imagen nueva

```bash
cp /etc/space-os/eyes.env /etc/space-os/eyes.env.antes-avisos
sed -i 's|^EYES_IMAGEN=.*|EYES_IMAGEN=space-eye:<nueva-versión>-local|' /etc/space-os/eyes.env
grep EYES_IMAGEN /etc/space-os/eyes.env
```

### 5. Desplegar — a mano y en ese momento

```bash
/opt/space-os/update-eyes.sh
```

Esto respalda la base, aplica la migración `031_avisos_por_correo.sql`
(`dist/migrar.js`) y cambia de versión. Si algo falla, regresa solo a la
anterior.

⚠️ **No lo dejes para el cron.** `/etc/cron.d/space-os-eyes` despliega solo a
las **4:27 AM**. Si `EYES_IMAGEN` queda cambiada sin correr el guion, el cambio
pasa de madrugada sin nadie mirando.

### 6. Comprobar

```bash
docker ps | grep -i eye              # el contenedor api con la imagen nueva
```

En la base de Space Eye (la tabla de migraciones es `_migrations`, no
`migrations`):

```sql
SELECT * FROM _migrations ORDER BY 1 DESC LIMIT 3;   -- debe aparecer 031_avisos_por_correo.sql
SELECT * FROM avisos_correo;                          -- la tabla existe
```

En el navegador: **g500 → Space Eyes → Fallas**. Arriba de las fallas debe
salir la tarjeta **«Avisos por correo»**.

## Si sale mal

```bash
cp /etc/space-os/eyes.env.antes-avisos /etc/space-os/eyes.env
/opt/space-os/update-eyes.sh
```

La imagen vieja sigue en el droplet. La tabla y las columnas de la 031 se
quedan, pero solo agregan: el código viejo no las usa.

Lo que `update-eyes.sh` **no** respalda son las fotos (volumen
`space-eyes_fotos`). Este cambio no las toca, pero no está de más saberlo.

## Después (no es de Emiliano)

Los correos no salen hasta que en la tarjeta se pongan la llave de Resend y el
remitente, con el dominio del remitente **verificado en Resend**; si no, Resend
devuelve 403. Esa parte la hace Carlos desde el panel, con el correo de prueba.
