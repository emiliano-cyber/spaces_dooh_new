# json_util.py — Las lecturas "opt" de org.json, para que la configuracion del
# servidor se lea en la Raspberry exactamente igual que en el telefono.
#
# org.json perdona: un numero que llega como texto ("60") vale, un 60.0 vale
# como entero 60, y lo que falta o no sirve toma el valor por omision. Si aqui
# se leyera con dict.get a secas, una configuracion que en el telefono funciona
# tumbaria la vuelta en la Pi.
import math


def _numero(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, str):
        try:
            return float(v.strip())
        except ValueError:
            return None
    return None


def opt_int(o, clave, pordefecto=0):
    v = _numero(o.get(clave)) if isinstance(o, dict) else None
    if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
        return pordefecto
    return int(v)  # trunca hacia cero, como intValue() de Java


def opt_long(o, clave, pordefecto=0):
    return opt_int(o, clave, pordefecto)


def opt_double(o, clave, pordefecto=float("nan")):
    v = _numero(o.get(clave)) if isinstance(o, dict) else None
    return pordefecto if v is None else float(v)


def opt_bool(o, clave, pordefecto=False):
    v = o.get(clave) if isinstance(o, dict) else None
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        if v.lower() == "true":
            return True
        if v.lower() == "false":
            return False
    return pordefecto


def a_texto(v):
    """Lo que daria String.valueOf en Java para un valor de JSON."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, str):
        return v
    return str(v)


def opt_str(o, clave, pordefecto=""):
    if not isinstance(o, dict) or clave not in o:
        return pordefecto
    return a_texto(o[clave])


def opt_obj(o, clave):
    v = o.get(clave) if isinstance(o, dict) else None
    return v if isinstance(v, dict) else None


def opt_arr(o, clave):
    v = o.get(clave) if isinstance(o, dict) else None
    return v if isinstance(v, list) else None


def redondea(v, decimales=2):
    """Math.round(v * 100) / 100.0 de Java: redondea las mitades hacia arriba
    (round() de Python las manda al par y cambiaria algun 0.x5)."""
    f = 10 ** decimales
    return math.floor(v * f + 0.5) / f


def redondea_entero(v):
    """Math.round de Java para un double: mitades hacia arriba."""
    return int(math.floor(v + 0.5))
