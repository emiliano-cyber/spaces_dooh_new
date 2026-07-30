-- ============================================================================
-- Ejemplo de contrato de arrendamiento de espacio publicitario para la DEMO.
--
-- Rellena los datos que el generador del documento necesita y que normalmente
-- se capturan una vez por organización, más un contrato completo de muestra.
-- Sirve para ver el documento (/spaces-dooh/contrato/<id>) con todos los campos
-- llenos, sin huecos marcados.
--
-- Es idempotente: se puede correr varias veces.
--
-- Ejecutar:  docker exec -i spaces_db psql -U spaces -d spaces -f - < db/seeds/contrato-ejemplo.sql
--
-- Los datos fiscales son FICTICIOS (RFC y escritura de ejemplo). Sustitúyelos
-- por los reales antes de usar el documento para algo que no sea una demo.
-- ============================================================================

begin;

-- ─── Parte ARRENDATARIA: la organización ────────────────────────────────────
update tenants set
  razon_social        = coalesce(razon_social, 'RGB Catorce, S. de R.L. de C.V.'),
  rfc                 = coalesce(rfc, 'RCA210315J38'),
  domicilio_fiscal    = coalesce(domicilio_fiscal,
                          'Av. Paseo de la Reforma 505, piso 12, Col. Cuauhtémoc, '
                          || 'Alcaldía Cuauhtémoc, C.P. 06500, Ciudad de México'),
  representante_legal = coalesce(representante_legal, 'José Antonio López Hernández'),
  datos_constitucion  = coalesce(datos_constitucion,
                          'la escritura pública número 45,872 de fecha 15 de marzo de 2021, '
                          || 'otorgada ante la fe del Lic. Ricardo Mendoza Ruiz, Notario Público '
                          || 'número 128 de la Ciudad de México, inscrita en el Registro Público '
                          || 'de Comercio bajo el folio mercantil electrónico 2021-45872')
where id = (select id from tenants order by creado_en asc limit 1);

-- ─── Parte ARRENDADORA: propietario del inmueble ────────────────────────────
update arrendadores set
  nacionalidad = coalesce(nacionalidad, 'mexicana'),
  rfc          = coalesce(rfc, 'MERC750412H21'),
  direccion    = coalesce(direccion,
                   'Calle Río Nazas 88, Col. Cuauhtémoc, Alcaldía Cuauhtémoc, '
                   || 'C.P. 06500, Ciudad de México'),
  telefono     = coalesce(telefono, '55 1234 5678'),
  email        = coalesce(email, 'contacto@demoarrendador.mx')
where nombre = 'DEMO Arrendador';

-- Razón social del arrendador, para que el contrato pueda anclar el CFDI.
insert into arrendador_razon_social (tenant_id, arrendador_id, razon_social, rfc, regimen)
select a.tenant_id, a.id, 'Carlos Mercado Ruiz', 'MERC750412H21',
       '605 - Sueldos y Salarios e Ingresos Asimilados a Salarios'
  from arrendadores a
 where a.nombre = 'DEMO Arrendador'
   and not exists (select 1 from arrendador_razon_social rs where rs.arrendador_id = a.id);

-- ─── Términos del contrato de muestra ───────────────────────────────────────
-- Se aplican al contrato de la pantalla DIG-001 si existe. Lo deja VIGENTE y
-- completo: 2 años, renta mensual, depósito de 2 meses e incremento anual.
update contratos_arrendamiento c set
  fecha_inicio         = date '2026-08-01',
  fecha_fin            = date '2028-07-31',
  monto_renta          = 25000,
  periodicidad         = 'MENSUAL',
  deposito             = 50000,
  dia_pago             = 5,
  incremento_anual_pct = 8.00,
  uso_permitido        = 'la instalación, operación y explotación comercial de una pantalla '
                         || 'publicitaria digital tipo LED, incluidos sus anclajes, estructura '
                         || 'de soporte, acometida eléctrica y equipos de control',
  ciudad_firma         = 'Ciudad de México',
  auto_renovable       = true,
  estatus              = 'VIGENTE'
from sitios s
where s.id = c.sitio_id and s.codigo_proveedor = 'DIG-001';

commit;

-- Para ver el documento:
--   select 'contrato/' || c.id from contratos_arrendamiento c
--     join sitios s on s.id = c.sitio_id where s.codigo_proveedor = 'DIG-001';
