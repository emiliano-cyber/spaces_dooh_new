// ============================================================================
//  lib/server/logo-sql.ts — El token del logo, SOLO si hay logo.
//
//  `config_negocio.logo_token` es NOT NULL (20260805_logo_publico.sql): toda
//  organización nace con uno, tenga logo o no. `logo_url` sí puede ser null.
//  Los membretes armaban `/api/logo/<token>` con el token a secas y esa ruta
//  responde 404 cuando no hay imagen, así que una organización sin logo le
//  enseñaba al cliente un icono de imagen rota en la cabecera de la liga
//  pública (hallazgo B, 19/11). En el correo era peor: el hueco lo ve alguien
//  de fuera.
//
//  Se decide en SQL y no leyendo `logo_url` en Node porque `logo_url` es un
//  data URL de hasta 2 MB: traerlo solo para saber si existe es justo lo que
//  la ruta del logo vino a evitar. `like 'data:image/%'` es la misma frontera
//  que aplica `decodificarDataUrl` (solo imágenes en data URL); un logo que
//  pase esto pero esté corrupto seguirá dando 404, y es un caso de datos
//  rotos, no el de todos los días.
// ============================================================================

export function sqlTokenLogoServible(alias?: string): string {
  const p = alias ? `${alias}.` : ''
  return `case when ${p}logo_url ilike 'data:image/%' then ${p}logo_token end as logo_token`
}
