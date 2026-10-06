#!/bin/sh
# Hace de systemd (Restart=always, RestartSec): si el agente sale -porque se
# actualizo, porque le pidieron reiniciar o porque murio-, se levanta otra vez.
# Mientras no haya agente instalado, espera. Sirve al agente de cualquier
# usuario: `pi` (instalado a mano) o `spaceeye` (el que crea el archivo de la
# microSD que da SPACE OS).
while :; do
  for u in pi spaceeye; do
    if [ -f "/home/$u/pi-agent/src/index.js" ]; then
      su "$u" -c 'cd ~/pi-agent && exec node src/index.js'
      echo "[arrancar] el agente de $u salio con codigo $?; lo levanto en 3 s"
      break
    fi
  done
  sleep 3
done
