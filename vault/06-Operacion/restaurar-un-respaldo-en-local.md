---
tipo: operacion
estado: verificado
actualizado: 2026-09-17
tags: [operacion, respaldos, postgres, local, datos-reales]
archivos:
  - db/docker-compose.yml
  - db/dev-rol-app.sql
  - infra/scripts/respaldo.sh
  - infra/scripts/update.sh
---

# Restaurar un respaldo de una instancia en local

Cómo traer el dump de una instancia a la máquina de desarrollo y levantarlo en el
Postgres del 5433, para probar contra datos de verdad.

> [!danger] Esto mueve datos reales de un cliente a un portátil
> `g500` es **la única base de la flota con datos reales**. La regla de que las
> bases del 5433 son de pruebas y se reinician sin preguntar
> ([[convenciones]]) vale para `spaces` y `spaces_e2e`; **no vale para una copia
> restaurada de un cliente**. Se borra al terminar.

## 1 · Conseguir el dump

**Desde el panel de Spaces, que es el camino corto y no toca el servidor del
cliente.** Spaces → `space-os-respaldos` → carpeta de la instancia (`g500/`,
`padre/`) → el archivo → `...` → Download.

Desde el 2026-09-17 los respaldos salen del droplet, así que **ya no hace falta
entrar a la máquina del owner para recuperar datos**. Antes sí.

> [!warning] Elige por TAMAÑO, no por fecha
> En g500 convivían un dump de **181 KB** del 09/09 y dos de **6,1 MB** del
> 17/09. El pequeño es **anterior a que entraran los datos del cliente**: quien
> restaure «el más antiguo» pensando que es un punto de vuelta atrás recupera una
> base prácticamente vacía.

El camino por `scp` existe, pero **exige llave en el droplet** y la máquina de
desarrollo no la tiene (`Permission denied (publickey)`, medido el 17/09). Es la
tarjeta 06, pendiente desde el 09/09.

## 2 · Los roles, ANTES de restaurar

El dump trae políticas de RLS que **nombran a los roles**. Si no existen, esas
sentencias fallan al restaurar.

```bash
docker exec -i spaces_db psql -U spaces -d postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname='spaces_app') then
    create role spaces_app login password 'spaces_app_dev' nosuperuser nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname='spaces_migrador') then
    create role spaces_migrador login password 'dev' nosuperuser bypassrls;
  end if;
end $$;
SQL
```

Los mismos privilegios que en una instancia: `spaces_app` **sin** `bypassrls`
—es lo que hace que la RLS se comporte como en producción— y `spaces_migrador`
**con**. Ver [[multi-tenancy-y-rls]].

## 3 · Una base APARTE

**Nunca encima de `spaces`**, que es la base de desarrollo con la semilla:

```bash
docker exec -i spaces_db psql -U spaces -d postgres -c 'drop database if exists spaces_g500;'
docker exec -i spaces_db psql -U spaces -d postgres -c 'create database spaces_g500 owner spaces;'
```

## 4 · Restaurar

Los dumps son **`pg_dump -Fc`** (`update.sh`, paso 3), así que van con
`pg_restore`, no con `psql`:

```powershell
docker cp C:\Users\Server\Downloads\g500.dump spaces_db:/tmp/g500.dump
docker exec -i spaces_db pg_restore -U spaces -d spaces_g500 --no-owner --no-privileges /tmp/g500.dump
```

## 5 · Comprobar que trajo algo

```bash
docker exec -i spaces_db psql -U spaces -d spaces_g500 -c "select count(*) from sitios; select count(*) from usuarios; select count(*) from tenants;"
```

## 6 · Apuntar la aplicación

En `apps/web/.env.local`, **temporalmente**:

```
DATABASE_URL=postgresql://spaces_app:spaces_app_dev@localhost:5433/spaces_g500
```

Con `spaces_app` la RLS funciona igual que en producción, que es el motivo de
probar contra estos datos y no contra la semilla.

## 7 · Borrarla al terminar

```bash
docker exec -i spaces_db psql -U spaces -d postgres -c 'drop database spaces_g500;'
```

> [!warning] No corras migraciones contra ella dándola por desechable
> Si quieres ensayar una migración sobre datos reales, restaura **otra copia
> limpia** primero. La base restaurada es la evidencia de cómo estaba el cliente;
> una migración a medias la convierte en otra cosa sin dejar rastro.

## Relacionadas
[[entorno-y-despliegue]] · [[convenciones]] · [[multi-tenancy-y-rls]] ·
[[zonas-de-riesgo]] · [[esquema]]
