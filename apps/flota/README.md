# `apps/flota` — el panel de flota del PADRE

Un vistazo a quién va al corriente: qué versión corre cada instancia, por qué canal
y desde cuándo. Tareas **F6.2** y **F6.4** del `docs/Plan_Instancias_Soberanas_v3.md`.

```bash
cd apps/flota
node estado.mjs                       # la tabla
npx vitest run estado.test.ts         # las pruebas
node reporte.mjs                      # el receptor de reportes (F6.4)
```

---

## Por qué esto NO vive en `apps/web`

El artefacto es **idéntico para toda la flota** (invariante 3). Si el panel viviera
en `apps/web`, la lista de instancias —o sea, la lista de clientes con sus
dominios— viajaría dentro de la imagen que corre **cada owner en su propio
servidor**.

`Dockerfile` construye con `--filter=web`, así que desde aquí no viaja. **Ese filtro
es lo único que lo garantiza**: mover este código a `apps/web` lo rompe en silencio.

---

## Lo único que el panel guarda de un owner

`nombre`, `dominio`, `canal`, `version`, `fecha`, `estado`. **Nada más.**

Ni conteos, ni nombres de organización, ni número de usuarios, ni una cifra del
negocio. `resumen()` **recorta contra una lista blanca** en vez de copiar lo que
devuelva la instancia y borrarle lo que sobra: el día que `/api/version` crezca una
clave, aquí no entra sola. Hay dos pruebas que lo afirman con las **claves exactas**.

Es la misma promesa que sostiene `apps/web/app/api/version/route.ts`: el panel es de
AS OOH y la instancia es del owner.

---

## El inventario: `flota.json`, que **no** está en git

El plan pedía versionar `flota.json`. **No se hizo, y es deliberado**: sería un
inventario de clientes con sus dominios dentro del repositorio, y la regla del
proyecto es que ningún valor real vive en un archivo versionado.

| Archivo | En git | Qué es |
|---|---|---|
| `flota.example.json` | **sí** | plantilla con dominios `.invalid`, que no existen |
| `flota.json` | **no** (`.gitignore`) | el inventario de verdad, solo en el PADRE |
| `estado/` | **no** | lo que reportan las instancias (F6.4) |
| `publico/` | **no** | el JSON que sirve nginx; se regenera en cada corrida |

`estado.mjs` usa `flota.json` **si existe**; si no, cae al de ejemplo y **avisa por
pantalla**. Así `node estado.mjs` funciona en un clon recién hecho —lo que exige la
verificación de F6.2— sin que nadie confunda la salida de ejemplo con la flota real.

Los dominios del ejemplo son `.invalid` (RFC 2606): **no existen ni pueden existir**,
así que en un clon las tres filas salen `sin-respuesta` sin mandar ni una petición al
servidor de nadie.

Para montarlo en el padre:

```bash
cp flota.example.json flota.json    # y se rellena con las instancias de verdad
```

## Los tokens van por entorno, nunca en el inventario

Uno por instancia: **`FLOTA_TOKEN_<NOMBRE>`** — el nombre en mayúsculas y con `-`
convertido en `_` (`inventario` → `FLOTA_TOKEN_INVENTARIO`). Es el mismo valor que
`FLOTA_TOKEN` en el `app.env` de esa instancia (`infra/env/app.env.example`).

`FLOTA_TOKEN` a secas sirve de respaldo para toda la flota, pero **un token
compartido convierte a cualquier instancia comprometida en el panel de todas las
demás**: se usa para probar, no para operar.

---

## Los dos caminos, y por qué hacen falta los dos

**F6.2 · el padre pregunta.** `GET https://<dominio>/spaces-dooh/api/version/` con
la cabecera `x-flota-token`. Funciona mientras el owner exponga esa ruta.

**F6.4 · la instancia cuenta.** El día que un owner cierre esa ruta —y está en su
derecho: es su servidor— el padre se queda ciego. El reporte saliente lo arregla sin
que el padre entre a nada: `update.sh` hace `POST` al padre al terminar cada corrida
con el mismo cuerpo de F6.1 más `instancia`.

`estado.mjs` **fusiona los dos y gana el más reciente**. Un reporte viejo no pisa
una consulta de hace un minuto, y una consulta fallida se deja ganar por un reporte.

### El receptor rechaza entero

`reporte.mjs` valida el cuerpo **por igualdad de conjuntos de claves**, no por
presencia de las que interesan. Un reporte con claves de más **se rechaza completo**:
no se guarda «lo que se entienda». El motivo no es purismo — una clave que nadie
pidió es la puerta por la que un conteo del negocio de un owner acaba en el disco del
padre, y ahí ya no hay quien lo quite.

También comprueba que **el token y el cuerpo digan la misma instancia**: si no, una
instancia con su token legítimo podría sobrescribir el estado de otra.

### Archivos, no base de datos

Un `estado/<instancia>.json` por instancia. Son diez instancias, no diez mil, y una
base nueva en el padre es un servicio más que respaldar, migrar y vigilar por cero
beneficio. El día que sean cien se cambia el almacén sin tocar nada más: todo lo que
escribe está en `guardarReporte()`.

---

## El panel sale **siempre** con 0

Una instancia inalcanzable es una fila `sin-respuesta`, **no un error del programa**.
Un panel que revienta cuando una instancia se cae no sirve para vigilar: justo el día
que hace falta es el día que no arranca. Lo único que sale distinto de 0 es no poder
leer **ningún** inventario.

---

## Los tres estados

| Estado | Cuándo |
|---|---|
| `al-dia` | corre **exactamente** la versión del canal que sigue |
| `rezagada` | corre cualquier otra cosa, **incluida una versión más nueva** |
| `sin-respuesta` | no contestó, o contestó sin versión (token equivocado o ausente) |

Una instancia adelantada sale `rezagada` a propósito: comparar versiones como números
obliga a inventar un orden (¿`v0.5.0-rc1` va antes o después de `v0.5.0`?) y a
mantenerlo, y para lo que el panel decide —a quién hay que empujar— «no corre lo que
le toca» es la respuesta correcta. Una instancia adelantada también merece que alguien
mire por qué.

---

## Notas de montaje

- **`vitest` no está declarado aquí como dependencia**: se resuelve desde la raíz del
  monorepo, donde lo sube `apps/web`. Declararlo obligaría a mover el lockfile por un
  paquete que ya está instalado.
- **El receptor escucha en `127.0.0.1`**, no en `0.0.0.0`: quien termina TLS y mira el
  `Host` es nginx en el padre. Este proceso no debe ser alcanzable desde fuera ni por
  accidente, y el token viaja en una cabecera: **siempre detrás de TLS**.
- **`publico/estado.json`** es lo que sirve nginx como página estática del padre.
