# Capturas pendientes — manual de usuario de septiembre

Corrida del **2026-09-24**, entorno **LOCAL** (`http://localhost:3470/spaces-dooh`,
`next build && next start`), base propia `spaces_manual_0924` preparada con
`manuales/preparar-base-2026-09-18.mjs`, guion `manuales/capturas-2026-09-18.spec.ts`.
Manual: `vault/08-Manuales/manual-usuario-2026-09-18.md`.

| | Cantidad |
|---|---|
| Capturas que había (21/09), no versionadas y con la numeración corrida | 10 |
| **Tomadas en esta corrida** (las 10 retomadas y renombradas, más 29 nuevas) | **39** |
| Pasos que quedan sin imagen | 3 grupos (abajo) |

Ninguna captura se simuló ni se retocó. Lo único que se alteró antes de disparar
es lo que manda la regla de datos: los códigos de recuperación salen difuminados,
y `enmascarar()` no encontró ningún otro dato real que tapar (la semilla usa correos
`.invalid` y RFC `DMO…`).

> Este archivo tenía hasta hoy los pendientes del manual de **agosto**
> (`manual-usuario-2026-08-11.md`), que se retiró el 24/09. Siguen en la historia de
> git si hacen falta.

---

## 1 · 1.1 «Guardarlos la primera vez», pasos 1-5

**Motivo: exige una sesión iniciada con Google.** La pantalla de primera entrada solo
aparece si `metodoSesion === 'google'` y el usuario no ha confirmado sus códigos
(`debeGuardarCodigos()`, `apps/web/lib/server/auth.ts`). En local no hay forma
legítima de abrir esa sesión sin pasar por Google, y falsear el método de sesión en
la base sería simular.

Lo que sí hay: la **pantalla de lista** de los pasos 2-5 es la misma que sale al
regenerar (1.2, paso 4), y está fotografiada ahí (`01-02-04-codigos-lista-nueva`).
Falta solo el texto del paso 1 («Entras con Google, así que no tienes contraseña…» y
«Mostrar mis códigos»).

**Para tomarla:** una cuenta de pruebas con Google en un entorno donde el OAuth
funcione, y añadir la prueba al guion.

## 2 · 4.2 «Asignar la razón social que emite un comprobante», pasos 1-4

**Motivo: no hay ninguna campaña lista para facturar.** La semilla crea ocho campañas
y las ocho ya tienen comprobante, así que «Listas para facturar» dice «Nada por
facturar ahora». Para tener una haría falta recorrer el flujo comercial entero
(propuesta → campaña → orden de compra, fotos y reporte), que es otro manual.

Sí está fotografiado el «Salió bien si» (`04-02-05-comprobante-emite`), sobre un
comprobante ya emitido.

**Y hay una diferencia que conviene saber antes de tomarla:** el manual dice
«Empiezas en: la campaña que vas a facturar» y «Abre la campaña. Pulsa «Generar
factura»». En el código, «Generar factura» está en **«Finanzas» → «Listas para
facturar»**, no en la campaña (`app/(app)/(shell)/finanzas/page.tsx:175`), y el botón
de confirmar se llama **«Emitir factura»**. No se pudo mirar en pantalla, así que va
aquí como sospecha fundada y no como hallazgo.

**Para tomarla:** que `scripts/semilla-demo.mjs` deje una campaña con el candado
completo y sin comprobante.

## 3 · 6.3 «Instalar la versión nueva», pasos 1-3, y las demás frases del 6.1

**Motivo: en local nadie publica una versión disponible.** La tarjeta solo ofrece
«Instalar» cuando `actualizaciones_instancia` tiene un `digest_disponible` distinto
del instalado, y esa columna la escribe **el actualizador** del servidor tras leer el
registro de imágenes — la aplicación no puede escribirla, a propósito
(`db/migrations/20260921_actualizaciones_instancia.sql`, el `grant update` por
columna). Escribirla a mano en la base sería simular justo lo que el ADR 0037 separa.

Sí están fotografiados el estado local («todavía no se ha comprobado»,
`06-01-01`) y el cambio de modo (`06-02-02`).

**Para tomarla:** una instancia real (DEMO) con una versión en `estable` más nueva que
la instalada. Es trabajo de servidor: lo corre una persona.

---

## Lo que se hizo distinto del manual para poder fotografiar, y por qué no es simular

- **7.2, la respuesta del ticket.** La escribe AS OOH desde el panel de flota, que
  llama a `PATCH /api/tickets` de la instancia con `x-flota-token`. El guion llama a
  **esa misma ruta** del servidor local, sin cookies —como el panel—, con un
  `FLOTA_TOKEN` puesto solo en ese servidor. El texto de la pantalla del cliente es el
  real; lo que no sale en ninguna foto es el panel.
- **1.3, el aviso de cuenta solo-Google.** La cuenta de pruebas se creó con
  contraseña y con `solo_google = true`, que es exactamente el estado que el aviso
  describe.
- **2.1, la organización vacía.** El cuestionario solo sale sin ninguna razón social,
  así que la base lleva una segunda organización, `demo-bienvenida`, recién creada.

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
  npx playwright test --config manuales/playwright.2026-09-18.config.ts

# 4. el PDF
node manuales/armar-pdf.mjs
```

`DOOHMAIN_PUBLISH_ENABLED=0` no es opcional: `.env.local` lo trae en `1`, y aunque este
guion no aprueba campañas, un servidor local con esa bandera publica contra pantallas
reales.
