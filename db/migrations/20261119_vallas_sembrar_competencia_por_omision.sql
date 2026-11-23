-- @tipo: esquema
-- ============================================================================
--  VALLAS · CATEGORÍAS DE COMPETENCIA POR OMISIÓN (19/11). Zona ROJA R3 (+ R2).
--  Aprobada por el dueño para la base local; en servidores sigue pendiente.
-- ----------------------------------------------------------------------------
--  Decisión del dueño: cada organización trae varias categorías de marcas que
--  compiten (Coca-Cola vs Pepsi, Liverpool vs Palacio de Hierro…) para que la
--  regla de competencia avise desde el primer día. El Dueño las edita después.
--
--  ESTA migración es para las organizaciones que YA existen. Las nuevas las
--  reciben en el alta (`crearOrgConDueno` → `sembrarCompetenciaPorOmision`,
--  `apps/web/lib/server/vallas-repo.ts`), con la lista de
--  `apps/web/lib/vallas/competencia-por-omision.ts`. La prueba
--  `competencia-por-omision.test.ts` exige que las dos listas sean IDÉNTICAS.
--
--  `@tipo: esquema` y no `datos` a propósito, como `20261012_razon_social_
--  principal.sql`: `update.sh` no pasa `--con-datos`, y con `datos` las
--  instancias existentes nunca recibirían las categorías.
--
--  EL ORDEN: va después de `20261119_vallas_esqueleto.sql` (que crea la tabla)
--  por nombre ('s' > 'e'), sin tocar `ANTES_DE` de `scripts/migrar.mjs`. Por
--  eso no se llama `..._vallas_competencia_por_omision.sql`: 'c' < 'e' la
--  habría corrido ANTES de que existiera la tabla.
--
--  IDEMPOTENTE: `on conflict do nothing` contra el índice único
--  `(tenant_id, lower(btrim(nombre)))`. Una categoría que la organización ya
--  tenga con ese nombre (aunque con otras marcas, o dada de baja) se respeta
--  tal cual; repetir la migración no duplica nada.
--
--  RLS (R2): la tabla tiene RLS FORZADA, que alcanza también al dueño de la
--  tabla. Por eso se fija `app.tenant_id` organización por organización (el
--  patrón de `20261012_razon_social_principal.sql`) y se limpia al final.
--
--  Solo INSERTA filas en `competencia_categorias`. Nada cambia de forma.
--  Nada posterior a PostgreSQL 14. Transaccional.
-- ============================================================================

begin;

do $$
declare
  t record;
begin
  for t in select id from tenants order by creado_en loop
    perform set_config('app.tenant_id', t.id::text, true);
    insert into competencia_categorias (tenant_id, nombre, marcas)
    select t.id, v.nombre, v.marcas
      from (values
        ('Refrescos de cola', array['Coca-Cola','Pepsi']),
        ('Tiendas departamentales', array['El Palacio de Hierro','Liverpool','Sears']),
        ('Telefonía', array['Telcel','AT&T','Movistar']),
        ('Bancos', array['BBVA','Banorte','Santander','Citibanamex','HSBC']),
        ('Cerveza', array['Grupo Modelo','Heineken México']),
        ('Comida rápida', array['McDonald''s','Burger King','KFC','Carl''s Jr.']),
        ('Pizzas', array['Domino''s','Pizza Hut','Little Caesars']),
        ('Autoservicio', array['Walmart','Soriana','Chedraui','La Comer']),
        ('Tiendas de conveniencia', array['OXXO','7-Eleven','Circle K']),
        ('Automotriz', array['Nissan','Volkswagen','Chevrolet','Toyota','KIA']),
        ('Streaming', array['Netflix','Disney+','Prime Video','Max']),
        ('Aerolíneas', array['Aeroméxico','Volaris','Viva Aerobus'])
      ) as v(nombre, marcas)
    on conflict do nothing;
  end loop;
  perform set_config('app.tenant_id', '', true);
end $$;

commit;

-- Sin consulta de comprobación al final, a propósito: con la RLS forzada y
-- `app.tenant_id` ya limpio, un `count(*)` hecho por el dueño de la tabla daría
-- CERO para todas y parecería que la migración no sembró nada. Se comprueba en
-- `vallas.e2e.test.ts` y, en una base real, con el `.cjs` del expediente.
