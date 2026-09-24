// Geometria.kt — La pantalla dentro de la foto: esquinas, gabinetes y horario.
package com.spaceeye.agent.pantalla

import org.json.JSONObject
import java.time.LocalTime

/**
 * Lo que alguien marco en el dashboard sobre una foto del equipo:
 *
 *   - las 4 ESQUINAS de la pantalla, en fracciones de la foto tal como la guarda
 *     el equipo (ya girada), en orden: arriba-izq, arriba-der, abajo-der,
 *     abajo-izq. Cuatro esquinas y no un rectangulo porque casi ninguna camara ve
 *     la pantalla de frente (TLALPAN la ve en diagonal) y hay que "enderezarla"
 *     para que cada gabinete caiga en su lugar;
 *   - cuantos gabinetes tiene (filas x columnas), para poder decir "Gabinete 4";
 *   - zonas a no juzgar (tapadas por algo fijo);
 *   - el HORARIO en que la pantalla debe estar encendida. Fuera de el, una
 *     pantalla apagada es lo normal y no se vigila.
 */
class Geometria(
    val esquinas: List<Pair<Double, Double>>,
    val filas: Int,
    val columnas: Int,
    val excluir: Set<Pair<Int, Int>>,
    val inicio: LocalTime,
    val fin: LocalTime,
) {
    companion object {
        /** Margen tras encender y antes de apagar: el arranque del reproductor no es una falla. */
        const val MARGEN_MIN = 10L

        fun deJson(j: JSONObject?): Geometria? {
            if (j == null) return null
            val e = j.optJSONArray("esquinas") ?: return null
            if (e.length() != 4) return null
            val esquinas = (0 until 4).map { i -> e.getJSONArray(i).let { it.getDouble(0) to it.getDouble(1) } }
            if (esquinas.any { (x, y) -> x !in 0.0..1.0 || y !in 0.0..1.0 }) return null
            val filas = j.optInt("filas", 1).coerceIn(1, 20)
            val columnas = j.optInt("columnas", 1).coerceIn(1, 40)
            val excluir = mutableSetOf<Pair<Int, Int>>()
            j.optJSONArray("excluir")?.let { a -> for (i in 0 until a.length()) a.getJSONArray(i).let { excluir.add(it.getInt(0) to it.getInt(1)) } }
            val h = j.optJSONObject("horario")
            return Geometria(esquinas, filas, columnas, excluir,
                hora(h?.optString("inicio"), LocalTime.of(6, 0)),
                hora(h?.optString("fin"), LocalTime.MIDNIGHT))
        }

        private fun hora(s: String?, pordefecto: LocalTime): LocalTime = try {
            if (s.isNullOrBlank()) pordefecto
            else if (s.startsWith("24")) LocalTime.MIDNIGHT
            else LocalTime.parse(if (s.length == 4) "0$s" else s)
        } catch (_: Exception) { pordefecto }

        /**
         * Si a esta hora la pantalla debe estar encendida (con margen). Acepta
         * horarios que cruzan la medianoche (de 18:00 a 02:00) y fin = 00:00
         * como "hasta la medianoche", que es el caso normal: de 6 a 24.
         */
        fun enHorario(ahora: LocalTime, inicio: LocalTime, fin: LocalTime, margenMin: Long = MARGEN_MIN): Boolean {
            val a = ahora.toSecondOfDay()
            val i = inicio.toSecondOfDay() + margenMin * 60
            var f = fin.toSecondOfDay() - margenMin * 60
            if (fin == LocalTime.MIDNIGHT) f = 24 * 3600 - margenMin * 60
            return if (inicio.toSecondOfDay() < (if (fin == LocalTime.MIDNIGHT) 24 * 3600 else fin.toSecondOfDay())) {
                a in i until f
            } else {
                // Cruza la medianoche.
                a >= i || a < f
            }
        }
    }

    fun enHorario(ahora: LocalTime = LocalTime.now()) = enHorario(ahora, inicio, fin)

    /** Numero de gabinete como lo cuenta una persona: de izquierda a derecha y de arriba abajo, desde 1. */
    fun numero(fila: Int, columna: Int) = fila * columnas + columna + 1

    /**
     * Homografia del cuadrado unitario (u, v en 0..1 sobre la pantalla enderezada)
     * a la foto (fracciones). Sirve para dibujar en la evidencia el contorno del
     * gabinete que fallo en el lugar exacto donde se ve.
     */
    private val h: DoubleArray by lazy { homografia(esquinas) }

    fun aFoto(u: Double, v: Double): Pair<Double, Double> {
        val w = h[6] * u + h[7] * v + 1.0
        return (h[0] * u + h[1] * v + h[2]) / w to (h[3] * u + h[4] * v + h[5]) / w
    }

    /** Las 4 esquinas de un gabinete en la foto (fracciones), en el mismo orden. */
    fun contorno(fila: Int, columna: Int): List<Pair<Double, Double>> {
        val u0 = columna.toDouble() / columnas
        val u1 = (columna + 1).toDouble() / columnas
        val v0 = fila.toDouble() / filas
        val v1 = (fila + 1).toDouble() / filas
        return listOf(aFoto(u0, v0), aFoto(u1, v0), aFoto(u1, v1), aFoto(u0, v1))
    }

    /** Resume todo lo que, si cambia, invalida lo aprendido. */
    fun firma(): String = esquinas.joinToString(";") { "%.3f,%.3f".format(it.first, it.second) } + "|$filas x $columnas"
}

/**
 * Homografia de (0,0),(1,0),(1,1),(0,1) a las cuatro esquinas dadas. Formula
 * cerrada del cuadrado a un cuadrilatero (Heckbert), sin resolver sistemas.
 */
internal fun homografia(q: List<Pair<Double, Double>>): DoubleArray {
    val (x0, y0) = q[0]; val (x1, y1) = q[1]; val (x2, y2) = q[2]; val (x3, y3) = q[3]
    val dx1 = x1 - x2; val dx2 = x3 - x2; val dx3 = x0 - x1 + x2 - x3
    val dy1 = y1 - y2; val dy2 = y3 - y2; val dy3 = y0 - y1 + y2 - y3
    val g: Double
    val hh: Double
    if (dx3 == 0.0 && dy3 == 0.0) { g = 0.0; hh = 0.0 } else {
        val det = dx1 * dy2 - dx2 * dy1
        g = (dx3 * dy2 - dx2 * dy3) / det
        hh = (dx1 * dy3 - dx3 * dy1) / det
    }
    val a = x1 - x0 + g * x1
    val b = x3 - x0 + hh * x3
    val d = y1 - y0 + g * y1
    val e = y3 - y0 + hh * y3
    return doubleArrayOf(a, b, x0, d, e, y0, g, hh)
}
