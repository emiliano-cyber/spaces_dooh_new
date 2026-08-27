# Despliegue en el PADRE — 2026-08-27

**Máquina:** `137.184.107.53` (`space-os.io`) · **Lo corrió:** Emiliano ·
**Tarjeta:** `docs/evidencias/padre-desplegar-27-agosto.txt`

**De `073cb83` a `42b659f` — 52 commits.** Dos días de trabajo: el plan de
instancias (F5.1, F5.2, F6.1, F6.4), los diez hallazgos corregidos de la
auditoría externa, las siete guardas de entrada del censo, DATA-02 y el cambio
de «Vender» a «Ventas».

---

## P0 · El censo de RFC, antes de tocar nada

La validación nueva rechaza fechas imposibles. Se buscó qué datos **ya
guardados** dejarían de poder editarse.

```
    t     |                  i                   |      rfc      |     motivo
----------+--------------------------------------+---------------+-----------------
 clientes | 699a449c-acfd-4c5b-83ff-89846f9bf6ac | XAXX021301000 | fecha imposible
(1 row)
```

**Una sola fila, y cierra el círculo:** ese id está en la lista de registros de
prueba de la propia auditoría. Es el cliente que **ellos crearon** al demostrar
que la API aceptaba el mes 13. El único dato con RFC imposible en producción lo
metió la auditoría al probar el fallo; no hay ningún cliente real afectado.

Se puede corregir su RFC o borrarlo — y borrarlo **ahora es posible**, que es lo
que añadió CRUD-01 en este mismo despliegue.

> **La consulta se equivocó dos veces antes de dar este resultado, y las dos son
> lecciones que valen más que el resultado.**
>
> **① El `!~` nunca llegó a Postgres.** `-bash: !~: event not found`: el `!`
> dispara la expansión de historial de bash **aunque esté dentro de comillas
> dobles**. Se reescribió como `not (... ~ ...)`, que no depende de que nadie se
> acuerde de `set +H`.
>
> **② Marcó como inválidos cuatro RFC correctos**, incluido `XAXX010101000`, que
> es el genérico de público en general. **Los arreglos de Postgres empiezan en
> 1, no en 0**, y la tabla de días se había copiado del código TypeScript, donde
> lleva un `0` de relleno. Con ese cero, el mes 01 consultaba el índice 1 —que
> vale 0— y cualquier día salía «imposible». El validador real
> (`apps/web/lib/rfc.ts:45`) **no** tiene ese fallo: ahí el indexado desde cero
> es el correcto.

---

## Estado de partida, medido en la máquina

| | |
|---|---|
| Commit antes del despliegue | **`073cb83`** — el punto de retorno |
| Árbol | limpio salvo `?? apps/web/logs/`, sin seguimiento y sin choque con el `pull` |
| Disco | 72 GB libres de 77 |
| Memoria | 3.1 GB disponibles de 3.8 |
| Uptime del proceso | 42 h — consistente con el commit |

> El commit desplegado **no era el que se suponía**. La tarjeta se había escrito
> midiendo contra `113ffa4`; el real era `073cb83`, más atrás. Se remidió el
> diff contra el commit real antes de seguir, y las tres conclusiones se
> mantuvieron: hacía falta `npm install`, había una migración nueva y ninguna
> más.

---

## Los pasos, con su salida

| Paso | Qué | Resultado |
|---|---|---|
| **V2** | `git pull` + comprobar que el código está dentro | `LLEGO-TODO` |
| **V3** | `npm install` | `added 1 package` — el workspace `flota`, que no tiene dependencias propias |
| **V4** | Que bajó lo que creemos | `version/route.ts` y `spots-reserva.ts` presentes · **74** migraciones |
| **V5** | `npm run build` | sin errores |
| **V6** | Reiniciar el `3000` | pm2 (systemd decía `inactive`) · `online`, reinicio 10 |
| **V7** | `daemon-reload` + reiniciar el `3001` | `active` |
| **V12** | Migraciones en las dos bases | **72 y 72** — alineadas |

`npm install` y no `npm ci`, a propósito: `ci` borra `node_modules` y lo baja
todo otra vez, así que un fallo de red a media descarga deja la máquina sin
`node_modules` **y** sin sitio.

---

## Las comprobaciones que deciden

| Comprobación | Esperado | Resultado |
|---|---|---|
| `POST /api/auth/login/` con credenciales falsas | 401 | ✅ **401** |
| `POST /api/bootstrap/` con token cualquiera | 404 | ✅ **404** (y compilada) |
| `GET /api/version/` sin token | `{"ok":true}` | ✅ exacto |
| `GET /login/` | 200 | ✅ |
| `POST /api/signup/` | 503 | ✅ registro cerrado |

**El `401` es el único que no se puede fingir.** Significa que la instancia
consultó su base. Un `200` en la página de login solo demuestra que se pinta —
el PADRE estuvo **cuatro días** sirviendo un login perfecto sin poder autenticar
a nadie, con cinco comprobaciones en verde.

**El `{"ok":true}` dice lo mismo por el camino nuevo.** `/api/version` consulta
la base y devuelve 503 si Postgres no contesta; sustituye a la comprobación de
salud anterior, que solo leía variables de entorno y por eso no vio aquella
caída.

**El `404` del bootstrap va acompañado de que la ruta está compilada**, y las dos
cosas juntas son la prueba: un 404 a secas es también lo que responde una ruta
que no existe, o sea lo que veríamos si el despliegue no hubiera entrado.

---

## Lo que NO se aplicó, y es deliberado

**`db/migrations/20260826_clientes_rfc_unico.sql`.** Hace único el RFC de
cliente dentro de cada organización. Queda como decisión aparte: sin ella todo
lo demás funciona, y lo único que no se bloquea es un RFC duplicado. Es segura
de intentar —si hay choques aborta con la lista y no toca nada—, pero lo que no
puede hacer es decidir qué fila se queda cuando los hay.

Por eso las dos bases marcan **72** con **74** archivos en disco: una es de datos
y se omite a propósito, y esta espera.

---

## Pendiente de la persona

El **V13**, que es lo que ninguna prueba automática hace: el título sin «Demo»,
el menú diciendo «Ventas», **un guardado real** —este despliegue toca el
middleware que protege todos los guardados—, **los avisos de CSP en la consola
del navegador** —van en modo reporte y son justamente lo que hace falta para
poder activarla algún día— y que **borrar un cliente pida la contraseña**.
