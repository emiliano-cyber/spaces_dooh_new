# Mudar equipos de un Space Eye a otro (guía de operación)

Para pasar equipos —teléfonos, Raspberry, PCs— de un servidor de Space Eye a
otro **sin ir a los sitios**. Es lo que permite mover la flota de g500 de
`:4000` a su `eyes.<dominio>` (etapa 5 de la integración definitiva).

## Cómo funciona (lo que hace cada equipo)

La orden es `UPDATE_CONFIG` con `{"mudanza": {"servidor": "...", "codigo": "..."?,
"mudanza_espera_min": 30?}}`. Es un tipo de orden que el Space Eye central **ya
acepta** con cualquier contenido: la mudanza sale de `:4000` sin actualizarlo.

1. El equipo se da de alta **antes** en el servidor nuevo con su misma
   identidad (`device_uid`). Si allá ya existe (la base se copió), entra sin
   código; si no, necesita un **código de vinculación de allá**.
2. Si no puede, **no se mueve** y contesta el motivo al servidor de siempre
   (aparece en el registro del equipo, categoría `mudanza`).
3. Si puede, contesta "me mudo", cambia de servidor y se reconecta.
4. En el nuevo, su **primer reporte** confirma la mudanza.
5. Si en `mudanza_espera_min` (30 por omisión) no logra reportar en el nuevo,
   **regresa solo** al anterior y lo deja dicho allá.

Versiones que saben mudarse: **APK 0.16.1**, **pi-agent 0.7.2**, **pc-agent 1.6.0**.
Un equipo con una versión anterior **ignora** la orden (contesta
`{ignorado: UPDATE_CONFIG}`): primero se actualiza.

## Orden de los pasos para una flota

1. **El servidor nuevo listo**, con la copia de la base del viejo (los equipos
   conservan su `device_uid`, así entran sin código y con su historial).
2. **Actualizar cada equipo en el servidor VIEJO** a una versión que sepa
   mudarse, todavía apuntando al viejo:
   - APK compilada con el `-PserverUrl` del viejo (como siempre);
   - pi-agent / pc-agent publicados en el viejo.
   Verificar en el viejo que reportan la versión nueva.
3. **Mudar uno solo primero** (el de pruebas), y confirmar en el nuevo que
   reporta, toma foto y abre el vivo.
4. **El resto, uno por uno**, con la herramienta:

   ```bash
   cd backend
   ORIGEN_USUARIO=... ORIGEN_CLAVE=... DESTINO_LLAVE=se_... \
   npx tsx scripts/mudar-equipos.ts --origen http://159.203.188.58:4000 \
     --destino https://eyes.g500.mx --equipos 4,5,6 --espera 30
   ```

   Manda la orden, espera la respuesta y **no pasa al siguiente** hasta ver al
   equipo reportando en el destino. Si uno no se pudo mudar, dice por qué y se
   detiene. Las credenciales van por variables de entorno y no se imprimen.
5. El servidor viejo **se queda encendido** hasta que no le quede ningún
   equipo. El espejo (`:4200`) se apaga al final.

## Si algo sale mal

| Síntoma | Qué pasó | Qué hacer |
|---|---|---|
| El equipo contesta "el servidor nuevo no conoce este equipo" | Su fila no está en la base nueva | Copiar la base, o mandar la orden con un `codigo` generado en el nuevo |
| "rechazó el código" | Venció, se usó o se canceló | Generar otro en el nuevo |
| "no pude hablar con el servidor nuevo" | DNS, certificado o el servidor caído | Revisar `https://eyes.<dominio>/health` y repetir |
| Se mudó y a los 30 min volvió al viejo | El nuevo no le respondió después de cambiar | Ver el registro del equipo en el viejo (`mudanza`), arreglar y repetir |
| El equipo contesta `ignorado: UPDATE_CONFIG` | Versión vieja | Actualizarlo primero (paso 2) |

## Ensayado

`infra/ensayo-pi/ensayar-mudanza.sh` contra dos Space Eye locales
(`servidor-b.sh`) con la Raspberry simulada: migración sin código, regreso,
servidor inexistente, servidor que no lo conoce (sin y con código), y regreso
automático cuando el nuevo se cae justo después de la mudanza. Pruebas
unitarias: `pi-agent` y `pc-agent` (`npm run probar`), APK (`MudanzaTest`).
