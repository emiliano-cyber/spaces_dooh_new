"""Las fotos de creativos nuevos que esperan su envio agrupado.

Cuando el servidor pide mandar las fotos nuevas "juntas cada N horas"
(creativos.envio_min > 0), la vigilancia sigue mirando todo el tiempo (para no
perder un creativo que sale una sola vez) pero en vez de subir la foto al
momento la guarda aqui, y al cumplirse el plazo manda UNA por creativo: la mas
nitida de las que se vieron en ese tiempo.

Agrupar NO ahorra datos (cada foto pesa lo mismo se mande cuando se mande): sirve
para recibirlas juntas. Lo que cuida el consumo es el tope diario, que se
respeta al enviar.

Vive en disco (<dir>/lote/), escrito de forma atomica: un reinicio de la Pi a
mitad del plazo no pierde ninguna foto.
"""
import json
import os


class LoteCreativos:
    def __init__(self, directorio, ahora_ms):
        self.dir = os.path.join(directorio, "lote")
        os.makedirs(self.dir, exist_ok=True)
        self._ahora = ahora_ms
        self._indice = os.path.join(self.dir, "lote.json")
        self.items = {}           # huella -> {"archivo", "nitidez", "primera"}
        self.ultimo_envio = 0
        try:
            with open(self._indice, encoding="utf-8") as f:
                j = json.load(f)
            self.items = {k: v for k, v in (j.get("items") or {}).items()
                          if os.path.exists(os.path.join(self.dir, v.get("archivo", "")))}
            self.ultimo_envio = int(j.get("ultimo_envio") or 0)
        except (OSError, ValueError):
            pass

    def _guardar(self):
        tmp = self._indice + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"items": self.items, "ultimo_envio": self.ultimo_envio}, f)
        os.replace(tmp, self._indice)

    def _escribir_foto(self, huella, jpeg):
        nombre = "%s.jpg" % huella[:32]
        tmp = os.path.join(self.dir, nombre + ".tmp")
        with open(tmp, "wb") as f:
            f.write(jpeg)
        os.replace(tmp, os.path.join(self.dir, nombre))
        return nombre

    def tiene(self, huella):
        return huella in self.items

    def agregar(self, huella, jpeg, nitidez):
        """Un creativo nuevo: se guarda (o se mejora si ya estaba)."""
        if not self.items and not self.ultimo_envio:
            # El plazo del primer envio cuenta desde el primer creativo nuevo.
            self.ultimo_envio = self._ahora()
        previo = self.items.get(huella)
        if previo is not None and previo["nitidez"] >= nitidez:
            return False
        self.items[huella] = {
            "archivo": self._escribir_foto(huella, jpeg),
            "nitidez": float(nitidez),
            "primera": previo["primera"] if previo else self._ahora(),
        }
        self._guardar()
        return True

    def mejorar(self, huella, jpeg, nitidez):
        """Otra mirada a un creativo que espera envio: si se ve mas nitido, esa foto."""
        if huella not in self.items:
            return False
        return self.agregar(huella, jpeg, nitidez)

    def toca_enviar(self, envio_min):
        return bool(self.items) and self._ahora() - self.ultimo_envio >= envio_min * 60_000

    def pendientes(self):
        """(huella, jpeg) en el orden en que aparecieron."""
        salida = []
        for h, v in sorted(self.items.items(), key=lambda kv: kv[1]["primera"]):
            try:
                with open(os.path.join(self.dir, v["archivo"]), "rb") as f:
                    salida.append((h, f.read()))
            except OSError:
                pass
        return salida

    def quitar(self, huella):
        v = self.items.pop(huella, None)
        if v is not None:
            try:
                os.remove(os.path.join(self.dir, v["archivo"]))
            except OSError:
                pass
            self._guardar()

    def marcar_envio(self):
        self.ultimo_envio = self._ahora()
        self._guardar()

    def __len__(self):
        return len(self.items)
