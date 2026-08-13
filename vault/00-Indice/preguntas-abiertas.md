---
tipo: preguntas
estado: verificado
actualizado: 2026-08-10
tags: [preguntas, pendientes, riesgo]
archivos:
  - apps/web/lib/server/
  - db/schema.sql
  - .env.production.example
---

# Preguntas abiertas

> Lo que **no** se pudo determinar leyendo el código. Cada una lleva la
> evidencia de por qué se pregunta. Nada de esto está afirmado como hecho en el
> resto de la bóveda.

## 🔴 Necesitan respuesta humana antes de tocar el área

### P1 · ~~`RESEND_FROM` vs `EMAIL_FROM`~~ **RESUELTA el 07/08**

**Gana `EMAIL_FROM`; la plantilla estaba mal y ya se corrigió.**

Comprobado contra el `.env.production` real del droplet: declara `EMAIL_FROM`
(vacía) y **`RESEND_FROM` no existe ahí**. O sea que el código siempre tuvo
razón y `.env.production.example` llevaba el nombre equivocado.

Quien desplegara siguiendo la plantilla se quedaba **sin correo y sin aviso**:
`emailHabilitado()` exige las dos variables y devuelve `false` en silencio. La
plantilla ahora lleva el nombre bueno y la advertencia de «las dos o ninguna».

### P2 · ~~¿Un usuario puede quedarse solo con Google?~~ **RESUELTA el 07/08**

El alta «entra con Google» **genera igualmente un `password_hash`** que nadie ve
(`4206ab2`), así que el invariante se mantiene y nadie queda encerrado.
Conservado aquí como advertencia: **no introduzcas un camino de alta que deje el
hash nulo.** Ver [[autenticacion-y-sesion]].

### P3 · ¿Quién es dueño del proyecto de Google Cloud?

`DESPLIEGUE_GOOGLE.txt:72-73` exige una **cuenta de empresa**, no la personal de
nadie. Las credenciales ya están configuradas y verificadas en producción
(`f6e4132`), pero el código no dice qué cuenta las emitió.

**Pregunta:** ¿qué cuenta posee el proyecto y quién rota el `client_secret`?

### P3b · ~~¿El registro público es temporal o permanente?~~ **DECIDIDA el 10/08**

**El autorregistro es ABIERTO y permanente.** Decisión del usuario, confirmada el
10/08. `NEXT_PUBLIC_AUTOREGISTRO=1` se queda.

Eso convierte V2-05 del plan de incidencias en la **opción (A), «abierta con
guardas»**, que no es «no hacer nada» — implica tres trabajos pendientes:

1. **Verificación de correo** para el alta por contraseña (la de Google está
   exenta: Google ya verificó). Hoy cualquiera se da de alta con un correo que no
   controla.
2. ~~**Unificar la política de contraseña**~~ **HECHO el 10/08.** Ganó la
   fuerte. La regla se movió a `lib/password.ts` —fuera de `server-only`— para
   que los formularios usen LA MISMA función en vez de reimplementarla: ése era
   el fallo de fondo, no el número. Los otros dos formularios pedían 8 pero sin
   letra ni número, así que «aaaaaaaa» también rebotaba. Hay una prueba que lee
   los tres ficheros y falla si alguien vuelve a contar caracteres a mano.
3. **Anti-abuso**: el rate limit de signup es 5/hora por IP
   (`app/api/signup/route.ts:25`); revisar si basta con el alta abierta a
   internet, y que el error de slug no permita enumerar organizaciones.

Hasta que eso exista, sigue siendo cierto que cualquiera que llegue a
`demo.space-os.io` crea una organización y un usuario Dueño en la base real.

### P3c · El aislamiento de `password_resets`, a medias

`f703c1c` lo pasó a fail-closed, y `ba8cb12` deja anotado que **queda una parte
pendiente para el lunes 10/08**.

**Pregunta:** ¿qué falta exactamente? Es zona ROJA a medio camino, y quien la
retome debería empezar por ahí.

### P4 · `rol_permisos` es global — ¿es lo querido a largo plazo?

No tiene `tenant_id` ni RLS (`db/schema.sql:75-80`). La matriz de permisos es de
la **instalación entera**, compartida por las cinco organizaciones. Un cambio de
permisos de un rol se lo cambia a todo el mundo.

**Pregunta:** ¿es una decisión consciente (los roles son del producto, no del
cliente) o es la misma deuda que ADR 0011 arregló para `config_negocio`?

### P5 · ¿Cómo se sabe qué migraciones están aplicadas en producción?

No hay tabla de control ni herramienta. El único registro son las notas
`DESPLIEGUE_*.txt` de la raíz, escritas a mano.

**Pregunta:** ¿se asume que el repo y `spaces_prod` están en sync, o hay que
reconciliar? Ya hubo una divergencia de 27 columnas
(`20260805_objetos_solo_en_prod.sql`).

## 🟡 Deuda identificada, decisión pendiente

### P6 · ADR 0011 dice «Propuesta» pero está en producción

El código y `20260805_config_negocio_por_tenant.sql` están aplicados. El
documento no se actualizó. **¿Se acepta formalmente o hay algo sin cerrar?**

### P7 · `CLIENTE` sigue en el enum `rol_demo`

ADR 0010 lo retiró, pero quitarlo de un enum de Postgres exige recrear el tipo y
todas las columnas. **¿Se deja como está, o se planifica la limpieza?**

### P8 · El `AuthProvider` muerto: ¿cuándo se retira?

`lib/auth-context.tsx` sigue montado en `providers.tsx:34` y lo importan
`PermissionGuard.tsx:4,14` y `OTMovil.tsx:6,190`. Sus fetch fallan en silencio.

**Pregunta:** ¿`OTMovil` funciona hoy en campo, o depende de un `user` que
siempre es `null`? Es la única de esta lista con posible impacto operativo real.

### P9 · Cookie `spaces_tenant_activo` sin `Secure` — **NO es bug hoy** (07/08)

`app/api/tenant-activo/route.ts:23` usa `process.env.COOKIE_SECURE === '1'` en
vez de `cookieSecure()`.

Comprobado en el droplet: **`COOKIE_SECURE=1` sí está puesta**, así que hoy la
cookie viaja con `Secure` igual que `spaces_sesion` y `spaces_csrf`. No hay
nada que arreglar con urgencia.

Se deja abierta como **deuda**, no como bug: depende de una variable en vez del
helper, así que el día que alguien monte un entorno sin ella —o la quite por
error— esta cookie perderá `Secure` **y las otras dos no**, porque
`cookieSecure()` cae a `NODE_ENV === 'production'`. Una divergencia así no falla:
solo deja de proteger. Arreglo de una línea cuando se toque esa ruta.

### P10 · No se purgan sesiones ni tokens vencidos

`sesiones` y `password_resets` filtran por fecha al leer, pero las filas se
acumulan indefinidamente. **¿Hace falta un barrido, o el volumen no lo justifica?**

### P11 · El rate limit no sobrevive al escalado

`lib/server/rate-limit.ts` es un `Map` en memoria, y funciona porque pm2 corre
**una** instancia en modo fork. **¿Hay plan de escalar? Si sí, hay que migrar a
un store compartido antes.**

### P12 · Códigos de pantalla únicos entre organizaciones

`sitios.clave_interna` y `sitios.codigo_proveedor` son `UNIQUE` **globales**, sin
`tenant_id` (`db/schema.sql:124-125`). Dos organizaciones no pueden usar el mismo
código de proveedor.

**Pregunta:** ¿es deseado (los códigos son del proveedor, que es único) o va a
chocar cuando dos clientes compartan proveedor?

### P13 · Defaults en `PEN`/`IGV` con operación en México

`db/schema.sql:110,390,545` ponen `PEN` e `IGV 18%`. Hay migraciones que corrigen
a `MXN` (`20260724_a3_moneda_default_mxn.sql`), pero los defaults del esquema y
los nombres de columna (`facturas.igv`) siguen.

**Pregunta:** ¿queda alguna ruta que use el default sin corregir?

### P14 · El store de zustand y el BFF conviven

`lib/data/store.ts` guarda el `DemoState` completo en memoria (herencia de la
demo) y `HidratarSitios` lo rellena desde el BFF.

**Pregunta:** ¿la dirección es retirar el store, o se queda como caché de UI? Un
agente que añada pantalla necesita saber de cuál lee.

### P15 · Deriva del `tenant_id` por defecto — ✅ RESPONDIDA el 2026-08-13

**23** tablas —no 21, el conteo viejo era del 03/08— tienen `DEFAULT` de
`tenant_id` al tenant `rgb` (`db/schema.sql:604-609` y `:615`). Ese default es lo
que ha etiquetado filas de otras organizaciones como RGB. `config_negocio` se dejó
**sin** default a propósito (ADR 0011).

**Pregunta:** ¿se quitan los defaults para que un insert sin tenant falle en vez de
mentir?

**Respuesta: sí.** La migración `db/migrations/20260812_sin_default_tenant.sql`
(F1.2 del plan v3, commit `65bf9b5`) los retira recorriendo el **catálogo**, no una
lista, porque producción tiene tablas que `schema.sql` no trae. Lleva guard —aborta
si alguna tabla tuviera `DEFAULT` sin `NOT NULL`— y assert final.

> [!warning] Escrita y probada en local; **NO aplicada en producción**
> Aplicarla al droplet es **F1.5**, y la corre una persona. Hasta entonces
> producción sigue etiquetando en silencio. Ver
> [[07-Agentes/ejecucion-plan-v3]] y [[verificacion-de-produccion]].

Lo que **no** resuelve: las filas ya mal etiquetadas. Eso se decide en la Fase 7,
tenant por tenant. Quitar el default detiene la hemorragia, no cura la herida.

## 🟢 Menor

### P19 · El `catch` vacío de la bitácora (INC-06, 10/08)

`registrarAccion` (`lib/server/acciones-repo.ts`) se traga el error **sin
registrarlo** y va en su propia transacción, después del commit de la operación.
**8 de 8** handlers `DELETE` registran; **0 de 8** de forma atómica.

**Pregunta, en dos partes:**
1. ¿Basta con **loguear** el fallo (arreglo de una línea en `acciones-repo.ts`),
   o hace falta que la operación se revierta si no se pudo auditar?
2. Si hace falta atomicidad: implica pasar el cliente de transacción a
   `registrarAccion` y envolver los 8 handlers. Es un cambio en zona 🔴.

Contexto para decidirlo: la bitácora se usa **como prueba** en este sistema (es
el argumento entero del ADR 0009). Un borrado sin rastro y sin aviso es
exactamente lo que esa decisión intentaba evitar en otro flujo.

### P16 · `vault/.obsidian/` no está en `.gitignore`

No lo añadí: el criterio de aceptación exige no modificar nada fuera de
`vault/`. Cuando alguien abra la bóveda en Obsidian se creará esa carpeta con
configuración local.

**Sugerencia:** añadir `vault/.obsidian/` a `.gitignore` en un commit aparte.

### P17 · `BASE_PATH` está duplicado

`middleware.ts:6` y `next.config.mjs:19`, con un comentario que dice que deben
coincidir. **¿Se extrae a una constante compartida?**

### P18 · `README.md` describe una arquitectura que ya no existe

Habla de `apps/api` (Fastify+Prisma), `/var/www/spaces-dooh` y despliegue
automático en cada push. **¿Se reescribe o se marca como histórico?**

## Cómo usar esta lista

1. Si vas a tocar un área con pregunta abierta, **léela primero**.
2. Cuando alguien responda, mueve el hecho a la nota que corresponda y **borra
   la pregunta de aquí**.
3. Si al leer código encuentras algo indeterminable, **añádelo** en vez de
   suponerlo.

## Relacionadas
[[MOC-Proyecto]] · [[zonas-de-riesgo]] · [[decisiones]] ·
[[entorno-y-despliegue]] · [[AGENTES]]
