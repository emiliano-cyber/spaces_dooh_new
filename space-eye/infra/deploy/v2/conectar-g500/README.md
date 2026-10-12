# Conectar las cámaras de g500 a su SPACE OS

**Por qué g500 no ve sus cámaras (08/10/2026):** su SPACE OS (`g500.space-os.io`)
lee las cámaras del espejo `:4200` del servidor de cámaras por
`https://eyes.g500.space-os.io`, y ese sitio **nunca se publicó**: el DNS apunta
a `159.203.188.58`, pero Apache contesta por HTTPS con el certificado de
`market.adavailable.com` (no hay sitio ni certificado para `eyes.g500`). Sin
eso, g500 no tiene a quién preguntarle por sus cámaras. Es configuración de los
servidores; actualizar el código no lo arregla.

| Paso | Dónde | Script |
|---|---|---|
| 1. Publicar `https://eyes.g500.space-os.io` (Apache + certificado), revisando antes y después `market.adavailable.com` y la flota `:4000` | servidor de cámaras `159.203.188.58`, root | `1-servidor-camaras.sh` |
| 2. Crear la llave de servicio de g500 en el espejo (solo ve sus equipos) | mismo | (mismo script) |
| 3. Comprobar cuántos equipos ve esa llave | mismo | (mismo script) |
| 5. Poner `SPACE_EYE_BASE_URL` y `SPACE_EYE_KEY` en `/etc/space-os/app.env` y volver a levantar la app; si no responde, regresa sola | servidor de g500 `142.93.113.106`, root | `2-servidor-g500.sh` |

Los scripts no llevan contraseñas: las piden. La llave del paso 2 se imprime
**una vez**; se teclea en el paso 5.

Después, si g500 sigue viendo la demostración, su licencia trae el módulo
apagado: en el padre, `node apps/flota/modulo.mjs --instancia g500 --activar space-eyes`.

**Pendiente (paso 4):** actualizar el espejo `:4200` a la versión actual. Sin
eso, en g500 funcionan equipos, fotos, vivo y fallas; los códigos de
vinculación y las campañas de Operaciones darán error hasta actualizarlo.
