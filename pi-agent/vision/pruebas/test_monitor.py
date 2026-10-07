# Pruebas de monitor.py de punta a punta, contra un puente FALSO.
#
# El puente falso hace lo que hace src/puente.js: sirve la configuracion,
# entrega tomas (JPEG armados con las fotos reales de las pruebas de salud,
# pegadas dentro de una escena fija) y anota las alertas, los creativos y los
# resumenes que le llegan. Nada espera de verdad: el reloj es inyectado y
# "dormir" solo lo adelanta, asi una vuelta de un minuto corre en un instante.
import base64
import copy
import datetime
import json
import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2
import numpy as np
import pytest

import monitor
from conftest import VISION, gris_gz

SECRETO = "secreto-de-prueba"
ANCHO, ALTO = 960, 640
# La pantalla dentro de la foto (fracciones), como la marcaria el dashboard.
X0, X1, Y0, Y1 = 0.2, 0.8, 0.15, 0.85
ESQUINAS = [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]]
# 12:00 UTC del 5-oct-2026: dentro del horario de 6 a 24.
INICIO_MS = int(datetime.datetime(2026, 10, 5, 12, 0, tzinfo=datetime.timezone.utc).timestamp() * 1000)
MIN = 60_000


class RelojFalso(monitor.Reloj):
    def __init__(self, ms):
        self.ms = ms

    def ahora_ms(self):
        return self.ms

    def dormir(self, ms):
        self.ms += max(0, int(ms))

    def hora_local(self):
        return datetime.datetime.fromtimestamp(self.ms / 1000, tz=datetime.timezone.utc).time()


# --- La escena -------------------------------------------------------------

def _fondo():
    # Lo que rodea a la pantalla: edificios y letreros fijos (rectangulos y
    # circulos), que es con lo que la revision de la camara sabe que no se movio.
    rng = np.random.default_rng(7)
    img = np.full((ALTO, ANCHO), 110, dtype=np.uint8)
    for _ in range(160):
        x, y = int(rng.integers(0, ANCHO)), int(rng.integers(0, ALTO))
        g = int(rng.integers(0, 256))
        if rng.random() < 0.5:
            cv2.rectangle(img, (x, y), (x + int(rng.integers(10, 80)), y + int(rng.integers(10, 80))), g, -1)
        else:
            cv2.circle(img, (x, y), int(rng.integers(5, 40)), g, -1)
    return img


FONDO = _fondo()


def foto(pantalla):
    """Un JPEG de la escena con `pantalla` (gris, cualquier tamaño) dentro."""
    img = FONDO.copy()
    x0, x1, y0, y1 = int(X0 * ANCHO), int(X1 * ANCHO), int(Y0 * ALTO), int(Y1 * ALTO)
    img[y0:y1, x0:x1] = cv2.resize(pantalla.astype(np.uint8), (x1 - x0, y1 - y0), interpolation=cv2.INTER_LINEAR)
    ok, jpg = cv2.imencode(".jpg", cv2.cvtColor(img, cv2.COLOR_GRAY2BGR), [cv2.IMWRITE_JPEG_QUALITY, 92])
    assert ok
    return jpg.tobytes()


def fixture(nombre, k, w, h):
    return np.frombuffer(gris_gz("salud/%s_%02d.gris.gz" % (nombre, k))[: w * h], dtype=np.uint8).reshape(h, w)


def tlalpan(apagar=()):
    """Las 12 tomas de TLALPAN, con los gabinetes de `apagar` (cuadricula 4x6) en negro."""
    out = []
    for k in range(12):
        m = fixture("tlalpan", k, 192, 136).copy()
        for f, c in apagar:
            m[f * 136 // 4:(f + 1) * 136 // 4, c * 192 // 6:(c + 1) * 192 // 6] = 6
        out.append(foto(m))
    return out


# --- El puente falso ---------------------------------------------------------

class PuenteFalso:
    def __init__(self, config):
        self.config = config
        self.fotos = []
        self.tomas = 0
        self.sin_red = False
        self.fallas = []        # (campos, foto en bytes o None)
        self.creativos = []     # (foto, huella)
        self.logs = []
        self.resumenes = []
        self.rutas = []
        self._id = 41
        self.version = None     # la huella del ultimo reporte de estado
        self.artes = {}         # id de campana -> JPEG de referencia
        self.pruebas = []       # (foto, id de campana)
        puente = self

        class Atender(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _responder(self, estado, cuerpo=None, datos=None, tipo="application/json"):
                if datos is None:
                    datos = json.dumps(cuerpo).encode()
                self.send_response(estado)
                self.send_header("Content-Type", tipo)
                self.send_header("Content-Length", str(len(datos)))
                self.end_headers()
                self.wfile.write(datos)

            def _json(self):
                n = int(self.headers.get("Content-Length") or 0)
                return json.loads(self.rfile.read(n) or b"{}")

            def do_GET(self):
                puente.rutas.append("GET " + self.path)
                if self.headers.get("X-Puente") != SECRETO:
                    return self._responder(403, {"error": "puente"})
                if self.path == "/ocupada":
                    return self._responder(200, {"ocupada": False})
                if self.path == "/monitoreo":
                    return self._responder(200, puente.config)
                if self.path == "/version":
                    return self._responder(200, {"version": puente.version})
                if self.path.startswith("/campana/"):
                    arte = puente.artes.get(int(self.path.rsplit("/", 1)[1]))
                    if arte is None:
                        return self._responder(404, {"error": "no_es_del_equipo"})
                    return self._responder(200, datos=arte, tipo="image/jpeg")
                if self.path == "/camara/tomar":
                    if not puente.fotos:
                        return self._responder(503, {"error": "sin camara"})
                    # Las 3 tomas de un vistazo son la misma foto; el vistazo
                    # siguiente, la siguiente del loop.
                    jpeg = puente.fotos[(puente.tomas // monitor.TOMAS) % len(puente.fotos)]
                    puente.tomas += 1
                    return self._responder(200, datos=jpeg, tipo="image/jpeg")
                return self._responder(404, {"error": "ruta"})

            def do_POST(self):
                puente.rutas.append("POST " + self.path)
                if self.headers.get("X-Puente") != SECRETO:
                    return self._responder(403, {"error": "puente"})
                j = self._json()
                if self.path in ("/camara/abrir", "/camara/cerrar"):
                    return self._responder(200, {"ok": True})
                if self.path == "/falla":
                    if puente.sin_red:
                        return self._responder(502, {"error": "sin_red"})
                    campos = j["campos"]
                    puente.fallas.append((campos, base64.b64decode(j["foto"]) if j.get("foto") else None))
                    salud = puente.config["salud"]
                    if campos["evento"] == "abrir":
                        # Como el servidor: la falla queda abierta y viaja en la
                        # configuracion de las vueltas siguientes.
                        id_ = puente._id
                        puente._id += 1
                        salud.setdefault("abiertas", []).append({
                            "id": id_, "tipo": campos["tipo"],
                            "fila": int(campos["fila"]) if "fila" in campos else None,
                            "columna": int(campos["columna"]) if "columna" in campos else None})
                        return self._responder(200, {"id": id_})
                    salud["abiertas"] = [a for a in salud.get("abiertas", []) if str(a["id"]) != campos.get("falla_id")]
                    return self._responder(200, {"id": int(campos["falla_id"])})
                if self.path == "/creativo":
                    puente.creativos.append((base64.b64decode(j["foto"]), j["huella"]))
                    return self._responder(200, {"ok": True})
                if self.path == "/campana":
                    puente.pruebas.append((base64.b64decode(j["foto"]), j["campana_id"]))
                    return self._responder(200, {"ok": True})
                if self.path == "/log":
                    puente.logs.append(j)
                    return self._responder(200, {"ok": True})
                if self.path == "/resumen":
                    puente.resumenes.append(j)
                    return self._responder(200, {"ok": True})
                return self._responder(404, {"error": "ruta"})

        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), Atender)
        self.url = "http://127.0.0.1:%d" % self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def salud(self):
        return [r["salud"] for r in self.resumenes if "salud" in r]

    def cerrar(self):
        self.srv.shutdown()
        self.srv.server_close()


def configuracion(creativos=None, salud=None):
    return {
        "pantalla": {"esquinas": ESQUINAS, "filas": 4, "columnas": 6},
        "encuadre": {"camera_lens": "main", "camera_zoom": 0, "rotation": 0},
        "creativos": creativos or {"vigilar": False},
        "salud": salud or {"vigilar": False},
    }


@pytest.fixture
def entorno(tmp_path, monkeypatch):
    monkeypatch.setenv("PUENTE_SECRETO", SECRETO)
    puentes = []

    def armar(config):
        p = PuenteFalso(config)
        puentes.append(p)
        return p, RelojFalso(INICIO_MS), str(tmp_path / "pantalla")

    yield armar
    for p in puentes:
        p.cerrar()


def una_vuelta(puente, reloj, directorio, fotos):
    puente.fotos = fotos
    puente.tomas = 0
    codigo = monitor.main(["--puente", puente.url, "--dir", directorio, "--una-vuelta"], reloj=reloj)
    assert codigo == 0
    # La siguiente vuelta, 6 minutos despues (separacion con cada_min 5: 4 min).
    reloj.dormir(6 * MIN)


SALUD = {"vigilar": True, "cada_min": 5, "recorrido_seg": 60, "paso_seg": 5, "aprendizaje_min": 0,
         "confirmaciones": 2, "umbral": 0.6, "restantes_hoy": 6, "abiertas": [], "silenciadas": [],
         "desde": "2026-10-01"}


# --- Fallas ------------------------------------------------------------------

def test_aprende_abre_el_gabinete_apagado_y_lo_recupera(entorno):
    puente, reloj, d = entorno(configuracion(salud=copy.deepcopy(SALUD)))
    sanas = tlalpan()
    apagado = tlalpan(apagar=[(1, 2)])

    # 1. La primera vuelta solo aprende, aunque el aprendizaje configurado sea 0.
    una_vuelta(puente, reloj, d, sanas)
    s = puente.salud()[-1]
    assert s["aprendiendo"] is True
    assert s["pantalla"] == "OK" and s["camara"] == "OK"
    assert s["vistazos"] == 12 and s["vistazos_usados"] == 12
    assert s["camara_permitida"] is True
    assert puente.fallas == []
    assert "POST /camara/abrir" in puente.rutas and "POST /camara/cerrar" in puente.rutas

    # 2. El gabinete 9 (fila 1, columna 2) se apaga: la primera vez solo es candidato.
    una_vuelta(puente, reloj, d, apagado)
    s = puente.salud()[-1]
    assert s["aprendiendo"] is False
    assert ["zona_apagada", 1, 2] == s["zonas"][0][:3]
    assert puente.fallas == []

    # 3. Sigue apagado en una vuelta separada: se abre la alerta, con evidencia.
    una_vuelta(puente, reloj, d, apagado)
    assert len(puente.fallas) == 1
    campos, evidencia = puente.fallas[0]
    assert campos["evento"] == "abrir"
    assert campos["tipo"] == "zona_apagada"
    assert (campos["fila"], campos["columna"]) == ("1", "2")
    assert float(campos["confianza"]) >= 0.6
    assert campos["detectada_en"].endswith("Z")
    detalle = json.loads(campos["detalle"])
    assert detalle["texto"] == "Posible gabinete apagado · Gabinete 9 (fila 2, columna 3)"
    assert detalle["camara"] == "OK" and detalle["vistazos"] == 12
    assert cv2.imdecode(np.frombuffer(evidencia, np.uint8), cv2.IMREAD_COLOR) is not None
    assert os.listdir(os.path.join(d, "evidencia"))
    with open(os.path.join(d, "bitacora.jsonl"), encoding="utf-8") as f:
        assert json.loads(f.readline())["evento"] == "abrir"

    # 4. Se arreglo: la primera vuelta sana no basta para cerrarla...
    una_vuelta(puente, reloj, d, sanas)
    assert len(puente.fallas) == 1

    # 5. ...la segunda si, y se avisa con el numero que dio el servidor.
    una_vuelta(puente, reloj, d, sanas)
    assert len(puente.fallas) == 2
    campos, evidencia = puente.fallas[1]
    assert campos["evento"] == "recuperar"
    assert campos["falla_id"] == "41"
    assert json.loads(campos["detalle"])["texto"].startswith("Recuperado: ")
    assert evidencia
    assert puente.config["salud"]["abiertas"] == []

    # Lo aprendido quedo bajo --dir con el mismo JSON que el telefono.
    with open(os.path.join(d, "seguimiento.json"), encoding="utf-8") as f:
        estado = json.load(f)
    assert set(estado) == {"firma", "desde", "vueltas", "estado"}
    assert set(estado["estado"]) == {"candidatos", "abiertas", "celdas", "ultima"}


def test_sin_red_la_alerta_se_encola_y_sale_en_la_vuelta_siguiente(entorno):
    puente, reloj, d = entorno(configuracion(salud=copy.deepcopy(SALUD)))
    apagado = tlalpan(apagar=[(1, 2)])
    una_vuelta(puente, reloj, d, tlalpan())
    una_vuelta(puente, reloj, d, apagado)
    puente.sin_red = True
    una_vuelta(puente, reloj, d, apagado)
    assert puente.fallas == []
    with open(os.path.join(d, "pendientes.json"), encoding="utf-8") as f:
        (pendiente,) = json.load(f)
    assert pendiente["clave"] == "zona_apagada:1:2" and pendiente["evidencia"]

    puente.sin_red = False
    una_vuelta(puente, reloj, d, apagado)
    assert [c["evento"] for c, _ in puente.fallas] == ["abrir"]
    assert puente.fallas[0][1]          # salio con su evidencia guardada
    assert not os.path.exists(os.path.join(d, "pendientes.json"))


def test_varios_gabinetes_apagados_son_una_sola_alerta(entorno):
    puente, reloj, d = entorno(configuracion(salud=copy.deepcopy(SALUD)))
    muertos = [(0, 0), (0, 1), (1, 0), (1, 1)]
    apagado = tlalpan(apagar=muertos)
    una_vuelta(puente, reloj, d, tlalpan())
    una_vuelta(puente, reloj, d, apagado)
    una_vuelta(puente, reloj, d, apagado)
    (campos, _), = puente.fallas
    assert campos["tipo"] == "zona_apagada" and "fila" not in campos
    detalle = json.loads(campos["detalle"])
    assert detalle["gabinetes"] == [1, 2, 7, 8]
    assert detalle["total"] == 24
    assert detalle["texto"] == "Varios gabinetes apagados · Gabinetes 1, 2, 7, 8 (4 de 24)"


# --- Creativos ---------------------------------------------------------------

def test_un_creativo_nuevo_confirmado_dos_veces_se_sube(entorno):
    creativos = {"vigilar": True, "cada_min": 360, "recorrido_seg": 30, "paso_seg": 5, "aprendizaje_min": 0,
                 "restantes_hoy": 4, "desde": "2026-10-01"}
    puente, reloj, d = entorno(configuracion(creativos=creativos))
    a = [foto(fixture("tlalpan", 0, 192, 136))]
    b = [foto(fixture("dublan", 3, 192, 155))]

    # Primera vuelta: aprende el anuncio A sin gastar foto.
    una_vuelta(puente, reloj, d, a)
    assert puente.creativos == []
    (r1,) = [r["creativos"] for r in puente.resumenes if "creativos" in r]
    assert len(r1["nuevas"]) == 1
    assert any("aprendiendo" in l["texto"] for l in puente.logs if l["etiqueta"] == "creative")

    # Segunda: A sigue siendo conocido (no se vuelve a subir)...
    una_vuelta(puente, reloj, d, a)
    assert puente.creativos == []
    r2 = [r["creativos"] for r in puente.resumenes if "creativos" in r][-1]
    assert r2 == {"vistas": r1["nuevas"], "nuevas": []}

    # ...y aparece B: se mira dos veces y se sube UNA foto, con su huella.
    una_vuelta(puente, reloj, d, b)
    assert len(puente.creativos) == 1
    jpeg, h = puente.creativos[0]
    assert len(h) == 64 and int(h, 16) >= 0
    assert cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR) is not None
    r3 = [r["creativos"] for r in puente.resumenes if "creativos" in r][-1]
    assert r3["nuevas"] == [h]
    with open(os.path.join(d, "creativos", "catalogo.json"), encoding="utf-8") as f:
        catalogo = json.load(f)
    assert len(catalogo["creativos"]) == 2 and catalogo["vueltas"] == 3


# --- La entrada del programa -------------------------------------------------

def _correr(args, env_extra=None, timeout=120):
    env = dict(os.environ)
    env.update(env_extra or {})
    return subprocess.run([sys.executable, os.path.join(VISION, "monitor.py")] + args,
                          capture_output=True, text=True, env=env, timeout=timeout)


def test_version_es_la_prueba_de_vida():
    r = _correr(["--version"])
    assert r.returncode == 0
    assert "opencv 4." in r.stdout


def test_sin_opencv_sale_con_3(tmp_path):
    # Un cv2 que no carga, como en una Pi sin python3-opencv.
    (tmp_path / "cv2.py").write_text("raise ImportError('sin opencv')\n")
    env = {"PYTHONPATH": str(tmp_path), "PUENTE_SECRETO": SECRETO}
    assert _correr(["--version"], env).returncode == 3
    r = _correr(["--puente", "http://127.0.0.1:9", "--dir", str(tmp_path / "p")], env)
    assert r.returncode == 3
    assert "python3-opencv" in r.stderr


def test_una_vuelta_como_proceso_habla_con_el_puente_y_termina(tmp_path):
    # Con la vigilancia apagada en el servidor no hay recorrido: solo se
    # comprueba que el proceso de verdad usa el secreto, pide la configuracion
    # y termina con 0.
    puente = PuenteFalso(configuracion())
    try:
        r = _correr(["--puente", puente.url, "--dir", str(tmp_path / "p"), "--una-vuelta"],
                    {"PUENTE_SECRETO": SECRETO})
        assert r.returncode == 0, r.stderr
        # Primero la huella de la configuracion (la da el ultimo reporte de estado).
        assert puente.rutas == ["GET /version", "GET /monitoreo"]
        sin_secreto = {k: v for k, v in os.environ.items() if k != "PUENTE_SECRETO"}
        r = subprocess.run([sys.executable, os.path.join(VISION, "monitor.py"), "--puente", puente.url,
                            "--dir", str(tmp_path / "p"), "--una-vuelta"],
                           capture_output=True, text=True, env=sin_secreto, timeout=60)
        assert r.returncode == 2
    finally:
        puente.cerrar()


def test_dos_creativos_nuevos_en_una_vuelta_usan_el_tope_entero(entorno):
    # Monitor.kt comparaba `fotos < restantes` mientras cada foto sumaba a una y
    # restaba a la otra: con tope 2, la segunda nunca salia. Aqui salen las dos.
    creativos = {"vigilar": True, "cada_min": 360, "recorrido_seg": 40, "paso_seg": 5, "aprendizaje_min": 0,
                 "restantes_hoy": 2, "desde": "2026-10-01"}
    puente, reloj, d = entorno(configuracion(creativos=creativos))
    a = foto(fixture("tlalpan", 0, 192, 136))
    b = foto(fixture("dublan", 3, 192, 155))
    c = foto(fixture("dublan", 0, 192, 155))
    una_vuelta(puente, reloj, d, [a])              # aprende A, sin foto
    una_vuelta(puente, reloj, d, [b, b, c, c])     # B y C nuevos, cada uno mirado dos veces
    assert len(puente.creativos) == 2
    assert len({h for _, h in puente.creativos}) == 2
