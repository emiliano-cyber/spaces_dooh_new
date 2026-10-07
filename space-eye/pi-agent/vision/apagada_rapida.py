"""Pantalla COMPLETA apagada: aviso en menos de un minuto.

La revision de siempre (SaludAnalisis + Seguimiento) confirma una falla en dos
vueltas separadas para no dar falsas alarmas, y eso tarda de 5 minutos a horas
segun la frecuencia. Para el caso mas grave -la pantalla entera negra en su
horario- eso es demasiado: aqui se mira en CADA vistazo.

Se da por apagada cuando, en `VISTAZOS` miradas seguidas (unos 45 s en
continuo):
  - la pantalla esta oscura y pareja (brillo medio < BRILLO_MAX y poca
    variacion), y
  - lo de alrededor NO esta oscuro (brillo medio fuera > FUERA_MIN).
Lo segundo separa "la pantalla se apago" de "es de noche" o "taparon la lente":
en esos dos casos todo se ve oscuro y lo decide la revision de siempre
(sin_imagen), con su confirmacion.

Solo dice CUANDO avisar (una vez por apagon); quien avisa, con que foto y como
se cierra despues es el Monitor, por el mismo camino que las demas fallas.
"""
import cv2
import numpy as np

VISTAZOS = 3
BRILLO_MAX = 40.0
DESVIACION_MAX = 14.0
FUERA_MIN = 45.0


class DetectorApagada:
    def __init__(self, vistazos=VISTAZOS):
        self.vistazos = vistazos
        self.seguidos = 0
        self._mascara = None
        self._clave_mascara = None

    def reiniciar(self):
        self.seguidos = 0

    def _fuera(self, marco, esquinas):
        """Mascara de lo que queda FUERA de la pantalla en el cuadro reducido."""
        clave = (marco.shape, tuple(esquinas))
        if clave != self._clave_mascara:
            h, w = marco.shape[:2]
            pol = np.array([[int(round(x * w)), int(round(y * h))] for x, y in esquinas], dtype=np.int32)
            m = np.full((h, w), 255, dtype=np.uint8)
            cv2.fillPoly(m, [pol], 0)
            self._mascara, self._clave_mascara = m, clave
        return self._mascara

    def medir(self, pantalla, marco, esquinas):
        """(oscura, fuera_iluminada, brillo, fuera) de un vistazo."""
        media, desv = cv2.meanStdDev(pantalla)
        brillo = float(media[0][0])
        fuera = float(cv2.mean(marco, mask=self._fuera(marco, esquinas))[0])
        oscura = brillo < BRILLO_MAX and float(desv[0][0]) < DESVIACION_MAX
        return oscura, fuera > FUERA_MIN, brillo, fuera

    def observar(self, pantalla, marco, esquinas):
        """True UNA vez, en el vistazo en que se completa el apagon."""
        oscura, iluminada, _, _ = self.medir(pantalla, marco, esquinas)
        if oscura and iluminada:
            self.seguidos += 1
            return self.seguidos == self.vistazos
        self.seguidos = 0
        return False
