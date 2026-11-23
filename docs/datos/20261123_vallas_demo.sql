-- ============================================================================
--  20261123_vallas_demo.sql — vallas de EJEMPLO para la DEMO (demo.space-os.io)
-- ----------------------------------------------------------------------------
--  Pedido del dueño el 23/11: que la DEMO tenga vallas para enseñar el módulo.
--
--  POR QUÉ NO ES `semilla-catalogo-demo.mjs`, que ya siembra vallas: esa semilla
--  las cuelga de los sitios `CAT-F01`… de su negocio de demostración, y la DEMO
--  de hoy NO es esa base: desde el 06/11 corre sobre una copia de los datos de
--  g500 (guía 31, ADR 0050), sin sitios `CAT-`. Además los scripts de semilla no
--  viajan en la imagen. Esto es SQL suelto que corre `psql` en el droplet.
--
--  Qué deja, todo con prefijo DEMO- para reconocerlo y quitarlo:
--    · 3 sitios fijos   DEMO-VAL-01..03 (Reforma, Periférico Sur, Insurgentes)
--    · 2 grupos         DEMO-G01 «una sola imagen» (3 cuadros, el del medio en
--                       esquina) y DEMO-G02 «separadas» (dos caras)
--    · 7 vallas         DEMO-V01..V07
--  Las categorías de competencia ya las siembra la migración
--  20261119_vallas_sembrar_competencia_por_omision.sql; aquí no se tocan.
--
--  Requisitos: la DEMO en v0.12.15 o posterior (las tablas de vallas y la
--  columna `dobla` llegan con la imagen). Si faltan, para sin tocar nada.
--
--  Uso (en el droplet, como postgres: salta la RLS a propósito, la organización
--  se fija a mano en cada fila):
--    sudo -u postgres psql -d spaces -v ON_ERROR_STOP=1 -v org=<slug> -f 20261123_vallas_demo.sql
--
--  Idempotente: correrlo dos veces no duplica nada (on conflict do nothing).
--  Vuelta atrás: 20261123_vallas_demo_rollback.sql.
-- ============================================================================

begin;

-- La organización por su slug. Una variable de psql no entra en un bloque DO,
-- así que pasa por una tabla temporal.
create temp table _org on commit drop as
  select id from tenants where slug = :'org';

do $$
begin
  if (select count(*) from _org) <> 1 then
    raise exception 'No hay una organizacion con ese slug. Mira los slugs con: select slug, nombre from tenants;';
  end if;
  if to_regclass('public.vallas') is null or to_regclass('public.vallas_grupos') is null then
    raise exception 'Esta base no tiene las tablas de vallas: actualiza la DEMO a v0.12.15 o posterior antes.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'vallas' and column_name = 'dobla') then
    raise exception 'Falta la columna vallas.dobla (20261120_vallas_esquina.sql): actualiza la DEMO antes.';
  end if;
end $$;

-- ── Sitios fijos ───────────────────────────────────────────────────────────
insert into sitios (tenant_id, clave_interna, nombre, tipo_medio, ancho, alto, caras,
                    iluminado, direccion, ciudad, pais, lat, lng)
select o.id, s.clave, s.nombre, s.tipo::tipo_medio, s.ancho, s.alto, s.caras,
       true, s.direccion, 'Ciudad de México', 'MX', s.lat, s.lng
  from _org o,
  (values
    ('DEMO-VAL-01', 'Espectacular DEMO Reforma Norte', 'ESPECTACULAR', 12.9, 7.2, 1,
     'Paseo de la Reforma DEMO 000, Cuauhtémoc', 19.4270000, -99.1677000),
    ('DEMO-VAL-02', 'Espectacular DEMO Periférico Sur', 'ESPECTACULAR', 12.9, 7.2, 2,
     'Anillo Periférico Sur DEMO 000, Coyoacán', 19.3030000, -99.2050000),
    ('DEMO-VAL-03', 'Valla DEMO Insurgentes Norte', 'VALLA', 8, 3, 2,
     'Avenida Insurgentes Norte DEMO 000, Gustavo A. Madero', 19.4700000, -99.1400000)
  ) as s(clave, nombre, tipo, ancho, alto, caras, direccion, lat, lng)
on conflict (clave_interna) do nothing;

-- ── Grupos ─────────────────────────────────────────────────────────────────
insert into vallas_grupos (tenant_id, numero, nombre, modo, ancho_m, alto_m, notas)
select o.id, g.numero, g.nombre, g.modo, g.ancho, g.alto, g.notas
  from _org o,
  (values
    ('DEMO-G01', 'Reforma Norte · tres cuadros, una imagen', 'una_imagen', 12.9, 7.2,
     'Se vende entero: un solo arte de 12.9 x 7.2 m.'),
    ('DEMO-G02', 'Periférico Sur · dos caras', 'separadas', null, null,
     'Se venden juntas; cada cara lleva su arte.')
  ) as g(numero, nombre, modo, ancho, alto, notas)
on conflict do nothing;

-- ── Vallas ─────────────────────────────────────────────────────────────────
insert into vallas (tenant_id, sitio_id, numero, cara, ancho_m, alto_m, grupo_id, posicion, notas, dobla)
select o.id, si.id, v.numero, v.cara, v.ancho, v.alto, g.id, v.posicion, v.notas, v.dobla
  from _org o
  cross join (values
    ('DEMO-V01', 'DEMO-VAL-01', 1, 4.3,  7.2, 'DEMO-G01', 1, 'Cuadro izquierdo del espectacular.', null),
    ('DEMO-V02', 'DEMO-VAL-01', 1, 4.3,  7.2, 'DEMO-G01', 2, 'Cuadro central: aquí la pared dobla.', 'derecha'),
    ('DEMO-V03', 'DEMO-VAL-01', 1, 4.3,  7.2, 'DEMO-G01', 3, 'Cuadro derecho, en la otra pared.', null),
    ('DEMO-V04', 'DEMO-VAL-02', 1, 12.9, 7.2, 'DEMO-G02', 1, 'Cara norte.', null),
    ('DEMO-V05', 'DEMO-VAL-02', 2, 12.9, 7.2, 'DEMO-G02', 2, 'Cara sur.', null),
    ('DEMO-V06', 'DEMO-VAL-03', 1, 8,    3,   null,       null, 'Cara oriente.', null),
    ('DEMO-V07', 'DEMO-VAL-03', 2, 8,    3,   null,       null, 'Cara poniente.', null)
  ) as v(numero, sitio, cara, ancho, alto, grupo, posicion, notas, dobla)
  join sitios si on si.clave_interna = v.sitio and si.tenant_id = o.id
  left join vallas_grupos g on g.tenant_id = o.id and upper(btrim(g.numero)) = v.grupo
on conflict do nothing;

-- Lo que quedó, para verlo en la consola.
select v.numero, s.clave_interna as sitio, v.cara, v.ancho_m, v.alto_m,
       g.numero as grupo, v.posicion, v.dobla
  from vallas v
  join sitios s on s.id = v.sitio_id
  left join vallas_grupos g on g.id = v.grupo_id
 where v.tenant_id = (select id from _org) and v.numero like 'DEMO-V%'
 order by v.numero;

commit;
