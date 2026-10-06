# conftest.py — Lo que comparten las pruebas de la vigilancia.
#
# Las fotos son las MISMAS de las pruebas del telefono: se leen directo de
# android/app/src/test/resources, sin copiarlas, para que los dos lados se
# prueben siempre contra lo mismo.
import gzip
import math
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
VISION = os.path.dirname(AQUI)
RECURSOS = os.path.normpath(os.path.join(VISION, "..", "..", "android", "app", "src", "test", "resources"))

# Los modulos de vision/ se importan por su nombre, como cuando corre monitor.py.
# `vision` tambien es el nombre de la carpeta: si alguien la importo como
# paquete, se saca para que gane vision/vision.py.
if VISION in sys.path:
    sys.path.remove(VISION)
sys.path.insert(0, VISION)
_m = sys.modules.get("vision")
if _m is not None and not getattr(_m, "__file__", "").endswith("vision.py"):
    del sys.modules["vision"]


def recurso(nombre):
    return os.path.join(RECURSOS, nombre)


def gris_crudo(nombre):
    """Bytes de un .gris (un byte por pixel, fila por fila)."""
    with open(recurso(nombre), "rb") as f:
        return f.read()


def gris_gz(nombre):
    with gzip.open(recurso(nombre), "rb") as f:
        return f.read()


class JavaRandom:
    """java.util.Random tal cual (LCG de 48 bits y nextGaussian polar), para
    que las fallas simuladas con ruido sean las mismas que en el telefono."""

    _MULT = 0x5DEECE66D
    _MASCARA = (1 << 48) - 1

    def __init__(self, semilla):
        self._s = (semilla ^ self._MULT) & self._MASCARA
        self._hay_otro = False
        self._otro = 0.0

    def _next(self, bits):
        self._s = (self._s * self._MULT + 0xB) & self._MASCARA
        r = self._s >> (48 - bits)
        if r >= 1 << 31:
            r -= 1 << 32
        return r

    def next_double(self):
        return ((self._next(26) << 27) + self._next(27)) * (1.0 / (1 << 53))

    def next_gaussian(self):
        if self._hay_otro:
            self._hay_otro = False
            return self._otro
        while True:
            v1 = 2 * self.next_double() - 1
            v2 = 2 * self.next_double() - 1
            s = v1 * v1 + v2 * v2
            if 0 < s < 1:
                break
        m = math.sqrt(-2 * math.log(s) / s)
        self._otro = v2 * m
        self._hay_otro = True
        return v1 * m
