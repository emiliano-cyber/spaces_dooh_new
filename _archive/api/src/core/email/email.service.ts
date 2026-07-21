import { Resend } from 'resend'

const FROM = process.env.EMAIL_FROM || 'alertas@spaces-dooh.com'
const isDev = process.env.NODE_ENV === 'development'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!)
  return _resend
}

interface AlertEmailData {
  to: string
  tipo: 'contrato' | 'licencia'
  nombre: string
  diasRestantes: number
  nivel: 'critico' | 'alerta' | 'aviso'
  extra?: Record<string, unknown>
}

export async function sendAlert(data: AlertEmailData): Promise<void> {
  const emoji = data.nivel === 'critico' ? '🔴' : data.nivel === 'alerta' ? '🟡' : '🟢'
  const subject = `${emoji} Vencimiento ${data.tipo}: ${data.nombre} (${data.diasRestantes} días)`

  if (isDev && !process.env.RESEND_API_KEY) {
    console.log(`[Email mock] TO: ${data.to} | ${subject}`)
    return
  }

  await getResend().emails.send({
    from: FROM,
    to: data.to,
    subject,
    html: `
      <h2>${emoji} Alerta de vencimiento</h2>
      <p><strong>Tipo:</strong> ${data.tipo}</p>
      <p><strong>Nombre:</strong> ${data.nombre}</p>
      <p><strong>Días restantes:</strong> ${data.diasRestantes}</p>
      <p><strong>Nivel:</strong> ${data.nivel.toUpperCase()}</p>
    `,
  })
}
