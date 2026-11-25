"""La bitacora: cuantas veces salio cada creativo, a que hora, y el cierre del dia.

Lo que se prueba aqui es lo que hace que el numero se pueda defender ante un
anunciante: que el denominador no incluya miradas ciegas, que la hora sea la
del sitio y no la del sistema, que el dia se cierre con su total, y que un
reinicio a media tarde no invente huecos.
"""
import datetime
import json
import os

from bitacora import Bitacora


class RelojFalso:
    """Hora del SITIO y hora del sistema por separado: es justo donde se
    equivocan los agentes (Raspberry OS viene en UTC)."""

    def __init__(self, ms, hora_sitio):
        self.ms = ms
        self._h = hora_sitio

    def ahora_ms(self):
        return self.ms

    def hora_local(self):
        return self._h

    def poner(self, hora_sitio, avanzar_ms=0):
        self._h = hora_sitio
        self.ms += avanzar_ms


def t(h, m=0, s=0):
    return datetime.time(h, m, s)


def test_cuenta_pasadas_y_no_las_colapsa(tmp_path):
    """Doce miradas con el mismo anuncio son doce, no una.

    Es EL motivo de todo el modulo: el conjunto `vistas` de monitor.py las
    reportaba como una sola.
    """
    r = RelojFalso(1_700_000_000_000, t(9, 0))
    b = Bitacora(str(tmp_path), r)
    b.empezar_vuelta()
    for i in range(12):
        r.poner(t(9, 0, i))
        hora, reloj = b.vistazo()
        b.pasada("aa" * 32, hora, reloj)
    v = b.de_la_vuelta()
    assert v["vistazos"] == 12
    assert len(v["pasadas"]) == 1
    p = v["pasadas"][0]
    assert p["n"] == 12
    assert p["hora"] == 9
    assert p["desde"] == "09:00:00" and p["hasta"] == "09:00:11"


def test_la_mirada_ciega_no_entra_en_el_denominador(tmp_path):
    """Una pantalla apagada no puede contar contra los anuncios.

    Si entrara, el porcentaje de ocupacion de todos los creativos bajaria por
    algo que no tiene que ver con ellos. De la pantalla apagada ya avisa la
    vigilancia de fallas, que es su sitio.
    """
    r = RelojFalso(1_700_000_000_000, t(3, 0))
    b = Bitacora(str(tmp_path), r)
    b.empezar_vuelta()
    for _ in range(40):
        b.ciego()
    r.poner(t(3, 10))
    hora, reloj = b.vistazo()
    b.pasada("bb" * 32, hora, reloj)
    v = b.de_la_vuelta()
    assert v["vistazos"] == 1
    assert v["horas"] == [{"hora": 3, "vistazos": 1}]
    assert b.ciegos == 40


def test_reparte_por_hora(tmp_path):
    """Una vuelta puede cruzar la hora en punto, y cada lado va a su cubo."""
    r = RelojFalso(1_700_000_000_000, t(10, 58))
    b = Bitacora(str(tmp_path), r)
    b.empezar_vuelta()
    for m in (58, 59):
        r.poner(t(10, m))
        hora, reloj = b.vistazo()
        b.pasada("cc" * 32, hora, reloj)
    for m in (0, 1, 2):
        r.poner(t(11, m))
        hora, reloj = b.vistazo()
        b.pasada("cc" * 32, hora, reloj)
    v = b.de_la_vuelta()
    assert v["horas"] == [{"hora": 10, "vistazos": 2}, {"hora": 11, "vistazos": 3}]
    porhora = {p["hora"]: p["n"] for p in v["pasadas"]}
    assert porhora == {10: 2, 11: 3}


def test_el_dia_se_cierra_con_su_total(tmp_path):
    """Al cambiar el dia queda un resumen con el total del equipo.

    Ese total es la suma de comprobacion del servidor: lo que no cuadre con lo
    que fue llegando son reportes perdidos.
    """
    r = RelojFalso(1_700_000_000_000, t(22, 0))
    b = Bitacora(str(tmp_path), r)
    b.empezar_vuelta()
    for i in range(5):
        r.poner(t(22, i))
        b.vistazo()
    b.de_la_vuelta()
    dia1 = b.dia

    # Al dia siguiente, por la manana.
    r.poner(t(8, 0), avanzar_ms=10 * 3600 * 1000)
    b.empezar_vuelta()
    c = b.tomar_cierre()
    assert c is not None
    assert c["dia"] == dia1
    assert c["vistazos"] == 5
    assert c["vueltas"] == 1
    assert c["primera"] == "22:00:00" and c["ultima"] == "22:04:00"
    # Una sola vez.
    assert b.tomar_cierre() is None
    # Y el dia nuevo empieza de cero.
    assert b.dia != dia1 and b.vistazos == 0


def test_el_cierre_devuelto_no_se_pierde(tmp_path):
    """Si el reporte no salio, el cierre espera al siguiente: es uno al dia."""
    r = RelojFalso(1_700_000_000_000, t(23, 0))
    b = Bitacora(str(tmp_path), r)
    b.empezar_vuelta()
    b.vistazo()
    b.de_la_vuelta()
    r.poner(t(7, 0), avanzar_ms=8 * 3600 * 1000)
    b.empezar_vuelta()
    c = b.tomar_cierre()
    b.devolver_cierre(c)
    assert b.tomar_cierre() == c
    # Y sobrevive al reinicio.
    b.devolver_cierre(c)
    assert Bitacora(str(tmp_path), r).tomar_cierre() == c


def test_sobrevive_al_reinicio(tmp_path):
    """Un reinicio a media tarde no puede hacer que el cierre reporte de menos.

    Sin esto el servidor anotaria huecos que no existieron, que es peor que no
    anotar nada: un reporte que acusa a la red de algo que hizo un reinicio.
    """
    r = RelojFalso(1_700_000_000_000, t(14, 0))
    b = Bitacora(str(tmp_path), r)
    b.empezar_vuelta()
    for i in range(7):
        r.poner(t(14, i))
        b.vistazo()
    b.de_la_vuelta()

    otra = Bitacora(str(tmp_path), r)
    assert otra.vistazos == 7 and otra.vueltas == 1
    otra.empezar_vuelta()
    r.poner(t(15, 0))
    otra.vistazo()
    otra.de_la_vuelta()
    assert otra.vistazos == 8

    r.poner(t(9, 0), avanzar_ms=20 * 3600 * 1000)
    otra.empezar_vuelta()
    assert otra.tomar_cierre()["vistazos"] == 8


def test_la_fecha_es_la_del_sitio_no_la_del_sistema(tmp_path):
    """A las 23:30 en Mexico la Raspberry en UTC ya esta en el dia siguiente.

    Es el mismo error que llenaba AUTOPISTA de «pantalla apagada» de madrugada.
    Aqui habria puesto la bitacora de esa noche en el dia equivocado.
    """
    # Sistema: 05:30 del 2 de enero (UTC). Sitio: 23:30 del 1 de enero.
    ms = int(datetime.datetime(2027, 1, 2, 5, 30).timestamp() * 1000)
    r = RelojFalso(ms, t(23, 30))
    b = Bitacora(str(tmp_path), r)
    b.empezar_vuelta()
    b.vistazo()
    assert b.de_la_vuelta()["dia"] == "2027-01-01"


def test_una_vuelta_sin_miradas_no_manda_nada(tmp_path):
    """Nada que contar, nada que mandar: el latido no se engorda por costumbre."""
    r = RelojFalso(1_700_000_000_000, t(4, 0))
    b = Bitacora(str(tmp_path), r)
    b.empezar_vuelta()
    b.ciego()
    assert b.de_la_vuelta() is None


def test_lo_que_se_guarda_es_json_valido(tmp_path):
    r = RelojFalso(1_700_000_000_000, t(12, 0))
    b = Bitacora(str(tmp_path), r)
    b.empezar_vuelta()
    b.vistazo()
    b.de_la_vuelta()
    with open(os.path.join(str(tmp_path), "bitacora.json"), encoding="utf-8") as f:
        j = json.load(f)
    assert j["vistazos"] == 1 and j["dia"] == b.dia
