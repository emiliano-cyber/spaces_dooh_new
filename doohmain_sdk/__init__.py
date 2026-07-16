"""SDK de integración con DOOHmain.

Reutiliza las tablas compartidas con DOOH Manager para no duplicar recursos en
la plataforma. Punto de entrada: las cinco primitivas idempotentes.

Las primitivas se exponen de forma perezosa (PEP 562): importar el paquete no
carga la configuración, pero USAR una primitiva sí valida las credenciales del
entorno (y lanza DOOHmainError claro si falta alguna)."""

from .errors import DOOHmainError, ErrorCategory  # no depende de config

__all__ = [
    "ensure_campaign",
    "ensure_media",
    "publish_spot",
    "update_campaign",
    "retirar_creativo",
    "ping",
    "DOOHmainError",
    "ErrorCategory",
]

_PRIMITIVES = {
    "ensure_campaign",
    "ensure_media",
    "publish_spot",
    "update_campaign",
    "retirar_creativo",
    "ping",
}


def __getattr__(name: str):
    if name in _PRIMITIVES:
        from . import integration

        return getattr(integration, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
