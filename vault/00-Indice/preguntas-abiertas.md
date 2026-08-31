---
tipo: preguntas
estado: verificado
actualizado: 2026-08-31
tags: [preguntas, pendientes, riesgo]
archivos:
  - apps/web/lib/server/
  - db/schema.sql
  - .env.production.example
---

> [!danger] 2026-08-24 · P1 dejó de ser una pregunta: la cerraron los hechos
> **Se perdió el acceso al droplet viejo** (`209.97.146.136`), así que las tres
> salidas que P1 barajaba —convertirlo en DEMO, apagarlo o guardarlo de reserva—
> **son todas imposibles**. Queda abandonado: público, no actualizable y no
> apagable, con el certificado venciendo el **2026-10-26**.
>
> **DEMO pasa a vivir dentro del PADRE** ([ADR 0015](../../docs/adr/0015-demo-dentro-del-padre.md)),
> y con eso **F4.1 y F7.1 pasan a IMPOSIBLES** — no a pendientes.
>
> ⚠️ **NADA DE ESTE BLOQUE SIGUE EN PIE, 2026-08-25.** El acceso **nunca se
> perdió**: se entró sin dificultad y se completó el censo de **F4.1**, que queda
> **CERRADA**. Con ella, **F7.1 vuelve a ser trabajo**. El droplet **no está
> abandonado** —funciona, y su certificado **sí se renueva** con acceso, así que
> la fecha del 26/10 se disuelve—. Y el ADR 0015 queda **superado** por el
> [ADR 0016](../../docs/adr/0016-demo-se-queda-en-su-droplet.md): **DEMO se queda
> en su propio droplet**.
>
> ✅ **Y F0.1 quedó CONTESTADA ese mismo día, en la última ventana que hubo:**
> `signup` devolvió **503** (apagado) y `login` **200**, o sea que el servicio
> estaba vivo y el 503 era la bandera, no una caída. En cuanto ese nombre deje de
> apuntar a esa máquina, la pregunta ya no tenía respuesta posible.
>
> **Lo que sigue abierto:** **TH-P4** (el registry), que mantiene bloqueadas F3.5
> y F3.6, y los códigos de recuperación del Dueño, que no existen.
>
> ✅ **2026-08-31 · TH-P4 dejó de estar abierta.** El registro existe:
> `registry.digitalocean.com/registryspaces`, NYC3, plan gratuito. Lo que queda es
> que una persona ponga las variables y empuje la primera etiqueta
> (`docs/evidencias/registry-TH-P4b.txt`). **La que sigue abierta de verdad es la
> otra**, y no la resuelve el registry: **qué dirección representa a DEMO** para el
> smoke de `promover.yml`, hoy sin candidata válida — `demo.space-os.io` apunta a la
> máquina que el ADR 0023 sacó del modelo, y la DEMO real (el `3001` dentro del
> PADRE) no tiene dominio desde el ADR 0024.
>
> ⚠️ **Y el margen es más estrecho de lo que parecía** (medido el 31/08):
> `promover.yml:127-129` **exige que `DEMO_URL` empiece por `https://`**, y su
> propio mensaje pide «la base pública de DEMO, CON el basePath, sin barra final».
> No admite un `127.0.0.1:3001`. Así que **apuntar el smoke al puerto por dentro no
> es una salida disponible** sin abrir el workflow — y abrirlo sería replanear.
> Lo que queda sobre la mesa es **darle un nombre público propio al proceso del
> `3001` del PADRE**.

---
# Preguntas abiertas

> [!danger] 2026-08-27 · EL DROPLET VIEJO SE RETIRA — lo de abajo sobre él caduca
> **`209.97.146.136` ya no se usa** (decisión de Jochelo, 27/08) y **sus datos
> eran de prueba**: no hay organizaciones reales que rescatar. El plan v3 se
> escribió el 13/08, seis días antes de la corrección del 19/08 sobre
> `spaces_prod`, y por eso arrastraba tres censos y una migración contra datos
> que nunca fueron reales.
>
> **SEIS tareas quedan SIN OBJETO:** `F0.2`, `F1.1`, `F1.5`, `F7.1`, `F7.2`,
> `F7.3`. **La Fase 7 entera.** El plan pasa de **46 tareas a 40 con objeto**.
> (**`F0.1` no entra**: ya estaba CERRADA el 24/08 con medición — `signup 503`
> más `login 200`, que descarta que el 503 fuera una caída.)
>
> Todo lo que esta nota diga más abajo sobre **el destino de `rgb`, el censo de
> `spaces_prod`, migrar PIXELED o desenredar la Fase 7** describe un problema que
> **ya no existe**. Se conserva como historia; no es trabajo pendiente.
>
> **Y `demo.space-os.io` queda CERRADO por el [ADR 0024](../../docs/adr/0024-demo-space-os-io-es-la-demo-original-y-se-elimina.md),
> que sustituye al 0021:** ese nombre **es solo la demostración original y se
> eliminará**. No se mueve al PADRE, no se le emite certificado y no se le busca
> máquina. **`F4.3` queda SIN OBJETO** y el plan baja a **39 tareas con objeto**.
> Su certificado (26/10) pasa a ser **caducidad natural, no plazo**.
> **Ya no se pregunta.**
> Contexto: [[modelo-instancias-soberanas]] · `vault/07-Agentes/diario/2026-08-27`


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

### P3b · ~~¿El registro público es temporal o permanente?~~ **REDECIDIDA el 14/08**

> [!important] La decisión del 10/08 quedó revertida
> **El autorregistro va CERRADO en TODAS partes: local, producción y DEMO.** Decisión
> de Jochelo del **2026-08-14**, que sustituye a la del 10/08 («abierto y
> permanente»). Se conserva la anterior más abajo porque explica por qué el código y
> varias notas hablaban de un registro abierto.
>
> **Ninguna instancia lo abre.** La bandera `AUTOREGISTRO` existe y funciona (F2.6),
> pero hoy nadie la enciende.
>
> Esto **contradice F4.4 del plan** (`Plan_Instancias_Soberanas_v3.md:1345`), que
> manda encender el registro en DEMO. El plan no se ha tocado; la contradicción está
> registrada en [[07-Agentes/ejecucion-plan-v3]].

> [!warning] Y dejó una pregunta nueva: ¿cómo nace una organización? — ✅ **CERRADA el 2026-08-19**
> Con el registro cerrado en toda la flota, **`POST /api/signup` queda sin uso** y el
> alta de una organización nueva **ya no tiene camino por la aplicación**.
>
> **Hasta el 19/08 lo único que quedaba era el tenant `rgb`**: lo sembraba
> `db/schema.sql` y `bootstrap-auth.mjs` lo resolvía **por slug `rgb`**, así que
> **cada instancia nueva habría nacido con una organización llamada `rgb`** —la
> identidad de otro owner dentro de la instancia de cada cliente, que es justo lo
> que el modelo de instancias soberanas existe para evitar.
>
> **Lo cerró `9d609f0`.** El esquema nace sin ninguna organización
> (`db/schema.sql:598-611`) y quien la crea es el **aprovisionamiento**:
> `apps/web/scripts/bootstrap-auth.mjs` la crea y pide la identidad por entorno
> —`ORG_SLUG`, `ORG_NOMBRE`, `ADMIN_EMAIL`, `ADMIN_NOMBRE`, ninguna con valor por
> omisión (`bootstrap-auth.mjs:54-82`)— y aborta con salida 1 si falta cualquiera
> o si la organización no queda creada de verdad. En F5.2 lo sustituye la ruta de
> bootstrap de un solo uso. Ver [[esquema]] y [[migraciones]].
>
> **Lo que NO cerraba:** **P1** (destino del tenant `rgb` y del droplet actual).
> Se resolvió cómo nace una instancia nueva, no qué se hacía con el `rgb` que ya
> existe en producción.
>
> **P1 quedó CERRADA el 2026-08-20**, y por una vía que no era ninguna de las
> previstas: **el droplet actual pasa a ser el PADRE** —el plano de control, no un
> entorno de negocio— y **sus datos, `rgb` incluido, se recrean desde cero**,
> porque son de prueba. No hay que archivarlos ni migrarlos. Con eso **P2 también
> cae**: PIXELED nace como instancia nueva y su información se recarga, así que
> F5.7 vuelve a ser un aprovisionamiento limpio. Ver [[ejecucion-plan-v3]] y
> [[modelo-instancias-soberanas]].
>
> ⚠️ **Ese párrafo describe P1 tal como nació, y ya NO es lo vigente.** El
> PADRE **no** es el droplet actual: nació en una máquina nueva el 21/08 y está
> corriendo. Y el **21/08 se decidió que el droplet viejo se queda como DEMO**, lo
> que ahorra la tercera máquina que pedían F4.2 y F4.3 — **condicionado a correr
> F4.1 (el censo) antes de recrear su base**. La cadena completa de las dos
> enmiendas está en [[modelo-instancias-soberanas]].

*Decisión anterior, del 10/08, ya no vigente:* el autorregistro era **abierto y
permanente**, y la bandera encendida se quedaba.

> [!warning] Ojo: la bandera se RENOMBRÓ el 14/08 y ahora es fail-closed (F2.6)
> Ya no se llama `NEXT_PUBLIC_AUTOREGISTRO` sino **`AUTOREGISTRO`**, y solo `1`
> la enciende. Un `.env` que siga diciendo `NEXT_PUBLIC_AUTOREGISTRO=1` **no
> tiene efecto**, y el resultado por omisión es el registro **CERRADO** — o sea,
> lo contrario de lo que esta decisión pide. Todo entorno donde el registro deba
> seguir abierto necesita la línea nueva `AUTOREGISTRO=1`.
>
> Y el alcance de la decisión cambió con el modelo de instancias soberanas: el
> registro abierto es de **DEMO**, no de cada instancia de owner.

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

> [!success] RESPONDIDA Y CERRADA el 2026-08-27
> `lib/auth-context.tsx` se retiró entero, con la pista archivada. **La respuesta
> a la pregunta de abajo resultó ser «ninguno de los dos estaba vivo»**:
> `PermissionGuard` y `OTMovil` no los importaba nadie, y la página real
> `/m/ot/[id]` renderiza `OTVista`.
>
> Lo que **sí** estaba vivo, y ninguna de las dos notas decía, es que el provider
> **se ejecutaba en cada carga de página en producción**. «Sus fetch fallan en
> silencio» era la parte correcta y la más engañosa: fallaban, sí, pero contra
> `localhost` **del visitante**, y la rama de éxito habría instalado una sesión.

~~**Pregunta:** ¿`OTMovil` funciona hoy en campo, o depende de un `user` que~~
~~siempre es `null`? Es la única de esta lista con posible impacto operativo real.~~

**Respondida el 2026-08-27: la pregunta no tenía objeto.** `OTMovil` no
funcionaba ni dejaba de funcionar en campo porque **no estaba en ninguna ruta**:
la vista móvil de OT la sirve `OTVista`. El impacto operativo que se temía era
cero; el que había, y nadie miraba, estaba en el layout raíz.

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

**23** tablas —no 21, el conteo viejo era del 03/08— **tenían** `DEFAULT` de
`tenant_id` al tenant `rgb`. Ese default es lo que ha etiquetado filas de otras
organizaciones como RGB. `config_negocio` se dejó **sin** default a propósito
(ADR 0011).

**Pregunta:** ¿se quitan los defaults para que un insert sin tenant falle en vez de
mentir?

**Respuesta: sí**, y por dos vías distintas, cada una para un tipo de base:

1. **Las que ya existen** — la migración `db/migrations/20260812_sin_default_tenant.sql`
   (F1.2 del plan v3, commit `65bf9b5`) los retira recorriendo el **catálogo**, no
   una lista, porque producción tiene tablas que `schema.sql` no trae. Lleva guard
   —aborta si alguna tabla tuviera `DEFAULT` sin `NOT NULL`— y assert final.
2. **Las que nacen** — desde el **2026-08-19** (`9d609f0`) `db/schema.sql` ya **no
   los crea**. Se fue con el seed del tenant `rgb`, que era lo único que les daba a
   qué apuntar. El array de las 23 tablas sigue en `db/schema.sql:617-621` y el
   bucle que las recorre en `:631-640`, pero ese bucle ya no pone ningún `DEFAULT`.

> [!warning] Escrita y probada en local; **NO aplicada en producción**
> Aplicarla al droplet es **F1.5**, y la corre una persona. Hasta entonces
> producción sigue etiquetando en silencio — y sigue haciendo falta, porque el
> cambio del 19/08 solo afecta a las bases que **nacen**. Ver
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
