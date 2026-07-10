"""Configuración del SDK: credenciales SOLO desde el entorno (.env).

No hay valores por defecto para credenciales. Si falta alguna variable requerida
se lanza DOOHmainError al importar, con un mensaje claro de qué falta."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import find_dotenv, load_dotenv

from .errors import DOOHmainError, ErrorCategory

# Carga credenciales de .env para uso local. En producción las variables ya
# vienen en el entorno del proceso y tienen prioridad (load_dotenv no las pisa).
# 1) el .env junto al paquete (doohmain_sdk/.env), sin importar el cwd; esto hace
#    que el subproceso invocado desde el handler TS funcione desde cualquier lado.
_pkg_env = Path(__file__).with_name(".env")
if _pkg_env.exists():
    load_dotenv(_pkg_env)
# 2) además, el .env más cercano al cwd (por si se ejecuta desde otro contexto).
load_dotenv(find_dotenv(usecwd=True))

# Constante del proveedor (no es credencial). Se puede sobreescribir por entorno.
BASE_URL = os.environ.get("DOOHMAIN_BASE_URL", "https://app.doohmain.com/api/v1/index.php")

_REQUIRED = (
    "DOOHMAIN_API_KEY",
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
    "DB_SSL",
)

_missing = [name for name in _REQUIRED if not os.environ.get(name)]
if _missing:
    raise DOOHmainError(
        "Faltan variables de entorno requeridas: "
        + ", ".join(_missing)
        + ". Define un .env (ver doohmain_sdk/.env.example).",
        category=ErrorCategory.VALIDATION,
    )


def _as_bool(value: str) -> bool:
    return value.strip().lower() in ("1", "true", "yes", "on", "si", "sí")


API_KEY = os.environ["DOOHMAIN_API_KEY"]

DB = {
    "host": os.environ["DB_HOST"],
    "port": int(os.environ["DB_PORT"]),
    "user": os.environ["DB_USER"],
    "password": os.environ["DB_PASSWORD"],
    "name": os.environ["DB_NAME"],
    "ssl": _as_bool(os.environ["DB_SSL"]),
}
