import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { leerSeguimientoPorToken } from './seguimiento-publico-repo'
import { contarEnviosDeHoy, guardarEnvio } from './envio-cliente-publico-repo'
import { validarAltaCreatividad } from './creativos-controller'
import { armarSeguimiento } from '@/lib/seguimiento-campana'
import { hoyEnMexico } from '@/lib/doohmain-estado'
import { imagenAHtml } from '@/lib/creativo-html'
import {
  LIMITE_ENVIOS_POR_DIA,
  dimensionesDeImagen,
  leerImagenEnvio,
  proporcionDePantalla,
  revisarProporcionEnvio,
  sanearNombreArchivo,
  truncarIp,
} from '@/lib/envio-creativo-cliente'

// ============================================================================
//  lib/server/envio-cliente-publico-controller.ts — CONTROLLER de «Subir
//  creativo» en la liga pública (ENVIO-CLIENTE, 18/11).
// ----------------------------------------------------------------------------
//  Orden de las puertas, y por qué:
//   1. Token con forma de token (404, sin tocar la base).
//   2. Cuerpo y archivo: tipo (400) y tamaño (413) ANTES de leer nada.
//   3. Token real → su propuesta → su campaña (404 si no existe; 409 si aún no
//      es campaña o ya no admite material: la misma regla que pinta la liga).
//   4. La pantalla elegida tiene que ser de ESA campaña (400).
//   5. La validación del creativo NORMAL (`crearSchema`: bytes reales contra el
//      tipo declarado, tope de la imagen envuelta) → 422, como en la ficha.
//   6. La PROPORCIÓN (decisión del dueño, 18/11: «sí, rechazar»): la medida
//      se lee de la cabecera del archivo, no de lo que diga el navegador, y
//      fuera de la tolerancia de la valoración del arte → 422. Un sitio sin
//      medida no se rechaza por proporción: no hay contra qué comparar.
//   7. Tope diario por campaña (429).
//  Y solo entonces se guarda, en `envios_creativo_cliente` y en ningún otro
//  sitio. La respuesta es mínima: ni id, ni campaña, ni tenant.
// ============================================================================

const TOKEN_VALIDO = /^[A-Za-z0-9_-]{16,128}$/

const cuerpoSchema = z.object({
  archivo: z.string().min(1, 'Falta el archivo'),
  nombre: z.string().max(500).nullish(),
  sitioId: z.string().uuid('Pantalla no válida').nullish(),
  ancho: z.coerce.number().int().min(1).max(30000).nullish(),
  alto: z.coerce.number().int().min(1).max(30000).nullish(),
})

export interface RespuestaEnvio {
  ok: true
  nombre: string
  estatus: 'PENDIENTE'
}

export async function enviarCreativoClienteCtrl(
  token: string,
  body: unknown,
  ip: string | null,
  ahora: Date = new Date(),
): Promise<RespuestaEnvio> {
  const tok = (token ?? '').trim()
  if (!TOKEN_VALIDO.test(tok)) throw new AppError('Propuesta no encontrada', 404)

  const d = validar(cuerpoSchema, body ?? {})
  const img = leerImagenEnvio(d.archivo)
  if (!img.ok) throw new AppError(img.error, img.status)

  const leido = await leerSeguimientoPorToken(tok)
  if (!leido) throw new AppError('Propuesta no encontrada', 404)
  if (!leido.datos || !leido.campana) {
    throw new AppError('Tu propuesta todavía no es campaña: el creativo se envía cuando la confirmemos', 409)
  }
  const seg = armarSeguimiento(leido.datos, hoyEnMexico(ahora))
  if (!seg.puedeSubirCreativo) {
    throw new AppError('Esta campaña ya no recibe creativos desde la liga. Escribe a tu asesor.', 409)
  }

  // Con una sola pantalla no se pregunta; con varias, el cliente elige.
  const pantallas = seg.pantallas
  let sitioId: string | null = d.sitioId ?? null
  if (sitioId && !pantallas.some((p) => p.id === sitioId)) {
    throw new AppError('Esa pantalla no es de tu campaña', 400)
  }
  if (!sitioId && pantallas.length === 1) sitioId = pantallas[0].id
  if (!sitioId && pantallas.length > 1) throw new AppError('Elige a qué pantalla va tu creativo', 400)

  const nombre = sanearNombreArchivo(d.nombre)
  // La medida REAL, de la cabecera. Lo que mande el navegador solo cuenta si
  // la cabecera no se puede leer y el sitio no exige proporción.
  const real = dimensionesDeImagen(Buffer.from(d.archivo.trim().split(',')[1] ?? '', 'base64'))
  const ancho = real?.ancho ?? d.ancho ?? null
  const alto = real?.alto ?? d.alto ?? null
  const resolucion = ancho && alto ? `${ancho}x${alto}` : null
  // La MISMA validación que el alta de un creativo desde la ficha, con el
  // creativo tal como se va a crear al aprobar (la imagen envuelta en HTML).
  validarAltaCreatividad({
    campanaId: leido.campana.id,
    nombre,
    codigo: imagenAHtml(d.archivo.trim(), nombre),
    formato: 'text/html',
    resolucion,
  })

  const pantalla = pantallas.find((p) => p.id === sitioId) ?? null
  if (pantalla && proporcionDePantalla(pantalla) != null) {
    if (!real) throw new AppError('No pudimos leer la medida de la imagen', 422)
    if (revisarProporcionEnvio(pantalla, real.ancho, real.alto)) {
      throw new AppError('La proporción de la imagen no coincide con la del sitio elegido', 422)
    }
  }

  if ((await contarEnviosDeHoy(leido.tenantId, leido.campana.id)) >= LIMITE_ENVIOS_POR_DIA) {
    throw new AppError('Ya recibimos varios archivos hoy para esta campaña. Inténtalo mañana o escribe a tu asesor.', 429)
  }

  const sitioNombre = pantallas.find((p) => p.id === sitioId)?.nombre ?? null
  const camp = leido.campana
  await guardarEnvio(
    leido.tenantId,
    {
      campanaId: camp.id,
      sitioId,
      nombreArchivo: nombre,
      tipoMime: img.tipo,
      tamanoBytes: img.bytes,
      anchoPx: ancho,
      altoPx: alto,
      contenido: d.archivo.trim(),
      ipTruncada: truncarIp(ip),
    },
    {
      // Las frases son plantillas de `notificaciones.campana.envio-cliente*`:
      // la campana las pinta en el idioma de quien la lee.
      titulo: 'El cliente envió un creativo para revisión',
      detalle: `${camp.folio ? `${camp.folio} · ` : ''}${camp.nombre} — archivo «${nombre}»${sitioNombre ? ` para ${sitioNombre}` : ''}`,
      link: `/campanas/${camp.id}`,
    },
  )
  return { ok: true, nombre, estatus: 'PENDIENTE' }
}
