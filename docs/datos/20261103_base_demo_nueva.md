# Base de demostración nueva, con un ejemplo en cada módulo — 2026-11-03

**Rama:** `feat/semilla-demo-completa` (sale de `main` 03026a15, que es lo que corre DEMO).
**Qué es:** cómo levantar una base de DEMOSTRACIÓN en la que cada módulo del menú y cada
ficha tenga algo que enseñar. Space Eye queda fuera a propósito: en la demo se enseña con lo
que ya tiene la instancia g500.

**Nada de esto es de nadie:** ni se copió de g500 ni de otra base real. Los correos terminan
en `.invalid`, los RFC empiezan por `DMO`, los teléfonos son ceros, las imágenes son PNG y los
documentos son PDF generados por el propio script. Ninguna integración externa responde: lo
que en la aplicación llena DOOHmain, Google o el correo no se siembra (ver «Lo que NO se
siembra»).

---

## 1 · Qué cambió en las semillas

| Archivo | Cambio |
|---|---|
| `scripts/semilla-catalogo-demo.mjs` | Creativos digitales y órdenes de imprenta con arte; el calendario se **mueve con `--ancla`** (en meses enteros); `--meses=N`; reutiliza el calendario con el que ya se sembró la base; `--deshacer` respeta la bitácora append-only |
| `scripts/semilla-catalogo-modulos.mjs` (nuevo) | Todo lo de cada módulo que el catálogo no cubría (tabla de la §4) |
| `scripts/semilla-arte-demo.mjs` (nuevo) | PNG con texto, sin dependencias, y la copia literal de `imagenAHtml` |
| `scripts/semilla-pdf-demo.mjs` (nuevo) | PDF 1.4 de una página, sin dependencias |
| `scripts/semilla-demo.mjs` (guion) | Siembra el **abono** de sus comprobantes pagados. No mueve ninguna cifra de rentabilidad: su prueba sigue en verde |

### Dos defectos que se encontraron sembrando, y ya están corregidos

1. **Desde el 01/11 el catálogo se negaba a sembrar** («CAT-CMP-020 COTIZACION ya empezada»):
   sus fechas estaban escritas para octubre de 2026. Ahora todo el calendario se corre los
   meses que haya entre el mes del ancla y octubre de 2026. La prueba recorre **cada día**
   entre 2026-10-01 y 2028-12-31 y la demo sale coherente en todos.
   Los contratos, las rentas y los recibos se reconocen por fecha. Por eso el script **lee de
   la base con qué calendario se sembró y lo reutiliza**. Si con ese calendario la demo ya no
   es coherente, se niega y pide `--deshacer`.
2. **Finanzas daba por VENCIDAS las facturas pagadas** (11,5 millones en la base recién
   sembrada). Desde el ADR 0046, lo cobrado se mide con `cobranza_abonos`, y ninguna de las
   dos semillas escribía abonos. Ahora cada comprobante pagado lleva el suyo.

---

## 2 · La secuencia exacta, tal como se corrió en local

Máquina de desarrollo, Postgres 16 en el 5433 con el superusuario `spaces`, y una base nueva
`spaces_demo_nueva`. Todo se corre desde la raíz del worktree.

```bash
# 0 · base vacía (con el driver pg de Node; aquí no hay psql)
#     create database spaces_demo_nueva
#     \i db/dev-rol-app.sql        -- rol de app SOLO de desarrollo
#     \i db/schema.sql
export DATABASE_URL=postgresql://spaces:spaces@localhost:5433/spaces_demo_nueva

# 1 · migraciones, en el orden de scripts/migrar.mjs
node scripts/migrar.mjs --instalacion-nueva          # 121 aplicadas, 1 de datos pendiente

# 2 · la organización y su Dueño (la única vía)
cd apps/web
ORG_SLUG=demo ORG_NOMBRE='Space OS Demo' \
ADMIN_EMAIL=duena@demo.invalid ADMIN_NOMBRE='Duena DEMO' \
  node scripts/bootstrap-auth.mjs                    # imprime UNA vez la contraseña temporal
cd ../..

# 3 · el guion de rentabilidad
node scripts/semilla-demo.mjs --org=demo             # 253 filas

# 4 · el catálogo (pide la contraseña de los 8 usuarios demo por variable)
SEMILLA_CLAVE='<10+ caracteres>' node scripts/semilla-catalogo-demo.mjs --org=demo   # 1224 filas
SEMILLA_CLAVE='<la misma>'       node scripts/semilla-catalogo-demo.mjs --org=demo   # 0 filas: idempotente
```

Para la auditoría en navegador: `cd apps/web && npm run build`, y después
`node ../../node_modules/next/dist/bin/next start -p 3440` con `.env.local` apuntando a la
base con `spaces_app`. Primero el build y después el servidor. `next dev` no sirve: la CSP
lo deja sin hidratar.

---

## 3 · En el servidor (lo corre UNA PERSONA)

> Nada de esto lo corre un agente. Los comandos son para el PADRE (`/var/www/Spaces`),
> con la rama ya en `main` y `git pull` hecho.

### Opción A — poner al día la base de DEMO que ya existe (`spaces_demo`, org `demo`)

Es lo normal. `sembrar-catalogo-demo.sh` hace el respaldo con `pg_dump` **antes** de tocar
nada, y luego siembra.

```bash
cd /var/www/Spaces && git pull
sudo bash infra/scripts/sembrar-catalogo-demo.sh spaces_demo --org=demo --con-guion
```

- Si DEMO ya tiene el catálogo **de octubre**, el script dice
  `el catalogo ya estaba sembrado con el calendario movido 0 meses` y se niega, porque la
  demo ya no sería coherente hoy. Hay dos salidas:
  - **Rápida:** sembrar con el calendario de octubre. Exporta `DATABASE_URL` y
    `SEMILLA_CLAVE` igual que lo hace el script y corre
    `node scripts/semilla-catalogo-demo.mjs --org=demo --ancla=2026-10-31`.
    Solo sirve mientras la campaña 016 siga al aire (hasta el 30/11).
  - **Limpia:** `sudo bash infra/scripts/sembrar-catalogo-demo.sh spaces_demo --org=demo --deshacer`
    y después la línea de arriba. Antes de borrar, el script pide escribir el nombre de la base.

### Opción B — una base NUEVA desde cero

Solo si se decide que DEMO estrene base. **Cambiar a qué base apunta DEMO es configuración
del proceso (R6) y lo decide una persona.**

```bash
cd /var/www/Spaces && git pull
# 0 · respaldo de la base actual, por si acaso
sudo -u postgres pg_dump --format=custom --file=/var/lib/space-os/respaldos-semilla/spaces_demo_$(date +%Y%m%d_%H%M%S).dump spaces_demo

# 1 · la base, del migrador (como en base-instancia.sh)
sudo -u postgres psql -c "create database spaces_demo_nueva owner spaces_migrador"
export DATABASE_URL='postgresql://spaces_migrador:<clave>@127.0.0.1:5432/spaces_demo_nueva'

# 2 · esquema y migraciones, como spaces_migrador
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
node scripts/migrar.mjs --instalacion-nueva

# 3 · organización y Dueño
(cd apps/web && ORG_SLUG=demo ORG_NOMBRE='Space OS Demo' \
   ADMIN_EMAIL=<correo del dueño> ADMIN_NOMBRE='<nombre>' node scripts/bootstrap-auth.mjs)

# 4 · guion y catálogo
node scripts/semilla-demo.mjs --org=demo
read -rs SEMILLA_CLAVE; export SEMILLA_CLAVE
node scripts/semilla-catalogo-demo.mjs --org=demo
node scripts/semilla-catalogo-demo.mjs --org=demo     # tiene que decir «filas nuevas: 0»
```

`sembrar-catalogo-demo.sh` solo acepta `spaces_demo` y `spaces_prod`, a propósito. Por eso,
para una base con otro nombre, los pasos van a mano.

### Vuelta atrás

- **Solo el catálogo:** `sudo bash infra/scripts/sembrar-catalogo-demo.sh spaces_demo --org=demo --deshacer`.
  Borra lo `CAT` en una sola transacción y sin `cascade`. Si la demo generó filas que cuelgan
  de las del catálogo, no borra nada.
  **Excepción, y no por elección:** la bitácora (`acciones`) es append-only por trigger. Sus
  12 entradas de ejemplo **se quedan**, y también se queda cualquier usuario demo que ya
  tenga acciones (el script lo avisa por nombre). Medido en local: tras `--deshacer`, los
  recuentos por tabla son idénticos a los de una base con solo el guion, salvo esas 12 filas.
- **Todo:** restaurar el `.dump` que imprime el script (necesita el rol `postgres`).
- **Base nueva (opción B):** basta con no apuntar DEMO a ella y `drop database spaces_demo_nueva`.

---

## 4 · Cobertura, módulo por módulo

**Antes** = la base nueva solo con el guion y el catálogo de `main`. **Después** = con esta
rama. Las cifras son de `spaces_demo_nueva`, organización `demo`, con hoy = 2026-11-03.

| Módulo (menú) | Antes | Después: el ejemplo que tiene |
|---|---|---|
| Dashboard | «Ganado en noviembre $0»; sin razón social | Una aprobación del mes (CAT-PRO-004, $2,09 M); razón social y nombre comercial de la organización |
| Inventario / Network / Comercial (mapa) | 30 pantallas | Además, orientación, vista, tramo, costo de compra, precio por m², tarifa de impresión, máximo de clientes e imagen promocional |
| Arrendadores y contratos | 15 contratos, rentas, sin documentos | Cuenta bancaria, nacionalidad y notas; razón social de 2 arrendadores; PDF del contrato en los 7 vivos; comprobante en las 62 rentas pagadas del último año; coordenadas de los 8 predios |
| Almacén | **vacío** | 8 artículos (los 8 tipos y los 4 estados) y 5 movimientos (entrada, salida, traslado, baja) |
| Clientes / Comisiones | Agencia sin negociación | La agencia CAT con su negociación validada y su nota |
| Comercial negociación | **vacío** | 8 espacios (predio y pantalla) en las 8 etapas, con contactos (dueño y abogada), competencia, ofertas y contraofertas, bitácora por canal y notas |
| Captación (fuera del menú, viva por API) | vacío | Un cliente en negociación y un arrendador contactado |
| Disponibilidad | ya tenía | sin cambio |
| Propuestas | 13, sin condiciones, sin vigencia | Condiciones, vigencia (`vigente_hasta`), vendedor congelado, fecha de aprobación o rechazo; CAT-PRO-007 con el código CAT-AGENCIA10 aprobado |
| Franjas y temporadas | **vacío** | 4 franjas, 3 temporadas (Buen Fin, decembrina, regreso a clases), una rejilla de 16 tarifas en dos LED y la 016 programada en «CAT Mañana» |
| Descuentos por volumen | **vacío** | 5 escalas (mensual 3/6/12 y spot 500/2000) |
| Códigos de negociación | **vacío** | 3 códigos (vigente con tope, sin tope y vencido) y un canje |
| Paquetes cerrados | **vacío** | 3 paquetes (uno inactivo) con sus pantallas |
| Campañas | 31 en los 7 estados | Marca y contrato (PDF) en las vivas; horario propio de DOOHmain en la 015; extensión de un mes con su contrato en la 015; órdenes de compra del cliente (9, con PDF) |
| Creativos | **vacío** | 21 digitales (16 aprobados, 4 por aprobar, 1 rechazado con motivo), horizontales y verticales, repartidos en 22 spots |
| Imprenta | **vacío** | 26 órdenes con prueba de color en los 5 estados (incluida una reposición de lona) |
| Operaciones (OT) | 191 OT, sin evidencias | 13 evidencias con foto y ubicación en los montajes; costo real, instrucciones, notas y supervisor en 3 de mantenimiento; 5 incidencias (vandalismo, legal, mantenimiento, clima, corte de luz) |
| Consumo de luz | ya tenía | sin cambio |
| Finanzas y cobranza | Vencido $11,5 M por facturas pagadas sin abono | Un abono por cada comprobante pagado (catálogo y guion), un anticipo del 30 % con comprobante PDF y un cobro en el mes |
| Reportes | ya tenía | además, costo real de OT y evidencias |
| Razones sociales | 3 del guion | sin cambio |
| Actividad | **vacía** | 12 acciones de los distintos roles |
| Administración | sin logotipo ni condiciones | Logotipo, remitente, condiciones de propuesta e identidad fiscal de la organización; 2 tickets de soporte (uno resuelto) |
| Notificaciones | **vacías** | 6, de cobranza, propuesta, contrato, creativo, OT y campaña; 3 ya leídas por un usuario |
| Space Eye | — | **No se siembra** (decisión del encargo) |

### Lo que NO se siembra, y por qué

| Tabla / campo | Por qué |
|---|---|
| `sesiones`, `password_resets`, `codigos_recuperacion`, `identidades_externas` | Las llena el uso: iniciar sesión, recuperar la contraseña, 2FA, Google |
| `folios_consecutivos` | Es el contador de la app. Sembrarlo a mano podría repetir folios |
| `media_uploads`, `licencias` | Almacenamiento externo y licencia de la instancia |
| `doohmain_*`, `sitios.doohmain_pantalla`, `campanas.enviada_dominio_en` | Los llena DOOHmain. Un id inventado haría que una instancia con la publicación encendida llamara a DOOHmain con una pantalla que no existe |
| `contrato_firmas`, `contrato_versiones_firmadas`, `contrato_cambios` | Salen del flujo de firma, con el documento congelado y su hash. Inventarlos daría un expediente que no se puede verificar. Se enseña en vivo |
| `paquete_aplicaciones` | Aplicar un paquete cambia los precios de la propuesta: se enseña en vivo |
| Creativos en las campañas `DEMO-` del guion | Son del guion y no se mezclan prefijos. Son los 6 «spots sin creativo» de la pantalla |

---

## 5 · Usuarios demo

Ninguna contraseña está escrita aquí ni en el repositorio: la de los 8 entra por `SEMILLA_CLAVE`
al sembrar, y la de la Dueña la imprime una sola vez `bootstrap-auth.mjs`.

| Rol | Correo | Qué enseña |
|---|---|---|
| Dueño (bootstrap) | el que se pase en `ADMIN_EMAIL` (en local, `duena@demo.invalid`) | Tiene que cambiar la contraseña al entrar |
| Dueño | `dueno@catalogo.invalid` | Todo |
| Administrador | `administrador@catalogo.invalid` | Administración, extensiones |
| Director comercial | `director.comercial@catalogo.invalid` | Aprobaciones, creativos |
| Gerente de ventas | `gerente.ventas@catalogo.invalid` | Códigos, paquetes, franjas, volumen |
| Vendedor | `vendedor@catalogo.invalid` | Propuestas, negociación |
| Operaciones | `operaciones@catalogo.invalid` | OT, almacén, luz |
| Imprenta | `imprenta@catalogo.invalid` | Imprenta |
| Finanzas | `finanzas@catalogo.invalid` | Finanzas y cobranza |

---

## 6 · Pruebas

- `scripts/semilla-catalogo-demo.test.ts`: 29 pruebas. Las nuevas cubren creativos e
  imprenta en todos sus estados; ningún creativo en una campaña OOH; las campañas al aire con
  todos sus spots asignados; el PNG y el PDF válidos; la envoltura idéntica a la de la app;
  el calendario coherente cada día hasta 2028; cada módulo con ejemplo; y que `--deshacer`
  cubra cada tabla (salvo la bitácora) y no ate la bitácora a los usuarios demo.
- `npm run typecheck` limpio; `npx vitest run --testTimeout=60000`: 317 archivos y 4197
  pruebas en verde.
- En base real: dos corridas seguidas (la segunda mete 0 filas); `--deshacer` contra una base
  de referencia con solo el guion (mismos recuentos, salvo 12 acciones); y un recorrido en
  navegador de las 25 entradas del menú y de las fichas de campaña, propuesta y OT.
