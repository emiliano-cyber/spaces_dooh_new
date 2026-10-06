# reconocedor.py — Reconoce el creativo de la pantalla por sus puntos, con cualquier luz.
#
# Port de android/.../creativos/Reconocedor.kt. El catalogo se guarda con el
# mismo formato (catalogo.json + un .orb por variante).
"""
POR QUE PUNTOS Y NO UNA HUELLA
------------------------------
La huella de 256 bits (huella.py) NO sirve para reconocer entre dias
distintos: el sol de mediodia deslava la pantalla y de noche sale saturada; la
huella compara brillos y eso es justo lo que cambia (23-sep-2026, TLALPAN: dos
fotos del MISMO creativo a 73 bits, igual que dos creativos distintos).

ORB busca esquinas y compara su textura local, y despues exige que los puntos
que coinciden guarden la misma geometria (homografia). La luz cambia el brillo
de la esquina, no donde esta. Con las mismas fotos: el mismo creativo da de 18
a 290 puntos coincidentes; dos creativos distintos, 6 como maximo.

DOS CONDICIONES QUE NO SON OPCIONALES
-------------------------------------
  1. Mirar SOLO la pantalla, enderezada con sus 4 esquinas (enderezador.py).
     Con la foto entera, los puntos del fondo coinciden entre todos los
     creativos y cualquier anuncio nuevo pasa por conocido.
  2. El mismo encuadre siempre. El catalogo vale para UN encuadre y UNAS
     esquinas; si cambia cualquiera, se tira y se vuelve a aprender.
"""
import json
import os
import sys
import time

import vision

# Puntos coincidentes para decir "es el mismo creativo".
UMBRAL = 15
# Por debajo de esto, aunque se reconozca, la toma se guarda como otra variante
# de luz del creativo: es la que la proxima vez hara falta.
VARIANTE_HASTA = 40
VARIANTES_MAX = 6
# Tope del catalogo. Al llenarse se va el que lleva mas tiempo sin verse: si no,
# con las semanas cada vistazo se compararia contra cientos.
CREATIVOS_MAX = 80


class _Creativo:
    def __init__(self, id_, variantes):
        self.id = id_
        self.variantes = variantes


def _aviso(texto):
    print("reconocedor: " + texto, file=sys.stderr, flush=True)


class Reconocedor:
    def __init__(self, dir_creativos, ahora_ms=None):
        self._dir = dir_creativos
        os.makedirs(self._dir, exist_ok=True)
        self._indice = os.path.join(self._dir, "catalogo.json")
        self._ahora_ms = ahora_ms or (lambda: int(time.time() * 1000))
        self._catalogo = []
        self._creado = 0
        self._firma = ""
        # Vueltas en que ya vio la pantalla con algo reconocible. La primera
        # siempre es de aprendizaje, aunque el tiempo configurado sea 0.
        self._vueltas = 0

    def abrir(self, firma_nueva):
        """
        Abre el catalogo guardado si fue aprendido con este mismo encuadre; si
        no, empieza uno vacio. `firma_nueva` resume todo lo que lo invalida:
        esquinas, lente, zoom, giro y la fecha desde la que vigila el servidor
        (que cambia cuando alguien pulsa "Volver a aprender").
        """
        if firma_nueva == self._firma and self._creado != 0:
            return
        self._catalogo = []
        self._creado = 0
        self._firma = firma_nueva
        try:
            if os.path.exists(self._indice):
                with open(self._indice, encoding="utf-8") as f:
                    j = json.load(f)
                if j.get("firma") == firma_nueva:
                    self._creado = int(j.get("creado") or 0)
                    self._vueltas = int(j.get("vueltas") or 0)
                    for c in j["creativos"]:
                        vs = []
                        for nombre in c["variantes"]:
                            r = vision.leer(os.path.join(self._dir, nombre))
                            if r is not None:
                                vs.append(r)
                        if vs:
                            self._catalogo.append(_Creativo(c["id"], vs))
                else:
                    _aviso("el encuadre cambio: se empieza un catalogo nuevo")
        except Exception as e:
            _aviso("catalogo ilegible, se empieza de cero: %s" % e)
            self._catalogo = []
        if self._creado == 0:
            for nombre in os.listdir(self._dir):
                if nombre.endswith(".orb"):
                    try:
                        os.remove(os.path.join(self._dir, nombre))
                    except OSError:
                        pass
            self._creado = self._ahora_ms()
            self._vueltas = 0
            self._guardar()

    def aprendiendo(self, aprendizaje_min):
        """Un catalogo nuevo solo aprende: su primera vuelta con la pantalla a la
        vista, y ademas `aprendizaje_min` minutos desde que se empezo."""
        return self._vueltas == 0 or self._ahora_ms() - self._creado < aprendizaje_min * 60_000

    def termino_vuelta(self):
        """Se termino una vuelta en la que se vio la pantalla."""
        self._vueltas += 1
        self._guardar()

    def tamano(self):
        return len(self._catalogo)

    @staticmethod
    def _archivo(id_, k):
        return "%s_%d.orb" % (id_, k)

    def _guardar(self):
        arr = [{"id": c.id, "variantes": [self._archivo(c.id, k) for k in range(len(c.variantes))]}
               for c in self._catalogo]
        with open(self._indice, "w", encoding="utf-8") as f:
            json.dump({"firma": self._firma, "creado": self._creado, "vueltas": self._vueltas,
                       "creativos": arr}, f, separators=(",", ":"))

    def reconocer(self, r):
        """El creativo conocido que mejor coincide, y con cuantos puntos."""
        mejor = None
        puntos = 0
        for c in self._catalogo:
            for v in c.variantes:
                p = vision.coincidencias(r, v)
                if p > puntos:
                    puntos = p
                    mejor = c.id
        # El reconocido pasa al final: el primero de la lista es el que lleva mas
        # tiempo sin verse, que es el que sale si el catalogo se llena.
        if mejor is not None and puntos >= UMBRAL:
            i = next((k for k, c in enumerate(self._catalogo) if c.id == mejor), -1)
            if 0 <= i < len(self._catalogo) - 1:
                self._catalogo.append(self._catalogo.pop(i))
        return mejor, puntos

    def aprender_variante(self, id_, r, puntos):
        """Guarda la toma como otra variante de luz de un creativo ya conocido."""
        if puntos >= VARIANTE_HASTA:
            return
        c = next((c for c in self._catalogo if c.id == id_), None)
        if c is None or len(c.variantes) >= VARIANTES_MAX:
            return
        c.variantes.append(r)
        vision.escribir(os.path.join(self._dir, self._archivo(id_, len(c.variantes) - 1)), r)
        self._guardar()

    def agregar(self, id_, *rs):
        if any(c.id == id_ for c in self._catalogo):
            return
        while len(self._catalogo) >= CREATIVOS_MAX:
            viejo = self._catalogo.pop(0)
            for k in range(len(viejo.variantes)):
                try:
                    os.remove(os.path.join(self._dir, self._archivo(viejo.id, k)))
                except OSError:
                    pass
        c = _Creativo(id_, list(rs))
        self._catalogo.append(c)
        for k, r in enumerate(c.variantes):
            vision.escribir(os.path.join(self._dir, self._archivo(id_, k)), r)
        self._guardar()
