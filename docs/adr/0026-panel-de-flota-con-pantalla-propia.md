# ADR 0026: El panel de flota tiene pantalla propia, fuera del artefacto

- **Fecha:** 2026-09-04
- **Estado:** Aceptada (2026-09-04, por Emiliano)

## Contexto

El estatus de la flota ya existe y funciona, pero **no tiene pantalla**: es
`node apps/flota/estado.mjs`, un guion que corre quien ya está dentro del PADRE por
SSH. Pregunta `GET /api/version` a cada instancia del inventario y saca una tabla con
`nombre · dominio · canal · version · estado · fecha · origen`. `reporte.mjs` (F6.4)
recibe además lo que las instancias mandan solas.

Lo que hay hoy, y que manda sobre cualquier diseño:

- **El artefacto es idéntico para toda la flota** (invariante 3). Lo que viva en
  `apps/web` viaja dentro de la imagen que corre **cada owner en su propio servidor**.
  Hoy lo único que lo garantiza es el `--filter=web` del `Dockerfile`.
- **`apps/flota` no tiene ni una dependencia npm** (`apps/flota/package.json`). Es Node
  pelado. Esa propiedad no es casual: nada que actualizar, nada que audite un CVE.
- **El inventario `flota.json` no se versiona** a propósito — es la lista de clientes
  con sus dominios. Lo versionado es `flota.example.json`, con dominios `.invalid`.
- **`resumen()` recorta contra lista blanca** en vez de copiar y borrar lo que sobre, y
  hay dos pruebas que fijan **las claves exactas** (`estado.test.ts:84,171`). El día que
  `/api/version` crezca una clave, al panel no entra sola.
- El PADRE ya sirve `space-os.io` con nginx sobre un upstream en el 3000
  (`infra/nginx/space-os.io.conf:174`), y la aplicación autentica con la cookie
  `spaces_sesion` (httpOnly) contra la tabla `sesiones` (`auth.ts:15,106`).
- `GET /api/auth/me` devuelve `{ usuario, permisos }` o **401**
  (`app/api/auth/me/route.ts:15-19`).

Decidido por Emiliano el 2026-09-04, sobre cuatro preguntas:

1. **Quién entra:** solo los usuarios dados de alta con credenciales del PADRE.
2. **Qué muestra:** solo lo que ya se muestra. Ninguna columna nueva.
3. **Cuándo consulta:** cuando alguien mira.
4. **Instancia caída:** hay que mandar un mensaje.

## Decisión

`apps/flota` gana **un servidor HTTP propio**, con la librería estándar de Node y
**sin ninguna dependencia npm**, escuchando en `127.0.0.1:3002` y publicado por nginx
en `https://space-os.io/flota/`. Sigue **fuera de `apps/web`** y fuera de la imagen.

**Autenticación: la del PADRE, sin tocar su base.** El panel toma la cookie
`spaces_sesion` que ya trae el navegador —mismo dominio, así que llega sola— y la
reenvía a `http://127.0.0.1:3000/spaces-dooh/api/auth/me`. Si responde **401**, el panel
responde 401. Si responde 200, el panel usa el `usuario` y los `permisos` que le
devuelve la propia aplicación.

Consecuencia de hacerlo así: **el panel no tiene credenciales de base de datos, ni tabla
de usuarios, ni sesiones propias.** No hay un segundo sitio donde crear usuarios ni un
segundo sitio del que revocarlos, y un `logout` en el PADRE apaga también el panel.

**Autorización:** entra quien tenga permiso de `administracion` en el PADRE — confirmado
el 2026-09-04. Es lo más cercano a «los usuarios del PADRE» sin abrirlo a cualquiera con
sesión.

**Qué muestra:** exactamente las siete columnas de `COLUMNAS` (`estado.mjs:69`). La
pantalla **reutiliza `resumen()`** en vez de leer las respuestas crudas, así que hereda
la lista blanca y las dos pruebas que la fijan.

**Cuándo consulta:** al cargar la página. Con la flota de hoy es correcto; queda anotado
que con muchas instancias la página tardará lo que la más lenta.

**Aviso de instancia caída:** el aviso **NO cuelga de la vista**. Un trabajo programado
en el PADRE recorre la flota, compara con el último estado conocido y manda un correo por
Resend (`fetch` directo, como hace `apps/web/lib/server/email.ts`, sin añadir dependencia)
**cuando una instancia pasa de responder a no responder** — y otro cuando vuelve.

Por cambio de estado y no por pasada: si no, una instancia caída generaría un correo cada
vez que corra el cron. Y **fuera de la vista** porque, como se decidió el 2026-09-04, una
instancia puede caerse un viernes por la noche y nadie va a abrir la página hasta el
lunes. El estado anterior se lee del archivo que ya escribe `reporte.mjs`.

## Alternativas consideradas

**Una página dentro de `apps/web`, visible solo si la instancia es el PADRE.** Sería lo
más barato: reutiliza sesión, diseño y despliegue, y no hay proceso nuevo. Se descarta
porque el **código** de esa pantalla viajaría dentro de la imagen de cada owner. Los
datos no —`flota.json` no está ahí—, pero el propio `apps/flota/README.md` ya advierte
que lo único que separa una cosa de la otra es un filtro del `Dockerfile`. Basta un
descuido para que la lista de clientes acabe en el servidor de un cliente.

**Que el panel valide la sesión leyendo la base del PADRE.** Es lo primero que se piensa
—están en la misma máquina— y funciona. Se descarta porque obliga a darle credenciales
de Postgres a un segundo proceso expuesto por nginx, y a reimplementar la validación de
sesión (expiración incluida) en un sitio donde puede divergir de la del producto.
Preguntarle a la aplicación cuesta un salto por *loopback* y no cuesta ningún secreto.

**Login propio del panel, con sus usuarios.** Se descarta sin más: es un segundo almacén
de credenciales para ver seis columnas. Contradice además lo pedido.

**No publicarlo y llegar por túnel SSH**, como ya se hace con `padre-ip.conf`. Es la
opción más segura de todas —cero superficie— y se descarta solo porque lo pedido es que
se vea desde la aplicación. **Queda como vuelta atrás**: apagar el `location /flota/` de
nginx deja el panel accesible por túnel y nada más.

## Consecuencias

**Positivas**

- El estatus de la flota deja de exigir SSH y `node` a mano.
- Ni una línea nueva viaja a la imagen de los owners. El invariante 3 no se toca.
- Sin dependencias npm nuevas: `apps/flota` sigue sin nada que auditar.
- La lista blanca de columnas y sus dos pruebas siguen siendo el único camino por el
  que un dato llega a la pantalla.
- Revocar el acceso de una persona es exactamente lo mismo que hoy: desactivar su
  usuario en el PADRE.

**Negativas**

- **Un proceso más que mantener** en el PADRE: su unidad de systemd, su arranque, su
  sitio en el despliegue. Hoy `apps/flota` no se despliega, se ejecuta a mano.
- **Una superficie pública más.** `space-os.io/flota/` existe aunque conteste 401.
- El panel **depende de que la aplicación del PADRE esté viva** para autenticar. Si el
  3000 está caído, el panel no deja entrar a nadie — justo cuando más ganas hay de
  mirar. Es un costo aceptado: la alternativa era darle credenciales de base.
- Consultar bajo demanda hace que la página **tarde lo que tarde la instancia más
  lenta**. Con tres da igual; con treinta habrá que revisarlo.
- **Un trabajo programado más** en el PADRE, con lo que eso arrastra: si falla, falla
  callado y de madrugada. Su salida tiene que ir a un archivo que alguien pueda mirar,
  igual que la de `update.sh`.
- **El correo se convierte en parte del camino de vigilancia.** Si `RESEND_API_KEY`
  caduca o Resend rechaza el envío, la flota deja de avisar **sin que nada lo diga**.
  Falla abierto, como fallaba el respaldo antes del 02/09.

**Implicaciones de seguridad**

- **Superficie que se agrega:** un `location /flota/` en el vhost de `space-os.io` y un
  proceso en `127.0.0.1:3002`. El proceso **no escucha en la interfaz pública**: solo
  nginx llega a él.
- **Superficie que NO se agrega:** ninguna credencial de base de datos, ningún almacén
  de contraseñas, ninguna sesión propia. El panel no puede leer nada de ninguna
  instancia salvo lo que `/api/version` devuelve con su token.
- **Dónde viven los secretos:** el `FLOTA_TOKEN` (ya existente, para preguntar a las
  instancias) y, si se acepta el aviso por correo, `RESEND_API_KEY` y `EMAIL_FROM`.
  Los tres en el entorno del proceso, en un archivo con modo 600, como `app.env`. Nadie
  los rota hoy — eso es deuda y conviene decirlo.
- **Autenticación y autorización:** delegadas por completo en el PADRE. El panel no
  decide quién es nadie; pregunta. La autorización es el permiso `administracion`.
- **Datos sensibles:** el panel muestra la **lista de clientes con sus dominios**, que
  es exactamente lo que el modelo protege. Está en `flota.json`, fuera de git, en el
  PADRE. En tránsito va por TLS; en reposo, en el disco del PADRE sin cifrar — igual
  que hoy.
- **Dependencias nuevas:** ninguna. Es una decisión, no una casualidad.
- **Superficie de auditoría:** hoy **no queda registrado quién mira el panel**. Con el
  guion tampoco quedaba, pero ahí hacía falta SSH, que sí deja rastro. Publicarlo por web
  quita ese rastro y no pone otro. **Debe registrarse cada acceso** —quién y cuándo—, y
  ese registro encaja con el que ya pide el ADR 0025 §4.

## Las dos que estaban abiertas, y cómo se cerraron

Las dos el **2026-09-04**, por Emiliano:

1. **El aviso sale solo, con un trabajo programado.** No depende de que nadie mire.
2. **El permiso es `administracion`.**

## Cómo revertir

Barato, y por eso se acepta:

1. `rm /etc/nginx/sites-enabled/…` el `location /flota/`, `nginx -t && systemctl reload`.
   Con eso el panel deja de existir de cara a internet **en un minuto**, y el guion
   `estado.mjs` sigue funcionando igual que hoy.
2. `systemctl disable --now` de su unidad. **Ojo:** si la unidad es un enlace al
   repositorio, `disable` **la borra** — medido el 2026-09-02 con `spaces-demo`.
3. No hay migración de datos, ni esquema nuevo, ni nada que deshacer en ninguna base:
   el panel no escribe en ninguna. Lo único que dejaría rastro es el archivo de estado
   que ya escribe `reporte.mjs`.
