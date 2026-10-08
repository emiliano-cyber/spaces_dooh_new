// Mudanza.kt — Mudar el telefono a otro servidor de Space Eye, a distancia
package com.spaceeye.agent.vinculacion

import org.json.JSONObject
import kotlin.math.abs

/**
 * Los telefonos de campo hablan con el Space Eye central; cada empresa tiene
 * ahora el suyo (eyes.<dominio>). Pasar un equipo de uno a otro no puede exigir
 * ir al sitio: llega como orden UPDATE_CONFIG con { mudanza: { servidor, codigo? } },
 * un tipo que el servidor central YA acepta, igual que en la Raspberry y la PC
 * (pi-agent/src/mudanza.js).
 *
 * Sin quedarse mudo:
 *   1. Antes de moverse se da de alta en el servidor nuevo con su MISMA identidad
 *      (device_uid). Si no puede, NO se mueve y contesta el motivo al de siempre.
 *   2. Si puede, contesta que se muda, guarda servidor y llave nuevos y anota la
 *      mudanza pendiente con el servidor y la llave de antes.
 *   3. El primer reporte de estado que entra en el nuevo la confirma.
 *   4. Si en `mudanza_espera_min` (30 por omision) no logra reportar alla, se
 *      REGRESA SOLO al anterior. Un servidor nuevo mal configurado no deja a un
 *      sitio sin cobertura.
 *
 * Todo aqui es Kotlin puro (sin Android) para probarlo en la PC.
 */
object Mudanza {

    const val ESPERA_MIN = 30

    data class Orden(val servidor: String, val codigo: String?, val esperaMin: Int)

    /** Lo que hay guardado en el telefono. El token solo vale para [tokenServidor]. */
    data class Estado(
        val servidor: String?,
        val token: String?,
        val tokenServidor: String?,
        val pendiente: Pendiente?,
    )

    /** Una mudanza hecha pero aun no confirmada: lo necesario para volver. */
    data class Pendiente(
        val anterior: String,
        val tokenAnterior: String?,
        val desde: Long,
        val esperaMin: Int,
    )

    /** Como contesto el servidor nuevo al alta. */
    sealed class Alta {
        data class Lista(val token: String, val deviceId: Long?) : Alta()
        data class Rechazada(val error: String, val codigoHttp: Int) : Alta()
        data class SinRed(val detalle: String) : Alta()
        /** Android no deja hablar por http a ese servidor (network_security_config). */
        object SoloHttps : Alta()
    }

    sealed class Resultado {
        data class Lista(val estado: Estado, val servidor: String, val deviceIdNuevo: Long?) : Resultado()
        data class Fallo(val motivo: String) : Resultado()
    }

    /** Donde vive el [Estado]. En el telefono es TokenStore; en las pruebas, memoria. */
    interface Almacen {
        fun leer(): Estado
        fun guardar(estado: Estado)
    }

    sealed class Lectura {
        /** UPDATE_CONFIG de otra cosa: sigue como siempre. */
        object NoEsMudanza : Lectura()
        data class Valida(val orden: Orden) : Lectura()
        data class Invalida(val motivo: String) : Lectura()
    }

    /** Lee el payload de UPDATE_CONFIG. */
    fun leerOrden(payload: JSONObject?): Lectura {
        val m = payload?.optJSONObject("mudanza") ?: return Lectura.NoEsMudanza
        val servidor = Vinculacion.normalizarServidor(m.optString("servidor"))
            ?: return Lectura.Invalida("la direccion del servidor nuevo no es valida")
        val codigoTexto = m.optString("codigo").takeIf { !m.isNull("codigo") && it.isNotBlank() }
        val codigo = codigoTexto?.let {
            Vinculacion.normalizarCodigo(it) ?: return Lectura.Invalida("el codigo de vinculacion de la orden no es valido")
        }
        // La espera puede venir dentro de la mudanza o junto a ella, como en la Pi.
        val espera = listOf(m.optInt("mudanza_espera_min", 0), payload.optInt("mudanza_espera_min", 0))
            .firstOrNull { it > 0 } ?: ESPERA_MIN
        return Lectura.Valida(Orden(servidor, codigo, espera))
    }

    /** Lo que se le contesta al servidor de siempre cuando el nuevo no acepta. */
    fun motivo(alta: Alta): String? = when (alta) {
        is Alta.Lista -> null
        is Alta.Rechazada -> when (alta.error) {
            "vinculacion_requerida" -> "el servidor nuevo no conoce este equipo y la orden no trae codigo de vinculacion"
            "codigo_invalido" -> "el servidor nuevo rechazo el codigo (vencido, usado o cancelado)"
            "demasiados_intentos" -> "el servidor nuevo rechazo el alta por demasiados intentos"
            else -> "el servidor nuevo rechazo el alta (HTTP ${alta.codigoHttp}${if (alta.error.isNotBlank()) " ${alta.error}" else ""})"
        }
        is Alta.SinRed -> "no pude hablar con el servidor nuevo (${alta.detalle})"
        Alta.SoloHttps -> "el servidor nuevo no es https y Android no deja hablarle por http"
    }

    /**
     * Pasos 1 y 2, sin escribir nada: prueba el alta en el nuevo y, si sale,
     * devuelve el estado a guardar. Al nuevo no viaja nada del viejo (ni su llave).
     */
    fun preparar(orden: Orden, actual: Estado, ahora: Long, alta: (servidor: String, codigo: String?) -> Alta): Resultado {
        val anterior = actual.servidor ?: return Resultado.Fallo("el equipo no tiene servidor")
        if (orden.servidor.trimEnd('/') == anterior.trimEnd('/')) return Resultado.Fallo("el equipo ya esta en ese servidor")
        val r = alta(orden.servidor, orden.codigo)
        if (r !is Alta.Lista) return Resultado.Fallo(motivo(r)!!)
        // La llave de antes solo se guarda si de verdad es de ese servidor.
        val tokenAnterior = actual.token?.takeIf { actual.tokenServidor == null || actual.tokenServidor == anterior }
        val nuevo = Estado(
            servidor = orden.servidor,
            token = r.token,
            tokenServidor = orden.servidor,
            pendiente = Pendiente(anterior, tokenAnterior, ahora, orden.esperaMin),
        )
        return Resultado.Lista(nuevo, orden.servidor, r.deviceId)
    }

    /**
     * Todo el paso 1-2 contra un [Almacen]. [antesDeCambiar] corre con el estado
     * VIEJO aun guardado: ahi se le contesta al servidor de siempre (con su llave)
     * que el equipo se va. Si el alta falla, el almacen no se toca.
     */
    fun intentar(
        orden: Orden,
        almacen: Almacen,
        ahora: Long,
        alta: (servidor: String, codigo: String?) -> Alta,
        antesDeCambiar: (Resultado.Lista) -> Unit,
    ): Resultado {
        val r = preparar(orden, almacen.leer(), ahora, alta)
        if (r is Resultado.Lista) {
            antesDeCambiar(r)
            almacen.guardar(r.estado)
        }
        return r
    }

    enum class Accion { NADA, CONFIRMAR, ESPERAR, REGRESAR }

    /**
     * Pasos 3 y 4, en cada latido. La hora es la del reloj de pared porque la
     * espera debe sobrevivir a reinicios del telefono. Si el reloj se fue hacia
     * atras mas que la espera entera (lo pusieron a mano, se desconfiguro), se
     * regresa igual: esperar "hasta que el reloj alcance" podria ser para siempre.
     */
    fun decidir(pendiente: Pendiente?, reporteOk: Boolean, ahora: Long): Accion {
        if (pendiente == null) return Accion.NADA
        if (reporteOk) return Accion.CONFIRMAR
        val espera = pendiente.esperaMin.coerceAtLeast(1) * 60_000L
        return if (abs(ahora - pendiente.desde) > espera) Accion.REGRESAR else Accion.ESPERAR
    }

    /** Paso 3: ya reporto en el nuevo, se olvida lo de antes. */
    fun confirmar(estado: Estado): Estado = estado.copy(pendiente = null)

    /**
     * Paso 4: servidor y llave de antes. Si no habia llave, queda sin ella y el
     * latido se da de alta otra vez en el viejo, que ya conoce al equipo: nunca
     * se cae en la pantalla de vincular.
     */
    fun regresar(estado: Estado): Estado {
        val p = estado.pendiente ?: return estado
        return Estado(
            servidor = p.anterior,
            token = p.tokenAnterior,
            tokenServidor = p.tokenAnterior?.let { p.anterior },
            pendiente = null,
        )
    }
}
