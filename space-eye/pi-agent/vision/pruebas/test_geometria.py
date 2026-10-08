# Port de GeometriaTest.kt.
import datetime
import json

import pytest

from geometria import MEDIANOCHE, Geometria, en_horario

# Las esquinas de TLALPAN, marcadas sobre una foto real (se ve en diagonal).
TLALPAN = json.loads("""{"esquinas":[[0.258,0.244],[0.928,0.193],[0.875,0.687],[0.298,0.957]],
    "filas":4,"columnas":6,"excluir":[[3,5]],"horario":{"inicio":"06:00","fin":"24:00"}}""")

T = datetime.time


def test_lee_la_configuracion():
    g = Geometria.de_json(TLALPAN)
    assert g.filas == 4
    assert g.excluir == {(3, 5)}
    assert g.inicio == T(6, 0)
    assert g.fin == MEDIANOCHE


def test_sin_esquinas_no_hay_geometria():
    assert Geometria.de_json({"filas": 4}) is None
    assert Geometria.de_json(None) is None


def test_las_esquinas_del_cuadrado_caen_en_las_de_la_foto():
    g = Geometria.de_json(TLALPAN)

    def casi(a, b):
        assert a[0] == pytest.approx(b[0], abs=1e-9)
        assert a[1] == pytest.approx(b[1], abs=1e-9)

    casi(g.esquinas[0], g.a_foto(0.0, 0.0))
    casi(g.esquinas[1], g.a_foto(1.0, 0.0))
    casi(g.esquinas[2], g.a_foto(1.0, 1.0))
    casi(g.esquinas[3], g.a_foto(0.0, 1.0))
    # El primer gabinete empieza en la esquina de arriba a la izquierda.
    casi(g.esquinas[0], g.contorno(0, 0)[0])


def test_numera_los_gabinetes_como_una_persona():
    g = Geometria.de_json(TLALPAN)
    assert g.numero(0, 0) == 1
    assert g.numero(0, 5) == 6
    assert g.numero(1, 0) == 7
    assert g.numero(3, 5) == 24


def test_horario_de_6_a_24():
    i = T(6, 0)
    f = MEDIANOCHE
    assert not en_horario(T(5, 30), i, f)
    assert not en_horario(T(6, 5), i, f)      # el reproductor apenas arranca
    assert en_horario(T(6, 15), i, f)
    assert en_horario(T(23, 45), i, f)
    assert not en_horario(T(23, 55), i, f)
    assert not en_horario(T(2, 0), i, f)


def test_horario_que_cruza_la_medianoche():
    i = T(18, 0)
    f = T(2, 0)
    assert en_horario(T(23, 0), i, f)
    assert en_horario(T(1, 0), i, f)
    assert not en_horario(T(3, 0), i, f)
    assert not en_horario(T(12, 0), i, f)
