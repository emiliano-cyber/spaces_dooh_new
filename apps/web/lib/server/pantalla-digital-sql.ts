import 'server-only'

// ============================================================================
//  lib/server/pantalla-digital-sql.ts — Qué cuenta como «pantalla digital»,
//  en SQL, una sola vez.
//
//  Lo usan DOS sitios que tienen que decir exactamente lo mismo:
//
//    · el guard de M14 en `enviarADominio` — qué pantallas EXIGE que tengan
//      creativo asignado antes de dejar publicar;
//    · el reparto de creativos en `creativos-repo` — a qué pantallas SE LO
//      ASIGNA de golpe.
//
//  Si los dos criterios se separaran, el fallo no seria ruidoso: seria una
//  campaña donde repartes creativos «a todas las pantallas», la app te dice que
//  quedó bien, y al enviar al dominio te la bloquea nombrando una pantalla que
//  el reparto no tocó porque no la consideraba digital. El usuario repetiría el
//  reparto una y otra vez sin entender por qué no avanza.
//
//  Es el mismo motivo por el que `TIPO_LABEL` dejó de estar copiado en cinco
//  componentes (M10) y por el que `tarifaDeSitio` es la única fuente de la
//  tarifa (A8): dos copias de una regla divergen, y aquí divergir es un callejón
//  sin salida para quien la usa.
//
//  El alias de la tabla `sitios` se pasa como parámetro porque las dos consultas
//  la nombran distinto. NO se interpola nada del usuario: el único argumento es
//  un literal escrito en este repositorio.
// ============================================================================

// Las tres señales son un OR a propósito, y no se simplifican: `tipo_medio` es
// el catálogo nuevo, `es_rotativo` y `exhibicion` son de la captura vieja y
// siguen siendo la única marca de digital en las pantallas cargadas antes del
// catálogo. Quitar cualquiera de las tres dejaría pantallas reales fuera.
export function esPantallaDigitalSql(alias = 's'): string {
  return `(${alias}.tipo_medio = 'PANTALLA_DIGITAL' or ${alias}.es_rotativo
           or ${alias}.exhibicion in ('digital','rotativo'))`
}
