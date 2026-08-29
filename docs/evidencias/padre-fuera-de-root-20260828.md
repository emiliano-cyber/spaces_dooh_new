# El PADRE deja de correr como root — 2026-08-28

**Máquina:** `137.184.107.53` (`space-os.io`) · **Lo corrió:** Emiliano
**Tarjeta:** `docs/evidencias/padre-sacar-de-root.txt`

> [!success] Dos cosas en la misma ventana
> **La aplicación del PADRE ya no corre como `root`**, que era la deuda que la
> Fase 4 dejó abierta. Y de paso **se desplegó el trabajo del 27 y 28 de
> agosto**, que estaba en el disco desde el `git pull` pero no en el proceso.

---

## 1 · El antes y el después

| | Antes | Ahora |
|---|---|---|
| Quién sirve el 3000 | **pm2**, como `root` | **systemd** `spaces-web`, como `padre` |
| Entorno | `apps/web/.env.production` (600 root) | `/etc/space-os/padre.env` (640 root:padre) |
| Cómo se reinicia | `pm2 restart spaces-web` | `systemctl restart spaces-web` |

```
$ systemctl show spaces-web -p MainPID --value | xargs -I{} ps -o pid,user,cmd -p {}
    PID USER     CMD
 357825 padre    next-server (v14.2.29)
```

**Eso es todo el objetivo de la tarea**, y ahora las dos aplicaciones de la
máquina corren con su propio usuario: `padre` en el 3000 y `demo` en el 3001.
Ninguna como root.

## 2 · Lo que se desplegó de paso

El `npm run build` previo al cambio metió en producción el trabajo de dos días
que estaba pendiente:

- **La pista archivada, retirada.** Nueve rutas, ~2 700 líneas. Con ella deja de
  ejecutarse el `AuthProvider` muerto que en **cada carga de página** hacía
  `POST http://localhost:3001/auth/refresh` — una página de producción
  pidiéndole una identidad a la máquina del visitante.
- **La tipografía**, a Source Serif 4 + Inter con `next/font`, servidas desde el
  propio origen.

**Comprobado en el navegador (V13), y esto es lo que lo cierra:** la consola ya
**no muestra** los avisos de `api.fontshare.com` ni el `POST` a `localhost:3001`.
Es la prueba de que el despliegue entró de verdad — ninguna comprobación de
consola puede afirmarlo, porque las suites no cargan un navegador.

Un guardado real funciona, y la tipografía cambió a la vista.

## 3 · Las comprobaciones

| Paso | Resultado |
|---|---|
| Ensayo en el 3010, como `padre`, antes de tocar el 3000 | `login 200` · `login-post 401` |
| `padre` lee su entorno y **no** el del build | `padre.env: SI` · `.env.production: NO` |
| `padre` resuelve node | `/usr/local/bin/node` |
| El servicio arranca | `active` |
| Corre como `padre` | ✅ |
| El sitio responde | `login 200` |
| Y **toca la base** | `login-post 401` |
| Sobrevive a `systemctl restart` | `active`, `padre`, `login 200` |
| DEMO sigue en pie | `active`, y los dos puertos escuchando |

### El ensayo en el 3010 es la pieza que hizo esto barato

Levantar una segunda copia como `padre` en otro puerto **antes** de tocar el
3000 comprobó de golpe lo que podía fallar —permisos sobre `.next`, resolución
de node, lectura del entorno, conexión a la base— **con el sitio todavía en
pie**. Descubrir cualquiera de esas con el 3000 apagado habría alargado la
caída de segundos a lo que costara diagnosticar.

---

## 4 · Tres cosas que salieron y no estaban previstas

### ① `pm2 save` no guardó nada, y eso reabría el problema

```
[PM2][WARN] PM2 is not managing any process, skipping save...
[PM2][WARN] To force saving use: pm2 save --force
```

`pm2 save` **se niega a escribir una lista vacía** sin `--force`. Sin darse
cuenta, el `dump.pm2` habría conservado `spaces-web`, y **al próximo reinicio de
la máquina pm2 lo habría resucitado a pelear por el 3000 contra systemd**,
ganando el que arrancara primero.

Es exactamente el fallo silencioso que ese paso venía a evitar, y el aviso es
un `WARN` en medio de una salida larga: fácil de pasar por alto. Se cerró con
`pm2 save --force`, y `pm2 list` quedó vacía.

### ② La consola web se come el primer carácter de cada pegado

Se vio primero en los prompts —`oot@ubuntu` en vez de `root@`— y mordió de
verdad al lanzar el ensayo: `udo -u padre …`, `Exit 127`, «orden no encontrada».

**Remedio que funcionó:** anteponer `echo ok;` a cada pegado. Si se come la `e`,
queda `cho ok;` —que falla limpio— y **el resto se ejecuta igual** porque el `;`
separa. Si no se la come, sobra un `ok` y ya.

> Vale para cualquier tarjeta futura contra esta consola. Y ojo con dónde
> muerde: `pm2 delete` mutilado falla limpio, pero no todo comando lo hace.

### ③ Un `401` que no era el que yo creía

La comprobación «que no se puede fingir» se hizo con
`{"correo":…,"clave":…}`, y **la ruta espera `email` y `password`**
(`login/route.ts:25-27`). Con los campos mal, devuelve **400 «Correo y
contraseña requeridos»** sin llegar a la base.

Se notó porque a través de nginx dio **400** y en el ensayo del 3010 había dado
**401** con el mismo cuerpo. Rehecha con el cuerpo correcto: **401**.

> **La duda, RESUELTA el mismo día.** Se miró el código y no admite otra
> lectura: `middleware.ts` solo devuelve **308**, **403** (CSRF) y una
> redirección — **ningún 401** —, y el 401 del login está en `route.ts:43`,
> **después** de la consulta, a la que no se llega sin `email` y `password`.
> Con `{"correo","clave"}` la respuesta es **400 siempre**.
>
> Así que aquel `401` del 3010 fue una lectura equivocada al transcribirlo. Pero
> **lo que importa no es eso: la comprobación B2, tal como estaba escrita, nunca
> pudo probar que el proceso tocara la base.** Habría dado 400 y yo habría
> seguido igual, porque lo que miraba era «no es 500». Corregida en la tarjeta,
> en sus DOS apariciones — el ensayo del 3010 y el V2 contra producción.
>
> **El acierto fue mirar el desajuste en vez de aceptarlo.** 400 en producción y
> 401 en el ensayo no podían ser los dos ciertos, y tirar de ese hilo destapó
> que la prueba estaba mal desde el principio.
>
> Es la cuarta vez en tres días que un chequeo no mide exactamente lo que dice
> medir. Las otras: `grep -c clientes` dando 1 con el sistema correcto, la
> prueba de tipografía roja por sus propios comentarios, y el caso «no
> configurado» de F3.7 pasando en falso por variables heredadas de la shell.

---

## 5 · Lo que cambia a partir de ahora en cada despliegue

**`pm2 restart spaces-web` ya no vale.** La secuencia pasa a ser:

```bash
cd /var/www/Spaces && git pull
npm install                            # si cambió el lockfile
npm run build                          # lo hace root
chown -R padre:padre apps/web/.next    # <-- NUEVO. Sin esto falla al primer cacheo
systemctl daemon-reload                # la unidad es un symlink al repo
systemctl restart spaces-web
systemctl restart spaces-demo          # los dos comparten .next
```

**Y si se toca un secreto, van DOS archivos:** `apps/web/.env.production` (que
lee el build, como root) y `/etc/space-os/padre.env` (que lee el proceso). Si
divergen, manda el segundo.

## 6 · Lo que queda pendiente en esta máquina

- **El kernel.** Corre `6.8.0-124`, hay `6.8.0-138`. La ventana de caída de hoy
  ya pasó; el reinicio sigue sin hacerse. Cuando se haga, comprueba de golpe que
  **`spaces-web` y `spaces-demo` arrancan solos** y que pm2 ya no pelea por el
  3000 — es la verificación real del punto ①.
- ~~La CSP puede encenderse.~~ **HECHO el mismo día.** Ver §7.


---

## 7 · La CSP, encendida el mismo día

Desplegada y comprobada en producción:

```
$ curl -sI https://space-os.io/spaces-dooh/login/ | grep -i content-security-policy
content-security-policy: default-src 'self'; base-uri 'self'; object-src 'none';
  frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; font-src 'self' data:; …
```

**Sin `-report-only`.** Y las cinco pantallas recorridas después: bien.

### El orden importaba, y por eso salió barato

La secuencia no fue casual:

1. **26/08** — la CSP entra en modo aviso. No bloquea nada, solo anota.
2. **27/08** — lo que anotó destapa el `AuthProvider` archivado ejecutándose en
   cada visita. Se retira la pista archivada entera.
3. **28/08** — se migran las fuentes a `next/font`, que era la otra violación.
4. **28/08** — con la consola limpia, una persona recorre las cinco pantallas
   que cargan algo distinto. Cero violaciones. **Entonces** se enciende.

**Encenderla el 26 habría roto la interfaz en silencio** —200 con el sitio a
medias— y nadie habría sabido por qué. El modo aviso no fue un rodeo: fue el
único camino que permitía descubrir las dos cosas sin romper nada.

### Lo que ningún test sostiene, y queda escrito

`cabeceras.e2e.test.ts` solo puede afirmar que la cabecera es la bloqueante.
**Que la política no rompa la interfaz lo sostiene aquel recorrido de cinco
pantallas, no un `expect`** — las suites no cargan un navegador.

> **Si se añade una pantalla que cargue de un origen nuevo, la CSP la bloqueará
> EN SILENCIO.** Volver a modo aviso es quitar y poner una palabra en
> `next.config.mjs`.
