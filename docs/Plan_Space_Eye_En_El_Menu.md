# Plan · Space Eye como módulo de SPACE OS, en el modelo padre-hijo

> **Autoridad:** decisión de Emiliano del **2026-09-10**: Space Eye es **un solo
> servicio central, operado por nosotros**, y **pasará a ser un módulo del menú**
> de SPACE OS. Hoy es un sistema aparte.
> **Estado: BORRADOR PARA REVISIÓN.** No está aprobado para ejecución. Se escribió
> para leerse con una segunda persona y discutirlo, no para empezar a teclear.
> **Repo verificado:** rama `fix/tarjeta-release-conf-demo`, `d68ade8`. Todas las
> rutas y líneas de este documento se abrieron con Read/Grep el **2026-09-10**.
> **No se ejecutó nada:** ni `ssh`, ni `curl` a producción, ni `doctl`, ni escritura
> fuera de este archivo. Los comandos contra servidores están escritos para que los
> corra una persona.

---

# Resumen en una página

**Lo que hay hoy.** Space Eye ya está enchufado, pero como una *tarjeta* dentro de
la ficha de una pantalla: `SiteFicha.tsx:423` monta `SpaceEyeVision`, que pregunta
al BFF (`app/api/sitios/[id]/space-eye/route.ts`), que a su vez llama a la API de
Space Eye con usuario y contraseña de env (`lib/server/space-eye.ts:17-19`). El
enlace pantalla↔cámara es **por texto**: `sitios.codigo_proveedor ==
device.billboard_code` (`space-eye.ts:120-122`).

**Y hoy está apagado en todas partes.** `SPACE_EYE_*` **no aparece** en
`infra/env/app.env.example` ni en `infra/env/instancia.env.example`. Toda instancia
nueva —incluida g500, la primera con datos reales— arranca con la tarjeta diciendo
`no_configurado`. Nadie lo ha notado porque nunca se encendió.

**Las tres cosas que el modelo padre-hijo obliga a resolver.**

1. **El aislamiento.** `visionDeCodigo` trae **la flota entera** de la cuenta
   (`space-eye.ts:120`) y busca el `billboard_code` que coincida. Con un Space Eye
   central y varias instancias, dos owners con el mismo `codigo_proveedor` —texto
   libre que escribe una persona en un formulario, sin unicidad global— hacen que el
   segundo vea la cámara del primero. Sin error y sin registro: es el modo de fallo
   de **R2**, que ya pasó dos veces en este proyecto.
2. **Las credenciales.** Poner `SPACE_EYE_PASS` en el `app.env` de cada owner es
   dar la contraseña de la cuenta completa a cada cliente, en un archivo que vive en
   un droplet que no controlamos.
3. **Dónde viven los datos.** Una tarjeta pregunta por *una* pantalla cuando alguien
   la abre. Un **módulo del menú** tiene lista, filtros e historial. Eso sobre una API
   ajena es un viaje al tercero en cada pintada. Y lo que no se arregla con velocidad:
   **la RLS no puede proteger datos que no están en nuestra base.**

**El requisito previo, y es el mismo por cualquier camino.** Space Eye hoy solo sabe
`billboard_code`. No sabe de organizaciones, ni de owners, ni de instancias. **Antes
de que esto sea un módulo, Space Eye tiene que aprender de quién es cada cámara.**
Sin eso no hay credencial con alcance, ni lista filtrada, ni aviso a la instancia
correcta. Ese trabajo es **en Space Eye, no en este repo**, y es el que manda el
calendario.

**La forma propuesta: espejo local.**

```
   Space Eye (central, nuestro)              instancia del owner
   ────────────────────────────              ───────────────────
   cámaras · fotos · dictamen IA   ──aviso──→   tablas propias (RLS)
   = el sistema de registro                     = lo que el módulo lee
                                   ←──repesca──  (reconciliación por cron)
```

Space Eye sigue siendo el dueño de las cámaras y de la IA. Cada instancia guarda
**en su propia base**, bajo RLS, solo lo que le concierne. El módulo del menú lee
tablas locales: rápido, filtrable, y protegido por el mismo mecanismo que todo lo
demás. El cruce `billboard_code → sitio` se resuelve **una vez al ingerir**, no en
cada vista.

**Por qué esta forma y no otra.** El camino de entrada ya está inventado en este
repo: `FLOTA_REPORTE_URL` en `instancia.env` es exactamente esto al revés —la
instancia le cuenta al padre, con cola en disco y reintentos—. Aquí Space Eye le
cuenta a la instancia. Y el argumento escrito para justificar aquello aplica igual:
*«el padre no puede consultarla… está en su derecho de cerrarla: es su servidor»*.

**Lo que este plan NO propone.** Mudar las cámaras a SPACE OS (que los teléfonos
reporten a la instancia del owner y Space Eye se reduzca a la IA). Es la versión
máxima del modelo soberano y filosóficamente la más limpia, pero cuesta portar el
backend de Space Eye, resolver el almacenamiento de fotos por instancia —justo la
decisión que quedó abierta en **F5.7**, «un bucket por instancia»— y decidir quién
corre la verificación. Queda como **destino**, no como siguiente paso.

---

# Decisiones que no decide un agente

Este plan las deja marcadas y **no las resuelve sobre la marcha**. Dos frenan
tareas concretas; las otras dos son de forma.

| # | Decisión | Qué frena |
|---|---|---|
| **D1** | **¿La IA de verificación se queda central para siempre?** Si algún día tiene que correr en casa del owner, el destino es el módulo nativo y el espejo se construiría para tirarlo | No frena nada hoy. Cambia si la Fase 2 es inversión o puente |
| **D2** | **¿En qué grupo del menú va?** Dos sitios defendibles: **Inventario** (`patrimonio`), porque la cámara es un accesorio de la pantalla; u **Operaciones** (`entregar`), junto a Campañas y Creativos, porque lo que hace es probar la entrega. **Recomendación: Operaciones** — el valor de Space Eye es la prueba de entrega, no el censo de aparatos | **E3.3** (una línea en `nav.ts`) |
| **D3** | **¿Qué roles lo ven?** Propuesta: `DUENO` y `OPERACIONES`. `COMERCIAL` es discutible: le sirve para enseñar la prueba al cliente | **E3.3** |
| **D4** | **¿Esto entra antes o después de cerrar el plan v3?** Del v3 quedan **dos** tareas (`F5.6` y `F5.7`), las dos «instalar de cero» y las dos de servidor. Este plan es trabajo de código y no compite por las mismas manos, pero sí por la misma atención | El arranque de la Fase 1 |

---

# Cómo se lee este plan

Cada tarea es **un commit con sentido**. Lleva etiqueta (`[código]`,
`[migración]`, `[externo]`, `[infra]`, `[verificación]`), **entorno** (PADRE / DEMO /
instancia de owner / Space Eye) y **quién** la ejecuta. Las tareas `[externo]` no se
tocan desde este repo: son trabajo en Space Eye.

**Reglas del repo que aplican y no se negocian:**

- Toda tarea que toque `tenant_id` o sesión es **ROJO** (R2) y pide
  `cd apps/web && npm run test:e2e`, no solo unitarias. *Las unitarias no ven los
  fallos de RLS: simulan la base.*
- **Prueba primero, en rojo y a la vista.** La implementación va en paso separado.
- `apps/web/lib/modulos.ts` y `apps/web/components/demo/shell/nav.ts` son **archivos
  de alto contacto** (`AGENTES.md:67-68`): se reclaman en el tablero por separado
  aunque estés en otra zona.
- **No se toca `db/schema.sql` directo**, ni
  `apps/web/lib/test/aislamiento.e2e.test.ts`, ni `servidor-e2e.ts`.
- Migraciones `AAAAMMDD_descripcion.sql`, transaccionales e idempotentes.
- Todo en **español**: archivos, funciones, columnas, comentarios.
- Capas fijas: `route.ts` → `*-controller.ts` → `*-repo.ts` → `db.ts`. El SQL vive en
  el repo, parametrizado, y toda operación por `id` lleva `and tenant_id = $n` como
  segunda capa sobre la RLS.
- La nota de la bóveda se actualiza **en el mismo commit** que cambia el código.

---

# Fase 0 · Lo que Space Eye tiene que aprender  `[externo]`

**Nada de la Fase 2 ni de la 3 arranca sin esto.** No es trabajo de este repo: es
trabajo en Space Eye, y conviene que lo lea quien lo mantiene.

### SE.1 · Cada cámara sabe de quién es  `[externo]` · Space Eye

- **Objetivo:** que un dispositivo de Space Eye tenga un dueño explícito
  (organización / owner / instancia), no solo un `billboard_code` de texto libre.
- **Depende de:** nada. **Bloqueante de:** SE.2, SE.4, E2.3, y de todo el aislamiento.
- **Por qué es lo primero:** hoy `GET /api/devices` devuelve la cuenta entera. Sin
  un dueño por dispositivo no se puede emitir una credencial con alcance, ni filtrar
  una lista, ni saber a qué instancia avisar.
- **Criterio de aceptación:** `GET /api/devices` autenticado con la credencial de un
  owner devuelve **solo** sus dispositivos, y con la de otro owner devuelve un
  conjunto **disjunto**. Se demuestra con dos credenciales y dos respuestas, no con
  una afirmación.

### SE.2 · Una credencial por instancia, de solo lectura  `[externo]` · Space Eye

- **Objetivo:** que cada instancia tenga **su** credencial, con alcance a sus
  dispositivos y sin permiso de escritura.
- **Depende de:** SE.1.
- **Por qué importa:** una credencial filtrada expone **un** owner, no la flota. Es
  el mismo razonamiento —y la misma contrapartida— que ya se aceptó por escrito con
  `REGISTRY_TOKEN` el 2026-09-01: *«los tokens de DigitalOcean son DE LA CUENTA, no
  del repositorio: el que se filtre de una instancia sirve para todas»*. Aquí sí
  podemos hacerlo bien desde el principio.
- **Criterio de aceptación:** la credencial de un owner recibe **403** (o un
  conjunto vacío) al pedir un dispositivo de otro, y **401** al intentar escribir.

### SE.3 · Cómo se sirven las fotos — y esto puede ser un agujero YA ABIERTO  `[externo]` · Space Eye

- **Objetivo:** saber, medido, si `storage_path` se sirve con o sin autenticación.
- **Depende de:** nada. Se puede averiguar hoy.
- **Por qué es urgente aparte del plan:** el navegador del cliente pide la foto con
  un `<img src>` directo contra el host de Space Eye
  (`SpaceEyeVision.tsx:113` y `:142`), **sin** mandar el JWT. Solo hay dos
  posibilidades y las dos piden acción:
  - **Se sirve sin autenticación** → cualquiera con la URL ve la foto de cualquier
    pantalla de cualquier owner. Hay que decidir si basta con rutas no adivinables
    (no basta, para datos de cliente) o hace falta URL firmada.
  - **Se sirve autenticada** → **las fotos no cargan** y nadie lo ha notado, porque
    ninguna instancia tiene la integración encendida. Entonces hace falta **E1.3**,
    el proxy por el BFF.
- **Criterio de aceptación:** una petición a una URL de foto **sin** cabecera de
  autorización, desde fuera, con su código de respuesta apuntado. Lo corre una
  persona:
  ```
  curl -si "<BASE>/<storage_path de una foto conocida>" | head -20
  ```
  `200` → es pública. `401`/`403` → hace falta el proxy.

### SE.4 · El aviso saliente hacia la instancia  `[externo]` · Space Eye

- **Objetivo:** que Space Eye pueda avisar a una instancia cuando hay foto o cambio
  de estado en una de **sus** cámaras.
- **Depende de:** SE.1. **Bloqueante de:** E2.3.
- **Forma propuesta:** `POST` a una URL por instancia, con un token propio en
  cabecera, cuerpo pequeño e **idempotente** (que reintentar no duplique).
- **Si no se puede hacer:** no bloquea el plan. La instancia hace *pull* por cron
  (**E2.4**), que de todos modos hace falta: un aviso perdido no se recupera solo.
- **Criterio de aceptación:** el aviso llega, y **reenviarlo dos veces deja una sola
  fila** en la instancia.

---

# Fase 1 · Cerrar lo de hoy, antes de construir nada encima

Esta fase **no depende del módulo**. Vale la pena aunque el módulo se retrase, y
conviene hacerla antes de encender la integración en cualquier instancia.

### E1.1 · La prueba negativa que fija el invariante  `[código]` · ROJO (R2)

- **Objetivo:** dejar escrito y en verde que **una instancia no puede ver la cámara
  de una pantalla que no es suya**, y que el cruce por `codigo_proveedor` **no** es
  una frontera de seguridad.
- **Depende de:** nada para escribirla.
- **Archivos:** `apps/web/lib/test/space-eye-aislamiento.e2e.test.ts` (nuevo).
  **No** se toca `aislamiento.e2e.test.ts`.
- **Prueba que falla primero — el caso negativo es el corazón:** dos tenants, cada
  uno con una pantalla, **el mismo `codigo_proveedor` en las dos**. El usuario del
  tenant A pide `/api/sitios/<id de B>/space-eye` y debe recibir **404**, nunca la
  cámara. Hoy el `route.ts` lee el sitio con RLS, así que esto **debería** pasar ya:
  la prueba lo **fija** para que no se rompa cuando el módulo crezca.
- **Y el caso que hoy sí falla:** con dos dispositivos en Space Eye que comparten
  `billboard_code`, `visionDeCodigo` devuelve **el primero del arreglo**
  (`space-eye.ts:121`, `.find()`). Se prueba contra un doble de la API, no contra el
  servicio real.
- **Comando de verificación:**
  ```
  cd apps/web && npm run build && npm run test:e2e
  ```
  > El `build` **antes** no es opcional: `lib/test/servidor-e2e.ts:31` arranca con
  > `npx next start`, que reutiliza el build existente y no construye nada. Sin él
  > mueren **todas** las e2e en falso, y tardan ~636 s en hacerlo.

### E1.2 · Las variables entran en la plantilla de la instancia  `[código]`

- **Objetivo:** que aprovisionar una instancia con Space Eye encendido sea copiar y
  rellenar, no descubrir tres variables leyendo el código.
- **Depende de:** SE.2 (para saber qué credencial se pone).
- **Archivos:** `infra/env/app.env.example`; `apps/web/lib/entorno.test.ts`;
  `docs/Runbook_Padre_Droplet_Nuevo.md`.
- **Prueba que falla primero:** en `entorno.test.ts`, que la plantilla **declara**
  las tres `SPACE_EYE_*` y que **ninguna trae valor real** — ni dominio, ni
  credencial. Es el mismo invariante que ya vigila el resto de la plantilla.
- **Y hay que corregir el runbook, no solo añadir:** hoy
  `docs/Runbook_Padre_Droplet_Nuevo.md:370` pone `SPACE_EYE_*` en la fila de *«No.
  Son de operación, y el PADRE es plano de control»*. **Eso sigue siendo correcto
  para el PADRE** y hay que dejarlo, pero la tabla no dice que **las instancias sí
  las llevan**, y leída de corrido hace pensar que la integración no va a ninguna
  parte.
- **Comando de verificación:** `cd apps/web && npm test -- entorno`

### E1.3 · Proxy de la foto por el BFF  `[código]` · **condicionada a SE.3**

- **Objetivo:** que la foto la sirva nuestra aplicación, no el host de Space Eye
  directamente.
- **Depende de:** SE.3. **Si SE.3 dice que las fotos son públicas y se acepta así,
  esta tarea no se hace.**
- **Archivos:** `apps/web/app/api/sitios/[id]/space-eye/foto/route.ts` (nuevo);
  `SpaceEyeVision.tsx` (cambiar el `src`).
- **Lo que resuelve de paso:** la URL de la foto deja de exponer el host y la
  estructura de rutas de Space Eye al navegador del cliente, y la autorización pasa
  a ser la nuestra —`exigir(...)` sobre un sitio del propio tenant— en vez de
  «quien tenga la URL».
- **Comando de verificación:** `cd apps/web && npm run build && npm run test:e2e`

---

# Fase 2 · El espejo local

Tablas en la base **de cada instancia**, bajo RLS. Es lo que convierte a Space Eye
de ventana en módulo.

### E2.1 · La migración de las tablas del espejo  `[migración]` · ROJO (R2)

- **Objetivo:** que la instancia tenga dónde guardar lo que le concierne.
- **Depende de:** nada para escribirla.
- **Archivos:** `db/migrations/20260910_espejo_space_eye.sql` (nuevo);
  `apps/web/lib/test/space-eye-espejo.e2e.test.ts` (nuevo). **No** se toca
  `db/schema.sql`.
- **Forma propuesta** (nombres en español, como manda la convención):
  - `camaras` — una fila por dispositivo que nos concierne: `tenant_id`, `sitio_id`,
    referencia al dispositivo en Space Eye, nombre, en línea, batería, señal, última
    conexión, modelo, estado.
  - `camara_capturas` — el histórico: `tenant_id`, `camara_id`, tomada en, ruta de la
    foto, dictamen, si es correcta, puntuación, GPS.
- **Las dos con `tenant_id` NOT NULL, sin `DEFAULT`, y con RLS por
  `app.tenant_id`**, como el resto. El `sitio_id` es lo que ata la cámara a una
  pantalla **de una vez**: el cruce por texto deja de ocurrir en cada consulta.
- **Prueba que falla primero — casos negativos:**
  - `insert` sin `tenant_id` **truena** con `23502`. (El `DEFAULT` a `rgb` se retira
    en `20260812_sin_default_tenant.sql`; estas tablas nacen ya sin él.)
  - con el contexto de tenant A, un `select` **no ve** ni una fila de B.
  - `qRaw` no aparece en el repositorio de este módulo. *Usar `qRaw` donde tocaba
    `q` devuelve cero filas en silencio, o datos de otra empresa: ya pasó dos veces.*
  - aplicar la migración dos veces seguidas **no lanza**.
- **Comando de verificación:** `cd apps/web && npm run build && npm run test:e2e`

### E2.2 · Repositorio y controlador  `[código]`

- **Objetivo:** las capas del módulo, con el SQL en su sitio.
- **Depende de:** E2.1.
- **Archivos:** `apps/web/lib/server/camaras-repo.ts`,
  `apps/web/lib/server/camaras-controller.ts` (nuevos).
- **Regla que aplica:** toda operación por `id` lleva `and tenant_id = $n` como
  segunda capa sobre la RLS. No es redundancia: es lo que convierte un fallo
  silencioso en cero filas explícitas.
- **Comando de verificación:** `cd apps/web && npm test`

### E2.3 · La entrada del aviso  `[código]` · ROJO (R2)

- **Objetivo:** el endpoint por el que Space Eye cuenta a la instancia lo que pasó
  con **sus** cámaras.
- **Depende de:** SE.4, E2.2.
- **Archivos:** `apps/web/app/api/space-eye/entrada/route.ts` (nuevo).
- **Forma:** token opaco propio en cabecera, **comparado en tiempo constante** —hay
  precedente en el token de flota (F5.8)—, cuerpo pequeño, **idempotente por
  `(dispositivo, tomada_en)`**.
- **Prueba que falla primero — los negativos son el punto:**
  - sin token → **401**. Con token equivocado → **401**.
  - un aviso que menciona una pantalla **que no existe en esta instancia** se
    **descarta** y no crea filas huérfanas. Este es el caso que impide que un Space
    Eye mal configurado siembre datos de un owner en la instancia de otro.
  - el **mismo aviso dos veces** deja **una** fila.
- **Comando de verificación:** `cd apps/web && npm run build && npm run test:e2e`

### E2.4 · Reconciliación por cron  `[código]`

- **Objetivo:** que un aviso perdido no deje el espejo mintiendo para siempre.
- **Depende de:** E2.2. **No depende de SE.4**: si el aviso saliente no se puede
  hacer, esta tarea es el único camino de entrada y sigue siendo suficiente.
- **Archivos:** `apps/web/app/api/space-eye/reconciliar/route.ts` (nuevo). Precedente
  de forma: `apps/web/app/api/recordatorios/route.ts`, que ya corre por token.
- **Por qué existe igual:** es el mismo razonamiento que la cola en disco de
  `FLOTA_REPORTE_URL` —*«si el padre no contesta, el reporte se guarda y sale en la
  siguiente corrida»*—. Un canal de avisos sin repesca es un canal que miente en
  cuanto falla una vez.
- **Comando de verificación:** `cd apps/web && npm test`

---

# Fase 3 · El módulo del menú

Un módulo son **tres cosas**, y las tres se pueden olvidar por separado.

### E3.1 · La migración del módulo de permiso  `[migración]`

- **Objetivo:** que exista el permiso `space_eye` en el catálogo, para todos los
  roles que deban tenerlo.
- **Depende de:** D3 (qué roles). **Bloqueante de:** E3.4.
- **Archivos:** `db/migrations/20260910_modulo_space_eye.sql` (nuevo).
- **Buena noticia medida hoy:** `rol_permisos` **no tiene `tenant_id`** — es un
  catálogo global `(rol, modulo, accion)` y `tienePermiso` es un `select 1` a secas
  (`auth.ts:173-179`). Así que es **una migración aditiva e idempotente**, con
  precedente literal en `db/migrations/20260804_modulo_inventario.sql`. En
  padre-hijo viaja sola: cada instancia la aplica en su `update.sh` sin que nadie
  entre al servidor.
- **Prueba que falla primero:** `tienePermiso('OPERACIONES', 'space_eye', 'ver')` es
  **false** hoy y **true** después; y sigue siendo **false** para un rol que no debe
  verlo. *`tienePermiso` es fail-closed: un módulo sin filas produce un usuario que
  entra y recibe 403 en todo — es lo que le pasó al rol `CLIENTE` (ADR 0010).*
- **Comando de verificación:** `cd apps/web && npm run build && npm run test:e2e`

### E3.2 · La fila en el catálogo de áreas  `[código]` · **alto contacto**

- **Objetivo:** que Administración pueda explicar qué abre la casilla.
- **Depende de:** E3.1.
- **Archivos:** `apps/web/lib/modulos.ts` — **archivo de alto contacto
  (`AGENTES.md:67`): se reclama en el tablero por separado.**
- **El cambio:** una fila en `AREAS` (`modulos.ts:29`) con `apiPropia: true`.
  `MODULOS` sale de ahí por reducción (`modulos.ts:57`) — *«dos listas divergen, una
  no puede»*—, así que no hay una segunda lista que actualizar.
- **Lo que la propia nota del archivo advierte y aplica aquí:** *«ocultarles el menú
  NO protegería el dato»*. Lo protege `exigir('space_eye', 'ver')` en cada endpoint.
- **Comando de verificación:** `cd apps/web && npm test`

### E3.3 · La entrada del menú  `[código]` · **alto contacto** · **condicionada a D2 y D3**

- **Objetivo:** que el módulo se vea, en el grupo que le toca.
- **Depende de:** D2, D3, E3.2.
- **Archivos:** `apps/web/components/demo/shell/nav.ts` — **alto contacto
  (`AGENTES.md:68`): es el menú Y el control de acceso a la vez.**
- **El cambio:** una fila en `NAV` (`nav.ts:92`). Recomendación: grupo `entregar`,
  después de `creativos`, con `roles: ['DUENO', 'OPERACIONES']`.
- **Por qué ahí:** el menú de este producto **cuenta el proceso en el orden en que
  ocurre**. Space Eye no es un aparato del patrimonio: es la **prueba de que lo
  vendido está saliendo**. Va donde está lo que se entrega, después del creativo que
  debía aparecer en la pantalla.
- **Comando de verificación:** `cd apps/web && npm test`

### E3.4 · Las páginas del módulo  `[código]`

- **Objetivo:** lista de cámaras con su estado, ficha de una cámara con su histórico
  de capturas y dictámenes, y filtro por «caídas» y «verificación fallida».
- **Depende de:** E2.2, E3.1.
- **Archivos:** `apps/web/app/(app)/(shell)/space-eye/page.tsx` y sus componentes.
- **Lo que la Fase 2 hace posible aquí:** todo esto son consultas a tablas propias
  con RLS. Sin el espejo, cada filtro sería un viaje a la API de un tercero.
- **Comando de verificación:** `cd apps/web && npm test`

### E3.5 · La tarjeta de la ficha pasa a leer el espejo  `[código]`

- **Objetivo:** que no queden **dos** caminos al mismo dato, uno rápido y otro lento.
- **Depende de:** E2.2, E3.4.
- **Archivos:** `SpaceEyeVision.tsx`, `app/api/sitios/[id]/space-eye/route.ts`,
  y `lib/server/space-eye.ts` (que pasa a servir solo a la ingesta).
- **Por qué es una tarea y no un detalle:** dejar la tarjeta llamando a Space Eye en
  vivo mientras el módulo lee el espejo produce **dos verdades** sobre la misma
  cámara, y la ficha y el módulo se contradicen en pantalla sin que nada falle.
- **Comando de verificación:** `cd apps/web && npm run build && npm run test:e2e`

---

# Fase 4 · Que llegue a los servidores, en el orden del modelo

### E4.1 · El PADRE no lleva la integración  `[infra]` · PADRE

- **Objetivo:** dejarlo dicho, porque es una omisión deliberada y las omisiones sin
  explicación se «arreglan» solas.
- **Depende de:** E1.2.
- **Lo que aplica:** el PADRE es **plano de control**, no opera pantallas.
  `Runbook_Padre_Droplet_Nuevo.md:370` ya lo dice; E1.2 solo aclara que las
  instancias sí las llevan.

### E4.2 · DEMO primero, con cámaras de prueba  `[infra]` · DEMO

- **Objetivo:** que el módulo se vea funcionando en el banco de pruebas antes de
  tocar a un owner.
- **Depende de:** E3.4.
- **Lo que aplica, y no es una preferencia:** **invariante 13** — ninguna tarea corre
  en la instancia de un owner sin pasar antes por el banco de pruebas. DEMO ya es una
  instancia de verdad desde el 2026-09-02: corre la **imagen del registro**, con
  `update.sh` y cron, el mismo camino que recorrerá un cliente.
- **Comando de verificación:** lo corre una persona, contra DEMO, desde fuera.

### E4.3 · Tarjeta humana: encender Space Eye en g500  `[infra]` · instancia de owner

- **Objetivo:** el primer owner con cámaras de verdad.
- **Depende de:** E4.2 en verde, SE.2.
- **Se escribe como tarjeta para que la corra una persona.** Ni `ssh`, ni `doctl`,
  ni `psql` contra un servidor desde aquí.
- Contenido: las tres `SPACE_EYE_*` de **g500** —su credencial, no la de la cuenta—
  en `/etc/space-os/app.env` con permisos `600`, y el reinicio del contenedor por la
  vía de `update.sh`.
- **Aviso que ya costó caro una vez:** `app.env` **se sourcea** en bash
  (`update.sh:700`), así que **un valor con espacios sin comillas hace que bash
  ejecute la segunda palabra**. La contraseña va entre comillas, sin excepción.

### E4.4 · Bóveda y bitácora  `[código]`

- **Objetivo:** que la documentación no quede describiendo el sistema de la semana
  pasada.
- **Depende de:** que las fases anteriores estén cerradas.
- **Archivos:**
  - `vault/02-Backend/integraciones-externas.md` — la fila de Space Eye pasa de
    «API externa gateada por env» a «módulo con espejo local»; `actualizado:` nuevo.
  - `vault/03-Frontend/modulos-internos.md` — el módulo nuevo en el menú.
  - `vault/04-Datos/esquema.md` y `migraciones.md` — **los recuentos cambian**: dos
    tablas y dos migraciones más. *Se miden, no se copian de aquí.*
  - `docs/Registro_Cambios.md` — entrada en lenguaje llano: se nota desde la
    aplicación, así que le toca.
- **Deriva encontrada de paso, para arreglar aquí:**
  `vault/01-Arquitectura/entorno-y-despliegue.md:1623` cita
  `space-eye.ts:20-22` para las variables de entorno. **Están en `:17-19`**: tres
  líneas de deriva. No da error, solo manda al sitio equivocado — que es exactamente
  el fallo que describe §5 de `CLAUDE.md`.

### E4.5 · ADR 0032  `[código]`

- **Objetivo:** dejar registrada la decisión y su contrapartida, no solo el plan.
- **Archivos:** `docs/adr/0032-space-eye-central-con-espejo-en-cada-instancia.md`
  (el siguiente libre: el último es el **0031**).
- **Lo que el ADR tiene que decir sin adornos:** que al elegir un Space Eye
  **central**, la cámara **deja de ser soberana** — si nuestro servicio cae, ningún
  owner ve su cámara, tenga o no su propio droplet. Es una contrapartida aceptada a
  cambio de operar la IA una vez en lugar de N. El espejo local **reduce** el daño
  (el módulo sigue mostrando el último estado conocido) pero **no lo elimina**: no
  habrá capturas nuevas.

---

# Lo que hay que saber antes de aprobar esto

1. **El calendario no lo manda este repo, lo manda Space Eye.** La Fase 0 es
   trabajo externo y bloquea las Fases 2 y 3 casi por completo.
2. **La Fase 1 se puede hacer ya**, y conviene hacerla aunque el módulo se aparque:
   son la prueba negativa del aislamiento y las variables en la plantilla.
3. **SE.3 es lo primero que preguntaría**, antes de aprobar nada: si las fotos se
   sirven sin autenticación, hay una exposición hoy, encendida o no la integración,
   y averiguarlo cuesta un `curl`.
4. **Nada de esto está empezado.** Este documento es lectura; no se ha tocado ni una
   línea de código ni de configuración.
