# Desplegar lo nuevo de Space Eyes — instrucciones para Emiliano

Escrito el 18-nov-2026 contra la rama `fix/space-eyes-fotos-rapidas`, punta
`742afa90`. Lo que dice de `update-eyes.sh` está leído del guion; lo del
despliegue de g500 está comprobado el 2-nov-2026 subiendo la 0.16.24-local, y
lo marco donde toca.

## Lo primero, porque decide todo lo demás

**Esto son DOS despliegues, no uno.**

| | Qué lleva | Cómo se despliega |
|---|---|---|
| **SPACE OS** (`apps/web`) | El menú de Ajustes, las pestañas de la ficha, el aviso de pantalla caída | Con el despliegue normal de la aplicación |
| **Space Eye** (`space-eye/`) | Avisos por correo, foto al recuperar, obstrucción, auditoría diaria, pantalla apagada de TLALPAN | **Imagen propia del contenedor**, aparte |

Si solo se hace el primero, lo que se ve es el menú y poco más: **todo lo que
cuenta pasa en el servidor de Space Eye**. Es la misma imagen vieja donde
`/api/avisos` se queda colgado sin contestar — si al probar los avisos por
correo la tarjeta no aparece, es eso y no un fallo de la interfaz.

## 1 · SPACE OS

Fusionar la rama y desplegar como siempre. Las traducciones de lo nuevo ya van
dentro (28 claves en los cuatro idiomas); no hay lote aparte que aplicar.

Una sola prueba que conviene hacer después: entrar a Space Eyes → **Ajustes**.
Si se ven las cinco pestañas (Brillo por horas, Ajustar texto, Programación,
Verificación, Gráficas), el merge entró entero.

## 2 · La imagen de Space Eye en g500

Comprobado el 2-nov-2026. Cuatro pasos:

```bash
# 1. Empaquetar el código de space-eye/ y subirlo por scp (~1 MB).
#    OJO: `/root/spaces-repo` del droplet NO es un clon de git. Es una copia
#    suelta del 8-oct, sin `.git`: ahí NO sirve `git fetch`.

# 2. Construir EN el droplet:
docker build -f Dockerfile.instancia \
  -t space-eye:<version>-local --build-arg VERSION=<version> .

# 3. Cambiar EYES_IMAGEN en /etc/space-os/eyes.env   ← ZONA ROJA
#    Es configuración de instancia: pedir permiso antes.

# 4. Correr el guion (vive ahí, no en /usr/local/bin):
/opt/space-os/update-eyes.sh
```

Tres cosas que cuestan una hora si no se saben:

- **`EYES_IMAGEN` sin barra = imagen local.** `update-eyes.sh` no jala nada del
  registro si el nombre no lleva `/`. g500 usa `space-eye:<version>-local`, así
  que no hace falta registry aunque `REGISTRY` y `REGISTRY_TOKEN` existan.
- **El `.dockerignore` excluye `frontend/public/*.apk` y `*.exe` a propósito**
  (130 MB, y esa APK está compilada contra OTRO servidor: servida desde g500,
  alguien se bajaría la equivocada). Al empaquetar a mano hay que respetarlo.
- **El Dockerfile pide `pi-agent/dist/space-eye-pi-agent.tar.gz`**. Está en la
  rama, pero si se empaqueta a mano y se olvida, el build falla.

**Si solo se cambia `EYES_IMAGEN` y no se corre el guion**, el despliegue ocurre
igual, pero a las **4:27 AM** por cron, sin nadie mirando. Mejor correrlo.

## 3 · Las migraciones: 031, 032 y 033

**En las instancias se aplican solas.** `update-eyes.sh` las corre con la imagen
NUEVA, en un contenedor desechable, **antes** de cambiar de versión; si una
falla, restaura el respaldo y no cambia nada (código 4). No hay nada que hacer a
mano.

En el **`:4000` de producción sí van a mano**: ahí no corre ese guion.

```
031_avisos_por_correo.sql     avisos por correo
032_foto_al_recuperar.sql     la foto cuando una persona marca la falla
033_creativo_por_dia.sql      la auditoría diaria de creativos
```

La tabla de control es **`_migrations`**, no `migrations`.

## 4 · El agente de Raspberry

El manifiesto que se sirve hoy está **desactualizado**: dice 0.3.0 (22-ago) y no
corresponde al paquete que hay. El de la rama sí:

```
space-eye/pi-agent/dist/space-eye-pi-agent.tar.gz
    versión 0.7.11 · 742 843 bytes
    sha256 69d92200faf01ff81554955b283e8835716fa346f08b857f18509350c80acf80
```

Se copian los dos al `frontend/public/` del servidor, el **manifiesto al final**:

1. `space-eye-pi-agent.tar.gz`
2. `space-eye-pi-agent.json` (el de `pi-agent/dist/`, no el viejo de
   `frontend/public/`)

Al revés, los equipos ven un manifiesto nuevo apuntando a un paquete que todavía
no está y rechazan la actualización.

Esta versión lleva el arreglo de la cámara movida. **En los teléfonos ese mismo
arreglo no entra**: necesita APK, y las que hay están en la calle. Por eso el
servidor lleva su propio filtro.

## 5 · Comprobar que quedó

Tres comprobaciones, en orden de lo que más se rompe:

1. **La API contesta:** `GET /api/app/version` desde el droplet. Un 401 es
   señal de vida (es lo que `update-eyes.sh` espera).
2. **Los avisos por correo ya no se cuelgan:** abrir Space Eyes → Fallas. Si la
   tarjeta «Avisos por correo» aparece, la imagen nueva está arriba. Si la
   pantalla se queda sin esa tarjeta, sigue la vieja.
3. **La auditoría diaria escribe:** `SELECT COUNT(*) FROM device_creative_dias
   WHERE dia = CURDATE();` en la base de la instancia. A la hora de que los
   equipos reporten tiene que haber filas.

## 6 · Volver atrás

Dejar `EYES_IMAGEN` en la versión anterior y correr `update-eyes.sh`. La imagen
vieja sigue en el droplet. Las columnas de las migraciones se quedan, pero son
aditivas y el código viejo las ignora.

**Lo que `update-eyes.sh` NO respalda: las fotos** (volumen `space-eyes_fotos`,
1.1 GB el 2-nov). Su `mysqldump` es solo de la base, y se queda en el mismo
droplet. Para un respaldo de verdad hay que sacarlo fuera.

## 7 · Lo que NO hay que dar por bueno todavía

**El portero de obstrucción («algo tapando la pantalla») tiene el umbral sin
medir.** El 0.45 sale de la geometría del caso —un vehículo tapa entre un cuarto
y la mitad de la pantalla desde la altura de la cámara—, no de un conteo contra
fotos reales de camiones.

Esas fotos ya están en el catálogo de producción: entraron como «creativos» que
se vieron una vez y nunca más. `space-eye/backend/scripts/medir-obstruccion.ts`
hace exactamente esa cuenta y dice si el umbral separa.

Conviene correrlo antes de confiar en ese portero: si se quedara corto, un sitio
dejaría de registrar creativos de verdad **y eso no avisa de nada**.
