// Campanas.kt — Las campanas que se vendieron para esta pantalla, y su foto de prueba del dia.
package com.spaceeye.agent.pantalla

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.time.Instant
import java.time.ZoneId

/**
 * SPACE OS sabe que creativo sale en que pantalla (sus reservas confirmadas) y se
 * lo manda a Space Eye; el servidor lo pasa al equipo en la configuracion de
 * creativos como `campanas: [{"id", "sha", "foto_hoy"}]`. Igual que en la
 * Raspberry (pi-agent/vision/campanas.py).
 *
 * Aqui va solo la contabilidad, sin OpenCV, para probarla en la PC:
 *   - se baja la referencia de cada campana UNA vez (reducida en el servidor,
 *     unos 50 KB) y se guarda en disco por su huella; si el arte cambia, se baja
 *     la nueva y se borra la vieja;
 *   - una prueba por campana al dia. Que ya se mando hoy se guarda en disco y
 *     tambien lo dice el servidor (`foto_hoy`), asi un reinicio no la repite.
 *
 * La comparacion con la pantalla (ORB con geometria) vive en BuscadorCampanas.
 */
class Campanas(
    directorio: File,
    /** El JPEG de la referencia, o null (sin red, o ya no es del equipo). */
    private val descargar: (Int) -> ByteArray?,
    private val ahora: () -> Long,
    private val zona: ZoneId = ZoneId.systemDefault(),
) {
    companion object {
        // Una referencia que no se pudo bajar se reintenta, pero no en cada vuelta.
        const val REINTENTO_MS = 10 * 60_000L
    }

    class Activa(val sha: String, val fotoHoy: Boolean)

    /** Una referencia que ya esta en disco. */
    class Referencia(val id: Int, val sha: String, val archivo: File)

    val dir = File(directorio, "campanas").apply { mkdirs() }
    private val indice = File(dir, "campanas.json")
    private var activas = linkedMapOf<Int, Activa>()
    private val fallidas = mutableMapOf<Int, Long>()
    var dia = ""
        private set
    private val hechas = mutableSetOf<Int>()

    init {
        try {
            val j = JSONObject(indice.readText())
            dia = j.optString("dia", "")
            j.optJSONArray("hechas")?.let { a -> for (i in 0 until a.length()) hechas.add(a.getInt(i)) }
        } catch (_: Exception) {
            // Nuevo, o el indice no se pudo leer: se empieza sin pruebas de hoy.
        }
    }

    private fun hoy(): String = Instant.ofEpochMilli(ahora()).atZone(zona).toLocalDate().toString()

    private fun guardar() {
        try {
            val tmp = File(dir, "campanas.json.tmp")
            tmp.writeText(JSONObject().put("dia", dia).put("hechas", JSONArray(hechas.sorted())).toString())
            Files.move(tmp.toPath(), indice.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
        } catch (_: Exception) {}
    }

    fun archivo(id: Int, sha: String): File =
        File(dir, "${id}_${sha.filter { it.isLetterOrDigit() }.take(32)}.jpg")

    private fun nuevoDia() {
        val h = hoy()
        if (h != dia) {
            dia = h
            hechas.clear()
            guardar()
        }
    }

    /** La lista de la configuracion: baja lo que falta y olvida lo que ya no viene. */
    fun actualizar(lista: JSONArray?) {
        nuevoDia()
        val nuevas = linkedMapOf<Int, Activa>()
        if (lista != null) for (i in 0 until lista.length()) {
            val c = lista.optJSONObject(i) ?: continue
            val id = c.opt("id")?.toString()?.toDoubleOrNull()?.toInt() ?: continue
            val sha = c.optString("sha", "").ifEmpty { id.toString() }
            nuevas[id] = Activa(sha, c.optBoolean("foto_hoy"))
        }
        // Lo que el servidor ya tiene de hoy cuenta como hecho (reinicios).
        var cambio = false
        for ((id, c) in nuevas) if (c.fotoHoy && hechas.add(id)) cambio = true
        if (cambio) guardar()
        // El arte que ya no viene (campana terminada, o arte cambiado) se borra.
        val quedan = nuevas.map { (id, c) -> archivo(id, c.sha).name }.toSet()
        dir.listFiles()?.forEach { f -> if (f.name.endsWith(".jpg") && f.name !in quedan) f.delete() }
        activas = nuevas
        fallidas.keys.retainAll(nuevas.keys)
        for ((id, c) in nuevas) {
            val ruta = archivo(id, c.sha)
            if (ruta.exists()) continue
            val fallo = fallidas[id]
            if (fallo != null && ahora() - fallo < REINTENTO_MS) continue
            val jpeg = try { descargar(id) } catch (_: Exception) { null }
            if (jpeg == null || jpeg.isEmpty()) { fallidas[id] = ahora(); continue }
            try {
                val tmp = File(dir, ruta.name + ".tmp")
                tmp.writeBytes(jpeg)
                Files.move(tmp.toPath(), ruta.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
                fallidas.remove(id)
            } catch (_: Exception) {
                fallidas[id] = ahora()
            }
        }
    }

    /** Las referencias que ya estan en disco, listas para comparar. */
    fun referencias(): List<Referencia> =
        activas.mapNotNull { (id, c) -> archivo(id, c.sha).takeIf { it.exists() }?.let { Referencia(id, c.sha, it) } }

    val tamaño: Int get() = referencias().size

    fun pendiente(id: Int): Boolean {
        nuevoDia()
        return id in activas && id !in hechas
    }

    fun marcar(id: Int) {
        nuevoDia()
        hechas.add(id)
        guardar()
    }
}

/**
 * Cuando reutilizar la configuracion guardada en modo continuo (la vuelta no la
 * pide cada 5 segundos, solo cada 15 minutos). Con la huella que el servidor
 * contesta en cada reporte de estado, un ajuste en el panel o una campana nueva
 * llegan en la siguiente vuelta en vez de esperar los 15 minutos. Sin huella
 * (servidores viejos) vale como igual: queda solo el plazo.
 */
object HuellaConfig {
    const val PLAZO_MS = 15 * 60_000L

    fun reusar(huellaActual: String?, huellaAlPedir: String?, pedidaEn: Long, ahora: Long, plazoMs: Long = PLAZO_MS): Boolean {
        val igual = huellaActual == null || huellaActual == huellaAlPedir
        return igual && ahora - pedidaEn < plazoMs
    }
}
