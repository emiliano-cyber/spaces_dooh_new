"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  ImageOff,
  Images,
  Loader2,
  RefreshCw,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/demo/ui/Button";
import { ConfirmDialog } from "@/components/demo/ui/ConfirmDialog";
import { seApi, fotoSE, ErrorSE } from "@/lib/data/space-eyes-se";
import {
  crearZip,
  descargarBlob,
  giroDeFoto,
  marcaDeFoto,
  nombreDescarga,
  nombreEnZip,
  normalizarGiro,
  renderizarFoto,
  type FotoConMarca,
} from "@/lib/space-eyes-marca";
import { FotoGirada, fechaHora } from "./piezas";

// ============================================================================
//  Space Eyes — galería de fotos.
//
//  Port de `gallery.html` de Space Eye: todas las fotos de los equipos de la
//  instancia, con filtros por fecha, origen y equipo, visor en grande con la
//  marca (nombre · fecha · hora) y descarga de una foto o del álbum completo con
//  esa misma marca grabada.
//
//  El visor NO pone la marca encima con CSS como el original: dibuja la foto en
//  un lienzo con `renderizarFoto`, que es exactamente lo que se descarga. Así lo
//  que se mira y lo que se manda como evidencia no pueden diferir, ni siquiera
//  con la foto girada (con CSS, la marca quedaba en la caja sin girar).
// ============================================================================

const POR_PAGINA = 20;

interface FotoSE extends FotoConMarca {
  device_id: number;
  thumbnail_path: string | null;
  source: string | null;
  verification_status: string | null;
  is_correct: number | boolean | null;
  gps_lat: number | string | null;
  gps_lng: number | string | null;
}

interface EquipoSE {
  id: number;
  name: string;
}

interface Filtros {
  desde: string;
  hasta: string;
  origen: string;
  equipo: string;
}

const SIN_FILTROS: Filtros = { desde: "", hasta: "", origen: "", equipo: "" };

const ORIGENES: { valor: string; texto: string }[] = [
  { valor: "manual", texto: "Manual" },
  { valor: "scheduled", texto: "Programada" },
  { valor: "on_demand", texto: "A petición" },
  { valor: "creative_change", texto: "Creativo nuevo" },
  { valor: "falla", texto: "Falla de pantalla" },
  { valor: "boot", texto: "Al encender" },
];
const TEXTO_ORIGEN = Object.fromEntries(
  ORIGENES.map((o) => [o.valor, o.texto]),
);

const TEXTO_VERIFICACION: Record<string, string> = {
  pending: "Sin verificar",
  queued: "En cola",
  running: "Verificando",
  verified: "Verificada",
  failed: "Falló la verificación",
  skipped: "Omitida",
};

function mensaje(e: unknown, porOmision: string): string {
  if (e instanceof ErrorSE) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return porOmision;
}

// `to` llega como fecha sola, y en el servidor «<= 2026-10-01» es «<= las 00:00»:
// se perdía el día entero que el usuario eligió. Se manda hasta el último segundo.
function consulta(f: Filtros): string {
  const p: string[] = [];
  if (f.equipo) p.push(`device_id=${encodeURIComponent(f.equipo)}`);
  if (f.desde) p.push(`from=${encodeURIComponent(f.desde)}`);
  if (f.hasta) p.push(`to=${encodeURIComponent(`${f.hasta} 23:59:59`)}`);
  if (f.origen) p.push(`source=${encodeURIComponent(f.origen)}`);
  return p.join("&");
}

type Aviso = { tipo: "exito" | "error" | "info"; texto: string };

export function Galeria() {
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const [listo, setListo] = useState(false); // ya se leyó ?device_id= de la URL
  const [pagina, setPagina] = useState(1);
  const [fotos, setFotos] = useState<FotoSE[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [equipos, setEquipos] = useState<EquipoSE[]>([]);

  const [abierta, setAbierta] = useState<FotoSE | null>(null);
  const [aBorrar, setABorrar] = useState<FotoSE | null>(null);
  const [borrando, setBorrando] = useState(false);

  const [album, setAlbum] = useState<string | null>(null); // progreso, o null si no se está bajando
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const avisoT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const avisar = useCallback((texto: string, tipo: Aviso["tipo"] = "info") => {
    setAviso({ texto, tipo });
    if (avisoT.current) clearTimeout(avisoT.current);
    avisoT.current = setTimeout(() => setAviso(null), 3600);
  }, []);
  useEffect(
    () => () => {
      if (avisoT.current) clearTimeout(avisoT.current);
    },
    [],
  );

  // La ficha de un equipo puede abrir la galería con ?device_id=4.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("device_id");
    if (id) setFiltros((f) => ({ ...f, equipo: id }));
    setListo(true);
  }, []);

  useEffect(() => {
    let vivo = true;
    seApi<{ devices: EquipoSE[] }>("devices")
      .then((d) => {
        if (vivo)
          setEquipos(
            (d?.devices ?? []).map((x) => ({ id: x.id, name: x.name })),
          );
      })
      .catch(() => {
        /* el filtro de equipo se queda vacío; las fotos avisan si Space Eye no contesta */
      });
    return () => {
      vivo = false;
    };
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const q = consulta(filtros);
      const d = await seApi<{ photos: FotoSE[]; total: number }>(
        `photos?page=${pagina}&limit=${POR_PAGINA}${q ? `&${q}` : ""}`,
      );
      setFotos(d?.photos ?? []);
      setTotal(Number(d?.total) || 0);
    } catch (e) {
      setError(mensaje(e, "No se pudieron consultar las fotos"));
    }
    setCargando(false);
  }, [filtros, pagina]);

  useEffect(() => {
    if (listo) void cargar();
  }, [listo, cargar]);

  const cambiarFiltro = (k: keyof Filtros, v: string) => {
    setFiltros((f) => ({ ...f, [k]: v }));
    setPagina(1);
  };
  const hayFiltros =
    filtros.desde || filtros.hasta || filtros.origen || filtros.equipo;

  // Space Eye cuenta el total solo por equipo: con fechas u origen, ese total es
  // de más. Por eso «hay siguiente» también mira si esta página vino llena.
  const totalExacto = !filtros.desde && !filtros.hasta && !filtros.origen;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const haySiguiente =
    (fotos?.length ?? 0) === POR_PAGINA && pagina * POR_PAGINA < total;

  const borrar = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    try {
      await seApi(`photos/${aBorrar.id}`, { method: "DELETE" });
      const id = aBorrar.id;
      setFotos((fs) => (fs ?? []).filter((f) => f.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      if (abierta?.id === id) setAbierta(null);
      setABorrar(null);
      avisar("Fotografía eliminada", "exito");
    } catch (e) {
      avisar(
        `No se pudo eliminar la fotografía: ${mensaje(e, "error desconocido")}`,
        "error",
      );
    }
    setBorrando(false);
  };

  // Todas las fotos que coinciden con los filtros, de 100 en 100, con su marca.
  const descargarAlbum = async () => {
    if (album) return;
    setAlbum("Preparando…");
    try {
      const q = consulta(filtros);
      let todas: FotoSE[] = [];
      for (let p = 1; p <= 500; p++) {
        const d = await seApi<{ photos: FotoSE[]; total: number }>(
          `photos?limit=100&page=${p}${q ? `&${q}` : ""}`,
        );
        const lote = d?.photos ?? [];
        todas = todas.concat(lote);
        if (
          lote.length < 100 ||
          todas.length >= (Number(d?.total) || todas.length)
        )
          break;
      }
      if (todas.length === 0) {
        avisar("Sin fotos para descargar", "info");
        return;
      }
      const entradas: { nombre: string; datos: Uint8Array }[] = [];
      let fallidas = 0;
      for (let i = 0; i < todas.length; i++) {
        const f = todas[i];
        try {
          const url = fotoSE(f.storage_path);
          if (!url) throw new Error("sin ruta");
          const marca = marcaDeFoto(f);
          const giro = giroDeFoto(f);
          let blob: Blob;
          // Sin marca pero torcida se endereza igual: si no, el álbum saldría
          // con unas fotos derechas y otras de cabeza.
          if (marca || giro) blob = await renderizarFoto(url, giro, marca);
          else {
            const r = await fetch(url);
            if (!r.ok) throw new Error(String(r.status));
            blob = await r.blob();
          }
          entradas.push({
            nombre: nombreEnZip(f),
            datos: new Uint8Array(await blob.arrayBuffer()),
          });
        } catch {
          fallidas++; // se omite la que falle, como en Space Eye
        }
        setAlbum(`${i + 1}/${todas.length}`);
      }
      if (entradas.length === 0) {
        avisar("No se pudo descargar ninguna foto del álbum", "error");
        return;
      }
      const zip = crearZip(entradas);
      descargarBlob(
        new Blob([zip as BlobPart], { type: "application/zip" }),
        "album_fotos.zip",
      );
      avisar(
        fallidas
          ? `Álbum descargado; ${fallidas} foto${fallidas === 1 ? "" : "s"} no se pudo incluir`
          : "Álbum descargado",
        fallidas ? "info" : "exito",
      );
    } catch (e) {
      avisar(
        `Error al descargar el álbum: ${mensaje(e, "error desconocido")}`,
        "error",
      );
    } finally {
      setAlbum(null);
    }
  };

  const indiceAbierta = useMemo(
    () => (abierta && fotos ? fotos.findIndex((f) => f.id === abierta.id) : -1),
    [abierta, fotos],
  );

  const selectCls =
    "h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="w-full space-y-4 p-4 sm:p-6">
      {/* Encabezado, el mismo patrón que el listado de equipos */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
          <Images className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-ink">Galería de fotos</h1>
          <p className="text-[13px] text-muted">
            Todas las fotos de los equipos: programadas, pedidas a mano, de
            creativos nuevos y de fallas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void cargar()}
            disabled={cargando}
          >
            {cargando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Actualizar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => descargarAlbum()}
            disabled={!!album || (fotos?.length ?? 0) === 0}
            title="Descarga en un .zip todas las fotos que coinciden con los filtros, con su marca"
          >
            {album ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {album ? `Descargando ${album}` : "Descargar álbum"}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-3">
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 sm:flex-none">
          <span className="text-[12px] text-muted">Desde</span>
          <input
            type="date"
            value={filtros.desde}
            max={filtros.hasta || undefined}
            onChange={(e) => cambiarFiltro("desde", e.target.value)}
            className={selectCls}
          />
        </label>
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 sm:flex-none">
          <span className="text-[12px] text-muted">Hasta</span>
          <input
            type="date"
            value={filtros.hasta}
            min={filtros.desde || undefined}
            onChange={(e) => cambiarFiltro("hasta", e.target.value)}
            className={selectCls}
          />
        </label>
        <label className="flex min-w-[160px] flex-1 flex-col gap-1 sm:flex-none">
          <span className="text-[12px] text-muted">Origen</span>
          <select
            value={filtros.origen}
            onChange={(e) => cambiarFiltro("origen", e.target.value)}
            className={selectCls}
          >
            <option value="">Todos los orígenes</option>
            {ORIGENES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 sm:max-w-xs">
          <span className="text-[12px] text-muted">Equipo</span>
          <select
            value={filtros.equipo}
            onChange={(e) => cambiarFiltro("equipo", e.target.value)}
            className={selectCls}
          >
            <option value="">Todos los equipos</option>
            {/* Si se llegó con ?device_id= de un equipo que no está en la lista */}
            {filtros.equipo &&
              !equipos.some((x) => String(x.id) === filtros.equipo) && (
                <option value={filtros.equipo}>Equipo {filtros.equipo}</option>
              )}
            {equipos.map((x) => (
              <option key={x.id} value={String(x.id)}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        {hayFiltros && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => {
              setFiltros(SIN_FILTROS);
              setPagina(1);
            }}
          >
            <X className="h-3.5 w-3.5" />
            Quitar filtros
          </Button>
        )}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-error bg-error-soft p-3 text-[12px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-ink">
              No se pudieron consultar las fotos
            </div>
            <div className="text-muted">{error}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      ) : cargando && !fotos ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="aspect-[4/3] animate-pulse rounded-md bg-surface-2"
            />
          ))}
        </div>
      ) : (fotos?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-14 text-center text-[13px] text-muted">
          <ImageOff className="h-5 w-5" strokeWidth={1.4} />
          {hayFiltros
            ? "Sin fotos para los filtros seleccionados."
            : "Todavía no hay fotos de ningún equipo."}
        </div>
      ) : (
        <>
          <div
            className={cn(
              "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
              cargando && "opacity-60 transition-opacity",
            )}
          >
            {fotos!.map((f) => (
              <Miniatura
                key={f.id}
                foto={f}
                onAbrir={() => setAbierta(f)}
                onBorrar={() => setABorrar(f)}
              />
            ))}
          </div>

          {(pagina > 1 || haySiguiente) && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-4 py-2.5">
              <span className="text-[12px] text-muted">
                {totalExacto ? (
                  <>
                    <span className="demo-num text-ink">{total}</span> fotos
                  </>
                ) : (
                  "Fotos filtradas"
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagina <= 1 || cargando}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </Button>
                <span className="demo-num px-1 text-[12px] text-muted">
                  Página {pagina}
                  {totalExacto ? ` de ${paginas}` : ""}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!haySiguiente || cargando}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Siguiente <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Visor
        foto={abierta}
        onCerrar={() => setAbierta(null)}
        onBorrar={(f) => setABorrar(f)}
        avisar={avisar}
        anterior={
          indiceAbierta > 0
            ? () => setAbierta(fotos![indiceAbierta - 1])
            : undefined
        }
        siguiente={
          indiceAbierta >= 0 && fotos && indiceAbierta < fotos.length - 1
            ? () => setAbierta(fotos[indiceAbierta + 1])
            : undefined
        }
      />

      <ConfirmDialog
        open={!!aBorrar}
        onOpenChange={(v) => {
          if (!v) setABorrar(null);
        }}
        title="Eliminar fotografía"
        confirmLabel="Eliminar"
        busy={borrando}
        onConfirm={() => void borrar()}
      >
        <p className="text-ink">
          ¿Eliminar esta fotografía
          {aBorrar?.device_name ? ` de ${aBorrar.device_name}` : ""}?
        </p>
        <p className="mt-1">No se puede deshacer.</p>
      </ConfirmDialog>

      {aviso && (
        <div
          role="status"
          className={cn(
            "fixed bottom-4 right-4 z-[70] max-w-[calc(100vw-2rem)] rounded-md border px-4 py-3 text-[13px] text-ink",
            aviso.tipo === "exito" && "border-success bg-success-soft",
            aviso.tipo === "error" && "border-error bg-error-soft",
            aviso.tipo === "info" && "border-border bg-surface",
          )}
        >
          {aviso.texto}
        </div>
      )}
    </div>
  );
}

// ─── Una foto de la rejilla ─────────────────────────────────────────────────

function Verificacion({ foto }: { foto: FotoSE }) {
  const st = foto.verification_status ?? "pending";
  if (st === "verified") {
    const ok = foto.is_correct === 1 || foto.is_correct === true;
    return (
      <span className={cn("font-medium", ok ? "text-success" : "text-error")}>
        {ok ? "Verificada · correcta" : "Verificada · no coincide"}
      </span>
    );
  }
  return <span className="text-muted">{TEXTO_VERIFICACION[st] ?? st}</span>;
}

function Miniatura({
  foto,
  onAbrir,
  onBorrar,
}: {
  foto: FotoSE;
  onAbrir: () => void;
  onBorrar: () => void;
}) {
  const [rota, setRota] = useState(false);
  const src = fotoSE(foto.thumbnail_path || foto.storage_path);
  const giro = giroDeFoto(foto);
  return (
    <div className="group overflow-hidden rounded-md border border-border bg-surface transition-colors duration-150 hover:border-border-strong">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        <button
          type="button"
          onClick={onAbrir}
          className="relative block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          aria-label={`Ver foto de ${foto.device_name ?? "equipo"} en grande`}
        >
          {src && !rota ? (
            <FotoGirada
              src={src}
              alt={`Foto ${foto.id} de ${foto.device_name ?? "equipo"}`}
              giro={giro}
              loading="lazy"
              onError={() => setRota(true)}
              className="transition-opacity hover:opacity-90"
            />
          ) : (
            <span className="flex h-full flex-col items-center justify-center gap-1.5 text-muted">
              <ImageOff className="h-5 w-5" strokeWidth={1.4} />
              <span className="text-[12px]">No se pudo cargar</span>
            </span>
          )}
        </button>
        {foto.source && TEXTO_ORIGEN[foto.source] && (
          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] text-white backdrop-blur-sm">
            {TEXTO_ORIGEN[foto.source]}
          </span>
        )}
        <button
          type="button"
          onClick={onBorrar}
          title="Eliminar fotografía"
          aria-label="Eliminar fotografía"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded border border-error bg-surface text-error transition-opacity hover:bg-error-soft focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-0.5 p-2.5 text-[12px]">
        <div className="truncate font-medium text-ink">
          {foto.device_name ?? `Equipo ${foto.device_id}`}
        </div>
        <div className="text-muted">{fechaHora(foto.taken_at)}</div>
        <div>
          <Verificacion foto={foto} />
        </div>
      </div>
    </div>
  );
}

// ─── El visor en grande ─────────────────────────────────────────────────────

function Visor({
  foto,
  onCerrar,
  onBorrar,
  avisar,
  anterior,
  siguiente,
}: {
  foto: FotoSE | null;
  onCerrar: () => void;
  onBorrar: (f: FotoSE) => void;
  avisar: (t: string, tipo?: Aviso["tipo"]) => void;
  anterior?: () => void;
  siguiente?: () => void;
}) {
  const [giroUsuario, setGiroUsuario] = useState(0);
  const [render, setRender] = useState<{
    clave: string;
    url: string;
    blob: Blob;
  } | null>(null);
  const [fallo, setFallo] = useState(false);
  const [descargando, setDescargando] = useState(false);

  // Al cambiar de foto se vuelve a la orientación que decidió Space Eye.
  useEffect(() => {
    setGiroUsuario(0);
  }, [foto?.id]);

  const giro = foto ? normalizarGiro(giroUsuario + giroDeFoto(foto)) : 0;
  const clave = foto ? `${foto.id}:${giro}` : "";

  // La foto se dibuja con su marca en un lienzo: lo que se ve es lo que se baja.
  useEffect(() => {
    if (!foto) return;
    const url = fotoSE(foto.storage_path);
    if (!url) {
      setFallo(true);
      return;
    }
    let vivo = true;
    setFallo(false);
    renderizarFoto(url, giro, marcaDeFoto(foto))
      .then((blob) => {
        if (!vivo) return;
        setRender({ clave, blob, url: URL.createObjectURL(blob) });
      })
      .catch(() => {
        if (vivo) setFallo(true);
      });
    return () => {
      vivo = false;
    };
  }, [foto, giro, clave]);

  // Libera la imagen anterior al reemplazarla o al cerrar.
  useEffect(
    () => () => {
      if (render) URL.revokeObjectURL(render.url);
    },
    [render],
  );
  useEffect(() => {
    if (!foto) setRender(null);
  }, [foto]);

  const listo = render && render.clave === clave ? render : null;

  const descargar = async () => {
    if (!foto) return;
    setDescargando(true);
    try {
      const url = fotoSE(foto.storage_path);
      if (!url) throw new Error("La foto no tiene archivo");
      const blob =
        listo?.blob ?? (await renderizarFoto(url, giro, marcaDeFoto(foto)));
      descargarBlob(blob, nombreDescarga(foto), 4000);
      avisar("Descargando foto…", "exito");
    } catch (e) {
      avisar(
        `No se pudo descargar la foto: ${mensaje(e, "error desconocido")}`,
        "error",
      );
    }
    setDescargando(false);
  };

  const gps =
    foto?.gps_lat && foto?.gps_lng
      ? ` · GPS ${Number(foto.gps_lat).toFixed(5)}, ${Number(foto.gps_lng).toFixed(5)}`
      : "";
  const pie = foto
    ? `${foto.device_name ?? ""}${foto.taken_at ? ` · ${new Date(foto.taken_at).toLocaleString("es-MX")}` : ""}${gps}`
    : "";
  const miniatura = foto
    ? fotoSE(foto.thumbnail_path || foto.storage_path)
    : null;

  return (
    <Dialog.Root
      open={!!foto}
      onOpenChange={(v) => {
        if (!v) onCerrar();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/85 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="demo-root fixed inset-0 z-50 flex flex-col outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" && anterior) {
              e.preventDefault();
              anterior();
            }
            if (e.key === "ArrowRight" && siguiente) {
              e.preventDefault();
              siguiente();
            }
          }}
        >
          <Dialog.Title className="sr-only">
            Foto de {foto?.device_name ?? "equipo"}
          </Dialog.Title>
          <Dialog.Description className="sr-only">{pie}</Dialog.Description>

          <div className="flex shrink-0 justify-end p-2 sm:p-3">
            <Dialog.Close
              className="flex h-10 w-10 items-center justify-center rounded text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Cerrar"
            >
              <X className="h-6 w-6" />
            </Dialog.Close>
          </div>

          {/* Clic fuera de la foto = cerrar, como en Space Eye */}
          <div
            className="relative flex min-h-0 flex-1 cursor-zoom-out items-center justify-center px-2 sm:px-14"
            onClick={(e) => {
              if (e.target === e.currentTarget) onCerrar();
            }}
          >
            {anterior && (
              <button
                type="button"
                onClick={anterior}
                aria-label="Foto anterior"
                className="absolute left-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/80 hover:bg-black/70 hover:text-white sm:left-3"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {siguiente && (
              <button
                type="button"
                onClick={siguiente}
                aria-label="Foto siguiente"
                className="absolute right-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/80 hover:bg-black/70 hover:text-white sm:right-3"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}

            {listo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listo.url}
                alt={`Foto de ${foto?.device_name ?? "equipo"}`}
                className="max-h-full max-w-full cursor-default rounded object-contain"
              />
            ) : fallo ? (
              <div className="flex flex-col items-center gap-2 text-center text-[13px] text-white/80">
                <ImageOff className="h-6 w-6" strokeWidth={1.4} />
                No se pudo cargar la foto.
              </div>
            ) : (
              <div className="relative flex items-center justify-center">
                {miniatura && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={miniatura}
                    alt=""
                    style={
                      giro ? { transform: `rotate(${giro}deg)` } : undefined
                    }
                    className="max-h-[70vh] max-w-full rounded object-contain opacity-40 blur-[1px]"
                  />
                )}
                <Loader2 className="absolute h-7 w-7 animate-spin text-white" />
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 p-3 text-[13px] text-white/80 sm:p-4">
            <span className="w-full text-center sm:w-auto">{pie}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setGiroUsuario((g) => (g + 90) % 360)}
            >
              <RotateCw className="h-3.5 w-3.5" /> Rotar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => descargar()}
              disabled={descargando || (!listo && !fallo)}
            >
              {descargando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Descargar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => foto && onBorrar(foto)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
