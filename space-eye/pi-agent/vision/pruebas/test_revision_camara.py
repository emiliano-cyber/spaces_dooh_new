# test_revision_camara.py — La camara no se acusa sola de noche.
#
# La falla de TLALPAN (noches del 24, 25 y 26 de oct de 2026): su pantalla llena
# casi toda la foto, y cuando afuera no quedaba nada con que comparar se juzgaba
# la foto ENTERA. El anuncio cambia por definicion, asi que de noche -cuando lo
# unico que brilla es la pantalla- la escena "se movia" sola.
import numpy as np

from geometria import Geometria
from revision_camara import RevisionCamara, area_de_la_pantalla
from seguimiento import Camara


class VistazoFalso:
    def __init__(self, marco):
        self.marco = marco
        self.marco_contraste = 40.0


def geo(margen):
    """Pantalla centrada que deja `margen` (fraccion) libre a cada lado."""
    a, b = margen, 1 - margen
    return Geometria([(a, a), (b, a), (b, b), (a, b)], 2, 3, [], "06:00", "24:00")


def escena(semilla, corrimiento=0):
    """Una escena con textura (manchas) corrida `corrimiento` pixeles."""
    r = np.random.RandomState(semilla)
    m = np.zeros((240, 320), dtype=np.uint8)
    for _ in range(300):
        x, y = r.randint(8, 312), r.randint(8, 232)
        m[y - 4:y + 4, x - 4:x + 4] = r.randint(60, 255)
    return np.roll(m, corrimiento, axis=1)


def test_el_area_se_mide_como_fraccion_de_la_foto():
    assert area_de_la_pantalla(geo(0.25)) == 0.25        # la mitad de cada lado
    assert round(area_de_la_pantalla(geo(0.005)), 3) == 0.980


def test_pantalla_que_llena_la_foto_no_opina_de_la_camara(tmp_path):
    r = RevisionCamara(str(tmp_path))
    r.abrir("firma")
    g = geo(0.005)                                       # 98% de la foto: nada afuera
    # Primera vuelta: ni siquiera se guarda referencia, porque no hay de que.
    assert r.revisar([VistazoFalso(escena(1))], g) == Camara.INCONCLUSO
    # Y una escena COMPLETAMENTE distinta -la noche frente al dia- tampoco
    # acusa a la camara. Antes era aqui donde salia "camara movida".
    assert r.revisar([VistazoFalso(escena(99, corrimiento=60))], g) == Camara.INCONCLUSO


def test_con_margen_alrededor_si_se_juzga(tmp_path):
    r = RevisionCamara(str(tmp_path))
    r.abrir("firma")
    g = geo(0.3)                                         # 16% de la foto
    assert r.revisar([VistazoFalso(escena(1))], g) == Camara.OK
    assert r.revisar([VistazoFalso(escena(1))], g) == Camara.OK


def test_una_escena_que_no_se_parece_a_nada_se_aprende(tmp_path):
    # Antes la variante nueva solo se guardaba por la rama del "todo bien": una
    # escena nocturna que no coincidia con ninguna referencia no se podia
    # aprender NUNCA, y la falsa alarma se repetia cada noche.
    r = RevisionCamara(str(tmp_path))
    r.abrir("firma")
    g = geo(0.3)
    r.revisar([VistazoFalso(escena(1))], g)
    assert len(r._refs) == 1
    assert r.revisar([VistazoFalso(escena(7))], g) == Camara.INCONCLUSO
    assert len(r._refs) == 2, "la escena nueva tiene que quedarse de referencia"
