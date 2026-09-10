# Validación de la auditoría del 2026-09-10

- **Auditoría revisada:** `Auditoria_SPACE_OS_2026-09-10.html` (25 KB)
- **Validado el:** 2026-09-09, contra `main` en `67fd6f8`
- **Método:** cada afirmación comprobable, comprobada contra el repositorio. Lo
  que no se pudo medir se dice.

> [!danger] Lo primero, porque cambia cómo hay que leer medio informe
> **La auditoría leyó un repositorio que no es este.** Declara como fuente
> `C:\Users\hm284\spaces-dooh, rama main @ f84f1e7, 08-sep`, y ese commit **no
> existe aquí**:
>
> ```
> git cat-file -t f84f1e7  →  fatal: Not a valid object name
> ```
>
> El nombre de esa carpeta —`spaces-dooh`— es el del remoto **`origin`**
> (`CarlosMend87/spaces-dooh`), que `CLAUDE.md` §6 declara **muerto, 408 commits
> atrás**. El vivo es `emiliano` (`emiliano-cyber/spaces_dooh_new`).
>
> **Sus observaciones en vivo siguen valiendo** —son caja negra sobre el sistema
> desplegado—, pero **cada afirmación sobre «el código» hay que rehacerla**. Es
> lo que hace este documento.

---

## 1 · Tres afirmaciones estructurales que aquí son falsas

Las tres sostienen el «hallazgo transversal que enmarca todo» del informe.

| Afirmación de la auditoría | Medido aquí |
|---|---|
| *«main ya no contiene el endpoint monolítico `/api/estado`»* | **Existe**: `apps/web/app/api/estado/route.ts` |
| *«hay una migración de arquitectura en vuelo: a una API separada **Fastify (:3001)** con tokens Bearer y header `x-tenant-slug`»* | **No existe.** `grep -rl "x-tenant-slug" apps/` → **cero**. `apps/` solo tiene `flota` y `web`. La pista Fastify está **archivada** en `_archive/api` desde hace semanas, y `CLAUDE.md` §5 lo dice: *«Hay una sola pista viva»* |
| Cita **`SECURITY.md`** cinco veces como fuente de invariantes y del *«21/35 tablas con default fijo»* | **No existe** ningún `SECURITY.md` en este repositorio |

**Consecuencia:** el marco metodológico del informe —«el código describe el
próximo estado»— describe el próximo estado **de otro árbol**. La conclusión
correcta no es que producción vaya por detrás de `main`; es que producción va por
detrás de `main` **y la auditoría comparó contra un tercer punto**.

## 2 · Lo que se confirma, y hay que atender

### GOV-01 · Tres cuentas Dueño ✅ **CIERTO**

Medido en el PADRE la misma noche:

```
carlos@adavailable.com | DUENO
demo@adavailable.com   | DUENO
emiliano@asnetwork.io  | DUENO
```

Dos de dominio externo, las tres con máximo privilegio. La recomendación
—degradar lo que no requiera Dueño— es correcta y sigue abierta.

### SEC-06 · El Dueño por Google no puede reautenticar ✅ **CIERTO, y ya nos costó**

No es una hipótesis: **ocurrió esa misma noche**. El diagnóstico completo está en
`docs/datos/20260909_desbloquear_cambios_padre.sql`, y la causa es más precisa
que la del informe: no es que la sesión de Google «no tenga contraseña», es que
la cuenta **sí tiene un hash** y la excepción del ADR 0018 —fijar la primera sin
teclear la anterior— exige `debe_cambiar_password`, que estaba en `false`.

> [!warning] Y el estado cambió DESPUÉS de la auditoría
> El **2026-09-10 00:42 UTC** el Dueño **apagó el control de cambios** desde la
> aplicación para salir del bloqueo (`rgb → exigir_reautenticacion = f`). O sea
> que hoy el PADRE **no exige reautenticación en ninguna de las ocho rutas**,
> tres de ellas de dinero. La foto del informe («Control de cambios ACTIVO ✅»)
> ya no es la de ahora.

La recomendación del informe —*«forzar alta de contraseña al Dueño Google»*— es
la correcta, y el camino está preparado y sin aplicar.

### OPS-01 · Producción por detrás ✅ **CIERTO, y explica media tabla**

Es el hallazgo con más rendimiento del informe: **al menos cuatro de sus
findings desaparecen desplegando** (§3). Lo que no es cierto es la evidencia con
que lo sostiene (`rg` sobre el árbol equivocado); el hecho, sí.

## 3 · Cuatro hallazgos que el código de ESTE repositorio ya resuelve

No son defectos abiertos: son **OPS-01 disfrazado**. Se cierran desplegando.

| ID | Dice la auditoría | Aquí |
|---|---|---|
| **VAL-01b** | *«`POST` con `correo:"no-es-correo"` → 201; falta validar en el servidor»* | **Ya se valida**: `clientes-controller.ts:85-86` lanza `400 Correo inválido` para `email` y para `contacto.email`. El comentario de `:47` **documenta ese mismo síntoma** como el bug que lo motivó |
| **SEC-03** | *«`/api/estado` devuelve 23 colecciones; no probado con rol limitado»* ⚠️ | **Filtra por rol**, y de forma más fuerte que «filtrar»: `route.ts:37-50` consulta cada slice **solo si el rol tiene `ver`** en ese módulo — *«Lo que el rol no puede ver ni siquiera se consulta a la BD»* |
| **SEC-02** | *«"Mi cuenta" sin campo Contraseña actual; parece fuera del Control de cambios»* ⚠️ | **El endpoint sí la exige**: `perfil-controller.ts:82-90` pide `passwordActual` y la verifica, con **401** si falta o no coincide. Si la UI no trae el campo, eso es un defecto de **interfaz** —el guardado fallaría con 401—, no un control ausente |
| **VAL-03** | *«duplicados de RFC permitidos»* | Existe índice único **por tenant** desde `20260826_clientes_rfc_unico.sql`. Si producción los acepta, es que **esa migración no está aplicada allí** — se mide, ver §6 |

## 4 · Donde la recomendación haría daño

### REG-01 · El mapa en blanco

**El diagnóstico es coherente** y la CSP lo respalda: `next.config.mjs:110` define
`connect-src 'self' https://api.maptiler.com https://tiles.openfreemap.org
https://tile.openstreetmap.org` — sin `cartocdn`. Un frontend viejo pidiendo
tiles a CARTO por `fetch` queda bloqueado. Encaja.

> [!danger] Pero la recomendación —«allowlistar cartocdn»— hay que rechazarla
> **CARTO se retiró a propósito ayer.** El commit `5763c4d` (08/09) y el
> **ADR 0030** lo sacaron porque CARTO empezó a exigir clave y su forma de
> pedirla fue **estampar «API KEY REQUIRED» en diagonal encima del mapa** —
> visible en la propuesta pública que ve el cliente. Está escrito en
> `MapView.tsx:44-46`, y hoy usa `tiles.openfreemap.org` (`:60`).
>
> Meter `cartocdn` en la CSP **devolvería la marca de agua**, que es peor que el
> mapa gris: el mapa gris se arregla desplegando; la marca de agua se le enseña
> al cliente.
>
> **El arreglo correcto de REG-01 es OPS-01.** La CSP ya lista exactamente los
> tres proveedores que el código usa.

## 5 · Donde la auditoría es DEMASIADO optimista

### DATA-01 · El país por defecto

La auditoría dice: *«Código main ya fuerza `pais:'MX'` (pendiente desplegar)»`.

**Aquí no.** `apps/web/lib/server/sitios-repo.ts:157` sigue diciendo:

```ts
s.pais ?? 'PE', ...
```

Un sitio dado de alta sin país se guarda como **Perú**, en `main`, hoy. Esto
**no se arregla desplegando**: necesita un cambio de código. Es el único
hallazgo del informe que empeora al verificarlo, y por eso conviene subirlo de
prioridad respecto a donde lo puso.

## 6 · Lo que queda por medir (y cómo)

| | |
|---|---|
| **DATE-01** · fechas un día antes | No contradicho por el código. Existe `lib/server/fechas.ts`, pero resuelve **validación** de fechas (UX-01 del 26/08), no el desfase de zona al renderizar. **Se cierra con una prueba**, no con lectura |
| **UX-01** · `fin < inicio` | `fechas.ts` valida que sea una fecha, no el **rango**. Probablemente sigue abierto |
| **VAL-03** en producción | `sudo -u postgres psql -d spaces_prod -Atc "select indexname from pg_indexes where tablename='clientes'"` — si no aparece `clientes_tenant_rfc_uq`, la migración no está aplicada allí |
| **N1**, **RSC-01**, **DATA-02** | Sin objeción: son observaciones de runtime razonables |

## 7 · Lo que la auditoría no podía saber

Es de la mañana del 10/09 y estas tres cosas son posteriores:

1. **Un defecto de flota que no aparece en el informe:** las redirecciones del
   middleware mandaban el navegador a `localhost:3000`
   (`vault/07-Agentes/diario/2026-09-09.md`). Afecta a **todas** las instancias
   y es más grave que REG-01 — deja la aplicación inalcanzable a quien entre sin
   sesión. Corregido en `main`, pendiente de publicar.
2. **El control de cambios del PADRE está apagado** desde las 00:42 UTC.
3. **g500 tiene su instancia con datos reales** (ADR 0031), así que el PADRE ya
   no es la única máquina con información de negocio.

---

## Veredicto

**El informe es útil y su prioridad número uno es correcta** —desplegar—, pero
**su mitad de código no es de este repositorio** y hay que tratarla como una
hipótesis, no como evidencia. Traducido a acciones:

| Prioridad | Acción | Por qué |
|---|---|---|
| **1** | **Publicar versión y desplegar** | Cierra REG-01, VAL-01b y probablemente VAL-03 y SEC-02/SEC-03 en vivo. Y arrastra el arreglo del middleware, que el informe no vio |
| **2** | **Vía de reautenticación para el Dueño** (SEC-06) | El bloqueo se resolvió apagando el control: hoy no hay reautenticación en las rutas de dinero |
| **3** | **`pais ?? 'PE'`** (DATA-01) | Único hallazgo que no se arregla desplegando |
| **4** | Degradar los Dueños que no lo necesiten (GOV-01) | Medido y cierto |
| **5** | Medir DATE-01 y UX-01 con pruebas | No se cierran leyendo |
| **—** | **NO allowlistar `cartocdn`** | Devolvería la marca de agua que el ADR 0030 quitó ayer |
