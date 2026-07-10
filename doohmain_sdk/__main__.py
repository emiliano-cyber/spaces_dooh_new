"""CLI del SDK: la frontera que el handler TypeScript invoca por subproceso.

Cada subcomando imprime UNA línea JSON en stdout y termina con código 0 en
éxito. Ante DOOHmainError imprime {"ok": false, "error", "category", ...} y
termina con código 1, para que el handler no marque la campaña como enviada."""

from __future__ import annotations

import argparse
import json
import sys

from .errors import DOOHmainError


def _emit_ok(payload: dict) -> int:
    print(json.dumps({"ok": True, **payload}, ensure_ascii=False))
    return 0


def _emit_error(exc: DOOHmainError) -> int:
    print(json.dumps({"ok": False, **exc.to_dict()}, ensure_ascii=False))
    return 1


def _parse_fields(pairs: list[str] | None) -> dict[str, str]:
    out: dict[str, str] = {}
    for pair in pairs or []:
        if "=" not in pair:
            raise DOOHmainError(f"--field espera clave=valor, recibí: {pair!r}")
        key, _, value = pair.partition("=")
        out[key.strip()] = value
    return out


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="doohmain_sdk", description="CLI del SDK de DOOHmain")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("ping", help="Diagnóstico: lista de pantallas accesibles")

    ec = sub.add_parser("ensure-campaign", help="Crea/reutiliza la campaña remota")
    ec.add_argument("--version", required=True)
    ec.add_argument("--anunciante", required=True)
    ec.add_argument("--campana", required=True)
    ec.add_argument("--fecha-inicio", required=True)
    ec.add_argument("--fecha-fin", required=True)

    em = sub.add_parser("ensure-media", help="Sube/reutiliza el arte")
    em.add_argument("--filepath", required=True)
    em.add_argument("--version", required=True)

    ps = sub.add_parser("publish-spot", help="Agrega el arte a la sublista")
    ps.add_argument("--screen", required=True)
    ps.add_argument("--list", required=True, dest="list_name")
    ps.add_argument("--auth", required=True)
    ps.add_argument("--media-id", required=True, type=int)

    uc = sub.add_parser("update-campaign", help="Edita una campaña ya enviada")
    uc.add_argument("--auth", required=True)
    uc.add_argument("--field", action="append", help="clave=valor (repetible)")

    # Comando compuesto que usa el handler de aprobación: hace las 3 primitivas
    # con UNA sola conexión de BD y UN solo cliente HTTP.
    pub = sub.add_parser("publish", help="ensure_campaign + ensure_media + publish_spot")
    pub.add_argument("--version", required=True)
    pub.add_argument("--anunciante", required=True)
    pub.add_argument("--campana", required=True)
    pub.add_argument("--fecha-inicio", required=True)
    pub.add_argument("--fecha-fin", required=True)
    pub.add_argument("--filepath", required=True)
    pub.add_argument("--screen", required=True)
    pub.add_argument("--list", required=True, dest="list_name")
    return p


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)

    try:
        # Importación diferida DENTRO del try: --help no exige credenciales, y si
        # faltan (config valida al importar) el fallo sale como JSON, no traceback.
        from . import integration
        from .client import DOOHmainClient
        from .db import Database

        if args.cmd == "ping":
            return _emit_ok({"screens": integration.ping()})

        if args.cmd == "ensure-campaign":
            auth = integration.ensure_campaign(
                args.version, args.anunciante, args.campana,
                args.fecha_inicio, args.fecha_fin,
            )
            return _emit_ok({"auth": auth})

        if args.cmd == "ensure-media":
            media_id = integration.ensure_media(args.filepath, args.version)
            return _emit_ok({"media_id": media_id})

        if args.cmd == "publish-spot":
            estado = integration.publish_spot(
                args.screen, args.list_name, args.auth, args.media_id
            )
            return _emit_ok({"estado": estado})

        if args.cmd == "update-campaign":
            res = integration.update_campaign(args.auth, **_parse_fields(args.field))
            return _emit_ok({"result": res})

        if args.cmd == "publish":
            api = DOOHmainClient()
            db = Database()
            try:
                auth = integration.ensure_campaign(
                    args.version, args.anunciante, args.campana,
                    args.fecha_inicio, args.fecha_fin, api=api, db=db,
                )
                media_id = integration.ensure_media(
                    args.filepath, args.version, api=api, db=db
                )
                estado = integration.publish_spot(
                    args.screen, args.list_name, auth, media_id, api=api, db=db
                )
            finally:
                api.close()
                db.close()
            return _emit_ok({"auth": auth, "media_id": media_id, "estado": estado})

    except DOOHmainError as exc:
        return _emit_error(exc)
    except Exception as exc:  # error inesperado → mismo contrato para el handler
        return _emit_error(DOOHmainError(f"Error inesperado: {exc}"))

    return _emit_error(DOOHmainError(f"Comando desconocido: {args.cmd}"))


if __name__ == "__main__":
    sys.exit(main())
