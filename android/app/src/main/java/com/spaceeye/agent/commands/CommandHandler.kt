package com.spaceeye.agent.commands

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.PowerManager
import android.location.Geocoder
import android.location.LocationManager
import android.util.Log
import com.spaceeye.agent.camera.CamaraNoDisponible
import com.spaceeye.agent.camera.PhotoCapture
import com.spaceeye.agent.camera.PhotoWatermark
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import com.spaceeye.agent.network.ApiClient
import com.spaceeye.agent.network.RemoteLog
import com.spaceeye.agent.network.SocketManager
import com.spaceeye.agent.network.TokenStore
import com.spaceeye.agent.vinculacion.Mudanza
import com.spaceeye.agent.network.WebRTCClient
import com.spaceeye.agent.service.MonitorService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import org.json.JSONObject
import com.spaceeye.agent.pantalla.CamaraParaVigilar
import java.util.concurrent.atomic.AtomicInteger

class CommandHandler(
    private val ctx: Context,
    private val scope: CoroutineScope,
    private val socketManager: SocketManager
) : CamaraParaVigilar {
    companion object {
        private const val TAG = "CommandHandler"
    }

    private val photoCapture = PhotoCapture(ctx)
    private val webrtc = WebRTCClient(ctx)
    private val apiClient = ApiClient(ctx)

    // Fotos pedidas en curso. La vigilancia de creativos se aparta mientras haya
    // alguna: con un solo sensor, la evidencia pedida manda.
    private val fotosEnCurso = AtomicInteger(0)

    // Hay un recorrido de vigilancia con la camara abierta. Mientras dure, una
    // foto que termina NO debe quitarle al servicio el tipo "camara": el
    // vigilante la va a reabrir en cuanto quede libre, y Android se la negaria.
    @Volatile private var vigilando = false

    // --- CamaraParaVigilar ----------------------------------------------------

    override fun ocupada(): Boolean = fotosEnCurso.get() > 0 || webrtc.isStreaming() || webrtc.vivoPedido()

    override suspend fun abrir(lente: String, zoom: Float): Boolean {
        if (ocupada()) return false
        vigilando = true
        MonitorService.setCameraActive(true)
        webrtc.setEncuadre(lente, zoom)
        // Con tope: si CameraX nunca contestara, la vigilancia se quedaba colgada
        // para siempre con la camara abierta.
        return withTimeoutOrNull(15_000L) {
            suspendCancellableCoroutine<Boolean> { cont ->
                webrtc.abrirVigilancia { ok -> if (cont.isActive) cont.resume(ok) }
            }
        } ?: false
    }

    override suspend fun tomar(): ByteArray? = withTimeoutOrNull(15_000L) {
        suspendCancellableCoroutine<ByteArray?> { cont ->
            webrtc.vistazo { bytes -> if (cont.isActive) cont.resume(bytes) }
        }
    }

    override fun enderezar(jpeg: ByteArray, grados: Int): ByteArray = webrtc.enderezar(jpeg, grados)

    override fun cerrar() {
        webrtc.cerrarVigilancia()
        vigilando = false
        if (!ocupada()) MonitorService.setCameraActive(false)
    }

    init {
        socketManager.onWebRTCAnswer = { data ->
            // sdp can be an object { type, sdp } or a bare string
            val sdpField = data.opt("sdp")
            val sdpJson: JSONObject? = when (sdpField) {
                is JSONObject -> sdpField
                is String -> JSONObject().put("type", "answer").put("sdp", sdpField)
                else -> null
            }
            if (sdpJson != null) {
                webrtc.onAnswerReceived(sdpJson)
            } else {
                Log.e(TAG, "Invalid webrtc_answer format: $data")
            }
        }

        socketManager.onWebRTCIceCandidate = { data ->
            val candidate = data.optJSONObject("candidate")
            if (candidate != null) {
                webrtc.onIceCandidateReceived(candidate)
            }
        }
    }

    /**
     * Control manual de camara en vivo (canal `camera_control`, tiempo real).
     * Solo tiene efecto si hay un stream activo (la camara CameraX esta abierta).
     * control = { action, ...params }.
     */
    fun handleCameraControl(control: JSONObject) {
        when (control.optString("action")) {
            "zoom" -> webrtc.setZoom(control.optDouble("value", 0.0).toFloat())
            "focus" -> webrtc.focusAt(
                control.optDouble("x", 0.5).toFloat(),
                control.optDouble("y", 0.5).toFloat(),
                lock = false
            )
            "lock_focus" -> webrtc.focusAt(
                control.optDouble("x", 0.5).toFloat(),
                control.optDouble("y", 0.5).toFloat(),
                lock = true
            )
            "unlock_focus" -> webrtc.unlockFocus()
            "exposure" -> webrtc.setExposure(control.optInt("value", 0))
            "wb" -> webrtc.setWhiteBalance(control.optString("value", "auto"))
            else -> Log.w(TAG, "Unknown camera_control action: ${control.optString("action")}")
        }
    }

    // Direccion legible a partir del GPS (geocodificacion inversa). Best-effort:
    // requiere red; si no hay servicio devuelve lista vacia (se muestra solo DMS).
    private fun reverseGeocode(lat: Double, lng: Double): List<String> {
        return try {
            @Suppress("DEPRECATION")
            val addrs = Geocoder(ctx, Locale("es", "MX")).getFromLocation(lat, lng, 1)
            val a = addrs?.firstOrNull() ?: return emptyList()
            val out = mutableListOf<String>()
            val street = listOfNotNull(a.subThoroughfare, a.thoroughfare).joinToString(" ")
            if (street.isNotBlank()) out.add(street)
            a.subLocality?.let { out.add(it) }
            a.locality?.let { out.add(it) }
            a.adminArea?.let { out.add(it) }
            out
        } catch (e: Exception) {
            Log.w(TAG, "geocode: ${e.message}")
            emptyList()
        }
    }

    // Convierte coordenadas decimales a grados/minutos/segundos (ej. 21°2'51.19"N).
    private fun toDMS(lat: Double, lng: Double): String {
        fun part(v: Double, pos: String, neg: String): String {
            val hemi = if (v >= 0) pos else neg
            val a = abs(v)
            val d = a.toInt()
            val mFull = (a - d) * 60
            val m = mFull.toInt()
            val s = (mFull - m) * 60
            return "%d°%d'%.2f\"%s".format(d, m, s, hemi)
        }
        return "${part(lat, "N", "S")} ${part(lng, "E", "W")}"
    }

    // Ubicacion actual (ultima conocida) para estampar en la foto.
    @SuppressLint("MissingPermission")
    /**
     * El estado del telefono que explica un fallo de camara, en una linea.
     *
     * Son las tres cosas que hasta ahora habia que ir a mirar al sitio: si el
     * permiso sigue concedido (Android lo revoca solo a las apps que considera
     * sin uso), si el equipo esta en modo de ahorro -que limita el trabajo en
     * segundo plano- y si el servicio logro declararse en uso de camara, sin lo
     * cual Android niega las capturas aunque el permiso este dado.
     */
    private fun estadoDeCamara(): String {
        val permiso = try {
            ctx.checkSelfPermission(android.Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        } catch (e: Exception) { false }
        val ahorro = try {
            (ctx.getSystemService(Context.POWER_SERVICE) as PowerManager).isPowerSaveMode
        } catch (e: Exception) { false }
        return "permiso de camara: ${if (permiso) "concedido" else "NEGADO"}; " +
            "servicio en uso de camara: ${if (MonitorService.camaraDeclarada()) "si" else "NO"}; " +
            "modo de ahorro: ${if (ahorro) "encendido" else "apagado"}"
    }

    private fun currentLatLng(): Pair<Double, Double>? {
        return try {
            val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val loc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            if (loc != null) Pair(loc.latitude, loc.longitude) else null
        } catch (e: Exception) {
            Log.w(TAG, "location: ${e.message}")
            null
        }
    }

    /**
     * Mudarse a otro servidor (ver vinculacion/Mudanza.kt). Primero se prueba el
     * alta alla; solo si sale se le contesta al servidor de siempre, con su llave,
     * y despues se cambia y se reconecta el canal de ordenes al nuevo. No hace
     * falta reiniciar la app: cada peticion lee el servidor y la llave al salir.
     */
    private suspend fun mudarse(id: Int, orden: Mudanza.Orden) {
        val r = withContext(Dispatchers.IO) {
            Mudanza.intentar(orden, TokenStore(ctx), System.currentTimeMillis(), apiClient::altaEn) { lista ->
                if (id > 0) apiClient.reportCommandResult(
                    id, true,
                    JSONObject().put("mudanza", lista.servidor)
                        .apply { lista.deviceIdNuevo?.let { put("device_id_nuevo", it) } }
                )
                RemoteLog.info(ctx, "mudanza", "El equipo se muda a ${lista.servidor}")
            }
        }
        when (r) {
            is Mudanza.Resultado.Lista -> {
                Log.i(TAG, "Mudanza a ${r.servidor}; reconectando")
                // Un vivo abierto va contra el servidor de antes: se corta.
                if (webrtc.isStreaming() || webrtc.vivoPedido()) {
                    webrtc.stopStreaming()
                    if (!vigilando) MonitorService.setCameraActive(false)
                }
                socketManager.disconnect()
                socketManager.connect()
            }
            is Mudanza.Resultado.Fallo -> mudanzaFallida(id, r.motivo)
        }
    }

    /** No se movio: se queda donde estaba y le dice al de siempre por que. */
    private suspend fun mudanzaFallida(id: Int, motivo: String) {
        Log.w(TAG, "Mudanza no hecha: $motivo")
        RemoteLog.error(ctx, "mudanza", "No se pudo mudar: $motivo")
        if (id > 0) withContext(Dispatchers.IO) {
            apiClient.reportCommandResult(id, false, errorMessage = "No se pudo mudar: $motivo".take(500))
        }
    }

    fun handle(cmd: JSONObject) {
        val type = cmd.optString("command_type")
        val id = cmd.optInt("id")
        val payload = cmd.optJSONObject("payload")

        scope.launch {
            try {
                when (type) {
                    "TAKE_PHOTO" -> {
                        val commandId = if (id > 0) id else null
                        val campaignId = payload?.optInt("campaign_id")?.takeIf { it > 0 }
                        val scheduleId = payload?.optInt("schedule_id")?.takeIf { it > 0 }

                        // Habilita el tipo FGS camera durante la captura (Android 14
                        // exige acceso a camara solo con ese tipo activo).
                        MonitorService.setCameraActive(true)

                        // Rotacion del visor (stream) al momento de capturar, para
                        // que la foto se guarde con esa misma orientacion.
                        val rotation = payload?.optInt("rotation", 0) ?: 0

                        // Encuadre fijo del sitio, que manda el backend en la orden.
                        // Va en TODAS las ordenes de foto (programadas incluidas):
                        // antes la foto por horario ignoraba cualquier ajuste y salia
                        // siempre al encuadre por defecto del lente principal.
                        val lente = payload?.optString("camera_lens", "main") ?: "main"
                        val zoom = (payload?.optDouble("camera_zoom", 0.0) ?: 0.0).toFloat()
                        webrtc.setEncuadre(lente, zoom)

                        // UN SOLO camino para la foto, haya stream o no.
                        //
                        // Antes eran dos: con stream se usaba la sesion CameraX
                        // (buena calidad, encuadre y ajustes del sitio) y sin
                        // stream se abria la camara con Camera2 en crudo y se
                        // disparaba al instante. Esa segunda salia desenfocada, mal
                        // expuesta y con otro encuadre, asi que la misma camara
                        // daba fotos buenas o malas segun si alguien habia abierto
                        // el visor antes. Ahora las dos pasan por la misma sesion
                        // con los mismos parametros.
                        val estabaTransmitiendo = webrtc.isStreaming()
                        // Por que no salio la foto. Se arma por el camino y viaja
                        // al dashboard: antes todo fallo -camara negada, otra app
                        // usandola, servicio caido- llegaba como "capture_failed",
                        // que no dice a nadie que hacer.
                        var motivoFallo: String? = null
                        fotosEnCurso.incrementAndGet()
                        val photo: ByteArray? = try {
                            val porCameraX = suspendCancellableCoroutine<ByteArray?> { cont ->
                                webrtc.capturarFoto(rotation) { bytes -> if (cont.isActive) cont.resume(bytes) }
                            }
                            // Respaldo: si la camara no se pudo abrir por CameraX
                            // (otra app la tiene tomada, por ejemplo), se intenta
                            // por el camino directo. Da una foto peor, pero una
                            // foto peor es mejor que ninguna, y el sitio no se
                            // queda sin evidencia del dia.
                            porCameraX ?: run {
                                Log.w(TAG, "CameraX no dio foto; se intenta por el camino directo")
                                motivoFallo = "la sesion de camara no entrego imagen"
                                try {
                                    photoCapture.captureNow(lente, zoom)
                                } catch (e: CamaraNoDisponible) {
                                    Log.e(TAG, "respaldo tambien fallo: ${e.message}")
                                    motivoFallo = e.motivo
                                    null
                                } catch (e: Exception) {
                                    Log.e(TAG, "respaldo tambien fallo: ${e.message}")
                                    motivoFallo = e.message ?: e.javaClass.simpleName
                                    null
                                }
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "captura fallida: ${e.message}")
                            motivoFallo = e.message ?: e.javaClass.simpleName
                            null
                        } finally {
                            fotosEnCurso.decrementAndGet()
                            // Si la camara se abrio solo para esta foto, se libera
                            // el tipo camera del servicio al terminar.
                            if (!estabaTransmitiendo && !webrtc.isStreaming() && !vigilando) {
                                MonitorService.setCameraActive(false)
                            }
                        }

                        if (photo != null) {
                            Log.d(TAG, "Photo captured: ${photo.size} bytes")
                            RemoteLog.info(ctx, "photo", "Foto capturada (${photo.size / 1024} KB)")

                            // v0.8.0: ya NO se quema la marca en el telefono. Se sube la
                            // foto LIMPIA (watermark_baked=false) y el dashboard dibuja la
                            // marca configurable (nombre/fecha/hora) en la posicion del
                            // dispositivo. Se conserva el GPS como metadato.
                            val ll = currentLatLng()

                            val uploaded = withContext(Dispatchers.IO) {
                                apiClient.uploadPhoto(
                                    photoBytes = photo,
                                    commandId = commandId,
                                    campaignId = campaignId,
                                    scheduleId = scheduleId,
                                    gpsLat = ll?.first,
                                    gpsLng = ll?.second,
                                    source = "on_demand",
                                    watermarkBaked = false
                                )
                            }
                            if (id > 0) {
                                withContext(Dispatchers.IO) {
                                    apiClient.reportCommandResult(
                                        commandId = id,
                                        success = uploaded,
                                        errorMessage = if (!uploaded) "upload_failed" else null
                                    )
                                }
                            }
                        } else {
                            val motivo = motivoFallo ?: "sin motivo reportado por la camara"
                            RemoteLog.error(
                                ctx, "photo",
                                "Fallo al capturar la foto: $motivo. ${estadoDeCamara()}"
                            )
                            if (id > 0) {
                                withContext(Dispatchers.IO) {
                                    apiClient.reportCommandResult(
                                        id, false,
                                        errorMessage = motivo.take(240)
                                    )
                                }
                            }
                        }
                    }
                    // Actualizacion remota: evita el viaje a sitio por cada version.
                    "UPDATE_APP" -> {
                        val url = payload?.optString("url").orEmpty()
                            .ifBlank {
                                val servidor = com.spaceeye.agent.network.TokenStore(ctx).servidorActivo()
                                    ?: com.spaceeye.agent.BuildConfig.SERVER_URL
                                "$servidor/space-eye.apk"
                            }
                        val sha = payload?.optString("sha256")?.ifBlank { null }
                        val vc = payload?.optInt("version_code", 0)?.takeIf { it > 0 }
                        RemoteLog.info(ctx, "update", "Actualizacion solicitada desde el dashboard")

                        val res = withContext(Dispatchers.IO) {
                            com.spaceeye.agent.update.AppUpdater(ctx).actualizar(url, sha, vc)
                        }
                        // Se responde ANTES de que el instalador mate el proceso: si
                        // no, el comando quedaria "enviado" para siempre.
                        if (id > 0) {
                            withContext(Dispatchers.IO) {
                                when (res) {
                                    is com.spaceeye.agent.update.AppUpdater.Resultado.Fallo ->
                                        apiClient.reportCommandResult(id, false, errorMessage = res.motivo)
                                    else -> apiClient.reportCommandResult(id, true)
                                }
                            }
                        }
                    }

                    "START_STREAM" -> {
                        // Habilita el tipo FGS camera antes de abrir la camara.
                        MonitorService.setCameraActive(true)
                        // Mismo encuadre fijo que tendran las fotos: hay que
                        // encuadrar viendo lo que de verdad se va a recibir.
                        webrtc.setEncuadre(
                            payload?.optString("camera_lens", "main") ?: "main",
                            (payload?.optDouble("camera_zoom", 0.0) ?: 0.0).toFloat()
                        )
                        // ICE servers (STUN + TURN) del backend, para conectar en
                        // redes remotas / datos moviles.
                        val ice = withContext(Dispatchers.IO) { apiClient.getIceServers() }
                        if (ice != null) webrtc.setIceServers(ice)
                        val sessionId = payload?.optString("session_id") ?: ""
                        webrtc.startStreaming(sessionId) { event, data ->
                            socketManager.emit(event, data)
                        }
                        if (id > 0) {
                            withContext(Dispatchers.IO) {
                                apiClient.reportCommandResult(id, true)
                            }
                        }
                    }
                    "STOP_STREAM" -> {
                        webrtc.stopStreaming()
                        // Libera el tipo FGS camera al terminar el stream, salvo
                        // que un recorrido de vigilancia vaya a retomar la camara.
                        if (!vigilando) MonitorService.setCameraActive(false)
                        if (id > 0) {
                            withContext(Dispatchers.IO) {
                                apiClient.reportCommandResult(id, true)
                            }
                        }
                    }
                    "CHANGE_QUALITY" -> {
                        webrtc.setQuality(payload?.optString("quality") ?: "medium")
                        if (id > 0) {
                            withContext(Dispatchers.IO) {
                                apiClient.reportCommandResult(id, true)
                            }
                        }
                    }
                    // Configuracion a distancia. Por ahora el telefono solo atiende la
                    // mudanza a otro servidor; lo demas se ignora, como siempre.
                    "UPDATE_CONFIG" -> {
                        val datos = payload ?: cmd.optString("payload").takeIf { it.isNotBlank() }
                            ?.let { try { JSONObject(it) } catch (_: Exception) { null } }
                        when (val l = Mudanza.leerOrden(datos)) {
                            Mudanza.Lectura.NoEsMudanza -> Unit
                            is Mudanza.Lectura.Invalida -> mudanzaFallida(id, l.motivo)
                            is Mudanza.Lectura.Valida -> mudarse(id, l.orden)
                        }
                    }
                    "REBOOT_APP" -> {
                        if (id > 0) {
                            withContext(Dispatchers.IO) {
                                apiClient.reportCommandResult(id, true)
                            }
                        }
                        android.os.Process.killProcess(android.os.Process.myPid())
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error handling $type: ${e.message}", e)
                RemoteLog.error(ctx, "command", "Error en $type: ${e.message}")
                if (id > 0) {
                    try {
                        withContext(Dispatchers.IO) {
                            apiClient.reportCommandResult(id, false, errorMessage = e.message)
                        }
                    } catch (_: Exception) {}
                }
            }
        }
    }
}
