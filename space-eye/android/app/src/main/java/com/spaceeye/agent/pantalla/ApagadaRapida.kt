// ApagadaRapida.kt — Pantalla COMPLETA apagada: aviso en menos de un minuto.
package com.spaceeye.agent.pantalla

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.sqrt

/**
 * La revision de siempre (SaludAnalisis + Seguimiento) confirma una falla en dos
 * vueltas separadas para no dar falsas alarmas, y eso tarda de 5 minutos a horas
 * segun la frecuencia. Para el caso mas grave -la pantalla entera negra en su
 * horario- eso es demasiado: aqui se mira en CADA vistazo. Igual que en la
 * Raspberry (pi-agent/vision/apagada_rapida.py).
 *
 * Se da por apagada cuando, en [vistazos] miradas seguidas (unos 45 s en continuo):
 *   - la pantalla esta oscura y pareja (brillo medio < BRILLO_MAX y poca
 *     variacion), y
 *   - lo de alrededor NO esta oscuro (brillo medio fuera > FUERA_MIN).
 * Lo segundo separa "la pantalla se apago" de "es de noche" o "taparon la lente":
 * en esos dos casos todo se ve oscuro y lo decide la revision de siempre
 * (sin_imagen), con su confirmacion.
 *
 * Solo dice CUANDO avisar (una vez por apagon); quien avisa, con que foto y como
 * se cierra despues es el Monitor, por el mismo camino que las demas fallas.
 * Codigo puro (recibe los grises como bytes) para probarlo en la PC.
 */
class DetectorApagada(val vistazos: Int = VISTAZOS) {

    companion object {
        const val VISTAZOS = 3
        const val BRILLO_MAX = 40.0
        const val DESVIACION_MAX = 14.0
        const val FUERA_MIN = 45.0
        const val CLAVE = "pantalla_apagada"

        /** Encendido por omision: solo se apaga si el servidor dice aviso_rapido=false. */
        fun activo(salud: JSONObject?): Boolean =
            salud?.optBoolean("vigilar") == true && salud.optBoolean("aviso_rapido", true)

        /**
         * Si este apagon merece aviso. Solo si ya se vio la pantalla funcionando
         * alguna vez (recien instalada, o con el marco mal puesto, un "apagon"
         * seria una falsa alarma), si no esta ya abierta, si nadie la silencio y si
         * queda tope de alertas del dia.
         */
        fun puedeAvisar(vueltasSalud: Int, yaAbierta: Boolean, silenciada: Boolean, restantesHoy: Int): Boolean =
            vueltasSalud > 0 && !yaAbierta && !silenciada && restantesHoy > 0

        /**
         * La configuracion de esta vuelta se pidio ANTES de abrir la falla: se anota
         * en sus `abiertas` como la anotara el servidor. Si no, la revision de esta
         * misma vuelta (Seguimiento.sincronizar) la olvidaria y la siguiente vuelta
         * la abriria otra vez. Las pruebas de la Raspberry cazaron eso.
         */
        fun silenciada(salud: JSONObject): Boolean =
            salud.optJSONArray("silenciadas")?.let { a -> (0 until a.length()).any { a.optString(it) == CLAVE } } == true

        /**
         * Tras reportar el aviso: queda abierta en el Seguimiento (con el numero del
         * servidor, o sin el si no hubo red y va a la cola) para no repetirse y para
         * cerrarse sola cuando la pantalla vuelva, y gasta una del tope del dia.
         */
        fun anotar(seguimiento: Seguimiento, salud: JSONObject, id: Long?) {
            seguimiento.abrirExterna(CLAVE, id)
            if (id != null) anotarAbierta(salud, id)
            salud.put("restantes_hoy", salud.optInt("restantes_hoy", 6) - 1)
        }

        fun anotarAbierta(salud: JSONObject, id: Long) {
            val a = salud.optJSONArray("abiertas") ?: JSONArray().also { salud.put("abiertas", it) }
            a.put(JSONObject().put("id", id).put("tipo", CLAVE))
        }
    }

    /** Lo que se midio en un vistazo. */
    data class Medida(val oscura: Boolean, val fueraIluminada: Boolean, val brillo: Double, val fuera: Double)

    var seguidos = 0
        private set
    private var mascara: BooleanArray? = null
    private var claveMascara: String? = null

    fun reiniciar() { seguidos = 0 }

    /**
     * @param pantalla gris de la pantalla enderezada (ancho x alto, 1 byte por pixel)
     * @param marco    gris de la foto entera reducida, en la misma orientacion que
     *                 las esquinas marcadas en el dashboard
     * @param esquinas de la pantalla, en fracciones del marco
     */
    fun medir(pantalla: ByteArray, marco: ByteArray, anchoMarco: Int, altoMarco: Int,
              esquinas: List<Pair<Double, Double>>): Medida {
        var suma = 0.0
        var suma2 = 0.0
        for (b in pantalla) { val x = (b.toInt() and 0xff).toDouble(); suma += x; suma2 += x * x }
        val n = pantalla.size.coerceAtLeast(1)
        val brillo = suma / n
        val desv = sqrt((suma2 / n - brillo * brillo).coerceAtLeast(0.0))

        val fuera = fueraDe(anchoMarco, altoMarco, esquinas)
        var sf = 0.0
        var nf = 0
        for (i in 0 until minOf(marco.size, fuera.size)) if (fuera[i]) { sf += (marco[i].toInt() and 0xff); nf++ }
        val brilloFuera = if (nf == 0) 0.0 else sf / nf
        val oscura = brillo < BRILLO_MAX && desv < DESVIACION_MAX
        return Medida(oscura, brilloFuera > FUERA_MIN, brillo, brilloFuera)
    }

    /** true UNA vez, en el vistazo en que se completa el apagon. */
    fun observar(m: Medida): Boolean {
        if (m.oscura && m.fueraIluminada) {
            seguidos++
            return seguidos == vistazos
        }
        seguidos = 0
        return false
    }

    /** Mascara de lo que queda FUERA de la pantalla en el marco (se recalcula si cambia algo). */
    private fun fueraDe(w: Int, h: Int, esquinas: List<Pair<Double, Double>>): BooleanArray {
        val clave = "$w x $h|$esquinas"
        mascara?.let { if (clave == claveMascara) return it }
        val px = esquinas.map { it.first * w }
        val py = esquinas.map { it.second * h }
        val m = BooleanArray(w * h)
        for (y in 0 until h) for (x in 0 until w) {
            m[y * w + x] = !dentro(x + 0.5, y + 0.5, px, py)
        }
        mascara = m
        claveMascara = clave
        return m
    }

    // Par-impar: cuantas veces un rayo hacia la derecha cruza el contorno.
    private fun dentro(x: Double, y: Double, px: List<Double>, py: List<Double>): Boolean {
        var adentro = false
        var j = px.size - 1
        for (i in px.indices) {
            if ((py[i] > y) != (py[j] > y) && x < (px[j] - px[i]) * (y - py[i]) / (py[j] - py[i]) + px[i]) adentro = !adentro
            j = i
        }
        return adentro
    }
}
