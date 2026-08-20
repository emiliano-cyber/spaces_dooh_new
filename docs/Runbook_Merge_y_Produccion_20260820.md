# Runbook · merge a `main` y primer despliegue a producción

**Fecha:** 2026-08-20 · **Rama:** `feat/servidor-padre-instancias` → `main`
**Lo escribe un agente; lo corre una persona.** Ningún comando de este documento
se ha ejecutado contra un servidor.

> [!danger] Léete el §2 antes de disparar nada
> Tal como está hoy, **un despliegue a producción aborta a mitad** y deja la base
> con el esquema nuevo y la aplicación sirviendo el código viejo. Está medido, se
> sabe exactamente por qué, y se arregla con **un comando previo**. Pero si se
> dispara sin ese comando, hay que entrar a mano a reparar.

---

## 1 · La compuerta de `main`, medida hoy

`main` está protegida por `ci.yml`, que corre **typecheck + test + build** con
turbo (`ci.yml:71-78`). **No corre e2e**, así que no necesita Postgres.

| Comprobación | Cómo se midió | Resultado |
|---|---|---|
| `npx turbo run typecheck --filter=web` | lo mismo que CI | ✅ limpio |
| `npx turbo run test --filter=web` | lo mismo que CI | ✅ **826 en 75 archivos** |
| `npx turbo run build --filter=web` | lo mismo que CI | ✅ 52 s |
| `npm ci --dry-run` | lo que exige `lockfile-check.yml:20` | ✅ en sync |
| `npm run test:e2e` | exigido por `AGENTES.md` (toca auth, tenant y migraciones) | ✅ **19 archivos · 205 + 1 saltada** |
| Zonas del tablero | las 12 y los archivos de alto contacto | ✅ todas `LIBRE` |
| Secretos en el diff | barrido sobre `main...HEAD` | ✅ ninguno |
| Forma del merge | `git merge-base --is-ancestor main HEAD` | ✅ **fast-forward, 0 conflictos** |

**El merge aterriza 146 commits · 110 archivos · 26 443 líneas**, de los cuales
**7 son archivos de migración** (2 editados por T-04, 5 nuevos).

> [!warning] Lo único que falta para el merge no es técnico
> **Diecisiete commits ROJO esperan visto bueno humano.** La lista vive en
> `vault/07-Agentes/ejecucion-plan-v3.md`, sección «Commits que esperan visto
> bueno humano». Sin eso, el merge se salta la regla 5 de `AGENTES.md`.

> [!note] Lo que NO va en este merge, y es deliberado
> **F3.6 — retirar `deploy.yml`.** El plan lo marca `NO se mergea a main` hasta
> que el canal de releases esté probado en real. `deploy.yml` sigue siendo **el
> único camino de despliegue que existe**: retirarlo ahora deja al proyecto sin
> forma de desplegar.

---

## 2 · El problema que hay que resolver ANTES de desplegar

### Qué hace `deploy.yml` con las migraciones

`deploy.yml:141-148` recorre **todas** las migraciones de esquema en orden
lexicográfico y las aplica como `postgres` con `ON_ERROR_STOP=1`. No lleva
registro: reaplica el juego entero en cada despliegue.

Tras el merge, ese bucle encontrará **siete archivos que el droplet no ha visto**:

| # | Archivo | Qué le hace al droplet |
|---|---|---|
| 1 | `20260720_hard1_usuarios_rls.sql` | Reaplicado. T-04 lo hizo idempotente |
| 2 | `20260729_datos_contrato_documento.sql` | Reaplicado. Igual |
| 3 | `20260812_schema_migrations.sql` | **Crea el registro** y hace backfill de 65 |
| 4 | `20260812_sin_default_tenant.sql` | **Retira el `DEFAULT` de `tenant_id` de 23 tablas** |
| 5 | `20260819_semilla_rol_permisos.sql` | Siembra 25 permisos |
| 6 | `20260820_catalogo_permisos_completo.sql` | Lleva el catálogo a **41** |
| 7 | `20260820_grants_rol_app.sql` | **🔴 ABORTA** |

### Por qué aborta la séptima

`20260820_grants_rol_app.sql` exige que exista el rol **`spaces_app`**, y **el
droplet corre con `spaces_user`** (`20260715_arr_m6_rol_restringido.sql:3-5` lo
dice literal: «prod: `spaces_user`, ya existente»).

El guard es deliberado —cerró ROJO-3, donde trece migraciones no concedían nada
en silencio— y con `ON_ERROR_STOP=1` **corta el despliegue en el paso 3 de 5**.
El `pm2 reload` está en el paso 5 (`deploy.yml:171`), así que **no llega a
correr**: la base queda con las seis primeras aplicadas y **la aplicación sigue
sirviendo el código viejo sobre un esquema nuevo**. Es exactamente el modo de
fallo que D1 describe para `update.sh`.

### Y dos migraciones que dejarían de ser una decisión

Los pasos **3** y **4** de esa tabla son **TH-F3.1** y **F1.5**: dos tarjetas
humanas que existen para aplicarse **a conciencia**, con su ritual. El bucle de
`deploy.yml` las aplicaría **sin preguntar**, como una más.

Hoy eso importa menos de lo que parece —P1 decidió que los datos del droplet se
recrean desde cero— pero **tiene que ser una decisión, no una sorpresa**.

---

## 3 · Los pasos, en orden

### Paso 0 · El visto bueno de los diecisiete ROJO

No es un comando. Sin él, no se sigue.

### Paso 1 · Crear `spaces_app` en el droplet

**Esto es lo que evita que el despliegue aborte.** Se crea el rol **sin cambiar
todavía a qué usuario se conecta la aplicación**: son dos cosas distintas y
separarlas es lo que hace este paso seguro.

```bash
ssh root@<IP-del-droplet>
```

Comprobar primero qué hay, sin cambiar nada:

```bash
sudo -u postgres psql -Atc \
  "select rolname, rolsuper, rolbypassrls, rolcanlogin
     from pg_roles where rolname in ('spaces_app','spaces_user') order by 1"
```

**Respuesta esperada:** una sola fila, `spaces_user|f|f|t`. Si ya aparece
`spaces_app`, este paso está hecho: salta al 2.

Crear el rol, con una contraseña **propia de esta instancia** (genérala, no la
copies de ningún archivo del repositorio):

```bash
CLAVE=$(openssl rand -base64 24)
sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
  "create role spaces_app login password '$CLAVE' nosuperuser nobypassrls;"
echo "GUARDA ESTA CLAVE EN EL GESTOR DE SECRETOS: $CLAVE"
```

**Respuesta esperada:** `CREATE ROLE`, y la clave impresa una vez.

Comprobar:

```bash
sudo -u postgres psql -Atc \
  "select rolname, rolsuper, rolbypassrls from pg_roles where rolname='spaces_app'"
```

**Esperado:** `spaces_app|f|f`. Si sale `t` en cualquiera de los dos, **para**:
un rol de aplicación que se salta la RLS anula el aislamiento interno.

> **Si sale otra cosa:** si el `create role` falla por que ya existe, comprueba
> sus atributos con la consulta de arriba y sigue. Si falla por permisos, no
> estás como `postgres`.

### Paso 2 · Decidir sobre las dos migraciones que van de regalo

Los pasos 3 y 4 de la tabla del §2 se aplicarán solos. **Confírmalo por escrito
antes de disparar**, o cambia el plan:

- **`20260812_schema_migrations.sql`** — nace el registro con backfill de 65.
  Es inocuo y además necesario para todo lo que viene. **Recomendado: dejarlo.**
- **`20260812_sin_default_tenant.sql`** — retira el `DEFAULT` de `tenant_id` de
  23 tablas. Tras esto, **un `insert` que no fije `tenant_id` truena con 23502**
  en vez de nacer etiquetado como `rgb`. Es lo que queremos, y es la tarjeta
  **TH-F1.5**. **Recomendado: dejarlo**, y anotar que TH-F1.5 se cumplió por
  esta vía.

### Paso 3 · Respaldo antes de tocar nada

`deploy.yml` **no hace respaldo de base**. Hazlo tú:

```bash
sudo -u postgres pg_dump -Fc -d spaces_prod \
  -f /root/spaces_prod_$(date +%Y%m%d_%H%M%S).dump
ls -lh /root/spaces_prod_*.dump | tail -1
```

**Esperado:** un archivo de tamaño claramente mayor que 0. Si sale 0 bytes o el
comando falla, **para aquí**.

### Paso 4 · El merge

Desde tu máquina, con la rama ya aprobada:

```bash
cd C:\Users\Server\spaces_doohmain_nueva
git fetch emiliano
git checkout main
git merge --ff-only feat/servidor-padre-instancias
git push emiliano main
```

**Esperado:** `Fast-forward`, sin conflictos. Si `--ff-only` falla, alguien
movió `main`: **para y avisa**, no fuerces.

Después, mirar que CI se ponga en verde en GitHub antes de seguir.

### Paso 5 · El despliegue

Se dispara **a mano** desde GitHub (`deploy.yml` es `workflow_dispatch`):

- **Actions → Deploy → Run workflow**
- `ref`: `main`
- `migraciones_de_datos`: **dejar SIN marcar**

> `20260731_calendario_meses_cortos.sql` es `@tipo: datos` y **no debe aplicarse
> aquí**. Es la decisión P7: las de datos las aplica una persona, aparte.

**Qué mirar en el log del run, en este orden:**

1. Grupo «3 · Migraciones de esquema» — deben salir los **siete** archivos de la
   tabla del §2, y **`20260820_grants_rol_app.sql` debe terminar sin error**. Si
   dice `No existe el rol de aplicacion "spaces_app"`, el Paso 1 no se hizo.
2. Grupo «4 · Migraciones de datos» — debe decir `Omitidas` y listar
   `20260731_calendario_meses_cortos.sql` como pendiente.
3. `pm2 describe spaces-web` — `status: online` y `restarts` sin dispararse.
4. El smoke de rutas, con códigos 200.

### Paso 6 · Verificación, con la base delante

```bash
sudo -u postgres psql -d spaces_prod -Atc \
  "select count(*)||' permisos / '||count(distinct modulo)||' modulos / '||count(distinct rol)||' roles' from rol_permisos"
```
**Esperado:** `41 permisos / 9 modulos / 5 roles`.

```bash
sudo -u postgres psql -d spaces_prod -Atc \
  "select count(*) from schema_migrations"
```
**Esperado:** `65` (el backfill; `deploy.yml` no registra las que aplica).

```bash
sudo -u postgres psql -d spaces_prod -Atc \
  "select count(*) from information_schema.columns
    where table_schema='public' and column_name='tenant_id' and column_default is not null"
```
**Esperado:** `0`. Si sale distinto de 0, `sin_default_tenant` no corrió.

```bash
sudo -u postgres psql -d spaces_prod -Atc \
  "select has_table_privilege('spaces_app','tenants','select')"
```
**Esperado:** `t`.

Y desde fuera:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://demo.space-os.io/spaces-dooh/login/
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://demo.space-os.io/spaces-dooh/api/signup/
```
**Esperado:** `200` en la primera. En la segunda, **`503`** si el registro está
cerrado —que es lo decidido— o **`400`** si está abierto. **Ese número es la
respuesta a F0.1**, que lleva desde el 13/08 sin medirse: anótalo.

### Paso 7 · Vuelta atrás, si algo sale mal

```bash
# 1 · el código
cd /var/www/Spaces
su - <usuario-app> -c "cd /var/www/Spaces && git checkout --detach <commit-anterior> && npm --prefix apps/web run build && pm2 reload spaces-web"

# 2 · la base, solo si hace falta
sudo -u postgres dropdb spaces_prod
sudo -u postgres createdb spaces_prod
sudo -u postgres pg_restore -d spaces_prod /root/spaces_prod_<sello>.dump
```

> **Ojo:** restaurar sobre una base con el esquema nuevo **no lo deshace** —es
> exactamente D1—. Por eso la vuelta atrás de base va sobre una base **recreada**,
> no sobre la existente. El commit anterior lo tienes en el log del run.

---

## 4 · Lo que este runbook NO hace, y por qué

- **No prueba `update.sh`.** El droplet corre la app con **pm2**, no en un
  contenedor: `update.sh` conmuta con `docker stop` + `docker run`
  (`update.sh:62`). Toda la Fase 3 sirve a las **instancias nuevas**, que nacen
  en la Fase 5. Probar el actualizador exige **un droplet nuevo**.
- **No publica ninguna imagen.** Para eso hace falta **TH-P4**: dos variables de
  repositorio en GitHub para el registry de DigitalOcean. Sin ellas `release.yml`
  no puede ni hacer login.
- **No retira `deploy.yml`** — ver el aviso del §1.

### Si lo que quieres es probar el modelo nuevo en DigitalOcean

Ése es otro camino y son cuatro pasos, en este orden:

1. **TH-P4** — fijar las dos variables de repositorio del registry.
2. **Etiquetar una versión** (`git tag v0.1.0 && git push emiliano v0.1.0`).
   `release.yml` dispara con **tags**, no con push a `main` (`release.yml:40-42`),
   y corre las e2e antes de publicar.
3. **TH-F2.4** — promover esa versión a `estable` con el workflow `promover.yml`.
4. **Un droplet nuevo** con el aprovisionamiento de la Fase 5, que todavía no
   está escrito (F5.1–F5.4).

> ⚠️ **Hallazgo abierto de los dos workflows de release:** el token del registry
> viaja en `argv` (`release.yml:242` lo pasa como `--username`, y `promover.yml`
> heredó el patrón), así que queda en `/proc/<pid>/cmdline`. Atenuantes: runner
> efímero y de un solo inquilino. No invalida nada, pero conviene cerrarlo antes
> de que ese token sea el de la flota entera.

---

*Preparado el 2026-08-20. Ningún comando de este documento se ha ejecutado.*
