# Instancias Soberanas · Fase 6 — Expediente de cierre **COMPLETO**

Rama: `feat/servidor-padre-instancias` · Fecha: **2026-08-27**
Plan de autoridad: `docs/Plan_Instancias_Soberanas_v3.md` §FASE 6 (`:1735-1874`)
Máquina: **PADRE `137.184.107.53`** (`space-os.io`) · Lo corrió: Emiliano

> [!important] Es el primer cierre COMPLETO desde la Fase 1
> Las cuatro tareas hechas y **probadas en un servidor real**, sin alcance
> declarado y sin nada esperando al registry. Las Fases 2, 3, 4 y 5 se cerraron
> parciales o siguen abiertas; esta no.

---

## 0 · El cuadro

| Tarea | Estado | Dónde se probó | Anclaje |
|---|---|---|---|
| **F6.1** · `GET /api/version` | ✅ | **producción**, sus dos caminos | `6c57ac1` + `65b8ed1` |
| **F6.2** · panel de flota, fuera del artefacto | ✅ | **producción**, contra instancia real | `61dedd1` |
| **F6.3** · smoke del panel | ✅ | **producción**, tres estados | — (verificación) |
| **F6.4** · la instancia reporta | ✅ | **producción**, extremo a extremo | `61dedd1` + `86863eb` + `7a4f003` |

**Ninguna depende de TH-P4.** Es la única fase de la que se podía decir eso.

---

## 1 · F6.1 — las dos respuestas

```
$ curl -s https://space-os.io/spaces-dooh/api/version/
{"ok":true}

$ curl -s -H "x-flota-token: ..." https://space-os.io/spaces-dooh/api/version/
{"ok":true,"version":"v0.1.0-padre","ultimaMigracion":"20260826_clientes_rfc_unico.sql",
 "base":"ok","canal":"beta","uptime":173}
```

**Seis claves y ni una más.** Sin token no se publica la versión: decirla le
ahorra el trabajo a quien busca una vulnerabilidad conocida de esa versión.

El detalle que vale doble: **`ultimaMigracion` confirmó el bloque de migraciones
por un camino distinto al de `schema_migrations`** — no lo cuenta la tabla, lo
cuenta la aplicación.

Entorno añadido a `apps/web/.env.production` (respaldo previo en
`/root/env.padre.bak.2026-08-27_203012`): `FLOTA_TOKEN`, `SPACE_OS_VERSION`,
`CANAL`. El archivo pasa de 6 a 9 variables, **cada una una sola vez**.
**El token nunca salió de la máquina**: generado con `openssl rand -hex 32` y
leído siempre con `grep … | cut -d= -f2`.

## 2 · F6.2 y F6.3 — el panel, y sus tres estados

Primera corrida **contra una instancia real**; hasta ese día el panel solo se
había ejercido contra dominios `.invalid` en una laptop.

| Estado | Cómo se provocó | Resultado |
|---|---|---|
| `al-dia` | la versión del canal coincide | ✅ `codigo: [0]` |
| `rezagada` | se mueve **el canal**, no la instancia | ✅ `codigo: [0]` |
| `sin-respuesta` | se retira `FLOTA_TOKEN_PADRE` | ✅ `codigo: [0]` |

**El `[0]` en los tres es el criterio**, no un detalle: un panel que revienta
cuando una instancia se cae no sirve para vigilar, porque el día que hace falta
es el día que no arranca.

> **Ese `[0]` se leyó dos veces.** La primera salida fue `salida: 03` —un
> carácter pegado del terminal— y se rehízo con `echo "codigo: [$?]"`. **Un
> número que decide un criterio se lee sin ambigüedad o no se lee.**

## 3 · F6.4 — el camino instancia → padre

### Lo que faltaba, y no era código de aplicación

El emisor ya estaba en `update.sh` (`FLOTA_REPORTE_URL`). **Faltaba todo el otro
lado**: no había unidad systemd para `reporte.mjs` y nginx no exponía
`/flota/reporte` — cero referencias a flota en `infra/nginx/`.

| Pieza | Qué es |
|---|---|
| `infra/systemd/flota-reporte.service` | Usuario **`flota`** dedicado, sin shell ni home |
| `infra/nginx/snippets/flota-reporte.conf` | `location = /flota/reporte`, solo POST, cuerpo a 8k, `limit_req` |
| `space-os.io.conf:165` | **Una línea** de `include`, **solo en el ápice** |

**Solo en el ápice, y es la decisión:** el bloque de `demo.space-os.io` no lo
incluye — una instancia no recibe los reportes de las demás.

### Las cuatro pruebas

**P1 · reporte válido** → `{"ok":true}`, y en disco:

```
-rw-r--r-- 1 flota flota 220 Aug 27 23:41 padre.json
{ "ok": true, "version": "v0.1.0-padre",
  "ultimaMigracion": "20260826_clientes_rfc_unico.sql", "base": "ok",
  "canal": "beta", "uptime": 1, "instancia": "padre",
  "recibidoEn": "2026-08-27T23:41:00.167Z" }
```

**P3 · una clave de más se rechaza ENTERO** — la que importa:

```
{"ok":false,"motivo":"claves de mas, se rechaza el reporte entero: clientes.
 El contrato es exactamente ok, version, ultimaMigracion, base, canal, uptime, instancia"}
```

Y **no tocó el archivo**: sigue en `220` bytes y `23:41`. No se guarda «lo que se
entienda» — una clave que nadie pidió es la puerta por la que un conteo del
negocio de un owner acaba en el disco del padre, y ahí ya no hay quien lo quite.

Sale además **mejor de lo que la tarea pedía**: el motivo nombra la clave
sobrante *y* enumera el contrato completo, así que un emisor mal configurado se
arregla leyendo la respuesta, sin abrir el código del padre.

**P4 · token inválido** → `{"ok":false}` **y nada más**. Al revés que P3, aquí el
silencio es la característica: un token equivocado y un nombre que no existe se
contestan igual, o la respuesta serviría para adivinar quién está en el
inventario.

**P5 · el panel funde los dos caminos** — y esto es lo que cierra la fase:

```
padre   space-os.io   beta   v0.1.0-padre   al-dia   23:41:00.167Z   reporte
  padre: no hay token para esta instancia (FLOTA_TOKEN_PADRE)
codigo: [0]
```

**El padre NO pudo consultar la instancia y aun así sabe que está al día**,
porque la instancia se lo contó. Es exactamente la razón de existir de F6.4,
demostrándose sola: el día que un owner cierre `/api/version` —y está en su
derecho, es su servidor— el panel no se queda ciego.

---

## 4 · Los tres tropiezos, y qué enseñó cada uno

**Los tres eran defectos de la configuración escrita en local, y los tres solo se
ven al ejecutar contra la máquina.** Cada uno quedó documentado **en el archivo
que lo causó**, no en un documento aparte.

### ① `/usr/bin/node` no existe en el PADRE — `status=203/EXEC`

```
root  -> /root/.nvm/versions/node/v20.20.2/bin/node   (la que corre pm2)
flota -> /usr/local/bin/node                          (v20.20.2, la misma)
```

**Hay dos instalaciones de node en esta máquina.** La de nvm **no sirve** para un
servicio contenido: vive bajo `/root`, que `ProtectHome=yes` le tapa **a
propósito** — no es un obstáculo que sortear, es la contención funcionando.

> Si algún día se actualiza node hay que actualizar **las dos**, o la app y este
> servicio empiezan a correr versiones distintas sin que nada avise.

`203/EXEC` dice «no pude ejecutar el binario» y **no distingue** entre «no lo
encuentro» y «no puedo como este usuario». Por eso se aisló antes de tocar la
unidad: arrancarlo a mano, como `flota`, con ruta absoluta y en otro puerto.

### ② `MemoryDenyWriteExecute=yes` mata a V8 — `status=5/TRAP`

La traza lo decía entera:
`v8::internal::Factory::CodeBuilder::AllocateInstructionStream`. Esa directiva
prohíbe mapear memoria escribible-y-ejecutable, que es **lo que hace cualquier
JIT**. Es incompatible con Node por diseño, no con este programa.

> **Lo que lo hizo confuso:** el arranque a mano del paso anterior funcionaba. A
> mano no hay sandbox. **Un servicio que arranca a mano y muere bajo systemd
> señala a las directivas, no al código** — y eso es ahora un aviso en la propia
> tarjeta, en ese paso.

Conservarla exigiría `node --jitless`. Para un receptor que atiende un POST por
instancia y por día, el intercambio no se sostiene en ninguna dirección: ni la
protección vale eso, ni el rendimiento hace falta.

**El resto del endurecimiento se queda entero:** `ProtectSystem=strict` con un
solo `ReadWritePaths`, `ProtectHome`, `NoNewPrivileges`, `IPAddressDeny=any`
salvo loopback, `MemoryMax=128M`, `TasksMax=32`.

### ③ `proxy_read_timeout` duplicado — nginx se niega a arrancar

`proxy-app.conf` ya lo declara (75 s) y el snippet lo repetía a 15 s después del
`include`. nginx no permite repetir una directiva en el mismo contexto.

**Se hereda el valor común** en vez de dejar de incluir `proxy-app.conf` y
escribir las cabeceras a mano: ese archivo existe justamente para que no
diverjan entre vhosts, y trae la decisión anti-suplantación de
`X-Forwarded-For $remote_addr`. Copiarla aquí sería reintroducir el problema que
resuelve, a cambio de 60 segundos que este receptor no necesita.

> **Nada se cayó, y conviene que quede dicho:** el `reload` falló **porque**
> `nginx -t` ya había dicho que no, y nginx conserva la configuración anterior
> en vez de cargar una rota. Es el motivo por el que ese paso va antes y **no se
> salta**.

### Y una cuarta, de método: el chequeo que engaña al revés

`grep -c clientes padre.json` devolvió **1** con el sistema funcionando bien:
`ultimaMigracion` vale `20260826_clientes_rfc_unico.sql`, que contiene esa
palabra. El chequeo buscaba la cadena suelta en vez de la clave
(`'"clientes"[[:space:]]*:'` → `0`).

**Un chequeo que no mide exactamente lo que dice medir es tan inútil en verde
como en rojo.** Lo concluyente estaba al lado y no en el `grep`: **220 bytes y
23:41**, idénticos a los de antes del rechazo.

---

## 5 · Estado del proceso al cerrar

```
● flota-reporte.service   active
  receptor de flota en http://127.0.0.1:8787/flota/reporte
  estado en /var/www/Spaces/apps/flota/estado

LISTEN  127.0.0.1:8787  users:(("node",pid=315783,fd=18))
```

**Escucha solo en loopback**, que es la comprobación y no un detalle: en
`0.0.0.0` sería alcanzable desde internet sin pasar por nginx ni por TLS, y el
token viajaría en claro.

**El servicio NO corre como root**, a diferencia del `3000`. Escribe archivos en
disco a partir de peticiones de red: es la clase de proceso que no debe hacerlo,
y el PADRE ya arrastra esa deuda desde la Fase 4 con la aplicación.

---

## 6 · Lo que esta fase NO demuestra

- **El emisor real.** Vive en `update.sh`, que no corre sin el canal de release
  (**TH-P4**). Aquí el emisor fue un `curl` con el mismo cuerpo y el mismo
  token; lo que queda sin ejercer es que `update.sh` lo mande **al final de una
  corrida** y que reintente con backoff si el padre no está.
- **Una instancia remota.** La observada es la app del propio PADRE. Es una
  petición HTTPS real por nginx a un Next real con su base, así que la lógica se
  ejerce entera — **lo único que no demuestra es la distancia.**

## 7 · Dónde queda el plan

Con la Fase 6 cerrada y los ADR 0023 y 0024 del mismo día:

| | |
|---|---|
| Tareas con objeto | **39** de 46 |
| Con prueba real | **29** |
| Esperando **TH-P4** (el registry) | **10** |
| Fuera del repo (`F8.2`) | 1 |

**Fases cerradas: 0, 1 y 6.** De lo que queda, prácticamente todo depende de un
solo dato que no es trabajo: **el nombre del registry de imágenes.**
