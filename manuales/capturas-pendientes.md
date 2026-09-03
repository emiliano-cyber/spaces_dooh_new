# Capturas pendientes

Corrida del **2026-08-11**, entorno **LOCAL** (`http://localhost:3000/spaces-dooh`),
script `manuales/capturas.spec.ts`.

| | Cantidad |
|---|---|
| Capturas tomables según el plan | 32 |
| **Logradas** | **3** |
| Pendientes por el entorno (ver A.2) | 29 |
| Bloqueadas de origen (no estaban en las 32) | 10 |

Ninguna captura se simuló ni se retocó. **Cuatro capturas se descartaron a
propósito** — ver el apartado A.

---

## A · Pendientes (29): dos bloqueos de entorno, uno resuelto y otro no

Las credenciales llegaron y **funcionan**: la sesión entra como «Dueño alfa»
(rol DUENO) y `/api/auth/me/` responde 200. Los bloqueos han sido del entorno.

### A.2 · Bloqueo VIGENTE — el servidor de desarrollo sirve 404 en sus recursos

**Estado al cierre: sin resolver.** Es lo que impide tomar las 29.

Segunda corrida (2026-08-11, 19.6 min): **3 pasaron, 30 fallaron.** Las 3 que
pasaron son las que no necesitan sesión y corrieron al principio. A partir de
ahí, todas fallaron por tiempo agotado esperando elementos que nunca aparecen.

La causa **no es el script ni la sesión**. Comprobado:

- `/api/auth/me/` → **200** · `/api/estado/` → **200** con 6 382 bytes de datos.
  La migración de A.1 quedó bien aplicada y la sesión es válida.
- El HTML del servidor llega entero (60 946 caracteres, con el `<aside>` del
  menú dentro).
- Pero **todos** los recursos de `/_next/static/...` responden **404** con tipo
  `text/html`, así que el navegador rechaza CSS y JavaScript:

  ```
  Refused to execute script from '…/_next/static/chunks/main-app.js'
  because its MIME type ('text/html') is not executable
  ```

Sin JavaScript la aplicación no hidrata: queda el HTML del servidor, sin menú
funcional, sin datos y sin diálogos. De ahí que hasta `01-04`, que sí salió en
la corrida anterior, ahora falle.

**Por qué pasa.** El directorio `apps/web/.next` dejó de corresponder al
servidor que está corriendo:

- `apps/web/.next/static/chunks/` contiene fragmentos con hash de
  **compilación de producción** (`1528-baa888c22931280e.js`).
- **No existe** `main-app.js`, que es el fragmento propio del modo desarrollo y
  justo el que el navegador pide.
- No hay `BUILD_ID`.
- `.next/static` quedó con fecha de las 23:01, en mitad de la corrida.

Es decir: mientras el servidor de desarrollo seguía en marcha, algo escribió
encima de su `.next` una compilación de producción (un `npm run build`). El
servidor sigue respondiendo el HTML —por eso parece vivo— pero sus recursos de
cliente ya no están donde los pide el navegador.

**Cómo se arregla** (lo tiene que hacer quien es dueño del proceso; este agente
no mata servidores ajenos):

```
# detener el `npm run dev` en marcha, y luego:
rm -rf apps/web/.next
npm run dev
```

Después basta con relanzar la corrida; el script no necesita ni un cambio.

### A.1 · Bloqueo RESUELTO — faltaba una migración

**Estado: resuelto el 2026-08-11.** Se deja escrito porque explica la primera
corrida fallida y porque el diagnóstico sirve si vuelve a pasar.

### El diagnóstico

`GET /spaces-dooh/api/estado/` responde **500**. Esa ruta agrega los datos de
todos los módulos y es la que hidrata el shell, así que al fallar **todos** los
módulos pintan la misma pantalla:

> **No se pudieron cargar los datos.** La información no llegó del servidor. No
> es que no existan datos: no se pudieron leer.

Causa exacta, comprobada contra la base:

```
column "archivada_en" does not exist
```

Falta aplicar **`db/migrations/20260810_notificaciones_archivada_en.sql`**, que
agrega `notificaciones.archivada_en`. `listarNotificaciones()`
(`apps/web/lib/server/notificaciones-repo.ts`, líneas 77, 97 y 123) filtra por
esa columna, revienta, y se lleva por delante la respuesta entera de
`/api/estado`.

Se comprobaron las demás columnas de migraciones recientes
(`sitios.max_clientes`, `config_negocio.max_clientes_pantalla`,
`arrendadores.rfc`, `tenants.exigir_reautenticacion`, `propuestas.token_publico`)
y **todas están**. Es la única migración pendiente.

### Cómo se resolvió

Aplicar una migración es un cambio de **esquema**, no una captura: lo ejecutó el
humano, no este agente. El comando que funcionó:

```
DATABASE_URL='postgresql://spaces:spaces@localhost:5433/spaces'   node scripts/apply-migration.mjs db/migrations/20260810_notificaciones_archivada_en.sql
```

**Ojo con el rol.** El comando sin `DATABASE_URL` explícito **falla**: con
`.env.local` el script conecta como `spaces_app`, que no es dueño de las tablas,
y responde `must be owner of table notificaciones`. Hay que forzar el rol dueño,
igual que en producción las migraciones van como `postgres` y no con el rol de
la aplicación.

> **Antes de correrlo, lee lo que imprime.** `apply-migration.mjs` resuelve
> `DATABASE_URL` prefiriendo `apps/web/.env.production` **por encima** de
> `.env.local`. Hoy ese archivo no existe en la máquina (comprobado), así que
> apunta a local — pero si aparece una copia del `.env` del droplet, el mismo
> comando escribe en PRODUCCIÓN. El script imprime el destino: verifícalo.

Con la migración aplicada, las 29 salen en una sola corrida. El script ya las
tiene escritas y no hay que tocarlo.

01-03 · 01-05 · 02-01 · 02-02 · 02-03 · 02-04 · 02-05 · 02-06 · 03-01 ·
03-02 · 03-03 · 03-04 · 03-05 · 04-01 · 04-02 · 04-03 · 04-04 · 04-05 · 04-06 ·
04-07 · 04-08 · 04-09 · 05-01 · 05-05 · 05-07 · 05-08 · 06-01 · 06-05 · 07-01

> Entre ellas van **dos de las cinco** que el manual pide de forma explícita:
> 02-01 (lista de inventario) y 04-03 (buscador comercial con el mapa).

### Cuatro capturas descartadas a mano

En esa corrida, cuatro capturas **«pasaron» fotografiando la pantalla de error**:
01-05, 02-01, 06-01 y 07-01. En 01-05 el texto del error salía encima del
diálogo de desbloqueo. Se borraron: una imagen de un mensaje de error dentro de
un manual de usuario es peor que no tener imagen.

Pasaron por dos fallos del propio script, ya corregidos:

1. `getByRole('heading', { name: 'Inventario' })` encontraba el encabezado de
   grupo del **menú lateral**, no el de la página, y daba por cargada una vista
   que no había pintado. Ahora la espera va acotada a `main`.
2. No había ninguna comprobación de que los datos hubieran cargado. Ahora
   `verificarDatosCargados()` corta la captura con un mensaje explícito en
   cuanto aparece «No se pudieron cargar los datos».

---

## B · Bloqueadas por falta de datos (7)

El entorno local tiene **campañas 0, creativos 0, órdenes de trabajo 0 y
facturas 0**. Los capítulos 5 y 6 del manual describen operaciones sobre objetos
que no existen. Por decisión del humano **no se siembran datos**.

| Captura | Manual | Motivo |
|---|---|---|
| 05-02 | 5 · «Cargar los creativos», pasos 2-3 | El alta exige ligar la pieza a una campaña. No hay campañas. |
| 05-03 | 5 · «Validar y repartir los creativos» | Sin campañas ni creativos que repartir. |
| 05-06 | 5 · «Cerrar una orden de trabajo desde el campo» | Hay 0 órdenes de trabajo, así que no existe ninguna `/m/ot/[id]` que abrir. **Es una de las cinco capturas explícitas del manual.** Además pediría viewport de teléfono (el manual dice «Empiezas en: el teléfono»), no los 1440x900 del resto. |
| 05-09 | 5 · «Compartir el avance con el cliente» | El portal muestra el avance de una campaña. No hay campañas. |
| 06-02 | 6 · «Facturar una campaña» | No hay campaña facturable. El manual además exige orden de compra, fotos de comprobación y reporte de publicación, y las dos últimas nacen de cerrar una OT — de las que hay cero. **Es una de las cinco capturas explícitas del manual.** |
| 06-03 | 6 · «Registrar el pago del cliente» | Sin cobranza abierta no hay dónde registrar el abono. |
| 06-04 | 6 · «Recordarle al cliente que pague» | Sin cobranza vencida. |

---

## C · Bloqueadas por ser destructivas (2)

Se pueden ejecutar, pero rompen datos del entorno. **No se ejecutan.**

| Captura | Manual | Motivo |
|---|---|---|
| 03-06 | 3 · «Mandar el contrato a firma», paso 4 | Solicitar la firma **sella el documento de forma irreversible** — el propio manual lo advierte: «ya no puedes tocar ese documento»— y emite una liga de firma. Quemaría uno de los 3 contratos que hay. |
| 03-07 | 3 · «Cancelar o renovar un contrato», paso 3 | Cancelar **dispara una orden de retiro en campo** y deja el contrato cancelado. El manual avisa: «No lo uses para corregir un dato mal capturado». |

Para ilustrarlas haría falta un contrato de usar y tirar creado para eso. Es una
decisión del humano, no del script.

---

## D · Excluida de forma permanente por seguridad (1)

| Captura | Manual | Motivo |
|---|---|---|
| 05-04 | 5 · «Publicar la campaña en las pantallas» | **Publica contra pantallas reales.** |

`apps/web/.env.local:15` tiene `DOOHMAIN_PUBLISH_ENABLED=1`, y
`apps/web/lib/server/doohmain.ts:37` compara contra `'1'` exacto para decidir si
publica de verdad, con intérprete real y `DOOHMAIN_DEFAULT_SCREEN=adv_004`. El
manual lo dice con todas sus letras: «El envío sale a pantallas reales. Revisa
fechas y creativos antes de confirmar.»

Que el entorno sea local **no hace local el destino**. Esta captura no se toma
aunque algún día haya campañas. Si alguna vez se quiere ilustrar, que sea con la
bandera en `0`.

---

## Nota sobre los datos de las capturas

Las capturas se toman **sin difuminar**, por decisión explícita del humano
después de que se le expusiera el riesgo. Las imágenes y el PDF que salga de
ellas contienen correo, RFC y domicilios reales del entorno local.

Consecuencia práctica: `manuales/capturas/` está en `.gitignore` y **el PDF no
debe distribuirse**. La advertencia va también en la portada del propio PDF,
para que viaje con el documento y no solo en este archivo.
