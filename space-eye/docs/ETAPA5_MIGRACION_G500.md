# Etapa 5 · Pasar la flota de g500 a su propio Space Eye

Plan para revisar con Emiliano **antes** de tocar producción. Cada paso marcado
🔴 toca un servidor en uso y necesita la autorización explícita de Carlos en el
momento. Nada se borra en ningún paso: `:4000` sigue funcionando hasta el final.

## Dónde estamos

| Qué | Hoy |
|---|---|
| Equipos de campo de g500 | En `:4000` (V1). Teléfonos con APK 0.8–0.14, Pi #13 con 0.6.0, PC de REVOLUCION con 1.5.0 |
| `:4200` (espejo) | Copia de `:4000` y le reenvía órdenes. Lleva el teléfono de pruebas |
| Versiones que saben mudarse | APK 0.16.1, pi-agent 0.7.2, pc-agent 1.6.0 (sin publicar) |
| Space Eye con todo lo nuevo | Imagen `space-eye:0.16.8` (en local; sin publicar en el registry) |
| SPACE OS | Rama `feat/space-eyes-con-mejoras`, esperando revisión |

## Requisitos (antes de empezar)

1. **Emiliano aprueba y fusiona** la rama de SPACE OS (incluye lo rojo de la etapa 4).
2. **Publicar la imagen de Space Eye** en el registry (`space-os:eyes-<versión>`).
   El plan gratuito (500 MiB) queda corto: pasar al básico (ADR 0041).
3. **El droplet de g500 nace con Space Eyes** desde el panel de altas
   (casilla «Con Space Eyes»): 2 GB, `eyes.<dominio-g500>` con DNS y certificado.
   Si el dominio es de g500, apuntar **los dos** nombres.
4. **Licencia de g500 con el módulo**: `node apps/flota/modulo.mjs --instancia g500 --activar space-eyes`.

## Pasos

| # | Paso | Quién | Cómo se comprueba |
|---|---|---|---|
| 1 | 🔴 Copiar la base de `:4000` (solo lectura) al Space Eye de g500, adoptándola (`MIGRACIONES_BASE=014`) y migrando a la versión nueva | nosotros | conteo de equipos, fotos y campañas igual en los dos |
| 2 | 🔴 Copiar las fotos (~2.1 GB) por `rsync` | nosotros | conteo de archivos; abrir fotos viejas desde SPACE OS de g500 |
| 3 | 🔴 Publicar en `:4000` las versiones que saben mudarse, **compiladas contra `:4000`**: APK 0.16.1 (`-PserverUrl=http://159.203.188.58:4000`), pi-agent 0.7.2, pc-agent 1.6.0 | nosotros | `:4000` ofrece las versiones nuevas |
| 4 | 🔴 Actualizar cada equipo **en `:4000`**, uno por uno (botón «Actualizar app») | nosotros | reporta la versión nueva en `:4000`; sigue tomando fotos |
| 5 | Mudar primero **el teléfono de pruebas** y comprobar en SPACE OS de g500: reporta, toma foto, vista en vivo, fallas | nosotros | todo funciona en el servidor nuevo |
| 6 | 🔴 Mudar el resto **uno por uno** con `backend/scripts/mudar-equipos.ts` (ver `docs/MUDANZA_DE_EQUIPOS.md`) | nosotros | la herramienta no pasa al siguiente hasta ver al anterior reportando en el nuevo |
| 7 | Copia final de lo que `:4000` haya recibido entre el paso 1 y la mudanza de cada equipo (fotos y telemetría) | nosotros | sin huecos en la galería |
| 8 | 🔴 Apagar el espejo `:4200`. `:4000` se queda encendido y quieto unas semanas, por si hubiera que volver | Carlos | nadie reporta ya en `:4000` |

## Riesgos que hay que mirar

- **Teléfonos que no son «device owner»**: su actualización pide confirmar en
  la pantalla del teléfono. Hay que saber cuáles son antes del paso 4 (la
  ficha dice si se actualiza solo).
- **Android 14+ y la cámara en segundo plano** (MAGNOCENTRO, PATRIOTISMO):
  tras actualizar, si el teléfono se reinicia, hay que abrir la app una vez.
- **Datos móviles**: la APK son ~43 MB por teléfono; la Pi baja ~80 MB de
  OpenCV la primera vez. Hacerlo con WiFi si el sitio lo tiene, o contar con
  ello en el plan del sitio.
- **Fotos que llegan a `:4000` después de la copia**: por eso el paso 7, o
  mudar poco después de copiar.
- **Si un equipo no se puede mudar**, se queda en `:4000` funcionando como hoy;
  si se muda y el nuevo no le responde, regresa solo en 30 minutos.

## Lo que necesita equipo real antes del paso 4

- Escanear un QR con la APK 0.16.x en el teléfono de pruebas.
- Una Raspberry con microSD recién grabada para confirmar la instalación sola.
- Compilar y probar el instalador de la PC 1.6.0 en Windows.
