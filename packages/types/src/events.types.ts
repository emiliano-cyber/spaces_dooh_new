export type SpacesEvent =
  | {
      type: 'sitio.incidencia.created'
      payload: {
        sitioId: string
        tenantId: string
        tipo: string
        impactaComercial: boolean
        descripcion: string
      }
    }
  | {
      type: 'sitio.estatus.changed'
      payload: {
        sitioId: string
        tenantId: string
        estatusComercial: string
      }
    }
  | {
      type: 'contrato.vencimiento.proximo'
      payload: {
        contratoId: string
        tenantId: string
        diasRestantes: number
        sitioId: string
      }
    }
  | {
      type: 'licencia.vencimiento.proximo'
      payload: {
        licenciaId: string
        tenantId: string
        diasRestantes: number
        sitioId: string
      }
    }
  | {
      type: 'ot.completada'
      payload: {
        otId: string
        tenantId: string
        campanaId: string | null
      }
    }
  | {
      type: 'campana.confirmada'
      payload: {
        campanaId: string
        tenantId: string
        tipoCampana: string
      }
    }
  | {
      type: 'traffic.estado.changed'
      payload: {
        trafficOrderId: string
        tenantId: string
        estado: string
      }
    }
  | {
      type: 'campana.readiness.changed'
      payload: {
        campanaId: string
        tenantId: string
        listaParaFacturar: boolean
      }
    }
