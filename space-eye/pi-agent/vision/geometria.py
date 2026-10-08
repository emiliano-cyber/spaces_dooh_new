# geometria.py — La pantalla dentro de la foto: esquinas, gabinetes y horario.
#
# Port de android/.../pantalla/Geometria.kt.
"""
Lo que alguien marco en el dashboard sobre una foto del equipo:

  - las 4 ESQUINAS de la pantalla, en fracciones de la foto tal como la guarda
    el equipo (ya girada), en orden: arriba-izq, arriba-der, abajo-der,
    abajo-izq. Cuatro esquinas y no un rectangulo porque casi ninguna camara ve
    la pantalla de frente (TLALPAN la ve en diagonal) y hay que "enderezarla"
    para que cada gabinete caiga en su lugar;
  - cuantos gabinetes tiene (filas x columnas), para poder decir "Gabinete 4";
  - zonas a no juzgar (tapadas por algo fijo);
  - el HORARIO en que la pantalla debe estar encendida. Fuera de el, una
    pantalla apagada es lo normal y no se vigila.
"""
import datetime
import re

from json_util import opt_arr, opt_int, opt_obj, opt_str

MEDIANOCHE = datetime.time(0, 0)

# Margen tras encender y antes de apagar: el arranque del reproductor no es una falla.
MARGEN_MIN = 10


def _segundos(t):
    return t.hour * 3600 + t.minute * 60 + t.second


def _hora(s, pordefecto):
    # Como LocalTime.parse: "HH:mm" o "HH:mm:ss"; "6:00" se completa a "06:00" y
    # "24..." es la medianoche. Lo que no se entiende toma el valor por omision.
    try:
        if s is None or s.strip() == "":
            return pordefecto
        if s.startswith("24"):
            return MEDIANOCHE
        if len(s) == 4:
            s = "0" + s
        m = re.fullmatch(r"(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?", s)
        if not m:
            return pordefecto
        return datetime.time(int(m.group(1)), int(m.group(2)), int(m.group(3) or 0))
    except Exception:
        return pordefecto


def en_horario(ahora, inicio, fin, margen_min=MARGEN_MIN):
    """
    Si a esta hora la pantalla debe estar encendida (con margen). Acepta
    horarios que cruzan la medianoche (de 18:00 a 02:00) y fin = 00:00 como
    "hasta la medianoche", que es el caso normal: de 6 a 24.
    """
    a = _segundos(ahora)
    i = _segundos(inicio) + margen_min * 60
    f = _segundos(fin) - margen_min * 60
    if fin == MEDIANOCHE:
        f = 24 * 3600 - margen_min * 60
    if _segundos(inicio) < (24 * 3600 if fin == MEDIANOCHE else _segundos(fin)):
        return i <= a < f
    # Cruza la medianoche.
    return a >= i or a < f


class Geometria:
    def __init__(self, esquinas, filas, columnas, excluir, inicio, fin):
        self.esquinas = [(float(x), float(y)) for x, y in esquinas]
        self.filas = filas
        self.columnas = columnas
        self.excluir = set(excluir)
        self.inicio = inicio
        self.fin = fin
        self._h = None

    @staticmethod
    def de_json(j):
        if j is None:
            return None
        e = opt_arr(j, "esquinas")
        if e is None or len(e) != 4:
            return None
        esquinas = [(float(p[0]), float(p[1])) for p in e]
        if any(not (0.0 <= x <= 1.0) or not (0.0 <= y <= 1.0) for x, y in esquinas):
            return None
        filas = min(max(opt_int(j, "filas", 1), 1), 20)
        columnas = min(max(opt_int(j, "columnas", 1), 1), 40)
        excluir = set()
        for p in opt_arr(j, "excluir") or []:
            excluir.add((int(p[0]), int(p[1])))
        h = opt_obj(j, "horario")
        return Geometria(esquinas, filas, columnas, excluir,
                         _hora(opt_str(h, "inicio") if h is not None else None, datetime.time(6, 0)),
                         _hora(opt_str(h, "fin") if h is not None else None, MEDIANOCHE))

    def en_horario(self, ahora):
        return en_horario(ahora, self.inicio, self.fin)

    def numero(self, fila, columna):
        """Numero de gabinete como lo cuenta una persona: de izquierda a derecha y de arriba abajo, desde 1."""
        return fila * self.columnas + columna + 1

    def a_foto(self, u, v):
        """
        Del cuadrado unitario (u, v en 0..1 sobre la pantalla enderezada) a la
        foto (fracciones). Sirve para dibujar en la evidencia el contorno del
        gabinete que fallo en el lugar exacto donde se ve.
        """
        if self._h is None:
            self._h = homografia(self.esquinas)
        h = self._h
        w = h[6] * u + h[7] * v + 1.0
        return (h[0] * u + h[1] * v + h[2]) / w, (h[3] * u + h[4] * v + h[5]) / w

    def contorno(self, fila, columna):
        """Las 4 esquinas de un gabinete en la foto (fracciones), en el mismo orden."""
        u0 = columna / self.columnas
        u1 = (columna + 1) / self.columnas
        v0 = fila / self.filas
        v1 = (fila + 1) / self.filas
        return [self.a_foto(u0, v0), self.a_foto(u1, v0), self.a_foto(u1, v1), self.a_foto(u0, v1)]

    def firma(self):
        """Resume todo lo que, si cambia, invalida lo aprendido."""
        return ";".join("%.3f,%.3f" % (x, y) for x, y in self.esquinas) + "|%d x %d" % (self.filas, self.columnas)


def homografia(q):
    """
    Homografia de (0,0),(1,0),(1,1),(0,1) a las cuatro esquinas dadas. Formula
    cerrada del cuadrado a un cuadrilatero (Heckbert), sin resolver sistemas.
    """
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = q
    dx1 = x1 - x2
    dx2 = x3 - x2
    dx3 = x0 - x1 + x2 - x3
    dy1 = y1 - y2
    dy2 = y3 - y2
    dy3 = y0 - y1 + y2 - y3
    if dx3 == 0.0 and dy3 == 0.0:
        g = 0.0
        hh = 0.0
    else:
        det = dx1 * dy2 - dx2 * dy1
        g = (dx3 * dy2 - dx2 * dy3) / det
        hh = (dx1 * dy3 - dx3 * dy1) / det
    a = x1 - x0 + g * x1
    b = x3 - x0 + hh * x3
    d = y1 - y0 + g * y1
    e = y3 - y0 + hh * y3
    return [a, b, x0, d, e, y0, g, hh]
