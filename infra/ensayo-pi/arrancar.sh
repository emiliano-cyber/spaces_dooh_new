#!/bin/sh
# Hace de systemd (Restart=always, RestartSec): si el agente sale -porque se
# actualizo, porque le pidieron reiniciar o porque murio-, se levanta otra vez.
# Mientras no haya agente instalado, espera.
while :; do
  if [ -f /home/pi/pi-agent/src/index.js ]; then
    su pi -c 'cd /home/pi/pi-agent && exec node src/index.js'
    echo "[arrancar] el agente salio con codigo $?; lo levanto en 3 s"
  fi
  sleep 3
done
