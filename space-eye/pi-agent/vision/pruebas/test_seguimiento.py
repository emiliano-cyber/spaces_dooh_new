# Port de SeguimientoTest.kt, caso por caso.
import json

from salud_analisis import Pantalla, Resultado, Zona
from seguimiento import Camara, Observacion, Seguimiento, clave_del_servidor

HORA = 60 * 60_000
SANA = [[1.0] * 6 for _ in range(4)]
GABINETE = Zona("zona_apagada", 1, 2, 0.9)


def vuelta(*zonas, pantalla=Pantalla.OK, camara=Camara.OK, actividad=SANA):
    return Observacion(Resultado(pantalla, 18, 12, list(zonas), actividad, SANA), camara, 4, 6)


def test_una_sola_vuelta_no_alarma_dos_seguidas_si():
    s = Seguimiento()
    assert s.registrar(0, vuelta(GABINETE), False) == []
    e = s.registrar(HORA, vuelta(GABINETE), False)
    assert len(e) == 1
    assert e[0].accion == "abrir"
    assert e[0].clave == "zona_apagada:1:2"
    assert e[0].fila == 1


def test_dos_vueltas_muy_juntas_cuentan_como_una():
    s = Seguimiento()
    s.registrar(0, vuelta(GABINETE), False)
    assert s.registrar(10 * 60_000, vuelta(GABINETE), False) == []


def test_con_el_intervalo_de_pruebas_de_5_minutos_alarma_a_la_segunda_vuelta():
    s = Seguimiento()
    s.separacion_ms = 4 * 60_000          # lo que pone el Monitor con 5 min
    cinco = 5 * 60_000
    assert s.registrar(0, vuelta(GABINETE), False) == []
    assert len(s.registrar(cinco, vuelta(GABINETE), False)) == 1


def test_varios_gabinetes_son_una_alerta_y_se_recuperan_juntos():
    s = Seguimiento()
    mitad = Zona("zona_apagada", -1, -1, 0.9, ((0, 0), (0, 1), (1, 0), (1, 1)))
    s.registrar(0, vuelta(mitad), False)
    (e,) = s.registrar(HORA, vuelta(mitad), False)
    assert e.clave == "zona_apagada:varias"
    assert len(e.zonas) == 4
    assert e.fila is None
    s.confirmada(e.clave, 9)
    s.registrar(2 * HORA, vuelta(), False)
    (r,) = s.registrar(3 * HORA, vuelta(), False)
    assert r.accion == "recuperar"
    assert r.falla_id == 9


def test_una_alerta_agrupada_abierta_en_el_servidor_no_tumba_la_vuelta_y_se_cierra_sola():
    # El caso real del 28-sep: el servidor tiene abierto "varios gabinetes
    # apagados" (sin fila ni columna) y el equipo lo recibe en su configuracion.
    s = Seguimiento()
    s.sincronizar({clave_del_servidor("zona_apagada", None, None): 12})
    s.registrar(0, vuelta(), False)
    (r,) = s.registrar(HORA, vuelta(), False)
    assert r.accion == "recuperar"
    assert r.falla_id == 12


def test_una_clave_rara_no_tumba_la_vuelta():
    s = Seguimiento()
    s.sincronizar({"zona_apagada": 3, "zona_congelada:x": 4})
    s.registrar(0, vuelta(), False)
    s.registrar(HORA, vuelta(), False)


def test_una_vuelta_sana_en_medio_reinicia_la_cuenta():
    s = Seguimiento()
    s.registrar(0, vuelta(GABINETE), False)
    s.registrar(HORA, vuelta(), False)
    assert s.registrar(2 * HORA, vuelta(GABINETE), False) == []


def test_una_vuelta_inconclusa_no_reinicia():
    s = Seguimiento()
    s.registrar(0, vuelta(GABINETE), False)
    s.registrar(HORA, vuelta(pantalla=Pantalla.INCONCLUSO), False)
    assert len(s.registrar(2 * HORA, vuelta(GABINETE), False)) == 1


def test_no_repite_y_registra_la_recuperacion():
    s = Seguimiento()
    s.registrar(0, vuelta(GABINETE), False)
    (abierta,) = s.registrar(HORA, vuelta(GABINETE), False)
    s.confirmada(abierta.clave, 77)
    assert s.registrar(2 * HORA, vuelta(GABINETE), False) == []
    assert s.registrar(3 * HORA, vuelta(), False) == []
    (r,) = s.registrar(4 * HORA, vuelta(), False)
    assert r.accion == "recuperar"
    assert r.falla_id == 77


def test_confianza_baja_no_alarma():
    s = Seguimiento()
    dudosa = Zona(GABINETE.tipo, GABINETE.fila, GABINETE.columna, 0.3)
    s.registrar(0, vuelta(dudosa), False)
    assert s.registrar(HORA, vuelta(dudosa), False) == []


def test_aprendiendo_no_avisa_y_excluye_lo_que_nunca_cambia():
    s = Seguimiento()
    # La esquina (3,5) esta tapada por una barda: nunca se mueve.
    tapada = [[0.05 if (f == 3 and c == 5) else 1.0 for c in range(6)] for f in range(4)]
    for k in range(4):
        assert s.registrar(k * HORA, vuelta(Zona("zona_congelada", 3, 5, 0.9), actividad=tapada), True) == []
    assert set(s.excluidas()) == {(3, 5)}
    # Ya fuera del aprendizaje, esa zona no cuenta como juzgable.
    s.registrar(5 * HORA, vuelta(Zona("zona_congelada", 3, 5, 0.9)), False)
    # (el analisis ya no la reportaria porque se le pasa como excluida)


def test_lo_descartado_no_vuelve_a_sonar():
    s = Seguimiento()
    s.registrar(0, vuelta(GABINETE), False, silenciadas={"zona_apagada:1:2"})
    assert s.registrar(HORA, vuelta(GABINETE), False, silenciadas={"zona_apagada:1:2"}) == []


def test_el_tope_diario_deja_la_falla_pendiente():
    s = Seguimiento()
    s.registrar(0, vuelta(GABINETE), False)
    assert s.registrar(HORA, vuelta(GABINETE), False, puede_abrir=0) == []
    assert len(s.registrar(2 * HORA, vuelta(GABINETE), False, puede_abrir=1)) == 1


def test_con_la_camara_movida_no_se_juzga_la_pantalla():
    s = Seguimiento()
    s.registrar(0, vuelta(GABINETE), False)
    s.registrar(HORA, vuelta(camara=Camara.MOVIDA), False)
    e = s.registrar(2 * HORA, vuelta(camara=Camara.MOVIDA), False)
    assert [x.tipo for x in e] == ["camara_movida"]


def test_pantalla_apagada_se_avisa_como_una():
    s = Seguimiento()
    s.registrar(0, vuelta(pantalla=Pantalla.APAGADA), False)
    e = s.registrar(HORA, vuelta(pantalla=Pantalla.APAGADA), False)
    assert [x.tipo for x in e] == ["pantalla_apagada"]
    assert e[0].fila is None


def test_sobrevive_a_un_reinicio():
    s = Seguimiento()
    s.registrar(0, vuelta(GABINETE), False)
    otra = Seguimiento()
    otra.de_json(json.loads(json.dumps(s.a_json())))
    assert len(otra.registrar(HORA, vuelta(GABINETE), False)) == 1


def test_lo_cerrado_en_el_servidor_se_olvida():
    s = Seguimiento()
    s.registrar(0, vuelta(GABINETE), False)
    (a,) = s.registrar(HORA, vuelta(GABINETE), False)
    s.confirmada(a.clave, 5)
    s.sincronizar({})   # alguien la cerro en el dashboard
    s.registrar(2 * HORA, vuelta(GABINETE), False)
    assert len(s.registrar(3 * HORA, vuelta(GABINETE), False)) == 1


def test_el_json_es_el_del_telefono():
    # Mismas claves y la misma marca de "nunca" (Long.MIN_VALUE) que aJson().
    s = Seguimiento()
    assert s.a_json() == {"candidatos": [], "abiertas": [], "celdas": [], "ultima": -(2 ** 63)}
    s.registrar(0, vuelta(GABINETE), False)
    j = s.a_json()
    assert j["candidatos"] == [{"k": "zona_apagada:1:2", "t": "zona_apagada", "f": 1, "c": 2, "n": 1, "conf": [0.9]}]
    assert j["ultima"] == 0
