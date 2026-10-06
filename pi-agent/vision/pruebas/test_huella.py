# Port de HuellaTest.kt.
#
# La huella tiene que ser IDENTICA en todos los agentes: el servidor compara las
# de todos con la misma regla. Las imagenes son dos fotos reales del
# espectacular de MANUEL DUBLAN (equipo 13, 23-sep-2026), el mismo creativo con
# 53 segundos de diferencia, en gris a 320x180.
import huella
from conftest import gris_crudo


def gris(nombre):
    return [float(b) for b in gris_crudo(nombre)]


def test_calcula_lo_mismo_que_la_raspberry():
    assert huella.calcular(gris("pantalla_a_320x180.gris"), 320, 180) == \
        "1d60dd00fa00fe70fe00fc44fc40f830f000f000f000f011f300e300fb00f900"
    assert huella.calcular(gris("pantalla_b_320x180.gris"), 320, 180) == \
        "1d60d900fa00fe70fe00fc44fc40f810f000f000f000f031f300e300fb00f900"


def test_el_mismo_creativo_queda_dentro_de_la_tolerancia():
    a = huella.calcular(gris("pantalla_a_320x180.gris"), 320, 180)
    b = huella.calcular(gris("pantalla_b_320x180.gris"), 320, 180)
    assert huella.distancia(a, b) == 3
    assert huella.distancia(a, b) <= huella.TOLERANCIA


def test_una_imagen_lisa_no_es_un_creativo():
    # Pantalla apagada o lente tapada: no debe gastar una foto.
    assert huella.calcular([40.0] * (320 * 180), 320, 180) is None


def test_distancia_cuenta_bits():
    assert huella.distancia("0f", "0f") == 0
    assert huella.distancia("0f", "00") == 4
    assert huella.distancia("0f", None) == huella.BITS


def test_el_camino_rapido_da_lo_mismo_que_el_lento():
    # calcular() suma los pixeles enteros con una imagen integral; con valores
    # no enteros recorre pixel por pixel como el telefono. Los dos caminos
    # tienen que dar la misma huella.
    g = gris("pantalla_a_320x180.gris")
    rapido = huella.calcular(g, 320, 180)
    lento = huella.calcular([v + 1e-9 if i == 0 else v for i, v in enumerate(g)], 320, 180)
    assert rapido == lento
