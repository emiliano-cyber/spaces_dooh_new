"""Capa de BD: tablas de tracking de la integración (PostgreSQL).

Adaptado a la Postgres local del proyecto (decisión de arquitectura). Estas
tablas son el registro de "qué ya se hizo en DOOHmain" y sostienen la
idempotencia. Su DDL está en `schema.sql` (aplícalo una vez).

Nota: en este modo la idempotencia es LOCAL (no compartida con DOOH Manager),
así que las altas usan INSERT ... ON CONFLICT DO UPDATE para tolerar re-ejecución
y carreras dentro de este mismo server."""

from __future__ import annotations

from typing import Any

import psycopg
from psycopg.rows import dict_row

from . import config
from .errors import DOOHmainError, ErrorCategory


def get_connection() -> "psycopg.Connection":
    try:
        return psycopg.connect(
            host=config.DB["host"],
            port=config.DB["port"],
            user=config.DB["user"],
            password=config.DB["password"],
            dbname=config.DB["name"],
            # DB_SSL=true → cifra sin verificar cert (p. ej. Postgres gestionada en
            # DO); false → sin TLS (Postgres local).
            sslmode="require" if config.DB["ssl"] else "disable",
            autocommit=False,
            row_factory=dict_row,
        )
    except psycopg.OperationalError as exc:
        raise DOOHmainError(
            f"No se pudo conectar a la BD ({config.DB['host']}:{config.DB['port']}/"
            f"{config.DB['name']}): {exc}",
            category=ErrorCategory.NETWORK,
        ) from exc


class Database:
    """Envuelve una conexión psycopg y expone las lecturas/escrituras del SDK."""

    def __init__(self, conn: Any | None = None) -> None:
        self.conn = conn or get_connection()

    def close(self) -> None:
        try:
            self.conn.close()
        except Exception:
            pass

    # -- doohmain_remote_campaigns ------------------------------------------
    def remote_campaign_get(self, version: str) -> dict | None:
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM doohmain_remote_campaigns WHERE version=%s",
                (version,),
            )
            return cur.fetchone()

    def remote_campaign_register(
        self,
        version: str,
        auth: str,
        name: str | None = None,
        anunciante: str | None = None,
    ) -> None:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO doohmain_remote_campaigns (version, auth, name, anunciante)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (version) DO UPDATE SET last_synced_at = now()
                """,
                (version, auth, name, anunciante),
            )
        self.conn.commit()

    # -- doohmain_remote_lists ----------------------------------------------
    def remote_list_element_exists(
        self, screen_name: str, list_name: str, media_id: int
    ) -> bool:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                SELECT 1 FROM doohmain_remote_lists
                WHERE screen_name=%s AND list_name=%s AND media_id=%s
                LIMIT 1
                """,
                (screen_name, list_name, media_id),
            )
            return cur.fetchone() is not None

    def remote_list_register(
        self, screen_name: str, list_name: str, campaign_auth: str, media_id: int
    ) -> None:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO doohmain_remote_lists
                    (screen_name, list_name, campaign_auth, media_id)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (screen_name, list_name, media_id)
                    DO UPDATE SET last_synced_at = now()
                """,
                (screen_name, list_name, campaign_auth, media_id),
            )
        self.conn.commit()

    # -- media_uploads -------------------------------------------------------
    def get_media(self, version: str) -> dict | None:
        with self.conn.cursor() as cur:
            cur.execute("SELECT * FROM media_uploads WHERE version=%s", (version,))
            return cur.fetchone()

    def get_media_by_hash(self, file_hash: str) -> dict | None:
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM media_uploads WHERE file_hash=%s", (file_hash,)
            )
            return cur.fetchone()

    def save_media(
        self,
        version: str,
        media_id: int,
        filename: str,
        local_path: str,
        ancho: int | None,
        alto: int | None,
        extension: str | None,
        file_hash: str | None = None,
        source_mtime: int | None = None,
        source_size: int | None = None,
    ) -> None:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO media_uploads
                    (version, media_id, file_hash, filename, local_path,
                     ancho, alto, extension, source_mtime, source_size)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (version) DO UPDATE SET
                    media_id     = EXCLUDED.media_id,
                    file_hash    = EXCLUDED.file_hash,
                    filename     = EXCLUDED.filename,
                    local_path   = EXCLUDED.local_path,
                    source_mtime = EXCLUDED.source_mtime,
                    source_size  = EXCLUDED.source_size
                """,
                (
                    version, media_id, file_hash, filename, local_path,
                    ancho, alto, extension, source_mtime, source_size,
                ),
            )
        self.conn.commit()
