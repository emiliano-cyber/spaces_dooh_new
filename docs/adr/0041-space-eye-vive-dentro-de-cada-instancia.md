# ADR 0041 · Space Eye vive dentro de cada instancia

**Fecha:** 2026-10-01
**Estado:** propuesto · construido en la rama `feat/space-eyes-con-mejoras` y ensayado en local · **las piezas ROJAS (R2/R7) esperan al dueño**
**Decide:** Carlos, el 2026-10-01 («debe ser el mismo y debe estar dentro»)
**Sustituye:** la decisión del 10/09 en `docs/Plan_Space_Eye_En_El_Menu.md:3-5,53-67` (Space Eye como un servicio central nuestro, reflejado en cada instancia), que ya apuntaba a esto como «destino» (`:75-80`)
**Se apoya en:** ADR 0014 (Postgres en el host, la app en contenedor), ADR 0022 (un dueño = un droplet, una base, un dominio), ADR 0032 (el alta en droplet propio), ADR 0037 (cada instancia elige si toma la versión nueva)

---

## Lo que se pidió

Que Space Eyes —las cámaras que vigilan las pantallas: teléfonos Android,
Raspberry Pi y PC con cámara IP— **viva dentro de SPACE OS como cualquier otra
parte**, y no como un servidor aparte del que cada instancia lee. Y que **todo
equipo nuevo que se dé de alta apunte al servidor de su empresa**.

## Lo medido antes de decidir

| Qué | Cómo está hoy | Qué implica |
|---|---|---|
| Space Eye | **Un solo servidor** nuestro (`159.203.188.58`): Node/Express, MySQL, Redis, MediaMTX, coturn y un verificador de IA en Python, en Docker | No es una página más de la app: es otra pila, con otra base y con tráfico UDP de video |
| El módulo | Lee a Space Eye por API con una llave por empresa (`lib/server/space-eye.ts`) | El aislamiento entre empresas depende de la llave, no de la RLS de aquí |
| `update.sh` | Una imagen por archivo de configuración, construido alrededor de Postgres, `migrar.mjs`, `/api/version` y la licencia (`infra/scripts/update.sh:882-883,2034-2040,2540-2563`) | **No sabe** manejar una pila de varios contenedores ni MySQL. No se reutiliza tal cual |
| El droplet de un hijo | `s-1vcpu-1gb` por omisión (`infra/env/ejecutor.env.example:33-34`), ufw solo 22/80/443 (`infra/scripts/setup-droplet.sh:177-181`) | Space Eye no cabe en 1 GB junto a la app (ver costo) y el vivo necesita UDP |
| El registry | `registryspaces`, plan gratuito: **500 MiB y un repositorio** | La imagen de Space Eye pesa **99 MiB** comprimida; cabe como **etiqueta** del mismo repositorio, pero no hay margen para muchas versiones |

## La decisión

**Cada instancia lleva su Space Eye completo, en su mismo droplet, y se instala,
se configura y se actualiza por los mismos caminos que la app**:

```
  ┌──────────────── DROPLET DE UNA EMPRESA (un hijo) ─────────────────┐
  │                                                                    │
  │  nginx :443   <dominio>        → app SPACE OS  127.0.0.1:3000      │
  │               eyes.<dominio>   → Space Eye     127.0.0.1:4200      │
  │                                  /whep/ → MediaMTX 127.0.0.1:8889  │
  │                                                                    │
  │  SPACE OS (contenedor, update.sh)  ──llave──▶  Space Eye (compose, │
  │  Postgres del host                 127.0.0.1   update-eyes.sh)     │
  │                                                MySQL · Redis ·     │
  │                                                MediaMTX · coturn   │
  │                                                                    │
  │  equipos de ESTA empresa ──HTTPS──▶ eyes.<dominio>                 │
  │                          ──RTSP 8554 / UDP 8189 / TURN 3478──▶     │
  └────────────────────────────────────────────────────────────────────┘
```

### Las reglas

1. **Un equipo habla con el Space Eye de su empresa y con nadie más.** Las
   APK, el agente de Pi y el de PC que entrega la pantalla de alta de cada
   instancia apuntan a `https://eyes.<dominio>`.
2. **Todo lo que se da de alta en un Space Eye es de su empresa** (modo
   instancia, `INSTANCIA_OWNER`), traiga testigo o no.
3. **La app nunca habla con un equipo**: le pide a su Space Eye por
   `127.0.0.1:4200` con la llave de la instancia, como hoy.
4. **La misma imagen para toda la flota** (invariante 3): lo que cambia es
   `/etc/space-os/eyes.env`, nunca código.
5. **Nadie copia credenciales a mano.** El alta genera la llave y el testigo una
   vez y los escribe en los dos lados: `app.env` (`SPACE_EYE_KEY`,
   `SPACE_EYE_PROVISION_TOKEN`) y `eyes.env` (`INSTANCIA_LLAVE`,
   `INSTANCIA_TESTIGO`). Space Eye los registra al arrancar.

### Las piezas

| Pieza | Dónde | Zona |
|---|---|---|
| Imagen de Space Eye (`Dockerfile.instancia` en el repo de Space Eye): servidor, migraciones y panel de operación adentro | `$REGISTRY/space-os:eyes-<versión>` y `eyes-<canal>` | — |
| La pila: `infra/eyes/docker-compose.yml`, `mediamtx.yml`, `eyes.env.example` | nueva | 🟢 |
| El actualizador: `infra/scripts/update-eyes.sh` (pull → respaldo `mysqldump` → migración en contenedor desechable → cambio → salud → vuelta atrás), con su arnés `pruebas-update-eyes.sh` | nueva | 🟢 (corre como root: se revisa como el de la app) |
| `eyes.<dominio>` en `infra/nginx/instancia.conf.tpl` (el mismo certificado, con un segundo nombre) | existente | 🟡 |
| `SPACE_EYE_*` en `infra/env/app.env.example` | existente | 🟢 |
| ufw: 8554/tcp, 8189/udp, 3478 y 49160-49200/udp en `setup-droplet.sh` | existente | 🔴 R2 |
| Las altas (`instalar-hijo.sh`, `provision-instancia.sh`): generar `eyes.env` y las dos credenciales, escribir `SPACE_EYE_*` en `app.env`, pedir el certificado con `-d eyes.<dominio>`, instalar el cron de `update-eyes.sh` | existentes | 🔴 R2 / R7 |
| El registro DNS `eyes.<dominio>` (A, «DNS only») en la alta automática | `flota-altas` / ADR 0029 | 🔴 |

## Lo que cuesta, dicho claro

- **Memoria.** Space Eye con su MySQL pide ~600 MB. Un hijo con Space Eye pasa
  de `s-1vcpu-1gb` a **`s-1vcpu-2gb`** (≈ +6 USD/mes por empresa). Dispara el
  criterio 3 del ADR 0014 («que la base compita por memoria con la
  aplicación»): por eso queda escrito aquí y no se hace en silencio.
- **El registry.** 99 MiB por versión de Space Eye contra 500 MiB totales. Con
  dos o tres versiones vivas de cada imagen, el plan gratuito se queda corto:
  **el plan básico (5 GB) cuando se publique la segunda versión de Space Eye.**
- **Una APK por empresa**, compilada contra su `eyes.<dominio>`. Es lo único
  que no sale de la CI: lleva el SDK de Android. Se publica en el volumen de
  descargas de ese Space Eye y la pantalla de alta la entrega.
- **Respaldos de MySQL además de los de Postgres**: `update-eyes.sh` hace uno
  antes de cada actualización; el diario lo extiende `respaldo-diario.sh`.

## Cómo llegan los equipos de g500, que hoy viven en `159.203.188.58`

No se mudan solos ni de golpe. Cuando g500 estrene su droplet con PostgreSQL 16
(`docs/evidencias/21-publicar-y-mover-g500-20260930.md`), ese droplet nace ya
con su Space Eye, con una copia de la base de cámaras de hoy (`MIGRACIONES_BASE=014`)
y sus fotos. Cada equipo se cambia con una actualización de su app que trae la
dirección nueva; la app 0.15.15 ya se vuelve a dar de alta sola si el servidor
no reconoce su llave, y conserva su historial porque se identifica por el mismo
`device_uid`.

## Alternativas descartadas

- **Reescribir Space Eye dentro del código de SPACE OS** (sus tablas en el
  Postgres de la instancia, bajo RLS). Es lo más «uno solo», pero son semanas,
  toca Z9 entera, y MediaMTX, coturn y el verificador seguirían siendo procesos
  aparte. Queda como evolución posible, no como punto de partida.
- **Seguir con un Space Eye central** reflejado en cada instancia. Es lo que
  hay hoy, y lo que el dueño pidió dejar.
