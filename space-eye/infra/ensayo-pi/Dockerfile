# ============================================================================
#  Una Raspberry simulada, para ensayar el agente sin tener una Pi a mano.
# ----------------------------------------------------------------------------
#  Lo mismo que la Pi #13 de campo: Debian 13 (trixie), Node del sistema, el
#  usuario `pi` con sudo sin contrasena y SIN OpenCV, para que la actualizacion
#  tenga que instalarlo sola. Es amd64 y no arm64 (esta PC no emula ARM): el
#  agente es Node y Python, sin nada compilado, asi que la logica, la
#  actualizacion y la vigilancia se ensayan igual. Lo unico que solo prueba una
#  Pi de verdad es la camara (rpicam) y los paquetes arm64 de apt.
#
#  En lugar de systemd:
#    - arrancar.sh hace de Restart=always (si el agente sale, lo levanta);
#    - /usr/bin/systemctl es un sustituto que anota el reinicio pedido en
#      /tmp/reinicio-pedido, para comprobar REBOOT_DEVICE sin apagar nada.
#
#  La camara es una carpeta (/camara/actual.jpg): el ensayo la cambia por
#  debajo para encender o apagar gabinetes a voluntad.
# ============================================================================
FROM debian:trixie-slim
RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends nodejs sudo curl ca-certificates tar gzip procps \
 && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/bash pi \
 && echo 'pi ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/pi && chmod 440 /etc/sudoers.d/pi \
 && mkdir -p /camara && chown pi /camara
RUN printf '#!/bin/sh\necho "$(date -Is) systemctl $*" >> /tmp/reinicio-pedido\n' > /usr/bin/systemctl && chmod 755 /usr/bin/systemctl
COPY arrancar.sh /usr/local/bin/arrancar.sh
RUN chmod 755 /usr/local/bin/arrancar.sh
CMD ["/usr/local/bin/arrancar.sh"]
