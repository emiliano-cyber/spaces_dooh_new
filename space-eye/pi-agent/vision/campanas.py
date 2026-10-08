"""Las campanas que se vendieron para esta pantalla, y su foto de prueba del dia.

SPACE OS sabe que creativo sale en que pantalla (sus reservas confirmadas) y se
lo manda a Space Eye; el servidor lo pasa al equipo en la configuracion de
creativos como `campanas: [{"id", "sha", "foto_hoy"}]`.

Aqui:
  · se baja la referencia de cada campana UNA vez (reducida en el servidor,
    unos 50 KB) y se guarda en disco por su huella; si el arte cambia, se baja
    la nueva y se borra la vieja;
  · en cada vistazo se compara la pantalla con las referencias (ORB con
    geometria, como el reconocedor). La referencia es el arte limpio y la toma
    es la pantalla vista por la camara; cuando coincide se guarda tambien esa
    toma como variante, y las siguientes la reconocen con mas margen;
  · lo que se reconoce como campana NO es un creativo nuevo (no gasta el tope
    de lo programatico) y su prueba sale al momento: una por campana al dia.
    Que ya se mando hoy se guarda en disco y tambien lo dice el servidor
    (`foto_hoy`), asi un reinicio no la repite.
"""
import datetime
import json
import os

import cv2
import numpy as np

import vision
from reconocedor import UMBRAL

VARIANTES_MAX = 4
# Una referencia que no se pudo bajar se reintenta, pero no en cada vuelta.
REINTENTO_MS = 10 * 60_000


class Campanas:
    def __init__(self, directorio, descargar, ahora_ms):
        """descargar(id) -> bytes JPEG o None (sin red, o ya no es del equipo)."""
        self.dir = os.path.join(directorio, "campanas")
        os.makedirs(self.dir, exist_ok=True)
        self._descargar = descargar
        self._ahora = ahora_ms
        self._indice = os.path.join(self.dir, "campanas.json")
        self.activas = {}        # id -> {"sha", "foto_hoy"}
        self._fallidas = {}      # id -> ms del ultimo intento fallido
        self._rasgos = {}        # (id, ancho, alto) -> [Rasgos]  (la referencia y sus variantes)
        self.dia = ""
        self.hechas = set()      # ids con prueba mandada hoy
        try:
            with open(self._indice, encoding="utf-8") as f:
                j = json.load(f)
            self.dia = str(j.get("dia") or "")
            self.hechas = {int(x) for x in j.get("hechas") or []}
        except (OSError, ValueError):
            pass

    def _hoy(self):
        return datetime.datetime.fromtimestamp(self._ahora() / 1000).strftime("%Y-%m-%d")

    def _guardar(self):
        tmp = self._indice + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"dia": self.dia, "hechas": sorted(self.hechas)}, f)
        os.replace(tmp, self._indice)

    def _archivo(self, id_, sha):
        limpio = "".join(ch for ch in str(sha) if ch.isalnum())[:32]
        return os.path.join(self.dir, "%d_%s.jpg" % (id_, limpio))

    def _nuevo_dia(self):
        hoy = self._hoy()
        if hoy != self.dia:
            self.dia = hoy
            self.hechas = set()
            self._guardar()

    def actualizar(self, lista):
        """La lista de la configuracion: baja lo que falta y olvida lo que ya no viene."""
        self._nuevo_dia()
        nuevas = {}
        for c in lista or []:
            try:
                id_ = int(c.get("id"))
            except (TypeError, ValueError):
                continue
            nuevas[id_] = {"sha": str(c.get("sha") or id_), "foto_hoy": bool(c.get("foto_hoy"))}
        # Lo que el servidor ya tiene de hoy cuenta como hecho (reinicios).
        for id_, c in nuevas.items():
            if c["foto_hoy"] and id_ not in self.hechas:
                self.hechas.add(id_)
                self._guardar()
        quedan = {os.path.basename(self._archivo(i, c["sha"])) for i, c in nuevas.items()}
        for nombre in os.listdir(self.dir):
            if nombre.endswith(".jpg") and nombre not in quedan:
                try:
                    os.remove(os.path.join(self.dir, nombre))
                except OSError:
                    pass
        self._rasgos = {k: v for k, v in self._rasgos.items()
                        if k[0] in nuevas and k[3] == nuevas[k[0]]["sha"]}
        self.activas = nuevas
        for id_, c in nuevas.items():
            ruta = self._archivo(id_, c["sha"])
            if os.path.exists(ruta):
                continue
            if self._ahora() - self._fallidas.get(id_, -REINTENTO_MS) < REINTENTO_MS:
                continue
            jpeg = self._descargar(id_)
            if not jpeg:
                self._fallidas[id_] = self._ahora()
                continue
            tmp = ruta + ".tmp"
            with open(tmp, "wb") as f:
                f.write(jpeg)
            os.replace(tmp, ruta)
            self._fallidas.pop(id_, None)

    def __len__(self):
        return sum(1 for i, c in self.activas.items() if os.path.exists(self._archivo(i, c["sha"])))

    def _de(self, id_, ancho, alto):
        sha = self.activas[id_]["sha"]
        k = (id_, ancho, alto, sha)
        if k not in self._rasgos:
            img = cv2.imread(self._archivo(id_, sha), cv2.IMREAD_GRAYSCALE)
            if img is None:
                return []
            # La pantalla enderezada tiene la forma de la pantalla; el arte se
            # lleva a esa misma forma.
            ref = cv2.resize(img, (ancho, alto), interpolation=cv2.INTER_AREA)
            self._rasgos[k] = [vision.rasgos(np.ascontiguousarray(ref))]
        return self._rasgos[k]

    def buscar(self, rasgos, pantalla):
        """La campana que se ve en esta pantalla enderezada, o (None, 0)."""
        alto, ancho = pantalla.shape[:2]
        mejor, puntos = None, 0
        for id_ in self.activas:
            if not os.path.exists(self._archivo(id_, self.activas[id_]["sha"])):
                continue
            for r in self._de(id_, ancho, alto):
                p = vision.coincidencias(rasgos, r)
                if p > puntos:
                    mejor, puntos = id_, p
        if mejor is None or puntos < UMBRAL:
            return None, puntos
        variantes = self._rasgos[(mejor, ancho, alto, self.activas[mejor]["sha"])]
        if len(variantes) < VARIANTES_MAX:
            variantes.append(rasgos)
        return mejor, puntos

    def pendiente(self, id_):
        self._nuevo_dia()
        return id_ in self.activas and id_ not in self.hechas

    def marcar(self, id_):
        self._nuevo_dia()
        self.hechas.add(id_)
        self._guardar()
