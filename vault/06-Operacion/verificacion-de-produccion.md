---
tipo: operacion
estado: sin-ejecutar
actualizado: 2026-08-26
tags: [operacion, produccion, verificacion, runbook]
archivos:
  - db/schema.sql
  - db/migrations/
  - apps/web/lib/test/db-e2e.ts
  - apps/web/package.json
  - DESPLIEGUE_20260810_MIGRACIONES.txt
---

> [!danger] 2026-08-26 · CORRECCIÓN DOBLE — esta nota tenía DOS cosas falsas
> **① El acceso al droplet `209.97.146.136` NUNCA se perdió.** El aviso de abajo
> se escribió el 24/08 sobre esa premisa, y la premisa era falsa: el 25/08 se
> entró sin dificultad y se completó el censo entero
> (`docs/evidencias/f4-1-censo-resultado.md`). Sobre aquella conclusión se
> levantaron el ADR 0015, la 3.ª enmienda a P1 y **dos tareas declaradas
> imposibles**. Las cuatro se revisaron.
>
> **② DEMO ya NO va a servir `demo.space-os.io`.** El
> [ADR 0020](../../docs/adr/0020-no-hay-demo-publica.md) (26/08) retira ese
> nombre: no se le mueve el DNS, no se le emite certificado y ~~su registro A se
> borra~~ — tarjeta **TH-F4.5**. ⚠️ **REVERTIDO el 2026-08-26 por el
> [ADR 0021](../../docs/adr/0021-demo-space-os-io-se-queda.md): `demo.space-os.io`
> SE CONSERVA como demostración de las instancias hijas, y la tarjeta TH-F4.5
> queda cancelada.** El proceso del `3001` **conserva su nombre**: el nginx del
> PADRE lo sirve en `infra/nginx/space-os.io.conf:188`.
>
> Esa frase tachada estuvo escrita **con la fecha del 26/08 encima** y en tres
> notas a la vez. Si un agente la lee sin llegar al «REVERTIDO», propone borrar
> un registro DNS que hay que conservar. **Este punto cambió cuatro veces en
> cuatro días: pregúntalo, no lo infieras.**
>
> **Lo vigente:** el PADRE (`137.184.107.53`) es la **única máquina del modelo**
> y sirve `space-os.io` con certificado propio hasta el **2026-11-23**, con
> renovación automática —
> [ADR 0017](../../docs/adr/0017-todo-se-concentra-en-el-padre.md). Y la
> demostración de cara a cliente pasa a ser **el producto real con una o más
> instancias hijas**, que es lo que produce la Fase 5.
>
> **No se reescribe el cuerpo de abajo**: era correcto en su fecha. Reescribir
> historia para que cuadre con hoy es lo que hace que una nota deje de ser fiable.

> [!danger] 2026-08-24 · El droplet `209.97.146.136` SE PERDIO — esta nota lo daba por vivo
> **Se perdió el acceso a esa máquina.** Sigue encendida y sirviendo
> `demo.space-os.io`, pero **nadie la controla**: no se actualiza, no se parchea
> y no se apaga. Su certificado vence el **2026-10-26** y no se renovará.
>
> **La máquina viva es el PADRE, `137.184.107.53`** — Ubuntu 24.04, Postgres
> 16.15, `pm2 spaces-web` en el 3000 **como `root`**, rol de app **`spaces_app`**.
> Ahí van a convivir **el PADRE en `space-os.io`** y **DEMO en
> `demo.space-os.io`** (segundo proceso, puerto 3001, base `spaces_demo`) —
> decisión del día, con su precio escrito en
> [ADR 0015](../../docs/adr/0015-demo-dentro-del-padre.md).
>
> **Medido ese día:** el ápice `space-os.io` **no tiene registro A** (está libre),
> `demo.space-os.io` sigue apuntando a la máquina perdida, y el PADRE responde
> por IP `login 200 · raíz 302`.
>
> Todo lo que sigue en esta nota **describe el arreglo anterior**. Vale como
> historia; no como instrucción. Ver [[2026-08-24]] y `docs/Traspaso_20260824.md`.

---
# Runbook — comprobar el estado real de producción

> [!info] Para qué existe
> El [[inventario-2026-08-11]] cierra con cuatro cosas que **no se pudieron
> verificar** por ser un encargo de solo lectura y sin sondeos (puntos 17–20).
> Este runbook es exactamente lo que hace falta correr para cerrarlas. Cada
> bloque dice qué pregunta responde y qué respuesta esperamos, para que la
> salida se pueda contrastar y no solo leer.

> [!warning] Todo es de LECTURA
> Ninguna orden de aquí escribe en `spaces_prod`. La única que crea un fichero
> es el volcado de esquema (17c), y lo deja en el `~` del droplet.
> El único punto con riesgo real de borrado es el 20 — ver su aviso.

**Estado:** `sin-ejecutar`. Cuando se corra, se pega la salida y se pasa a
`verificado` con la fecha. Mientras diga `sin-ejecutar`, lo que sabemos de
producción sigue viniendo de las notas `DESPLIEGUE_*.txt` y del diario, no de
la máquina.

| Punto | Pregunta abierta | Bloque |
|---|---|---|
| 17 | ¿Qué hay de verdad en `spaces_prod`: filas, tenants, migraciones? | A · 17a–17c |
| 18 | ¿Qué dice el entorno de producción del droplet? | A · 18 |
| 19 | ¿Sigue corriendo `3164aaa`? | A · 19 |
| 20 | ¿Pasan hoy las pruebas? | B — ✅ **cerrado el 11/08: 789 + 136, en verde** |

---

# Bloque A — en el droplet

```bash
ssh <usuario>@<host-del-droplet>
```

> [!warning] Confirma el host antes de conectarte
> La única IP que registra la bóveda (`209.97.146.136`) está marcada como
> **vieja** en [[entorno-y-despliegue]] — hoy responde con un 301 al dominio. No
> la uses a ciegas: saca el host de tu configuración de SSH o del `DESPLIEGUE_*`
> más reciente, y si resulta que sigue siendo esa, **actualiza la bóveda**, que
> es lo que está desfasado.

App: `pm2 spaces-web` → `https://demo.space-os.io` · Código: `/var/www/Spaces`
· BD: `spaces_prod`.

## 17a · Qué tenants existen hoy

```bash
sudo -u postgres psql -d spaces_prod -c "
  select slug, nombre, moneda, creado_en, id from tenants order by creado_en"
```

**Esperado:** cinco organizaciones. `rgb` es la más antigua: la sembraba
`db/schema.sql` cuando el esquema todavía la traía, **hasta el 2026-08-19**. Desde
`9d609f0` el esquema **nace sin ninguna organización** (`db/schema.sql:598-611`),
pero eso solo cambia cómo nacen las bases nuevas: **producción conserva su `rgb`**
y esta comprobación no cambia. `eyro` está reclasificado como tenant de pruebas.

## 17b · Cuántas filas hay, y de quién

> [!danger] Como `postgres`, NUNCA con `spaces_user`
> `spaces_user` es `NOBYPASSRLS`. Con la RLS fail-closed y sin `app.tenant_id`
> fijado, los conteos salen en **cero con buena pinta** — la misma trampa que
> documenta el PASO 1 de
> [`DESPLIEGUE_20260810_MIGRACIONES.txt`](../../DESPLIEGUE_20260810_MIGRACIONES.txt) para los dumps.

```bash
# Total por tabla
sudo -u postgres psql -d spaces_prod -c "
  select c.relname as tabla,
         (xpath('/row/c/text()', query_to_xml(
            format('select count(*) as c from public.%I', c.relname),
            false, true, '')))[1]::text::int as filas
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname='public' and c.relkind='r'
   order by 2 desc"
```

**Esperado:** 38 tablas. `notificaciones` debería rondar las 182 filas y
`arrendadores` las 8, que son las cifras que dejó verificadas el despliegue del
10/08.

```bash
# Reparto por tenant en las tablas que importan
sudo -u postgres psql -d spaces_prod -c "
  select 'sitios' t, coalesce(x.slug,'(nulo)') tenant, n from (
    select t.slug, count(*) n from sitios s left join tenants t on t.id=s.tenant_id group by 1) x
  union all select 'sitio_modalidades', coalesce(t.slug,'(nulo)'), count(*)
    from sitio_modalidades s left join tenants t on t.id=s.tenant_id group by 2
  union all select 'usuarios', coalesce(t.slug,'(nulo)'), count(*)
    from usuarios s left join tenants t on t.id=s.tenant_id group by 2
  union all select 'clientes', coalesce(t.slug,'(nulo)'), count(*)
    from clientes s left join tenants t on t.id=s.tenant_id group by 2
  union all select 'campanas', coalesce(t.slug,'(nulo)'), count(*)
    from campanas s left join tenants t on t.id=s.tenant_id group by 2
  union all select 'arrendadores', coalesce(t.slug,'(nulo)'), count(*)
    from arrendadores s left join tenants t on t.id=s.tenant_id group by 2
  order by 1,2"
```

**Qué se está buscando:** el reparto de `sitio_modalidades` es el que dice si
siguen ahí las **15 modalidades de `g500`/`eyro` etiquetadas como `rgb`** por el
`DEFAULT` heredado. Ver [[zonas-de-riesgo]] y el punto 12 del inventario.

## 17c · Qué migraciones están aplicadas

En producción todavía no hay tabla de control: los **68** ficheros de
`db/migrations/` se aplican a mano. (`schema_migrations` está escrita —F3.1— pero
**sin aplicar en el droplet**; ver [[migraciones]].) La única respuesta honesta
sigue siendo **estructural** — se comprueba que estén los objetos, no que esté
anotado.

```bash
# Rápido — los objetos de las 2 últimas migraciones (las del 10/08)
sudo -u postgres psql -d spaces_prod -c "
  select 'columna archivada_en' q, count(*) from information_schema.columns
   where table_name='notificaciones' and column_name='archivada_en'
  union all
  select 'indices 10/08', count(*) from pg_indexes
   where indexname in ('idx_notif_vivas','arrendadores_tenant_rfc_uq')"
```

**Esperado:** `1` y `2`. Si no, el despliegue del 10/08 no es lo que dice su
nota.

```bash
# Los DEFAULT de tenant_id a rgb — el punto 12 del inventario: ¿son 21 de verdad?
sudo -u postgres psql -d spaces_prod -c "
  select c.relname as tabla, pg_get_expr(d.adbin, d.adrelid) as default_tenant
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
   where n.nspname='public' and a.attname='tenant_id'
   order by 1"
```

**Esperado:** **23 o más** tablas, todas con el mismo UUID (el de `rgb` **de esa
base** — el uuid se genera distinto en cada instalación, así que no lo compares
contra el local). Verificado el 2026-08-13 contra la copia local de entonces:
**23**, ni una más ni una menos.

> [!warning] Desde el 19/08 la copia local ya NO sirve de contraste
> `db/schema.sql` **dejó de crear el `DEFAULT`** (`9d609f0`), así que una base
> levantada hoy desde el repo devuelve **cero filas** en esta consulta. Las 23
> tablas siguen enumeradas en `db/schema.sql:617-621` y el bucle que las recorre
> en `:631-640`, pero ese bucle ya no pone ningún default.
>
> **Eso NO invalida la comprobación contra producción**, que es lo que este
> runbook mide: el droplet nació antes y sí los tiene. Lo que cambia es de dónde
> sacas el contraste — de una base levantada antes de esa fecha, o poniendo el
> default a mano como hace `apps/web/lib/test/tenant-sin-default.e2e.test.ts:89`.

> [!warning] Más de 23 no es un desfase: es el hallazgo
> Producción tiene tablas y columnas que `schema.sql` no trae —lo documenta
> `apps/web/lib/test/db-e2e.ts:107-112`—, así que el catálogo real puede devolver
> más. **Si salen más de 23, anótalas: eso es justo lo que F1.1 busca.** La
> migración `20260812_sin_default_tenant.sql` está diseñada para ese caso, porque
> recorre el catálogo y no una lista copiada a mano.
>
> Y ojo con la cifra vieja: hasta el 13/08 varias notas decían **21**. Era de un
> conteo del 03/08 y quedó desfasada; el dato bueno es 23.

```bash
# Definitivo — huella completa del esquema, para diferenciar contra el repo
sudo -u postgres pg_dump --schema-only --no-owner --no-privileges spaces_prod \
  > ~/esquema_prod_$(date +%Y%m%d).sql
wc -l ~/esquema_prod_*.sql
```

Y desde la máquina local, para poder compararlo contra `db/schema.sql` + las
migraciones de `db/migrations/` (**67** en el repo al 13/08; producción tiene
aplicadas **66** hasta que F1.5 aplique `20260812_sin_default_tenant.sql`, así que
esa diferencia es esperada, no un desfase):

```powershell
scp <usuario>@<host-del-droplet>:~/esquema_prod_*.sql .
```

## 18 · Qué hay en el entorno de producción

El fichero y el proceso pueden **no coincidir**: `pm2` arrastra el entorno del
último `reload --update-env`. Se miran los dos. Los secretos salen como longitud,
nunca como valor.

```bash
ls -la /var/www/Spaces/apps/web/.env* /var/www/Spaces/.env* 2>/dev/null
```

```bash
# El FICHERO
sudo awk -F= '/^[A-Z]/ {k=$1; v=substr($0,length(k)+2);
  if (k ~ /KEY|SECRET|PASS|TOKEN|DATABASE_URL/) printf "%-32s = [%d caracteres]\n", k, length(v);
  else printf "%-32s = %s\n", k, v}' /var/www/Spaces/apps/web/.env.production | sort
```

```bash
# El PROCESO que de verdad corre
sudo tr '\0' '\n' < /proc/$(pm2 pid spaces-web)/environ | awk -F= '/^[A-Z]/ {k=$1; v=substr($0,length(k)+2);
  if (k ~ /KEY|SECRET|PASS|TOKEN|DATABASE_URL/) printf "%-32s = [%d caracteres]\n", k, length(v);
  else printf "%-32s = %s\n", k, v}' | sort
```

**Qué se contrasta con la bóveda** (que dice haberlo comprobado el 07/08 y el
10/08): `RESEND_API_KEY` apagado, `DOOHMAIN_PUBLISH_ENABLED=1`, `GOOGLE_OAUTH`
configurado, `COOKIE_SECURE`, `APP_URL`, `MEDIR_ESTADO` y los `NEXT_PUBLIC_*`.

> [!warning] No pegar la salida sin enmascarar
> El `awk` ya lo hace, pero si se corre un `cat` a mano, el fichero lleva
> `DATABASE_URL`, la clave de Resend, las de DO Spaces y el secreto de Google.

## 19 · Si `3164aaa` sigue siendo lo que corre

Tres evidencias distintas, porque el `git log` por sí solo no prueba nada: el
commit puede estar bien y el artefacto servido ser viejo (lo dice el PASO 6 de
[`DESPLIEGUE_20260810_MIGRACIONES.txt`](../../DESPLIEGUE_20260810_MIGRACIONES.txt)).

```bash
cd /var/www/Spaces
git log --oneline -1                # esperado: 3164aaa
git status --porcelain | head       # ¿algo tocado a mano?

pm2 describe spaces-web | grep -iE "status|uptime|restarts|script path|exec cwd"
stat -c '%y  %n' /var/www/Spaces/apps/web/.next/BUILD_ID
cat /var/www/Spaces/apps/web/.next/BUILD_ID
```

**Esperado:** el artefacto compilado **después** de `2026-08-11 09:13:53 -0600`,
que es la fecha de `3164aaa`. Si es anterior, se sirve un build viejo.

La prueba de contenido: `3164aaa` metió los encabezados de grupo del menú, y el
commit siguiente (`349f03f`, **no desplegado**) renombró «Lo que tienes» a
«Inventario».

```bash
grep -rl "Lo que tienes" /var/www/Spaces/apps/web/.next/ | head -3
grep -rl "'patrimonio', titulo: 'Inventario'" /var/www/Spaces/apps/web/.next/ | head -3
```

**Esperado:** el primero **aparece**, el segundo **no**. Eso acota el artefacto a
`3164aaa` exacto: ni más viejo ni más nuevo.

---

# Bloque B — en la máquina local (punto 20)

> [!danger] Antes de nada: el arnés hace `drop schema public cascade`
> La base del demo local se llama **`spaces`** a secas y ahí se suben pantallas,
> campañas y creativos **reales, con sus imágenes**. El arnés
> (`apps/web/lib/test/db-e2e.ts`) usa una base dedicada `spaces_e2e` y rechaza
> cualquier nombre que no acabe en `_e2e`/`_test`, pero la comprobación de abajo
> no se salta: basta un `DATABASE_URL_TEST` heredado de otra sesión.

```powershell
echo "TEST=$env:DATABASE_URL_TEST"; echo "TEST_APP=$env:DATABASE_URL_TEST_APP"
docker ps --filter name=spaces_db --format "{{.Names}} {{.Status}}"
docker exec spaces_db psql -U spaces -d postgres -c "\l" | Select-String spaces_e2e
```

**Esperado:** las dos variables **vacías** (se usan los valores por defecto, que
apuntan a `spaces_e2e` en `localhost:5433`) y el contenedor arriba. Si alguna
trae valor y no acaba en `_e2e`/`_test`, se limpia antes de seguir.

Si `spaces_e2e` no aparece, se crea una sola vez:

```powershell
docker exec spaces_db psql -U spaces -d postgres -c "create database spaces_e2e"
```

Y ya:

```powershell
cd apps\web
npm test                              # unitarias — el diario dice 789

cd ..\..
npx turbo run build --filter=web      # OBLIGATORIO antes de las e2e
cd apps\web
npm run test:e2e                      # integración — el diario dice 136
```

**Esperado:** ambas en verde con esos números. Una cuenta distinta no es un fallo
por sí sola, pero sí un dato: significa que el diario y el árbol de pruebas se
separaron.

> [!danger] El build no es opcional y su ausencia no se explica sola
> Las e2e levantan el servidor con `next start`, que **reutiliza el build**. Sin
> un build de producción en `apps/web/.next/` fallan los 12 ficheros con «El
> servidor de pruebas no respondió tras 60 s» — el error real
> (*«Could not find a production build»*) se pierde porque el arnés lanza el
> proceso con `stdio: 'ignore'`. Son 10 minutos de espera sin ninguna pista.
> Compruébalo con `ls apps/web/.next/BUILD_ID`.

> [!success] EJECUTADO — 11/08/2026, todo en verde
> **Unitarias:** 71 ficheros, **789 pruebas**, 15 s.
> **Integración:** 12 ficheros, **136 pruebas** + 1 omitida, 56 s.
> Las dos cifras coinciden exactamente con el diario. La primera corrida de las
> e2e falló entera por el build ausente (de ahí el aviso de arriba); con el build
> hecho, pasaron a la primera. **Este bloque queda cerrado.**

---

## Después de correrlo

1. Pegar la salida en el registro y contrastarla con los puntos 17–20 de
   [[inventario-2026-08-11]].
2. Lo que se confirme, pasa de suposición a hecho; lo que se desmienta, entra en
   [[preguntas-abiertas]] con la evidencia.
3. Cambiar el `estado:` de esta nota a `verificado` con la fecha de la corrida.
4. Anotar en `docs/Registro_Cambios.md`.

## Relacionadas
[[inventario-2026-08-11]] · [[MOC-Proyecto]] · [[zonas-de-riesgo]] ·
[[convenciones]] · [[migraciones]] · [[multi-tenancy-y-rls]] · [[esquema]] ·
[[preguntas-abiertas]] · [[tablero]]
