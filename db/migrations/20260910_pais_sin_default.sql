-- ============================================================================
--  `sitios.pais` deja de ser obligatorio y deja de nacer en 'PE'.
--  (DATA-01, la mitad que el 26/08 no se pudo cerrar)
--
--  ── Que cierra ─────────────────────────────────────────────────────────────
--  El alta de una pantalla NO captura pais, y la columna se declaro
--  `not null default 'PE'` (`db/schema.sql:136`) cuando el producto se vendia
--  como «Billboards Peru SA». Consecuencia: toda pantalla dada de alta sin ese
--  dato queda registrada en Peru, y la liga PUBLICA de la pantalla lo imprime.
--
--  El 2026-08-26 se arreglaron `ciudad` y `estado` --pasaron a NULL cuando nadie
--  los captura-- y `pais` quedo fuera a proposito: quitarle el default y el NOT
--  NULL es esto, una migracion, y el comentario de `sitios-repo.ts` lo dejo
--  escrito como «lo unico que queda de DATA-01 sin arreglar».
--
--  ── La regla, que es la misma de agosto ────────────────────────────────────
--  Un dato AUSENTE se queda ausente. Inventar una ubicacion es peor que no
--  tenerla: un hueco se ve y se rellena; un dato falso se cree.
--
--  ── Por que no se cambia el default a 'MX' ─────────────────────────────────
--  Seria el mismo error con otra bandera. El artefacto es identico para toda la
--  flota y no puede saber en que pais opera cada owner: quemar un pais en la
--  base es exactamente lo que produjo este defecto.
--
--  ── Lo que esta migracion NO hace ──────────────────────────────────────────
--  NO toca ninguna fila. Las que ya dicen 'PE' siguen diciendolo, y eso es
--  deliberado: cambiar datos de un cliente es una decision suya, no un efecto
--  colateral de un despliegue. Las 12 pantallas de g500 --de CDMX y Edomex,
--  guardadas como Peru-- se corrigen con
--  `docs/datos/20260910_pais_mx_g500.sql`, que se aplica aparte y por decision
--  explicita.
--
--  Transaccional e idempotente. No borra datos ni cambia enums.
-- ============================================================================
begin;

alter table sitios alter column pais drop default;
alter table sitios alter column pais drop not null;

-- Comprobacion: que las dos cosas quedaron hechas de verdad. Un `alter` que no
-- aplica no da error, y este es justo el tipo de cambio que se da por hecho.
do $$
declare tiene_default boolean; es_obligatoria boolean;
begin
  select (a.atthasdef), (a.attnotnull)
    into tiene_default, es_obligatoria
    from pg_attribute a
   where a.attrelid = 'public.sitios'::regclass
     and a.attname = 'pais'
     and a.attnum > 0;

  if tiene_default then
    raise exception 'sitios.pais TODAVIA tiene DEFAULT';
  end if;
  if es_obligatoria then
    raise exception 'sitios.pais TODAVIA es NOT NULL';
  end if;

  raise notice 'sitios.pais: sin default y aceptando NULL.';
end $$;

commit;

-- ── Vuelta atras, si hiciera falta ──────────────────────────────────────────
-- Ojo: no se puede volver a NOT NULL si ya hay filas con NULL. Habria que
-- decidir antes que pais darles, que es justo la decision que este cambio
-- evita tomar por nadie.
--
--   alter table sitios alter column pais set default 'PE';
--   alter table sitios alter column pais set not null;
