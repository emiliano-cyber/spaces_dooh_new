---
tipo: modulo
estado: verificado
actualizado: 2026-08-07
tags: [frontend, estado, fetch, react-query, zustand]
archivos:
  - apps/web/app/providers.tsx
  - apps/web/lib/csrf-client.ts
  - apps/web/lib/loading-fetch.ts
  - apps/web/lib/data/store.ts
  - apps/web/lib/auth-real.ts
  - apps/web/lib/api-client.ts
---

# Estado y data fetching

## Tres mecanismos conviviendo

| Mecanismo | Para qué | Dónde |
|---|---|---|
| **React Query** | Cache de servidor, `staleTime` 60 s, `retry` 1 | `app/providers.tsx:20-30` |
| **zustand** | Estado en memoria del shell (`DemoState`) | `lib/data/store.ts` |
| **Context** | Sesión (`SesionContext`) | `components/demo/shell/SesionContext.tsx` |

> [!note] El QueryClient se crea **por instancia de componente**
> `providers.tsx:18-20` lo explica: un singleton compartiría la caché entre
> renders de servidor de usuarios distintos y filtraría datos ajenos.

## El store de zustand es herencia de la demo

`lib/data/store.ts:1-12` — guarda el `DemoState` completo, es la única fuente en
memoria, y las pantallas **no lo tocan directo**: pasan por `client.ts` →
`adapters/mock.ts`. Sin persistencia: un refresh lo reinicia al seed.

`HidratarSitios` (en el shell) es lo que lo rellena con datos reales del BFF.

> [!warning] Es la costura entre la demo original y el producto real
> Coexisten el store en memoria y las llamadas al BFF. Si añades una pantalla,
> decide de cuál de los dos lees y no mezcles. Ver [[preguntas-abiertas]].

## Los dos parches de `window.fetch`

Se instalan una sola vez, en orden, en `providers.tsx:13-16`:

```mermaid
flowchart LR
    LL["loading-fetch<br/>(cuenta en vuelo)"] --> CS["csrf-client<br/>(añade x-csrf-token)"] --> NF["fetch nativo"]
```

| Parche | Qué hace | Alcance |
|---|---|---|
| `csrf-client.ts` | Añade `x-csrf-token` desde la cookie `spaces_csrf` | Mutaciones **same-origin** |
| `loading-fetch.ts` | Cuenta peticiones en vuelo para `<IndicadorCarga>` | Mutaciones **same-origin** |

Ninguno toca `GET`/`HEAD` ni cross-origin. Son idempotentes.

> [!danger] Por qué se parchea `fetch` en vez de tocar cada llamada
> `csrf-client.ts:6-13`: las llamadas al BFF están repartidas en muchos
> `*-api.ts` **sin un chokepoint único**. El parche es la forma de garantizar que
> ninguna mutación se olvide del header. **Si quitas el parche, todas las
> mutaciones empiezan a dar 403.**

## Lo que el indicador de carga NO cubre

Solo cuenta **peticiones al servidor**. Subir un logo son tres esperas y solo la
última es una petición (leer el archivo, comprobar que se puede mostrar,
enviarlo). Por eso los puntos de subida tienen su propio aviso local
(`docs/Registro_Cambios.md`, entrada del 06/08).

## Clientes de API

| Archivo | Para qué |
|---|---|
| `lib/auth-real.ts` | `/api/auth/*` — `useSesion()`, login, logout. **El cliente real** |
| `lib/api-client.ts` | Helper genérico |
| `lib/portal-cliente-api.ts` | Portal público |
| `lib/data/estado-api.ts` | `refrescarEstado()` desde `/api/estado` |

Todas las rutas llevan **barra final** por `trailingSlash: true`
(`auth-real.ts:8-12`).

> [!danger] `lib/auth-context.tsx` NO es esto
> Es el cliente JWT muerto contra el backend archivado, y sigue montado en
> `providers.tsx:34`. Ver [[vision-general]].

## Formularios y validación

`react-hook-form` + `@hookform/resolvers` + `zod`. El mismo `zod` valida en el
servidor ([[infraestructura-servidor]]), pero **son esquemas distintos**: la
validación de cliente no sustituye a la de servidor.

## Relacionadas
[[shell-y-navegacion]] · [[03-Frontend/_indice|Índice de Frontend]] ·
[[autenticacion-y-sesion]] · [[infraestructura-servidor]] · [[MOC-Proyecto]]
