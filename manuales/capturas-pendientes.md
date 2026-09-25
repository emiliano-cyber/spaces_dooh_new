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

> **Y ojo con esa última fila:** cuenta *pasos del manual*, no *pantallas cambiadas*. El
> 25/09 por la tarde cambiaron dos cuadros más —«Completar contrato de arrendamiento» y
> «Registrar pago»— que **el manual no describe paso a paso**, así que no suman a la
> cuenta y aun así **no hay foto de ellos con el campo de la contraseña**. Si un día el
> manual crece hasta cubrirlos, esa foto hay que tomarla: ver el apartado nuevo de abajo.

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

## Sin foto · los otros dos cuadros del contrato — **nueva, 2026-09-25 (tarde)**

Misma causa que el apartado de arriba, y por partida doble: **la pantalla cambió después
de fotografiarse**. «Completar contrato de arrendamiento» (`CompletarContratoModal`) y
«Registrar pago» (`PagoModal`), los dos en `ContratoSheet.tsx`, ya piden la contraseña
dentro del propio cuadro.

**Aquí no hay ninguna captura que retirar**, porque el manual no tiene un apartado paso a
paso de esos dos flujos: solo los menciona. Lo que falta, si algún día lo tiene:

- El formulario **«Completar contrato de arrendamiento»** con los cuatro datos ya
  capturados y el campo «Tu contraseña» debajo, con el botón diciendo «Confirmar y
  guardar». Lo que hay que enseñar es justo eso: **que lo capturado no se pierde**.
- El cuadro **«Registrar pago»** en el mismo estado. Y aquí el detalle que importa es que
  el mensaje **está dentro del cuadro** y no en una notificación flotante: antes salía
  como toast y se desvanecía solo, que es lo que hacía el defecto tan difícil de contar.

**Para tomarlas:** el tenant con el control de cambios **encendido** y la sesión **sin
desbloquear**, un contrato en estado INCOMPLETO para el primero y un pago de renta
pendiente para el segundo.

---

## Sin foto · el cuadro que APARECE, y los dos de finanzas — **nueva, 2026-09-25 (tarde)**

Cuatro más de la misma familia (B38), y la primera es distinta de todo lo anterior:
**hay un cuadro que antes no existía**.

- **El cuadro que aparece.** «Registrar pago» en la **lista de rentas** y **«Renovar»**
  en la ficha del contrato son botones de un solo clic. Cuando el servidor pide la
  contraseña, ahora **se abre un cuadro** —«Confirma con tu contraseña»— con el campo
  dentro y un botón «Confirmar y registrar el pago» / «Confirmar y renovar». **Es la
  foto que más falta**, porque es el único sitio de la aplicación donde el candado
  *crea* una pantalla en vez de añadir un campo a una que ya estaba.
- **«Generar factura»** con el campo «Tu contraseña» debajo del plazo, el botón diciendo
  **«Confirmar y emitir»** y —el detalle que importa— **el plazo, la sociedad emisora y
  las parcialidades en gris**: durante ese paso quedan en solo lectura a propósito, para
  que lo que se confirme sea lo mismo que se pidió.
- **«Registrar pago» de una cobranza** en el mismo estado, y aquí lo que hay que enseñar
  es que **los botones «Liquidar total» y «Registrar abono» desaparecen** y queda uno
  solo, «Confirmar y registrar». Es lo que impide confirmar un movimiento de dinero
  distinto del que se pidió.

**El manual no tiene apartado paso a paso de ninguno de los cuatro**, así que **no hay
ninguna captura que retirar**. Lo que sí cambió es el apartado 10.1: dos de sus filas
—«no hay ningún campo donde escribirla» y «pulsas Renovar y no pasa nada»— **estaban
mintiendo** con este arreglo y se corrigieron.

**Para tomarlas:** el tenant con el control de cambios **encendido** y la sesión **sin
desbloquear**; un pago de renta pendiente, un contrato a menos de 60 días de vencer, una
campaña sin comprobante y una cobranza con saldo.

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
