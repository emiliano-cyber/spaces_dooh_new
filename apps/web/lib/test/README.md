# Pruebas de integración (`*.e2e.test.ts`)

Corren contra **Postgres de verdad**, no simulado.

```bash
cd db && docker compose up -d      # una vez
docker exec spaces_db psql -U spaces -d postgres -c "create database spaces_e2e"   # una vez
cd apps/web && npm run test:e2e
```

> **La base es `spaces_e2e`, NO la `spaces` del compose.** Esto arranca cada
> corrida con `drop schema public cascade`, y `spaces` es la base del **demo
> local**: ahí se suben pantallas, campañas y creativos con sus imágenes, que no
> viven en ningún otro sitio. Por eso `exigirBaseDePrueba()` rechaza cualquier
> base cuyo nombre no termine en `_e2e` o `_test`: el borrado tiene que ser algo
> que se pide, no algo que pasa por usar el nombre por defecto.

Las unitarias (`npm test`) no las incluyen: necesitan Docker, y si `npm test`
fallara en una máquina sin Docker el rojo se acabaría ignorando — que es la
forma más rápida de quedarse sin pruebas.

## Por qué existen

Las 631 unitarias cubren la lógica pura con la base simulada. Lo que **nadie**
cubría es que el SQL case con el esquema, que la RLS aísle de verdad y que los
guards compongan en el orden correcto. Eso es justo lo que rompe una migración.

## Dos cosas que descubrió el propio andamio

**1. El repo no podía construir una base funcional.** Al comparar columna a
columna una base levantada desde el repo contra `spaces_prod` faltaban 143
columnas. Tres causas:

- `schema.sql` iba muy por detrás (le faltaban hasta `campanas.enviada_dominio`
  y `validacion_estatus`);
- la cadena de migraciones no se reaplicaba desde cero, por dos inversiones de
  orden alfabético (ver `ANTES_DE` en `scripts/migrar.mjs`, que es de donde
  `db-e2e.ts` importa `ordenar()` desde el 17/08);
- tres objetos existían **solo en producción**, creados a mano y nunca
  versionados. Uno de ellos, `creatividades.retirado_en`, lo escribe
  `creativos-repo.ts:103`: retirar un creativo fallaba en cualquier entorno
  nuevo. Se versionaron en `20260805_objetos_solo_en_prod.sql`.

Hoy la diferencia con producción es **0 columnas**, y cada corrida vuelve a
comprobarlo aplicando `schema.sql` + las 60 migraciones desde cero. Si una deja
de poder aplicarse, se entera CI.

**2. Conectar como superusuario invalida toda prueba de aislamiento.** El
`POSTGRES_USER` del contenedor (`spaces`) es superusuario, y un superusuario
ignora la RLS **aunque la tabla tenga FORCE**. La primera versión de la prueba
«sin tenant, cero filas» daba verde porque la tabla estaba vacía, no porque
aislara: habría firmado un aislamiento inexistente.

Por eso hay **dos pools**:

| Pool | Rol | Para qué |
|---|---|---|
| `poolTest()` | `spaces` (superusuario) | Recrear el esquema y **sembrar** |
| `poolApp()` | `spaces_app` (`nosuperuser nobypassrls`) | Todo lo que deba **respetar** la RLS |

`comoTenant()` usa el de app. Una prueba de aislamiento que use el admin no
prueba nada.

## Reglas al escribir aquí

- **Fechas relativas a hoy**, nunca literales (`enDias(-30)`). Media espina
  depende de «hoy»; con fechas fijas la suite se pudre sola y empieza a fallar
  por el calendario.
- **El contrato de la semilla nace COMPLETO**: el ADR 0003 impide reservar una
  pantalla sin cobertura contractual, y si no, el flujo falla por un motivo que
  no es el que se prueba.
- **Un cero no prueba aislamiento si la tabla está vacía.** Siembra primero,
  comprueba después.
