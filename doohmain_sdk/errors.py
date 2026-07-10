"""Errores del SDK de DOOHmain y su clasificación en categorías.

La API de DOOHmain responde HTTP 200 incluso en fallos (el error viaja en el
body como {"error": "..."}), así que la clasificación se apoya en el mensaje y,
cuando lo hay, en el status HTTP real (reintentables 5xx / 429)."""

from __future__ import annotations


class ErrorCategory:
    AUTH = "auth"              # api_key inválida / no autorizado
    RATE_LIMIT = "rate_limit"  # 429
    NOT_FOUND = "not_found"    # recurso inexistente
    VALIDATION = "validation"  # parámetros rechazados por la API
    SERVER = "server"          # 5xx
    NETWORK = "network"        # conexión / timeout
    UNKNOWN = "unknown"


def classify(message: str | None = None, status: int | None = None) -> str:
    """Devuelve la categoría (ErrorCategory) a partir del status y/o mensaje."""
    if status is not None:
        if status == 429:
            return ErrorCategory.RATE_LIMIT
        if status in (500, 502, 503, 504):
            return ErrorCategory.SERVER
        if status in (401, 403):
            return ErrorCategory.AUTH
        if status == 404:
            return ErrorCategory.NOT_FOUND

    msg = (message or "").lower()
    if not msg:
        return ErrorCategory.UNKNOWN
    if any(k in msg for k in ("api_key", "api key", "unauthorized", "no autorizado", "auth")):
        return ErrorCategory.AUTH
    if any(k in msg for k in ("not found", "no existe", "inexistente", "unknown screen")):
        return ErrorCategory.NOT_FOUND
    if any(k in msg for k in ("invalid", "inválid", "required", "requerid", "missing", "falta", "no válid")):
        return ErrorCategory.VALIDATION
    if any(k in msg for k in ("timeout", "connection", "conexión", "network", "red")):
        return ErrorCategory.NETWORK
    return ErrorCategory.UNKNOWN


class DOOHmainError(Exception):
    """Error unificado del SDK. Lleva categoría, y opcionalmente status HTTP,
    la acción de la API que lo produjo y el payload crudo de la respuesta."""

    def __init__(
        self,
        message: str,
        *,
        category: str | None = None,
        status: int | None = None,
        action: str | None = None,
        payload: object | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.action = action
        self.payload = payload
        self.category = category or classify(message, status)

    def to_dict(self) -> dict:
        return {
            "error": self.message,
            "category": self.category,
            "status": self.status,
            "action": self.action,
        }

    def __str__(self) -> str:
        extra = f" [{self.category}"
        if self.action:
            extra += f" · {self.action}"
        if self.status:
            extra += f" · HTTP {self.status}"
        extra += "]"
        return f"{self.message}{extra}"
