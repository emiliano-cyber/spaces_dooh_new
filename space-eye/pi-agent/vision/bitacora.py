"""La bitacora: cuantas veces se vio cada creativo, en que hora, y el cierre del dia.

POR QUE EXISTE
--------------
Hasta ahora el equipo reportaba `vistas` como un CONJUNTO: miraba la pantalla
decenas de veces en una vuelta y, si el mismo anuncio salia doce, reportaba
uno. El dato estaba en la mano y se tiraba. Para auditar hace falta lo otro:
cuantas veces y a que hora.

LO QUE ESTO NO ES
-----------------
NO SON REPRODUCCIONES. Esto cuenta MIRADAS DE LA CAMARA en las que el anuncio
estaba, no veces que el reproductor lo saco. Por eso todo sale con su
denominador -`vistazos`- y por eso aqui no aparece la palabra
«reproducciones». Un numero sin denominador se cae en cuanto el anunciante
pregunta como se midio.

EL DENOMINADOR SON LAS MIRADAS LEGIBLES
---------------------------------------
Una mirada con la pantalla apagada, o sin contraste, o con la lente tapada, no
puede ensenar ningun anuncio. Meterla en el denominador bajaria el porcentaje
de todos los creativos por algo que no tiene que ver con ellos. Esas miradas
se cuentan aparte (`ciegos`) y de la pantalla apagada ya avisa la vigilancia de
fallas, que es su sitio.

LA HORA ES LA DEL SITIO
-----------------------
`Reloj.hora_local` ya devuelve la hora de la pantalla y no la de la zona que
traiga el sistema -Raspberry OS viene en UTC-. El servidor no puede calcularla
porque `devices` no guarda zona horaria, asi que la manda el equipo.

SOBREVIVE AL REINICIO
---------------------
El total del dia se guarda en disco cada vuelta. Sin eso, un reinicio a media
tarde haria que el cierre reportara menos de lo que hubo y el servidor anotara
huecos que no existieron.
"""
import datetime
import json
import os

# Mas de esto en una sola vuelta es un equipo que se quedo mirando: se recorta
# para no mandar un cuerpo enorme, y el recorte se nota en el cierre.
PASADAS_MAX = 2000


class Bitacora:
    def __init__(self, directorio, reloj):
        self.archivo = os.path.join(directorio, "bitacora.json")
        self.reloj = reloj
        # Lo que lleva el DIA (para el cierre).
        self.dia = ""
        self.vistazos = 0
        self.ciegos = 0
        self.vueltas = 0
        self.primera = None
        self.ultima = None
        # Lo que lleva ESTA VUELTA (lo que se manda pegado al reporte).
        self._reiniciar_vuelta()
        # Un dia terminado que todavia no se pudo mandar.
        self.cierre_pendiente = None
        self._cargar()

    # --- Disco ------------------------------------------------------------

    def _cargar(self):
        try:
            with open(self.archivo, encoding="utf-8") as f:
                j = json.load(f)
            self.dia = str(j.get("dia") or "")
            self.vistazos = int(j.get("vistazos") or 0)
            self.ciegos = int(j.get("ciegos") or 0)
            self.vueltas = int(j.get("vueltas") or 0)
            self.primera = j.get("primera") or None
            self.ultima = j.get("ultima") or None
            c = j.get("cierre")
            self.cierre_pendiente = c if isinstance(c, dict) else None
        except (OSError, ValueError, TypeError):
            pass

    def _guardar(self):
        try:
            tmp = self.archivo + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump({"dia": self.dia, "vistazos": self.vistazos, "ciegos": self.ciegos,
                           "vueltas": self.vueltas, "primera": self.primera, "ultima": self.ultima,
                           "cierre": self.cierre_pendiente}, f)
            os.replace(tmp, self.archivo)
        except OSError:
            pass

    # --- El dia -----------------------------------------------------------

    def _hoy(self):
        """La FECHA del sitio. `hora_local` ya trae la zona buena; se arma con ella."""
        h = self.reloj.hora_local()
        base = datetime.datetime.fromtimestamp(self.reloj.ahora_ms() / 1000.0)
        # La fecha del sitio es la del sistema corrida por la diferencia entre
        # la hora del sitio y la del sistema. Sin esto, a las 23:30 en Mexico
        # con la Raspberry en UTC (05:30 del dia siguiente) el dia saldria
        # cambiado y la bitacora de esa noche caeria en el dia equivocado.
        minutos = (h.hour * 60 + h.minute) - (base.hour * 60 + base.minute)
        if minutos > 12 * 60:
            base -= datetime.timedelta(days=1)
        elif minutos < -12 * 60:
            base += datetime.timedelta(days=1)
        return base.strftime("%Y-%m-%d")

    def _reiniciar_vuelta(self):
        self.v_vistazos = 0
        self.v_horas = {}        # hora -> vistazos legibles
        self.v_pasadas = {}      # (huella, hora) -> [n, desde, hasta]

    def _cerrar_si_cambio_el_dia(self, hoy):
        """Un dia que termina deja su resumen listo para mandar."""
        if self.dia and self.dia != hoy and self.vistazos:
            self.cierre_pendiente = {"dia": self.dia, "vistazos": self.vistazos,
                                     "vueltas": self.vueltas}
            if self.primera:
                self.cierre_pendiente["primera"] = self.primera
            if self.ultima:
                self.cierre_pendiente["ultima"] = self.ultima
        if self.dia != hoy:
            self.dia = hoy
            self.vistazos = 0
            self.ciegos = 0
            self.vueltas = 0
            self.primera = None
            self.ultima = None

    # --- Durante la vuelta --------------------------------------------------

    def empezar_vuelta(self):
        self._reiniciar_vuelta()
        self._cerrar_si_cambio_el_dia(self._hoy())

    def ciego(self):
        """Una mirada que no podia ensenar nada: apagada, sin contraste, tapada."""
        self.ciegos += 1

    def vistazo(self):
        """Una mirada LEGIBLE: entra en el denominador."""
        h = self.reloj.hora_local()
        reloj = h.strftime("%H:%M:%S")
        self.v_vistazos += 1
        self.v_horas[h.hour] = self.v_horas.get(h.hour, 0) + 1
        if self.primera is None or reloj < self.primera:
            self.primera = reloj
        if self.ultima is None or reloj > self.ultima:
            self.ultima = reloj
        return h.hour, reloj

    def pasada(self, huella, hora, reloj):
        """Ese creativo estaba en esa mirada."""
        k = (huella, hora)
        p = self.v_pasadas.get(k)
        if p is None:
            self.v_pasadas[k] = [1, reloj, reloj]
        else:
            p[0] += 1
            if reloj < p[1]:
                p[1] = reloj
            if reloj > p[2]:
                p[2] = reloj

    # --- Al terminar la vuelta ----------------------------------------------

    def de_la_vuelta(self):
        """Lo que se manda pegado al reporte, o None si no hubo nada que contar.

        Son INCREMENTOS: el servidor los suma a lo que ya tenia. El total del
        dia no se manda aqui, va solo en el cierre, que asi sirve de suma de
        comprobacion de todo lo que fue llegando.
        """
        if not self.v_vistazos:
            return None
        self.vistazos += self.v_vistazos
        self.vueltas += 1
        self._guardar()
        pasadas = [{"h": h, "hora": hora, "n": p[0], "desde": p[1], "hasta": p[2]}
                   for (h, hora), p in self.v_pasadas.items()]
        pasadas.sort(key=lambda x: (-x["n"], x["hora"]))
        return {"dia": self.dia, "vistazos": self.v_vistazos,
                "horas": [{"hora": k, "vistazos": v} for k, v in sorted(self.v_horas.items())],
                "pasadas": pasadas[:PASADAS_MAX]}

    def tomar_cierre(self):
        """El resumen del dia que termino, una sola vez."""
        c = self.cierre_pendiente
        if c is not None:
            self.cierre_pendiente = None
            self._guardar()
        return c

    def devolver_cierre(self, c):
        """Si el reporte no salio, el cierre espera al siguiente."""
        if c is not None and self.cierre_pendiente is None:
            self.cierre_pendiente = c
            self._guardar()
