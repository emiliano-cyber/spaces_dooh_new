# seguimiento.py — Decide CUANDO avisar de una falla, y cuando darla por resuelta.
#
# Port de android/.../pantalla/Seguimiento.kt: misma maquina de estados y el
# mismo JSON de persistencia (aJson/deJson), para que el estado aprendido se
# lea igual en los dos lados.
"""
SaludAnalisis dice lo que vio en UNA vuelta. Esto decide si eso merece una
alerta, con las protecciones contra falsas alarmas:

  1. CONFIRMACION: la misma falla en `confirmaciones` vueltas seguidas, cada una
     separada al menos `separacion_ms` de la anterior. Un camion estacionado
     delante o un anuncio raro no aguantan eso.
  2. UMBRAL: la confianza media de esas vueltas tiene que pasar `umbral`.
  3. UNA SOLA ALERTA por falla: mientras este abierta, no se repite.
  4. RECUPERACION: tras `recuperacion` vueltas sanas seguidas se cierra y se
     avisa, para que quede la hora en que se arreglo.
  5. INCONCLUSO NO CUENTA: una vuelta que no se pudo juzgar (niebla, pocas
     tomas, camara ocupada) ni confirma ni desmiente nada.
  6. SILENCIO: lo que alguien descarto en el dashboard ("no es falla") no
     vuelve a sonar mientras el servidor lo mantenga silenciado.
  7. APRENDIZAJE: al principio no se avisa nada; se aprende que zonas NO
     cambian nunca (tapadas por una barda o un arbol) para no juzgarlas despues.

Codigo puro y con el estado serializable: sobrevive a un reinicio del equipo.
"""
import time
from dataclasses import dataclass, field
from enum import Enum

from json_util import redondea
from salud_analisis import Pantalla


class Camara(Enum):
    OK = "OK"
    MOVIDA = "MOVIDA"
    SIN_IMAGEN = "SIN_IMAGEN"
    INCONCLUSO = "INCONCLUSO"


class Observacion:
    """El resultado de una vuelta, ya con lo de la camara."""

    def __init__(self, salud, camara, filas, columnas):
        self.salud = salud
        self.camara = camara
        self.filas = filas
        self.columnas = columnas


@dataclass(frozen=True)
class Evento:
    accion: str            # "abrir" | "recuperar"
    clave: str
    tipo: str
    fila: object           # int o None
    columna: object        # int o None
    confianza: float
    falla_id: object = None
    # Los gabinetes de una falla agrupada ("varios gabinetes apagados").
    zonas: tuple = field(default_factory=tuple)


class _Candidato:
    def __init__(self, tipo, fila, columna, cuenta, confianzas):
        self.tipo = tipo
        self.fila = fila
        self.columna = columna
        self.cuenta = cuenta
        self.confianzas = confianzas


class _Abierta:
    # `desde`: cuando la abrio el equipo. Una que nunca recibio numero del
    # servidor (el aviso se perdio) caduca, en vez de quedar abierta para
    # siempre sin volver a avisar ni recuperarse.
    def __init__(self, id_, sanas, desde):
        self.id = id_
        self.sanas = sanas
        self.desde = desde


class _Celda:
    def __init__(self, vueltas=0, quietas=0):
        self.vueltas = vueltas
        self.quietas = quietas


# Una zona que en una vuelta normal casi no se movio o casi no se encendio.
# 0.2 y no 0.3: contra el percentil 75 una zona SANA de las fotos reales baja
# hasta 0.26; una tapada por una barda queda cerca de 0.05.
QUIETA_ACTIVIDAD = 0.2
QUIETA_BRILLO = 0.5
# Fraccion de vueltas de aprendizaje en que tiene que estar quieta.
FRACCION_EXCLUIR = 0.7
# 2 y no mas: con 2 h de aprendizaje y vueltas cada hora no caben mas.
VUELTAS_MINIMAS = 2
# Long.MIN_VALUE del telefono: se guarda igual en el JSON.
NUNCA = -(2 ** 63)
# Lo que espera una alerta a que el servidor le de numero.
SIN_NUMERO_MAX_MS = 12 * 60 * 60 * 1000


def clave(tipo, fila, columna):
    return tipo if fila is None or columna is None else "%s:%d:%d" % (tipo, fila, columna)


def clave_grupo(tipo):
    """Clave de una falla agrupada: varios gabinetes con la misma falla."""
    return tipo + ":varias"


def clave_del_servidor(tipo, fila, columna):
    """
    La clave de una falla que tiene abierta el SERVIDOR. Una de gabinete sin
    fila ni columna es un grupo ("varios gabinetes"), y tiene que llamarse igual
    que la que arma el equipo: si no, el equipo no la reconocia, no podia
    cerrarla sola y la vuelta se caia al leerle la fila (28-sep).
    """
    if tipo.startswith("zona_") and (fila is None or columna is None):
        return clave_grupo(tipo)
    return clave(tipo, fila, columna)


def _a_entero(s):
    try:
        return int(s)
    except (TypeError, ValueError):
        return None


def _ahora_real():
    return int(time.time() * 1000)


class Seguimiento:
    def __init__(self, confirmaciones=2, separacion_ms=25 * 60_000, umbral=0.6, recuperacion=2, ahora_ms=None):
        # Los tres primeros vienen del servidor (salud_confirmaciones,
        # salud_umbral): el Monitor los pone en cada vuelta.
        self.confirmaciones = confirmaciones
        # 25 y no 30 min: con vueltas cada 30 min el reloj las separa 29 y pico,
        # y no deben contar como la misma. Con los intervalos cortos de pruebas
        # (5 o 15 min) el Monitor la baja al 80% del intervalo.
        self.separacion_ms = separacion_ms
        self.umbral = umbral
        self._recuperacion = recuperacion
        # El reloj de pared (System.currentTimeMillis del telefono): con el que
        # caducan las alertas sin numero. Se puede inyectar en las pruebas.
        self._ahora_ms = ahora_ms or _ahora_real
        self._candidatos = {}
        self._abiertas = {}
        self._celdas = {}
        self._ultima_vuelta = NUNCA

    def sincronizar(self, abiertas_servidor):
        """
        Reconcilia con las fallas que el servidor tiene abiertas. El servidor
        manda: si alguien cerro o descarto una a mano, aqui se olvida.
        """
        ahora = self._ahora_ms()
        for k in list(self._abiertas):
            a = self._abiertas[k]
            if k in abiertas_servidor or (a.id is None and 0 <= ahora - a.desde < SIN_NUMERO_MAX_MS):
                continue
            del self._abiertas[k]
        for k, id_ in abiertas_servidor.items():
            a = self._abiertas.get(k)
            if a is None:
                self._abiertas[k] = _Abierta(id_, 0, self._ahora_ms())
            else:
                a.id = id_

    def confirmada(self, clave_, id_):
        """El servidor confirmo una alerta nueva: se anota su numero."""
        a = self._abiertas.get(clave_)
        if a is not None:
            a.id = id_

    def olvidar(self, clave_):
        """El servidor rechazo la alerta: aqui tampoco queda abierta."""
        self._abiertas.pop(clave_, None)

    def excluidas(self):
        """Zonas aprendidas como "nunca cambian". Solo cuentan tras VUELTAS_MINIMAS.
        En lista, en el orden en que se aprendieron (fila por fila)."""
        fuera = []
        for k, c in self._celdas.items():
            if c.vueltas >= VUELTAS_MINIMAS and c.quietas / c.vueltas >= FRACCION_EXCLUIR:
                p = k.split(":")
                fuera.append((int(p[0]), int(p[1])))
        return fuera

    def reiniciar(self):
        """Olvida lo aprendido (cambio el encuadre o la cuadricula)."""
        self._candidatos.clear()
        self._celdas.clear()
        self._ultima_vuelta = NUNCA

    def registrar(self, ahora, o, aprendiendo, silenciadas=frozenset(), puede_abrir=2 ** 31 - 1):
        """
        Registra una vuelta y devuelve lo que hay que avisar.

        aprendiendo: al principio no se abre nada, solo se aprende.
        silenciadas: claves que alguien descarto en el dashboard.
        puede_abrir: cuantas alertas nuevas deja el tope diario.
        """
        # Un reloj que se atraso (el equipo lo corrigio hacia atras) dejaba la
        # ultima vuelta "en el futuro" y no se revisaba nada hasta alcanzarla.
        if self._ultima_vuelta != NUNCA and self._ultima_vuelta > ahora + 60_000:
            self._ultima_vuelta = NUNCA
        # Dos vueltas muy juntas no son dos confirmaciones independientes.
        if self._ultima_vuelta != NUNCA and ahora - self._ultima_vuelta < self.separacion_ms:
            return []

        anomalias = {}
        grupos = {}
        s = o.salud
        if o.camara == Camara.INCONCLUSO:
            def juzgable(k):
                return False
        elif o.camara != Camara.OK:
            tipo = "camara_movida" if o.camara == Camara.MOVIDA else "sin_imagen"
            anomalias[tipo] = (tipo, (None, None), 1.0)

            # Con la camara mal no se puede juzgar la pantalla.
            def juzgable(k):
                return k == "camara_movida" or k == "sin_imagen"
        elif s is None or s.pantalla == Pantalla.INCONCLUSO:
            def juzgable(k):
                return k == "camara_movida" or k == "sin_imagen"
        elif s.pantalla in (Pantalla.APAGADA, Pantalla.CONGELADA):
            tipo = "pantalla_apagada" if s.pantalla == Pantalla.APAGADA else "pantalla_congelada"
            anomalias[tipo] = (tipo, (None, None), 1.0)

            def juzgable(k):
                return not k.startswith("zona_")
        else:
            for z in s.zonas:
                if z.grupo:
                    k = clave_grupo(z.tipo)
                    anomalias[k] = (z.tipo, (None, None), z.confianza)
                    grupos[k] = tuple(z.grupo)
                else:
                    anomalias[clave(z.tipo, z.fila, z.columna)] = (z.tipo, (z.fila, z.columna), z.confianza)
            fuera = set(self.excluidas())

            def juzgable(k):
                if not k.startswith("zona_"):
                    return True
                p = k.split(":")
                # Una clave rara nunca debe tumbar la vuelta: se juzga.
                if len(p) < 3:
                    return True
                if p[1] == "varias":
                    return True
                f = _a_entero(p[1])
                c = _a_entero(p[2])
                return f is None or c is None or (f, c) not in fuera

            if aprendiendo:
                self._aprender(s, o.filas, o.columnas)
        self._ultima_vuelta = ahora

        eventos = []
        cupo = puede_abrir

        for k, a in anomalias.items():
            abierta = self._abiertas.get(k)
            if abierta is not None:
                abierta.sanas = 0
                continue
            c = self._candidatos.get(k)
            if c is None:
                c = _Candidato(a[0], a[1][0], a[1][1], 0, [])
                self._candidatos[k] = c
            c.cuenta += 1
            c.confianzas.append(a[2])
            if aprendiendo or k in silenciadas:
                continue
            ultimas = c.confianzas[-self.confirmaciones:] if self.confirmaciones > 0 else []
            confianza = sum(ultimas) / len(ultimas) if ultimas else float("nan")
            if c.cuenta >= self.confirmaciones and confianza >= self.umbral and cupo > 0:
                eventos.append(Evento("abrir", k, c.tipo, c.fila, c.columna, redondea(confianza),
                                      zonas=grupos.get(k, ())))
                self._abiertas[k] = _Abierta(None, 0, self._ahora_ms())
                del self._candidatos[k]
                cupo -= 1
        # Un candidato que esta vuelta se vio sano vuelve a cero. Si no se pudo
        # juzgar, se queda como estaba.
        for k in list(self._candidatos):
            if k not in anomalias and juzgable(k):
                del self._candidatos[k]

        for k in list(self._abiertas):
            a = self._abiertas[k]
            if k in anomalias or not juzgable(k):
                continue
            a.sanas += 1
            if a.sanas >= self._recuperacion and a.id is not None:
                p = k.split(":")
                eventos.append(Evento("recuperar", k, p[0],
                                      _a_entero(p[1]) if len(p) > 1 else None,
                                      _a_entero(p[2]) if len(p) > 2 else None,
                                      1.0, a.id))
                del self._abiertas[k]
        return eventos

    def _aprender(self, s, filas, columnas):
        act = s.actividad
        bri = s.brillo
        if act is None or bri is None:
            return
        for f in range(filas):
            for c in range(columnas):
                k = "%d:%d" % (f, c)
                celda = self._celdas.get(k)
                if celda is None:
                    celda = _Celda()
                    self._celdas[k] = celda
                celda.vueltas += 1
                if act[f][c] < QUIETA_ACTIVIDAD or bri[f][c] < QUIETA_BRILLO:
                    celda.quietas += 1

    # --- Persistencia: el mismo JSON que el telefono -------------------------

    def a_json(self):
        cand = [{"k": k, "t": c.tipo, "f": -1 if c.fila is None else c.fila,
                 "c": -1 if c.columna is None else c.columna, "n": c.cuenta, "conf": list(c.confianzas)}
                for k, c in self._candidatos.items()]
        ab = [{"k": k, "id": -1 if a.id is None else a.id, "sanas": a.sanas} for k, a in self._abiertas.items()]
        ce = [{"k": k, "v": c.vueltas, "q": c.quietas} for k, c in self._celdas.items()]
        return {"candidatos": cand, "abiertas": ab, "celdas": ce, "ultima": self._ultima_vuelta}

    def de_json(self, j):
        self._candidatos.clear()
        self._abiertas.clear()
        self._celdas.clear()
        u = j.get("ultima", NUNCA)
        self._ultima_vuelta = int(u) if isinstance(u, (int, float)) and not isinstance(u, bool) else NUNCA
        for o in j.get("candidatos") or []:
            f = int(o["f"])
            c = int(o["c"])
            self._candidatos[o["k"]] = _Candidato(o["t"], f if f >= 0 else None, c if c >= 0 else None,
                                                  int(o["n"]), [float(x) for x in o["conf"]])
        for o in j.get("abiertas") or []:
            id_ = int(o["id"])
            self._abiertas[o["k"]] = _Abierta(id_ if id_ >= 0 else None, int(o["sanas"]), self._ahora_ms())
        for o in j.get("celdas") or []:
            self._celdas[o["k"]] = _Celda(int(o["v"]), int(o["q"]))
