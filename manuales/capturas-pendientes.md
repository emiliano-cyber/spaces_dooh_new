# Capturas pendientes — manual de usuario de septiembre

Corrida del **2026-09-24** (segunda pasada, tarde), entorno **LOCAL**
(`http://localhost:3471/spaces-dooh`, `next build && next start`), base propia
`spaces_manual_0924` preparada con `manuales/preparar-base-2026-09-18.mjs`, guion
`manuales/capturas-2026-09-18.spec.ts`. Manual: `vault/08-Manuales/manual-usuario-2026-09-18.md`.

| | Cantidad |
|---|---|
| Capturas del 21/09, no versionadas y con la numeración corrida | 10 |
| Tomadas en la primera pasada del 24/09 | 39 |
| **Tomadas en la segunda pasada** (todas de nuevo, 6 más) | **45** |
| Pasos que quedan sin imagen | **2** (el 1.1, y el 4.1 desde el 25/09) |

Ninguna captura se retocó. Lo único que se altera antes de disparar es lo que manda la
regla de datos: los códigos de recuperación salen difuminados, y `enmascarar()` no
encontró ningún otro dato real que tapar (la semilla usa correos `.invalid` y RFC `DMO…`).

> Hasta el 24/09 este archivo tenía los pendientes del manual de **agosto**
> (`manual-usuario-2026-08-11.md`), que se retiró ese día. Siguen en la historia de git.

---

## Pendiente · 1.1 «Guardarlos la primera vez», pasos 1-5

**Motivo: exige una sesión iniciada con Google.** La pantalla de primera entrada solo sale
si `metodoSesion === 'google'` y el usuario no ha confirmado sus códigos
(`debeGuardarCodigos()`, `apps/web/lib/server/auth.ts`). En local no hay forma legítima
de abrir esa sesión sin Google, y falsear el método de sesión en la base sería simular.

La **pantalla de lista** de los pasos 2-5 es la misma que sale al regenerar (1.2, paso 4),
y está fotografiada ahí (`01-02-04-codigos-lista-nueva`). Falta solo el texto del paso 1.

**Para tomarla:** una cuenta de pruebas con Google en un entorno donde el OAuth funcione.

---

## Pendiente · 4.1 «Asignar la razón social que paga», paso 5 — **nueva, 2026-09-25**

**Motivo: la pantalla cambió después de fotografiarla.** El cuadro «Con cuál de tus razones
sociales se paga» pedía la contraseña y no pintaba dónde teclearla; se corrigió el 25/09 en
`fix/contrasena-contrato-sin-campo` y ahora el campo sale dentro del propio cuadro.

Con eso **dos capturas quedaron retratando una pantalla que ya no existe**, y se retiraron
del manual en vez de dejarlas pasar por el estado de hoy:

- `04-01-05-contrato-pide-contrasena.png` — el aviso en rojo **sin** campo.
- `04-01-05-contrato-desbloquear-cambios.png` — el desbloqueo desde la barra superior, que
  era el paso 7 del rodeo. El camino sigue existiendo, pero ya no es parte del apartado.

**Falta tomar:** el cuadro tras pulsar «Guardar» con los cambios bloqueados, ya con el
campo «Tu contraseña» debajo del selector y el botón diciendo «Confirmar y guardar».

**Para tomarla:** el guion del 4.1 con el tenant en control de cambios encendido y la
sesión SIN desbloquear. Los archivos viejos siguen en la carpeta de capturas; no se
borraron por si hace falta comparar.

---

## Estados preparados a mano, y por qué se aceptan

El encargo del 24/09 por la tarde pidió estas dos cosas de forma expresa. Las dos se
hacen **solo en la base local desechable** y quedan dichas en el pie de cada captura.

- **6.1 a 6.3, «hay una versión nueva disponible».** En una instalación real esas
  columnas de `actualizaciones_instancia` las escribe el actualizador del servidor
  (`infra/scripts/update.sh`) tras leer el registro; la aplicación no puede
  (`grant update` por columna, `20260921_actualizaciones_instancia.sql`). El guion llama
  a `preparar-base-2026-09-18.mjs --version-disponible`, que escribe lo mismo que él
  (v0.7.0 instalada, v0.8.0 disponible, 2 migraciones, digests `sha256:local-manual-…`).
  **No se tocó código.** Aprobar la instalación en el 6.3 solo guarda `aprobado_digest`:
  en local no hay actualizador y no se instaló nada.
- **4.2, dos campañas listas para facturar.** La semilla deja facturadas las ocho suyas.
  El preparador siembra dos más, OOH, con orden de compra y evidencias y sin comprobante,
  **sin reservas** para no mover los reportes del apartado 9. Emitir el comprobante de una
  sí escribe en la base local: es el paso 4.

Y dos que ya venían de la primera pasada:

- **7.2, la respuesta del ticket.** Entra por la misma ruta que usa el panel de flota,
  `PATCH /api/tickets` con `x-flota-token`, contra el servidor local y sin cookies. El
  panel en sí no sale en ninguna foto.
- **1.3 y 2.1.** Una cuenta con contraseña marcada `solo_google`, y una organización
  recién creada sin razones sociales (`demo-bienvenida`).

---

## Cómo repetir la corrida

```bash
# 1. base propia (se niega a cualquier nombre que no empiece por spaces_manual_)
node manuales/preparar-base-2026-09-18.mjs --base=spaces_manual_0924

# 2. app: build PRIMERO, servidor DESPUÉS, apuntando a esa base
cd apps/web && npm run build
DATABASE_URL=postgresql://spaces_app:spaces_app_dev@localhost:5433/spaces_manual_0924 \
DOOHMAIN_PUBLISH_ENABLED=0 FLOTA_TOKEN=<uno-cualquiera> \
  npx next start -p <puerto-libre>

# 3. el guion (credenciales en manuales/.auth/credenciales-2026-09-18.env)
rm -rf manuales/.auth/2026-09-18
set -a; . manuales/.auth/credenciales-2026-09-18.env; set +a
CAPTURAS_BASE_URL=http://localhost:<puerto>/spaces-dooh FLOTA_TOKEN=<el-mismo> \
CAPTURAS_BASE_DATOS=spaces_manual_0924 \
  npx playwright test --config manuales/playwright.2026-09-18.config.ts

# 4. el PDF
node manuales/armar-pdf.mjs
```

`DOOHMAIN_PUBLISH_ENABLED=0` no es opcional: `.env.local` lo trae en `1`, y aunque este
guion no aprueba campañas, un servidor local con esa bandera publica contra pantallas
reales.
