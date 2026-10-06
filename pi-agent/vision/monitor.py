#!/usr/bin/env python3
# monitor.py — La vuelta de vigilancia: mira la pantalla, reconoce creativos y busca fallas.
#
# REQUISITOS: solo python3, python3-opencv y python3-numpy de apt (Debian 13
# trixie: OpenCV 4.10, numpy 2.x). Nada de pip: vienen compilados para la Pi y
# se actualizan con el sistema. La red usa urllib de la biblioteca estandar.
#
# Port de android/.../pantalla/Monitor.kt (APK 0.15.x). Lo arranca el agente de
# Node (src/puente.js):
#
#     python3 vision/monitor.py --puente http://127.0.0.1:<puerto> --dir <estado>/pantalla
#
# con el secreto del puente en la variable PUENTE_SECRETO (va en la cabecera
# X-Puente). Python NO abre la camara ni habla con el servidor: todo lo pide al
# puente (contrato en vision/PUENTE.md).
#
#   --una-vuelta   hace UN recorrido sin esperar a que toque y termina (pruebas y
#                  diagnostico a distancia). Respeta el horario de la pantalla:
#                  fuera de el una pantalla apagada es lo normal y juzgarla
#                  abriria alertas falsas.
#   --version      imprime la version y sale con 0 solo si OpenCV y numpy cargan
#                  (es la "prueba de vida" de una actualizacion).
#
# Codigos de salida: 0 bien; 2 mal invocado (falta el puente o el secreto);
# 3 falta python3-opencv o python3-numpy: el guardian espera una hora en vez de
# relanzarlo cada 30 s.
#
# Todo lo guardado vive bajo --dir (el filesDir/pantalla del telefono): el
# estado de Seguimiento, las referencias de la camara, la cola de alertas, la
# evidencia y la bitacora. El catalogo de creativos (filesDir/creativos en el
# telefono) queda en --dir/creativos, para que nada quede fuera de --dir.
import sys

VERSION = "0.15.0-pi.1"

try:
    import cv2  # noqa: F401
    import numpy as np  # noqa: F401
except Exception as _e:  # pragma: no cover - se prueba en un subproceso
    if __name__ == "__main__":
        print("error monitor: falta python3-opencv o python3-numpy (%s); la vigilancia no puede correr" % _e,
              file=sys.stderr, flush=True)
        sys.exit(3)
    raise

import argparse
import base64
import datetime
import json
import os
import signal
import time
import urllib.error
import urllib.request

import enderezador
import huella
import salud_analisis
import vision
from evidencia import Evidencia
from geometria import Geometria
from json_util import opt_arr, opt_bool, opt_double, opt_int, opt_long, opt_obj, opt_str, redondea
from reconocedor import Reconocedor
from reconocedor import UMBRAL as UMBRAL_CREATIVO
from revision_camara import RevisionCamara
from salud_analisis import Pantalla
from seguimiento import Camara, Observacion, Seguimiento, clave_del_servidor, clave_grupo

REINTENTO_MIN = 15
APAGADO_MIN = 60
# Tomas que se promedian por vistazo.
TOMAS = 3
# Segunda mirada a un creativo desconocido (dura ~20 s en pantalla).
CONFIRMAR_MS = 4_000
# Modo CONTINUO (creativos cada_min = 0): las vueltas se encadenan todo el dia
# dentro del horario. La configuracion se vuelve a pedir cada tanto y no en
# cada vuelta, y el resumen al registro remoto se agrupa: asi mirar sin parar NO
# cuesta mas datos que mirar cada 6 horas.
CONFIG_CONTINUO_MS = 15 * 60_000
LOG_CONTINUO_MS = 60 * 60_000
PAUSA_CONTINUO_MS = 5_000
# Long.MAX_VALUE del telefono, para los "no toca" del calculo de esperas.
SIN_LIMITE = 2 ** 63 - 1

# Lo que contesta el puente cuando el servidor rechazo una alerta (4xx).
FALLA_RECHAZADA = -1

NOMBRES = {
    "zona_apagada": "Posible gabinete apagado",
    "zona_congelada": "Posible gabinete congelado o tapado",
    "pantalla_apagada": "Pantalla apagada en horario",
    "pantalla_congelada": "Pantalla congelada (no cambia el contenido)",
    "camara_movida": "La cámara se movió: hay que volver a marcar la pantalla",
    "sin_imagen": "Sin imagen: lente tapada, o pantalla apagada de noche",
}


def log_local(nivel, etiqueta, texto):
    """Una linea por evento en stderr; el guardian de Node la pasa a su bitacora."""
    print("%s %s: %s" % (nivel, etiqueta, texto), file=sys.stderr, flush=True)


# --- El reloj: inyectable para que las pruebas no esperen de verdad ----------

class Reloj:
    def ahora_ms(self):
        return int(time.time() * 1000)

    def dormir(self, ms):
        if ms > 0:
            time.sleep(ms / 1000.0)

    def hora_local(self):
        return datetime.datetime.now().time()

    def instante(self):
        """Como Instant.now().toString() de Java: UTC con milisegundos y Z."""
        ms = self.ahora_ms()
        t = datetime.datetime.fromtimestamp(ms / 1000.0, tz=datetime.timezone.utc)
        return t.strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (ms % 1000)


# --- El puente con Node -------------------------------------------------------

class Puente:
    """Las peticiones HTTP al agente de Node. Todo pasa por aqui."""

    def __init__(self, url, secreto):
        self.url = url.rstrip("/")
        self.secreto = secreto

    def pedir(self, metodo, ruta, cuerpo=None, timeout=30.0):
        """(estado HTTP, bytes). Estado None si el puente no contesto."""
        datos = None
        cabeceras = {"X-Puente": self.secreto}
        if cuerpo is not None:
            datos = json.dumps(cuerpo, separators=(",", ":")).encode("utf-8")
            cabeceras["Content-Type"] = "application/json"
        req = urllib.request.Request(self.url + ruta, data=datos, headers=cabeceras, method=metodo)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            try:
                return e.code, e.read()
            except Exception:
                return e.code, b""
        except Exception:
            return None, b""

    def pedir_json(self, metodo, ruta, cuerpo=None, timeout=30.0):
        estado, datos = self.pedir(metodo, ruta, cuerpo, timeout)
        if estado is None:
            return None, None
        try:
            return estado, json.loads(datos.decode("utf-8")) if datos else None
        except Exception:
            return estado, None


class CamaraPuente:
    """
    Lo que la vigilancia necesita de la camara (CamaraParaVigilar del
    telefono). Node es el dueño de la camara: con un solo sensor, la foto pedida
    y la vista en vivo mandan, y la vigilancia se aparta.
    """

    def __init__(self, puente):
        self._p = puente

    def ocupada(self):
        """Hay una foto o una vista en vivo en curso: no se puede mirar. Si el
        puente no contesta, se toma como ocupada: no se mira a ciegas."""
        estado, j = self._p.pedir_json("GET", "/ocupada")
        if estado != 200 or not isinstance(j, dict):
            return True
        return bool(j.get("ocupada"))

    def abrir(self, lente, zoom):
        estado, j = self._p.pedir_json("POST", "/camara/abrir", {"lente": lente, "zoom": zoom}, timeout=60.0)
        return estado == 200 and isinstance(j, dict) and bool(j.get("ok"))

    def tomar(self):
        """Un JPEG tal como sale del sensor (sin girar), o None."""
        # Una toma en la Pi puede tardar varios segundos, y mas si espera a que
        # termine una foto pedida.
        estado, datos = self._p.pedir("GET", "/camara/tomar", timeout=90.0)
        return datos if estado == 200 and datos else None

    def enderezar(self, jpeg, grados):
        """Gira el JPEG como las demas fotos del sitio, para subirlo."""
        return enderezador.enderezar_jpeg(jpeg, grados)

    def cerrar(self):
        self._p.pedir_json("POST", "/camara/cerrar", {})


class ApiPuente:
    """Lo que del servidor necesita la vigilancia, a traves de Node."""

    def __init__(self, puente):
        self._p = puente

    def monitoreo(self):
        estado, j = self._p.pedir_json("GET", "/monitoreo")
        return j if estado == 200 and isinstance(j, dict) else None

    def reportar_falla(self, campos, foto):
        """
        El numero de la falla, None si hay que reintentar (sin red, el servidor
        caido) o FALLA_RECHAZADA si el servidor la rechazo y reenviarla no la va a
        arreglar (tope del dia, datos invalidos).
        """
        cuerpo = {"campos": campos, "foto": base64.b64encode(foto).decode("ascii") if foto is not None else None}
        estado, j = self._p.pedir_json("POST", "/falla", cuerpo, timeout=180.0)
        if estado != 200 or not isinstance(j, dict):
            return None
        if j.get("rechazada"):
            return FALLA_RECHAZADA
        id_ = opt_long(j, "id", 0)
        return id_ if id_ > 0 else None

    def subir_creativo(self, jpeg, huella_):
        cuerpo = {"foto": base64.b64encode(jpeg).decode("ascii"), "huella": huella_}
        estado, j = self._p.pedir_json("POST", "/creativo", cuerpo, timeout=180.0)
        return estado == 200 and isinstance(j, dict) and bool(j.get("ok"))

    def log(self, nivel, etiqueta, texto):
        """RemoteLog del telefono: al registro del servidor y a stderr."""
        log_local(nivel, etiqueta, texto)
        self._p.pedir_json("POST", "/log", {"nivel": nivel, "etiqueta": etiqueta, "texto": texto})

    def resumen(self, p):
        """Lo pega Node al proximo reporte de estado (creativos se unen, de salud
        vale el mas reciente: la misma regla de Monitor.devolver)."""
        self._p.pedir_json("POST", "/resumen", p)


# --- El monitor -------------------------------------------------------------

class Monitor:
    """
    UNA sola vuelta de camara sirve a las dos vigilancias:

      - CREATIVOS: reconoce que anuncio hay (Reconocedor) y fotografia solo lo
        nuevo.
      - FALLAS: al terminar la vuelta, SaludAnalisis busca lo que no cambio
        cuando todo lo demas si; RevisionCamara comprueba antes que la camara no
        se haya movido; Seguimiento decide si eso merece una alerta.

    Camara -> analisis local -> solo si algo cambia de estado -> alerta + evidencia.
    En una vuelta normal lo unico que sale es un resumen de unos cientos de
    bytes, pegado al reporte de estado que Node ya manda.

    Solo se vigila dentro del HORARIO de la pantalla (por omision de 6 a 24).
    """

    def __init__(self, directorio, api, camara, reloj=None):
        self.reloj = reloj or Reloj()
        self.api = api
        self.camara = camara
        self.dir = directorio
        os.makedirs(self.dir, exist_ok=True)
        ahora = self.reloj.ahora_ms
        self.reconocedor = Reconocedor(os.path.join(self.dir, "creativos"), ahora)
        self.revision = RevisionCamara(self.dir)
        self.evidencia = Evidencia(self.dir, ahora)
        self.seguimiento = Seguimiento(ahora_ms=ahora)
        self.estado_archivo = os.path.join(self.dir, "seguimiento.json")
        self.pendientes_archivo = os.path.join(self.dir, "pendientes.json")
        self.firma_seguimiento = ""
        self.desde_seguimiento = 0
        # Vueltas en que la pantalla se vio funcionando desde que se empezo a
        # aprender. La primera siempre es de aprendizaje.
        self.vueltas_salud = 0

        self.ultima_creativos = 0
        self.ultima_salud = 0

        # Modo continuo: ultima configuracion recibida, y el resumen acumulado
        # que se manda al registro remoto una vez por hora (o si hay algo nuevo).
        self.config = None
        self.config_en = 0
        self.acum_vistazos = 0
        self.acum_conocidos = set()
        self.ultimo_log_creativos = 0
        self.aviso_sin_pantalla = False

    # --- Arranque ---------------------------------------------------------

    def cargar_estado(self):
        try:
            if os.path.exists(self.estado_archivo):
                with open(self.estado_archivo, encoding="utf-8") as f:
                    j = json.load(f)
                self.firma_seguimiento = opt_str(j, "firma")
                self.desde_seguimiento = opt_long(j, "desde", 0)
                self.vueltas_salud = opt_int(j, "vueltas", 0)
                e = opt_obj(j, "estado")
                if e is not None:
                    self.seguimiento.de_json(e)
        except Exception:
            pass

    def correr(self):
        """Bucle de fondo. No termina nunca: la configuracion puede cambiar."""
        self.cargar_estado()
        while True:
            espera = REINTENTO_MIN * 60_000
            try:
                espera = self.vuelta()
            except Exception as e:
                log_local("error", "monitor", "vuelta fallo: %r" % e)
                self.api.log("warn", "monitor", "La vigilancia de la pantalla fallo: %s" % e)
            self.reloj.dormir(espera)

    def una_vuelta(self):
        """Un solo recorrido, sin mirar si ya toca por el intervalo."""
        self.cargar_estado()
        return self.vuelta(forzar=True)

    # --- La configuracion --------------------------------------------------

    def configuracion(self):
        """
        La configuracion del servidor. En modo continuo se reutiliza la ultima si
        es reciente, salvo que toque revisar fallas (esas necesitan saber que
        alertas estan abiertas).
        """
        c = self.config
        ahora = self.reloj.ahora_ms()
        cc = opt_obj(c, "creativos")
        continuo = cc is not None and opt_bool(cc, "vigilar") and opt_long(cc, "cada_min", 360) == 0
        sc = opt_obj(c, "salud")
        salud_pronto = sc is not None and opt_bool(sc, "vigilar") and \
            ahora - self.ultima_salud >= max(opt_long(sc, "cada_min", 60), 5) * 60_000 - 30_000
        if c is not None and continuo and not salud_pronto and ahora - self.config_en < CONFIG_CONTINUO_MS:
            return c
        nueva = self.api.monitoreo()
        if nueva is None:
            return None
        self.config = nueva
        self.config_en = ahora
        return nueva

    # --- La vuelta ---------------------------------------------------------

    def vuelta(self, forzar=False):
        """Una vuelta si toca. Devuelve cuanto esperar a la siguiente (ms).
        forzar: hace el recorrido aunque el intervalo no lo pida (--una-vuelta)."""
        r = self.configuracion()
        if r is None:
            return REINTENTO_MIN * 60_000
        c_cfg = opt_obj(r, "creativos")
        s_cfg = opt_obj(r, "salud")
        quiere_creativos = opt_bool(c_cfg, "vigilar")
        quiere_salud = opt_bool(s_cfg, "vigilar")
        if not quiere_creativos and not quiere_salud:
            return APAGADO_MIN * 60_000

        # cada_min = 0 en creativos es el modo continuo.
        continuo = quiere_creativos and opt_long(c_cfg, "cada_min", 360) == 0
        cada_c = 0 if continuo else max(opt_long(c_cfg, "cada_min", 360) if c_cfg is not None else 360, 30)
        # 5 y 15 min son intervalos de PRUEBAS; en produccion, 30 min o mas.
        cada_s = max(opt_long(s_cfg, "cada_min", 60) if s_cfg is not None else 60, 5)
        self.seguimiento.separacion_ms = min(25 * 60_000, cada_s * 60_000 * 8 // 10)
        if s_cfg is not None:
            self.seguimiento.confirmaciones = min(max(opt_int(s_cfg, "confirmaciones", 2), 1), 6)
            self.seguimiento.umbral = min(max(opt_double(s_cfg, "umbral", 0.6), 0.3), 0.95)
        if continuo:
            espera = PAUSA_CONTINUO_MS
        else:
            espera = min(cada_c if quiere_creativos else SIN_LIMITE, cada_s if quiere_salud else SIN_LIMITE) * 60_000

        geo = Geometria.de_json(opt_obj(r, "pantalla"))
        if geo is None:
            # Sin las esquinas NO se vigila: con la foto entera el fondo confunde
            # a los creativos entre si y no hay donde buscar gabinetes.
            if not self.aviso_sin_pantalla:
                self.api.log("warn", "monitor", "La vigilancia esta encendida pero falta marcar la pantalla en el "
                                                "dashboard; no se vigila hasta entonces")
            self.aviso_sin_pantalla = True
            return max(espera, REINTENTO_MIN * 60_000)
        self.aviso_sin_pantalla = False
        # Fuera de horario: se vuelve a mirar el reloj cada 10 minutos.
        if not geo.en_horario(self.reloj.hora_local()):
            log_local("info", "monitor", "fuera del horario de la pantalla: no se vigila")
            return 10 * 60_000

        ahora = self.reloj.ahora_ms()
        toca_c = quiere_creativos and (forzar or continuo or ahora - self.ultima_creativos >= cada_c * 60_000 - 60_000)
        toca_s = quiere_salud and (forzar or ahora - self.ultima_salud >= cada_s * 60_000 - 30_000)
        if not toca_c and not toca_s:
            # Se duerme justo hasta la proxima que toque. NO cada minuto: cada
            # despertar pide la configuracion, y eso si serian datos en balde.
            falta_c = self.ultima_creativos + cada_c * 60_000 - ahora if quiere_creativos else SIN_LIMITE
            falta_s = self.ultima_salud + cada_s * 60_000 - ahora if quiere_salud else SIN_LIMITE
            return min(max(min(falta_c, falta_s), 60_000), max(espera, 60_000))

        self.enviar_pendientes()
        self.recorrido(r, geo, c_cfg if toca_c else None, s_cfg if toca_s else None, continuo)
        if toca_c:
            self.ultima_creativos = ahora
        if toca_s:
            self.ultima_salud = ahora
        return espera

    def recorrido(self, r, geo, c_cfg, s_cfg, continuo=False):
        base = c_cfg if c_cfg is not None else s_cfg
        total_ms = opt_long(base, "recorrido_seg", 270) * 1000
        paso_ms = max(opt_long(base, "paso_seg", 15) * 1000, 5_000)

        encuadre = opt_obj(r, "encuadre")
        lente = opt_str(encuadre, "camera_lens", "main") if encuadre is not None else "main"
        zoom = opt_double(encuadre, "camera_zoom", 0.0) if encuadre is not None else 0.0
        giro = opt_int(encuadre, "rotation", 0) if encuadre is not None else 0
        firma_encuadre = "|".join([geo.firma(), lente, "%.3f" % zoom, str(giro)])

        # Creativos
        restantes_c = opt_int(c_cfg, "restantes_hoy", 0) if c_cfg is not None else 0
        if c_cfg is not None:
            self.reconocedor.abrir(firma_encuadre + "|" + opt_str(c_cfg, "desde"))
            aprendiendo_c = opt_bool(c_cfg, "aprendiendo") or \
                self.reconocedor.aprendiendo(opt_long(c_cfg, "aprendizaje_min", 120))
        else:
            aprendiendo_c = True
        vistas = {}            # conjunto que guarda el orden (linkedSetOf)
        nuevas = []
        candidata = None       # (huella, rasgos)
        fotos = 0
        reconocibles = 0

        vistazos = []
        # En que sesion de camara se tomo cada vistazo: cada vez que la camara se
        # reabre a mitad de vuelta la exposicion se fija a otro nivel.
        sesiones = []
        sesion = 0
        saltados = 0
        abierta = False
        try:
            fin = self.reloj.ahora_ms() + total_ms
            while self.reloj.ahora_ms() < fin:
                if self.camara.ocupada():
                    saltados += 1
                    abierta = False
                    candidata = None
                    self.reloj.dormir(paso_ms)
                    continue
                if not abierta:
                    abierta = self.camara.abrir(lente, zoom)
                    if not abierta:
                        saltados += 1
                        self.reloj.dormir(paso_ms)
                        continue
                    sesion += 1
                tomas = []
                for _ in range(TOMAS):
                    t = self.camara.tomar()
                    if t is not None:
                        tomas.append(t)
                if not tomas:
                    abierta = False
                    self.reloj.dormir(paso_ms)
                    continue
                v = enderezador.preparar(tomas, geo, giro)
                if v is None:
                    self.reloj.dormir(paso_ms)
                    continue
                espera = paso_ms

                if c_cfg is not None:
                    gris = enderezador.a_doubles(v.pantalla)
                    h = huella.calcular(gris, v.pantalla.shape[1], v.pantalla.shape[0])
                    if h is None:
                        candidata = None   # sin contraste: pantalla apagada o lente tapada
                    else:
                        reconocibles += 1
                        rasgos = vision.rasgos(v.pantalla)
                        id_, puntos = self.reconocedor.reconocer(rasgos)
                        previa = candidata
                        if id_ is not None and puntos >= UMBRAL_CREATIVO:
                            vistas[id_] = True
                            self.reconocedor.aprender_variante(id_, rasgos, puntos)
                            candidata = None
                        elif previa is not None and vision.coincidencias(previa[1], rasgos) >= UMBRAL_CREATIVO:
                            # Segunda mirada: sigue ahi. Es un creativo nuevo de verdad.
                            self.reconocedor.agregar(previa[0], previa[1], rasgos)
                            nuevas.append(previa[0])
                            # Lo que queda del tope del dia. En Monitor.kt dice
                            # `fotos < restantes` y cada foto suma a una y resta a
                            # la otra: una vuelta solo usaba la mitad del tope
                            # (3 de 5). Aqui se corrige; el telefono, en su
                            # proxima version.
                            if not aprendiendo_c and restantes_c > 0:
                                foto = self.evidencia.reducir(self.camara.enderezar(v.jpeg, giro))
                                if self.subir_creativo(foto, previa[0]):
                                    fotos += 1
                                    restantes_c -= 1
                            candidata = None
                        else:
                            candidata = (h, rasgos)
                            espera = CONFIRMAR_MS
                # Solo el ultimo vistazo de cada tramo de camara conserva su foto
                # completa (la evidencia sale del ultimo del tramo que se juzga):
                # una vuelta en continuo junta decenas de JPEG de varios MB.
                if sesiones and sesiones[-1] == sesion:
                    vistazos[-1] = vistazos[-1].sin_foto()
                vistazos.append(v)
                sesiones.append(sesion)

                queda = fin - self.reloj.ahora_ms()
                if queda <= 0:
                    break
                self.reloj.dormir(min(espera, queda))
        finally:
            self.camara.cerrar()

        if c_cfg is not None:
            if reconocibles > 0:
                self.reconocedor.termino_vuelta()
            for n in nuevas:
                vistas.pop(n, None)
            if vistas or nuevas:
                self.api.resumen({"creativos": {"vistas": list(vistas), "nuevas": list(nuevas)}})
            # Lo que queda del tope del dia, para las vueltas que reutilizan la
            # configuracion sin volver a pedirla.
            c_cfg["restantes_hoy"] = restantes_c
            if not continuo:
                self.api.log("info", "creative",
                             "Recorrido de creativos: %d vistazos, %d conocidos, %d nuevos, %d fotos; catalogo de %d"
                             % (len(vistazos), len(vistas), len(nuevas), fotos, self.reconocedor.tamano()) +
                             (" (aprendiendo: no se fotografia)" if aprendiendo_c else "") +
                             (", %d saltados por camara ocupada" % saltados if saltados > 0 else ""))
            else:
                # En continuo se agrupa: un aviso por hora, o en cuanto hay algo nuevo.
                self.acum_vistazos += len(vistazos)
                self.acum_conocidos.update(vistas)
                ahora_log = self.reloj.ahora_ms()
                if nuevas or ahora_log - self.ultimo_log_creativos >= LOG_CONTINUO_MS:
                    self.api.log("info", "creative",
                                 "Vigilancia continua: %d vistazos desde el ultimo aviso, %d creativos conocidos en "
                                 "rotacion, %d nuevos ahora (%d fotos); catalogo de %d"
                                 % (self.acum_vistazos, len(self.acum_conocidos), len(nuevas), fotos,
                                    self.reconocedor.tamano()) +
                                 (" (aprendiendo: no se fotografia)" if aprendiendo_c else ""))
                    self.acum_vistazos = 0
                    self.acum_conocidos.clear()
                    self.ultimo_log_creativos = ahora_log

        if s_cfg is not None:
            self.salud(r, s_cfg, geo, firma_encuadre, giro, vistazos, sesiones)

    def salud(self, r, cfg, geo, firma_encuadre, giro, todos, sesiones):
        # Solo el tramo mas largo con la misma exposicion (ver tramo_mas_largo).
        tramo = salud_analisis.tramo_mas_largo(sesiones)
        vistazos = [todos[i] for i in tramo]
        interrumpida = len(set(sesiones)) > 1
        # Lo aprendido vale para UN encuadre y UNA cuadricula.
        desde_servidor = opt_str(cfg, "desde")
        if self.firma_seguimiento != firma_encuadre + "|" + desde_servidor:
            self.seguimiento.reiniciar()
            self.firma_seguimiento = firma_encuadre + "|" + desde_servidor
            self.desde_seguimiento = self.reloj.ahora_ms()
            self.vueltas_salud = 0
        # "|fuera": las referencias se toman solo con lo de alrededor de la pantalla.
        self.revision.abrir(firma_encuadre + "|fuera")
        # Aprende la primera vuelta en que vea la pantalla funcionando, y ademas
        # los minutos configurados (0 = solo esa vuelta).
        aprendizaje_ms = opt_long(cfg, "aprendizaje_min", 120) * 60_000
        aprendiendo = opt_bool(cfg, "aprendiendo") or self.vueltas_salud == 0 or \
            self.reloj.ahora_ms() - self.desde_seguimiento < aprendizaje_ms

        camara_estado = self.revision.revisar(vistazos, geo)
        excluir = set(geo.excluir) | set(self.seguimiento.excluidas())
        resultado = salud_analisis.analizar([v.salud for v in vistazos], geo.filas, geo.columnas, excluir) \
            if camara_estado == Camara.OK else None

        abiertas = {}
        for o in opt_arr(cfg, "abiertas") or []:
            fila = opt_int(o, "fila", -1)
            columna = opt_int(o, "columna", -1)
            k = clave_del_servidor(o["tipo"], fila if fila >= 0 else None, columna if columna >= 0 else None)
            abiertas[k] = int(o["id"])
        self.seguimiento.sincronizar(abiertas)
        silenciadas = set()
        # El servidor nombra "zona_apagada" a secas a una agrupada; el equipo la
        # llama "zona_apagada:varias". Sin traducirla, descartar una alerta de
        # varios gabinetes no la silenciaba y volvia a abrirse con otra foto.
        for k in opt_arr(cfg, "silenciadas") or []:
            k = str(k)
            silenciadas.add(k)
            if k.startswith("zona_") and ":" not in k:
                silenciadas.add(clave_grupo(k))

        eventos = self.seguimiento.registrar(self.reloj.ahora_ms(),
                                             Observacion(resultado, camara_estado, geo.filas, geo.columnas),
                                             aprendiendo, silenciadas, opt_int(cfg, "restantes_hoy", 6))

        if resultado is not None and resultado.pantalla == Pantalla.OK:
            self.vueltas_salud += 1

        ultimo = vistazos[-1] if vistazos else None
        for e in eventos:
            zonas = [(e.fila, e.columna)] if e.fila is not None and e.columna is not None else list(e.zonas)
            grupo = bool(e.zonas) or e.clave.endswith(":varias")
            if grupo:
                nombre = "Varios gabinetes apagados" if e.tipo == "zona_apagada" else \
                    "Varios gabinetes congelados o tapados"
            else:
                nombre = NOMBRES.get(e.tipo, e.tipo)
            gabinetes = sorted(geo.numero(f, c) for f, c in e.zonas)
            if e.fila is not None and e.columna is not None:
                donde = " · Gabinete %d (fila %d, columna %d)" % (geo.numero(e.fila, e.columna), e.fila + 1,
                                                                 e.columna + 1)
            elif gabinetes:
                donde = " · Gabinetes %s (%d de %d)" % (", ".join(str(g) for g in gabinetes), len(gabinetes),
                                                        geo.filas * geo.columnas)
            else:
                donde = ""
            texto = ("Recuperado: " if e.accion == "recuperar" else "") + nombre + donde
            foto = self.evidencia.preparar(self.camara.enderezar(ultimo.jpeg, giro), geo, zonas, texto) \
                if ultimo is not None else None
            detalle = {"texto": texto, "vistazos": len(vistazos),
                       "cambios": resultado.cambios if resultado is not None else 0, "camara": camara_estado.name}
            if gabinetes:
                detalle["gabinetes"] = gabinetes
                detalle["zonas"] = [[f, c] for f, c in e.zonas]
                detalle["total"] = geo.filas * geo.columnas
            campos = {
                "evento": e.accion, "tipo": e.tipo, "confianza": repr(float(e.confianza)),
                "detectada_en": self.reloj.instante(),
                "detalle": json.dumps(detalle, ensure_ascii=False, separators=(",", ":")),
            }
            if e.fila is not None:
                campos["fila"] = str(e.fila)
            if e.columna is not None:
                campos["columna"] = str(e.columna)
            if e.falla_id is not None:
                campos["falla_id"] = str(e.falla_id)
            nombre_evidencia = "%d_%s" % (self.reloj.ahora_ms(), e.clave.replace(":", "_"))
            if foto is not None:
                self.evidencia.guardar(nombre_evidencia, foto)
            self.evidencia.anotar(campos)

            id_ = self.api.reportar_falla(campos, foto)
            if id_ == FALLA_RECHAZADA:
                # El servidor no la quiere (tope del dia...): se olvida aqui
                # tambien, o el equipo la creeria abierta para siempre.
                if e.accion == "abrir":
                    self.seguimiento.olvidar(e.clave)
            elif id_ is not None:
                if e.accion == "abrir":
                    self.seguimiento.confirmada(e.clave, id_)
                self.api.log("warn", "monitor", texto)
            else:
                self.encolar(campos, e.clave, nombre_evidencia if foto is not None else None)

        resumen = {
            "ts": self.reloj.ahora_ms(),
            "pantalla": resultado.pantalla.name if resultado is not None else "INCONCLUSO",
            "camara": camara_estado.name,
            "vistazos": len(todos),
            "vistazos_usados": len(vistazos),
            "interrumpida": interrumpida,
            "cambios": resultado.cambios if resultado is not None else 0,
            "aprendiendo": aprendiendo,
            # En la Pi nadie le niega la camara a la vigilancia.
            "camara_permitida": True,
        }
        # Lo que midio cada gabinete, relativo a uno sano (fila por fila). Son
        # unos 200 bytes; sirven para ajustar los umbrales con lo que ve la
        # camara real y no con fotos de prueba.
        if resultado is not None and resultado.actividad is not None:
            resumen["actividad"] = [[redondea(x) for x in fila] for fila in resultado.actividad]
        if resultado is not None and resultado.brillo is not None:
            resumen["brillo"] = [[redondea(x) for x in fila] for fila in resultado.brillo]
        resumen["zonas"] = [[z.tipo, z.fila, z.columna, z.confianza] for z in (resultado.zonas if resultado else [])]
        resumen["excluidas"] = [[f, c] for f, c in self.seguimiento.excluidas()]
        self.api.resumen({"salud": resumen})

        self.guardar_estado()
        log_local("info", "monitor", "salud: pantalla=%s camara=%s zonas=%s eventos=%d" % (
            resultado.pantalla.name if resultado else None, camara_estado.name,
            len(resultado.zonas) if resultado else None, len(eventos)))

    def guardar_estado(self):
        try:
            _escribir_json(self.estado_archivo, {"firma": self.firma_seguimiento, "desde": self.desde_seguimiento,
                                                 "vueltas": self.vueltas_salud, "estado": self.seguimiento.a_json()})
        except Exception:
            pass

    # --- Reintentos: una alerta que no salio por falta de red no se pierde ---

    def encolar(self, campos, clave, evidencia_nombre):
        try:
            arr = []
            if os.path.exists(self.pendientes_archivo):
                with open(self.pendientes_archivo, encoding="utf-8") as f:
                    arr = json.load(f)
            arr.append({"campos": dict(campos), "clave": clave, "evidencia": evidencia_nombre or ""})
            # Tope: si el equipo lleva dias sin red, basta con lo mas reciente.
            _escribir_json(self.pendientes_archivo, arr[-20:])
        except Exception:
            pass

    def enviar_pendientes(self):
        if not os.path.exists(self.pendientes_archivo):
            return
        try:
            with open(self.pendientes_archivo, encoding="utf-8") as f:
                arr = json.load(f)
        except Exception:
            arr = []
        quedan = []
        for o in arr:
            campos = {k: str(v) for k, v in o["campos"].items()}
            nombre = o.get("evidencia") or ""
            foto = None
            if nombre:
                ruta = os.path.join(self.evidencia.directorio(), nombre + ".jpg")
                if os.path.exists(ruta):
                    with open(ruta, "rb") as f:
                        foto = f.read()
            id_ = self.api.reportar_falla(campos, foto)
            if id_ is None:
                quedan.append(o)
            elif id_ == FALLA_RECHAZADA:
                if campos.get("evento") == "abrir":
                    self.seguimiento.olvidar(o["clave"])
            elif campos.get("evento") == "abrir":
                self.seguimiento.confirmada(o["clave"], id_)
        if not quedan:
            try:
                os.remove(self.pendientes_archivo)
            except OSError:
                pass
        else:
            _escribir_json(self.pendientes_archivo, quedan)
        self.guardar_estado()

    def subir_creativo(self, jpeg, huella_):
        ok = self.api.subir_creativo(jpeg, huella_)
        if ok:
            self.api.log("info", "creative", "Creativo nuevo detectado en la pantalla; foto subida (%d KB)"
                         % (len(jpeg) // 1024))
        else:
            self.api.log("warn", "creative", "Creativo nuevo detectado, pero la foto no se pudo subir")
        return ok


def _escribir_json(ruta, valor):
    # Primero a un temporal y luego se renombra: un corte de luz a media
    # escritura no deja el estado a medias (en la Pi pasa mas que en un telefono).
    tmp = ruta + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(valor, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, ruta)


# --- Entrada ----------------------------------------------------------------

def _version():
    return "monitor.py %s (opencv %s, numpy %s)" % (VERSION, cv2.__version__, np.__version__)


def main(argv=None, reloj=None):
    """Devuelve el codigo de salida. `reloj` se inyecta en las pruebas."""
    a = argparse.ArgumentParser(description="Vigilancia de la pantalla (Raspberry)")
    a.add_argument("--puente", help="URL del puente de Node, p. ej. http://127.0.0.1:41234")
    a.add_argument("--dir", help="donde se guarda lo aprendido (el pantalla/ del equipo)")
    a.add_argument("--una-vuelta", action="store_true", help="un solo recorrido, sin esperar el intervalo")
    a.add_argument("--version", action="store_true", help="imprime la version (sale con 0 si OpenCV carga)")
    args = a.parse_args(argv)

    if args.version:
        print(_version(), flush=True)
        return 0
    if not args.puente or not args.dir:
        log_local("error", "monitor", "faltan --puente y --dir")
        return 2
    secreto = os.environ.get("PUENTE_SECRETO", "")
    if not secreto:
        log_local("error", "monitor", "falta PUENTE_SECRETO: el puente no contestaria nada")
        return 2

    puente = Puente(args.puente, secreto)
    monitor = Monitor(args.dir, ApiPuente(puente), CamaraPuente(puente), reloj)
    log_local("info", "monitor", "%s; estado en %s" % (_version(), args.dir))
    if args.una_vuelta:
        try:
            monitor.una_vuelta()
        except Exception as e:
            log_local("error", "monitor", "la vuelta fallo: %r" % e)
            monitor.api.log("warn", "monitor", "La vigilancia de la pantalla fallo: %s" % e)
            return 1
        return 0
    monitor.correr()
    return 0


def _al_terminar(_senal, _marco):
    # SIGTERM del guardian: se sale por SystemExit para que los `finally`
    # cierren la camara en el puente antes de irse.
    raise SystemExit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, _al_terminar)
    sys.exit(main())
