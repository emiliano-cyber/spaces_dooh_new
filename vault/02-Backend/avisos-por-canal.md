---
tipo: contrato
estado: verificado
actualizado: 2026-11-12
tags: [backend, avisos, notificaciones, correo, brevo, resend, whatsapp, rls, rojo]
archivos:
  - apps/web/lib/correo-proveedor.ts
  - apps/web/lib/server/email.ts
  - apps/web/lib/avisos.ts
  - apps/web/lib/server/avisos-canales.ts
  - apps/web/lib/server/avisos-repo.ts
  - apps/web/lib/server/avisos-sql.ts
  - apps/web/lib/server/avisos-controller.ts
  - apps/web/lib/server/correo-aviso.ts
  - apps/web/lib/server/notificaciones-repo.ts
  - apps/web/lib/server/propuestas-repo.ts
  - apps/web/app/api/perfil/avisos/route.ts
  - apps/web/components/demo/admin/AvisosCuenta.tsx
  - apps/web/lib/test/avisos-canal.e2e.test.ts
  - db/migrations/20261112_avisos_por_canal.sql
  - infra/env/app.env.example
---

# Avisos por correo (Resend o Brevo) y WhatsApp sembrado

> [!important] Decidido por el dueño el 2026-11-12
> «Hacer los avisos por correo y dejar sembrada la opción de envío por
> WhatsApp; lo de olvidé contraseña, solo correo». Y después: «hazlo con Brevo
> y Resend, pero aún no compraremos ni haremos nada: déjalo en una rama
> aparte». Migración aprobada en la misma conversación (zona ROJA R3).
>
> **Rama `feat/avisos-por-canal`**, sobre `integra/v0-12-10`. **Sin empujar.**
> No se contrató ningún proveedor ni se configuró ninguna instancia.

Hasta hoy los avisos de la campana (`notificar()`, [[02-Backend/finanzas-y-cobranza]],
[[02-Backend/comercial-propuestas-campanas]], [[02-Backend/operaciones-y-ot]])
vivían **solo dentro de la aplicación**. El único correo de avisos era el
diario de contratos a los Dueños (`/api/recordatorios`), que no cambia.

## 1 · El proveedor: Resend o Brevo

`EMAIL_PROVEEDOR` elige por dónde sale **todo** el correo de SPACE OS
(recuperar contraseña, invitaciones, propuestas, recordatorios y avisos):

| `EMAIL_PROVEEDOR` | Clave | API |
|---|---|---|
| vacío o `resend` | `RESEND_API_KEY` | `https://api.resend.com/emails`, `Authorization: Bearer` |
| `brevo` | `BREVO_API_KEY` | `https://api.brevo.com/v3/smtp/email`, cabecera `api-key` |
| cualquier otra cosa | — | **correo apagado** |

- **Vacío = Resend**: una instancia que no toque su `.env` sigue igual que antes.
- **Un valor desconocido apaga el correo** en vez de caer a Resend: un error de
  dedo se leería como «Resend 401» y mandaría a buscar al sitio equivocado.
- La forma de cada pedido vive en `lib/correo-proveedor.ts`, **puro** (sin red),
  y se prueba entera en `correo-proveedor.test.ts`. Brevo pide el remitente como
  objeto `{name, email}`: se separa el nombre que cita `remitenteConNombre`.
- Sin dependencia npm, como siempre: un paquete nuevo cambia la imagen de toda
  la flota.
- `EMAIL_FROM` tiene que ser de un dominio **verificado en el proveedor
  elegido**.

> [!warning] Space Eye NO cambia
> `space-eye/backend/src/services/correo.service.ts` sigue solo con Resend (su
> llave se pone en su panel). Pasarlo a Brevo es otra tarea y obliga a
> reconstruir la imagen de Space Eye.

## 2 · Los avisos por correo

1. Cada persona elige en **Configuración → Avisos** (menú de la cuenta) qué
   tipos quiere por correo. Los tipos son los de `notificar()`
   (`TIPOS_AVISO`, `lib/avisos.ts`): PROPUESTA, CAMPANA, ODC, FACTURA, PAGO,
   COBRANZA y OT. Los de contratos no están: ya tienen su correo diario.
2. `notificar()` inserta el aviso con `returning id`. **Solo si se insertó**
   (no un eco del mismo día, que la campana ya filtra) llama a
   `avisarPorCanales()`.
3. `avisarPorCanales()` busca los destinatarios (**espera** solo eso: dos
   consultas con el tenant de la petición) y deja los correos **saliendo sin
   esperarlos**. Guardar una factura no tarda lo que tarde el proveedor ni falla
   si el proveedor falla.
4. El correo es el mismo aviso que la campana, en el idioma de los documentos
   de la instancia (ADR 0049, `traducirNotificacion`), a nombre de la
   organización y con su `email_remitente` como respuesta. Botón a la pantalla
   del aviso si hay `APP_URL`; sin ella, sin botón.

**«Propuesta aceptada por el cliente»** no pasa por `notificar()` (llega por la
liga pública, sin sesión): se reparte en `propuestas-repo.ts` **después del
`commit`**, con `qConTenant` y su propia conexión. Dentro de la transacción, una
consulta que fallara la abortaría y la aceptación se perdería por un correo.

**Sin preferencias nadie recibe nada**: aplicar la migración no enciende ni un
correo. Y se puede encender el correo aunque hoy no haya clave: el día que la
pongan, empieza a llegar; la pantalla avisa de que hoy no sale.

## 3 · WhatsApp, sembrado

Lo que **ya está**: la columna `usuarios.telefono_whatsapp` (E.164, con check),
el valor `whatsapp` aceptado por el check de `avisos_usuario.canal`, la columna
de WhatsApp en la pantalla (apagada, «Próximamente») y el campo del teléfono,
que ya se guarda.

Lo que **falta** el día que haya cuenta de WhatsApp Business (API de Meta):

1. Programar `enviarWhatsapp()` en `avisos-canales.ts` con `WHATSAPP_TOKEN` y
   `WHATSAPP_NUMERO_ID` (comentadas en `app.env.example`).
2. Una **plantilla aprobada por Meta** por cada tipo de aviso: WhatsApp no deja
   mandar texto libre a quien no escribió primero.
3. Añadir `'whatsapp'` a `CANALES_QUE_SE_GUARDAN` y poner
   `estadoCanales().whatsapp.configurado` a lo que diga el entorno. Hasta
   entonces el servidor **rechaza** una preferencia por WhatsApp (400), para que
   nadie crea que la tiene puesta.

## 4 · Recuperar contraseña: solo correo

Recuperar la contraseña e invitar usuarios llevan un enlace para **entrar a la
cuenta**: van siempre por correo, a la dirección de la cuenta, con
`enviarEmail()`, y **no pasan por el reparto por canales**. Funcionan con Resend
o con Brevo. Lo vigila `avisos-solo-correo.test.ts`, que lee el fuente de
`auth/forgot`, `auth/reset` y `usuarios-controller.ts`.

## 5 · La tabla y la RLS

`avisos_usuario (tenant_id, usuario_id, tipo, canal, creado_en)`, PK
`(usuario_id, tipo, canal)`. Una fila = «lo quiere»; no hay columna «activo».
RLS fail-closed + FORCE como el resto, grants a `spaces_user`/`spaces_app`, y
`on delete cascade` con la persona. Ver [[04-Datos/esquema]] y
[[04-Datos/migraciones]].

El SQL vive en `lib/server/avisos-sql.ts` para que la e2e corra **las mismas
sentencias** contra Postgres real con el rol de la aplicación:
`lib/test/avisos-canal.e2e.test.ts` (15 casos: E.164, canal, idempotencia,
«lo que no viene se apaga», escritura desde otra organización, lectura sin
tenant, usuario inactivo, borrado en cascada). Dos mutantes medidos el 12/11
(quitar `u.activo = true`; quitar el `not exists` del borrado): mueren los dos.

Ruta: `GET/PUT /api/perfil/avisos` ([[02-Backend/api-endpoints]]), con
`usuarioActual()` como `/api/perfil/idioma`: el id sale de la sesión; un
`usuarioId` en el cuerpo se ignora.

## Lo que NO se verificó

- Un envío real por Resend o por Brevo: **no hay cuenta**, por decisión del
  dueño. Se probó la forma del pedido, no la respuesta del proveedor.
- La suite e2e completa con servidor (necesita build y Next en el 3311); se
  corrieron las 16 e2e de base (sin servidor).
- La pantalla en el navegador.
