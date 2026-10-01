# Ensayo local de «Space Eye dentro de una instancia» (ADR 0041 de SPACE OS)

Lo que se corrió el 1-oct-2026 antes de subir nada. Ubuntu 24.04 en WSL hace de
droplet y Docker Desktop de su Docker. Rutas bajo `~/hijo` en lugar de
`/etc/space-os` y `/opt/space-os` (sin root).

1. Imagen de Space Eye: `docker build -f Dockerfile.instancia --build-arg VERSION=0.16.1-local -t space-eye:0.16.1-local .`
2. Clon LF de la rama de SPACE OS en WSL: `git clone -c core.autocrlf=false --branch feat/space-eyes-con-mejoras /mnt/c/Users/hm284/spaces_dooh_new ~/spaces-lf`
3. Instalacion desde cero con la MISMA biblioteca que usan las altas:
   `bash ensayo-alta.sh` (borra y vuelve a crear `~/hijo`: credenciales, eyes.env, archivos y update-eyes.sh).
4. Cambios de version y vuelta atras: `bash cambiar-version.sh <imagen>`.
5. Telefono simulado: copiar `telefono-instancia.html` al volumen de descargas
   (`docker cp telefono-instancia.html space-eyes-api-1:/descargas/`) y abrir
   `http://127.0.0.1:4200/telefono-instancia.html`. Se da de alta sin testigo,
   reporta estado y sube la foto que le pidan.
6. SPACE OS: su imagen (`docker build -t space-os:local-eyes .` en el repo de
   ellos) con un app.env que lleve los `SPACE_EYE_*` que imprime `eyes_pares_app`
   (en Docker Desktop la base URL va a `host.docker.internal:4200`).

Resultados: ver el ADR 0041 de SPACE OS, seccion «Como se ensayo».
