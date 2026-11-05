import type { ClaveTexto } from '../diccionario'

// ============================================================================
//  lib/i18n/textos/papeles-portugues.ts — LOS PAPELES EN PORTUGUES (pt-BR).
// ----------------------------------------------------------------------------
//  Tarea ROJA P3 del portugues (05/11, aprobada por el dueno: «Si, igual que
//  italiano»). Los papeles van en el idioma de los DOCUMENTOS de la instancia
//  (ADR 0049): en una instancia `pt`, la constancia de firmas, la propuesta
//  imprimible, la liga `/p`, el portal del cliente, el comprobante de cobranza
//  y los correos (propuesta, invitacion, restablecer contrasena y el aviso
//  diario de contratos) salen en portugues aunque la INTERFAZ siga apagada.
//
//  ─── POR QUE UN ARCHIVO APARTE Y NO LOS `PT_<AMBITO>` ──────────────────────
//  Estas claves viven en ambitos de los cinco lotes de traduccion
//  (`propuestas`, `cuenta`, `finanzas`, `arrendadores`, `notificaciones`,
//  `campanas`, `comercial`), que se traducen EN PARALELO. Escribirlas aqui
//  evita pisar sus archivos. `diccionario.ts` las mezcla DEBAJO de los lotes:
//  si un lote traduce una de estas claves, gana el lote. Y la costura lo
//  vigila (`papeles-portugues.test.ts`): si un lote la escribe DISTINTA, la
//  prueba se pone roja y alguien decide cual se queda, en vez de que un papel
//  cambie en silencio. Al cerrar los lotes, estas claves se mueven a su
//  `PT_<AMBITO>` y este archivo desaparece.
//
//  Glosario (el de los papeles; el comun lo fija L5 en `compartidos`):
//  pantalla → tela · sitio → ponto · propuesta → proposta · liga → link ·
//  arrendador/arrendatario → locador/locatario (como el contrato) · campana →
//  campanha · OT → OS · franja → faixa horaria · folio → numero. El IVA, el
//  CFDI y el SAT se quedan: son nombres propios del fisco mexicano.
// ============================================================================

export const PT_PAPELES: Partial<Record<ClaveTexto, string>> = {
  // ─── Constancia de firmas (acompaña al contrato) ─────────────────────────
  'arrendadores.constancia.titulo': 'Comprovante de assinatura eletrônica',
  'arrendadores.constancia.alerta':
    'ATENÇÃO: o contrato foi modificado depois de assinado. As assinaturas marcadas abaixo não correspondem ao texto deste documento e não devem ser consideradas válidas.',
  'arrendadores.constancia.intro':
    'Este documento foi selado em {fecha} e assinado eletronicamente pelas partes indicadas. O selo SHA-256 permite verificar que o texto não foi alterado desde a sua assinatura.',
  // Como no contrato em português (`contrato-documento.ts`).
  'arrendadores.constancia.parte.arrendador': 'O LOCADOR',
  'arrendadores.constancia.parte.arrendatario': 'O LOCATÁRIO',
  'arrendadores.constancia.invalidada': ' — ASSINATURA INVALIDADA',
  'arrendadores.constancia.fecha': 'Data e hora: {fecha}',
  'arrendadores.constancia.ip': 'Endereço IP: {ip}',
  'arrendadores.constancia.ip-no': 'não registrado',
  'arrendadores.constancia.navegador': 'Navegador: {navegador}',
  'arrendadores.constancia.navegador-no': 'não registrado',
  'arrendadores.constancia.sello': 'Selo do documento assinado: {hash}',
  'arrendadores.constancia.nota':
    'Assinatura eletrônica simples. O endereço IP e o navegador são dados fornecidos pelo próprio equipamento de quem assina e são conservados como indícios; por si sós não constituem prova de identidade. Este comprovante não inclui certificado de e.firma do SAT nem constância de conservação NOM-151.',

  // ─── Propuesta imprimible (`/propuesta/[id]`, lo que se imprime) ─────────
  'propuestas.documento.qr.acepta': 'Aceite-a on-line',
  'propuestas.documento.qr.consulta': 'Consulte-a on-line',
  'propuestas.documento.qr.acepta.texto': 'Escaneie o código ou abra este endereço para revisar a proposta e aceitá-la:',
  'propuestas.documento.qr.consulta.texto': 'Escaneie o código ou abra este endereço para consultar a proposta:',
  'propuestas.documento.encabezado': 'PROPOSTA COMERCIAL',
  'propuestas.documento.para': 'Para',
  'propuestas.documento.periodo': 'Período',
  'propuestas.documento.vigencia': 'Validade',
  'propuestas.documento.aceptada': 'Aceita em {fecha}',
  'propuestas.documento.vencio': 'Venceu em {fecha}',
  'propuestas.documento.valida-hasta': 'Válida até {fecha}',
  'propuestas.documento.se-fija': 'Definida ao enviá-la',
  'propuestas.documento.pantallas': 'TELAS',
  'propuestas.documento.col.pantalla': 'Tela e localização',
  'propuestas.documento.col.importe': 'Valor',
  'propuestas.documento.sin-foto': 'Sem foto',
  'propuestas.documento.franja': 'Faixa horária',
  'propuestas.documento.ubicacion': 'LOCALIZAÇÃO',
  'propuestas.documento.sin-coords': '{n} tela(s) sem coordenadas; o endereço está na tabela.',
  'propuestas.documento.importe': 'VALOR',
  'propuestas.documento.descuento': 'Desconto ({pct}%)',
  'propuestas.documento.comision': 'Comissão de agência ({pct}%)',
  'propuestas.documento.terminos': 'TERMOS E CONDIÇÕES',
  'propuestas.documento.aceptada-en-linea': 'ACEITA ON-LINE',
  'propuestas.documento.acepta-cliente': 'ACEITE DO CLIENTE',
  'propuestas.documento.firma': 'Nome, assinatura e data',

  // Piezas comunes que el documento y la liga publica comparten con la ficha.
  'propuestas.comun.sin-cliente': 'Sem cliente',
  'propuestas.comun.agencia': 'Agência',
  'propuestas.comun.via': ' · via {agencia}',
  'propuestas.comun.iva': 'IVA {pct}%',
  'propuestas.comun.neto': 'Líquido',
  'propuestas.comun.total': 'Total',
  'propuestas.comun.bruto-lista': 'Bruto (tabela de preços)',
  'propuestas.comun.paquete-conjunto': 'Pacote “{nombre}” — preço do conjunto',
  'propuestas.comun.descuento-volumen': 'Desconto por volume ({pct}%)',
  'propuestas.comun.codigo-pct': 'Código {codigo} ({pct}%)',
  'propuestas.ficha.meta.fechas': 'Datas',
  'propuestas.ficha.meta.anunciante': 'Anunciante',
  'propuestas.ficha.meta.directa': 'Direta',
  'propuestas.ficha.meta.comision': 'Comissão',
  'propuestas.ficha.resumen': 'Resumo financeiro',
  'propuestas.ficha.kpi.total': 'Total c/ IVA',
  'propuestas.ficha.total': 'Total que o cliente paga',
  'propuestas.ficha.sitios.vacia': 'Esta proposta não tem pontos.',
  'propuestas.ficha.mapa': 'Localização das telas',
  'propuestas.condiciones.terminos': 'Termos e condições',

  // ─── Liga publica de la propuesta (`/p/[id]`) ────────────────────────────
  'cuenta.comun.enlace-invalido': 'Link inválido',
  'cuenta.publica.no-corresponde': 'Este link não corresponde a nenhuma proposta.',
  'cuenta.publica.subtitulo': 'Proposta comercial',
  'cuenta.publica.aceptada': 'Aceita',
  'cuenta.publica.pendiente': 'Aguardando sua aprovação',
  'cuenta.publica.vencida': 'Proposta vencida',
  'cuenta.publica.solo-lectura': 'Somente leitura',
  'cuenta.publica.vencio-el': 'venceu em {fecha}',
  'cuenta.publica.valida-hasta': 'válida até {fecha}',
  'cuenta.publica.kpi.sitios': 'Pontos',
  'cuenta.publica.sitios': 'Pontos da proposta',
  'cuenta.publica.sin-ubicacion': 'Localização não cadastrada',
  'cuenta.publica.mapa.parcial.uno':
    '{faltan} de {n} tela não tem coordenadas cadastradas; o endereço está na lista de pontos.',
  'cuenta.publica.mapa.parcial.otros':
    '{faltan} de {n} telas não têm coordenadas cadastradas; o endereço está na lista de pontos.',
  'cuenta.publica.mapa.ninguna':
    'As telas desta proposta ainda não têm coordenadas cadastradas. Consulte o endereço de cada uma na lista de pontos.',
  'cuenta.publica.aceptada.titulo': 'Proposta aceita',
  'cuenta.publica.aceptada.detalle': 'Aceita em {fecha}. A equipe comercial foi notificada.',
  'cuenta.publica.aceptada.detalle-por': 'Aceita por {quien} em {fecha}. A equipe comercial foi notificada.',
  'cuenta.publica.aceptas': 'Você aceita esta proposta?',
  'cuenta.publica.al-aceptar.uno':
    'Ao aceitar, você confirma a {n} tela e o total de {total}. Seu aceite fica registrado com data e hora.',
  'cuenta.publica.al-aceptar.otros':
    'Ao aceitar, você confirma as {n} telas e o total de {total}. Seu aceite fica registrado com data e hora.',
  'cuenta.publica.tu-nombre': 'Seu nome e cargo',
  'cuenta.publica.aceptando': 'Aceitando…',
  'cuenta.publica.aceptar': 'Aceitar proposta',
  'cuenta.publica.vencida.detalle':
    'Esta proposta venceu em {fecha} e não pode mais ser aceita por aqui. Peça uma atualizada a quem a enviou.',
  'cuenta.publica.pie': 'Spaces · proposta comercial',
  'cuenta.publica.pie.solo-lectura': ' · este link é somente leitura',
  'cuenta.publica.error.nombre': 'Digite seu nome para aceitar',
  'cuenta.publica.error.aceptar': 'Não foi possível aceitar. Tente novamente.',

  // ─── Portal del cliente (`/portal/[token]`) ──────────────────────────────
  'cuenta.portal.no-corresponde': 'Este link de portal não corresponde a nenhuma campanha ativa.',
  'cuenta.portal.subtitulo': 'Portal do cliente',
  'cuenta.portal.seguimiento': 'Acompanhamento da campanha',
  'cuenta.portal.avance': 'Andamento da sua campanha',
  'cuenta.portal.ubicaciones': 'Localizações',
  'cuenta.portal.evidencias': 'Evidências de instalação',
  'cuenta.portal.pie': '{org} · portal de acompanhamento',
  // Las etapas del avance y la galeria de evidencias que pinta el portal.
  'campanas.etapa.reservada': 'Reservada',
  'campanas.etapa.confirmada': 'Confirmada',
  'campanas.etapa.oc-recibida': 'Pedido de compra recebido',
  'campanas.etapa.creativo-recibido': 'Criativo recebido',
  'campanas.etapa.creativo-validado': 'Criativo aprovado',
  'campanas.etapa.enviada-dominio': 'Enviada para publicação',
  'campanas.etapa.publicada': 'Publicada',
  'campanas.etapa.en-imprenta': 'Na gráfica',
  'campanas.etapa.en-produccion': 'Em produção',
  'campanas.etapa.instalada': 'Instalada / no ar',
  'campanas.etapa.reporte-generado': 'Relatório gerado',
  'campanas.etapa.lista-facturar': 'Pronta para faturar',
  'campanas.etapa.facturada': 'Faturada',
  'campanas.evidencia.vacia': 'Ainda sem fotos',
  'campanas.evidencia.vacia.texto': 'As evidências são enviadas ao encerrar a OS no celular.',
  'campanas.evidencia.alt': 'evidência',
  'campanas.evidencia.foto': 'foto',
  'campanas.evidencia.tomada': 'Data de criação da imagem',
  'campanas.evidencia.subida': 'Data de envio',
  // El tipo de medio de cada ponto, en `/p` y en el portal.
  'comercial.tipo-medio.espectacular': 'Outdoor',
  'comercial.tipo-medio.pantalla-digital': 'Tela digital',
  'comercial.tipo-medio.puente-peatonal': 'Passarela',
  'comercial.tipo-medio.mobiliario-urbano': 'Mobiliário urbano',
  'comercial.tipo-medio.mural': 'Mural',
  'comercial.tipo-medio.valla': 'Painel',
  'comercial.tipo-medio.otro': 'Outro',

  // ─── Comprobante de cobranza (el papel; los botones son interfaz) ────────
  'finanzas.comun.folio': 'Número',
  'finanzas.comun.folio-fiscal': 'Folio fiscal (UUID do CFDI)',
  'finanzas.comun.campana': 'Campanha',
  'finanzas.comun.la-emite': 'Emitente',
  'finanzas.comun.total': 'Total',
  'finanzas.comprobante.titulo': 'Comprovante {folio}',
  'finanzas.comprobante.la-recibe': 'Destinatário',
  'finanzas.comprobante.uso': 'Uso: {uso}',
  'finanzas.comprobante.serie': 'Série',
  'finanzas.comprobante.fecha': 'Data de emissão',
  'finanzas.comprobante.subtotal': 'Subtotal',
  'finanzas.comprobante.iva': 'IVA',
  'finanzas.comprobante.no-cuadra':
    'Os valores deste comprovante não batem: o subtotal mais o IVA não dá o total. Revise-o antes de entregá-lo.',
  'finanzas.comprobante.aviso':
    'Comprovante de pagamento. NÃO é um CFDI carimbado perante o SAT: o carimbo fiscal é emitido à parte e este documento não substitui o comprovante fiscal.',

  // ─── Correos ─────────────────────────────────────────────────────────────
  'propuestas.correo.asunto': 'Proposta comercial: {nombre} · {org}',
  'propuestas.correo.folio': 'Nº {folio}',
  'propuestas.correo.cuerpo':
    'Compartilhamos com você a nossa proposta comercial. No link você pode revisar as telas, as datas, os valores e os termos, e aceitá-la se estiver de acordo.',
  'propuestas.correo.boton': 'Ver a proposta',
  'propuestas.correo.vigencia': 'Você pode aceitá-la on-line até {fecha}.',
  'propuestas.correo.copiar': 'Se o botão não abrir, copie este endereço no seu navegador:',
  'cuenta.correo.invitacion.asunto': 'Você recebeu acesso ao Space OS · escolha sua senha',
  'cuenta.correo.invitacion.titulo': 'Você recebeu acesso ao Space OS',
  'cuenta.correo.invitacion.cuerpo':
    'Olá, {nombre}, uma conta foi criada para você no Space OS. Clique no botão para escolher sua senha. Este link vence em 72 horas e só pode ser usado uma vez.',
  'cuenta.correo.invitacion.boton': 'Escolher minha senha',
  'cuenta.correo.invitacion.pie':
    'Se o link venceu, peça a quem cadastrou você que envie outro. Se o botão não funcionar, copie e cole este link:',
  'cuenta.correo.reset.asunto': 'Redefina sua senha · Space OS',
  'cuenta.correo.reset.titulo': 'Redefinir sua senha',
  'cuenta.correo.reset.cuerpo':
    'Olá, {nombre}, recebemos uma solicitação para redefinir a senha da sua conta no Space OS. Clique no botão para escolher uma nova. Este link vence em 1 hora e só pode ser usado uma vez.',
  'cuenta.correo.reset.boton': 'Redefinir senha',
  'cuenta.correo.reset.pie':
    'Se você não solicitou isto, pode ignorar este e-mail; sua senha não vai mudar. Se o botão não funcionar, copie e cole este link:',
  'notificaciones.correo.contratos.asunto': 'Contratos que precisam de atenção: {resumen}',
  'notificaciones.correo.contratos.titulo': 'Contratos que precisam de atenção',
  'notificaciones.correo.contratos.pie': '{org} · este aviso é enviado uma vez por dia e só quando há algo novo.',
  'notificaciones.correo.resumen.vencido.uno': '{n} vencido',
  'notificaciones.correo.resumen.vencido.otros': '{n} vencidos',
  'notificaciones.correo.resumen.por-vencer': '{n} a vencer',
  'notificaciones.correo.resumen.sin-capturar': '{n} sem cadastro',
  // Cada aviso del correo diario (`traducirNotificacion`).
  'notificaciones.contrato.sin-capturar': 'Contrato sem cadastro: {contrato}',
  'notificaciones.contrato.sin-capturar.detalle':
    'Falta o locador, o valor do aluguel, a periodicidade ou a data de término. Enquanto estiver assim, não conta como custo, não gera calendário de pagamentos e a tela não pode ser reservada.',
  'notificaciones.contrato.vencido': 'Contrato vencido: {contrato}',
  'notificaciones.contrato.vencido.detalle.uno':
    'Venceu há {n} dia e ninguém o renovou. O espaço continua ocupado sem um acordo vigente que o respalde.',
  'notificaciones.contrato.vencido.detalle.otros':
    'Venceu há {n} dias e ninguém o renovou. O espaço continua ocupado sem um acordo vigente que o respalde.',
  'notificaciones.contrato.vence-hoy': 'Contrato vence HOJE: {contrato}',
  'notificaciones.contrato.vence-en.uno': 'Contrato vence em {n} dia: {contrato}',
  'notificaciones.contrato.vence-en.otros': 'Contrato vence em {n} dias: {contrato}',
  'notificaciones.contrato.vence-en.cero': 'Contrato vence HOJE: {contrato}',
  'notificaciones.contrato.por-vencer.detalle': 'Se for renovado, convém agir antes que vença.',
  'notificaciones.contrato.un-espacio': 'um espaço',
}
