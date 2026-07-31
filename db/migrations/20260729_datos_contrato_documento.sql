-- ============================================================================
-- Datos que faltaban para poder REDACTAR el contrato de arrendamiento, no solo
-- registrarlo.
--
-- Hasta ahora `contratos_arrendamiento` guardaba lo que hace falta para el P&L
-- —vigencia, importe, periodicidad, arrendador— y `documento_url` era un hueco
-- para SUBIR un PDF redactado fuera. Nada permitía generar el documento desde el
-- sistema: un contrato mexicano abre con DECLARACIONES de ambas partes, y de la
-- parte ARRENDATARIA (la empresa) no se guardaba absolutamente nada legal.
--
--   · `tenants` tenía razon_social y nombre_comercial, pero no RFC, ni domicilio
--     fiscal, ni representante legal, ni datos de constitución.
--   · `config_negocio` no sirve para esto: no tiene `tenant_id`, es global.
--     Los datos fiscales son POR organización, así que van en `tenants`.
--
-- Del lado ARRENDADOR ya estaba casi todo (nombre, rfc, curp, direccion en
-- `arrendadores`); solo faltaba la nacionalidad, que la declaración pide.
--
-- Todo es NULLABLE a propósito: son datos que se capturan una vez y no deben
-- bloquear nada de lo que ya funciona. El generador del documento marca de forma
-- visible lo que falte en vez de inventarlo.
-- ============================================================================

-- Parte ARRENDATARIA: la organización que renta el espacio.
alter table tenants
  add column if not exists rfc                text,
  add column if not exists domicilio_fiscal   text,
  add column if not exists representante_legal text,
  -- Escritura/notaría/fecha de constitución. Texto libre porque la declaración
  -- lo recita en prosa y el formato varía por fedatario.
  add column if not exists datos_constitucion text;

-- Parte ARRENDADORA: solo faltaba la nacionalidad para la declaración.
alter table arrendadores
  add column if not exists nacionalidad text;

-- Términos que el documento recita y que no se derivan de los ya existentes.
alter table contratos_arrendamiento
  -- Ciudad donde se firma; fija la jurisdicción de la cláusula final. Si es
  -- NULL, el generador cae a la ciudad del predio/pantalla.
  add column if not exists ciudad_firma text,
  -- Día del mes en que se paga la renta (1–31). La periodicidad dice CADA
  -- CUÁNTO; esto dice CUÁNDO, que es lo que la cláusula de pago necesita.
  add column if not exists dia_pago integer,
  -- Incremento anual pactado, en porcentaje. NULL = sin incremento pactado.
  add column if not exists incremento_anual_pct numeric(5,2),
  -- Uso permitido del espacio (p. ej. "instalación y explotación de una
  -- estructura publicitaria tipo espectacular").
  add column if not exists uso_permitido text;

alter table contratos_arrendamiento
  add constraint contrato_dia_pago_ck
  check (dia_pago is null or (dia_pago between 1 and 31)) not valid;

alter table contratos_arrendamiento
  add constraint contrato_incremento_ck
  check (incremento_anual_pct is null or (incremento_anual_pct >= 0 and incremento_anual_pct <= 100)) not valid;
