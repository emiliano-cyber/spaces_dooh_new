"""Primitivas idempotentes: la lógica que evita duplicar recursos en DOOHmain.

La idempotencia es responsabilidad NUESTRA (create_spot no dedup: reutiliza la
lista y AGREGA el elemento, así que re-llamarlo duplica). Las tablas compartidas
son el registro de lo ya hecho; se consultan antes de cada llamada a la API.

Regla de oro (BD compartida entre servers): si el otro proyecto ya creó la
campaña o subió el arte, estas funciones lo detectan por tabla y NO duplican."""

from __future__ import annotations

import hashlib
import os
from datetime import datetime
from typing import Any

from .client import DOOHmainClient
from .db import Database
from .errors import DOOHmainError, ErrorCategory

_DATE_FORMATS = ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y")


def norm(value: Any) -> str:
    """Normaliza una fecha a 'YYYY-MM-DD' aceptando varios formatos de entrada."""
    if value is None or value == "":
        raise DOOHmainError("Fecha vacía", category=ErrorCategory.VALIDATION)
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    text = str(value).strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    raise DOOHmainError(
        f"Formato de fecha no reconocido: {value!r}",
        category=ErrorCategory.VALIDATION,
    )


def _md5(filepath: str) -> str:
    h = hashlib.md5()
    with open(filepath, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_campaign(
    version: str,
    anunciante: str,
    campana: str,
    fecha_inicio: Any,
    fecha_fin: Any,
    *,
    api: DOOHmainClient | None = None,
    db: Database | None = None,
) -> str:
    """Devuelve el `auth` de la campaña remota, creándola solo si no existe."""
    db = db or Database()
    api = api or DOOHmainClient()

    row = db.remote_campaign_get(version)
    if row and row.get("auth"):
        return row["auth"]

    name = f"{anunciante} - {campana}".strip(" -") or version
    res = api.create_campaign(
        name=name,
        anunciante=anunciante,
        start_date=norm(fecha_inicio),
        end_date=norm(fecha_fin),
    )
    auth = res.get("auth")
    if not auth:
        raise DOOHmainError(
            f"'create_campaign' no devolvió auth: {res}",
            action="create_campaign",
            payload=res,
        )

    db.remote_campaign_register(version, auth, name=name, anunciante=anunciante)
    # Carrera entre servers: si otro insertó primero, ON DUPLICATE conserva SU
    # auth; re-leemos para devolver el canónico.
    winner = db.remote_campaign_get(version)
    return (winner and winner.get("auth")) or auth


def ensure_media(
    filepath: str,
    version: str,
    *,
    api: DOOHmainClient | None = None,
    db: Database | None = None,
) -> int:
    """Devuelve el media_id, subiendo el arte solo si no está ya registrado."""
    db = db or Database()
    api = api or DOOHmainClient()

    file_hash = _md5(filepath)
    row = db.get_media_by_hash(file_hash) or db.get_media(version)
    if row and row.get("media_id") is not None:
        return int(row["media_id"])

    media_id = api.upload_media(filepath)

    stat = os.stat(filepath)
    filename = os.path.basename(filepath)
    extension = os.path.splitext(filename)[1].lstrip(".").lower() or None
    db.save_media(
        version,
        media_id,
        filename=filename,
        local_path=os.path.abspath(filepath),
        ancho=None,   # dimensiones no calculadas (sin deps de imagen)
        alto=None,
        extension=extension,
        file_hash=file_hash,
        source_mtime=int(stat.st_mtime),
        source_size=int(stat.st_size),
    )
    return int(media_id)


def publish_spot(
    screen_name: str,
    list_name: str,
    campaign_auth: str,
    media_id: int,
    *,
    api: DOOHmainClient | None = None,
    db: Database | None = None,
) -> str:
    """Agrega el arte a la sublista de la pantalla, salvo que ya esté publicado."""
    db = db or Database()
    api = api or DOOHmainClient()

    if db.remote_list_element_exists(screen_name, list_name, media_id):
        return "already_published"

    api.create_spot(screen_name, list_name, campaign_auth, media_id)
    db.remote_list_register(screen_name, list_name, campaign_auth, media_id)
    return "published"


def update_campaign(auth: str, *, api: DOOHmainClient | None = None, **fields: Any) -> dict:
    """Passthrough para editar una campaña ya enviada."""
    api = api or DOOHmainClient()
    return api.update_campaign(auth, **fields)


def retirar_creativo(
    version: str,
    *,
    api: DOOHmainClient | None = None,
    db: Database | None = None,
) -> str:
    """Retira un creativo de DOOHmain (para eliminarlo o reemplazarlo).

    DOOHmain no permite borrar spots/media; lo máximo es finalizar la campaña
    del creativo (queda fuera del aire). Además limpia el tracking local, de modo
    que si luego se re-publica (reemplazo), se cree de nuevo desde cero.

    Devuelve 'retirado' si había algo publicado, o 'no_publicado' si no lo estaba.
    """
    db = db or Database()
    api = api or DOOHmainClient()

    row = db.remote_campaign_get(version)
    auth = row.get("auth") if row else None
    if not auth:
        # Nunca llegó a DOOHmain; solo limpiamos cualquier resto local.
        db.remote_campaign_delete(version)
        db.media_delete(version)
        return "no_publicado"

    api.update_campaign(auth, status="finished")  # lo baja del aire
    db.remote_list_delete_by_auth(auth)
    db.remote_campaign_delete(version)
    db.media_delete(version)
    return "retirado"


def ping(*, api: DOOHmainClient | None = None) -> list[str]:
    """Diagnóstico de conectividad: devuelve la lista de pantallas accesibles."""
    api = api or DOOHmainClient()
    return api.get_screen_list()
