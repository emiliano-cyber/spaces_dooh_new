"""Cliente HTTP de la API de DOOHmain.

Un solo endpoint (index.php) con la operación en el query param `action`, y la
`api_key` en TODAS las peticiones. La API responde HTTP 200 incluso en errores:
si el body es dict y trae la clave "error", se lanza DOOHmainError."""

from __future__ import annotations

import mimetypes
import os
import time
from typing import Any, Callable, Sequence

import httpx

from . import config
from .errors import DOOHmainError, ErrorCategory, classify

RETRY_STATUS = frozenset({429, 500, 502, 503, 504})
MAX_RETRIES = 3
INITIAL_DELAY = 2.0  # segundos; se duplica cada intento
TIMEOUT = 90.0


class DOOHmainClient:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        *,
        timeout: float = TIMEOUT,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.api_key = api_key or config.API_KEY
        self.base_url = base_url or config.BASE_URL
        self._sleep = sleep
        self._http = httpx.Client(timeout=timeout)

    # -- ciclo de vida -------------------------------------------------------
    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "DOOHmainClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # -- transporte con reintentos ------------------------------------------
    def _request(
        self,
        method: str,
        action: str,
        *,
        params: dict | None = None,
        data: dict | None = None,
        files: dict | None = None,
    ) -> Any:
        query: dict[str, Any] = {"action": action, "api_key": self.api_key}
        if params:
            query.update(params)

        delay = INITIAL_DELAY
        for attempt in range(MAX_RETRIES + 1):
            try:
                resp = self._http.request(
                    method, self.base_url, params=query, data=data, files=files
                )
            except httpx.TransportError as exc:  # conexión / timeout → reintentable
                if attempt < MAX_RETRIES:
                    self._sleep(delay)
                    delay *= 2
                    continue
                raise DOOHmainError(
                    f"Error de red al llamar '{action}': {exc}",
                    category=ErrorCategory.NETWORK,
                    action=action,
                ) from exc

            if resp.status_code in RETRY_STATUS:
                if attempt < MAX_RETRIES:
                    self._sleep(delay)
                    delay *= 2
                    continue
                raise DOOHmainError(
                    f"DOOHmain devolvió HTTP {resp.status_code} en '{action}'",
                    category=classify(status=resp.status_code),
                    status=resp.status_code,
                    action=action,
                )

            # status no reintentable (normalmente 200). Parsear.
            try:
                body = resp.json()
            except ValueError as exc:
                raise DOOHmainError(
                    f"Respuesta no-JSON de '{action}': {resp.text[:200]}",
                    action=action,
                ) from exc

            if isinstance(body, dict) and "error" in body:
                raise DOOHmainError(
                    str(body["error"]),
                    status=resp.status_code,
                    action=action,
                    payload=body,
                )
            return body

        # Inalcanzable: el bucle siempre retorna o lanza.
        raise DOOHmainError(f"'{action}' agotó los reintentos", action=action)

    # -- acciones ------------------------------------------------------------
    def upload_media(self, filepath: str) -> int:
        filename = os.path.basename(filepath)
        mimetype = mimetypes.guess_type(filepath)[0] or "application/octet-stream"
        # Se leen bytes (no un handle) para que un reintento no envíe vacío.
        with open(filepath, "rb") as fh:
            content = fh.read()
        body = self._request(
            "POST", "upload", files={"file": (filename, content, mimetype)}
        )

        media_id = None
        if isinstance(body, dict):
            media_id = body.get("id")
            if media_id is None:
                success = body.get("success")
                media_id = success.get("id") if isinstance(success, dict) else success
        if media_id is None:
            raise DOOHmainError(
                f"'upload' no devolvió id de arte: {body}",
                category=ErrorCategory.VALIDATION,
                action="upload",
                payload=body,
            )
        return int(media_id)

    def create_campaign(
        self,
        name: str,
        anunciante: str,
        start_date: str,
        end_date: str,
        status: str = "active",
    ) -> dict:
        data = {
            "name": name,
            "start_date": start_date,
            "end_date": end_date,
            "status": status,
            "client[name]": anunciante,
        }
        body = self._request("POST", "create_campaign", data=data)
        # Normaliza formato antiguo {"auth","client_id"} y actual
        # {"success":{"auth","client"}} a {"auth","client_id"}.
        if isinstance(body, dict):
            success = body.get("success")
            if isinstance(success, dict):
                return {"auth": success.get("auth"), "client_id": success.get("client")}
            return {"auth": body.get("auth"), "client_id": body.get("client_id")}
        raise DOOHmainError(
            f"'create_campaign' devolvió un cuerpo inesperado: {body}",
            action="create_campaign",
            payload=body,
        )

    def update_campaign(self, auth: str, **kwargs: Any) -> dict:
        data = {"auth": auth, **kwargs}
        return self._request("POST", "update_campaign", data=data)

    def get_campaigns(self, auths: Sequence[str]) -> dict:
        params = {"auth[]": list(auths)} if len(auths) > 1 else {"auth": auths[0]}
        return self._request("GET", "get_campaigns", params=params)

    def get_screen_list(self) -> list[str]:
        body = self._request("GET", "get_screen_list")
        screens = body.get("screens", []) if isinstance(body, dict) else []
        return [s["name"] for s in screens if isinstance(s, dict) and s.get("name")]

    def get_screen_info(self, names: Sequence[str]) -> dict:
        params = {"name[]": list(names)} if len(names) > 1 else {"name": names[0]}
        return self._request("GET", "get_screen_info", params=params)

    def create_spot(
        self,
        screen_name: str,
        list_name: str,
        campaign_auth: str,
        media_id: int,
        start_time: str | None = None,
        end_time: str | None = None,
        days: Sequence[int] | None = None,
    ) -> dict:
        data: dict[str, Any] = {
            "name": screen_name,
            "list": list_name,
            "campaign": campaign_auth,
            "elements[0][id]": media_id,
        }
        if start_time is not None:
            data["elements[0][start_time]"] = start_time
        if end_time is not None:
            data["elements[0][end_time]"] = end_time
        if days:
            for i, day in enumerate(days):
                data[f"elements[0][days][{i}]"] = day
        return self._request("POST", "create_spot", data=data)

    # -- opcionales ----------------------------------------------------------
    def get_metrics(self, names: Sequence[str], start_date: str, end_date: str,
                    type: str = "details", zoom: str = "details") -> dict:
        params: dict[str, Any] = {"start_date": start_date, "end_date": end_date,
                                  "type": type, "zoom": zoom}
        params.update({"name[]": list(names)} if len(names) > 1 else {"name": names[0]})
        return self._request("GET", "get_metrics", params=params)

    def get_stats(self, auths: Sequence[str], start_date: str, end_date: str) -> dict:
        params: dict[str, Any] = {"start_date": start_date, "end_date": end_date}
        params.update({"auth[]": list(auths)} if len(auths) > 1 else {"auth": auths[0]})
        return self._request("GET", "get_stats", params=params)
