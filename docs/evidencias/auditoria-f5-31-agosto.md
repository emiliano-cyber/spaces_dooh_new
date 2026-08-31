---
Para: quien retome la Fase 5
De: la auditoría del 2026-08-31
Método: correr el comando de verificación EXACTO de cada tarea y comparar
---

# Auditoría de F5.3, F5.4 y F5.6 — 2026-08-31

**Por qué se hizo.** Al ir a escribir F5.3 aparecieron ya creados los dos archivos
que la tarea declara «nuevos». En vez de escribirlos encima, se corrió la
verificación de cada tarea y se comparó con el repositorio. **Dos de las tres
estaban hechas.**

El recuento del traspaso del 28/08 —«Fase 5: 3 de 8»— **está desactualizado**: el
trabajo se hizo durante las siete semanas de la rama larga y el tablero no lo
recogió. **Son 5 de 8.**

---

## F5.3 · Plantillas de instancia — HECHA, con otro reparto

### Verificación, corrida sin parafrasear

```
cd apps/web && npx vitest run lib/entorno.test.ts   ->  20 passed (20)
rg -n "space-os\.io" infra/env infra/nginx/instancia.conf.tpl
   ->  1 resultado, y es un comentario (instancia.conf.tpl:9)
```

**Criterio de aceptación cumplido**: ninguna plantilla lleva un dominio real
quemado.

### Lo que hay, y no es lo que el plan describe

| Archivo | Contenido real |
|---|---|
| `infra/env/app.env.example` | La lista **entera** de F5.3: `APP_URL:34`, `DATABASE_URL:45` (rol `spaces_app`), `COOKIE_SECURE=1:51`, `AUTOREGISTRO=0:72`, `NEXT_PUBLIC_RECUPERAR_PASSWORD:79`, `EMAIL_FROM:85`, `RESEND_API_KEY:86`, `GOOGLE_*:92-94`, `GOOGLE_REDIRECT_URI:104` con la barra final, `BOOTSTRAP_TOKEN:118`, `RECORDATORIOS_TOKEN:124`, `CANAL:148`, `TZ:154` |
| `infra/env/instancia.env.example` | La configuración de **`update.sh`**, no de la aplicación. `:58` declara `ENV_APP=/etc/space-os/app.env`, que es donde está el reparto. Y `:121-124` trae `SPACES_KEY/SECRET/BUCKET` y `LOGS_BUCKET` |
| `infra/nginx/instancia.conf.tpl` | **10 usos de `__DOMINIO__`** (`server_name:84,:102`, certificado `:104`). Conserva las cuatro cosas que el plan exige literales |

### Tres contradicciones con el texto del plan

1. **El reparto de archivos.** El plan (`:1500-1512`) mete las variables de la
   aplicación en `instancia.env.example`. En el repo la aplicación va en
   `app.env.example` y `instancia.env.example` es del actualizador — que es lo que
   `update.sh` consume. **Hacer lo que dice el plan rompería el `--env-file` que ya
   funciona.**
2. **`NEXT_PUBLIC_AUTOREGISTRO=0` no existe.** La mató F2.6, y
   `apps/web/lib/entorno.test.ts:254-260` **prohíbe resucitarla**. Escribir lo que
   pide el plan pondría esa prueba en rojo. Ya estaba anotado en
   `vault/07-Agentes/ejecucion-plan-v3.md:1884`.
3. **Su «prueba que falla primero» no puede fallar**: los casos existen y pasan. Y
   el hueco que el propio tablero dejó apuntado (`:528-537`, que F5.3 tenía que
   añadir las claves de Spaces) **ya está cubierto**.

---

## F5.4 · `provision-instancia.sh` — HECHA

Existen los dos archivos: `infra/scripts/provision-instancia.sh` (401 líneas) y
`docs/runbook-alta-de-owner.md`.

### Verificación, en simulación y sin tocar ningún servidor

El comando **exacto** del plan **falla**, y es el plan el que está viejo:

```
bash infra/scripts/provision-instancia.sh --host <ip> --dominio <dominio> --dry-run
   ->  "provision: falta --instancia <nombre>"   ·  exit 64
```

Con el argumento que el script sí pide, **exit 0**, y la simulación recorre los
pasos 2 al 7 del plan: rol de app `nosuperuser nobypassrls` y base, esquema y
migraciones con `--instalacion-nueva`, los **dos** archivos de entorno en
`/etc/space-os`, nginx desde la plantilla con el dominio sustituido, el
actualizador con su `cron`, y **se detiene antes del certificado**.

Dos cosas que el script hace bien y conviene no perder:

- **`--dry-run` es el modo por omisión.** Sin `--confirmar` no ejecuta aunque no se
  pida la simulación.
- **Todo el contacto con el servidor pasa por una sola función** (`remoto()`), que
  es también la que respeta la simulación. Si `--dry-run` funciona en un paso,
  funciona en todos. En simulación la contraseña sale como
  `__SECRETO_SIMULADO__`: no se genera ni se imprime nada real.

---

## F5.6 · Ensayo en un droplet desechable — PENDIENTE, y con un bloqueo nuevo

No hay evidencia de que se haya corrido, y no puede correrla un agente: necesita un
droplet real y `ssh`. **Es tarjeta humana.**

> [!danger] Y no puede correrse todavía, por una razón que NO estaba anotada
> El alta instala el canal **`estable`**, y **`estable` no existe**: el registro
> solo tiene `beta` desde hoy. `update.sh:768-770` lo comprueba y **se para en
> seco** — «se para antes de jalar una etiqueta que no existe».
>
> Así que **F5.6 está bloqueada por F2.4**, que a su vez espera la decisión de qué
> dirección representa a DEMO. El plan ya lo decía en las dependencias de F5.4
> (*Depende de: … F2.4*); lo que no estaba escrito es que **el disparador de esa
> decisión es F5.6, no F5.7**.
>
> **Salida alternativa, si se quiere ensayar antes**: `CANAL` es un parámetro de
> `instancia.env` y `update.sh` acepta `beta` (`:768-770`). Una instancia
> desechable podría ensayarse con `CANAL=beta`. **Es una desviación del runbook que
> se está ensayando**, así que la decide una persona, no un agente.

F5.6 depende además de **F3.5**, que también es tarea de servidor y sigue pendiente.
